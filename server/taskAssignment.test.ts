/*
 * J04 (SRS 15.x; 29 Oct Doc 2 s20): reassigning a task and replacing a developer while
 * preserving history. The rules are pure and the router is tested with the data layer
 * mocked. The SQL transaction in server/db/developerWorkspace.ts has NOT been run
 * against PostgreSQL (needs the isolated database, task M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanReason, hasReason, planReassignment, planReplacement, REASON_MAX, REFUSAL_TEXT } from "../shared/taskAssignmentRules";

describe("reasons", () => {
  it("must be stated, cleaned and capped", () => {
    expect(hasReason("Leaving the company")).toBe(true);
    for (const r of [undefined, null, "", "  ", "ab", " a b "]) expect(hasReason(r as never), String(r)).toBe(false);
    expect(cleanReason("  moved\n\n  to   Sam ")).toBe("moved to Sam");
    expect(cleanReason("x".repeat(900))).toHaveLength(REASON_MAX);
  });
});

describe("planReassignment", () => {
  const ok = { taskStatus: "in_progress", fromDeveloperId: 1, toDeveloperId: 2, fromHoldsTask: true, toOnProject: true, reason: "Sam has capacity" };
  it("allows a reasoned move of an unfinished task between two project members", () => {
    for (const taskStatus of ["planned", "in_progress", "blocked", "in_review"]) expect(planReassignment({ ...ok, taskStatus }), taskStatus).toEqual({ ok: true });
  });
  it("refuses each unsafe case with its own reason", () => {
    expect(planReassignment({ ...ok, toDeveloperId: 1 })).toEqual({ ok: false, reason: "same_developer" });
    expect(planReassignment({ ...ok, reason: "" })).toEqual({ ok: false, reason: "reason_required" });
    expect(planReassignment({ ...ok, taskStatus: "done" })).toEqual({ ok: false, reason: "task_done" });
    expect(planReassignment({ ...ok, fromHoldsTask: false })).toEqual({ ok: false, reason: "from_not_assigned" });
    expect(planReassignment({ ...ok, toOnProject: false })).toEqual({ ok: false, reason: "to_not_on_project" });
  });
  it("every refusal has a plain message", () => {
    for (const k of ["same_developer", "reason_required", "task_done", "from_not_assigned", "to_not_on_project", "outgoing_not_on_project"] as const) expect(REFUSAL_TEXT[k].length).toBeGreaterThan(10);
  });
});

describe("planReplacement", () => {
  const held = [
    { taskId: 10, status: "in_progress" },
    { taskId: 11, status: "done" },
    { taskId: 12, status: "blocked" },
    { taskId: 13, status: "planned" },
  ];
  const base = { outgoingDeveloperId: 1, incomingDeveloperId: 2, outgoingOnProject: true, heldTasks: held, reason: "Contract ended" };
  it("releases everything the outgoing developer held and hands over only the unfinished tasks", () => {
    expect(planReplacement(base)).toEqual({ ok: true, release: [10, 11, 12, 13], transfer: [10, 12, 13], stayWithOutgoing: [11] });
  });
  it("a developer holding nothing is still replaced", () => {
    expect(planReplacement({ ...base, heldTasks: [] })).toEqual({ ok: true, release: [], transfer: [], stayWithOutgoing: [] });
  });
  it("refuses the same developer, a missing reason and a developer who is not on the project", () => {
    expect(planReplacement({ ...base, incomingDeveloperId: 1 })).toEqual({ ok: false, reason: "same_developer" });
    expect(planReplacement({ ...base, reason: " " })).toEqual({ ok: false, reason: "reason_required" });
    expect(planReplacement({ ...base, outgoingOnProject: false })).toEqual({ ok: false, reason: "outgoing_not_on_project" });
  });
  it("finished work is never in the transfer list, whatever else is going on", () => {
    const r = planReplacement({ ...base, heldTasks: [{ taskId: 1, status: "done" }, { taskId: 2, status: "done" }] });
    expect(r).toMatchObject({ ok: true, transfer: [], stayWithOutgoing: [1, 2] });
  });
});

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

const m = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  getDeveloperProfileById: vi.fn(),
  listAllDeveloperProjects: vi.fn(),
  reassignDeveloperTask: vi.fn(),
  replaceProjectDeveloper: vi.fn(),
  assignDeveloperTask: vi.fn(),
  endDeveloperAssignment: vi.fn(),
  listTaskAssignmentHistory: vi.fn(async () => []),
  listProjectAssignmentHistory: vi.fn(async () => []),
  appendDeveloperNotification: vi.fn(async () => null),
  appendDeveloperAudit: vi.fn(async () => {}),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
    ...m,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function ctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "test-admin", email: "ops@example.com", name: "Ops Admin", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}
const admin = () => appRouter.createCaller(ctx("admin"));

beforeEach(() => {
  vi.clearAllMocks();
  m.listTaskAssignmentHistory.mockResolvedValue([]);
  m.listProjectAssignmentHistory.mockResolvedValue([]);
});

describe("admin.reassignDeveloperTask", () => {
  const input = { taskId: 3, fromDeveloperId: 5, toDeveloperId: 6, reason: "Sam has capacity" };
  it("is staff only", async () => {
    for (const role of ["client", "developer"] as const) await expect(appRouter.createCaller(ctx(role)).admin.reassignDeveloperTask(input), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.reassignDeveloperTask).not.toHaveBeenCalled();
  });
  it("requires a real reason before touching anything", async () => {
    await expect(admin().admin.reassignDeveloperTask({ ...input, reason: "x" })).rejects.toThrow();
    await expect(admin().admin.reassignDeveloperTask({ ...input, reason: "   " })).rejects.toThrow();
    expect(m.reassignDeveloperTask).not.toHaveBeenCalled();
  });
  it("refuses a developer who is not active, or does not exist", async () => {
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 6, status: "suspended" });
    await expect(admin().admin.reassignDeveloperTask(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    m.getDeveloperProfileById.mockResolvedValueOnce(null);
    await expect(admin().admin.reassignDeveloperTask(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.reassignDeveloperTask).not.toHaveBeenCalled();
  });
  it("records the actor, notifies both developers and audits on success", async () => {
    m.getDeveloperProfileById.mockResolvedValue({ id: 6, status: "active" });
    m.reassignDeveloperTask.mockResolvedValueOnce("ok");
    await expect(admin().admin.reassignDeveloperTask(input)).resolves.toEqual({ ok: true });
    expect(m.reassignDeveloperTask).toHaveBeenCalledWith({ ...input, actorUserId: 99 });
    expect(m.appendDeveloperNotification.mock.calls.map((c) => (c[0] as { developerId: number }).developerId).sort()).toEqual([5, 6]);
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.developer_task.reassign(task=3:5->6)") }));
  });
  it("turns each refusal into a precondition failure with its plain message, and notifies nobody", async () => {
    m.getDeveloperProfileById.mockResolvedValue({ id: 6, status: "active" });
    for (const reason of ["task_done", "from_not_assigned", "to_not_on_project", "same_developer"] as const) {
      m.reassignDeveloperTask.mockResolvedValueOnce(reason);
      await expect(admin().admin.reassignDeveloperTask(input), reason).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_TEXT[reason] });
    }
    m.reassignDeveloperTask.mockResolvedValueOnce("task_not_found");
    await expect(admin().admin.reassignDeveloperTask(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    m.reassignDeveloperTask.mockResolvedValueOnce("unavailable");
    await expect(admin().admin.reassignDeveloperTask(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(m.appendDeveloperNotification).not.toHaveBeenCalled();
    expect(m.appendLoginAudit).not.toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("reassign") }));
  });
});

describe("admin.replaceProjectDeveloper", () => {
  const input = { projectId: 1, outgoingDeveloperId: 5, incomingDeveloperId: 6, reason: "Contract ended" };
  const project = { id: 1, code: "P1", name: "Alpha", status: "active" };
  it("is staff only and needs a reason", async () => {
    await expect(appRouter.createCaller(ctx("developer")).admin.replaceProjectDeveloper(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin().admin.replaceProjectDeveloper({ ...input, reason: "" })).rejects.toThrow();
    expect(m.replaceProjectDeveloper).not.toHaveBeenCalled();
  });
  it("refuses an inactive incoming developer or a completed project before changing anything", async () => {
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 6, status: "suspended" });
    await expect(admin().admin.replaceProjectDeveloper(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 6, status: "active" });
    m.listAllDeveloperProjects.mockResolvedValueOnce([{ ...project, status: "completed" }]);
    await expect(admin().admin.replaceProjectDeveloper(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(m.replaceProjectDeveloper).not.toHaveBeenCalled();
  });
  it("reports what moved, notifies both developers, audits both, and records the actor", async () => {
    m.getDeveloperProfileById.mockResolvedValue({ id: 6, status: "active" });
    m.listAllDeveloperProjects.mockResolvedValue([project]);
    m.replaceProjectDeveloper.mockResolvedValueOnce({ ok: true, transferred: [10, 12], keptWithOutgoing: [11], released: [10, 11, 12] });
    await expect(admin().admin.replaceProjectDeveloper(input)).resolves.toEqual({ ok: true, transferredTasks: 2, finishedTasksKept: 1 });
    expect(m.replaceProjectDeveloper).toHaveBeenCalledWith({ ...input, actorUserId: 99 });
    expect(m.appendDeveloperAudit.mock.calls.map((c) => (c[0] as { event: string }).event).sort()).toEqual(["assignment.replaced_in", "assignment.replaced_out"]);
    expect(m.appendDeveloperNotification.mock.calls.some((c) => (c[0] as { developerId: number }).developerId === 5)).toBe(true);
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.developer.replace(project=1:5->6:moved=2:kept=1)") }));
  });
  it("maps refusals, a missing project and an unavailable history, and notifies nobody", async () => {
    m.getDeveloperProfileById.mockResolvedValue({ id: 6, status: "active" });
    m.listAllDeveloperProjects.mockResolvedValue([project]);
    m.replaceProjectDeveloper.mockResolvedValueOnce({ ok: false, reason: "outgoing_not_on_project" });
    await expect(admin().admin.replaceProjectDeveloper(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_TEXT.outgoing_not_on_project });
    m.replaceProjectDeveloper.mockResolvedValueOnce({ ok: false, reason: "project_not_found" });
    await expect(admin().admin.replaceProjectDeveloper(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    m.replaceProjectDeveloper.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    await expect(admin().admin.replaceProjectDeveloper(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(m.appendDeveloperNotification).not.toHaveBeenCalled();
    expect(m.appendDeveloperAudit).not.toHaveBeenCalled();
  });
});

describe("existing operations record who did them", () => {
  it("assigning a task and ending an assignment pass the acting admin to the history", async () => {
    m.getDeveloperProfileById.mockResolvedValue({ id: 5, status: "active" });
    m.assignDeveloperTask.mockResolvedValueOnce("assigned");
    await admin().admin.assignDeveloperTask({ taskId: 3, developerId: 5 });
    expect(m.assignDeveloperTask).toHaveBeenCalledWith({ taskId: 3, developerId: 5, actorUserId: 99 });
    m.endDeveloperAssignment.mockResolvedValueOnce(true);
    await admin().admin.endDeveloperAssignment({ projectId: 1, developerId: 5 });
    expect(m.endDeveloperAssignment).toHaveBeenCalledWith({ projectId: 1, developerId: 5, actorUserId: 99 });
  });
});

describe("history", () => {
  it("is readable by staff only", async () => {
    await expect(appRouter.createCaller(ctx("client")).admin.taskAssignmentHistory({ taskId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(ctx("developer")).admin.projectAssignmentHistory({ projectId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin().admin.taskAssignmentHistory({ taskId: 3 })).resolves.toEqual([]);
    expect(m.listTaskAssignmentHistory).toHaveBeenCalledWith(3);
  });
});
