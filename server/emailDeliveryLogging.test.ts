/**
 * server/email.ts — Milestone 2 §2.3 delivery-log integration. Every send
 * path (sendBookingConfirmation, and dispatchSimpleEmail's 3 callers via
 * sendContactConfirmation/sendDevApplicationAck) must log exactly one
 * email_delivery_log row per attempt, success or failure.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db/emailDelivery", () => ({
  insertEmailDeliveryLog: vi.fn(async () => undefined),
}));

import { insertEmailDeliveryLog } from "./db/emailDelivery";
import { sendBookingConfirmation, sendContactConfirmation, sendDevApplicationAck } from "./email";

const ORIGINAL_ENV = { ...process.env };

describe("email delivery logging (Milestone 2 §2.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_URL;
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("logs a 'sent' row for a booking confirmation delivered via the console fallback", async () => {
    await sendBookingConfirmation({
      publicRef: "IO-TEST-001",
      fullName: "Jan Jansen",
      email: "jan@example.com",
      serviceId: "discovery",
      serviceLabel: "Discovery Call",
      slotStartMs: Date.now() + 86_400_000,
      durationMin: 30,
      timezone: "Europe/Amsterdam",
    });

    expect(insertEmailDeliveryLog).toHaveBeenCalledTimes(1);
    const entry = (insertEmailDeliveryLog as any).mock.calls[0][0];
    expect(entry.messageType).toBe("booking-confirmation");
    expect(entry.transport).toBe("console");
    expect(entry.recipient).toBe("jan@example.com");
    expect(entry.relatedRef).toBe("IO-TEST-001");
    expect(entry.status).toBe("sent");
    expect(entry.errorMessage).toBeNull();
  });

  it("logs a 'failed' row with the transport error when Resend rejects the send", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad request", { status: 400, statusText: "Bad Request" })),
    );

    const result = await sendBookingConfirmation({
      publicRef: "IO-TEST-002",
      fullName: "Jan Jansen",
      email: "jan@example.com",
      serviceId: "discovery",
      serviceLabel: "Discovery Call",
      slotStartMs: Date.now() + 86_400_000,
      durationMin: 30,
      timezone: "Europe/Amsterdam",
    });

    expect(result.ok).toBe(false);
    expect(insertEmailDeliveryLog).toHaveBeenCalledTimes(1);
    const entry = (insertEmailDeliveryLog as any).mock.calls[0][0];
    expect(entry.status).toBe("failed");
    expect(entry.errorMessage).toContain("Resend 400");
    vi.unstubAllGlobals();
  });

  it("logs contact-confirmation and devapp-ack sends with their own messageType and relatedRef", async () => {
    await sendContactConfirmation({
      publicRef: "IO-C-001",
      fullName: "Jan Jansen",
      email: "jan@example.com",
      subject: "Question",
      message: "Hello",
    });
    await sendDevApplicationAck({
      publicRef: "IO-D-001",
      fullName: "Alex Engineer",
      email: "alex@example.com",
    });

    expect(insertEmailDeliveryLog).toHaveBeenCalledTimes(2);
    const [contactEntry, devAppEntry] = (insertEmailDeliveryLog as any).mock.calls.map(
      (c: any[]) => c[0],
    );
    expect(contactEntry.messageType).toBe("contact-confirmation");
    expect(contactEntry.relatedRef).toBe("IO-C-001");
    expect(devAppEntry.messageType).toBe("devapp-ack");
    expect(devAppEntry.relatedRef).toBe("IO-D-001");
  });
});
