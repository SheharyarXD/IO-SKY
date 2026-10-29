/*
 * N03 (SRS 17.11, 29 Oct Doc 1 Ch15 and F-31): failed emails are retried on a
 * configurable schedule and escalated when they cannot be delivered, without
 * ever claiming inbox delivery. Policy rules first, then the worker and the
 * queueing step with injected dependencies (no database, no provider).
 */
import { describe, expect, it, vi } from "vitest";
import {
  classifyDeliveryError,
  decideAfterFailure,
  DEFAULT_RETRY_POLICY,
  maskRecipient,
  policyFromSettings,
  retryDelayMs,
  RETRY_SETTING_KEYS,
} from "../shared/emailRetryPolicy";
import { validateSettingValue } from "../shared/srsRules";
import { processEmailRetries, queueFailedEmail, type OutboxDeps } from "./emailOutbox";
import type { EmailOutbox } from "../drizzle/schema";

const MIN = 60_000;

describe("classifyDeliveryError", () => {
  it("retries what a later attempt can fix", () => {
    for (const e of ["Resend 429: rate limited", "Resend 500: boom", "Resend 503: unavailable", "Resend 408: timeout", "connect ECONNRESET", "getaddrinfo ENOTFOUND api.resend.com", "fetch failed", "421 4.7.0 try again later", "450 mailbox busy", "Connection timeout", "something odd we cannot read", "", null, undefined]) {
      expect(classifyDeliveryError(e as never), String(e)).toBe("transient");
    }
  });

  it("sends what will fail every time straight to a human", () => {
    for (const e of ["Resend 400: invalid to address", "Resend 401: API key is invalid", "Resend 403: domain not verified", "Resend 404: not found", "Resend 422: validation_error", "550 5.1.1 The email account that you tried to reach does not exist", "553 sender rejected", "554 5.7.1 rejected", "550 mailbox unavailable", "Invalid login: 535 authentication failed", "user unknown"]) {
      expect(classifyDeliveryError(e), e).toBe("permanent");
    }
  });
});

describe("retry schedule", () => {
  it("backs off by the factor and is capped", () => {
    const p = DEFAULT_RETRY_POLICY;
    expect([1, 2, 3, 4].map((n) => retryDelayMs(n, p) / MIN)).toEqual([5, 15, 45, 135]);
    expect(retryDelayMs(9, p)).toBe(p.maxDelayMs);
    expect(retryDelayMs(0, p)).toBe(p.baseDelayMs); // never negative or zero
  });

  it("decideAfterFailure: retry, exhausted, or permanent", () => {
    const base = { policy: DEFAULT_RETRY_POLICY, now: 1_000_000 };
    expect(decideAfterFailure({ ...base, attempts: 1, errorClass: "transient" })).toEqual({ action: "retry", nextAttemptAt: 1_000_000 + 5 * MIN });
    expect(decideAfterFailure({ ...base, attempts: 4, errorClass: "transient" })).toMatchObject({ action: "retry" });
    expect(decideAfterFailure({ ...base, attempts: 5, errorClass: "transient" })).toEqual({ action: "abandon", reason: "exhausted" });
    expect(decideAfterFailure({ ...base, attempts: 1, errorClass: "permanent" })).toEqual({ action: "abandon", reason: "permanent" });
  });
});

describe("configurable policy", () => {
  it("builds from settings and falls back to defaults for missing or invalid values", () => {
    expect(policyFromSettings({})).toEqual(DEFAULT_RETRY_POLICY);
    const p = policyFromSettings({ [RETRY_SETTING_KEYS.maxAttempts]: "3", [RETRY_SETTING_KEYS.baseMinutes]: "10", [RETRY_SETTING_KEYS.maxDelayMinutes]: "60" });
    expect(p).toMatchObject({ maxAttempts: 3, baseDelayMs: 10 * MIN, maxDelayMs: 60 * MIN });
    const bad = policyFromSettings({ [RETRY_SETTING_KEYS.maxAttempts]: "abc", [RETRY_SETTING_KEYS.baseMinutes]: "-4", [RETRY_SETTING_KEYS.maxDelayMinutes]: "99999999" });
    expect(bad).toEqual(DEFAULT_RETRY_POLICY);
  });

  it("the longest wait is never shorter than the first wait", () => {
    expect(policyFromSettings({ [RETRY_SETTING_KEYS.baseMinutes]: "120", [RETRY_SETTING_KEYS.maxDelayMinutes]: "30" }).maxDelayMs).toBe(120 * MIN);
  });

  it("the three settings are validated by the existing configuration rules", () => {
    expect(validateSettingValue(RETRY_SETTING_KEYS.maxAttempts, "5").ok).toBe(true);
    expect(validateSettingValue(RETRY_SETTING_KEYS.maxAttempts, "0").ok).toBe(false);
    expect(validateSettingValue(RETRY_SETTING_KEYS.maxAttempts, "11").ok).toBe(false);
    expect(validateSettingValue(RETRY_SETTING_KEYS.baseMinutes, "1.5").ok).toBe(false);
    expect(validateSettingValue(RETRY_SETTING_KEYS.maxDelayMinutes, "10080").ok).toBe(true);
  });
});

