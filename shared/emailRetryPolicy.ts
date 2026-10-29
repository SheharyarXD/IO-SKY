/**
 * Retry policy for failed email deliveries (task N03, SRS 17.11 "Retry failed
 * deliveries according to configurable policies", 29 Oct Doc 1 Ch15 "visible
 * failure and retry states").
 *
 * Pure rules, no clock and no I/O. The worker passes `now`. A send that the
 * provider ACCEPTED is not covered here: acceptance is not proof of inbox
 * delivery (F-31) and is tracked from provider events, not retried.
 *
 * attempts = how many sends have been made so far. The first failed send is
 * attempt 1.
 */

export type ErrorClass = "transient" | "permanent";

export type RetryPolicy = {
  /** Total sends allowed, including the first. */
  maxAttempts: number;
  baseDelayMs: number;
  factor: number;
  maxDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 5 * 60_000,
  factor: 3,
  maxDelayMs: 6 * 3600_000,
};

/** Platform setting keys that configure the policy (validated in shared/srsRules.ts). */
export const RETRY_SETTING_KEYS = {
  maxAttempts: "notifications.email_retry_max_attempts",
  baseMinutes: "notifications.email_retry_base_minutes",
  maxDelayMinutes: "notifications.email_retry_max_delay_minutes",
} as const;

function positiveInt(v: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number((v ?? "").trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/** Build a policy from stored setting values; anything missing or out of range falls back to the default. */
export function policyFromSettings(values: Record<string, string | undefined>): RetryPolicy {
  const base = positiveInt(values[RETRY_SETTING_KEYS.baseMinutes], DEFAULT_RETRY_POLICY.baseDelayMs / 60_000, 1, 1440);
  const max = positiveInt(values[RETRY_SETTING_KEYS.maxDelayMinutes], DEFAULT_RETRY_POLICY.maxDelayMs / 60_000, 5, 10_080);
  return {
    maxAttempts: positiveInt(values[RETRY_SETTING_KEYS.maxAttempts], DEFAULT_RETRY_POLICY.maxAttempts, 1, 10),
    baseDelayMs: base * 60_000,
    factor: DEFAULT_RETRY_POLICY.factor,
    maxDelayMs: Math.max(max, base) * 60_000,
  };
}

/**
 * Will sending the same message again help? A bad recipient, a malformed
 * request or a rejected credential will fail identically every time, so those
 * go straight to a human. Timeouts, throttling, provider 5xx and temporary SMTP
 * (4xx) codes are worth retrying. An error we cannot read is retried (bounded
 * by maxAttempts) rather than dropped.
 */
export function classifyDeliveryError(error: string | null | undefined): ErrorClass {
  const e = (error ?? "").toLowerCase();
  if (!e) return "transient";
  const resend = e.match(/resend (\d{3})/);
  if (resend) {
    const code = Number(resend[1]);
    if (code === 408 || code === 409 || code === 425 || code === 429 || code >= 500) return "transient";
    return "permanent"; // 400, 401, 403, 404, 422 ...
  }
  if (/\b(421|450|451|452|454)\b/.test(e) || /\b4\.\d\.\d\b/.test(e)) return "transient";
  if (/\b(550|551|552|553|554|555)\b/.test(e) || /\b5\.\d\.\d\b/.test(e)) return "permanent";
  if (/(user unknown|no such user|mailbox (unavailable|not found|does not exist)|invalid (recipient|address)|address rejected|does not exist|recipient rejected)/.test(e)) return "permanent";
  if (/(invalid login|authentication failed|invalid api key|unauthorized|forbidden)/.test(e)) return "permanent";
  return "transient"; // timeouts, ECONNRESET, ENOTFOUND, "fetch failed", unknown text
}

/** Wait before the next send, after `attempts` sends have failed. */
export function retryDelayMs(attempts: number, policy: RetryPolicy): number {
  const n = Math.max(1, Math.floor(attempts));
  return Math.min(policy.baseDelayMs * Math.pow(policy.factor, n - 1), policy.maxDelayMs);
}

export type AfterFailure =
  | { action: "retry"; nextAttemptAt: number }
  | { action: "abandon"; reason: "permanent" | "exhausted" };

export function decideAfterFailure(args: { attempts: number; errorClass: ErrorClass; policy: RetryPolicy; now: number }): AfterFailure {
  if (args.errorClass === "permanent") return { action: "abandon", reason: "permanent" };
  if (args.attempts >= args.policy.maxAttempts) return { action: "abandon", reason: "exhausted" };
  return { action: "retry", nextAttemptAt: args.now + retryDelayMs(args.attempts, args.policy) };
}

/** a***@example.com: enough to recognise the mailbox in an admin alert without printing the full address. */
export function maskRecipient(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "***";
  return `${address[0]}***${address.slice(at)}`;
}
