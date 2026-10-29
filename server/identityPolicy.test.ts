/*
 * R10 (29 Oct Doc 1 Ch6.2, Appendix E.1): the three-level identity policy. The
 * state machine and the authorisation rules are pure; the last section shows the
 * shared agent runtime enforcing them per tool. This does not build the
 * verification flow (R11): nothing here sends a link or signs anyone in.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  authorizeOperation,
  completeVerification,
  effectiveState,
  invalidateVerification,
  newVerification,
  startVerification,
  toAgentView,
  VERIFICATION_RULES as R,
  type AgentIdentityView,
  type VerificationRecord,
  type VerificationResult,
} from "../shared/identityPolicy";
import { runAgent, ToolRegistry, type AgentDefinition, type AgentModel, type AgentTool, type ModelTurn, type RuntimeDeps } from "./agentRuntime";

const T0 = 1_800_000_000_000;
const MIN = 60_000;
const result = (over: Partial<VerificationResult> = {}): VerificationResult => ({ nonce: "n1", interactionRef: "call:1", accountUserId: 42, organizationId: 7, permissions: ["read_own_invoices"], ...over });
const started = (): VerificationRecord => {
  const t = startVerification(newVerification("call:1"), T0);
  if (!t.ok) throw new Error("setup");
  return t.record;
};
const verified = (): VerificationRecord => {
  const t = completeVerification(started(), result(), T0 + MIN);
  if (!t.ok) throw new Error("setup");
  return t.record;
};

describe("verification state machine", () => {
  it("runs unverified, pending, verified, and exposes the actual state", () => {
    const rec = newVerification("call:1");
    expect(effectiveState(rec, T0)).toBe("unverified");
    const p = startVerification(rec, T0);
    expect(p).toMatchObject({ ok: true, audit: "verification.started" });
    expect(effectiveState((p as { record: VerificationRecord }).record, T0)).toBe("pending");
    const v = verified();
    expect(v).toMatchObject({ state: "verified", accountUserId: 42, organizationId: 7, permissions: ["read_own_invoices"] });
    expect(effectiveState(v, T0 + 2 * MIN)).toBe("verified");
  });

  it("a verification expires, and so does one the customer never finished", () => {
    expect(effectiveState(verified(), T0 + MIN + R.verifiedTtlMs)).toBe("expired");
    expect(effectiveState(verified(), T0 + MIN + R.verifiedTtlMs - 1)).toBe("verified");
    expect(effectiveState(started(), T0 + R.pendingTtlMs)).toBe("expired");
    const late = completeVerification(started(), result(), T0 + R.pendingTtlMs + 1);
    expect(late).toMatchObject({ ok: false, reason: "expired" });
    expect((late as { record: VerificationRecord }).record.state).toBe("expired");
  });

  it("completing without starting, or for a different interaction, fails and never verifies", () => {
    expect(completeVerification(newVerification("call:1"), result(), T0)).toMatchObject({ ok: false, reason: "not_started" });
    const wrong = completeVerification(started(), result({ interactionRef: "call:2" }), T0 + MIN);
    expect(wrong).toMatchObject({ ok: false, reason: "wrong_interaction" });
    expect((wrong as { record: VerificationRecord }).record).toMatchObject({ state: "failed", accountUserId: null, permissions: [] });
  });

  it("a one-time token used twice is a replay and is refused (also after a success)", () => {
    const ok = verified();
    const again = completeVerification(ok, result(), T0 + 2 * MIN);
    expect(again).toMatchObject({ ok: false, reason: "replayed" });
    expect((again as { record: VerificationRecord }).record.state).toBe("failed"); // the replay does not keep the verification alive
    // a fresh start with a fresh token works
    const restart = startVerification({ ...ok, state: "expired" }, T0 + 3 * MIN);
    expect(restart.ok).toBe(true);
    expect(completeVerification((restart as { record: VerificationRecord }).record, result({ nonce: "n2" }), T0 + 4 * MIN).ok).toBe(true);
  });

  it("an authenticated account with no permission for AI-assisted operations is 'insufficient permission', not verified", () => {
    const t = completeVerification(started(), result({ permissions: [] }), T0 + MIN);
    expect(t).toMatchObject({ ok: false, reason: "no_permission" });
    expect((t as { record: VerificationRecord }).record.state).toBe("insufficient_permission");
    expect((t as { record: VerificationRecord }).record.permissions).toEqual([]);
  });

  it("repeated failures lock the interaction out, and a locked interaction refuses both starting and completing", () => {
    let rec = started();
    for (let i = 0; i < R.maxFailures; i++) {
      const t = completeVerification(rec, result({ nonce: `bad${i}`, interactionRef: "call:other" }), T0 + MIN);
      rec = (t as { record: VerificationRecord }).record;
      if (i < R.maxFailures - 1) rec = { ...rec, state: "pending", pendingExpiresAt: T0 + R.pendingTtlMs }; // the customer tries again
    }
    expect(rec.lockedUntil).toBe(T0 + MIN + R.lockoutMs);
    expect(startVerification(rec, T0 + 2 * MIN)).toMatchObject({ ok: false, reason: "locked_out" });
    expect(completeVerification({ ...rec, state: "pending", pendingExpiresAt: T0 + R.pendingTtlMs }, result({ nonce: "good" }), T0 + 2 * MIN)).toMatchObject({ ok: false, reason: "locked_out" });
    expect(startVerification(rec, T0 + MIN + R.lockoutMs).ok).toBe(true); // lockout ends
  });

  it("starting is rate limited so a caller cannot make the system spam an inbox, and one cannot be started while another is open", () => {
    let rec = newVerification("call:1");
    expect(startVerification(startVerification(rec, T0).ok ? (startVerification(rec, T0) as { record: VerificationRecord }).record : rec, T0 + 1)).toMatchObject({ ok: false, reason: "already_pending" });
    for (let i = 0; i < R.maxStartsPerWindow; i++) {
      const t = startVerification(rec, T0 + i * 1000);
      expect(t.ok, String(i)).toBe(true);
      rec = { ...(t as { record: VerificationRecord }).record, state: "expired" }; // each one lapses
    }
    expect(startVerification(rec, T0 + 10_000)).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(startVerification(rec, T0 + R.startWindowMs + 5000).ok).toBe(true);
  });

  it("a security event voids a verification immediately and clears what it unlocked", () => {
    const t = invalidateVerification(verified(), "password_changed");
    expect(t).toMatchObject({ ok: true, audit: "verification.invalidated:password_changed" });
    expect(t.record).toMatchObject({ state: "unverified", accountUserId: null, organizationId: null, permissions: [], verifiedExpiresAt: null });
  });

  it("every transition names an audit event", () => {
    for (const t of [startVerification(newVerification("c"), T0), completeVerification(started(), result(), T0 + MIN), completeVerification(started(), result({ interactionRef: "x" }), T0 + MIN), invalidateVerification(verified(), "x")]) {
      expect(t.audit).toMatch(/^verification\./);
    }
  });
});

describe("what the AI receives", () => {
  it("only the outcome and the permitted level: no token, no account credential, and never Level 3", () => {
    const view = toAgentView(verified(), T0 + 2 * MIN);
    expect(view).toEqual({ state: "verified", organizationId: 7, permissions: ["read_own_invoices"], expiresAt: T0 + MIN + R.verifiedTtlMs, level: 2 });
    expect(JSON.stringify(view)).not.toMatch(/n1|nonce|accountUserId|42/);
    expect(view.level).not.toBe(3);
    for (const rec of [newVerification("c"), started(), invalidateVerification(verified(), "x").record]) {
      expect(toAgentView(rec, T0 + 2 * MIN)).toMatchObject({ level: 1, permissions: [], organizationId: null, expiresAt: null });
    }
    expect(toAgentView(verified(), T0 + MIN + R.verifiedTtlMs).state).toBe("expired");
  });
});

describe("authorizeOperation", () => {
  const view = (over: Partial<AgentIdentityView> = {}): AgentIdentityView => ({ state: "verified", organizationId: 7, permissions: ["read_own_invoices"], expiresAt: T0 + 10 * MIN, level: 2, ...over });
  const L2 = { level: 2 as const, permission: "read_own_invoices" };
  const run = { organizationId: 7 };

  it("Level 1 needs nothing", () => {
    for (const id of [null, undefined, view({ state: "failed" })]) expect(authorizeOperation({ level: 1 }, id, run, T0)).toEqual({ allowed: true });
  });

  it("Level 3 is never performed by the AI, however verified the caller is", () => {
    expect(authorizeOperation({ level: 3 }, view(), run, T0)).toEqual({ allowed: false, reason: "ai_cannot_perform", next: "portal_or_human" });
    expect(authorizeOperation({ level: 3, permission: "change_bank_details" }, view({ permissions: ["change_bank_details"] }), run, T0)).toMatchObject({ allowed: false, reason: "ai_cannot_perform" });
  });

  it("Level 2 allows a live verification covering the permission in the run's organisation", () => {
    expect(authorizeOperation(L2, view(), run, T0)).toEqual({ allowed: true });
  });

  it("Level 2 reports the actual reason and the safe next step for each state", () => {
    expect(authorizeOperation(L2, null, run, T0)).toEqual({ allowed: false, reason: "verification_required", next: "start_verification" });
    expect(authorizeOperation(L2, view({ state: "unverified" }), run, T0)).toMatchObject({ reason: "verification_required" });
    expect(authorizeOperation(L2, view({ state: "pending" }), run, T0)).toEqual({ allowed: false, reason: "verification_pending", next: "wait" });
    expect(authorizeOperation(L2, view({ state: "expired" }), run, T0)).toEqual({ allowed: false, reason: "verification_expired", next: "start_verification" });
    expect(authorizeOperation(L2, view({ state: "failed" }), run, T0)).toEqual({ allowed: false, reason: "verification_failed", next: "retry_verification" });
    expect(authorizeOperation(L2, view({ state: "insufficient_permission" }), run, T0)).toEqual({ allowed: false, reason: "insufficient_permission", next: "portal_or_human" });
  });

  it("a verification that has run out of time stops working even if its state still says verified", () => {
    expect(authorizeOperation(L2, view({ expiresAt: T0 + 1000 }), run, T0)).toEqual({ allowed: true });
    expect(authorizeOperation(L2, view({ expiresAt: T0 + 1000 }), run, T0 + 1000)).toMatchObject({ allowed: false, reason: "verification_expired" });
  });

  it("the verified permission must cover the operation, and an empty set covers nothing", () => {
    expect(authorizeOperation({ level: 2, permission: "read_own_projects" }, view(), run, T0)).toMatchObject({ allowed: false, reason: "insufficient_permission" });
    expect(authorizeOperation(L2, view({ permissions: [] }), run, T0)).toMatchObject({ allowed: false, reason: "insufficient_permission" });
  });

  it("the verified account's organisation must be the one this run serves: no reaching into another client", () => {
    expect(authorizeOperation(L2, view({ organizationId: 8 }), run, T0)).toEqual({ allowed: false, reason: "organization_mismatch", next: "none" });
    expect(authorizeOperation(L2, view(), { organizationId: null }, T0)).toMatchObject({ reason: "organization_mismatch" });
    expect(authorizeOperation(L2, view({ organizationId: null }), run, T0)).toMatchObject({ reason: "organization_mismatch" });
    expect(authorizeOperation({ ...L2, organizationScoped: false }, view({ organizationId: 8 }), run, T0)).toEqual({ allowed: true });
  });
});

// ---------------------------------------------------------------------------
// the shared runtime enforces it per tool
// ---------------------------------------------------------------------------

describe("identity levels in the shared runtime", () => {
  const tool = (name: string, req: AgentTool["identityRequirement"]) => {
    const ran: string[] = [];
    const t: AgentTool = { name, description: name, parameters: { type: "object" }, inputSchema: z.object({}).strict(), effect: "read", requiredPermission: "converse", organizationScoped: false, identityRequirement: req, execute: async () => (ran.push(name), { ok: true }) };
    return { t, ran };
  };
  function go(identity: AgentIdentityView | null | undefined, name: string, now = () => T0) {
    const pub = tool("get_opening_hours", undefined);
    const inv = tool("get_invoice_status", { level: 2, permission: "read_own_invoices" });
    const bank = tool("change_bank_details", { level: 3 });
    const reg = new ToolRegistry().register(pub.t).register(inv.t).register(bank.t);
    const turns: ModelTurn[] = [{ kind: "tool_calls", calls: [{ id: "c1", name, arguments: "{}" }] }, { kind: "final", content: "done" }];
    let i = 0;
    const seen: string[] = [];
    const model: AgentModel = { complete: async (r) => (seen.push(JSON.stringify(r.messages)), turns[Math.min(i++, 1)]) };
    const def: AgentDefinition = { key: "reception", status: "active", permissions: ["converse"], requiresHumanApproval: false, tools: reg.names(), knowledgeSources: [], maxAuthority: "act_autonomously", escalationRules: null };
    const deps: RuntimeDeps = { loadAgent: async () => def, authorise: async () => ({ outcome: "completed" }), record: async () => 1, escalate: async () => undefined, actorGrants: async () => [], model, tools: reg, now };
    return { ran: [...pub.ran, ...inv.ran, ...bank.ran], pub, inv, bank, seen, run: () => runAgent({ agentKey: "reception", subjectRef: "call:1", runPermission: "converse", system: "s", userMessage: "u", ctx: { organizationId: 7, actorUserId: null, identity } }, deps) };
  }
  const live: AgentIdentityView = { state: "verified", organizationId: 7, permissions: ["read_own_invoices"], expiresAt: T0 + 10 * MIN, level: 2 };

  it("an unverified caller can use public tools but not account tools, and the model is told the next safe step", async () => {
    const pub = go(null, "get_opening_hours");
    await pub.run();
    expect(pub.pub.ran).toEqual(["get_opening_hours"]);
    const inv = go(null, "get_invoice_status");
    const r = await inv.run();
    expect(inv.inv.ran).toEqual([]);
    expect(r.status === "completed" && r.toolCalls[0]).toMatchObject({ outcome: "refused", reason: expect.stringContaining("verification_required") });
    expect(inv.seen[1]).toContain("start verification");
  });

  it("a verified caller reaches the account tool for their own organisation", async () => {
    const h = go(live, "get_invoice_status");
    await h.run();
    expect(h.inv.ran).toEqual(["get_invoice_status"]);
  });

  it("another organisation's verification, a missing permission, or a failed state do not open it", async () => {
    for (const identity of [{ ...live, organizationId: 8 }, { ...live, permissions: ["read_own_projects"] }, { ...live, state: "failed" as const }, { ...live, state: "pending" as const }]) {
      const h = go(identity, "get_invoice_status");
      await h.run();
      expect(h.inv.ran, JSON.stringify(identity)).toEqual([]);
    }
  });

  it("Level 3 is never executed, even for a verified caller and an autonomous agent with approval switched off", async () => {
    const h = go(live, "change_bank_details");
    const r = await h.run();
    expect(h.bank.ran).toEqual([]);
    expect(r.status === "completed" && r.toolCalls[0]).toMatchObject({ outcome: "refused", reason: expect.stringContaining("ai_cannot_perform") });
    expect(h.seen[1]).toContain("portal or human");
  });

  it("a verification that expires mid-run stops the next call", async () => {
    let t = T0;
    const h = go(live, "get_invoice_status", () => t);
    t = T0 + 11 * MIN; // past the identity's expiry before the call is made
    await h.run();
    expect(h.inv.ran).toEqual([]);
  });
});
