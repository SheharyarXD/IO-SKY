/**
 * Three-level identity policy for AI agents (task R10; 29 Oct Doc 1 Ch6.2 and
 * Appendix E.1: "AI Receptionist: three security levels and seven-step
 * verification"). Pure rules and a small state machine, with the clock passed in.
 *
 *   Level 1  public: general information, new prospect capture, public
 *            scheduling. Needs no identity and must never reveal private data.
 *   Level 2  verified and authorised: the caller's OWN invoices, balance, due
 *            dates, permitted project and account status, support requests.
 *            Needs a live verification bound to this interaction, this account
 *            and this organisation, covering the permission the operation needs.
 *   Level 3  sensitive or privileged: bank or payment details, contracts,
 *            financial authority, privileged account settings. The AI NEVER
 *            performs these, however verified the caller is: they go to the
 *            authenticated portal or an authorised person. Human transfer does
 *            not bypass authorisation.
 *
 * A recognised phone number, a spoken name or a company name never establishes
 * identity: nothing in this file accepts them as input. The AI receives only the
 * outcome and the permitted level (AgentIdentityView), never a credential.
 *
 * What produces a verification (the secure link to the registered email and the
 * portal sign-in with MFA or a passkey) is a separate task (R11). This file
 * decides what a verification result is worth and what it unlocks.
 */

export type IdentityLevel = 1 | 2 | 3;

export type VerificationState = "unverified" | "pending" | "verified" | "expired" | "failed" | "insufficient_permission";

export const VERIFICATION_RULES = {
  /** How long a started verification stays open for the customer to finish. */
  pendingTtlMs: 15 * 60_000,
  /** How long a completed verification lasts. */
  verifiedTtlMs: 30 * 60_000,
  /** New verification attempts allowed per window, so a caller cannot make the system spam an inbox. */
  maxStartsPerWindow: 3,
  startWindowMs: 15 * 60_000,
  /** Failed completions before the interaction is locked out. */
  maxFailures: 5,
  lockoutMs: 15 * 60_000,
  /** Used one-time tokens remembered per interaction, for replay protection. */
  maxRememberedNonces: 20,
} as const;

export type VerificationRecord = {
  /** What it is bound to: one conversation or call. A result for any other interaction is refused. */
  interactionRef: string;
  state: VerificationState;
  accountUserId: number | null;
  organizationId: number | null;
  /** Permissions the verified account actually holds for AI-assisted operations. */
  permissions: string[];
  pendingExpiresAt: number | null;
  verifiedExpiresAt: number | null;
  startedAt: number[];
  failures: number;
  lockedUntil: number | null;
  usedNonces: string[];
};

export function newVerification(interactionRef: string): VerificationRecord {
  return { interactionRef, state: "unverified", accountUserId: null, organizationId: null, permissions: [], pendingExpiresAt: null, verifiedExpiresAt: null, startedAt: [], failures: 0, lockedUntil: null, usedNonces: [] };
}

/** The state as of now: a pending or verified record past its time is expired. */
export function effectiveState(rec: VerificationRecord, now: number): VerificationState {
  if (rec.state === "verified" && (rec.verifiedExpiresAt === null || now >= rec.verifiedExpiresAt)) return "expired";
  if (rec.state === "pending" && (rec.pendingExpiresAt === null || now >= rec.pendingExpiresAt)) return "expired";
  return rec.state;
}

export type Transition<T = VerificationRecord> = { ok: true; record: T; audit: string } | { ok: false; record: VerificationRecord; reason: string; audit: string };

/** Begin a verification. Refused while locked out, while one is already open, or past the start limit. */
export function startVerification(rec: VerificationRecord, now: number): Transition {
  if (rec.lockedUntil !== null && now < rec.lockedUntil) return { ok: false, record: rec, reason: "locked_out", audit: "verification.start_refused:locked_out" };
  if (effectiveState(rec, now) === "pending") return { ok: false, record: rec, reason: "already_pending", audit: "verification.start_refused:already_pending" };
  const recent = rec.startedAt.filter((t) => now - t < VERIFICATION_RULES.startWindowMs);
  if (recent.length >= VERIFICATION_RULES.maxStartsPerWindow) return { ok: false, record: { ...rec, startedAt: recent }, reason: "rate_limited", audit: "verification.start_refused:rate_limited" };
  return {
    ok: true,
    audit: "verification.started",
    record: { ...rec, state: "pending", pendingExpiresAt: now + VERIFICATION_RULES.pendingTtlMs, verifiedExpiresAt: null, accountUserId: null, organizationId: null, permissions: [], startedAt: [...recent, now], lockedUntil: null },
  };
}

/** What the backend learned when the customer authenticated through the portal. */
export type VerificationResult = {
  /** One-time identifier of the verification link or sign-in. A second use is a replay. */
  nonce: string;
  /** The interaction the customer was verifying for. Must be the one this record is bound to. */
  interactionRef: string;
  accountUserId: number;
  organizationId: number;
  /** What the account may do; empty means authenticated but not authorised for AI-assisted operations. */
  permissions: string[];
};

