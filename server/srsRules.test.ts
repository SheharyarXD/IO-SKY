import { describe, it, expect } from "vitest";
import {
  canMoveOpportunity,
  checkCanClose,
  canMoveDocument,
  computeQuoteTotal,
  checkTimeEntry,
  shouldDeliver,
  shouldFireAlert,
  validateSettingValue,
  nextRunAfter,
  authoriseAgentAction,
  checkCanArchiveProject,
} from "../shared/srsRules";

describe("opportunity lifecycle", () => {
  it("moves forward, never back", () => {
    expect(canMoveOpportunity("qualification", "proposal")).toBe(true);
    expect(canMoveOpportunity("proposal", "discovery")).toBe(false);
    expect(canMoveOpportunity("proposal", "proposal")).toBe(false);
  });
  it("lets any open stage close, and keeps closed stages terminal", () => {
    expect(canMoveOpportunity("discovery", "won")).toBe(true);
    expect(canMoveOpportunity("negotiation", "lost")).toBe(true);
    expect(canMoveOpportunity("won", "negotiation")).toBe(false);
    expect(canMoveOpportunity("won", "lost")).toBe(false);
  });
  it("requires an organization to win and a reason to lose", () => {
    expect(checkCanClose("won", { organizationId: null }).ok).toBe(false);
    expect(checkCanClose("won", { organizationId: 4 }).ok).toBe(true);
    expect(checkCanClose("lost", { organizationId: 4, lostReason: "  " }).ok).toBe(false);
    expect(checkCanClose("lost", { organizationId: null, lostReason: "Budget" }).ok).toBe(true);
  });
});

describe("proposal and quote lifecycle", () => {
  it("only sends a draft and only decides a sent document", () => {
    expect(canMoveDocument("draft", "sent")).toBe(true);
    expect(canMoveDocument("draft", "accepted")).toBe(false);
    expect(canMoveDocument("sent", "accepted")).toBe(true);
    expect(canMoveDocument("accepted", "rejected")).toBe(false);
  });
  it("totals in integer cents and rejects bad lines", () => {
    expect(computeQuoteTotal([{ description: "a", quantity: 2, unitCents: 1050 }, { description: "b", quantity: 1, unitCents: 99 }])).toBe(2199);
    expect(() => computeQuoteTotal([])).toThrow();
    expect(() => computeQuoteTotal([{ description: "a", quantity: 1.5, unitCents: 10 }])).toThrow();
    expect(() => computeQuoteTotal([{ description: "a", quantity: 1, unitCents: 10.5 }])).toThrow();
    expect(() => computeQuoteTotal([{ description: "a", quantity: 1, unitCents: -1 }])).toThrow();
  });
});

describe("time registration", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  it("accepts today and a recent day", () => {
    expect(checkTimeEntry({ workDate: "2026-10-07", minutes: 90, now }).ok).toBe(true);
    expect(checkTimeEntry({ workDate: "2026-09-20", minutes: 30, now }).ok).toBe(true);
  });
  it("rejects the future, the distant past, bad minutes and bad dates", () => {
    expect(checkTimeEntry({ workDate: "2026-10-08", minutes: 30, now }).ok).toBe(false);
    expect(checkTimeEntry({ workDate: "2026-08-01", minutes: 30, now }).ok).toBe(false);
    expect(checkTimeEntry({ workDate: "2026-10-07", minutes: 0, now }).ok).toBe(false);
    expect(checkTimeEntry({ workDate: "2026-10-07", minutes: 1441, now }).ok).toBe(false);
    expect(checkTimeEntry({ workDate: "2026-02-31", minutes: 30, now }).ok).toBe(false);
    expect(checkTimeEntry({ workDate: "07/10/2026", minutes: 30, now }).ok).toBe(false);
  });
});

