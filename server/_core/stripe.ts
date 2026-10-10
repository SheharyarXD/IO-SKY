/**
 * Stripe (SRS 16.7 payment management, 10.3 payments).
 *
 * A thin REST client over fetch, so no SDK dependency is added. Stripe creates
 * the invoice and its PDF and handles tax; this platform creates the Checkout
 * Session and trusts only a verified webhook as proof of payment.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";
const TOLERANCE_SEC = 300;

export function isStripeConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

function form(obj: Record<string, string | number | boolean | null | undefined>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) p.append(k, String(v));
  return p;
}

export type CheckoutInput = {
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
  /** Echoed back on the webhook; the only link between a payment and our records. */
  metadata: Record<string, string>;
  idempotencyKey: string;
  /** Stripe Tax calculation. Needs Stripe Tax enabled on the account, so it is opt in. */
  automaticTax?: boolean;
};

export async function createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string }> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY).");
  const body = form({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.customerEmail,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": input.amountCents,
    "line_items[0][price_data][product_data][name]": input.description.slice(0, 250),
    // Stripe generates the invoice and its PDF, with the customer details and tax ID collected here.
    "invoice_creation[enabled]": true,
    "billing_address_collection": "required",
    "tax_id_collection[enabled]": true,
    "automatic_tax[enabled]": input.automaticTax === true,
    ...Object.fromEntries(Object.entries(input.metadata).map(([k, v]) => [`metadata[${k}]`, v])),
    ...Object.fromEntries(Object.entries(input.metadata).map(([k, v]) => [`payment_intent_data[metadata][${k}]`, v])),
  });
  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
      "idempotency-key": input.idempotencyKey,
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !json.id || !json.url) throw new Error(`Stripe checkout failed: ${json.error?.message ?? res.status}`);
  return { id: json.id, url: json.url };
}

/** Stripe-Signature: t=<unix>,v1=<hmac sha256 of "<t>.<raw body>">. Pure, so it is tested directly. */
export function verifyStripeSignature(rawBody: string | Buffer, header: string | undefined, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(nowSec - t) > TOLERANCE_SEC) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody.toString("utf8")}`).digest("hex");
  const candidates = header.split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const a = Buffer.from(expected, "hex");
  return candidates.some((c) => {
    const b = Buffer.from(c, "hex");
    return b.length === a.length && timingSafeEqual(a, b);
  });
}

/** Fetches the hosted invoice URL and PDF for a paid session, best effort. */
export async function fetchInvoiceLinks(sessionId: string): Promise<{ hostedUrl: string | null; pdfUrl: string | null }> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return { hostedUrl: null, pdfUrl: null };
  try {
    const s = await fetch(`${API}/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    const sj = (await s.json()) as { invoice?: string | null };
    if (!sj.invoice) return { hostedUrl: null, pdfUrl: null };
    const i = await fetch(`${API}/invoices/${encodeURIComponent(sj.invoice)}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    const ij = (await i.json()) as { hosted_invoice_url?: string | null; invoice_pdf?: string | null };
    return { hostedUrl: ij.hosted_invoice_url ?? null, pdfUrl: ij.invoice_pdf ?? null };
  } catch {
    return { hostedUrl: null, pdfUrl: null };
  }
}
