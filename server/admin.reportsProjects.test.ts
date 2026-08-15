/*
 * IO SKY — Admin Portal · Reports/Projects/Milestones mutations + AI Scan
 * bridge (Milestone 2 §2.4). Before this pass, client_reports/
 * client_projects/client_project_milestones had no create/update path
 * anywhere in the app — these tests lock in that the new mutations exist,
 * are admin-gated, tenant-scoped, and audited.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  appendLoginAuditMock,
  getDbMock,
  createClientReportMock,
  updateClientReportMock,
  getAiScanByIdMock,
  createClientProjectMock,
  updateClientProjectMock,
  getClientProjectByIdMock,
  createClientProjectMilestoneMock,
  updateClientProjectMilestoneMock,
} = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  getDbMock: vi.fn(async () => null),
  createClientReportMock: vi.fn(),
  updateClientReportMock: vi.fn(),
  getAiScanByIdMock: vi.fn(),
  createClientProjectMock: vi.fn(),
  updateClientProjectMock: vi.fn(),
  getClientProjectByIdMock: vi.fn(),
  createClientProjectMilestoneMock: vi.fn(),
  updateClientProjectMilestoneMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendLoginAudit: appendLoginAuditMock,
    getDb: getDbMock,
    createClientReport: createClientReportMock,
    updateClientReport: updateClientReportMock,
    getAiScanById: getAiScanByIdMock,
    createClientProject: createClientProjectMock,
    updateClientProject: updateClientProjectMock,
    getClientProjectById: getClientProjectByIdMock,
    createClientProjectMilestone: createClientProjectMilestoneMock,
    updateClientProjectMilestone: updateClientProjectMilestoneMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    id: 99,
    openId: "test-admin",
    email: "ops@example.com",
    name: "Ops Admin",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: AuthenticatedUser["role"] | null): TrpcContext {
  return {
    user: role ? makeUser(role) : null,
    impersonation: null,
    req: {
      protocol: "https",
      headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin.createReport / admin.updateReport", () => {
  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(
      caller.admin.createReport({ organizationId: 1, title: "Q1 Report", score: 80 }),
    ).rejects.toThrow();
    expect(createClientReportMock).not.toHaveBeenCalled();
  });

  it("creates a report and audits the action", async () => {
    createClientReportMock.mockResolvedValueOnce({ id: 1, publicRef: "R-ABC123", title: "Q1 Report", score: 80 });
    const caller = appRouter.createCaller(makeCtx("admin"));
    const out = await caller.admin.createReport({ organizationId: 7, title: "Q1 Report", score: 80 });
    expect(out.publicRef).toBe("R-ABC123");
    expect(createClientReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 7, title: "Q1 Report", score: 80 }),
    );
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.report.create") }),
    );
  });

  it("404s an update for a report outside the given organization", async () => {
    updateClientReportMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.updateReport({ organizationId: 7, id: 999, status: "delivered" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("admin.promoteAiScanToClientReport (AI Scan → Reports bridge)", () => {
  it("rejects a scan that hasn't finished scoring", async () => {
    getAiScanByIdMock.mockResolvedValueOnce({ id: 5, status: "scoring", overallScore: null });
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.promoteAiScanToClientReport({ aiScanId: 5, organizationId: 7 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(createClientReportMock).not.toHaveBeenCalled();
  });

  it("404s when the AI Scan doesn't exist", async () => {
    getAiScanByIdMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.promoteAiScanToClientReport({ aiScanId: 999, organizationId: 7 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("creates a client_reports row carrying the scan's real score and executive summary", async () => {
    getAiScanByIdMock.mockResolvedValueOnce({
      id: 5,
      status: "ready",
      overallScore: 74,
      company: "Acme Corp",
      fullName: "Jan Jansen",
      reportPayload: JSON.stringify({ executiveSummary: "Acme shows strong automation maturity." }),
    });
    createClientReportMock.mockResolvedValueOnce({ id: 10, publicRef: "R-XYZ", score: 74 });
    const caller = appRouter.createCaller(makeCtx("admin"));
    const out = await caller.admin.promoteAiScanToClientReport({ aiScanId: 5, organizationId: 7 });
    expect(out.publicRef).toBe("R-XYZ");
    expect(createClientReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 7,
        score: 74,
        scanType: "ai-scan",
        title: "AI Scan — Acme Corp",
        summary: "Acme shows strong automation maturity.",
      }),
    );
  });

  it("does not fabricate a summary when reportPayload is corrupted — still creates the report from the score alone", async () => {
    getAiScanByIdMock.mockResolvedValueOnce({
      id: 6,
      status: "ready",
      overallScore: 61,
      company: "Beta Ltd",
      fullName: "Someone",
      reportPayload: "not valid json{{{",
    });
    createClientReportMock.mockResolvedValueOnce({ id: 11, publicRef: "R-BETA", score: 61 });
    const caller = appRouter.createCaller(makeCtx("admin"));
    const out = await caller.admin.promoteAiScanToClientReport({ aiScanId: 6, organizationId: 8 });
    expect(out.score).toBe(61);
    expect(createClientReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ summary: undefined, score: 61 }),
    );
  });
});

describe("admin.createProject / admin.updateProject", () => {
  it("creates a project and audits the action", async () => {
    createClientProjectMock.mockResolvedValueOnce({ id: 1, name: "Rollout", organizationId: 7 });
    const caller = appRouter.createCaller(makeCtx("admin"));
    const out = await caller.admin.createProject({ organizationId: 7, name: "Rollout" });
    expect(out.name).toBe("Rollout");
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.project.create") }),
    );
  });
});

describe("admin.createMilestone / admin.updateMilestone (tenant isolation)", () => {
  it("refuses to attach a milestone to a project belonging to a different organization", async () => {
    getClientProjectByIdMock.mockResolvedValueOnce(null); // project doesn't belong to org 7
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.createMilestone({ organizationId: 7, projectId: 42, title: "Kickoff" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createClientProjectMilestoneMock).not.toHaveBeenCalled();
  });

  it("creates a milestone once the project's org ownership is verified", async () => {
    getClientProjectByIdMock.mockResolvedValueOnce({ id: 42, organizationId: 7, name: "Rollout" });
    createClientProjectMilestoneMock.mockResolvedValueOnce({ id: 1, projectId: 42, title: "Kickoff" });
    const caller = appRouter.createCaller(makeCtx("admin"));
    const out = await caller.admin.createMilestone({ organizationId: 7, projectId: 42, title: "Kickoff" });
    expect(out.title).toBe("Kickoff");
    expect(getClientProjectByIdMock).toHaveBeenCalledWith(7, 42);
  });

  it("refuses to update a milestone under a project outside the given organization", async () => {
    getClientProjectByIdMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.updateMilestone({ organizationId: 7, projectId: 42, id: 1, status: "completed" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(updateClientProjectMilestoneMock).not.toHaveBeenCalled();
  });
});