describe("notification preferences", () => {
  it("defaults to delivering", () => {
    expect(shouldDeliver({ category: "billing", channel: "email", prefs: [] })).toBe(true);
  });
  it("honours an opt out", () => {
    expect(shouldDeliver({ category: "marketing", channel: "email", prefs: [{ category: "marketing", channel: "email", enabled: false }] })).toBe(false);
  });
  it("scopes an opt out to its own channel", () => {
    expect(shouldDeliver({ category: "marketing", channel: "in_app", prefs: [{ category: "marketing", channel: "email", enabled: false }] })).toBe(true);
  });
  it("never lets security notifications be switched off", () => {
    expect(shouldDeliver({ category: "security", channel: "email", prefs: [{ category: "security", channel: "email", enabled: false }] })).toBe(true);
  });
});

describe("alert firing", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  it("fires at the threshold, not below", () => {
    expect(shouldFireAlert({ count: 4, threshold: 5, windowMinutes: 60, lastFiredAt: null, now })).toBe(false);
    expect(shouldFireAlert({ count: 5, threshold: 5, windowMinutes: 60, lastFiredAt: null, now })).toBe(true);
  });
  it("stays quiet for one window after firing", () => {
    const recent = new Date(now.getTime() - 30 * 60_000);
    const old = new Date(now.getTime() - 61 * 60_000);
    expect(shouldFireAlert({ count: 9, threshold: 5, windowMinutes: 60, lastFiredAt: recent, now })).toBe(false);
    expect(shouldFireAlert({ count: 9, threshold: 5, windowMinutes: 60, lastFiredAt: old, now })).toBe(true);
  });
});

describe("configuration validation", () => {
  it("refuses to edit derived values", () => {
    expect(validateSettingValue("integrations.summary", "Connected").ok).toBe(false);
    expect(validateSettingValue("ai_governance.llm_provider", "x").ok).toBe(false);
  });
  it("validates on/off and integer ranges", () => {
    expect(validateSettingValue("operations.maintenance_mode", "on").ok).toBe(true);
    expect(validateSettingValue("operations.maintenance_mode", "maybe").ok).toBe(false);
    expect(validateSettingValue("security.session_hours", "8").ok).toBe(true);
    expect(validateSettingValue("security.session_hours", "0").ok).toBe(false);
    expect(validateSettingValue("security.session_hours", "8.5").ok).toBe(false);
    expect(validateSettingValue("observability.audit_retention_days", "30").ok).toBe(false);
  });
  it("rejects empty and oversized free text", () => {
    expect(validateSettingValue("branding.summary", "   ").ok).toBe(false);
    expect(validateSettingValue("branding.summary", "x".repeat(501)).ok).toBe(false);
    expect(validateSettingValue("branding.summary", "Configured").ok).toBe(true);
  });
});

describe("scheduling", () => {
  it("steps daily and weekly", () => {
    expect(nextRunAfter("daily", new Date("2026-10-07T08:00:00Z")).toISOString()).toBe("2026-10-08T08:00:00.000Z");
    expect(nextRunAfter("weekly", new Date("2026-10-07T08:00:00Z")).toISOString()).toBe("2026-10-14T08:00:00.000Z");
  });
  it("clamps a monthly step to the end of a short month", () => {
    expect(nextRunAfter("monthly", new Date("2027-01-31T08:00:00Z")).toISOString()).toBe("2027-02-28T08:00:00.000Z");
    expect(nextRunAfter("monthly", new Date("2026-12-15T08:00:00Z")).toISOString()).toBe("2027-01-15T08:00:00.000Z");
  });
});

describe("AI agent authorisation", () => {
  const agent = { status: "active", permissions: ["draft_reply"], requiresHumanApproval: true };
  it("allows a permitted action and flags approval", () => {
    expect(authoriseAgentAction(agent, "draft_reply")).toEqual({ allowed: true, needsApproval: true });
  });
  it("blocks an action outside its permissions", () => {
    expect(authoriseAgentAction(agent, "send_email")).toEqual({ allowed: false, reason: "action_not_permitted" });
  });
  it("blocks a disabled or unknown agent", () => {
    expect(authoriseAgentAction({ ...agent, status: "disabled" }, "draft_reply")).toEqual({ allowed: false, reason: "agent_disabled" });
    expect(authoriseAgentAction(null, "draft_reply")).toEqual({ allowed: false, reason: "agent_not_found" });
  });
});

