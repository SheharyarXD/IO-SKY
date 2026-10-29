/**
 * server/db/emailOutbox.ts (task N03). Persistent retry queue for failed emails.
 *
 * Everything here is best effort around the send it is recording: a missing
 * table (migration 0037 not applied yet), no database, or a query error is
 * logged once and swallowed, so retry bookkeeping can never break a send or
 * crash the worker.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { emailOutbox, platformSettings, type EmailOutbox, type InsertEmailOutbox } from "../../drizzle/schema";
import { DEFAULT_RETRY_POLICY, policyFromSettings, RETRY_SETTING_KEYS, type RetryPolicy } from "../../shared/emailRetryPolicy";
import { getDb } from "./connection";

let warned = false;
function warnOnce(where: string, err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(`[emailOutbox] ${where} failed (is migration 0037_email_outbox.sql applied?):`, err instanceof Error ? err.message : err);
}

/** The configured retry policy, or the default when settings are absent or unreadable. */
export async function readEmailRetryPolicy(): Promise<RetryPolicy> {
  try {
    const db = await getDb();
    if (!db) return DEFAULT_RETRY_POLICY;
    const rows = await db
      .select({ key: platformSettings.key, value: platformSettings.value })
      .from(platformSettings)
      .where(inArray(platformSettings.key, Object.values(RETRY_SETTING_KEYS)));
    return policyFromSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  } catch {
    return DEFAULT_RETRY_POLICY;
  }
}

/** Record a failed message. Returns the row id, or null when it could not be recorded. */
export async function insertEmailOutbox(row: InsertEmailOutbox): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.insert(emailOutbox).values(row).returning({ id: emailOutbox.id });
    return rows[0]?.id ?? null;
  } catch (err) {
    warnOnce("insert", err);
    return null;
  }
}

/**
 * Claim up to `limit` rows that are due. A row is due when it is queued and its
 * time has come, or when a previous worker took it and its lease ran out (the
 * worker died). The claim is one statement with SKIP LOCKED, so two instances
 * never take the same row, and the lease keeps a slow send from being taken twice.
 */
export async function claimDueEmailOutbox(now: Date, limit: number, leaseMs: number): Promise<EmailOutbox[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const lease = new Date(now.getTime() + leaseMs);
    const claimed = (await db.execute(sql`
      UPDATE "email_outbox"
      SET "status" = 'processing', "lockedUntil" = ${lease.toISOString()}::timestamp, "updatedAt" = now()
      WHERE "id" IN (
        SELECT "id" FROM "email_outbox"
        WHERE ("status" = 'queued' AND "nextAttemptAt" <= ${now.toISOString()}::timestamp)
           OR ("status" = 'processing' AND "lockedUntil" < ${now.toISOString()}::timestamp)
        ORDER BY "nextAttemptAt" NULLS FIRST, "id"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"
    `)) as unknown as Array<{ id: number }>;
    const ids = claimed.map((r) => Number(r.id));
    if (ids.length === 0) return [];
    return await db.select().from(emailOutbox).where(inArray(emailOutbox.id, ids)).orderBy(emailOutbox.id);
  } catch (err) {
    warnOnce("claim", err);
    return [];
  }
}

async function update(id: number, set: Partial<InsertEmailOutbox>): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.update(emailOutbox).set({ ...set, updatedAt: new Date() }).where(eq(emailOutbox.id, id));
  } catch (err) {
    warnOnce("update", err);
  }
}

/** Delivered on a retry: final. The message content is no longer needed. */
export function markOutboxSent(id: number, attempts: number) {
  return update(id, { status: "sent", attempts, payload: null, nextAttemptAt: null, lockedUntil: null, lastError: null, lastErrorClass: null });
}

export function markOutboxRetry(id: number, a: { attempts: number; nextAttemptAt: Date; error: string; errorClass: string }) {
  return update(id, { status: "queued", attempts: a.attempts, nextAttemptAt: a.nextAttemptAt, lockedUntil: null, lastError: a.error.slice(0, 1000), lastErrorClass: a.errorClass });
}

/** Final failure: kept as a record, but the message content is cleared. */
export function markOutboxAbandoned(id: number, a: { attempts: number; error: string; errorClass: string; reason: "permanent" | "exhausted" }) {
  return update(id, { status: "abandoned", attempts: a.attempts, payload: null, nextAttemptAt: null, lockedUntil: null, lastError: a.error.slice(0, 1000), lastErrorClass: a.errorClass, abandonReason: a.reason });
}

export function markOutboxEscalated(id: number) {
  return update(id, { escalatedAt: new Date() });
}

/** Recent rows for the admin view. The message content is never returned. */
export async function listEmailOutbox(limit = 100) {
  try {
    const db = await getDb();
    if (!db) return [];
    return await db
      .select({
        id: emailOutbox.id,
        kind: emailOutbox.kind,
        messageType: emailOutbox.messageType,
        recipient: emailOutbox.recipient,
        subject: emailOutbox.subject,
        relatedRef: emailOutbox.relatedRef,
        status: emailOutbox.status,
        attempts: emailOutbox.attempts,
        maxAttempts: emailOutbox.maxAttempts,
        nextAttemptAt: emailOutbox.nextAttemptAt,
        lastError: emailOutbox.lastError,
        lastErrorClass: emailOutbox.lastErrorClass,
        abandonReason: emailOutbox.abandonReason,
        escalatedAt: emailOutbox.escalatedAt,
        createdAt: emailOutbox.createdAt,
      })
      .from(emailOutbox)
      .where(and(inArray(emailOutbox.status, ["queued", "processing", "abandoned"])))
      .orderBy(desc(emailOutbox.createdAt))
      .limit(limit);
  } catch (err) {
    warnOnce("list", err);
    return [];
  }
}
