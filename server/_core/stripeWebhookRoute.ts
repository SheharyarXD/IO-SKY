/**
 * Stripe webhook (SRS 16.7, 10.4).
 *
 * Payment is only ever believed from a verified webhook. Verification needs the
 * exact raw bytes, which server/_core/index.ts stashes on req.rawBody.
 * Each event id is recorded once, so a redelivery changes nothing.
 */
import type { Express, Request, Response } from "express";
import { fetchInvoiceLinks, verifyStripeSignature } from "./stripe";
import {
  expireScanPurchase,
  getInvoiceForPayment,
  getScanPurchase,
  markInvoicePaid,
  markScanPurchasePaid,
  recordPaymentEvent,
  setScanPurchaseRefs,
  uniqueOrgSlug,
} from "../db/payments";
import { createLead } from "../db/crm";
import { createOrganization } from "../db/clientPortal";
import { createInvitation } from "../db/accounts";
import { dispatchSimpleEmail, escapeHtml } from "../email";
import { emitNotification } from "../notificationDispatcher";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, any> };
};

export type StripeOutcome = "invoice_paid" | "scan_purchase_paid" | "failed" | "expired" | "amount_mismatch" | "duplicate" | "ignored" | "not_found";

export async function processStripeEvent(event: StripeEvent): Promise<StripeOutcome> {
  const obj = event.data.object;
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const kind = meta.kind;
  const sessionId = typeof obj.id === "string" ? obj.id : null;
  const paid = event.type === "checkout.session.completed" ? obj.payment_status === "paid" : event.type === "checkout.session.async_payment_succeeded";
  const failed = event.type === "checkout.session.async_payment_failed";
  const expired = event.type === "checkout.session.expired";
  if (!paid && !failed && !expired) return "ignored";
  if (kind !== "invoice" && kind !== "scan_purchase") return "ignored";

  const amount = typeof obj.amount_total === "number" ? obj.amount_total : null;
  const currency = typeof obj.currency === "string" ? obj.currency.toUpperCase() : null;

  if (kind === "invoice") {
    const invoiceId = Number(meta.invoiceId);
    const invoice = Number.isInteger(invoiceId) ? await getInvoiceForPayment(invoiceId) : null;
    if (!invoice) {
      await recordPaymentEvent({ providerEventId: event.id, type: event.type, outcome: "not_found", detail: `invoice ${meta.invoiceId}` });
      return "not_found";
    }
    if (paid && (amount !== invoice.amountCents || (currency && currency !== invoice.currency.toUpperCase()))) {
      const first = await recordPaymentEvent({ providerEventId: event.id, type: event.type, invoiceId, organizationId: invoice.organizationId, amountCents: amount, currency, outcome: "amount_mismatch", detail: `expected ${invoice.amountCents} ${invoice.currency}` });
      if (first) await emitNotification({ event: "PAYMENT_FAILED", audience: { type: "admin" }, dedupeRef: `invoice:${invoiceId}:mismatch:${event.id}`, title: `Payment amount mismatch on ${invoice.number}`, body: `Stripe reported ${amount} ${currency}, the invoice is ${invoice.amountCents} ${invoice.currency}. It was not marked paid.`, href: "/admin/billing" });
      return "amount_mismatch";
    }
    if (paid) {
      // State first, event record second: a crash between the two is retried by Stripe and
      // markInvoicePaid only changes an invoice that is not already paid.
      const links = sessionId ? await fetchInvoiceLinks(sessionId) : { hostedUrl: null, pdfUrl: null };
      const changed = await markInvoicePaid(invoiceId, links.hostedUrl);
      await recordPaymentEvent({ providerEventId: event.id, type: event.type, invoiceId, organizationId: invoice.organizationId, amountCents: amount, currency, outcome: "paid" });
      if (changed) {
        await emitNotification({ event: "PAYMENT_COMPLETED", audience: { type: "client", organizationId: invoice.organizationId }, dedupeRef: `invoice:${invoiceId}:paid`, title: `Payment received for ${invoice.number}`, href: "/client-portal/billing" });
        await emitNotification({ event: "PAYMENT_COMPLETED", audience: { type: "admin" }, dedupeRef: `invoice:${invoiceId}:paid:admin`, title: `Invoice ${invoice.number} paid`, href: "/admin/billing" });
      }
      return changed ? "invoice_paid" : "duplicate";
    }
    const first = await recordPaymentEvent({ providerEventId: event.id, type: event.type, invoiceId, organizationId: invoice.organizationId, amountCents: amount, currency, outcome: failed ? "failed" : "expired" });
    if (first === false) return "duplicate";
    if (failed) {
      await emitNotification({ event: "PAYMENT_FAILED", audience: { type: "client", organizationId: invoice.organizationId }, dedupeRef: `invoice:${invoiceId}:failed:${event.id}`, title: `Payment failed for ${invoice.number}`, href: "/client-portal/billing" });
    }
    return failed ? "failed" : "expired";
  }

  // AI Scan purchase
  const purchaseId = Number(meta.scanPurchaseId);
  const purchase = Number.isInteger(purchaseId) ? await getScanPurchase(purchaseId) : null;
  if (!purchase) {
    await recordPaymentEvent({ providerEventId: event.id, type: event.type, outcome: "not_found", detail: `purchase ${meta.scanPurchaseId}` });
    return "not_found";
  }
  if (paid && (amount !== purchase.amountCents || (currency && currency !== purchase.currency.toUpperCase()))) {
    await recordPaymentEvent({ providerEventId: event.id, type: event.type, scanPurchaseId: purchaseId, amountCents: amount, currency, outcome: "amount_mismatch", detail: `expected ${purchase.amountCents} ${purchase.currency}` });
    return "amount_mismatch";
  }
  if (expired || failed) {
    const first = await recordPaymentEvent({ providerEventId: event.id, type: event.type, scanPurchaseId: purchaseId, amountCents: amount, currency, outcome: failed ? "failed" : "expired" });
    if (first === false) return "duplicate";
    await expireScanPurchase(purchaseId);
    return expired ? "expired" : "failed";
  }
  if (purchase.status === "paid") return "duplicate";

  // Paid. Each step persists its result before the next, so a retry resumes rather than repeats.
  let leadId = purchase.leadId;
  let organizationId = purchase.organizationId;
  if (!leadId) {
    const lead = await createLead({
      source: "ai-scan",
      sourceId: null,
      fullName: purchase.fullName,
      email: purchase.email,
      company: purchase.company ?? purchase.fullName,
      phone: null,
      interest: `ai-scan:${purchase.tier}:paid`,
      note: `AI Scan purchase (${purchase.tier}), payment verified by Stripe`,
      status: "new",
      utmSource: null,
      utmCampaign: null,
      ip: null,
      userAgent: null,
    });
    leadId = lead?.id ?? null;
  }
  if (!organizationId) {
    const org = await createOrganization({ slug: await uniqueOrgSlug(purchase.company ?? purchase.fullName), name: purchase.company ?? purchase.fullName });
    organizationId = org?.id ?? null;
    if (organizationId || leadId) await setScanPurchaseRefs(purchaseId, { leadId, organizationId });
  }
  const invite = await createInvitation({ email: purchase.email, role: "client", organizationId, invitedByUserId: null });
  if (invite && invite !== "user_exists") {
    const base = process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || "https://iosky.com";
    const link = `${base}/activate?token=${invite.token}`;
    await dispatchSimpleEmail({
      to: purchase.email,
      subject: "Your IO SKY AI Scan: activate your account",
      html: `<p>Thank you, ${escapeHtml(purchase.fullName)}. Your payment for the ${escapeHtml(purchase.tier)} AI Scan was received.</p><p><a href="${link}">Activate your account</a> to continue with your assessment.</p><p>This link works once and expires in 7 days.</p>`,
      text: `Thank you, ${purchase.fullName}. Your payment for the ${purchase.tier} AI Scan was received.

Activate your account: ${link}

This link works once and expires in 7 days.`,
      refHeader: `scan-purchase:${purchaseId}`,
      messageType: "notification",
      relatedRef: `scan-purchase:${purchaseId}`,
    }).catch(() => undefined);
  }
  const changed = await markScanPurchasePaid(purchaseId, { leadId, organizationId });
  await recordPaymentEvent({ providerEventId: event.id, type: event.type, scanPurchaseId: purchaseId, amountCents: amount, currency, outcome: "paid" });
  if (!changed) return "duplicate";
  await emitNotification({ event: "AI_SCAN_CREATED", audience: { type: "admin" }, dedupeRef: `scan-purchase:${purchaseId}`, title: `AI Scan purchased (${purchase.tier})`, body: `${purchase.fullName}, ${purchase.email}. Payment verified.`, href: "/admin/crm" });
  return "scan_purchase_paid";
}

export function registerStripeWebhookRoutes(app: Express) {
  app.post("/api/webhooks/stripe", async (req: Request & { rawBody?: Buffer }, res: Response) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      res.status(500).json({ ok: false, error: "Webhook not configured" });
      return;
    }
    const raw = req.rawBody;
    if (!raw || !verifyStripeSignature(raw, req.header("stripe-signature") ?? undefined, secret)) {
      res.status(400).json({ ok: false, error: "Invalid signature" });
      return;
    }
    try {
      const outcome = await processStripeEvent(req.body as StripeEvent);
      res.status(200).json({ ok: true, outcome });
    } catch (e) {
      console.error("[StripeWebhook] processing failed:", e instanceof Error ? e.message : e);
      // 500 so Stripe retries; the event id guard makes the retry safe.
      res.status(500).json({ ok: false });
    }
  });
}
