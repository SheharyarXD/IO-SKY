/*
 * G09 (SRS 5.7, 13.8; 29 Oct Doc 1 F-26): per-agent Technical Operator scopes
 * at the rule, API and grant layers. (The runtime layer is in agentRuntime.test.ts.)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activeAgentGrants, agentScope, isGrantableAgentScope, operatorMayOnAgent, parseAgentScope } from "../shared/agentOperatorScopes";

const g = (scope: string, o: { expiresAt?: Date | null; revokedAt?: Date | null } = {}) => ({ scope, expiresAt: o.expiresAt ?? null, revokedAt: o.revokedAt ?? null });

describe("agent scope strings", () => {
  it("round-trip, and reject anything that is not exactly agent:<key>:<view|run|approve>", () => {
    expect(agentScope("support_scribe", "run")).toBe("agent:support_scribe:run");
    expect(parseAgentScope("agent:support_scribe:approve")).toEqual({ agentKey: "support_scribe", action: "approve" });
    for (const bad of ["agent:x:run", "agent:support_scribe:delete", "agent:Support:run", "agent::run", "agent:support_scribe", "AGENT:support_scribe:run", "backend", "agent:support_scribe:run:extra", "agent:support scribe:run", ""]) {
      expect(parseAgentScope(bad), bad).toBeNull();
      expect(isGrantableAgentScope(bad), bad).toBe(false);
    }
    expect(isGrantableAgentScope("agent:ai_scan_analyst:view")).toBe(true);
    // the longest legal scope still fits the widened column (80)
    expect(agentScope("a".repeat(64), "approve").length).toBeLessThanOrEqual(80);
  });
});

describe("operatorMayOnAgent", () => {
  const grants = [g("agent:agent_a:run"), g("agent:agent_a:view"), g("agent:agent_b:view")];

  it("access to Agent A never gives access to Agent B", () => {
    expect(operatorMayOnAgent("technical_operator", grants, "agent_a", "run")).toBe(true);
    expect(operatorMayOnAgent("technical_operator", grants, "agent_b", "run")).toBe(false);
    expect(operatorMayOnAgent("technical_operator", grants, "agent_b", "view")).toBe(true);
    expect(operatorMayOnAgent("technical_operator", grants, "agent_c", "view")).toBe(false);
  });

  it("each action is its own grant: view is not run, run is not approve", () => {
    expect(operatorMayOnAgent("technical_operator", grants, "agent_a", "approve")).toBe(false);
    expect(operatorMayOnAgent("technical_operator", [g("agent:agent_a:run")], "agent_a", "view")).toBe(false);
    expect(operatorMayOnAgent("technical_operator", [g("agent:agent_a:approve")], "agent_a", "run")).toBe(false);
  });

  it("a platform scope never opens an agent, and a key that merely starts with another's does not match", () => {
    expect(operatorMayOnAgent("technical_operator", [g("backend"), g("infrastructure"), g("full_stack")], "agent_a", "view")).toBe(false);
    expect(operatorMayOnAgent("technical_operator", [g("agent:agent_a_extra:run")], "agent_a", "run")).toBe(false);
  });

  it("expiry and revocation are honoured, to the second", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    expect(operatorMayOnAgent("technical_operator", [g("agent:agent_a:run", { expiresAt: new Date("2026-11-01T11:59:59Z") })], "agent_a", "run", now)).toBe(false);
    expect(operatorMayOnAgent("technical_operator", [g("agent:agent_a:run", { expiresAt: new Date("2026-11-01T12:00:01Z") })], "agent_a", "run", now)).toBe(true);
    expect(operatorMayOnAgent("technical_operator", [g("agent:agent_a:run", { revokedAt: new Date("2026-11-01T10:00:00Z") })], "agent_a", "run", now)).toBe(false);
    // a second, valid grant for the same scope still counts when an older one was revoked
    expect(operatorMayOnAgent("technical_operator", [g("agent:agent_a:run", { revokedAt: new Date() }), g("agent:agent_a:run")], "agent_a", "run")).toBe(true);
  });

  it("admins are not limited; every other role is refused", () => {
    for (const role of ["admin", "super_admin"]) expect(operatorMayOnAgent(role, [], "agent_a", "approve")).toBe(true);
    for (const role of ["client", "developer", "user", "", null, undefined]) expect(operatorMayOnAgent(role as never, grants, "agent_a", "run")).toBe(false);
  });
});

describe("activeAgentGrants", () => {
  it("lists active agent grants grouped by agent, ignoring expired, revoked and platform scopes", () => {
    const out = activeAgentGrants([g("agent:ag_b:view"), g("agent:ag_a:run"), g("agent:ag_a:view"), g("agent:ag_a:approve", { revokedAt: new Date() }), g("agent:ag_c:run", { expiresAt: new Date(Date.now() - 1000) }), g("backend")]);
    expect(out).toEqual([{ agentKey: "ag_a", actions: ["view", "run"] }, { agentKey: "ag_b", actions: ["view"] }]);
  });
});

// ---------------------------------------------------------------------------
// API layer
// ---------------------------------------------------------------------------

const m = vi.hoisted(() => ({
  getScopeGrants: vi.fn(),
  grantOperatorScope: vi.fn(),
  listAiAgents: vi.fn(),
  listAiExecutions: vi.fn(),
  getAiExecutionAgentKey: vi.fn(),
  decideAiExecution: vi.fn(),
  getAiAgentDefinition: vi.fn(),
  appendLoginAudit: vi.fn(async () => undefined),
}));

vi.mock("./db/platformGovernance", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getScopeGrants: m.getScopeGrants, grantOperatorScope: m.grantOperatorScope };
});
vi.mock("./db/srsGovernance", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listAiAgents: m.listAiAgents, listAiExecutions: m.listAiExecutions, getAiExecutionAgentKey: m.getAiExecutionAgentKey, decideAiExecution: m.decideAiExecution, getAiAgentDefinition: m.getAiAgentDefinition };
});
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, appendLoginAudit: m.appendLoginAudit, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 5, kind: "totp", verifiedAt: new Date() }]) };
});

import { appRouter } from "./routers";
import { resetDenialAuditThrottleForTests } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const ctx = (role: string | null): TrpcContext => ({
  user: role ? ({ id: 5, openId: "u", email: "op@example.com", name: "Op", loginMethod: "local", role, organizationId: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as never) : null,
  impersonation: null,
  req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
  res: { clearCookie: () => {} } as TrpcContext["res"],
});
const as = (role: string | null) => appRouter.createCaller(ctx(role)).ops;
const settle = () => new Promise((r) => setTimeout(r, 15));

beforeEach(() => {
  vi.clearAllMocks();
  resetDenialAuditThrottleForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.listAiAgents.mockResolvedValue([{ key: "agent_a", name: "Agent A", status: "active" }, { key: "agent_b", name: "Agent B", status: "active" }]);
  m.listAiExecutions.mockResolvedValue([{ id: 1, agentKey: "agent_a", action: "x", outcome: "completed" }]);
  m.decideAiExecution.mockResolvedValue("ok");
  m.getScopeGrants.mockResolvedValue([]);
});

describe("ops.myAgents", () => {
  it("an operator sees only the agents they hold a grant for, with exactly those actions", async () => {
    m.getScopeGrants.mockResolvedValue([g("agent:agent_a:view"), g("agent:agent_a:run"), g("agent:ghost:view")]);
    expect(await as("technical_operator").myAgents()).toEqual([{ agentKey: "agent_a", name: "Agent A", status: "active", actions: ["view", "run"] }]);
  });
  it("an operator with no agent grants sees nothing; an admin sees every agent", async () => {
    expect(await as("technical_operator").myAgents()).toEqual([]);
    const all = await as("admin").myAgents();
    expect(all.map((a) => a.agentKey)).toEqual(["agent_a", "agent_b"]);
    expect(all[0].actions).toEqual(["view", "run", "approve"]);
  });
  it("customers and anonymous callers are refused", async () => {
    for (const role of ["client", "developer", null]) await expect(as(role).myAgents()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("ops.agentExecutions (data and API layer)", () => {
  it("returns one agent's history only with a view grant for that agent", async () => {
    m.getScopeGrants.mockResolvedValue([g("agent:agent_a:view")]);
    await expect(as("technical_operator").agentExecutions({ agentKey: "agent_a" })).resolves.toHaveLength(1);
    expect(m.listAiExecutions).toHaveBeenCalledWith("agent_a", 100);
  });

  it("Agent A's grant does not read Agent B: refused, nothing queried, and the denial is on record", async () => {
    m.getScopeGrants.mockResolvedValue([g("agent:agent_a:view"), g("agent:agent_a:run"), g("agent:agent_a:approve")]);
    await expect(as("technical_operator").agentExecutions({ agentKey: "agent_b" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.listAiExecutions).not.toHaveBeenCalled();
    await settle();
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "blocked", reason: "denied:ops.agentExecutions" }));
  });

  it("expired, revoked, run-only and unreadable grants all refuse", async () => {
    for (const grants of [[g("agent:agent_a:view", { expiresAt: new Date(Date.now() - 1000) })], [g("agent:agent_a:view", { revokedAt: new Date() })], [g("agent:agent_a:run")]]) {
      m.getScopeGrants.mockResolvedValue(grants);
      await expect(as("technical_operator").agentExecutions({ agentKey: "agent_a" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    m.getScopeGrants.mockRejectedValue(new Error("db down"));
    await expect(as("technical_operator").agentExecutions({ agentKey: "agent_a" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("an admin needs no grant; customers are refused", async () => {
    await expect(as("admin").agentExecutions({ agentKey: "agent_b" })).resolves.toBeTruthy();
    await expect(as("client").agentExecutions({ agentKey: "agent_a" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a malformed agent key before anything is checked", async () => {
    await expect(as("admin").agentExecutions({ agentKey: "../etc" })).rejects.toBeTruthy();
  });
});

describe("ops.decideAgentExecution", () => {
  it("is authorised against the execution's OWN agent", async () => {
    m.getAiExecutionAgentKey.mockResolvedValue("agent_b");
    m.getScopeGrants.mockResolvedValue([g("agent:agent_a:approve")]); // approve on A only
    await expect(as("technical_operator").decideAgentExecution({ executionId: 10, approve: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.decideAiExecution).not.toHaveBeenCalled();
    m.getScopeGrants.mockResolvedValue([g("agent:agent_b:approve")]);
    await expect(as("technical_operator").decideAgentExecution({ executionId: 10, approve: true })).resolves.toEqual({ ok: true });
    expect(m.decideAiExecution).toHaveBeenCalledWith(expect.objectContaining({ executionId: 10, approve: true, userId: 5 }));
  });

  it("view or run is not approve", async () => {
    m.getAiExecutionAgentKey.mockResolvedValue("agent_a");
    m.getScopeGrants.mockResolvedValue([g("agent:agent_a:view"), g("agent:agent_a:run")]);
    await expect(as("technical_operator").decideAgentExecution({ executionId: 1, approve: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("an operator cannot tell a missing execution from one they are not allowed to decide", async () => {
    m.getAiExecutionAgentKey.mockResolvedValue(null);
    await expect(as("technical_operator").decideAgentExecution({ executionId: 999, approve: true })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("no active grant") });
    await expect(as("admin").decideAgentExecution({ executionId: 999, approve: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("surfaces an already decided or not-awaiting execution to someone who is allowed", async () => {
    m.getAiExecutionAgentKey.mockResolvedValue("agent_a");
    m.getScopeGrants.mockResolvedValue([g("agent:agent_a:approve")]);
    m.decideAiExecution.mockResolvedValueOnce("already_decided");
    await expect(as("technical_operator").decideAgentExecution({ executionId: 1, approve: true })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("granting an agent scope (Super Admin only)", () => {
  const grant = (role: string | null, scope: string) => appRouter.createCaller(ctx(role)).adminPlatform.grantOperatorScope({ userId: 7, scope, expiresInDays: 30 } as never);

  it("accepts an agent scope for a registered agent", async () => {
    m.getAiAgentDefinition.mockResolvedValue({ key: "agent_a" });
    m.grantOperatorScope.mockResolvedValue({ id: 1, scope: "agent:agent_a:run" });
    await expect(grant("super_admin", "agent:agent_a:run")).resolves.toMatchObject({ id: 1 });
    expect(m.grantOperatorScope).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, scope: "agent:agent_a:run", grantedByUserId: 5 }));
  });

  it("refuses an agent that is not registered, a malformed scope and an unknown action, granting nothing", async () => {
    m.getAiAgentDefinition.mockResolvedValue(null);
    await expect(grant("super_admin", "agent:ghost:run")).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const bad of ["agent:agent_a:delete", "agent:A:run", "root", "agent:agent_a"]) await expect(grant("super_admin", bad)).rejects.toBeTruthy();
    expect(m.grantOperatorScope).not.toHaveBeenCalled();
  });

  it("an existing platform scope still works, and the target must be a Technical Operator", async () => {
    m.grantOperatorScope.mockResolvedValue({ id: 2 });
    await expect(grant("super_admin", "infrastructure")).resolves.toBeTruthy();
    m.getAiAgentDefinition.mockResolvedValue({ key: "agent_a" });
    m.grantOperatorScope.mockResolvedValue("not_operator");
    await expect(grant("super_admin", "agent:agent_a:run")).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("only a Super Admin can grant", async () => {
    for (const role of ["admin", "technical_operator", "client", null]) await expect(grant(role, "agent:agent_a:run")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
