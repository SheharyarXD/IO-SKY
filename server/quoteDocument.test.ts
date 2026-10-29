/*
 * B07 (SRS 16; 29 Oct Ch14.2): quotation edit rules and branded output. Pure rules,
 * a real (local, in-memory) PDF render, and the endpoints with the data layer
 * mocked. Nothing is emailed. The edit SQL has not run against PostgreSQL (M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildQuoteDocument, formatMoney, MOVE_BLOCK_TEXT, parseLines, QUOTE_FOOTNOTE, quoteIsEditable, quoteMoveBlockedReason, renderQuoteHtml } from "../shared/quoteDocument";
import { renderQuotePdf } from "./quotePdf";

const base = { publicRef: "Q-ABCD1234", title: "Website rebuild", status: "draft", currency: "EUR", validUntil: "2026-12-31", createdAt: new Date("2026-10-30T10:00:00Z") };
const lines = [
  { description: "Discovery workshop", quantity: 2, unitCents: 150_000 },
  { description: "Build", quantity: 1, unitCents: 1_250_050 },
];
const quote = (over: Partial<typeof base> & { linesJson?: string } = {}) => ({ ...base, linesJson: JSON.stringify(lines), ...over });

describe("editing", () => {
  it("only a draft can be edited", () => {
    expect(quoteIsEditable("draft")).toBe(true);
    for (const s of ["sent", "accepted", "rejected", "expired", "", "DRAFT"]) expect(quoteIsEditable(s), s).toBe(false);
  });
});

describe("validity", () => {
  it("blocks sending or accepting after the validity date, not on it", () => {
    expect(quoteMoveBlockedReason({ validUntil: "2026-10-29" }, "sent", "2026-10-30")).toBe("validity_passed");
    expect(quoteMoveBlockedReason({ validUntil: "2026-10-29" }, "accepted", "2026-10-30")).toBe("validity_passed");
    expect(quoteMoveBlockedReason({ validUntil: "2026-10-30" }, "sent", "2026-10-30")).toBeNull();
    expect(quoteMoveBlockedReason({ validUntil: "2026-12-01" }, "accepted", "2026-10-30")).toBeNull();
    expect(quoteMoveBlockedReason({ validUntil: null }, "sent", "2099-01-01")).toBeNull();
  });
  it("never blocks declining or expiring one that has lapsed", () => {
    expect(quoteMoveBlockedReason({ validUntil: "2020-01-01" }, "rejected", "2026-10-30")).toBeNull();
    expect(quoteMoveBlockedReason({ validUntil: "2020-01-01" }, "expired", "2026-10-30")).toBeNull();
    expect(MOVE_BLOCK_TEXT.validity_passed).toMatch(/validity date has passed/);
  });
});

describe("money", () => {
  it("formats cents exactly, with grouping and the currency symbol", () => {
    expect(formatMoney(0, "EUR")).toBe("€0.00");
    expect(formatMoney(5, "EUR")).toBe("€0.05");
    expect(formatMoney(150_000, "EUR")).toBe("€1,500.00");
    expect(formatMoney(1_250_050, "USD")).toBe("$12,500.50");
    expect(formatMoney(123_456_789, "GBP")).toBe("£1,234,567.89");
    expect(formatMoney(-250, "EUR")).toBe("-€2.50");
    expect(formatMoney(1000, "CHF")).toBe("10.00 CHF");
  });
});

describe("the document", () => {
  it("lists the stored lines and a total recomputed from them", () => {
    const d = buildQuoteDocument(quote(), "Acme BV");
    expect(d.lines).toEqual([
      { description: "Discovery workshop", quantity: 2, unit: "€1,500.00", total: "€3,000.00" },
      { description: "Build", quantity: 1, unit: "€12,500.50", total: "€12,500.50" },
    ]);
    expect(d).toMatchObject({ ref: "Q-ABCD1234", title: "Website rebuild", issuedOn: "2026-10-30", validUntil: "2026-12-31", customer: "Acme BV", total: "€15,500.50", totalCents: 1_550_050, footnote: QUOTE_FOOTNOTE });
  });
  it("does not trust a stored total: the page can never disagree with its own lines", () => {
    const d = buildQuoteDocument({ ...quote(), totalCents: 1 } as never);
    expect(d.totalCents).toBe(1_550_050);
  });
  it("makes no tax claim", () => {
    const d = buildQuoteDocument(quote());
    expect(d.footnote).toMatch(/Any tax is shown on the invoice/);
    expect(JSON.stringify(d)).not.toMatch(/\bVAT\b|incl\.|excl\./i);
  });
  it("survives corrupt stored lines", () => {
    expect(parseLines("not json")).toEqual([]);
    expect(parseLines('{"a":1}')).toEqual([]);
    expect(parseLines(JSON.stringify([{ description: "ok", quantity: 1, unitCents: 5 }, { description: 3, quantity: 1, unitCents: 5 }, { description: "bad qty", quantity: 0, unitCents: 5 }, { description: "frac", quantity: 1, unitCents: 1.5 }, null]))).toEqual([{ description: "ok", quantity: 1, unitCents: 5 }]);
    expect(buildQuoteDocument(quote({ linesJson: "garbage" }))).toMatchObject({ lines: [], total: "€0.00", totalCents: 0 });
  });
});

describe("the HTML", () => {
  it("is branded, shows the figures, and escapes everything a person typed", () => {
    const evil = quote({ title: '<img src=x onerror=alert(1)> & "q"', linesJson: JSON.stringify([{ description: "<script>alert('x')</script>", quantity: 1, unitCents: 100 }]) });
    const html = renderQuoteHtml(buildQuoteDocument(evil, "<b>Evil</b> Ltd"));
    expect(html).toContain('IO <span>SKY</span>');
    expect(html).not.toMatch(/<script|<img|<b>/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;");
    expect(html).toContain("€1.00");
  });
  it("shows the validity date and total of a normal quotation", () => {
    const html = renderQuoteHtml(buildQuoteDocument(quote(), "Acme BV"));
    expect(html).toContain("valid until 2026-12-31");
    expect(html).toContain("€15,500.50");
    expect(html).toContain("for Acme BV");
    expect(html).toContain(QUOTE_FOOTNOTE);
  });
});

describe("the PDF", () => {
  it("renders a real PDF locally from the same document", async () => {
    const pdf = await renderQuotePdf(buildQuoteDocument(quote(), "Acme BV"));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-6).toString()).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(1500);
    expect(pdf.toString("latin1")).toContain("IO SKY"); // metadata is stored uncompressed
  });
  it("paginates a long quotation instead of running off the page", async () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ description: `Line item number ${i + 1} with a reasonably long description to wrap`, quantity: 1, unitCents: 1000 }));
    const pdf = await renderQuotePdf(buildQuoteDocument(quote({ linesJson: JSON.stringify(many) })));
    const pages = (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
  });
  it("renders an empty quotation and awkward characters without throwing", async () => {
    await expect(renderQuotePdf(buildQuoteDocument(quote({ linesJson: "[]" })))).resolves.toBeInstanceOf(Buffer);
    await expect(renderQuotePdf(buildQuoteDocument(quote({ title: "Ünïcödé — “quotes” 日本語", linesJson: JSON.stringify([{ description: "Ünïcödé 日本語 line", quantity: 1, unitCents: 1 }]) })))).resolves.toBeInstanceOf(Buffer);
  });
});

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------

const d = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  updateQuote: vi.fn(),
  getQuoteWithCustomer: vi.fn(),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), ...d };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function ctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "test-admin", email: "ops@example.com", name: "Ops Admin", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}
const ops = (role: U["role"] = "admin") => appRouter.createCaller(ctx(role)).adminOps;

describe("adminOps quotation endpoints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("are staff only", async () => {
    for (const role of ["client", "developer"] as const) {
      await expect(ops(role).updateQuote({ id: 1, title: "x" }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(ops(role).quoteDocument({ id: 1 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(d.updateQuote).not.toHaveBeenCalled();
    expect(d.getQuoteWithCustomer).not.toHaveBeenCalled();
  });

  it("edits a draft, passing only what was given, and audits which fields changed", async () => {
    d.updateQuote.mockResolvedValueOnce({ ok: true, quote: { publicRef: "Q-ABCD1234" } });
    await ops().updateQuote({ id: 4, title: "New title", validUntil: null });
    expect(d.updateQuote).toHaveBeenCalledWith(4, { title: "New title", validUntil: null });
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.quote.update(Q-ABCD1234:title,validUntil)") }));
  });

  it("maps a sent quotation to a precondition failure and a missing one to not found", async () => {
    d.updateQuote.mockResolvedValueOnce({ ok: false, code: "PRECONDITION_FAILED", reason: "Only a draft quotation can be edited." });
    await expect(ops().updateQuote({ id: 4, title: "x" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    d.updateQuote.mockResolvedValueOnce({ ok: false, code: "NOT_FOUND", reason: "Quotation not found." });
    await expect(ops().updateQuote({ id: 5, title: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    d.updateQuote.mockRejectedValueOnce(new Error("Quantity must be a positive whole number."));
    await expect(ops().updateQuote({ id: 4, lines: [{ description: "a", quantity: 1, unitCents: 1 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(d.appendLoginAudit).not.toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("quote.update") }));
  });

  it("rejects invalid edits before reaching the data layer", async () => {
    for (const bad of [{ id: 1, lines: [] }, { id: 1, lines: [{ description: "a", quantity: 0, unitCents: 1 }] }, { id: 1, lines: [{ description: "a", quantity: 1, unitCents: -1 }] }, { id: 1, lines: [{ description: "a", quantity: 1, unitCents: 1.5 }] }, { id: 1, validUntil: "30/10/2026" }, { id: 1, title: "" }, { id: 0, title: "x" }]) {
      await expect(ops().updateQuote(bad as never), JSON.stringify(bad)).rejects.toThrow();
    }
    expect(d.updateQuote).not.toHaveBeenCalled();
  });

  it("returns the branded document as HTML and a real PDF, and audits the download", async () => {
    d.getQuoteWithCustomer.mockResolvedValueOnce({ quote: { ...quote(), organizationId: 3 }, customer: "Acme BV" });
    const r = await ops().quoteDocument({ id: 4 });
    expect(r).toMatchObject({ ref: "Q-ABCD1234", filename: "Q-ABCD1234.pdf", totalCents: 1_550_050 });
    expect(r.html).toContain("for Acme BV");
    expect(Buffer.from(r.pdfBase64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.quote.document(Q-ABCD1234)") }));
  });

  it("404s for a missing quotation without rendering anything", async () => {
    d.getQuoteWithCustomer.mockResolvedValueOnce(null);
    await expect(ops().quoteDocument({ id: 9 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
