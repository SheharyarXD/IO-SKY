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
  exportAuditLog: vi.fn(),
  recordCallOutcome: vi.fn(),
  addTaskCommentByStaff: vi.fn(),
  transitionAiScanReport: vi.fn(),
  getAiScanById: vi.fn(),
  assignAiScanReviewer: vi.fn(),
  dispatchSimpleEmailMock: vi.fn(),
  searchAuditLog: vi.fn(),
  searchDocuments: vi.fn(),
  readPlatformHealth: vi.fn(),
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

describe("denied access is recorded (SRS 8.16)", () => {
  it("writes one blocked audit row when a signed in user is refused", async () => {
    await expect(as("client").adminOps.opportunities({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await new Promise((r) => setTimeout(r, 20));
    expect(m.appendLoginAudit).toHaveBeenCalledTimes(1);
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "blocked", provider: "authz", userId: 99, reason: "denied:adminOps.opportunities" }));
  });
  it("does not write a row when an allowed call succeeds", async () => {
    m.createIncident.mockResolvedValueOnce({ id: 1, category: "operational", severity: "low", title: "x" });
    await as("technical_operator").adminOps.createIncident({ category: "operational", title: "x", severity: "low" });
    await new Promise((r) => setTimeout(r, 20));
    expect(m.appendLoginAudit).not.toHaveBeenCalledWith(expect.objectContaining({ outcome: "blocked" }));
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

describe("audit export, search and health", () => {
  it("exports CSV, defuses a formula in an attacker typed identifier, and audits the export", async () => {
    m.exportAuditLog.mockResolvedValueOnce([
      { createdAt: new Date("2026-10-07T00:00:00Z"), provider: "local", outcome: "failed", identifier: "=cmd|' /C calc'!A1", reason: "bad password", ip: "1.2.3.4", userId: null },
    ]);
    const r = await as("admin").adminOps.auditExport({});
    expect(r.rows).toBe(1);
    expect(r.csv.split("\r\n")[0]).toBe("createdAt,provider,outcome,identifier,reason,ip,userId");
    expect(r.csv).toContain("'=cmd");
    expect(r.csv).not.toMatch(/,=cmd/);
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.audit.export(rows=1)") }));
  });
  it("keeps audit search and export away from a technical operator", async () => {
    await expect(as("technical_operator").adminOps.auditSearch({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(as("technical_operator").adminOps.auditExport({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("lets a technical operator read platform health but not search documents", async () => {
    m.readPlatformHealth.mockResolvedValueOnce({ ok: true });
    await expect(as("technical_operator").adminOps.platformHealth()).resolves.toEqual({ ok: true });
    await expect(as("technical_operator").adminOps.searchDocuments({ q: "nda" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("refuses a one character document search", async () => {
    await expect(as("admin").adminOps.searchDocuments({ q: "a" })).rejects.toThrow();
    expect(m.searchDocuments).not.toHaveBeenCalled();
  });
  it("scopes a client document search to the caller's organization, never the query text", async () => {
    m.searchDocuments.mockResolvedValueOnce([]);
    const c = ctx("client");
    (c.user as { organizationId: number | null }).organizationId = 42;
    await appRouter.createCaller(c).clientPortal.searchDocuments({ q: "organizationId=7" });
    expect(m.searchDocuments).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 42, q: "organizationId=7" }));
  });
});

vi.mock("./email", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, dispatchSimpleEmail: (...a: unknown[]) => m.dispatchSimpleEmailMock(...a) };
});

describe("AI Scan expert review", () => {
  const scan = { id: 7, company: "Acme", fullName: "A Person", email: "a@example.com", reportToken: "tok123" };
  it("keeps a technical operator and a client out of the review actions", async () => {
    await expect(as("technical_operator").adminOps.moveAiScanReport({ scanId: 7, to: "published" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(as("client").adminOps.aiScanReviewQueue({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("will not let the API approve straight from a state the rules forbid", async () => {
    m.transitionAiScanReport.mockResolvedValueOnce({ ok: false, code: "PRECONDITION_FAILED", reason: "A report that is submitted cannot move to published." });
    await expect(as("admin").adminOps.moveAiScanReport({ scanId: 7, to: "published" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(m.dispatchSimpleEmailMock).not.toHaveBeenCalled();
  });
  it("records the approver and does not email the customer on approval", async () => {
    m.transitionAiScanReport.mockResolvedValueOnce({ ok: true, from: "awaiting_expert_review", scan });
    await as("admin").adminOps.moveAiScanReport({ scanId: 7, to: "approved" });
    expect(m.transitionAiScanReport).toHaveBeenCalledWith(expect.objectContaining({ to: "approved", actorUserId: 99 }));
    expect(m.dispatchSimpleEmailMock).not.toHaveBeenCalled();
  });
  it("emails the customer a link when a report is published", async () => {
    m.transitionAiScanReport.mockResolvedValueOnce({ ok: true, from: "approved", scan });
    m.dispatchSimpleEmailMock.mockResolvedValueOnce({ ok: true });
    await as("admin").adminOps.moveAiScanReport({ scanId: 7, to: "published" });
    expect(m.dispatchSimpleEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "a@example.com", text: expect.stringContaining("/ai-scan/result/tok123") }));
  });
  it("still publishes when the notification email fails", async () => {
    m.transitionAiScanReport.mockResolvedValueOnce({ ok: true, from: "approved", scan });
    m.dispatchSimpleEmailMock.mockRejectedValueOnce(new Error("smtp down"));
    await expect(as("admin").adminOps.moveAiScanReport({ scanId: 7, to: "published" })).resolves.toMatchObject({ ok: true, status: "published" });
  });
  it("only regenerates a report that was sent back", async () => {
    m.getAiScanById.mockResolvedValueOnce({ id: 7, reportStatus: "awaiting_expert_review" });
    await expect(as("admin").adminOps.regenerateAiScanReport({ scanId: 7 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("Discovery Call outcomes and task comments", () => {
  it("demands a follow up date for a follow up outcome before touching the database", async () => {
    await expect(as("admin").adminOps.recordCallOutcome({ bookingId: 3, outcome: "needs_follow_up" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.recordCallOutcome).not.toHaveBeenCalled();
  });
  it("records an outcome with the follow up and audits it", async () => {
    m.recordCallOutcome.mockResolvedValueOnce({ outcome: { id: 1 }, leadId: 5 });
    await as("admin").adminOps.recordCallOutcome({ bookingId: 3, outcome: "needs_follow_up", followUpAt: Date.now() + 86_400_000, notes: "Send pricing" });
    expect(m.recordCallOutcome).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 3, userId: 99, notes: "Send pricing" }));
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.call_outcome(3:needs_follow_up)") }));
  });
  it("refuses an outcome on a cancelled call", async () => {
    m.recordCallOutcome.mockResolvedValueOnce("booking_cancelled");
    await expect(as("admin").adminOps.recordCallOutcome({ bookingId: 3, outcome: "qualified" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("will not comment on a task nobody holds", async () => {
    m.addTaskCommentByStaff.mockResolvedValueOnce("task_not_found");
    await expect(as("admin").adminOps.commentOnTask({ taskId: 9, body: "hi" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("keeps a technical operator out of call outcomes", async () => {
    await expect(as("technical_operator").adminOps.recordCallOutcome({ bookingId: 3, outcome: "qualified" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
