/**
 * Payment persistence (SRS 16.7, 10.3, 10.4).
 *
 * payment_events is append only and unique on the provider event id, so a
 * webhook Stripe delivers twice is recorded once and acted on once.
 */
import { and, eq, ne } from "drizzle-orm";
import { clientInvoices, organizations, paymentEvents, scanPurchases, type ScanPurchaseRow } from "../../drizzle/schema";
import { getDb } from "./connection";

/** True when this event id is new (and is now recorded); false when it was already seen. */
export async function recordPaymentEvent(args: {
  providerEventId: string;
  type: string;
  invoiceId?: number | null;
  organizationId?: number | null;
  scanPurchaseId?: number | null;
  amountCents?: number | null;
  currency?: string | null;
  outcome: string;
  detail?: string | null;
}): Promise<boolean | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .insert(paymentEvents)
    .values({
      providerEventId: args.providerEventId,
      type: args.type,
      invoiceId: args.invoiceId ?? null,
      organizationId: args.organizationId ?? null,
      scanPurchaseId: args.scanPurchaseId ?? null,
      amountCents: args.amountCents ?? null,
      currency: args.currency ?? null,
      outcome: args.outcome,
      detail: args.detail ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });
  return rows.length > 0;
}

export async function setInvoiceCheckoutSession(invoiceId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(clientInvoices).set({ stripeSessionId: sessionId }).where(eq(clientInvoices.id, invoiceId));
}

export async function getInvoiceForPayment(invoiceId: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(clientInvoices).where(eq(clientInvoices.id, invoiceId)).limit(1))[0] ?? null;
}

/** Marks an invoice paid exactly once. Returns false if it was already paid or void. */
export async function markInvoicePaid(invoiceId: number, invoiceUrl: string | null): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .update(clientInvoices)
    .set({ status: "paid", paidMs: Date.now(), stripeInvoiceUrl: invoiceUrl })
    .where(and(eq(clientInvoices.id, invoiceId), ne(clientInvoices.status, "paid"), ne(clientInvoices.status, "void")))
    .returning({ id: clientInvoices.id });
  return rows.length > 0;
}

export async function createScanPurchase(args: { tier: string; email: string; fullName: string; company: string | null; locale: string; amountCents: number; currency: string }): Promise<ScanPurchaseRow | null> {
  const db = await getDb();
  if (!db) return null;
  return (await db.insert(scanPurchases).values(args).returning())[0] ?? null;
}

export async function attachScanPurchaseSession(id: number, sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(scanPurchases).set({ stripeSessionId: sessionId }).where(eq(scanPurchases.id, id));
}

export async function getScanPurchase(id: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(scanPurchases).where(eq(scanPurchases.id, id)).limit(1))[0] ?? null;
}

/** pending -> paid exactly once. */
export async function markScanPurchasePaid(id: number, args: { leadId: number | null; organizationId: number | null }): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .update(scanPurchases)
    .set({ status: "paid", paidAt: new Date(), leadId: args.leadId, organizationId: args.organizationId })
    .where(and(eq(scanPurchases.id, id), eq(scanPurchases.status, "pending")))
    .returning({ id: scanPurchases.id });
  return rows.length > 0;
}

export async function setScanPurchaseRefs(id: number, refs: { leadId: number | null; organizationId: number | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(scanPurchases).set(refs).where(eq(scanPurchases.id, id));
}

export async function expireScanPurchase(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(scanPurchases).set({ status: "expired" }).where(and(eq(scanPurchases.id, id), eq(scanPurchases.status, "pending")));
}

export async function uniqueOrgSlug(base: string): Promise<string> {
  const db = await getDb();
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "customer";
  if (!db) return clean;
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? clean : `${clean}-${i + 1}`;
    const hit = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).limit(1);
    if (hit.length === 0) return slug;
  }
  return `${clean}-${Date.now()}`;
}