describe("project archive policy", () => {
  it("archives only a completed project with nothing pending", () => {
    expect(checkCanArchiveProject({ status: "completed", pendingApprovals: 0, archivedAt: null }).ok).toBe(true);
    expect(checkCanArchiveProject({ status: "active", pendingApprovals: 0, archivedAt: null }).ok).toBe(false);
    expect(checkCanArchiveProject({ status: "completed", pendingApprovals: 2, archivedAt: null }).ok).toBe(false);
    expect(checkCanArchiveProject({ status: "completed", pendingApprovals: 0, archivedAt: new Date() }).ok).toBe(false);
  });
});

import { categoryForNotificationKind } from "../shared/srsRules";

describe("notification category mapping", () => {
  it("maps kinds to preference categories", () => {
    expect(categoryForNotificationKind("security_alert")).toBe("security");
    expect(categoryForNotificationKind("payment")).toBe("billing");
    expect(categoryForNotificationKind("assignment")).toBe("project");
    expect(categoryForNotificationKind("support_reply")).toBe("support");
    expect(categoryForNotificationKind("campaign")).toBe("marketing");
  });
  it("never files an unknown kind under marketing", () => {
    expect(categoryForNotificationKind("something_new")).toBe("account");
  });
});

import { csvCell, toCsv, escapeLike } from "../shared/srsRules";

