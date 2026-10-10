/**
 * Payment synchronisation and payment reminders (SRS 16.3, 11.1, 16.7).
 *
 * The webhook is the primary path. This is the safety net: it asks Stripe about
 * sessions that are still pending locally, so a missed or failed webhook cannot
 * leave a customer who paid without their account or a paid invoice open. It
 * feeds a synthetic event through the same handler as the webhook, so every check
 * (amount, currency, idempotency) is the same.
 */
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { clientInvoices, scanPurchases } from "../drizzle/schema";
import { reminderEventFor } from "../shared/paymentRules";
import { getDb } from "./db/connection";
import { emitNotification } from "./notificationDispatcher";
import { processStripeEvent } from "./_core/stripeWebhookRoute";
import { isStripeConfigured } from "./_core/stripe";

type Session = { id: string; status?: string; payment_status?: string; amount_total?: number; currency?: string; metadata?: Record<string, string> };

async function fetchSession(id: string): Promise<Session | null> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    return res.ok ? ((await res.json()) as Session) : null;
  } catch {
    return null;
  }
}

export type SyncSummary = { checked: number; paid: number; expired: number; unchanged: number; failed: number };

export async function reconcileStripePayments(minAgeMs = 2 * 60_000): Promise<SyncSummary> {
  const summary: SyncSummary = { checked: 0, paid: 0, expired: 0, unchanged: 0, failed: 0 };
  if (!isStripeConfigured()) return summary;
  const db = await getDb();
  if (!db) return summary;
  const cutoff = new Date(Date.now() - minAgeMs);
  const invoices = await db
    .select({ id: clientInvoices.id, sessionId: clientInvoices.stripeSessionId })
    .from(clientInvoices)
    .where(and(isNotNull(clientInvoices.stripeSessionId), inArray(clientInvoices.status, ["open", "overdue"])))
    .limit(100);
  const purchases = await db
    .select({ id: scanPurchases.id, sessionId: scanPurchases.stripeSessionId })
    .from(scanPurchases)
    .where(and(isNotNull(scanPurchases.stripeSessionId), eq(scanPurchases.status, "pending"), lt(scanPurchases.createdAt, cutoff)))
    .limit(100);
  for (const row of [...invoices, ...purchases]) {
    if (!row.sessionId) continue;
    summary.checked++;
    const s = await fetchSession(row.sessionId);
    if (!s) {
      summary.failed++;
      continue;
    }
    const type = s.payment_status === "paid" ? "checkout.session.completed" : s.status === "expired" ? "checkout.session.expired" : null;
    if (!type) {
      summary.unchanged++;
      continue;
    }
    // A distinct id per session and type, so a later webhook for the same event is still handled once.
    const outcome = await processStripeEvent({ id: `reconcile_${s.id}_${type}`, type, data: { object: s as Record<string, any> } });
    if (outcome === "invoice_paid" || outcome === "scan_purchase_paid") summary.paid++;
    else if (outcome === "expired") summary.expired++;
    else summary.unchanged++;
  }
  return summary;
}

/** Raises the payment due reminders (PB-02 to PB-05). Each is raised once per invoice and stage. */
export async function runPaymentReminders(now = new Date()): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const open = await db
    .select({ id: clientInvoices.id, number: clientInvoices.number, organizationId: clientInvoices.organizationId, dueMs: clientInvoices.dueMs })
    .from(clientInvoices)
    .where(and(isNotNull(clientInvoices.dueMs), inArray(clientInvoices.status, ["open", "overdue"])))
    .limit(500);
  let raised = 0;
  for (const inv of open) {
    const event = reminderEventFor(inv.dueMs as number, now.getTime());
    if (!event) continue;
    const r = await emitNotification({
      event,
      audience: { type: "client", organizationId: inv.organizationId },
      dedupeRef: `invoice:${inv.id}:${event}`,
      title: `${inv.number}: ${event === "PAYMENT_OVERDUE" ? "payment is overdue" : "payment due soon"}`,
      href: "/client-portal/billing",
    });
    if (r.delivered) raised++;
  }
  return raised;
}
