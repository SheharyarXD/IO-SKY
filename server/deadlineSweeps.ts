/**
 * Deadline sweeps for catalogue notifications (task N02). Runs on the operations
 * tick beside the payment reminders. Each pass finds items whose deadline has just
 * arrived (shared/deadlineRules.ts) and raises the catalogue event once per
 * occurrence through the dispatcher, which de-duplicates, so overlapping passes
 * and several server instances cannot announce the same item twice.
 *
 * Recipients are explicit (Functional Specification 37): follow-ups go to the
 * admin feed, because the CRM has no single owner field to resolve a person
 * from; a missed task deadline goes to the admin feed and to each developer
 * actively assigned to that task. The text names the task or follow-up by its
 * title only, with no client detail.
 */
import { and, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { crmActivities, developerTaskAssignments, developerTasks } from "../drizzle/schema";
import { DEADLINE_LOOKBACK_MS, followUpIsDue, followUpRef, taskDeadlineMissed, taskDeadlineRef } from "../shared/deadlineRules";
import { getDb } from "./db/connection";
import type { Audience, EmitResult } from "./notificationDispatcher";

export type DueFollowUp = { id: number; subject: string; dueAt: Date; completedAt: Date | null; kind: string; leadId: number | null };
export type MissedTask = { taskId: number; title: string; status: string; dueMs: number; developerId: number | null };

export type SweepDeps = {
  listFollowUps(sinceMs: number, nowMs: number): Promise<DueFollowUp[]>;
  listTasks(sinceMs: number, nowMs: number): Promise<MissedTask[]>;
  emit(a: { event: string; audience: Audience; dedupeRef: string; title: string; href: string; skipAdminFeed?: boolean }): Promise<EmitResult>;
};

export type SweepSummary = { followUps: number; taskDeadlines: number };

export async function runDeadlineSweeps(deps: SweepDeps, nowMs: number = Date.now()): Promise<SweepSummary> {
  const summary: SweepSummary = { followUps: 0, taskDeadlines: 0 };

  for (const f of await deps.listFollowUps(nowMs - DEADLINE_LOOKBACK_MS.followUp, nowMs)) {
    if (!followUpIsDue(f, nowMs)) continue; // the rule decides; the query only narrows
    const r = await deps.emit({ event: "DISCOVERY_CALL_FOLLOW_UP_DUE", audience: { type: "admin" }, dedupeRef: followUpRef(f.id, f.dueAt), title: `Follow-up due: ${f.subject}`.slice(0, 200), href: f.leadId ? "/admin/crm" : "/admin" });
    if (r.delivered) summary.followUps++;
  }

  const seenAdmin = new Set<string>();
  for (const t of await deps.listTasks(nowMs - DEADLINE_LOOKBACK_MS.task, nowMs)) {
    if (!taskDeadlineMissed(t, nowMs)) continue;
    const ref = taskDeadlineRef(t.taskId, t.dueMs);
    const title = `Deadline missed: ${t.title}`.slice(0, 200);
    if (!seenAdmin.has(ref)) {
      seenAdmin.add(ref); // a task with two assignees yields two rows; the admin feed hears once
      const r = await deps.emit({ event: "PROJECT_DEADLINE_MISSED", audience: { type: "admin" }, dedupeRef: ref, title, href: "/admin/delivery" });
      if (r.delivered) summary.taskDeadlines++;
    }
    if (t.developerId !== null) await deps.emit({ event: "PROJECT_DEADLINE_MISSED", audience: { type: "developer", developerId: t.developerId }, dedupeRef: ref, title, href: "/developer-workspace/tasks" });
  }
  return summary;
}

/** The sweep against the real database. Quiet no-op without one. */
export async function runRealDeadlineSweeps(nowMs: number = Date.now()): Promise<SweepSummary> {
  const db = await getDb();
  if (!db) return { followUps: 0, taskDeadlines: 0 };
  const { emitNotification } = await import("./notificationDispatcher");
  return runDeadlineSweeps(
    {
      listFollowUps: async (since, now) =>
        (await db
          .select({ id: crmActivities.id, subject: crmActivities.subject, dueAt: crmActivities.dueAt, completedAt: crmActivities.completedAt, kind: crmActivities.kind, leadId: crmActivities.leadId })
          .from(crmActivities)
          .where(and(eq(crmActivities.kind, "follow_up"), isNull(crmActivities.completedAt), gte(crmActivities.dueAt, new Date(since)), lte(crmActivities.dueAt, new Date(now))))
          .limit(200)) as DueFollowUp[],
      listTasks: async (since, now) =>
        (await db
          .select({ taskId: developerTasks.id, title: developerTasks.title, status: developerTasks.status, dueMs: developerTasks.dueMs, developerId: developerTaskAssignments.developerId })
          .from(developerTasks)
          .leftJoin(developerTaskAssignments, and(eq(developerTaskAssignments.taskId, developerTasks.id), eq(developerTaskAssignments.status, "active")))
          .where(and(ne(developerTasks.status, "done"), gte(developerTasks.dueMs, since), lte(developerTasks.dueMs, now)))
          .limit(500)) as MissedTask[],
      emit: emitNotification,
    },
    nowMs,
  );
}