export function completeVerification(rec: VerificationRecord, result: VerificationResult, now: number): Transition {
  const fail = (reason: string, countFailure: boolean, state: VerificationState = "failed"): Transition => {
    const failures = rec.failures + (countFailure ? 1 : 0);
    const locked = failures >= VERIFICATION_RULES.maxFailures ? now + VERIFICATION_RULES.lockoutMs : rec.lockedUntil;
    return { ok: false, reason, audit: `verification.completion_refused:${reason}`, record: { ...rec, state, failures, lockedUntil: locked, verifiedExpiresAt: null, accountUserId: null, organizationId: null, permissions: [] } };
  };
  if (rec.lockedUntil !== null && now < rec.lockedUntil) return { ok: false, record: rec, reason: "locked_out", audit: "verification.completion_refused:locked_out" };
  if (rec.usedNonces.includes(result.nonce)) return fail("replayed", true); // a reused link or sign-in
  const base: VerificationRecord = { ...rec, usedNonces: [...rec.usedNonces, result.nonce].slice(-VERIFICATION_RULES.maxRememberedNonces) };
  const failWith = (reason: string, count: boolean, state?: VerificationState) => {
    const t = fail(reason, count, state);
    return { ...t, record: { ...t.record, usedNonces: base.usedNonces } } as Transition;
  };
  if (effectiveState(rec, now) !== "pending") return failWith(rec.state === "pending" ? "expired" : "not_started", true, effectiveState(rec, now) === "expired" ? "expired" : "failed");
  if (result.interactionRef !== rec.interactionRef) return failWith("wrong_interaction", true);
  if (result.permissions.length === 0) return failWith("no_permission", false, "insufficient_permission");
  return {
    ok: true,
    audit: "verification.completed",
    record: { ...base, state: "verified", accountUserId: result.accountUserId, organizationId: result.organizationId, permissions: [...new Set(result.permissions)], pendingExpiresAt: null, verifiedExpiresAt: now + VERIFICATION_RULES.verifiedTtlMs, failures: 0, lockedUntil: null },
  };
}

/** A relevant security event (password or MFA reset, sign-out everywhere, account suspension) voids a verification at once. */
export function invalidateVerification(rec: VerificationRecord, reason: string): Transition {
  return { ok: true, audit: `verification.invalidated:${reason}`, record: { ...rec, state: "unverified", accountUserId: null, organizationId: null, permissions: [], pendingExpiresAt: null, verifiedExpiresAt: null } };
}

// ---------------------------------------------------------------------------
// What the AI sees, and what an operation needs
// ---------------------------------------------------------------------------

/**
 * The only identity information an agent receives: the outcome and the level it
 * unlocks. No account credentials, tokens or nonces. `expiresAt` lets the runtime
 * re-check the clock on every call.
 */
export type AgentIdentityView = {
  state: VerificationState;
  organizationId: number | null;
  permissions: string[];
  expiresAt: number | null;
  /** The highest level this verification may unlock for the AI: 2 when verified, otherwise 1. Never 3. */
  level: 1 | 2;
};

export function toAgentView(rec: VerificationRecord, now: number): AgentIdentityView {
  const state = effectiveState(rec, now);
  const verified = state === "verified";
  return { state, organizationId: verified ? rec.organizationId : null, permissions: verified ? [...rec.permissions] : [], expiresAt: verified ? rec.verifiedExpiresAt : null, level: verified ? 2 : 1 };
}

export type OperationRequirement = {
  level: IdentityLevel;
  /** For level 2: the account permission the operation needs, e.g. "read_own_invoices". */
  permission?: string;
  /** For level 2: true when the operation touches an organisation's data. */
  organizationScoped?: boolean;
};

export type OperationDecision =
  | { allowed: true }
  | { allowed: false; reason: "verification_required" | "verification_pending" | "verification_expired" | "verification_failed" | "insufficient_permission" | "organization_mismatch" | "ai_cannot_perform"; next: "start_verification" | "wait" | "retry_verification" | "portal_or_human" | "none" };

/** Decide whether an agent run may perform an operation, given the identity it was handed. */
export function authorizeOperation(op: OperationRequirement, identity: AgentIdentityView | null | undefined, ctx: { organizationId: number | null }, now: number): OperationDecision {
  if (op.level === 1) return { allowed: true };
  if (op.level === 3) return { allowed: false, reason: "ai_cannot_perform", next: "portal_or_human" };

  const state = identity ? (identity.state === "verified" && (identity.expiresAt === null || now >= identity.expiresAt) ? "expired" : identity.state) : "unverified";
  switch (state) {
    case "verified":
      break;
    case "pending":
      return { allowed: false, reason: "verification_pending", next: "wait" };
    case "expired":
      return { allowed: false, reason: "verification_expired", next: "start_verification" };
    case "failed":
      return { allowed: false, reason: "verification_failed", next: "retry_verification" };
    case "insufficient_permission":
      return { allowed: false, reason: "insufficient_permission", next: "portal_or_human" };
    default:
      return { allowed: false, reason: "verification_required", next: "start_verification" };
  }
  if (!identity || identity.permissions.length === 0) return { allowed: false, reason: "insufficient_permission", next: "portal_or_human" };
  if (op.permission && !identity.permissions.includes(op.permission)) return { allowed: false, reason: "insufficient_permission", next: "portal_or_human" };
  // The verified account's organisation must be the organisation this run is serving.
  if (op.organizationScoped !== false && (identity.organizationId === null || identity.organizationId !== ctx.organizationId)) return { allowed: false, reason: "organization_mismatch", next: "none" };
  return { allowed: true };
}
