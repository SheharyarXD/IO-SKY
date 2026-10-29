/*
 * N02 (SRS 17.11): three more catalogue events wired to triggers that already exist:
 * a CRM follow-up becomes due (DC-08), a task deadline is missed (PD-07) and a blocker
 * is resolved (PD-13). Database-free: the sweep is run against fake data.
 */
import { describe, expect, it } from "vitest";
import { getNotificationEventByName } from "../shared/notificationCatalogue";
import { blockerResolved, blockerResolvedRef, DEADLINE_LOOKBACK_MS, followUpIsDue, followUpRef, taskDeadlineMissed, taskDeadlineRef } from "../shared/deadlineRules";
import { runDeadlineSweeps, type DueFollowUp, type MissedTask, type SweepDeps } from "./deadlineSweeps";

const NOW = 1_800_000_000_000;
const H = 3_600_000;
const D = 24 * H;

describe("rules", () => {
  const fu = (over: Partial<{ kind: string; dueAt: Date | null; completedAt: Date | null }> = {}) => ({ kind: "follow_up", dueAt: new Date(NOW - H), completedAt: null, ...over });
  it("a follow-up is due once its time arrives, until the lookback ends", () => {
    expect(followUpIsDue(fu(), NOW)).toBe(true);
    expect(followUpIsDue(fu({ dueAt: new Date(NOW) }), NOW)).toBe(true);
    expect(followUpIsDue(fu({ dueAt: new Date(NOW + 1) }), NOW)).toBe(false);
    expect(followUpIsDue(fu({ dueAt: new Date(NOW - DEADLINE_LOOKBACK_MS.followUp) }), NOW)).toBe(true);
    expect(followUpIsDue(fu({ dueAt: new Date(NOW - DEADLINE_LOOKBACK_MS.followUp - 1) }), NOW)).toBe(false);
  });
  it("a completed, undated or non-follow-up activity is never due", () => {
    expect(followUpIsDue(fu({ completedAt: new Date(NOW - 1) }), NOW)).toBe(false);
    expect(followUpIsDue(fu({ dueAt: null }), NOW)).toBe(false);
    for (const kind of ["note", "call", "email", "meeting"]) expect(followUpIsDue(fu({ kind }), NOW), kind).toBe(false);
  });
  it("a task deadline is missed when it passes while the task is not done", () => {
    for (const status of ["planned", "in_progress", "blocked", "in_review"]) expect(taskDeadlineMissed({ status, dueMs: NOW - H }, NOW), status).toBe(true);
    expect(taskDeadlineMissed({ status: "done", dueMs: NOW - H }, NOW)).toBe(false);
    expect(taskDeadlineMissed({ status: "planned", dueMs: null }, NOW)).toBe(false);
    expect(taskDeadlineMissed({ status: "planned", dueMs: NOW + H }, NOW)).toBe(false);
    expect(taskDeadlineMissed({ status: "planned", dueMs: NOW - DEADLINE_LOOKBACK_MS.task - 1 }, NOW)).toBe(false);
  });
  it("a blocker is resolved only by leaving 'blocked'", () => {
    expect(blockerResolved("blocked", "in_progress")).toBe(true);
    expect(blockerResolved("blocked", "done")).toBe(true);
    expect(blockerResolved("blocked", "blocked")).toBe(false);
    expect(blockerResolved("planned", "in_progress")).toBe(false);
    expect(blockerResolved(undefined, "in_progress")).toBe(false);
    expect(blockerResolved(null, "planned")).toBe(false);
  });
  it("a moved deadline is a new occurrence, and refs are stable otherwise", () => {
    expect(taskDeadlineRef(5, NOW)).toBe(taskDeadlineRef(5, NOW));
    expect(taskDeadlineRef(5, NOW)).not.toBe(taskDeadlineRef(5, NOW + D));
    expect(followUpRef(9, new Date(NOW))).not.toBe(followUpRef(9, new Date(NOW + D)));
    expect(blockerResolvedRef(3, NOW)).toBe(blockerResolvedRef(3, NOW + 1000));
  });
});

describe("the catalogue entries these events use", () => {
  it("exist and are the ones the spec names", () => {
    expect(getNotificationEventByName("DISCOVERY_CALL_FOLLOW_UP_DUE")).toMatchObject({ id: "DC-08", family: "discovery_calls" });
    expect(getNotificationEventByName("PROJECT_DEADLINE_MISSED")).toMatchObject({ id: "PD-07", family: "projects_delivery" });
    expect(getNotificationEventByName("PROJECT_BLOCKER_RESOLVED")).toMatchObject({ id: "PD-13", family: "projects_delivery" });
  });
  it("are not client facing", () => {
    for (const n of ["DISCOVERY_CALL_FOLLOW_UP_DUE", "PROJECT_DEADLINE_MISSED", "PROJECT_BLOCKER_RESOLVED"]) expect(getNotificationEventByName(n)?.clientFacing, n).toMatch(/^No/);
  });
});

// ---------------------------------------------------------------------------

