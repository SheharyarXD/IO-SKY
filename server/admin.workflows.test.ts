/*
 * IO SKY — Admin Portal · Milestone 2 §2.6 workflow-definition engine
 * router endpoints. Locks in: reads are admin-gated, writes
 * (create/enable-disable) are super_admin-exclusive (RM-57's "platform
 * configuration" boundary), NOT_FOUND for an unknown definition id, and
 * that approving/rejecting a document actually invokes the executor.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  appendLoginAuditMock,
  listWorkflowDefinitionsMock,
  listWorkflowRunsMock,
  createWorkflowDefinitionMock,
  setWorkflowDefinitionEnabledMock,
  reviewClientDocumentMock,
  listEnabledWorkflowDefinitionsForTriggerMock,
  recordWorkflowRunMock,
} = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  listWorkflowDefinitionsMock: vi.fn(async () => [] as any[]),
  listWorkflowRunsMock: vi.fn(async () => [] as any[]),
  createWorkflowDefinitionMock: vi.fn(),
  setWorkflowDefinitionEnabledMock: vi.fn(),
  reviewClientDocumentMock: vi.fn(),
  listEnabledWorkflowDefinitionsForTriggerMock: vi.fn(async () => [] as any[]),
  recordWorkflowRunMock: vi.fn(async () => {}),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
    appendLoginAudit: appendLoginAuditMock,
    listWorkflowDefinitions: listWorkflowDefinitionsMock,
    listWorkflowRuns: listWorkflowRunsMock,
    createWorkflowDefinition: createWorkflowDefinitionMock,
    setWorkflowDefinitionEnabled: setWorkflowDefinitionEnabledMock,
    reviewClientDocument: reviewClientDocumentMock,
    listEnabledWorkflowDefinitionsForTrigger: listEnabledWorkflowDefinitionsForTriggerMock,
    recordWorkflowRun: recordWorkflowRunMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 4): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "wf-tester@example.com",
    name: "WF Tester",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: AuthenticatedUser["role"] | null, id = 4): TrpcContext {
  return {
    user: role ? makeUser(role, id) : null,
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

describe("admin.workflowDefinitions / admin.workflowRuns (read)", () => {
  it("allows plain admin", async () => {
    listWorkflowDefinitionsMock.mockResolvedValueOnce([{ id: 1, name: "X" }]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.workflowDefinitions();
    expect(r).toHaveLength(1);
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(caller.admin.workflowDefinitions()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.workflowRuns()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("admin.createWorkflowDefinition", () => {
  it("rejects plain admin - platform configuration is super_admin-exclusive (RM-57)", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.createWorkflowDefinition({ name: "X", triggerType: "document_approved", actionType: "audit_log" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createWorkflowDefinitionMock).not.toHaveBeenCalled();
  });

  it("allows super_admin and audits", async () => {
    createWorkflowDefinitionMock.mockResolvedValueOnce({ id: 7, name: "X" });
    const caller = appRouter.createCaller(makeCtx("super_admin", 4));
    const r = await caller.admin.createWorkflowDefinition({
      name: "X",
      triggerType: "document_approved",
      actionType: "notify_owner",
      actionConfig: "{{documentName}} approved",
    });
    expect(r).toMatchObject({ id: 7 });
    expect(createWorkflowDefinitionMock).toHaveBeenCalledWith({
      name: "X",
      triggerType: "document_approved",
      actionType: "notify_owner",
      actionConfig: "{{documentName}} approved",
      createdByUserId: 4,
    });
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.workflow.create(7)") }),
    );
  });

  it("rejects an invalid triggerType via zod", async () => {
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(
      caller.admin.createWorkflowDefinition({ name: "X", triggerType: "not_real" as any, actionType: "audit_log" }),
    ).rejects.toThrow();
  });
});

describe("admin.setWorkflowDefinitionEnabled", () => {
  it("rejects plain admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.setWorkflowDefinitionEnabled({ id: 1, enabled: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows super_admin and surfaces NOT_FOUND for an unknown id", async () => {
    setWorkflowDefinitionEnabledMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(
      caller.admin.setWorkflowDefinitionEnabled({ id: 999, enabled: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("admin.reviewDocument triggers the workflow engine", () => {
  it("invokes runWorkflowsForTrigger with document_approved on approval", async () => {
    reviewClientDocumentMock.mockResolvedValueOnce({ id: 5, name: "brief.pdf", status: "approved" });
    const caller = appRouter.createCaller(makeCtx("admin"));
    await caller.admin.reviewDocument({ documentId: 5, decision: "approved" });
    expect(listEnabledWorkflowDefinitionsForTriggerMock).toHaveBeenCalledWith("document_approved");
  });

  it("invokes runWorkflowsForTrigger with document_rejected on rejection", async () => {
    reviewClientDocumentMock.mockResolvedValueOnce({ id: 5, name: "brief.pdf", status: "rejected" });
    const caller = appRouter.createCaller(makeCtx("admin"));
    await caller.admin.reviewDocument({ documentId: 5, decision: "rejected" });
    expect(listEnabledWorkflowDefinitionsForTriggerMock).toHaveBeenCalledWith("document_rejected");
  });
});
