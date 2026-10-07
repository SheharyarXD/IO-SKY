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