describe("maskRecipient", () => {
  it("keeps the first letter and the domain only", () => {
    expect(maskRecipient("gina@example.com")).toBe("g***@example.com");
    expect(maskRecipient("not-an-address")).toBe("***");
  });
});

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const NOW = 2_000_000_000_000;
const row = (over: Partial<EmailOutbox> = {}): EmailOutbox => ({
  id: 1, kind: "simple", messageType: "notification", recipient: "gina@example.com", subject: "Hello", relatedRef: "REF-1",
  payload: JSON.stringify({ html: "<p>hi</p>", text: "hi", refHeader: "ref" }), status: "processing", attempts: 1, maxAttempts: 5,
  nextAttemptAt: new Date(NOW - 1000), lockedUntil: new Date(NOW + 5 * MIN), lastError: "Resend 503", lastErrorClass: "transient", abandonReason: null,
  escalatedAt: null, createdAt: new Date(NOW - 10 * MIN), updatedAt: new Date(NOW - MIN), ...over,
});

function deps(rows: EmailOutbox[], send: OutboxDeps["send"]) {
  const calls = { sent: [] as unknown[], retry: [] as unknown[], abandoned: [] as unknown[], escalated: [] as unknown[], logged: [] as unknown[], booking: [] as unknown[] };
  const d: OutboxDeps = {
    now: () => NOW,
    policy: async () => DEFAULT_RETRY_POLICY,
    claim: async () => rows,
    send,
    logAttempt: async (a) => void calls.logged.push(a.result),
    markSent: async (id, attempts) => void calls.sent.push({ id, attempts }),
    markRetry: async (id, a) => void calls.retry.push({ id, ...a }),
    markAbandoned: async (id, a) => void calls.abandoned.push({ id, ...a }),
    escalate: async (a) => void calls.escalated.push(a),
    afterBookingConfirmationSent: async (r) => void calls.booking.push(r.relatedRef),
  };
  return { d, calls };
}
const ok = async () => ({ ok: true as const, transport: "resend" as const, messageId: "msg_1" });
const fail = (error: string) => async () => ({ ok: false as const, transport: "resend" as const, error });

