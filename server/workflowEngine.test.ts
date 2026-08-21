/*
 * IO SKY — Milestone 2 §2.6 workflow-definition engine executor
 * (server/workflowEngine.ts). Locks in: only enabled definitions matching
 * the trigger run, notify_owner and audit_log actions both execute and
 * record a "succeeded" run, a notify_owner failure (e.g. owner email not
 * configured) is caught and recorded as a "failed" run rather than
 * propagating and breaking the caller, and template token substitution.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { listEnabledMock, recordRunMock, appendLoginAuditMock, notifyOwnerMock } = vi.hoisted(() => ({
  listEnabledMock: vi.fn(async () => [] as any[]),
  recordRunMock: vi.fn(async () => {}),
  appendLoginAuditMock: vi.fn(async () => {}),
  notifyOwnerMock: vi.fn(async () => true),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listEnabledWorkflowDefinitionsForTrigger: listEnabledMock,
    recordWorkflowRun: recordRunMock,
    appendLoginAudit: appendLoginAuditMock,
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

import { runWorkflowsForTrigger } from "./workflowEngine";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runWorkflowsForTrigger", () => {
  it("does nothing when no enabled definitions match the trigger", async () => {
    listEnabledMock.mockResolvedValueOnce([]);
    await runWorkflowsForTrigger("document_approved", {}, "5");
    expect(notifyOwnerMock).not.toHaveBeenCalled();
    expect(appendLoginAuditMock).not.toHaveBeenCalled();
    expect(recordRunMock).not.toHaveBeenCalled();
  });

  it("runs a notify_owner action, substitutes template tokens, and records a succeeded run", async () => {
    listEnabledMock.mockResolvedValueOnce([
      { id: 1, name: "Approval alert", triggerType: "document_approved", actionType: "notify_owner", actionConfig: "Document {{documentName}} was approved.", enabled: 1 },
    ]);
    await runWorkflowsForTrigger("document_approved", { documentName: "brief.pdf" }, "5");
    expect(notifyOwnerMock).toHaveBeenCalledWith({
      title: "Workflow: Approval alert",
      content: "Document brief.pdf was approved.",
    });
    expect(recordRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflowDefinitionId: 1, status: "succeeded", triggerEntityRef: "5" }),
    );
  });

  it("runs an audit_log action and records a succeeded run", async () => {
    listEnabledMock.mockResolvedValueOnce([
      { id: 2, name: "Log rejections", triggerType: "document_rejected", actionType: "audit_log", actionConfig: null, enabled: 1 },
    ]);
    await runWorkflowsForTrigger("document_rejected", {}, "9");
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "workflow", reason: expect.stringContaining("workflow:Log rejections:document_rejected:9") }),
    );
    expect(recordRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflowDefinitionId: 2, status: "succeeded" }),
    );
  });

  it("catches a notify_owner failure and records a failed run instead of throwing", async () => {
    listEnabledMock.mockResolvedValueOnce([
      { id: 3, name: "Broken alert", triggerType: "document_approved", actionType: "notify_owner", actionConfig: null, enabled: 1 },
    ]);
    notifyOwnerMock.mockRejectedValueOnce(new Error("Owner notification email is not configured"));
    await expect(runWorkflowsForTrigger("document_approved", {}, "5")).resolves.toBeUndefined();
    expect(recordRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowDefinitionId: 3,
        status: "failed",
        resultMessage: expect.stringContaining("not configured"),
      }),
    );
  });

  it("runs every matching enabled definition, not just the first", async () => {
    listEnabledMock.mockResolvedValueOnce([
      { id: 4, name: "A", triggerType: "document_approved", actionType: "audit_log", actionConfig: null, enabled: 1 },
      { id: 5, name: "B", triggerType: "document_approved", actionType: "audit_log", actionConfig: null, enabled: 1 },
    ]);
    await runWorkflowsForTrigger("document_approved", {}, "5");
    expect(recordRunMock).toHaveBeenCalledTimes(2);
  });
});
