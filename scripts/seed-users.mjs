#!/usr/bin/env node
/**
 * IO SKY — seed staging/test accounts and demo organizations.
 *
 * Milestone 3: rewritten for Postgres/Supabase. The previous version imported
 * `mysql2`, which stopped being a dependency when Milestone 1 (RM-43/46)
 * migrated the database from TiDB to Supabase Postgres — so the script had been
 * dead since then and would throw `ERR_MODULE_NOT_FOUND` on first import.
 *
 * Creates one account per implemented role, plus two organizations so that
 * cross-tenant behaviour has something real to be tested against (a single
 * demo org cannot demonstrate isolation).
 *
 * Usage:
 *   node --env-file=.env scripts/seed-users.mjs
 *   node --env-file=.env scripts/seed-users.mjs --reset   # delete seeded rows first
 *
 * Idempotent: re-running upserts by `openId` rather than inserting duplicates,
 * so it is safe on every boot and in CI.
 *
 * SAFETY: every row this creates is prefixed `staging-` (openId) or lives on
 * the `@staging.iosky.nl` domain, and `--reset` only ever deletes rows matching
 * those markers. It will not touch real accounts, and it is deliberately
 * incapable of a bare "DELETE FROM users".
 */
import postgres from "postgres";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env scripts/seed-users.mjs");
  process.exit(1);
}

const RESET = process.argv.includes("--reset");

/** Marker that identifies every row this script owns. */
const SEED_PREFIX = "staging-";
const SEED_DOMAIN = "@staging.iosky.nl";

const ORGANIZATIONS = [
  {
    slug: "staging-northwind",
    name: "Northwind Logistics",
    legalName: "Northwind Logistics B.V.",
    industry: "Logistics",
    size: "51-200",
    country: "Netherlands",
    operationalScore: 74,
    statusLabel: "Healthy",
  },
  {
    // A second tenant exists so cross-tenant isolation can be demonstrated
    // rather than asserted. With one org, an RLS regression is invisible.
    slug: "staging-brightwave",
    name: "Brightwave Retail",
    legalName: "Brightwave Retail N.V.",
    industry: "Retail",
    size: "11-50",
    country: "Belgium",
    operationalScore: 61,
    statusLabel: "Watching",
  },
];

/**
 * One account per implemented role.
 *
 * Passwords are long, obviously-synthetic and identical in shape so they are
 * easy to hand to a reviewer. They are staging-only by construction: the
 * accounts live on a domain that receives no mail and hold no real data.
 */
const ACCOUNTS = [
  {
    openId: `${SEED_PREFIX}client`,
    email: `client${SEED_DOMAIN}`,
    name: "Staging Client",
    role: "client",
    password: "IOSky-Staging-Client-2026!",
    org: "staging-northwind",
    membershipRole: "owner",
  },
  {
    // Second tenant's client — the counterparty in every cross-tenant test.
    openId: `${SEED_PREFIX}client-b`,
    email: `client-b${SEED_DOMAIN}`,
    name: "Staging Client B",
    role: "client",
    password: "IOSky-Staging-ClientB-2026!",
    org: "staging-brightwave",
    membershipRole: "owner",
  },
  {
    openId: `${SEED_PREFIX}developer`,
    email: `developer${SEED_DOMAIN}`,
    name: "Staging Developer",
    role: "developer",
    password: "IOSky-Staging-Developer-2026!",
    org: null,
  },
  {
    openId: `${SEED_PREFIX}admin`,
    email: `admin${SEED_DOMAIN}`,
    name: "Staging Admin",
    role: "admin",
    password: "IOSky-Staging-Admin-2026!",
    org: null,
  },
  {
    openId: `${SEED_PREFIX}superadmin`,
    email: `superadmin${SEED_DOMAIN}`,
    name: "Staging Super Admin",
    role: "super_admin",
    password: "IOSky-Staging-SuperAdmin-2026!",
    org: null,
  },
  {
    openId: `${SEED_PREFIX}operator`,
    email: `operator${SEED_DOMAIN}`,
    name: "Staging Technical Operator",
    role: "technical_operator",
    password: "IOSky-Staging-Operator-2026!",
    org: null,
  },
];

