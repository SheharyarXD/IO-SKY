/**
 * Deadline and lifecycle triggers for catalogue notifications (task N02; SRS 17.11).
 * Pure rules for three events whose trigger already exists in the platform's data:
 *
 *   DC-08 DISCOVERY_CALL_FOLLOW_UP_DUE   a CRM follow-up's due time is reached and it is not completed;
 *   PD-07 PROJECT_DEADLINE_MISSED        a task's deadline passes while the task is not done;
 *   PD-13 PROJECT_BLOCKER_RESOLVED       a task leaves the "blocked" status.
 *
 * A sweep only looks back a limited time. Without that, the first run on a
 * database with old overdue items would notify about all of them at once. An item
 * older than the window is simply not announced; it stays visible where it lives.
 * Each occurrence is announced once (the dispatcher de-duplicates on the ref).
 */

export const DEADLINE_LOOKBACK_MS = {
  followUp: 14 * 24 * 3600_000,
  task: 7 * 24 * 3600_000,
} as const;

export type FollowUpLike = { kind: string; dueAt: Date | null; completedAt: Date | null };

/** A follow-up is due when it has a due time that has arrived, within the lookback, and nobody completed it. */
export function followUpIsDue(a: FollowUpLike, nowMs: number): boolean {
  if (a.kind !== "follow_up" || !a.dueAt || a.completedAt) return false;
  const due = a.dueAt.getTime();
  return due <= nowMs && nowMs - due <= DEADLINE_LOOKBACK_MS.followUp;
}

export type TaskLike = { status: string; dueMs: number | null };

/** A deadline is missed when it has passed, within the lookback, while the task is not done. */
export function taskDeadlineMissed(t: TaskLike, nowMs: number): boolean {
  if (t.dueMs === null || t.status === "done") return false;
  return t.dueMs <= nowMs && nowMs - t.dueMs <= DEADLINE_LOOKBACK_MS.task;
}

/** A blocker is resolved only by moving OUT of blocked; a repeated "blocked" or any other change is not a resolution. */
export function blockerResolved(previous: string | null | undefined, next: string): boolean {
  return previous === "blocked" && next !== "blocked";
}

/** What counts as the same occurrence. A task whose deadline moves and is missed again is a new occurrence. */
export const followUpRef = (activityId: number, dueAt: Date) => `followup:${activityId}:${dueAt.getTime()}`;
export const taskDeadlineRef = (taskId: number, dueMs: number) => `task:${taskId}:deadline:${dueMs}`;
/** Resolution is per blocking episode; the hour bucket matches how the blocker itself is de-duplicated. */
export const blockerResolvedRef = (taskId: number, nowMs: number) => `task:${taskId}:unblocked:${Math.floor(nowMs / 3_600_000)}`;