describe("CSV export", () => {
  it("quotes cells with commas, quotes and line breaks", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(new Date("2026-10-07T00:00:00Z"))).toBe("2026-10-07T00:00:00.000Z");
  });
  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("normal-text")).toBe("normal-text");
  });
  it("builds a header and rows", () => {
    expect(toCsv(["a", "b"], [{ a: 1, b: "x,y" }])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("LIKE escaping", () => {
  it("escapes wildcards and the escape character", () => {
    expect(escapeLike("100%_\\")).toBe("100" + "\\" + "%" + "\\" + "_" + "\\" + "\\");
  });
});

import { canMoveReport, isReportVisibleToCustomer, isHumanOnlyReportStep, REPORT_STATUSES } from "../shared/srsRules";

describe("AI Scan report lifecycle (SRS 9.6)", () => {
  it("has exactly the nine statuses the SRS names", () => {
    expect(REPORT_STATUSES).toHaveLength(9);
  });
  it("walks the happy path in order", () => {
    const path = ["draft", "questionnaire_in_progress", "submitted", "ai_processing", "awaiting_expert_review", "approved", "published", "archived"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canMoveReport(path[i], path[i + 1])).toBe(true);
  });
  it("cannot skip review: the engine output is never approved or published directly", () => {
    expect(canMoveReport("ai_processing", "approved")).toBe(false);
    expect(canMoveReport("ai_processing", "published")).toBe(false);
    expect(canMoveReport("awaiting_expert_review", "published")).toBe(false);
    expect(canMoveReport("submitted", "published")).toBe(false);
  });
  it("sends a report back and through review again", () => {
    expect(canMoveReport("awaiting_expert_review", "revision_required")).toBe(true);
    expect(canMoveReport("approved", "revision_required")).toBe(true);
    expect(canMoveReport("revision_required", "ai_processing")).toBe(true);
    expect(canMoveReport("revision_required", "published")).toBe(false);
  });
  it("treats archived as terminal and publication as one way", () => {
    for (const s of REPORT_STATUSES) expect(canMoveReport("archived", s)).toBe(false);
    expect(canMoveReport("published", "approved")).toBe(false);
  });
  it("shows the customer only a published report", () => {
    for (const s of REPORT_STATUSES) expect(isReportVisibleToCustomer(s)).toBe(s === "published");
    expect(isReportVisibleToCustomer(null)).toBe(false);
  });
  it("marks approve, revise, publish and archive as human only", () => {
    expect(["approved", "revision_required", "published", "archived"].every((s) => isHumanOnlyReportStep(s as never))).toBe(true);
    expect(isHumanOnlyReportStep("awaiting_expert_review")).toBe(false);
    expect(isHumanOnlyReportStep("ai_processing")).toBe(false);
  });
});

import { checkCallOutcome, draftExpiry, isDraftExpired, DRAFT_TTL_DAYS } from "../shared/srsRules";

describe("Discovery Call outcomes", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const later = new Date("2026-10-10T09:00:00Z");
  it("needs a follow up date when work is left to do", () => {
    expect(checkCallOutcome({ outcome: "needs_follow_up", followUpAt: null, now }).ok).toBe(false);
    expect(checkCallOutcome({ outcome: "proposal_requested", followUpAt: null, now }).ok).toBe(false);
    expect(checkCallOutcome({ outcome: "needs_follow_up", followUpAt: later, now }).ok).toBe(true);
  });
  it("does not require one when the matter is closed", () => {
    expect(checkCallOutcome({ outcome: "qualified", followUpAt: null, now }).ok).toBe(true);
    expect(checkCallOutcome({ outcome: "not_a_fit", followUpAt: null, now }).ok).toBe(true);
  });
  it("rejects a follow up date in the past", () => {
    expect(checkCallOutcome({ outcome: "qualified", followUpAt: new Date("2026-10-01T00:00:00Z"), now }).ok).toBe(false);
  });
});

describe("questionnaire drafts", () => {
  it("expires after the retention window", () => {
    const now = new Date("2026-10-07T00:00:00Z");
    const exp = draftExpiry(now);
    expect(exp.getTime() - now.getTime()).toBe(DRAFT_TTL_DAYS * 86_400_000);
    expect(isDraftExpired(exp, new Date(exp.getTime() - 1))).toBe(false);
    expect(isDraftExpired(exp, exp)).toBe(true);
  });
});

import { evaluateCompliance, complianceSummary } from "../shared/srsRules";

describe("compliance evaluation", () => {
  const clean = { adminsWithoutMfa: 0, overduePrivacyRequests: 0, staleDocumentReviews: 0, scansWaitingTooLong: 0, openCriticalIncidents: 0, expiredActiveDeveloperScopes: 0, enabledAlertRules: 4 };
  it("passes everything on a clean platform", () => {
    expect(complianceSummary(evaluateCompliance(clean))).toEqual({ pass: 7, warn: 0, fail: 0 });
  });
  it("fails an administrator without a second factor and a missed privacy deadline", () => {
    const r = evaluateCompliance({ ...clean, adminsWithoutMfa: 2, overduePrivacyRequests: 1 });
    expect(r.find((c) => c.key === "admin_mfa")).toMatchObject({ status: "fail", count: 2 });
    expect(r.find((c) => c.key === "privacy_deadlines")?.status).toBe("fail");
  });
  it("warns on a slowly growing review backlog and fails it only when large", () => {
    expect(evaluateCompliance({ ...clean, staleDocumentReviews: 2 }).find((c) => c.key === "document_reviews")?.status).toBe("warn");
    expect(evaluateCompliance({ ...clean, staleDocumentReviews: 5 }).find((c) => c.key === "document_reviews")?.status).toBe("fail");
    expect(evaluateCompliance({ ...clean, scansWaitingTooLong: 1 }).find((c) => c.key === "scan_reviews")?.status).toBe("warn");
  });
  it("fails when nothing is watching for abuse", () => {
    expect(evaluateCompliance({ ...clean, enabledAlertRules: 0 }).find((c) => c.key === "alerting")?.status).toBe("fail");
  });
  it("names the count in the detail so the figure can be checked", () => {
    expect(evaluateCompliance({ ...clean, expiredActiveDeveloperScopes: 3 }).find((c) => c.key === "developer_scopes")?.detail).toContain("3");
  });
});

import { lastMonths, fillMonthly, ALERT_METRICS } from "../shared/srsRules";

describe("monthly history helpers", () => {
  it("lists the last n months oldest first, across a year boundary", () => {
    expect(lastMonths(3, new Date("2027-01-15T00:00:00Z"))).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(lastMonths(1, new Date("2026-10-31T23:59:59Z"))).toEqual(["2026-10"]);
  });
  it("fills missing months with zero and keeps the order", () => {
    const rows = [{ month: "2026-09", leads: 4 }];
    expect(fillMonthly(["2026-08", "2026-09", "2026-10"], rows, { leads: 0 })).toEqual([
      { month: "2026-08", leads: 0 },
      { month: "2026-09", leads: 4 },
      { month: "2026-10", leads: 0 },
    ]);
  });
  it("knows the capacity metrics", () => {
    expect(ALERT_METRICS).toContain("memory_mb");
    expect(ALERT_METRICS).toContain("database_mb");
  });
});

import { canInviteRole, roleRequiresMfa, invitationState, checkPasswordStrength, INVITATION_TTL_DAYS } from "../shared/srsRules";

describe("invitations (SRS 8.7)", () => {
  it("lets a super admin invite anyone", () => {
    for (const r of ["client", "developer", "technical_operator", "admin", "super_admin"] as const) expect(canInviteRole("super_admin", r)).toBe(true);
  });
  it("lets an admin invite only customers and developers, so a stolen admin cannot mint admins", () => {
    expect(canInviteRole("admin", "client")).toBe(true);
    expect(canInviteRole("admin", "developer")).toBe(true);
    expect(canInviteRole("admin", "admin")).toBe(false);
    expect(canInviteRole("admin", "super_admin")).toBe(false);
    expect(canInviteRole("admin", "technical_operator")).toBe(false);
  });
  it("lets nobody else invite", () => {
    for (const r of ["client", "developer", "technical_operator", "user"]) expect(canInviteRole(r, "client")).toBe(false);
  });
  it("requires MFA for the privileged roles only", () => {
    expect(["super_admin", "admin", "technical_operator"].every(roleRequiresMfa)).toBe(true);
    expect(roleRequiresMfa("client")).toBe(false);
    expect(roleRequiresMfa("developer")).toBe(false);
  });
  it("derives the invitation state, with accepted and revoked beating expiry", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const future = new Date(now.getTime() + 1000);
    const past = new Date(now.getTime() - 1000);
    expect(invitationState({ acceptedAt: null, revokedAt: null, expiresAt: future }, now)).toBe("pending");
    expect(invitationState({ acceptedAt: null, revokedAt: null, expiresAt: past }, now)).toBe("expired");
    expect(invitationState({ acceptedAt: null, revokedAt: now, expiresAt: future }, now)).toBe("revoked");
    expect(invitationState({ acceptedAt: now, revokedAt: null, expiresAt: past }, now)).toBe("accepted");
    expect(INVITATION_TTL_DAYS).toBe(7);
  });
});

describe("password strength", () => {
  const email = "maria.jansen@example.com";
  it("accepts a long mixed password", () => {
    expect(checkPasswordStrength("correct7horse9battery", email).ok).toBe(true);
  });
  it("refuses short, single letter run, letters only, numbers only", () => {
    expect(checkPasswordStrength("Short1", email).ok).toBe(false);
    expect(checkPasswordStrength("aaaaaaaaaaaaaaaa1", email).ok).toBe(false);
    expect(checkPasswordStrength("onlylettersherenow", email).ok).toBe(false);
    expect(checkPasswordStrength("123456789012345", email).ok).toBe(false);
  });
  it("refuses a password that contains the email name", () => {
    const r = checkPasswordStrength("maria.jansen2026!x", email);
    expect(r.ok).toBe(false);
  });
  it("refuses an oversized password", () => {
    expect(checkPasswordStrength("a1".repeat(80), email).ok).toBe(false);
  });
  it("explains each refusal in words for the person choosing", () => {
    const r = checkPasswordStrength("Short1", email);
    expect(r.ok === false && r.reason).toContain("12");
  });
});
