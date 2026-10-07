/**
 * Delivery report, step 1: demo accounts.
 *
 * Creates three clearly labelled demo accounts (super admin with a real TOTP
 * factor, client, developer) and the demo organization, so the report's
 * screenshots come from genuine logins rather than forged sessions.
 *
 * Passwords are random per run and are written only to the scratch file named
 * by EVIDENCE_CREDS, never to the repo. Run `retire-accounts.ts` afterwards.
 *
 *   JWT_SECRET=<production secret> EVIDENCE_CREDS=<path> npx tsx scripts/delivery-report/seed-accounts.ts
 *
 * JWT_SECRET must be production's: the MFA secret is encrypted with a key
 * derived from it, and production has to be able to decrypt it.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { generateSecret } from "otplib";
import {
  developerAccessScopes,
  developerAgreements,
  developerProfiles,
  organizations,
  users,
} from "../../drizzle/schema";
import { getDb } from "../../server/db/connection";
import { envelopeEncrypt } from "../../server/_core/mfaCrypto";
import { insertMfaFactor, markMfaFactorVerified } from "../../server/db/mfa";

const credsPath = process.env.EVIDENCE_CREDS;
if (!credsPath) throw new Error("Set EVIDENCE_CREDS to the scratch file that will hold the demo credentials.");
if (!process.env.JWT_SECRET) throw new Error("Set JWT_SECRET to the production secret.");

const db = (await getDb())!;
const pw = () => randomBytes(15).toString("base64url") + "a1";

async function upsertUser(email: string, name: string, role: "super_admin" | "client" | "developer", organizationId: number | null) {
  const password = pw();
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (existing) {
    await db.update(users).set({ passwordHash, role, organizationId, name }).where(eq(users.id, existing.id));
    return { id: existing.id, email, password };
  }
  const row = (
    await db
      .insert(users)
      .values({ openId: `demo:${randomBytes(8).toString("hex")}`, email, name, role, organizationId, loginMethod: "local", passwordHash })
      .returning()
  )[0]!;
  return { id: row.id, email, password };
}

// Organization
let org = (await db.select().from(organizations).where(eq(organizations.slug, "demo-meridian-logistics")).limit(1))[0];
if (!org) {
  org = (
    await db
      .insert(organizations)
      .values({ slug: "demo-meridian-logistics", name: "DEMO Meridian Logistics", legalName: "DEMO Meridian Logistics B.V.", industry: "Logistics", size: "51-200", country: "Netherlands" })
      .returning()
  )[0]!;
}

const admin = await upsertUser("evidence.admin@demo.invalid", "Evidence Admin (demo)", "super_admin", null);
const client = await upsertUser("evidence.client@demo.invalid", "Evidence Client (demo)", "client", org.id);
const dev = await upsertUser("evidence.developer@demo.invalid", "Evidence Developer (demo)", "developer", null);

// Admin MFA: a real TOTP factor whose secret is known only to this run.
const totpSecret = generateSecret();
const factorId = await insertMfaFactor({ userId: admin.id, kind: "totp", label: "Evidence authenticator", secret: envelopeEncrypt(totpSecret) });
await markMfaFactorVerified(factorId);
await db.update(users).set({ mfaMethod: "totp" }).where(eq(users.id, admin.id));

// Developer profile, baseline access scope and the five required agreements.
let profile = (await db.select().from(developerProfiles).where(eq(developerProfiles.userId, dev.id)).limit(1))[0];
if (!profile) {
  profile = (
    await db
      .insert(developerProfiles)
      .values({ userId: dev.id, fullName: "Evidence Developer (demo)", country: "Netherlands", specialties: "Full-stack", yearsExperience: 8, status: "active", mfaRequired: 0, approvedMs: Date.now(), approvedByUserId: admin.id })
      .returning()
  )[0]!;
  await db.insert(developerAccessScopes).values({ developerId: profile.id, level: "baseline", startMs: Date.now(), expiresMs: Date.now() + 90 * 86_400_000, status: "active", createdByUserId: admin.id });
  for (const type of ["nda", "confidentiality", "non-solicitation", "liability", "security-policy"]) {
    await db.insert(developerAgreements).values({ developerId: profile.id, agreementType: type, version: "v1", status: "signed", signedMs: Date.now(), signedIp: "127.0.0.1" });
  }
}

fs.writeFileSync(
  credsPath,
  JSON.stringify({ orgId: org.id, devProfileId: profile.id, admin: { ...admin, totpSecret }, client, developer: dev }, null, 2),
);
console.log("demo accounts ready:", { orgId: org.id, adminId: admin.id, clientId: client.id, developerId: dev.id, devProfileId: profile.id });
process.exit(0);
