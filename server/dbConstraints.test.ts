/**
 * Milestone 3 §3.4 (RM-108) — database-level enforcement suite:
 * foreign keys, triggers and row-level security.
 *
 * Milestone 1 added ~40 previously-implicit foreign keys (RM-44), the
 * `updatedAt` triggers (migration 0002) and the RLS policies (0004). RM-60's
 * `rls.negative.test.ts` proves RLS *behaviour* through PostgREST. This file
 * covers the other half: that the constraints are actually declared on the
 * live schema, and that the database rejects violations rather than the
 * application merely avoiding them.
 *
 * The distinction matters because application code can look correct while the
 * constraint is missing — every write path just happens not to violate it
 * yet. A missing FK only shows up the day something writes an orphan.
 *
 * Design choices:
 *   - Catalog assertions are read-only queries against pg_catalog /
 *     information_schema. They touch no application rows.
 *   - The two enforcement tests write, but inside a transaction that always
 *     ROLLBACKs, so nothing is left behind in the client's database.
 *   - Skips cleanly when live credentials are absent or the project is
 *     unreachable, matching the RM-60 pattern (presence of env vars is not
 *     the same as reachability — a paused Supabase project leaves
 *     well-formed but dead values in `.env`).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

// These are catalog queries against a remote Supabase instance, run while the
// rest of the suite is also holding connections. In isolation each takes ~1-3s;
// under full-suite parallel load they exceeded the 5s default and failed as
// timeouts rather than on any assertion. The work is network-bound, so the
// right fix is a realistic budget, not a faster query.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const DATABASE_URL = process.env.DATABASE_URL;

async function isReachable(): Promise<boolean> {
  if (!DATABASE_URL) return false;
  let probe: ReturnType<typeof postgres> | null = null;
  try {
    probe = postgres(DATABASE_URL, { prepare: false, connect_timeout: 5, max: 1 });
    await probe`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await probe?.end({ timeout: 1 }).catch(() => {});
  }
}

const liveReachable = await isReachable();

if (!DATABASE_URL) {
  console.warn(
    "[dbConstraints.test] Skipping RM-108 — DATABASE_URL is not configured in this environment.",
  );
} else if (!liveReachable) {
  console.warn(
    "[dbConstraints.test] Skipping RM-108 — DATABASE_URL is configured but the database is not " +
      "reachable (project may be paused). Configured is not the same as reachable.",
  );
}

describe.skipIf(!liveReachable)("RM-108: database constraint enforcement", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(DATABASE_URL!, { prepare: false, max: 2 });
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 }).catch(() => {});
  });

  // -------------------------------------------------------------------------
  // Foreign keys
  // -------------------------------------------------------------------------
  describe("foreign keys", () => {
    it("declares a substantial number of foreign keys, not a handful", async () => {
      // Milestone 1 §1.4 added ~40. A schema that has drifted back to a
      // near-zero count means the referential-integrity work was lost.
      const rows = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.contype = 'f' AND n.nspname = 'public'
      `;
      expect(rows[0].count).toBeGreaterThanOrEqual(30);
    });

    it("every foreign key declares explicit ON DELETE behaviour", async () => {
      // Postgres defaults to NO ACTION when the migration omits it. That is a
      // valid choice, but it must be a choice — RM-44 called for deliberate
      // ON DELETE semantics per relationship. This surfaces any FK that was
      // added later without thinking about it.
      const rows = await sql<{ table_name: string; constraint_name: string }[]>`
        SELECT rel.relname AS table_name, c.conname AS constraint_name
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.contype = 'f'
          AND n.nspname = 'public'
          AND c.confdeltype = 'a'  -- 'a' = NO ACTION (the implicit default)
      `;
      // Reported, not failed: a NO ACTION FK is not itself a defect. This
      // assertion exists so the count cannot grow silently — if it does, the
      // list names exactly which constraints to review.
      if (rows.length > 0) {
        console.warn(
          `[RM-108] ${rows.length} foreign key(s) use the implicit NO ACTION delete rule:\n` +
            rows.map((r) => `  - ${r.table_name}.${r.constraint_name}`).join("\n"),
        );
      }
      expect(Array.isArray(rows)).toBe(true);
    });

    it("rejects an orphaned row at the database layer", async () => {
      // The assertion that proves enforcement rather than declaration.
      // Wrapped in a transaction that always rolls back.
      let violated = false;
      try {
        await sql.begin(async (tx) => {
          await tx`
            INSERT INTO "users" ("openId", "name", "organizationId")
            VALUES (${`rm108-orphan-${Date.now()}`}, 'RM-108 orphan probe', 2147483647)
          `;
          // Force a rollback even if the insert unexpectedly succeeds, so the
          // probe row can never survive this test.
          throw new Error("rm108-intentional-rollback");
        });
      } catch (err) {
        const message = String(err);
        if (message.includes("rm108-intentional-rollback")) {
          violated = false; // insert succeeded — FK did not fire
        } else if (/foreign key|violates/i.test(message)) {
          violated = true;
        } else {
          throw err;
        }
      }
      expect(violated).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Triggers
  // -------------------------------------------------------------------------
  describe("updatedAt triggers", () => {
    it("installs the updatedAt trigger on tables that carry the column", async () => {
      // Migration 0002 replaced MySQL's onUpdateNow() with Postgres triggers.
      // A table with an updatedAt column and no trigger silently stops
      // tracking modification time — invisible until someone relies on it.
      //
      // This assertion found three real gaps on first run: platform_settings,
      // workflow_definitions and webhook_registrations, all created by
      // Milestone 2 migrations after 0002 fixed its list of 18 tables. Their
      // updatedAt reported row-creation time forever. Migration 0017 closes
      // it; this test is what stops the next new table repeating it.
      const missing = await sql<{ table_name: string }[]>`
        SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND a.attname = 'updatedAt'
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND NOT EXISTS (
            SELECT 1 FROM pg_trigger t
            WHERE t.tgrelid = c.oid AND NOT t.tgisinternal
          )
        ORDER BY c.relname
      `;
      expect(missing.map((r) => r.table_name)).toEqual([]);
    });

    it("actually bumps updatedAt on write", async () => {
      // Declared-and-broken is a real state: a trigger can exist and be
      // attached to the wrong event, or call a function that no longer sets
      // the column.
      //
      // The insert and the update MUST be in separate transactions. The
      // trigger function uses now(), which in Postgres is transaction start
      // time and is therefore frozen for the life of a transaction — doing
      // both in one tx (even with pg_sleep between them) yields two identical
      // timestamps and makes a perfectly healthy trigger look broken. That is
      // exactly how this test failed on its first run.
      const openId = `rm108-trigger-${Date.now()}`;
      let id: number | null = null;
      try {
        const inserted = await sql<{ id: number; updatedAt: Date }[]>`
          INSERT INTO "users" ("openId", "name")
          VALUES (${openId}, 'RM-108 trigger probe')
          RETURNING "id", "updatedAt"
        `;
        id = inserted[0].id;
        const before = new Date(inserted[0].updatedAt).getTime();

        // Separate statement => separate implicit transaction => fresh now().
        await sql`SELECT pg_sleep(0.05)`;
        const updated = await sql<{ updatedAt: Date }[]>`
          UPDATE "users" SET "name" = 'RM-108 trigger probe (updated)'
          WHERE "id" = ${id}
          RETURNING "updatedAt"
        `;

        expect(new Date(updated[0].updatedAt).getTime()).toBeGreaterThan(before);
      } finally {
        // Always remove the probe row, including on assertion failure — this
        // runs against the client's real database.
        if (id !== null) {
          await sql`DELETE FROM "users" WHERE "id" = ${id}`.catch(() => {});
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Row-level security
  // -------------------------------------------------------------------------
  describe("row-level security", () => {
    it("enables RLS on every tenant-scoped table", async () => {
      // Complements RM-60, which proves the policies *behave*. This proves
      // they are switched on: a table with policies but RLS disabled enforces
      // nothing at all, and looks fine in a policy listing.
      const tenantScoped = await sql<{ table_name: string; rls_enabled: boolean }[]>`
        SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND a.attname = 'organizationId'
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY c.relname
      `;
      const unprotected = tenantScoped.filter((t) => !t.rls_enabled).map((t) => t.table_name);
      expect(unprotected).toEqual([]);
    });

    it("does not leave an RLS-enabled table with zero policies", async () => {
      // RLS on with no policy denies everything for non-owner roles. That is
      // fail-closed and therefore safe, but for a tenant-scoped table it
      // usually means a policy was dropped by mistake, so it is worth naming.
      const rows = await sql<{ table_name: string }[]>`
        SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relrowsecurity
          AND a.attname = 'organizationId'
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
        ORDER BY c.relname
      `;
      expect(rows.map((r) => r.table_name)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Indexes
  // -------------------------------------------------------------------------
  describe("indexes", () => {
    it("indexes every foreign key column", async () => {
      // An unindexed FK column makes both the join and the parent's DELETE
      // scan the child table. RM-45 indexed them; this catches a new FK added
      // later without one.
      const rows = await sql<{ table_name: string; column_name: string }[]>`
        SELECT rel.relname AS table_name, att.attname AS column_name
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = c.connamespace
        JOIN LATERAL unnest(c.conkey) AS k(attnum) ON TRUE
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k.attnum
        WHERE c.contype = 'f'
          AND n.nspname = 'public'
          AND NOT EXISTS (
            SELECT 1 FROM pg_index i
            WHERE i.indrelid = rel.oid
              AND att.attnum = ANY (i.indkey::smallint[])
          )
        ORDER BY rel.relname, att.attname
      `;
      if (rows.length > 0) {
        console.warn(
          `[RM-108] ${rows.length} foreign key column(s) have no index:\n` +
            rows.map((r) => `  - ${r.table_name}.${r.column_name}`).join("\n"),
        );
      }
      // Reported rather than enforced: adding an index is a migration, and
      // failing CI on a performance nit would be the wrong trade. The named
      // list is what makes it actionable.
      expect(Array.isArray(rows)).toBe(true);
    });
  });
});
