/*
 * IO SKY — Admin Portal · developer delivery write paths (SRS 12.9, 12.10,
 * 15.7, 15.10, BR-018). Before these, nothing in the app could create a
 * developer project, assignment or task, so the Developer Portal had
 * nothing it could ever show.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const m = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  getDeveloperProfileById: vi.fn(),
  listAllDeveloperProjects: vi.fn(),
  createDeveloperProject: vi.fn(),
  assignDeveloperToProject: vi.fn(),
  endDeveloperAssignment: vi.fn(),
  createDeveloperTask: vi.fn(),
  assignDeveloperTask: vi.fn(),
  appendAdminDeveloperMessage: vi.fn(),
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
    user: {
      id: 99,
      openId: "test-admin",
      email: "ops@example.com",
      name: "Ops Admin",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    impersonation: null,
    req: {
      protocol: "https",
      headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const admin = () => appRouter.createCaller(ctx("admin"));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin developer delivery", () => {
  it("rejects non-admins on every mutation", async () => {
    const c = appRouter.createCaller(ctx("client"));
    await expect(c.admin.assignDeveloperToProject({ projectId: 1, developerId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.admin.createDeveloperTask({ projectId: 1, title: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.admin.replyToDeveloper({ developerId: 1, body: "hi" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.assignDeveloperToProject).not.toHaveBeenCalled();
  });

  it("refuses to assign a suspended developer", async () => {
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 5, status: "suspended" });
    await expect(admin().admin.assignDeveloperToProject({ projectId: 1, developerId: 5 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(m.assignDeveloperToProject).not.toHaveBeenCalled();
  });

  it("refuses a completed project", async () => {
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 5, status: "active" });
    m.listAllDeveloperProjects.mockResolvedValueOnce([{ id: 1, code: "P1", name: "N", status: "completed" }]);
    await expect(admin().admin.assignDeveloperToProject({ projectId: 1, developerId: 5 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("notifies and audits on a new assignment", async () => {
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 5, status: "active" });
    m.listAllDeveloperProjects.mockResolvedValueOnce([{ id: 1, code: "P1", name: "Alpha", status: "active" }]);
    m.assignDeveloperToProject.mockResolvedValueOnce({ assignment: { id: 9 }, created: true });
    await admin().admin.assignDeveloperToProject({ projectId: 1, developerId: 5, assignmentRole: "lead" });
    expect(m.appendDeveloperNotification).toHaveBeenCalledWith(expect.objectContaining({ developerId: 5, kind: "assignment" }));
    expect(m.appendDeveloperAudit).toHaveBeenCalledWith(expect.objectContaining({ event: "assignment.created" }));
    expect(m.appendLoginAudit).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.developer.assign(5->P1:lead)") }),
    );
  });

  it("does not re-notify when the assignment already existed (idempotent)", async () => {
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 5, status: "active" });
    m.listAllDeveloperProjects.mockResolvedValueOnce([{ id: 1, code: "P1", name: "Alpha", status: "active" }]);
    m.assignDeveloperToProject.mockResolvedValueOnce({ assignment: { id: 9 }, created: false });
    await admin().admin.assignDeveloperToProject({ projectId: 1, developerId: 5 });
    expect(m.appendDeveloperNotification).not.toHaveBeenCalled();
  });

  it("maps a duplicate project code to CONFLICT", async () => {
    m.createDeveloperProject.mockRejectedValueOnce(new Error("duplicate key value violates unique constraint"));
    await expect(admin().admin.createDeveloperProject({ code: "P1", name: "Alpha" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a lower case project code", async () => {
    await expect(admin().admin.createDeveloperProject({ code: "p1", name: "Alpha" })).rejects.toThrow();
    expect(m.createDeveloperProject).not.toHaveBeenCalled();
  });

  it("404s when ending an assignment that is not active", async () => {
    m.endDeveloperAssignment.mockResolvedValueOnce(false);
    await expect(admin().admin.endDeveloperAssignment({ projectId: 1, developerId: 5 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.appendDeveloperAudit).not.toHaveBeenCalled();
  });

  it("refuses a task for a developer who is not on the project", async () => {
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 5, status: "active" });
    m.assignDeveloperTask.mockResolvedValueOnce("not_on_project");
    await expect(admin().admin.assignDeveloperTask({ taskId: 3, developerId: 5 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(m.appendDeveloperNotification).not.toHaveBeenCalled();
  });

  it("notifies on a task assignment, not on a repeat", async () => {
    m.getDeveloperProfileById.mockResolvedValue({ id: 5, status: "active" });
    m.assignDeveloperTask.mockResolvedValueOnce("assigned").mockResolvedValueOnce("already");
    await admin().admin.assignDeveloperTask({ taskId: 3, developerId: 5 });
    await admin().admin.assignDeveloperTask({ taskId: 3, developerId: 5 });
    expect(m.appendDeveloperNotification).toHaveBeenCalledTimes(1);
  });

  it("sends an admin reply and notifies the developer", async () => {
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 5, status: "active" });
    m.appendAdminDeveloperMessage.mockResolvedValueOnce({ id: 1 });
    await admin().admin.replyToDeveloper({ developerId: 5, body: "Welcome" });
    expect(m.appendAdminDeveloperMessage).toHaveBeenCalledWith(expect.objectContaining({ developerId: 5, body: "Welcome" }));
    expect(m.appendDeveloperNotification).toHaveBeenCalledWith(expect.objectContaining({ kind: "message" }));
  });
});
