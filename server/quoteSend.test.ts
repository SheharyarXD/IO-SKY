/*
 * B07 (SRS 16; 29 Oct Ch14.2): emailing a quotation with its PDF. The sending rule is pure,
 * attachment handling is tested against a stubbed provider request, and the endpoint runs
 * against fakes. Nothing is emailed: fetch is stubbed and the mail dispatcher is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planQuoteSend, SEND_BLOCK_TEXT } from "../shared/quoteDocument";
import { attachmentsWithinLimits, EMAIL_ATTACHMENT_LIMITS, isValidAttachment, retrySimpleEmail, type EmailAttachment } from "./email";

const ok = { status: "draft", validUntil: "2026-12-31", lineCount: 2, totalCents: 150_000, recipientEmail: "buyer@example.com", today: "2026-10-30" };

describe("planQuoteSend", () => {
  it("a draft may be sent and then becomes sent; a sent one may be sent again and stays sent", () => {
    expect(planQuoteSend(ok)).toEqual({ ok: true, movesToSent: true });
    expect(planQuoteSend({ ...ok, status: "sent" })).toEqual({ ok: true, movesToSent: false });
  });
  it("a closed quotation can never be emailed", () => {
    for (const status of ["accepted", "rejected", "expired", "", "weird"]) expect(planQuoteSend({ ...ok, status }), status).toEqual({ ok: false, reason: "not_sendable" });
  });
  it("refuses a lapsed validity date, but not one that ends today or has none", () => {
    expect(planQuoteSend({ ...ok, validUntil: "2026-10-29" })).toEqual({ ok: false, reason: "validity_passed" });
    expect(planQuoteSend({ ...ok, validUntil: "2026-10-30" })).toMatchObject({ ok: true });
    expect(planQuoteSend({ ...ok, validUntil: null })).toMatchObject({ ok: true });
  });
  it("refuses an empty or zero-value quotation", () => {
    expect(planQuoteSend({ ...ok, lineCount: 0 })).toEqual({ ok: false, reason: "empty_quote" });
    expect(planQuoteSend({ ...ok, totalCents: 0 })).toEqual({ ok: false, reason: "empty_quote" });
  });
  it("refuses a malformed recipient", () => {
    for (const bad of ["", "nope", "a@b", "a b@c.de", "@x.io", "x@.io", "a@b@c.io", "x".repeat(320) + "@a.io"]) expect(planQuoteSend({ ...ok, recipientEmail: bad }), bad).toEqual({ ok: false, reason: "invalid_recipient" });
    expect(planQuoteSend({ ...ok, recipientEmail: "  buyer@example.com " })).toMatchObject({ ok: true });
  });
  it("every refusal has a plain message", () => {
    for (const t of Object.values(SEND_BLOCK_TEXT)) expect(t.length).toBeGreaterThan(15);
  });
});

describe("attachment limits", () => {
  const pdf: EmailAttachment = { filename: "Q-ABC.pdf", contentBase64: Buffer.from("%PDF-1.4 test").toString("base64"), contentType: "application/pdf" };
  it("accepts a plain PDF", () => {
    expect(isValidAttachment(pdf)).toBe(true);
    expect(attachmentsWithinLimits([pdf])).toBe(true);
  });
  it("rejects dangerous or odd file names", () => {
    for (const filename of ["../../etc/passwd", "a/b.pdf", "a\\b.pdf", ".hidden.pdf", "", "x".repeat(150) + ".pdf", "evil\r\nBcc: x@y.z.pdf", "a..b.pdf", "with\u0000nul.pdf"]) expect(isValidAttachment({ ...pdf, filename }), JSON.stringify(filename)).toBe(false);
  });
  it("rejects content types outside the allow-list, including ones that run in a browser or on a machine", () => {
    for (const contentType of ["text/html", "application/x-msdownload", "application/zip", "image/svg+xml", "application/javascript", "", "application/pdf; charset=x"]) expect(isValidAttachment({ ...pdf, contentType }), contentType).toBe(false);
  });
  it("rejects content that is not base64", () => {
    for (const contentBase64 of ["not base64!", "abc", "====", "", "YQ=a"]) expect(isValidAttachment({ ...pdf, contentBase64 }), contentBase64).toBe(false);
  });
  it("limits the number of files and the total size", () => {
    expect(attachmentsWithinLimits([pdf, pdf, pdf])).toBe(true);
    expect(attachmentsWithinLimits([pdf, pdf, pdf, pdf])).toBe(false);
    const big = { ...pdf, contentBase64: Buffer.alloc(EMAIL_ATTACHMENT_LIMITS.totalBytes + 1000, 1).toString("base64") };
    expect(isValidAttachment(big)).toBe(false);
    const half = { ...pdf, contentBase64: Buffer.alloc(3 * 1024 * 1024, 1).toString("base64") };
    expect(attachmentsWithinLimits([half])).toBe(true);
    expect(attachmentsWithinLimits([half, half])).toBe(false);
  });
  it("tolerates junk without throwing", () => {
    expect(isValidAttachment(null as never)).toBe(false);
    expect(isValidAttachment({} as never)).toBe(false);
    expect(isValidAttachment({ filename: 1, contentBase64: 2, contentType: 3 } as never)).toBe(false);
  });
});

describe("what reaches the mail provider", () => {
  const ENV = { ...process.env };
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_fake_test_key";
    delete process.env.SMTP_URL;
    delete process.env.SMTP_HOST;
  });
  afterEach(() => {
    process.env = { ...ENV };
    vi.unstubAllGlobals();
  });
  const base = { to: "buyer@example.com", subject: "Your quotation", html: "<p>hi</p>", text: "hi", refHeader: "quote:Q-1" };
  const stub = () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    return f;
  };
  const body = (f: ReturnType<typeof stub>) => JSON.parse(((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string));

  it("sends a valid PDF as a base64 attachment", async () => {
    const f = stub();
    const content = Buffer.from("%PDF-1.4 hello").toString("base64");
    const r = await retrySimpleEmail({ ...base, attachments: [{ filename: "Q-1.pdf", contentBase64: content, contentType: "application/pdf" }] });
    expect(r).toMatchObject({ ok: true, transport: "resend" });
    expect(body(f).attachments).toEqual([{ filename: "Q-1.pdf", content }]);
  });
  it("sends no attachments field at all for an ordinary email (unchanged behaviour)", async () => {
    const f = stub();
    await retrySimpleEmail(base);
    expect(Object.keys(body(f)).sort()).toEqual(["from", "headers", "html", "subject", "text", "to"]);
  });
  it("drops an invalid attachment instead of sending it, but still sends the email", async () => {
    const f = stub();
    await retrySimpleEmail({ ...base, attachments: [{ filename: "../../x.pdf", contentBase64: "AAAA", contentType: "application/pdf" }, { filename: "ok.pdf", contentBase64: "AAAA", contentType: "text/html" }] });
    expect(f).toHaveBeenCalledTimes(1);
    expect(body(f).attachments).toBeUndefined();
  });
  it("keeps the valid attachment and drops the invalid one when mixed", async () => {
    const f = stub();
    await retrySimpleEmail({ ...base, attachments: [{ filename: "ok.pdf", contentBase64: "AAAA", contentType: "application/pdf" }, { filename: "bad.exe", contentBase64: "AAAA", contentType: "application/x-msdownload" }] });
    expect(body(f).attachments).toEqual([{ filename: "ok.pdf", content: "AAAA" }]);
  });
  it("never puts the API key or the recipient list into the attachment", async () => {
    const f = stub();
    await retrySimpleEmail({ ...base, attachments: [{ filename: "ok.pdf", contentBase64: "AAAA", contentType: "application/pdf" }] });
    expect(JSON.stringify(body(f).attachments)).not.toMatch(/re_fake|buyer@/);
  });
});

// ---------------------------------------------------------------------------
// the endpoint
// ---------------------------------------------------------------------------

const d = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  getQuoteWithCustomer: vi.fn(),
  moveQuote: vi.fn(),
  dispatchSimpleEmail: vi.fn(),
}));
vi.mock("./email", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, dispatchSimpleEmail: (...a: unknown[]) => d.dispatchSimpleEmail(...a) };
});
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), appendLoginAudit: d.appendLoginAudit, getQuoteWithCustomer: d.getQuoteWithCustomer, moveQuote: d.moveQuote };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function ctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "t", email: "ops@example.com", name: "Ops", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}
const ops = (role: U["role"] = "admin") => appRouter.createCaller(ctx(role)).adminOps;
const quote = (over: Record<string, unknown> = {}) => ({
  quote: { id: 4, publicRef: "Q-ABCD1234", title: "Website rebuild", status: "draft", currency: "EUR", validUntil: "2099-12-31", createdAt: new Date("2026-10-30T10:00:00Z"), linesJson: JSON.stringify([{ description: "Build", quantity: 1, unitCents: 150_000 }]), organizationId: 3, ...over },
  customer: "Acme BV",
});
const input = { id: 4, recipientEmail: "buyer@example.com" };

describe("adminOps.sendQuote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    d.getQuoteWithCustomer.mockResolvedValue(quote());
    d.dispatchSimpleEmail.mockResolvedValue({ ok: true, transport: "resend", messageId: "m1" });
    d.moveQuote.mockResolvedValue({ ok: true, quote: {} });
  });

  it("is staff only", async () => {
    for (const role of ["client", "developer", "technical_operator"] as const) await expect(ops(role).sendQuote(input), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.dispatchSimpleEmail).not.toHaveBeenCalled();
  });

  it("emails the PDF, then moves a draft to sent, and audits without the address", async () => {
    await expect(ops().sendQuote({ ...input, message: "Great to speak today." })).resolves.toEqual({ ok: true, status: "sent", statusUpdated: true });
    const mail = d.dispatchSimpleEmail.mock.calls[0][0] as { to: string; subject: string; text: string; attachments: EmailAttachment[]; messageType: string };
    expect(mail).toMatchObject({ to: "buyer@example.com", subject: "Your IO SKY quotation Q-ABCD1234", messageType: "notification" });
    expect(mail.text).toContain("Great to speak today.");
    expect(mail.text).toContain("€1,500.00");
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0]).toMatchObject({ filename: "Q-ABCD1234.pdf", contentType: "application/pdf" });
    expect(Buffer.from(mail.attachments[0].contentBase64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    expect(d.moveQuote).toHaveBeenCalledWith(4, "sent");
    const reason = (d.appendLoginAudit.mock.calls.at(-1)?.[0] as { reason: string }).reason;
    expect(reason).toContain("admin.quote.send(Q-ABCD1234:moved=true)");
    expect(reason).not.toContain("buyer@example.com");
  });

  it("an already sent quotation can be sent again without being moved", async () => {
    d.getQuoteWithCustomer.mockResolvedValue(quote({ status: "sent" }));
    await expect(ops().sendQuote(input)).resolves.toEqual({ ok: true, status: "sent", statusUpdated: true });
    expect(d.moveQuote).not.toHaveBeenCalled();
  });

  it("does not email anything the rules refuse", async () => {
    for (const [over, code] of [[{ status: "accepted" }, "PRECONDITION_FAILED"], [{ status: "expired" }, "PRECONDITION_FAILED"], [{ validUntil: "2020-01-01" }, "PRECONDITION_FAILED"], [{ linesJson: "[]" }, "PRECONDITION_FAILED"]] as const) {
      d.getQuoteWithCustomer.mockResolvedValueOnce(quote(over));
      await expect(ops().sendQuote(input), JSON.stringify(over)).rejects.toMatchObject({ code });
    }
    expect(d.dispatchSimpleEmail).not.toHaveBeenCalled();
    expect(d.moveQuote).not.toHaveBeenCalled();
  });

  it("a missing quotation is a 404 and a bad recipient is rejected before anything is read", async () => {
    d.getQuoteWithCustomer.mockResolvedValueOnce(null);
    await expect(ops().sendQuote(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(ops().sendQuote({ id: 4, recipientEmail: "not-an-email" })).rejects.toThrow();
    expect(d.getQuoteWithCustomer).toHaveBeenCalledTimes(1);
  });

  it("claims nothing when no mail transport is configured", async () => {
    d.dispatchSimpleEmail.mockResolvedValueOnce({ ok: true, transport: "console" });
    await expect(ops().sendQuote(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("nothing was sent") });
    expect(d.moveQuote).not.toHaveBeenCalled();
  });

  it("a failed delivery leaves the quotation a draft, says it will be retried, and audits the failure", async () => {
    d.dispatchSimpleEmail.mockResolvedValueOnce({ ok: false, transport: "resend", error: "Resend 500" });
    await expect(ops().sendQuote(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("retried automatically") });
    expect(d.moveQuote).not.toHaveBeenCalled();
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.quote.send_failed(Q-ABCD1234)") }));
  });

  it("reports honestly if the email went but the status could not be updated", async () => {
    d.moveQuote.mockResolvedValueOnce({ ok: false, code: "PRECONDITION_FAILED", reason: "changed" });
    await expect(ops().sendQuote(input)).resolves.toEqual({ ok: true, status: "draft", statusUpdated: false });
  });
});
