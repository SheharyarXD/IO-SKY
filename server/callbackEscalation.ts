/**
 * The overdue-callback escalator (task R21). Runs on the operations tick beside the
 * other deadline sweeps. For every open callback past its due time it announces the
 * next escalation level once: level 1 when the due time passes, level 2 an hour
 * later. `record` claims the level in the database, so overlapping passes and
 * several server instances announce it once.
 *
 * Notifications carry the callback's number and the caller's first name only: the
 * phone number and the reason stay in the staff screen, not in notification text.
 */
import { escalationToAnnounce, type CallbackStatus } from "../shared/callbackRules";
import type { Audience, EmitResult } from "./notificationDispatcher";

export type OverdueRow = { id: number; callerName: string | null; status: string; dueAt: Date; escalationLevel: number; priority: string };

export type EscalationDeps = {
  listOverdue(now: Date): Promise<OverdueRow[]>;
  record(id: number, level: 1 | 2): Promise<boolean>;
  emit(a: { event: string; audience: Audience; dedupeRef: string; title: string; body?: string; href: string }): Promise<EmitResult>;
};

export function firstName(name: string | null): string {
  const f = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return f.length > 0 ? f.slice(0, 40) : "a caller";
}

export async function runCallbackEscalation(deps: EscalationDeps, now: Date = new Date()): Promise<{ firstNotices: number; escalations: number }> {
  const out = { firstNotices: 0, escalations: 0 };
  for (const row of await deps.listOverdue(now)) {
    const level = escalationToAnnounce({ status: row.status as CallbackStatus, dueAt: row.dueAt, escalationLevel: row.escalationLevel }, now);
    if (level === null) continue;
    if (!(await deps.record(row.id, level))) continue; // another pass or instance announced it
    const who = firstName(row.callerName);
    if (level === 1) {
      await deps.emit({ event: "DISCOVERY_CALL_FOLLOW_UP_DUE", audience: { type: "admin" }, dedupeRef: `callback:${row.id}:level1`, title: `Callback due: ${who} (CB-${row.id})`, href: "/admin/crm" });
      out.firstNotices++;
    } else {
      await deps.emit({ event: "DISCOVERY_CALL_ACTION_REQUIRED", audience: { type: "admin" }, dedupeRef: `callback:${row.id}:level2`, title: `Callback overdue by an hour: ${who} (CB-${row.id})`, body: "Someone promised this caller a callback and it has not happened.", href: "/admin/crm" });
      out.escalations++;
    }
  }
  return out;
}

export async function runRealCallbackEscalation(now: Date = new Date()) {
  const [{ listOverdueCallbacks, recordEscalation }, { emitNotification }] = await Promise.all([import("./db/callbacks"), import("./notificationDispatcher")]);
  return runCallbackEscalation(
    {
      listOverdue: async (n) => (await listOverdueCallbacks(n)).map((r) => ({ id: r.id, callerName: r.callerName, status: r.status, dueAt: r.dueAt, escalationLevel: r.escalationLevel, priority: r.priority })),
      record: (id, level) => recordEscalation(id, level, now),
      emit: emitNotification,
    },
    now,
  );
}
