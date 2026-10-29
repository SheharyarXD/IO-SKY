/**
 * Task reassignment and developer replacement (task J04; SRS 15.x; 29 Oct Doc 2 s20).
 * Pure rules for moving work between developers without losing the record of who
 * held it. Nothing is deleted: a released assignment stays as a row, and every
 * change appends an event naming the actor and the reason.
 *
 *  - Finished work stays with the person who did it. A done task is never moved.
 *  - Unfinished work moves to the replacement with its status and content intact.
 *  - A removed developer loses access to the project's tasks immediately (BR-018),
 *    including the finished ones; the history is what remembers them.
 *  - The person moved TO must be on the task's project; work is never leaked to
 *    someone outside it.
 *  - Every move needs a stated reason, because the record is what a client or
 *    auditor will ask about later.
 */

export const ASSIGNMENT_EVENTS = ["assigned", "released", "reassigned_out", "reassigned_in", "replaced_out", "replaced_in"] as const;
export type AssignmentEvent = (typeof ASSIGNMENT_EVENTS)[number];

export const REASON_MIN = 3;
export const REASON_MAX = 500;

export const cleanReason = (r: string | null | undefined): string => (r ?? "").replace(/\s+/g, " ").trim().slice(0, REASON_MAX);
/** At least REASON_MIN real characters: spaces do not count, so "a b" is not a reason. */
export const hasReason = (r: string | null | undefined): boolean => cleanReason(r).replace(/\s/g, "").length >= REASON_MIN;

export type ReassignRefusal = "same_developer" | "reason_required" | "task_done" | "from_not_assigned" | "to_not_on_project";

export function planReassignment(a: { taskStatus: string; fromDeveloperId: number; toDeveloperId: number; fromHoldsTask: boolean; toOnProject: boolean; reason: string | null | undefined }): { ok: true } | { ok: false; reason: ReassignRefusal } {
  if (a.fromDeveloperId === a.toDeveloperId) return { ok: false, reason: "same_developer" };
  if (!hasReason(a.reason)) return { ok: false, reason: "reason_required" };
  if (a.taskStatus === "done") return { ok: false, reason: "task_done" };
  if (!a.fromHoldsTask) return { ok: false, reason: "from_not_assigned" };
  if (!a.toOnProject) return { ok: false, reason: "to_not_on_project" };
  return { ok: true };
}

export type ReplaceRefusal = "same_developer" | "reason_required" | "outgoing_not_on_project";

export type HeldTask = { taskId: number; status: string };

/**
 * What a replacement does with the outgoing developer's tasks: every active task
 * assignment is released (BR-018), and those not done are given to the incoming developer.
 */
export function planReplacement(a: { outgoingDeveloperId: number; incomingDeveloperId: number; outgoingOnProject: boolean; heldTasks: HeldTask[]; reason: string | null | undefined }):
  | { ok: true; release: number[]; transfer: number[]; stayWithOutgoing: number[] }
  | { ok: false; reason: ReplaceRefusal } {
  if (a.outgoingDeveloperId === a.incomingDeveloperId) return { ok: false, reason: "same_developer" };
  if (!hasReason(a.reason)) return { ok: false, reason: "reason_required" };
  if (!a.outgoingOnProject) return { ok: false, reason: "outgoing_not_on_project" };
  const release = a.heldTasks.map((t) => t.taskId);
  const transfer = a.heldTasks.filter((t) => t.status !== "done").map((t) => t.taskId);
  const stayWithOutgoing = a.heldTasks.filter((t) => t.status === "done").map((t) => t.taskId);
  return { ok: true, release, transfer, stayWithOutgoing };
}

export const REFUSAL_TEXT: Record<ReassignRefusal | ReplaceRefusal, string> = {
  same_developer: "Choose a different developer.",
  reason_required: "Say why the work is being moved. The reason is kept in the history.",
  task_done: "A finished task stays with the person who did it.",
  from_not_assigned: "That developer does not currently hold this task.",
  to_not_on_project: "Assign the developer to the project before giving them its work.",
  outgoing_not_on_project: "That developer is not currently on this project.",
};
