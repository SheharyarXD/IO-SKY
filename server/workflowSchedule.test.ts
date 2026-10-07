/*
 * Scheduled and event workflows (SRS 23.9, 23.10): due definitions are claimed
 * then executed, a failing action is recorded without breaking the others, and
 * fireTrigger never throws into the business action that fired it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  claimDueScheduledWorkflows: vi.fn(),
  listEnabledWorkflowDefinitionsForTrigger: vi.fn(async () => [] as unknown[]),
  recordWorkflowRun: vi.fn(async () => {}),
  appendLoginAudit: vi.fn(async () => {}),
  notifyOwner: vi.fn(async () => true),
  dispatchWebhooksForTrigger: vi.fn(async () => {}),
}));

vi.mock("./db", () => ({
  claimDueScheduledWorkflows: m.claimDueScheduledWorkflows,
  listEnabledWorkflowDefinitionsForTrigger: m.listEnabledWorkflowDefinitionsForTrigger,
  recordWorkflowRun: m.recordWorkflowRun,
  appendLoginAudit: m.appendLoginAudit,
}));
vi.mock("./_core/notification", () => ({ notifyOwner: m.notifyOwner }));
vi.mock("./webhookDispatcher", () => ({ dispatchWebhooksForTrigger: m.dispatchWebhooksForTrigger }));

import { fireTrigger, runDueScheduledWorkflows } from "./workflowEngine";

const def = (over: Record<string, unknown> = {}) => ({ id: 1, name: "Weekly digest", triggerType: "schedule", actionType: "notify_owner", actionConfig: "Run at {{at}}", enabled: 1, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runDueScheduledWorkflows", () => {
  it("does nothing when no workflow is due", async () => {
    m.claimDueScheduledWorkflows.mockResolvedValueOnce([]);
    expect(await runDueScheduledWorkflows(new Date("2026-10-07T08:00:00Z"))).toBe(0);
    expect(m.recordWorkflowRun).not.toHaveBeenCalled();
  });

  it("runs each claimed workflow and logs a successful run for it", async () => {
    m.claimDueScheduledWorkflows.mockResolvedValueOnce([def({ id: 1 }), def({ id: 2, actionType: "audit_log" })]);
    const n = await runDueScheduledWorkflows(new Date("2026-10-07T08:00:00Z"));
    expect(n).toBe(2);
    expect(m.notifyOwner).toHaveBeenCalledWith(expect.objectContaining({ content: "Run at 2026-10-07T08:00:00.000Z" }));
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ provider: "workflow" }));
    expect(m.recordWorkflowRun).toHaveBeenCalledTimes(2);
    expect(m.recordWorkflowRun).toHaveBeenCalledWith(expect.objectContaining({ triggerType: "schedule", status: "succeeded" }));
  });

  it("records a failure and still runs the next workflow", async () => {
    m.claimDueScheduledWorkflows.mockResolvedValueOnce([def({ id: 1 }), def({ id: 2, actionType: "audit_log" })]);
    m.notifyOwner.mockRejectedValueOnce(new Error("mail down"));
    await runDueScheduledWorkflows(new Date("2026-10-07T08:00:00Z"));
    expect(m.recordWorkflowRun).toHaveBeenCalledWith(expect.objectContaining({ workflowDefinitionId: 1, status: "failed", resultMessage: "mail down" }));
    expect(m.recordWorkflowRun).toHaveBeenCalledWith(expect.objectContaining({ workflowDefinitionId: 2, status: "succeeded" }));
  });

  it("hands the claim a monthly rule that clamps to the end of a short month", async () => {
    m.claimDueScheduledWorkflows.mockImplementationOnce(async (_now: Date, next: (c: string, f: Date) => Date) => {
      expect(next("monthly", new Date("2027-01-31T08:00:00Z")).toISOString()).toBe("2027-02-28T08:00:00.000Z");
      expect(next("weekly", new Date("2026-10-07T08:00:00Z")).toISOString()).toBe("2026-10-14T08:00:00.000Z");
      return [];
    });
    await runDueScheduledWorkflows(new Date("2026-10-07T08:00:00Z"));
    expect(m.claimDueScheduledWorkflows).toHaveBeenCalledTimes(1);
  });
});

describe("fireTrigger", () => {
  it("runs matching workflows and registered webhooks", async () => {
    m.listEnabledWorkflowDefinitionsForTrigger.mockResolvedValueOnce([def({ triggerType: "invoice_created", actionConfig: "Invoice {{number}}" })]);
    await fireTrigger("invoice_created", { number: "INV-9" }, "9");
    expect(m.notifyOwner).toHaveBeenCalledWith(expect.objectContaining({ content: "Invoice INV-9" }));
    expect(m.dispatchWebhooksForTrigger).toHaveBeenCalledWith("invoice_created", { number: "INV-9" }, "9");
  });

  it("does not throw when workflows or webhooks fail, and still tries the webhooks", async () => {
    m.listEnabledWorkflowDefinitionsForTrigger.mockRejectedValueOnce(new Error("db down"));
    m.dispatchWebhooksForTrigger.mockRejectedValueOnce(new Error("network"));
    await expect(fireTrigger("incident_created", {}, "1")).resolves.toBeUndefined();
    expect(m.dispatchWebhooksForTrigger).toHaveBeenCalledTimes(1);
  });
});
