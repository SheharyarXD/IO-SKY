/**
 * Milestone 3 §3.5 (RM-111) — confirm Milestone 1's indexes are actually used.
 *
 * RM-45 added indexes on every foreign key and every status/tenant column in a
 * hot query path. That they *exist* is checked by RM-108. This checks the
 * question that actually matters: does the planner choose them?
 *
 * An index can exist and be ignored — wrong column order, a type mismatch
 * forcing a cast, or a predicate the planner cannot use. The result is a
 * sequential scan that looks fine at 100 rows and falls over at 100,000, which
 * is precisely the failure a pre-launch performance pass is meant to catch.
 *
 * Read-only: every statement is an EXPLAIN. Nothing is executed or written.
 *
 * Note on interpretation: a sequential scan is not automatically wrong. On a
 * table with a handful of rows the planner correctly prefers one, because
 * reading the whole page beats an index lookup plus a heap fetch. So these
 * tests assert the *plan shape is available* — that an index scan is chosen
 * once the table is large enough for it to matter — rather than banning
 * seq scans outright, which would fail on an empty development database and
 * teach the team to ignore the suite.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

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

if (!liveReachable) {
  console.warn(
    "[queryPerformance.test] Skipping RM-111 — no reachable DATABASE_URL. Index-usage " +
      "verification needs a real planner against the real schema.",
  );
}

describe.skipIf(!liveReachable)("RM-111: index usage under realistic queries", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(DATABASE_URL!, { prepare: false, max: 2 });
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 }).catch(() => {});
  });

  /** Return the flattened plan text for a query, without executing it. */
  async function planFor(query: string): Promise<string> {
    const rows = await sql.unsafe(`EXPLAIN (FORMAT TEXT) ${query}`);
    return (rows as unknown as Array<Record<string, string>>)
      .map((r) => Object.values(r)[0])
      .join("\n");
  }

  /**
   * Assert a lookup can be answered by an index once it is worth it.
   *
   * Uses `enable_seqscan = off` for the duration of the EXPLAIN: that forces
   * the planner to reveal whether an index-based plan is even *possible*. If
   * one is, the planner will pick it on its own at scale. If the only plan
   * available is still a sequential scan, the index is genuinely missing or
   * unusable for that predicate — which is the real finding.
   */
  async function indexPlanExists(query: string): Promise<string> {
    await sql.unsafe("SET LOCAL enable_seqscan = off");
    return planFor(query);
  }

  it("looks up a user by email via an index (the login hot path)", async () => {
    // Every local login runs this. A seq scan here is on the critical path of
    // the most frequently hit authenticated endpoint in the product.
    const plan = await sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL enable_seqscan = off");
      const rows = await tx.unsafe(
        `EXPLAIN (FORMAT TEXT) SELECT * FROM "users" WHERE "email" = 'probe@example.com' LIMIT 1`,
      );
      return (rows as unknown as Array<Record<string, string>>)
        .map((r) => Object.values(r)[0])
        .join("\n");
    });
    expect(plan).toMatch(/Index (Only )?Scan|Bitmap/i);
  });

  it("looks up a user by openId via an index (every authenticated request)", async () => {
    // authenticateRequest() calls getUserByOpenId on EVERY request that
    // carries a session cookie, so this is the single hottest query here.
    const plan = await sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL enable_seqscan = off");
      const rows = await tx.unsafe(
        `EXPLAIN (FORMAT TEXT) SELECT * FROM "users" WHERE "openId" = 'probe-open-id' LIMIT 1`,
      );
      return (rows as unknown as Array<Record<string, string>>)
        .map((r) => Object.values(r)[0])
        .join("\n");
    });
    expect(plan).toMatch(/Index (Only )?Scan|Bitmap/i);
  });

  it("filters users by organization via an index (tenant scoping)", async () => {
    // Every tenant-scoped list query funnels through organizationId. RM-45
    // indexed it (users_organization_id_idx).
    const plan = await sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL enable_seqscan = off");
      const rows = await tx.unsafe(
        `EXPLAIN (FORMAT TEXT) SELECT * FROM "users" WHERE "organizationId" = 1`,
      );
      return (rows as unknown as Array<Record<string, string>>)
        .map((r) => Object.values(r)[0])
        .join("\n");
    });
    expect(plan).toMatch(/Index (Only )?Scan|Bitmap/i);
  });

  it("filters bookings by status via an index", async () => {
    // bookings_status_idx, used by the admin booking views.
    const plan = await sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL enable_seqscan = off");
      const rows = await tx.unsafe(
        `EXPLAIN (FORMAT TEXT) SELECT * FROM "bookings" WHERE "status" = 'confirmed'`,
      );
      return (rows as unknown as Array<Record<string, string>>)
        .map((r) => Object.values(r)[0])
        .join("\n");
    });
    expect(plan).toMatch(/Index (Only )?Scan|Bitmap/i);
  });

  it("serves the rate-limit window from its composite index", async () => {
    // Added by migration 0016 for RM-88. This query runs on EVERY
    // rate-limited request when RATE_LIMIT_STORE=postgres, against a table
    // that is written to just as often — an unindexed scan here would be
    // self-inflicted and would degrade under exactly the load the limiter is
    // meant to handle.
    const plan = await sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL enable_seqscan = off");
      const rows = await tx.unsafe(
        `EXPLAIN (FORMAT TEXT) SELECT COUNT(*) FROM "rate_limit_hits"
         WHERE "key" = 'probe:1.1.1.1' AND "hitAtMs" >= 0`,
      );
      return (rows as unknown as Array<Record<string, string>>)
        .map((r) => Object.values(r)[0])
        .join("\n");
    });
    expect(plan).toMatch(/Index (Only )?Scan|Bitmap/i);
  });

  it("reports the planner's natural choice for the login lookup", async () => {
    // Informational, not an assertion: on a small table the planner will
    // legitimately choose a seq scan. Printing the unforced plan makes the
    // current reality visible in CI output without failing a build over a
    // choice that is correct at today's row counts.
    const natural = await planFor(
      `SELECT * FROM "users" WHERE "email" = 'probe@example.com' LIMIT 1`,
    );
    const rowCount = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "users"`;
    console.log(
      `[RM-111] users table has ${rowCount[0].n} rows; unforced plan for the ` +
        `login lookup:\n${natural}`,
    );
    expect(natural.length).toBeGreaterThan(0);
  });
});
