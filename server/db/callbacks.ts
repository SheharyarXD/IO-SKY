/**
 * server/db/callbacks.ts (task R21). Persistence for callback tasks. The lifecycle rules (what each action
 * does, attempt limits, due times, escalation levels) are in shared/callbackRules.ts; this file reads the
 * facts, asks the rules, and writes the result and its history event in one transaction.
 */
import { and, asc, desc, eq, inArray, lte, notInArray } from "drizzle-orm";
import { callbackTaskEvents, callbackTasks, users, type CallbackTask } from "../../drizzle/schema";
import { canOwnLeads } from "../../shared/leadOwnership";
import { applyAction, initialDueAt, isTerminal, normalizePhone, TERMINAL_STATUSES, type Action, type CallbackStatus, type Priority, type Refusal } from "../../shared/callbackRules";
import { getDb } from "./connection";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function event(tx: Tx, taskId: number, name: string, actorUserId: number | null, detail: string | null) {
  await tx.insert(callbackTaskEvents).values({ taskId, event: name.slice(0, 40), actorUserId, detail: detail?.slice(0, 300) ?? null });
}

export type CreateResult = { ok: true; task: CallbackTask; duplicate: boolean } | { ok: false; reason: "invalid_phone" | "unavailable" };

/**
 * Create a callback. If the same phone number already has an OPEN callback, that one is returned instead of
 * a second: a repeat caller must not turn into two promises.
 */
export async function createCallback(a: {
  leadId: number | null;
  organizationId: number | null;
  callerName: string | null;
  callerPhone: string;
  reason: string;
  source: "ai_receptionist" | "transfer_failed" | "manual";
  priority: Priority;
  createdByUserId: number | null;
  now?: Date;
}): Promise<CreateResult> {
  const phone = normalizePhone(a.callerPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  const now = a.now ?? new Date();
  return db.transaction(async (tx): Promise<CreateResult> => {
    const existing = (await tx.select().from(callbackTasks).where(and(eq(callbackTasks.callerPhone, phone), notInArray(callbackTasks.status, [...TERMINAL_STATUSES]))).orderBy(desc(callbackTasks.id)).limit(1))[0];
    if (existing) {
      await event(tx, existing.id, "callback.repeat_request", a.createdByUserId, `again via ${a.source}`);
      return { ok: true, task: existing, duplicate: true };
    }
    const task = (
      await tx
        .insert(callbackTasks)
        .values({ leadId: a.leadId, organizationId: a.organizationId, callerName: a.callerName?.slice(0, 200) ?? null, callerPhone: phone, reason: a.reason.slice(0, 500), source: a.source, priority: a.priority, status: "requested", dueAt: initialDueAt(a.priority, now), createdByUserId: a.createdByUserId })
        .returning()
    )[0];
    await event(tx, task.id, "callback.created", a.createdByUserId, `${a.source}; ${a.priority}`);
    return { ok: true, task, duplicate: false };
  });
}

/** True when the user exists and is an admin or super admin: the only people a callback can be assigned to. */
export async function isStaffUser(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const r = (await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1))[0];
  return canOwnLeads(r?.role);
}

export async function listCallbacks(a: { openOnly?: boolean; assignedToUserId?: number; limit?: number } = {}): Promise<CallbackTask[]> {
  const db = await getDb();
  if (!db) return [];
  const conds = [];
  if (a.openOnly) conds.push(notInArray(callbackTasks.status, [...TERMINAL_STATUSES]));
  if (a.assignedToUserId) conds.push(eq(callbackTasks.assignedToUserId, a.assignedToUserId));
  return db
    .select()
    .from(callbackTasks)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(callbackTasks.dueAt))
    .limit(Math.min(a.limit ?? 200, 500));
}

export async function listCallbackEvents(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(callbackTaskEvents).where(eq(callbackTaskEvents.taskId, taskId)).orderBy(desc(callbackTaskEvents.createdAt), desc(callbackTaskEvents.id)).limit(200);
}

export type ActResult = { ok: true; task: CallbackTask } | { ok: false; reason: Refusal | "not_found" | "unavailable" };

/** Apply one action under a row lock, so two staff acting at once cannot both win. */
export async function actOnCallback(id: number, action: Action, actorUserId: number, now: Date = new Date()): Promise<ActResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  return db.transaction(async (tx): Promise<ActResult> => {
    const row = (await tx.select().from(callbackTasks).where(eq(callbackTasks.id, id)).for("update").limit(1))[0];
    if (!row) return { ok: false, reason: "not_found" };
    const t = applyAction({ status: row.status as CallbackStatus, assignedToUserId: row.assignedToUserId, attempts: row.attempts, dueAt: row.dueAt, escalationLevel: row.escalationLevel }, action, actorUserId, now);
    if (!t.ok) return { ok: false, reason: t.reason };
    const closing = isTerminal(t.next.status);
    const updated = (
      await tx
        .update(callbackTasks)
        .set({
          status: t.next.status,
          assignedToUserId: t.next.assignedToUserId,
          attempts: t.next.attempts,
          dueAt: t.next.dueAt,
          escalationLevel: t.next.escalationLevel,
          lastAttemptAt: action.type === "attempt" ? now : row.lastAttemptAt,
          outcomeNote: action.type === "complete" ? action.note.slice(0, 500) : action.type === "cancel" ? action.reason.slice(0, 500) : row.outcomeNote,
          closedAt: closing ? now : null,
          updatedAt: now,
        })
        .where(eq(callbackTasks.id, id))
        .returning()
    )[0];
    await event(tx, id, t.event, actorUserId, t.detail);
    return { ok: true, task: updated };
  });
}

/** Open callbacks whose due time has passed. */
export async function listOverdueCallbacks(now: Date, limit = 200): Promise<CallbackTask[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(callbackTasks)
    .where(and(notInArray(callbackTasks.status, [...TERMINAL_STATUSES]), lte(callbackTasks.dueAt, now)))
    .orderBy(asc(callbackTasks.dueAt))
    .limit(limit);
}

/**
 * Record that an escalation level was announced. The update only succeeds if the task has not already reached
 * this level, so two server instances running the sweep announce it once. Returns true for the one that won.
 */
export async function recordEscalation(id: number, level: 1 | 2, now: Date = new Date()): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(callbackTasks)
      .set({ escalationLevel: level, updatedAt: now })
      .where(and(eq(callbackTasks.id, id), inArray(callbackTasks.escalationLevel, level === 2 ? [0, 1] : [0]), notInArray(callbackTasks.status, [...TERMINAL_STATUSES])))
      .returning({ id: callbackTasks.id });
    if (rows.length === 0) return false;
    await event(tx, id, `callback.escalated_${level}`, null, level === 1 ? "due time reached" : "an hour overdue");
    return true;
  });
}
