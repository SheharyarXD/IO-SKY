/*
 * IO SKY — Admin SRS completion router: authority boundaries, input rules and
 * audit behaviour. The lifecycle rules themselves are covered in
 * srsRules.test.ts; this file proves the procedures apply them and that each
 * mutation is gated to the right role and leaves an audit row.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const m = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  moveOpportunity: vi.fn(),
  createOpportunity: vi.fn(),
  createQuote: vi.fn(),
  createActivity: vi.fn(),
  reviewTimeEntry: vi.fn(),
  getDeveloperProfileById: vi.fn(),
  appendDeveloperNotification: vi.fn(async () => null),
  createAdminNotification: vi.fn(async () => null),
  authoriseAndRecordAgentAction: vi.fn(),
  decideAiExecution: vi.fn(),
  upsertAiAgent: vi.fn(),
  updateIncident: vi.fn(),
  createIncident: vi.fn(),
  setSubscriptionStatus: vi.fn(),
  archiveClientProject: vi.fn(),
  createScheduledReport: vi.fn(),
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
      openId: "t",
      email: "ops@example.com",
      name: "Ops",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}
const as = (role: U["role"]) => appRouter.createCaller(ctx(role));

beforeEach(() => vi.clearAllMocks());

describe("authority boundaries", () => {
  it("keeps a client out of every adminOps procedure", async () => {
    await expect(as("client").adminOps.opportunities({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(as("client").adminOps.createQuote({ title: "x", lines: [{ description: "a", quantity: 1, unitCents: 1 }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("reserves AI governance for the super admin", async () => {
    await expect(as("admin").adminOps.upsertAiAgent({ key: "scribe", name: "Scribe", permissions: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.upsertAiAgent).not.toHaveBeenCalled();
  });
  it("lets a technical operator work incidents but not sales data", async () => {
    m.createIncident.mockResolvedValueOnce({ id: 1, category: "operational", severity: "low", title: "Disk" });
    await expect(as("technical_operator").adminOps.createIncident({ category: "operational", title: "Disk", severity: "low" })).resolves.toMatchObject({ id: 1 });
    await expect(as("technical_operator").adminOps.opportunities({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("opportunities", () => {
  it("needs a lead or an organization", async () => {
    await expect(as("admin").adminOps.createOpportunity({ title: "Deal" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.createOpportunity).not.toHaveBeenCalled();
  });
  it("surfaces a refused transition as PRECONDITION_FAILED and audits nothing", async () => {
    m.moveOpportunity.mockResolvedValueOnce({ ok: false, code: "PRECONDITION_FAILED", reason: "Link the opportunity to a client organization before marking it won." });
    await expect(as("admin").adminOps.moveOpportunity({ id: 1, to: "won" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(m.createAdminNotification).not.toHaveBeenCalled();
  });
  it("notifies admins when a deal is won and a handover project exists", async () => {
    m.moveOpportunity.mockResolvedValueOnce({ ok: true, opportunity: { id: 1, title: "Acme" }, handoverProjectId: 7 });
    await as("admin").adminOps.moveOpportunity({ id: 1, to: "won" });
    expect(m.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({ kind: "opportunity_won", body: expect.stringContaining("#7") }));
  });
});

describe("activities and quotations", () => {
  it("requires a due date on a follow up", async () => {
    await expect(as("admin").adminOps.createActivity({ kind: "follow_up", subject: "Call back", leadId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("requires something to attach an activity to", async () => {
    await expect(as("admin").adminOps.createActivity({ kind: "note", subject: "x" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("turns a quotation arithmetic error into BAD_REQUEST", async () => {
    m.createQuote.mockRejectedValueOnce(new Error("Quantity must be a positive whole number."));
    await expect(as("admin").adminOps.createQuote({ title: "Q", lines: [{ description: "a", quantity: 1, unitCents: 5 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("refuses fractional cents at the boundary", async () => {
    await expect(as("admin").adminOps.createQuote({ title: "Q", lines: [{ description: "a", quantity: 1, unitCents: 5.5 }] })).rejects.toThrow();
    expect(m.createQuote).not.toHaveBeenCalled();
  });
  it("will not reopen a cancelled subscription", async () => {
    m.setSubscriptionStatus.mockResolvedValueOnce(null);
    await expect(as("admin").adminOps.setSubscriptionStatus({ id: 1, status: "active" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("time review", () => {
  it("demands a reason to reject", async () => {
    await expect(as("admin").adminOps.reviewTimeEntry({ id: 1, status: "rejected" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.reviewTimeEntry).not.toHaveBeenCalled();
  });
  it("tells the developer about the decision", async () => {
    m.reviewTimeEntry.mockResolvedValueOnce({ id: 1, developerId: 5, workDate: "2026-10-06", minutes: 90 });
    m.getDeveloperProfileById.mockResolvedValueOnce({ id: 5 });
    await as("admin").adminOps.reviewTimeEntry({ id: 1, status: "approved" });
    expect(m.appendDeveloperNotification).toHaveBeenCalledWith(expect.objectContaining({ developerId: 5, kind: "time" }));
  });
  it("refuses an entry that was already reviewed", async () => {
    m.reviewTimeEntry.mockResolvedValueOnce(null);
    await expect(as("admin").adminOps.reviewTimeEntry({ id: 1, status: "approved" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("AI governance", () => {
  it("audits a blocked agent action as a failure", async () => {
    m.authoriseAndRecordAgentAction.mockResolvedValueOnce({ outcome: "blocked_by_permission", executionId: 3, reason: "action_not_permitted" });
    await as("admin").adminOps.runAiAgentAction({ agentKey: "scribe", action: "send_email" });
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }));
  });
  it("will not decide the same execution twice", async () => {
    m.decideAiExecution.mockResolvedValueOnce("already_decided");
    await expect(as("admin").adminOps.decideAiExecution({ executionId: 3, approve: true })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("incidents, archive and reports", () => {
  it("does not resolve an incident without a resolution", async () => {
    m.updateIncident.mockResolvedValueOnce({ ok: false, code: "PRECONDITION_FAILED", reason: "Record the resolution before resolving or closing an incident." });
    await expect(as("technical_operator").adminOps.updateIncident({ id: 1, status: "resolved" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("alerts admins to a critical incident", async () => {
    m.createIncident.mockResolvedValueOnce({ id: 2, category: "security", severity: "critical", title: "Breach" });
    await as("admin").adminOps.createIncident({ category: "security", title: "Breach", severity: "critical" });
    expect(m.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({ priority: "critical" }));
  });
  it("refuses to archive a project that is not eligible", async () => {
    m.archiveClientProject.mockResolvedValueOnce({ ok: false, reason: "Only completed projects can be archived." });
    await expect(as("admin").adminOps.archiveProject({ projectId: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("will not schedule a report in the past", async () => {
    await expect(
      as("admin").adminOps.createScheduledReport({ name: "Weekly", reportKind: "billing", cadence: "weekly", recipients: ["a@example.com"], firstRunAt: Date.now() - 86_400_000 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.createScheduledReport).not.toHaveBeenCalled();
  });
});
