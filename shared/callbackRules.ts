/**
 * Callback task lifecycle (task R21; SRS 17.11, 19.22; 29 Oct Ch6.3, F-06).
 * Pure rules, with the clock passed in. A callback is a promise to phone someone
 * back. It is created (by the receptionist when a transfer fails or a caller asks,
 * or by staff), assigned, attempted, and ends completed, unreachable or cancelled.
 * If nobody has done it by its due time it is announced, and if it is still open an
 * hour later it is escalated, so a promised callback cannot be forgotten.
 *
 * DECISION (engineering, to be matched against the client document):
 *   - due 120 minutes after creation for a normal callback, 30 for an urgent one;
 *   - up to 3 missed attempts (no answer or busy); the third ends the task as unreachable
 *     and says so, rather than leaving it open forever;
 *   - a missed attempt schedules the next try 4 hours later unless staff choose a time;
 *   - overdue: first notice when the due time passes, escalation 60 minutes later;
 *   - completing needs a note and cancelling needs a reason, so the record explains itself.
 */

export const CALLBACK_STATUSES = ["requested", "assigned", "attempted", "completed", "unreachable", "cancelled"] as const;
export type CallbackStatus = (typeof CALLBACK_STATUSES)[number];

export const TERMINAL_STATUSES: readonly CallbackStatus[] = ["completed", "unreachable", "cancelled"];
export const isTerminal = (s: string): boolean => (TERMINAL_STATUSES as readonly string[]).includes(s);

export const CALLBACK_RULES = {
  dueMinutes: { normal: 120, urgent: 30 },
  maxAttempts: 3,
  retryAfterMinutes: 240,
  escalateAfterMinutes: 60,
  maxReasonLength: 500,
} as const;

export type Priority = "normal" | "urgent";
export const ATTEMPT_RESULTS = ["no_answer", "busy", "call_back_later"] as const;
export type AttemptResult = (typeof ATTEMPT_RESULTS)[number];

export type CallbackState = {
  status: CallbackStatus;
  assignedToUserId: number | null;
  attempts: number;
  dueAt: Date;
  escalationLevel: number;
};

export function initialDueAt(priority: Priority, now: Date): Date {
  return new Date(now.getTime() + CALLBACK_RULES.dueMinutes[priority] * 60_000);
}

/** Digits only, with a leading + kept; 7 to 15 digits. Returns null for anything that cannot be dialled. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  const digits = t.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (/[a-z]/i.test(t)) return null;
  return (t.startsWith("+") || t.startsWith("00") ? "+" : "") + (t.startsWith("00") ? digits.slice(2) : digits);
}

export type Action =
  | { type: "assign"; userId: number | null }
  | { type: "attempt"; result: AttemptResult; newDueAt?: Date | null }
  | { type: "complete"; note: string }
  | { type: "cancel"; reason: string };

export type Refusal = "already_closed" | "note_required" | "reason_required" | "due_time_required" | "due_time_in_past" | "unknown_action";

export type Transition = { ok: true; next: CallbackState; event: string; detail: string | null } | { ok: false; reason: Refusal };

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export function applyAction(state: CallbackState, action: Action, actorUserId: number, now: Date): Transition {
  if (isTerminal(state.status)) return { ok: false, reason: "already_closed" };
  switch (action.type) {
    case "assign": {
      const status: CallbackStatus = action.userId === null ? (state.attempts > 0 ? "attempted" : "requested") : state.attempts > 0 ? "attempted" : "assigned";
      return { ok: true, next: { ...state, assignedToUserId: action.userId, status }, event: action.userId === null ? "callback.unassigned" : "callback.assigned", detail: action.userId === null ? null : `user ${action.userId}` };
    }
    case "attempt": {
      const attempts = state.attempts + 1;
      if (action.result === "call_back_later") {
        if (!action.newDueAt) return { ok: false, reason: "due_time_required" };
        if (action.newDueAt.getTime() <= now.getTime()) return { ok: false, reason: "due_time_in_past" };
        // The caller was reached and asked for another time: that is not a missed attempt, so it does not count toward unreachable.
        return { ok: true, next: { ...state, status: "attempted", assignedToUserId: state.assignedToUserId ?? actorUserId, dueAt: action.newDueAt, escalationLevel: 0 }, event: "callback.attempted", detail: `${action.result}; reached the caller` };
      }
      if (attempts >= CALLBACK_RULES.maxAttempts) {
        return { ok: true, next: { ...state, status: "unreachable", attempts, assignedToUserId: state.assignedToUserId ?? actorUserId }, event: "callback.unreachable", detail: `${action.result}; attempt ${attempts} of ${CALLBACK_RULES.maxAttempts}` };
      }
      const due = action.newDueAt && action.newDueAt.getTime() > now.getTime() ? action.newDueAt : new Date(now.getTime() + CALLBACK_RULES.retryAfterMinutes * 60_000);
      return { ok: true, next: { ...state, status: "attempted", attempts, assignedToUserId: state.assignedToUserId ?? actorUserId, dueAt: due, escalationLevel: 0 }, event: "callback.attempted", detail: `${action.result}; attempt ${attempts}` };
    }
    case "complete": {
      if (clean(action.note).length < 3) return { ok: false, reason: "note_required" };
      return { ok: true, next: { ...state, status: "completed", assignedToUserId: state.assignedToUserId ?? actorUserId }, event: "callback.completed", detail: clean(action.note).slice(0, 300) };
    }
    case "cancel": {
      if (clean(action.reason).length < 3) return { ok: false, reason: "reason_required" };
      return { ok: true, next: { ...state, status: "cancelled" }, event: "callback.cancelled", detail: clean(action.reason).slice(0, 300) };
    }
    default:
      return { ok: false, reason: "unknown_action" };
  }
}

export const REFUSAL_TEXT: Record<Refusal, string> = {
  already_closed: "This callback is already closed.",
  note_required: "Say what happened on the call.",
  reason_required: "Say why this callback is being cancelled.",
  due_time_required: "Choose the time the caller asked to be called back.",
  due_time_in_past: "The callback time must be in the future.",
  unknown_action: "Unknown action.",
};

// ---------------------------------------------------------------------------
// overdue and escalation
// ---------------------------------------------------------------------------

export function isOverdue(state: Pick<CallbackState, "status" | "dueAt">, now: Date): boolean {
  return !isTerminal(state.status) && now.getTime() >= state.dueAt.getTime();
}

/**
 * The escalation level that should be announced now, or null when nothing new is due. Level 1 is the first
 * notice once the due time passes; level 2 is the escalation an hour later. Each level is announced once:
 * a level at or below what was already announced is never returned.
 */
export function escalationToAnnounce(state: Pick<CallbackState, "status" | "dueAt" | "escalationLevel">, now: Date): 1 | 2 | null {
  if (!isOverdue(state, now)) return null;
  const overdueMin = (now.getTime() - state.dueAt.getTime()) / 60_000;
  const level = overdueMin >= CALLBACK_RULES.escalateAfterMinutes ? 2 : 1;
  return level > state.escalationLevel ? level : null;
}