describe("processEmailRetries", () => {
  it("does nothing when nothing is due", async () => {
    const { d, calls } = deps([], ok);
    expect(await processEmailRetries(d)).toEqual({ claimed: 0, sent: 0, requeued: 0, abandoned: 0 });
    expect(calls.logged).toHaveLength(0);
  });

  it("a retry the provider accepts is recorded as sent, logged as an attempt, and not escalated", async () => {
    const { d, calls } = deps([row()], ok);
    expect(await processEmailRetries(d)).toMatchObject({ claimed: 1, sent: 1 });
    expect(calls.sent).toEqual([{ id: 1, attempts: 2 }]);
    expect(calls.logged).toHaveLength(1);
    expect(calls.escalated).toHaveLength(0);
  });

  it("a booking confirmation that finally goes out updates the booking record", async () => {
    const { d, calls } = deps([row({ kind: "booking", messageType: "booking-confirmation", relatedRef: "IOSKY-AAAA-BBBB", payload: JSON.stringify({ publicRef: "IOSKY-AAAA-BBBB" }) })], ok);
    await processEmailRetries(d);
    expect(calls.booking).toEqual(["IOSKY-AAAA-BBBB"]);
  });

  it("a transient failure is re-queued on the backoff schedule, with the attempt counted", async () => {
    const { d, calls } = deps([row({ attempts: 2 })], fail("Resend 503: unavailable"));
    expect(await processEmailRetries(d)).toMatchObject({ requeued: 1, abandoned: 0 });
    expect(calls.retry).toEqual([{ id: 1, attempts: 3, nextAttemptAt: new Date(NOW + 45 * MIN), error: "Resend 503: unavailable", errorClass: "transient" }]);
    expect(calls.escalated).toHaveLength(0);
  });

  it("when the retry budget is spent the message is abandoned and ESCALATED once", async () => {
    const { d, calls } = deps([row({ attempts: 4 })], fail("Resend 503: unavailable"));
    expect(await processEmailRetries(d)).toMatchObject({ abandoned: 1, requeued: 0 });
    expect(calls.abandoned).toEqual([expect.objectContaining({ id: 1, attempts: 5, reason: "exhausted" })]);
    expect(calls.escalated).toEqual([expect.objectContaining({ reason: "exhausted", attempts: 5 })]);
  });

  it("a permanent failure is not retried again: abandoned and escalated at once", async () => {
    const { d, calls } = deps([row()], fail("550 5.1.1 user unknown"));
    expect(await processEmailRetries(d)).toMatchObject({ abandoned: 1 });
    expect(calls.retry).toHaveLength(0);
    expect(calls.escalated).toEqual([expect.objectContaining({ reason: "permanent" })]);
  });

  it("a send that throws counts as a failed attempt instead of crashing the pass", async () => {
    const { d, calls } = deps([row(), row({ id: 2, recipient: "b@example.com" })], async (r) => {
      if (r.id === 1) throw new Error("socket hang up");
      return { ok: true as const, transport: "smtp" as const };
    });
    expect(await processEmailRetries(d)).toMatchObject({ claimed: 2, requeued: 1, sent: 1 });
    expect(calls.retry).toHaveLength(1);
  });

  it("missing or corrupt stored content is final and escalated, and nothing is sent", async () => {
    const send = vi.fn(ok);
    const { d, calls } = deps([row({ payload: null }), row({ id: 2, payload: "{not json" })], send);
    expect(await processEmailRetries(d)).toMatchObject({ abandoned: 2 });
    expect(send).not.toHaveBeenCalled();
    expect(calls.escalated).toHaveLength(2);
  });

  it("a retry never turns into a claim of delivery: it records the provider's acceptance only", async () => {
    const { d, calls } = deps([row()], ok);
    await processEmailRetries(d);
    expect(JSON.stringify(calls)).not.toMatch(/deliver(ed)?"/i);
  });
});

// ---------------------------------------------------------------------------
// Queueing the first failure
// ---------------------------------------------------------------------------

function queueDeps(policy = DEFAULT_RETRY_POLICY) {
  const inserted: any[] = [];
  const escalated: any[] = [];
  return {
    inserted,
    escalated,
    d: {
      now: () => NOW,
      policy: async () => policy,
      insert: async (r: any) => {
        inserted.push(r);
        return 41;
      },
      escalate: async (a: any) => void escalated.push(a),
    },
  };
}
const msg = (error: string | null) => ({ kind: "simple" as const, messageType: "notification" as const, recipient: "gina@example.com", subject: "Hello", relatedRef: "REF-1", payload: { html: "<p>x</p>", text: "x", refHeader: "r" }, error });

describe("queueFailedEmail", () => {
  it("a transient first failure is queued with its content and the first retry time", async () => {
    const q = queueDeps();
    await queueFailedEmail(msg("Resend 503: unavailable"), q.d);
    expect(q.inserted[0]).toMatchObject({ status: "queued", attempts: 1, maxAttempts: 5, nextAttemptAt: new Date(NOW + 5 * MIN), lastErrorClass: "transient", abandonReason: null });
    expect(JSON.parse(q.inserted[0].payload)).toMatchObject({ html: "<p>x</p>" });
    expect(q.escalated).toHaveLength(0);
  });

  it("a permanent first failure is abandoned at once, keeps no message content, and is escalated", async () => {
    const q = queueDeps();
    await queueFailedEmail(msg("Resend 422: invalid to address"), q.d);
    expect(q.inserted[0]).toMatchObject({ status: "abandoned", payload: null, nextAttemptAt: null, abandonReason: "permanent" });
    expect(q.escalated).toEqual([expect.objectContaining({ reason: "permanent", row: expect.objectContaining({ id: 41 }) })]);
  });

  it("a policy of one send means no retry: abandoned as exhausted and escalated", async () => {
    const q = queueDeps({ ...DEFAULT_RETRY_POLICY, maxAttempts: 1 });
    await queueFailedEmail(msg("Resend 503"), q.d);
    expect(q.inserted[0]).toMatchObject({ status: "abandoned", abandonReason: "exhausted", payload: null });
    expect(q.escalated).toHaveLength(1);
  });

  it("does not escalate a message it could not even record (no row id)", async () => {
    const q = queueDeps();
    q.d.insert = async () => null;
    await queueFailedEmail(msg("Resend 422"), q.d);
    expect(q.escalated).toHaveLength(0);
  });
});
