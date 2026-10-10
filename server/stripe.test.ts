import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  seen: new Set<string>(),
  invoice: { id: 9, number: "INV-9", organizationId: 5, amountCents: 125000, currency: "EUR", status: "open" } as any,
  paid: false,
  purchase: { id: 3, tier: "growth", email: "buyer@example.com", fullName: "Buyer One", company: "Buyer BV", amountCents: 49900, currency: "EUR", status: "pending", leadId: null, organizationId: null } as any,
  emitted: [] as any[],
  invites: 0,
}));

vi.mock("./db/payments", () => ({
  recordPaymentEvent: vi.fn(async (a: any) => {
    if (m.seen.has(a.providerEventId)) return false;
    m.seen.add(a.providerEventId);
    return true;
  }),
  getInvoiceForPayment: vi.fn(async () => m.invoice),
  markInvoicePaid: vi.fn(async () => {
    if (m.paid) return false;
    m.paid = true;
    return true;
  }),
  getScanPurchase: vi.fn(async () => m.purchase),
  markScanPurchasePaid: vi.fn(async () => {
    if (m.purchase.status === "paid") return false;
    m.purchase.status = "paid";
    return true;
  }),
  setScanPurchaseRefs: vi.fn(async () => undefined),
  expireScanPurchase: vi.fn(async () => undefined),
  uniqueOrgSlug: vi.fn(async () => "buyer-bv"),
}));
vi.mock("./db/crm", () => ({ createLead: vi.fn(async () => ({ id: 11 })) }));
vi.mock("./db/clientPortal", () => ({ createOrganization: vi.fn(async () => ({ id: 21 })) }));
vi.mock("./db/accounts", () => ({
  createInvitation: vi.fn(async () => {
    m.invites++;
    return { invitation: { id: 1 }, token: "tok" };
  }),
}));
vi.mock("./email", () => ({ dispatchSimpleEmail: vi.fn(async () => ({ ok: true })), escapeHtml: (s: string) => s }));
vi.mock("./notificationDispatcher", () => ({ emitNotification: vi.fn(async (a: any) => void m.emitted.push(a)) }));
vi.mock("./_core/stripe", async (orig) => ({ ...((await orig()) as object), fetchInvoiceLinks: vi.fn(async () => ({ hostedUrl: "https://stripe.example/inv", pdfUrl: null })) }));

import { verifyStripeSignature } from "./_core/stripe";
import { processStripeEvent } from "./_core/stripeWebhookRoute";

const ev = (id: string, type: string, object: Record<string, unknown>) => ({ id, type, data: { object } });
const invoiceSession = (over: Record<string, unknown> = {}) => ({ id: "cs_1", payment_status: "paid", amount_total: 125000, currency: "eur", metadata: { kind: "invoice", invoiceId: "9" }, ...over });

beforeEach(() => {
  m.seen.clear();
  m.paid = false;
  m.invoice.status = "open";
  m.purchase.status = "pending";
  m.emitted.length = 0;
  m.invites = 0;
});

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "evt_1" });
  const sign = (t: number, s = secret) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${body}`).digest("hex")}`;
  it("accepts a correct, fresh signature", () => {
    expect(verifyStripeSignature(body, sign(1000), secret, 1100)).toBe(true);
  });
  it("rejects a wrong secret, a changed body and a stale timestamp", () => {
    expect(verifyStripeSignature(body, sign(1000, "other"), secret, 1100)).toBe(false);
    expect(verifyStripeSignature(body + " ", sign(1000), secret, 1100)).toBe(false);
    expect(verifyStripeSignature(body, sign(1000), secret, 1000 + 301)).toBe(false);
    expect(verifyStripeSignature(body, undefined, secret, 1100)).toBe(false);
  });
});

describe("processStripeEvent: invoices", () => {
  it("marks an invoice paid once and notifies the client", async () => {
    expect(await processStripeEvent(ev("evt_a", "checkout.session.completed", invoiceSession()))).toBe("invoice_paid");
    expect(m.paid).toBe(true);
    expect(m.emitted.some((e) => e.event === "PAYMENT_COMPLETED" && e.audience.type === "client")).toBe(true);
  });
  it("ignores a redelivered event", async () => {
    await processStripeEvent(ev("evt_a", "checkout.session.completed", invoiceSession()));
    m.emitted.length = 0;
    const again = await processStripeEvent(ev("evt_b", "checkout.session.completed", invoiceSession()));
    expect(again).toBe("duplicate");
    expect(m.emitted).toHaveLength(0);
  });
  it("does not mark paid when the amount differs from the invoice", async () => {
    const r = await processStripeEvent(ev("evt_c", "checkout.session.completed", invoiceSession({ amount_total: 100 })));
    expect(r).toBe("amount_mismatch");
    expect(m.paid).toBe(false);
  });
  it("does not treat an unpaid completed session as payment", async () => {
    expect(await processStripeEvent(ev("evt_d", "checkout.session.completed", invoiceSession({ payment_status: "unpaid" })))).toBe("ignored");
    expect(m.paid).toBe(false);
  });
  it("records a failed asynchronous payment and tells the client", async () => {
    expect(await processStripeEvent(ev("evt_e", "checkout.session.async_payment_failed", invoiceSession()))).toBe("failed");
    expect(m.emitted.some((e) => e.event === "PAYMENT_FAILED")).toBe(true);
  });
  it("ignores events that are not for this platform", async () => {
    expect(await processStripeEvent(ev("evt_f", "charge.refunded", {}))).toBe("ignored");
    expect(await processStripeEvent(ev("evt_g", "checkout.session.completed", { payment_status: "paid", metadata: {} }))).toBe("ignored");
  });
});

describe("processStripeEvent: AI Scan purchase", () => {
  const session = (over: Record<string, unknown> = {}) => ({ id: "cs_2", payment_status: "paid", amount_total: 49900, currency: "eur", metadata: { kind: "scan_purchase", scanPurchaseId: "3" }, ...over });
  it("creates the account invitation only after verified payment", async () => {
    expect(await processStripeEvent(ev("evt_p1", "checkout.session.completed", session()))).toBe("scan_purchase_paid");
    expect(m.invites).toBe(1);
    expect(m.purchase.status).toBe("paid");
  });
  it("grants nothing on a wrong amount", async () => {
    expect(await processStripeEvent(ev("evt_p2", "checkout.session.completed", session({ amount_total: 1 })))).toBe("amount_mismatch");
    expect(m.invites).toBe(0);
  });
  it("does not invite twice for a redelivery", async () => {
    await processStripeEvent(ev("evt_p3", "checkout.session.completed", session()));
    const r = await processStripeEvent(ev("evt_p4", "checkout.session.completed", session()));
    expect(r).toBe("duplicate");
    expect(m.invites).toBe(1);
  });
});
