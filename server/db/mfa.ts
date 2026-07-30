/**
 * server/db/mfa.ts
 *
 * Database helpers for Multi-Factor Authentication.
 * Covers: MFA factors, recovery codes, and MFA challenges.
 * All helpers follow the project convention: lazy getDb() + drizzle SQL.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  mfaChallenges as mfaChallengesTable,
  mfaFactors as mfaFactorsTable,
  mfaRecoveryCodes as mfaRecoveryCodesTable,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// MFA Factors
// ---------------------------------------------------------------------------

export async function listMfaFactorsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mfaFactorsTable)
    .where(eq(mfaFactorsTable.userId, userId))
    .orderBy(desc(mfaFactorsTable.primary), desc(mfaFactorsTable.createdAt));
}

export async function listVerifiedMfaFactorsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(mfaFactorsTable)
    .where(eq(mfaFactorsTable.userId, userId))
    .orderBy(desc(mfaFactorsTable.primary), desc(mfaFactorsTable.createdAt));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.filter((r: any) => r.verifiedAt !== null);
}

export async function getMfaFactorById(factorId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(mfaFactorsTable)
    .where(eq(mfaFactorsTable.id, factorId))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertMfaFactor(input: {
  userId: number;
  kind: "totp" | "sms";
  label?: string | null;
  secret: string;
  phoneHint?: string | null;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(mfaFactorsTable).values({
    userId: input.userId,
    kind: input.kind,
    label: input.label ?? null,
    secret: input.secret,
    phoneHint: input.phoneHint ?? null,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertId = (result as any)?.[0]?.insertId ?? (result as any)?.insertId;
  return Number(insertId ?? 0);
}

export async function markMfaFactorVerified(
  factorId: number,
  opts: { setPrimary?: boolean } = {},
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(mfaFactorsTable)
    .set({
      verifiedAt: new Date(),
      primary: opts.setPrimary ? 1 : 0,
      failedAttempts: 0,
      lockedUntilMs: null,
    })
    .where(eq(mfaFactorsTable.id, factorId));
}

export async function setPrimaryMfaFactor(userId: number, factorId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(mfaFactorsTable)
    .set({ primary: 0 })
    .where(eq(mfaFactorsTable.userId, userId));
  await db
    .update(mfaFactorsTable)
    .set({ primary: 1 })
    .where(
      and(
        eq(mfaFactorsTable.id, factorId),
        eq(mfaFactorsTable.userId, userId),
      ),
    );
}

export async function deleteMfaFactor(factorId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(mfaFactorsTable)
    .where(
      and(
        eq(mfaFactorsTable.id, factorId),
        eq(mfaFactorsTable.userId, userId),
      ),
    );
}

/**
 * Records a failed MFA attempt and locks the factor once the threshold is
 * crossed. Previously this took a pre-computed `lockUntilMs` from the
 * caller, derived from a `factor` row read earlier in the request (before
 * the code-verification step) — under concurrent failed attempts that
 * stale read could under-count, letting the lockout threshold be crossed
 * without the account actually locking. The counter is now incremented
 * atomically in SQL (so it can never lose an update to a concurrent
 * request), and the lock decision is read back immediately afterward
 * instead of relying on a caller-supplied, possibly-stale value.
 */
export async function bumpMfaFactorFailure(
  factorId: number,
  opts: { maxFailedAttempts: number; lockWindowMs: number },
) {
  const db = await getDb();
  if (!db) return null;
  await db
    .update(mfaFactorsTable)
    .set({ failedAttempts: sql`${mfaFactorsTable.failedAttempts} + 1` })
    .where(eq(mfaFactorsTable.id, factorId));
  const rows = await db
    .select()
    .from(mfaFactorsTable)
    .where(eq(mfaFactorsTable.id, factorId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const nextFailed = row.failedAttempts ?? 0;
  if (nextFailed >= opts.maxFailedAttempts) {
    await db
      .update(mfaFactorsTable)
      .set({ lockedUntilMs: Date.now() + opts.lockWindowMs })
      .where(eq(mfaFactorsTable.id, factorId));
  }
  return nextFailed;
}

export async function clearMfaFactorFailure(factorId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(mfaFactorsTable)
    .set({ failedAttempts: 0, lockedUntilMs: null, lastUsedAt: new Date() })
    .where(eq(mfaFactorsTable.id, factorId));
}

// ---------------------------------------------------------------------------
// Recovery Codes
// ---------------------------------------------------------------------------

export async function replaceMfaRecoveryCodes(
  userId: number,
  hashes: string[],
) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(mfaRecoveryCodesTable)
    .where(eq(mfaRecoveryCodesTable.userId, userId));
  if (hashes.length === 0) return;
  await db
    .insert(mfaRecoveryCodesTable)
    .values(hashes.map((h) => ({ userId, codeHash: h })));
}

export async function listUnusedRecoveryCodesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Filter unused in SQL rather than relying on every caller to remember to
  // filter `usedAt === null` client-side after the fact.
  return db
    .select()
    .from(mfaRecoveryCodesTable)
    .where(
      and(
        eq(mfaRecoveryCodesTable.userId, userId),
        isNull(mfaRecoveryCodesTable.usedAt),
      ),
    );
}

export async function markRecoveryCodeUsed(codeId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(mfaRecoveryCodesTable)
    .set({ usedAt: new Date() })
    .where(eq(mfaRecoveryCodesTable.id, codeId));
}

// ---------------------------------------------------------------------------
// MFA Challenges
// ---------------------------------------------------------------------------

export async function insertMfaChallenge(input: {
  userId: number;
  state: string;
  purpose?: "login" | "enroll" | "step_up";
  expectedKind?: "totp" | "sms" | "any";
  factorId?: number | null;
  expiresAt: Date;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(mfaChallengesTable).values({
    userId: input.userId,
    state: input.state,
    purpose: input.purpose ?? "login",
    expectedKind: input.expectedKind ?? "any",
    factorId: input.factorId ?? null,
    expiresAt: input.expiresAt,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertId = (result as any)?.[0]?.insertId ?? (result as any)?.insertId;
  return Number(insertId ?? 0);
}

export async function getMfaChallengeByState(state: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(mfaChallengesTable)
    .where(eq(mfaChallengesTable.state, state))
    .limit(1);
  return rows[0] ?? null;
}

export async function consumeMfaChallenge(challengeId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(mfaChallengesTable)
    .set({ consumedAt: new Date() })
    .where(eq(mfaChallengesTable.id, challengeId));
}

export async function bumpMfaChallengeFailure(challengeId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(mfaChallengesTable)
    .where(eq(mfaChallengesTable.id, challengeId))
    .limit(1);
  const row = rows[0];
  if (!row) return 0;
  const next = (row.failedAttempts ?? 0) + 1;
  await db
    .update(mfaChallengesTable)
    .set({ failedAttempts: next })
    .where(eq(mfaChallengesTable.id, challengeId));
  return next;
}
