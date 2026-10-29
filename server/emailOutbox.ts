/**
 * Persistent retry and escalation for failed emails (task N03, SRS 17.11
 * "Retry failed deliveries according to configurable policies", 29 Oct Doc 1
 * Ch15 "visible failure and retry states").
 *
 * A send that fails at the provider is recorded here with what is needed to send
 * it again. A worker retries it on a backoff schedule. A permanent failure (bad
 * address, rejected credential) or an exhausted retry budget is abandoned and
 * ESCALATED: a visible admin notification, because nobody else will know the
 * customer never got the message. Nothing here claims delivery: a retry that the
 * provider accepts is recorded as sent, never as delivered.
 */
import {
  classifyDeliveryError,
  decideAfterFailure,
  maskRecipient,
  type ErrorClass,
  type RetryPolicy,
} from "../shared/emailRetryPolicy";
import type { EmailOutbox, InsertEmailOutbox } from "../drizzle/schema";

export type OutboxSendResult = { ok: boolean; transport: "resend" | "smtp" | "console"; messageId?: string; error?: string };

/** Everything the worker touches, injectable so the logic runs without a database or a provider. */
export type OutboxDeps = {
  now(): number;
  policy(): Promise<RetryPolicy>;
  claim(now: Date, limit: number, leaseMs: number): Promise<EmailOutbox[]>;
  send(row: EmailOutbox, payload: unknown): Promise<OutboxSendResult>;
  logAttempt(a: { row: EmailOutbox; result: OutboxSendResult }): Promise<void>;
  markSent(id: number, attempts: number): Promise<void>;
  markRetry(id: number, a: { attempts: number; nextAttemptAt: Date; error: string; errorClass: string }): Promise<void>;
  markAbandoned(id: number, a: { attempts: number; error: string; errorClass: string; reason: "permanent" | "exhausted" }): Promise<void>;
  escalate(a: { row: Pick<EmailOutbox, "id" | "messageType" | "recipient" | "relatedRef">; attempts: number; reason: "permanent" | "exhausted"; error: string }): Promise<void>;
  afterBookingConfirmationSent(row: EmailOutbox): Promise<void>;
};

export type OutboxRunSummary = { claimed: number; sent: number; requeued: number; abandoned: number };

const BATCH = 20;
const LEASE_MS = 5 * 60_000;

