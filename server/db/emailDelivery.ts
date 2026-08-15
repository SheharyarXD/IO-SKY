/**
 * server/db/emailDelivery.ts — Milestone 2 §2.3 email delivery tracking.
 *
 * One row per send attempt (server/email.ts's sendBookingConfirmation /
 * dispatchSimpleEmail insert here right after every send), updated in
 * place as Resend webhook events arrive
 * (server/_core/resendWebhookRoute.ts). Same getDb()-may-be-null,
 * best-effort-log pattern as server/db/auth.ts's appendLoginAudit — a
 * logging failure must never break the actual email send it's recording.
 */
import { desc, eq, inArray } from "drizzle-orm";
import {
  emailDeliveryLog,
  type EmailDeliveryLog,
  type InsertEmailDeliveryLog,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export async function insertEmailDeliveryLog(
  input: InsertEmailDeliveryLog,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(emailDeliveryLog).values(input);
  } catch (error) {
    console.error("[Database] Failed to append email delivery log:", error);
  }
}

/**
 * Applies a Resend webhook event to the matching log row. Returns the
 * number of rows updated (0 means no row had that providerMessageId yet —
 * e.g. the webhook raced ahead of the insert, or arrived for an id this
 * app never sent — logged by the caller, not treated as a hard error).
 */
export async function updateEmailDeliveryStatusByProviderMessageId(
  providerMessageId: string,
  status: EmailDeliveryLog["status"],
  providerResponse: string | null,
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .update(emailDeliveryLog)
    .set({ status, providerResponse, updatedAt: new Date() })
    .where(eq(emailDeliveryLog.providerMessageId, providerMessageId))
    .returning({ id: emailDeliveryLog.id });
  return result.length;
}

export async function listEmailDeliveryLog(
  limit = 100,
): Promise<EmailDeliveryLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(emailDeliveryLog)
    .orderBy(desc(emailDeliveryLog.createdAt))
    .limit(limit);
}

/** "Make failures visible" — bounced/complained/failed rows, newest first. */
export async function listFailedEmailDeliveries(
  limit = 100,
): Promise<EmailDeliveryLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(emailDeliveryLog)
    .where(inArray(emailDeliveryLog.status, ["bounced", "complained", "failed"]))
    .orderBy(desc(emailDeliveryLog.createdAt))
    .limit(limit);
}
