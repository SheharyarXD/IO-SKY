/*
 * N03: a failed send is handed to the persistent retry queue from both send
 * paths. Successes and console-mode sends are not. Queueing is best effort and
 * must never break the send, and the retry functions must not re-queue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  queueFailedEmail: vi.fn(async (_: unknown) => undefined),
  insertEmailDeliveryLog: vi.fn(async (_: unknown) => undefined),
}));

vi.mock("./emailOutbox", () => ({ queueFailedEmail: m.queueFailedEmail }));
vi.mock("./db/emailDelivery", () => ({ insertEmailDeliveryLog: m.insertEmailDeliveryLog }));

import { dispatchSimpleEmail, retryBookingConfirmation, retrySimpleEmail, sendBookingConfirmation } from "./email";

const simple = { to: "gina@example.com", subject: "Hello", html: "<p>hi</p>", text: "hi", refHeader: "ref-1", messageType: "notification" as const, relatedRef: "REF-1" };
const booking = {
  publicRef: "IOSKY-AAAA-BBBB", fullName: "Gina Guest", email: "gina@example.com", company: null, serviceId: "discovery", serviceLabel: "Executive Discovery Call",
  slotStartMs: Date.now() + 5 * 86_400_000, durationMin: 30, timezone: "Europe/Amsterdam", locale: "en",
};

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  vi.clearAllMocks();
  for (const k of ["RESEND_API_KEY", "SMTP_HOST", "SMTP_URL"]) saved[k] = process.env[k];
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_URL;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const provider = (status: number, body = "{}") => vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));

describe("generic emails", () => {
  it("a provider failure is queued once, with the content needed to send it again", async () => {
    process.env.RESEND_API_KEY = "re_test";
    provider(503, "unavailable");
    const r = await dispatchSimpleEmail(simple);
    expect(r.ok).toBe(false);
    expect(m.queueFailedEmail).toHaveBeenCalledTimes(1);
    expect(m.queueFailedEmail.mock.calls[0][0]).toMatchObject({ kind: "simple", messageType: "notification", recipient: "gina@example.com", relatedRef: "REF-1", payload: { html: "<p>hi</p>", text: "hi", refHeader: "ref-1" }, error: expect.stringContaining("Resend 503") });
    expect(m.insertEmailDeliveryLog).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" })); // the attempt is still logged
  });

  it("a successful send is not queued", async () => {
    process.env.RESEND_API_KEY = "re_test";
    provider(200, JSON.stringify({ id: "msg_1" }));
    expect((await dispatchSimpleEmail(simple)).ok).toBe(true);
    expect(m.queueFailedEmail).not.toHaveBeenCalled();
  });

  it("console mode (no provider configured) is not queued", async () => {
    delete process.env.RESEND_API_KEY;
    const r = await dispatchSimpleEmail(simple);
    expect(r.transport).toBe("console");
    expect(m.queueFailedEmail).not.toHaveBeenCalled();
  });

  it("a queueing problem never changes the result the caller sees", async () => {
    process.env.RESEND_API_KEY = "re_test";
    provider(500);
    m.queueFailedEmail.mockRejectedValueOnce(new Error("outbox exploded"));
    const r = await dispatchSimpleEmail(simple);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Resend 500");
  });

  it("the retry function sends but never queues again", async () => {
    process.env.RESEND_API_KEY = "re_test";
    provider(503);
    const r = await retrySimpleEmail({ to: simple.to, subject: simple.subject, html: simple.html, text: simple.text, refHeader: simple.refHeader });
    expect(r.ok).toBe(false);
    expect(m.queueFailedEmail).not.toHaveBeenCalled();
    expect(m.insertEmailDeliveryLog).not.toHaveBeenCalled(); // the worker logs its own attempts
  });
});

describe("Discovery Call confirmations", () => {
  it("a provider failure is queued with the booking input, so it can be re-rendered", async () => {
    process.env.RESEND_API_KEY = "re_test";
    provider(502);
    const r = await sendBookingConfirmation(booking);
    expect(r.ok).toBe(false);
    expect(m.queueFailedEmail).toHaveBeenCalledTimes(1);
    expect(m.queueFailedEmail.mock.calls[0][0]).toMatchObject({ kind: "booking", messageType: "booking-confirmation", relatedRef: "IOSKY-AAAA-BBBB", payload: expect.objectContaining({ publicRef: "IOSKY-AAAA-BBBB", email: "gina@example.com" }) });
  });

  it("a successful confirmation and console mode are not queued", async () => {
    process.env.RESEND_API_KEY = "re_test";
    provider(200, JSON.stringify({ id: "m" }));
    await sendBookingConfirmation(booking);
    delete process.env.RESEND_API_KEY;
    await sendBookingConfirmation(booking);
    expect(m.queueFailedEmail).not.toHaveBeenCalled();
  });

  it("the retry function re-sends from the stored input and does not queue again", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const f = vi.fn(async () => new Response(JSON.stringify({ id: "msg_2" }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const r = await retryBookingConfirmation(booking);
    expect(r).toMatchObject({ ok: true, messageId: "msg_2" });
    const sent = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.to).toBe("gina@example.com");
    expect(sent.attachments?.[0]?.filename).toContain("IOSKY-AAAA-BBBB"); // the calendar file is rebuilt too
    expect(m.queueFailedEmail).not.toHaveBeenCalled();
  });
});