function parsePayload(row: EmailOutbox): unknown | null {
  if (!row.payload) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export async function processEmailRetries(deps: OutboxDeps): Promise<OutboxRunSummary> {
  const summary: OutboxRunSummary = { claimed: 0, sent: 0, requeued: 0, abandoned: 0 };
  const now = deps.now();
  const rows = await deps.claim(new Date(now), BATCH, LEASE_MS);
  summary.claimed = rows.length;
  if (rows.length === 0) return summary;
  const policy = await deps.policy();

  for (const row of rows) {
    const attempts = row.attempts + 1;
    const payload = parsePayload(row);
    if (payload === null) {
      // Nothing to send: the content is gone or unreadable. Final, and a human must know.
      const error = "stored message content is missing";
      await deps.markAbandoned(row.id, { attempts: row.attempts, error, errorClass: "permanent", reason: "permanent" });
      await deps.escalate({ row, attempts: row.attempts, reason: "permanent", error });
      summary.abandoned++;
      continue;
    }

    let result: OutboxSendResult;
    try {
      result = await deps.send(row, payload);
    } catch (err) {
      result = { ok: false, transport: "console", error: err instanceof Error ? err.message : String(err) };
    }
    await deps.logAttempt({ row, result }).catch(() => undefined);

    if (result.ok) {
      await deps.markSent(row.id, attempts);
      if (row.kind === "booking") await deps.afterBookingConfirmationSent(row).catch(() => undefined);
      summary.sent++;
      continue;
    }

    const error = result.error ?? "send failed";
    const errorClass: ErrorClass = classifyDeliveryError(error);
    const next = decideAfterFailure({ attempts, errorClass, policy, now: deps.now() });
    if (next.action === "retry") {
      await deps.markRetry(row.id, { attempts, nextAttemptAt: new Date(next.nextAttemptAt), error, errorClass });
      summary.requeued++;
    } else {
      await deps.markAbandoned(row.id, { attempts, error, errorClass, reason: next.reason });
      await deps.escalate({ row, attempts, reason: next.reason, error });
      summary.abandoned++;
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Production wiring
// ---------------------------------------------------------------------------

async function realDeps(): Promise<OutboxDeps> {
  const [ob, delivery, email, bookings, dispatcher] = await Promise.all([
    import("./db/emailOutbox"),
    import("./db/emailDelivery"),
    import("./email"),
    import("./db/bookings"),
    import("./notificationDispatcher"),
  ]);
  return {
    now: () => Date.now(),
    policy: ob.readEmailRetryPolicy,
    claim: ob.claimDueEmailOutbox,
    send: async (row, payload) => {
      if (row.kind === "booking") return email.retryBookingConfirmation(payload as Parameters<typeof email.retryBookingConfirmation>[0]);
      const p = payload as { html: string; text: string; refHeader: string };
      return email.retrySimpleEmail({ to: row.recipient, subject: row.subject ?? "", html: p.html, text: p.text, refHeader: p.refHeader });
    },
    // One delivery-log row per send attempt, as for every other send.
    logAttempt: ({ row, result }) =>
      delivery.insertEmailDeliveryLog({
        messageType: row.messageType,
        transport: result.transport,
        providerMessageId: result.messageId ?? null,
        recipient: row.recipient,
        subject: row.subject,
        relatedRef: row.relatedRef,
        status: result.ok ? "sent" : "failed",
        errorMessage: result.ok ? null : result.error ?? null,
      }),
    markSent: ob.markOutboxSent,
    markRetry: ob.markOutboxRetry,
    markAbandoned: ob.markOutboxAbandoned,
    escalate: async ({ row, attempts, reason, error }) => {
      try {
        await dispatcher.emitNotification({
          event: "INTEGRATION_FAILURE",
          audience: { type: "admin" },
          dedupeRef: `email-outbox:${row.id}`,
          title: "An email could not be delivered",
          body:
            `${row.messageType} to ${maskRecipient(row.recipient)}${row.relatedRef ? ` (ref ${row.relatedRef})` : ""} ` +
            `${reason === "permanent" ? "failed permanently" : `still failing after ${attempts} attempts`}. ` +
            `Last error: ${error.slice(0, 160)}. The recipient has not received it; contact them another way if it matters.`,
          href: "/admin/governance",
        });
        await ob.markOutboxEscalated(row.id);
      } catch (err) {
        console.error("[emailOutbox] could not raise the escalation:", err);
      }
    },
    afterBookingConfirmationSent: async (row) => {
      if (!row.relatedRef) return;
      const booking = await bookings.getBookingByPublicRef(row.relatedRef);
      if (!booking) return;
      await bookings.markBookingEmailSent(booking.id);
      await bookings.appendBookingAudit({ bookingId: booking.id, event: "email_sent_on_retry" });
    },
  };
}

let running = false;

/** One worker pass with the real database and providers. Safe to call on a timer; passes never overlap in-process. */
export async function runEmailRetryPass(): Promise<OutboxRunSummary> {
  if (running) return { claimed: 0, sent: 0, requeued: 0, abandoned: 0 };
  running = true;
  try {
    return await processEmailRetries(await realDeps());
  } finally {
    running = false;
  }
}

/**
 * Record a message whose first send failed. A permanent failure is abandoned and
 * escalated at once; otherwise the first retry is scheduled by the policy.
 */
export async function queueFailedEmail(
  a: {
    kind: "simple" | "booking";
    messageType: EmailOutbox["messageType"];
    recipient: string;
    subject: string;
    relatedRef: string | null;
    payload: unknown;
    error: string | null;
  },
  deps: {
    now(): number;
    policy(): Promise<RetryPolicy>;
    insert(row: InsertEmailOutbox): Promise<number | null>;
    escalate: OutboxDeps["escalate"];
  } | null = null,
): Promise<void> {
  const d = deps ?? (await realQueueDeps());
  const policy = await d.policy();
  const error = a.error ?? "send failed";
  const errorClass = classifyDeliveryError(error);
  const next = decideAfterFailure({ attempts: 1, errorClass, policy, now: d.now() });
  const abandon = next.action === "abandon";
  const id = await d.insert({
    kind: a.kind,
    messageType: a.messageType,
    recipient: a.recipient,
    subject: a.subject,
    relatedRef: a.relatedRef,
    // Content is kept only while a retry is still planned.
    payload: abandon ? null : JSON.stringify(a.payload),
    status: abandon ? "abandoned" : "queued",
    attempts: 1,
    maxAttempts: policy.maxAttempts,
    nextAttemptAt: next.action === "retry" ? new Date(next.nextAttemptAt) : null,
    lastError: error.slice(0, 1000),
    lastErrorClass: errorClass,
    abandonReason: next.action === "abandon" ? next.reason : null,
  });
  if (id !== null && next.action === "abandon") {
    await d.escalate({ row: { id, messageType: a.messageType, recipient: a.recipient, relatedRef: a.relatedRef }, attempts: 1, reason: next.reason, error });
  }
}

async function realQueueDeps() {
  const [ob, real] = await Promise.all([import("./db/emailOutbox"), realDeps()]);
  return { now: () => Date.now(), policy: ob.readEmailRetryPolicy, insert: ob.insertEmailOutbox, escalate: real.escalate };
}