const sql = postgres(DATABASE_URL, { prepare: false, max: 4 });

async function reset() {
  // Scoped deletes only — see the SAFETY note in the header.
  const orgSlugs = ORGANIZATIONS.map((o) => o.slug);
  await sql`
    DELETE FROM "organization_memberships"
    WHERE "userId" IN (SELECT "id" FROM "users" WHERE "openId" LIKE ${SEED_PREFIX + "%"})
  `;
  await sql`DELETE FROM "users" WHERE "openId" LIKE ${SEED_PREFIX + "%"}`;
  await sql`DELETE FROM "organizations" WHERE "slug" = ANY(${orgSlugs})`;
  console.log("[seed] --reset: removed previously seeded staging rows.");
}

async function seedOrganizations() {
  const bySlug = new Map();
  for (const org of ORGANIZATIONS) {
    const rows = await sql`
      INSERT INTO "organizations"
        ("slug", "name", "legalName", "industry", "size", "country", "operationalScore", "statusLabel")
      VALUES
        (${org.slug}, ${org.name}, ${org.legalName}, ${org.industry}, ${org.size},
         ${org.country}, ${org.operationalScore}, ${org.statusLabel})
      ON CONFLICT ("slug") DO UPDATE SET
        "name" = EXCLUDED."name",
        "legalName" = EXCLUDED."legalName",
        "industry" = EXCLUDED."industry",
        "size" = EXCLUDED."size",
        "country" = EXCLUDED."country"
      RETURNING "id", "slug"
    `;
    bySlug.set(rows[0].slug, rows[0].id);
    console.log(`[seed] organization ${org.slug} -> id ${rows[0].id}`);
  }
  return bySlug;
}

async function seedAccounts(orgIdBySlug) {
  const created = [];
  for (const acct of ACCOUNTS) {
    const hash = await bcrypt.hash(acct.password, 10);
    const organizationId = acct.org ? orgIdBySlug.get(acct.org) : null;

    const rows = await sql`
      INSERT INTO "users"
        ("openId", "email", "name", "role", "loginMethod", "passwordHash", "organizationId")
      VALUES
        (${acct.openId}, ${acct.email}, ${acct.name}, ${acct.role}::users_role,
         'local', ${hash}, ${organizationId})
      ON CONFLICT ("openId") DO UPDATE SET
        "email" = EXCLUDED."email",
        "name" = EXCLUDED."name",
        "role" = EXCLUDED."role",
        "loginMethod" = 'local',
        "passwordHash" = EXCLUDED."passwordHash",
        "organizationId" = EXCLUDED."organizationId",
        -- Clear any revocation cutoff so a re-seed always yields a usable
        -- account; otherwise a previous logout would leave the seeded user
        -- unable to authenticate with a freshly-minted session (RM-90).
        "sessionsRevokedAtMs" = NULL
      RETURNING "id", "email", "role"
    `;
    const user = rows[0];

    if (organizationId) {
      await sql`
        INSERT INTO "organization_memberships" ("organizationId", "userId", "membershipRole")
        VALUES (${organizationId}, ${user.id}, ${acct.membershipRole}::organization_memberships_role)
        ON CONFLICT DO NOTHING
      `;
    }

    created.push({ ...user, password: acct.password, org: acct.org ?? "—" });
    console.log(`[seed] user ${user.email} (${user.role}) -> id ${user.id}`);
  }
  return created;
}

async function main() {
  try {
    if (RESET) await reset();

    const orgIdBySlug = await seedOrganizations();
    const accounts = await seedAccounts(orgIdBySlug);

    console.log("\n=== Staging accounts ===\n");
    console.log(
      accounts
        .map((a) => `  ${a.role.padEnd(20)} ${a.email.padEnd(34)} ${a.password}`)
        .join("\n"),
    );
    console.log(
      "\nNOTE: admin, super_admin and technical_operator carry a hard blocking MFA\n" +
        "gate (Milestone 2 §2.5). First sign-in on those three requires enrolling an\n" +
        "authenticator app. Client and developer are not gated.\n",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
