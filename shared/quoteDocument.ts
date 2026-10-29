/**
 * Quotation document and edit rules (task B07; SRS 16; 29 Oct Ch14.2). Pure rules.
 *
 *  - Only a DRAFT can be edited. Once a quotation has been sent the customer may
 *    be holding it, so changing it would change what they were quoted; a
 *    correction is a new quotation.
 *  - A quotation cannot be sent, or accepted, after its validity date.
 *  - The document shows exactly the stored lines and the total computed from them
 *    (integer cents). No tax is calculated or implied here: tax is a billing
 *    decision (task B05), so the document says amounts are as quoted.
 *  - The document is built from data and escaped when rendered; nothing a person
 *    typed into a line is ever treated as markup.
 */
import { computeQuoteTotal, type DocumentStatus, type QuoteLine } from "./srsRules";

export function quoteIsEditable(status: string): boolean {
  return status === "draft";
}

export type MoveBlock = "validity_passed";

/** Why a status move must be refused beyond the plain transition table, or null. `today` is YYYY-MM-DD in UTC. */
export function quoteMoveBlockedReason(q: { validUntil: string | null }, to: DocumentStatus, today: string): MoveBlock | null {
  if ((to === "sent" || to === "accepted") && q.validUntil && q.validUntil < today) return "validity_passed";
  return null;
}

export const MOVE_BLOCK_TEXT: Record<MoveBlock, string> = {
  validity_passed: "This quotation's validity date has passed. Change the date, or create a new quotation.",
};

export function formatMoney(cents: number, currency: string): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = ({ EUR: "€", USD: "$", GBP: "£" } as Record<string, string>)[currency];
  const amount = `${whole}.${String(abs % 100).padStart(2, "0")}`;
  return symbol ? `${sign}${symbol}${amount}` : `${sign}${amount} ${currency}`;
}

export type QuoteDocument = {
  ref: string;
  title: string;
  status: string;
  currency: string;
  issuedOn: string;
  validUntil: string | null;
  customer: string | null;
  lines: Array<{ description: string; quantity: number; unit: string; total: string }>;
  total: string;
  totalCents: number;
  footnote: string;
};

export function parseLines(linesJson: string): QuoteLine[] {
  try {
    const v = JSON.parse(linesJson);
    if (!Array.isArray(v)) return [];
    return v
      .filter((l): l is QuoteLine => l && typeof l.description === "string" && Number.isInteger(l.quantity) && l.quantity > 0 && Number.isInteger(l.unitCents) && l.unitCents >= 0)
      .map((l) => ({ description: l.description, quantity: l.quantity, unitCents: l.unitCents }));
  } catch {
    return [];
  }
}

export const QUOTE_FOOTNOTE = "Amounts are as quoted. Any tax is shown on the invoice. This quotation is not an invoice and is not binding until accepted.";

export function buildQuoteDocument(q: { publicRef: string; title: string; status: string; currency: string; linesJson: string; validUntil: string | null; createdAt: Date | string }, customer: string | null = null): QuoteDocument {
  const lines = parseLines(q.linesJson);
  // The total is always recomputed from the lines, never read from a stored figure, so the page cannot disagree with itself.
  const totalCents = lines.length > 0 ? computeQuoteTotal(lines) : 0;
  return {
    ref: q.publicRef,
    title: q.title,
    status: q.status,
    currency: q.currency,
    issuedOn: new Date(q.createdAt).toISOString().slice(0, 10),
    validUntil: q.validUntil,
    customer,
    lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unit: formatMoney(l.unitCents, q.currency), total: formatMoney(l.quantity * l.unitCents, q.currency) })),
    total: formatMoney(totalCents, q.currency),
    totalCents,
    footnote: QUOTE_FOOTNOTE,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The document as a standalone branded HTML page. Every value is escaped. */
export function renderQuoteHtml(d: QuoteDocument): string {
  const rows = d.lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="n">${l.quantity}</td><td class="n">${esc(l.unit)}</td><td class="n">${esc(l.total)}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.ref)} ${esc(d.title)}</title><style>
body{font-family:Helvetica,Arial,sans-serif;color:#0D2D2E;margin:40px;max-width:760px}
h1{font-size:22px;margin:0 0 4px}.brand{font-size:22px;font-weight:700;letter-spacing:.04em}.brand span{color:#F58A1F}
table{border-collapse:collapse;width:100%;margin-top:18px}th,td{padding:8px 6px;border-bottom:1px solid #d8d4c8;text-align:left;font-size:14px}.n{text-align:right}
.total{font-size:16px;font-weight:700}.meta{color:#555;font-size:13px;margin:2px 0}.foot{margin-top:28px;color:#666;font-size:12px}</style></head><body>
<div class="brand">IO <span>SKY</span></div>
<h1>${esc(d.title)}</h1>
<p class="meta">Quotation ${esc(d.ref)} · issued ${esc(d.issuedOn)}${d.validUntil ? ` · valid until ${esc(d.validUntil)}` : ""}${d.customer ? ` · for ${esc(d.customer)}` : ""}</p>
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td class="total" colspan="3">Total</td><td class="n total">${esc(d.total)}</td></tr></tfoot></table>
<p class="foot">${esc(d.footnote)}</p></body></html>`;
}
