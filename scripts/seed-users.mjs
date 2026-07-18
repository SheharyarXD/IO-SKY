#!/usr/bin/env node
/**
 * IO SKY — Seed users + demo organization for local-password login.
 *
 * Usage:
 *   node scripts/seed-users.mjs
 *
 * Creates (or upserts) three accounts using bcrypt-hashed passwords:
 *
 *   admin@iosky.local       /  IOSky-Admin-2026!     (role=admin)
 *   client@iosky.local      /  IOSky-Client-2026!    (role=client)
 *   developer@iosky.local   /  IOSky-Developer-2026! (role=developer)
 *
 * In addition, this script bootstraps a single demo organization
 * ("iosky-demo") and links the test client to it with an `owner`
 * membership row. Without that link, every clientProcedure tRPC call
 * throws "No organization is linked to this account." and the client
 * portal renders an error.
 *
 * The script is idempotent — re-running updates existing rows in place
 * instead of inserting duplicates. Safe to run on every fresh database.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const ACCOUNTS = [
  {
    openId: "local-admin-iosky",
    email: "admin@iosky.local",
    name: "IO SKY Super Admin",
    role: "admin",
    password: "IOSky-Admin-2026!",
    loginMethod: "local",
  },
  {
    openId: "local-client-iosky",
    email: "client@iosky.local",
    name: "IO SKY Test Client",
    role: "client",
    password: "IOSky-Client-2026!",
    loginMethod: "local",
  },
  {
    openId: "local-developer-iosky",
    email: "developer@iosky.local",
    name: "IO SKY Test Developer",
    role: "developer",
    password: "IOSky-Developer-2026!",
    loginMethod: "local",
  },
];

const DEMO_ORG = {
  slug: "iosky-demo",
  name: "IO SKY Demo Organization",
  legalName: "IO SKY Demo Organization",
  industry: "Professional Services",
  size: "11–50",
  country: "Netherlands",
  operationalScore: 78,
  statusLabel: "Healthy",
};

async function upsertUser(conn, acc) {
  const hash = bcrypt.hashSync(acc.password, 12);
  const [existing] = await conn.execute(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [acc.email],
  );
  if (Array.isArray(existing) && existing.length > 0) {
    await conn.execute(
      "UPDATE users SET passwordHash = ?, role = ?, name = ?, loginMethod = ?, lastSignedIn = NOW() WHERE email = ?",
      [hash, acc.role, acc.name, acc.loginMethod, acc.email],
    );
    console.log(`  • updated   ${acc.email} (role=${acc.role})`);
    return existing[0].id;
  }
  const [res] = await conn.execute(
    "INSERT INTO users (openId, email, name, role, loginMethod, passwordHash, mfaMethod, createdAt, updatedAt, lastSignedIn) VALUES (?,?,?,?,?,?, 'none', NOW(), NOW(), NOW())",
    [acc.openId, acc.email, acc.name, acc.role, acc.loginMethod, hash],
  );
  console.log(`  • inserted  ${acc.email} (role=${acc.role})`);
  return res.insertId;
}

async function upsertDemoOrganization(conn) {
  const [existing] = await conn.execute(
    "SELECT id FROM organizations WHERE slug = ? LIMIT 1",
    [DEMO_ORG.slug],
  );
  if (Array.isArray(existing) && existing.length > 0) {
    const orgId = existing[0].id;
    await conn.execute(
      `UPDATE organizations
         SET name = ?, legalName = ?, industry = ?, size = ?, country = ?,
             operationalScore = ?, statusLabel = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        DEMO_ORG.name,
        DEMO_ORG.legalName,
        DEMO_ORG.industry,
        DEMO_ORG.size,
        DEMO_ORG.country,
        DEMO_ORG.operationalScore,
        DEMO_ORG.statusLabel,
        orgId,
      ],
    );
    console.log(`  • updated   organization #${orgId} (${DEMO_ORG.slug})`);
    return orgId;
  }
  const [res] = await conn.execute(
    `INSERT INTO organizations
       (slug, name, legalName, industry, size, country,
        operationalScore, accentHex, statusLabel, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NOW(), NOW())`,
    [
      DEMO_ORG.slug,
      DEMO_ORG.name,
      DEMO_ORG.legalName,
      DEMO_ORG.industry,
      DEMO_ORG.size,
      DEMO_ORG.country,
      DEMO_ORG.operationalScore,
      DEMO_ORG.statusLabel,
    ],
  );
  console.log(`  • inserted  organization #${res.insertId} (${DEMO_ORG.slug})`);
  return res.insertId;
}

async function linkClientToOrganization(conn, clientUserId, orgId) {
  const [rows] = await conn.execute(
    "SELECT organizationId FROM users WHERE id = ? LIMIT 1",
    [clientUserId],
  );
  const currentOrgId = Array.isArray(rows) && rows[0] ? rows[0].organizationId : null;
  if (currentOrgId !== orgId) {
    await conn.execute(
      "UPDATE users SET organizationId = ?, updatedAt = NOW() WHERE id = ?",
      [orgId, clientUserId],
    );
    console.log(`  • linked    client (user #${clientUserId}) → org #${orgId}`);
  } else {
    console.log(`  • already   client linked to org #${orgId}`);
  }

  const [existingMem] = await conn.execute(
    "SELECT id FROM organization_memberships WHERE organizationId = ? AND userId = ? LIMIT 1",
    [orgId, clientUserId],
  );
  if (!Array.isArray(existingMem) || existingMem.length === 0) {
    await conn.execute(
      `INSERT INTO organization_memberships
         (organizationId, userId, membershipRole, createdAt)
       VALUES (?, ?, 'owner', NOW())`,
      [orgId, clientUserId],
    );
    console.log(`  • inserted  membership row (user #${clientUserId} → org #${orgId}, owner)`);
  } else {
    console.log(`  • membership row already present`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to database. Seeding users + demo organization…\n");

  // 1. Upsert all three local accounts
  const userIds = {};
  for (const acc of ACCOUNTS) {
    userIds[acc.email] = await upsertUser(conn, acc);
  }

  // 2. Bootstrap demo organization
  const orgId = await upsertDemoOrganization(conn);

  // 3. Link the test client to the demo organization
  const clientUserId = userIds["client@iosky.local"];
  if (clientUserId) {
    await linkClientToOrganization(conn, clientUserId, orgId);
  }

  await conn.end();
  console.log("\nSeeding complete. Login URL → /login");
  console.log("Use these credentials:");
  for (const acc of ACCOUNTS) {
    console.log(`  ${acc.email}  /  ${acc.password}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