type Emit = Parameters<SweepDeps["emit"]>[0];
function harness(over: { followUps?: DueFollowUp[]; tasks?: MissedTask[]; duplicate?: boolean } = {}) {
  const emitted: Emit[] = [];
  const seen = new Set<string>();
  const queries: Array<[string, number, number]> = [];
  const deps: SweepDeps = {
    listFollowUps: async (since, now) => (queries.push(["followups", since, now]), over.followUps ?? []),
    listTasks: async (since, now) => (queries.push(["tasks", since, now]), over.tasks ?? []),
    emit: async (a) => {
      emitted.push(a);
      const key = `${a.event}|${a.audience.type}|${JSON.stringify(a.audience)}|${a.dedupeRef}`;
      if (seen.has(key)) return { delivered: false, reason: "duplicate" };
      seen.add(key);
      return { delivered: true, eventId: "x" };
    },
  };
  return { deps, emitted, queries };
}
const follow = (id: number, over: Partial<DueFollowUp> = {}): DueFollowUp => ({ id, subject: `Call back ${id}`, dueAt: new Date(NOW - H), completedAt: null, kind: "follow_up", leadId: 10, ...over });
const task = (taskId: number, over: Partial<MissedTask> = {}): MissedTask => ({ taskId, title: `Task ${taskId}`, status: "in_progress", dueMs: NOW - H, developerId: 100, ...over });

describe("the sweep", () => {
  it("announces a due follow-up to the admin feed, once", async () => {
    const h = harness({ followUps: [follow(1)] });
    expect(await runDeadlineSweeps(h.deps, NOW)).toEqual({ followUps: 1, taskDeadlines: 0 });
    expect(h.emitted[0]).toMatchObject({ event: "DISCOVERY_CALL_FOLLOW_UP_DUE", audience: { type: "admin" }, title: "Follow-up due: Call back 1", href: "/admin/crm" });
    // the next tick sees the same item and the dispatcher reports a duplicate
    expect(await runDeadlineSweeps(h.deps, NOW + 5 * 60_000)).toEqual({ followUps: 0, taskDeadlines: 0 });
  });
  it("trusts the rule, not the query: a completed or future item the query returned is ignored", async () => {
    const h = harness({ followUps: [follow(1, { completedAt: new Date(NOW - 1) }), follow(2, { dueAt: new Date(NOW + H) }), follow(3, { kind: "note" })], tasks: [task(1, { status: "done" }), task(2, { dueMs: NOW + H })] });
    expect(await runDeadlineSweeps(h.deps, NOW)).toEqual({ followUps: 0, taskDeadlines: 0 });
    expect(h.emitted).toHaveLength(0);
  });
  it("a missed deadline goes to the admin feed and to the assigned developer only", async () => {
    const h = harness({ tasks: [task(7, { developerId: 100 })] });
    expect(await runDeadlineSweeps(h.deps, NOW)).toEqual({ followUps: 0, taskDeadlines: 1 });
    expect(h.emitted.map((e) => e.audience)).toEqual([{ type: "admin" }, { type: "developer", developerId: 100 }]);
    expect(h.emitted.every((e) => e.event === "PROJECT_DEADLINE_MISSED")).toBe(true);
    expect(h.emitted[1].href).toBe("/developer-workspace/tasks");
  });
  it("two assignees: the admin feed hears once and each developer hears once", async () => {
    const h = harness({ tasks: [task(7, { developerId: 100 }), task(7, { developerId: 101 })] });
    await runDeadlineSweeps(h.deps, NOW);
    expect(h.emitted.filter((e) => e.audience.type === "admin")).toHaveLength(1);
    expect(h.emitted.filter((e) => e.audience.type === "developer").map((e) => (e.audience as { developerId: number }).developerId)).toEqual([100, 101]);
  });
  it("an unassigned task still reaches the admin feed and never a developer", async () => {
    const h = harness({ tasks: [task(8, { developerId: null })] });
    await runDeadlineSweeps(h.deps, NOW);
    expect(h.emitted.map((e) => e.audience.type)).toEqual(["admin"]);
  });
  it("asks only for the lookback window, so a first run on old data does not flood", async () => {
    const h = harness();
    await runDeadlineSweeps(h.deps, NOW);
    expect(h.queries).toEqual([["followups", NOW - DEADLINE_LOOKBACK_MS.followUp, NOW], ["tasks", NOW - DEADLINE_LOOKBACK_MS.task, NOW]]);
    const old = harness({ followUps: [follow(1, { dueAt: new Date(NOW - DEADLINE_LOOKBACK_MS.followUp - D) })], tasks: [task(1, { dueMs: NOW - DEADLINE_LOOKBACK_MS.task - D })] });
    await runDeadlineSweeps(old.deps, NOW);
    expect(old.emitted).toHaveLength(0);
  });
  it("a moved deadline that is missed again is announced again", async () => {
    const h = harness({ tasks: [task(7, { dueMs: NOW - 2 * H })] });
    await runDeadlineSweeps(h.deps, NOW);
    h.deps.listTasks = async () => [task(7, { dueMs: NOW + D - H })];
    expect(await runDeadlineSweeps(h.deps, NOW + D)).toEqual({ followUps: 0, taskDeadlines: 1 });
  });
  it("puts only the title in the text: no client detail", async () => {
    const h = harness({ followUps: [follow(1, { subject: "Call back about the proposal" })], tasks: [task(2)] });
    await runDeadlineSweeps(h.deps, NOW);
    for (const e of h.emitted) expect(Object.keys(e).sort()).toEqual(["audience", "dedupeRef", "event", "href", "title"]);
  });
  it("caps very long titles", async () => {
    const h = harness({ followUps: [follow(1, { subject: "x".repeat(400) })] });
    await runDeadlineSweeps(h.deps, NOW);
    expect(h.emitted[0].title.length).toBeLessThanOrEqual(200);
  });
});
