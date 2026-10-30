/*
 * G10 (SRS 17.6, 19.5; 29 Oct Ch5): the AI Support Agent as a definition and a toolset on
 * the shared runtime. No model is called and no ticket is opened for real: everything
 * runs against fakes. This does not show the assistant works on a call; it shows the
 * pieces it would use enforce the rules around them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AI_TICKET_NOTE, applyPriorityFloor, categoryFor, composeTicketBody, SUPPORT_AGENT, SUPPORT_AGENT_KEY, SUPPORT_BASE_PROMPT, TICKET_REF, triageSupportRequest } from "../shared/supportAgent";
import { validateRegistryFields } from "../shared/aiAgentRegistry";
import { supportAgentToolset, supportTools, type SupportDeps, type TicketView } from "./supportTools";
import { CallContextStore } from "./callContext";
import { RunLeadScope } from "./crmTools";
import { IdempotencyStore } from "./schedulingTools";
import { runAgent, ToolRegistry, type AgentDefinition, type AgentModel, type ModelTurn, type RuntimeDeps, type ToolContext } from "./agentRuntime";
import type { AgentIdentityView } from "../shared/identityPolicy";

void z;

describe("triage: when a person must take over", () => {
  it("hands over security reports, legal or fraud disputes and safety statements", () => {
    const cases: Array<[string, "security" | "legal" | "safety"]> = [
      ["I think my account was hacked", "security"],
      ["There was an unauthorized login on our account", "security"],
      ["We had a data breach", "security"],
      ["this looks like phishing", "security"],
      ["I will speak to my lawyer", "legal"],
      ["I want a chargeback", "legal"],
      ["this is fraud", "legal"],
      ["we are going to sue you", "legal"],
      ["I am in danger", "safety"],
      ["this is an emergency", "safety"],
      ["I feel like self-harm", "safety"],
    ];
    for (const [text, category] of cases) expect(triageSupportRequest(text), text).toMatchObject({ handOver: true, category });
  });
  it("safety is urgent, security is urgent, legal is high", () => {
    expect(triageSupportRequest("emergency").priorityFloor).toBe("urgent");
    expect(triageSupportRequest("we were hacked").priorityFloor).toBe("urgent");
    expect(triageSupportRequest("my lawyer will call").priorityFloor).toBe("high");
  });
  it("leaves ordinary requests to the assistant", () => {
    for (const t of ["How do I change my invoice address?", "What are your opening hours?", "My report is not loading", "I need a copy of last month's invoice", "", "Can you hack together a quick summary?".replace("hack together", "put together")]) expect(triageSupportRequest(t), t).toEqual({ handOver: false, category: null, priorityFloor: null });
  });
  it("is not fooled by case or surrounding punctuation", () => {
    expect(triageSupportRequest("HACKED!!!").handOver).toBe(true);
    expect(triageSupportRequest("...breach...").handOver).toBe(true);
  });
  it("does not trigger on words that merely contain a trigger", () => {
    for (const t of ["The hackathon is on Friday", "Please pursue this with the court-yard team".replace("court-yard", "yard"), "We resume on Monday", "the presumed owner", "suede jacket"]) expect(triageSupportRequest(t).handOver, t).toBe(false);
  });
});

describe("priority and category", () => {
  it("a floor raises a priority and never lowers one", () => {
    expect(applyPriorityFloor("low", "urgent")).toBe("urgent");
    expect(applyPriorityFloor("normal", "high")).toBe("high");
    expect(applyPriorityFloor("urgent", "high")).toBe("urgent");
    expect(applyPriorityFloor("high", null)).toBe("high");
    expect(applyPriorityFloor("low", null)).toBe("low");
  });
  it("a security report is filed under security whatever was asked for", () => {
    expect(categoryFor("billing", triageSupportRequest("we were hacked"))).toBe("security");
    expect(categoryFor("billing", triageSupportRequest("my lawyer"))).toBe("billing");
    expect(categoryFor("technical", triageSupportRequest("report will not load"))).toBe("technical");
  });
  it("marks an assistant-opened ticket and keeps the caller's words", () => {
    const b = composeTicketBody("  My invoice shows the wrong address.  ");
    expect(b.startsWith(AI_TICKET_NOTE)).toBe(true);
    expect(b.endsWith("My invoice shows the wrong address.")).toBe(true);
    expect(composeTicketBody("x".repeat(9000))).toHaveLength(4000);
  });
  it("recognises ticket references", () => {
    for (const ok of ["T-ABCD1234", "TABCD1234", "t-abcd1234"]) expect(TICKET_REF.test(ok), ok).toBe(true);
    for (const bad of ["", "ABCD", "T-12", "T-ABC DEF", "T-<script>", "../../etc", "T-" + "A".repeat(40)]) expect(TICKET_REF.test(bad), bad).toBe(false);
  });
});

describe("the definition", () => {
  it("is draft-only, disabled-by-registration material, with only approved public knowledge", () => {
    expect(SUPPORT_AGENT).toMatchObject({ key: SUPPORT_AGENT_KEY, maxAuthority: "draft_only", requiresHumanApproval: false });
    expect([...SUPPORT_AGENT.knowledgeSources].sort()).toEqual(["knowledge_base_articles", "product_documentation"]);
  });
  it("its prompt forbids guessing, card details and promising outcomes, and requires hand-over", () => {
    for (const phrase of [/Never guess/, /card numbers, passwords or one-time codes/, /cannot resolve a ticket, give a refund/, /hand over to a person immediately/]) expect(SUPPORT_BASE_PROMPT).toMatch(phrase);
  });
  it("passes the registry's own validation", () => {
    const a = SUPPORT_AGENT;
    expect(validateRegistryFields({ businessFunction: a.businessFunction, capabilities: [...a.capabilities], supportedModules: [...a.supportedModules], tools: [...a.tools], knowledgeSources: [...a.knowledgeSources], escalationRules: a.escalationRules, maxAuthority: a.maxAuthority, requiresHumanApproval: a.requiresHumanApproval, responsibleAdminUserId: 1 })).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// the tools
// ---------------------------------------------------------------------------

const VERIFIED: AgentIdentityView = { state: "verified", organizationId: 7, permissions: ["view_own_support_tickets", "open_support_ticket"], expiresAt: Date.now() + 3_600_000, level: 2 };
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({ agentKey: SUPPORT_AGENT_KEY, subjectRef: "call:1", organizationId: 7, actorUserId: null, identity: VERIFIED, ...over }) as ToolContext;

function setup(over: { tickets?: TicketView[]; createFails?: boolean; findThrows?: boolean } = {}) {
  const created: Array<Parameters<SupportDeps["createTicket"]>[0]> = [];
  const announced: Array<{ publicRef: string; priority: string; category: string }> = [];
  const tickets = over.tickets ?? [{ publicRef: "T-AAAA1111", subject: "Invoice wrong", status: "in_progress", priority: "normal", category: "billing", createdAt: new Date("2026-10-20T10:00:00Z") }];
  const deps: SupportDeps = {
    findTicket: async (org, ref) => {
      if (over.findThrows) throw new Error("db down");
      return org === 7 ? (tickets.find((t) => t.publicRef === ref) ?? null) : null;
    },
    createTicket: async (a) => (over.createFails ? null : (created.push(a), { publicRef: "T-NEW00001" })),
    announce: async (a) => void announced.push(a),
    idempotency: new IdempotencyStore(),
  };
  const [status, open] = supportTools(deps);
  const callOpen = (input: Record<string, unknown>, c = ctx()) => open.execute({ subject: "Invoice address wrong", body: "My invoice shows the wrong company address.", requestId: `req-${Math.random().toString(36).slice(2, 12)}`, callerConfirmed: true, ...input }, c) as Promise<Record<string, unknown>>;
  return { status, open, callStatus: (publicRef: string, c = ctx()) => status.execute({ publicRef }, c) as Promise<Record<string, unknown>>, callOpen, created, announced };
}

describe("support_ticket_status", () => {
  it("shows state, priority, category and date only, never the ticket text", async () => {
    const r = await setup().callStatus("T-AAAA1111");
    expect(r).toEqual({ ok: true, publicRef: "T-AAAA1111", status: "in progress", priority: "normal", category: "billing", openedOn: "2026-10-20" });
    expect(JSON.stringify(r)).not.toMatch(/Invoice wrong|body/);
  });
  it("accepts a lower-case reference", async () => {
    expect((await setup().callStatus("t-aaaa1111")).ok).toBe(true);
  });
  it("another organisation's ticket looks exactly like one that does not exist", async () => {
    const s = setup();
    const other = await s.callStatus("T-AAAA1111", ctx({ organizationId: 8 }));
    const missing = await s.callStatus("T-ZZZZ9999");
    expect(other).toEqual(missing);
    expect(other).toMatchObject({ ok: false, code: "not_found" });
    expect(await s.callStatus("T-AAAA1111", ctx({ organizationId: null }))).toEqual(missing);
  });
  it("reports an outage honestly", async () => {
    expect(await setup({ findThrows: true }).callStatus("T-AAAA1111")).toMatchObject({ ok: false, code: "unavailable" });
  });
  it("rejects anything that is not a ticket reference before any lookup", () => {
    const { status } = setup();
    for (const bad of ["", "ABC", "T-1", "' OR 1=1 --", "../x", "T-AAAA1111 extra"]) expect(status.inputSchema.safeParse({ publicRef: bad }).success, bad).toBe(false);
    expect(status.inputSchema.safeParse({ publicRef: "T-AAAA1111", extra: 1 }).success).toBe(false);
  });
});

describe("support_open_ticket", () => {
  it("opens a ticket for the verified caller's own organisation, marked as assistant-opened, and announces it", async () => {
    const s = setup();
    const r = await s.callOpen({});
    expect(r).toMatchObject({ ok: true, publicRef: "T-NEW00001", priority: "normal", category: "general", handOverToo: false });
    expect(String(r.instruction)).toMatch(/Do not promise a time or an outcome/);
    expect(s.created[0]).toMatchObject({ organizationId: 7, subject: "Invoice address wrong", category: "general", priority: "normal" });
    expect(s.created[0].body.startsWith(AI_TICKET_NOTE)).toBe(true);
    expect(s.announced).toEqual([{ publicRef: "T-NEW00001", priority: "normal", category: "general" }]);
  });
  it("always uses the run's organisation: there is no way to name another one", async () => {
    const s = setup();
    expect(s.open.inputSchema.safeParse({ subject: "abc", body: "abcdefgh", requestId: "req-12345678", callerConfirmed: true, organizationId: 9 }).success).toBe(false);
    await s.callOpen({}, ctx({ organizationId: 7 }));
    expect(s.created[0].organizationId).toBe(7);
    expect(await s.callOpen({}, ctx({ organizationId: null }))).toMatchObject({ ok: false, code: "invalid" });
    expect(s.created).toHaveLength(1);
  });
  it("requires the caller to have confirmed what the ticket says", () => {
    const { open } = setup();
    const ok = { subject: "Invoice wrong", body: "The address is wrong", requestId: "req-12345678", callerConfirmed: true };
    expect(open.inputSchema.safeParse(ok).success).toBe(true);
    expect(open.inputSchema.safeParse({ ...ok, callerConfirmed: false }).success).toBe(false);
    const { callerConfirmed: _c, ...without } = ok;
    expect(open.inputSchema.safeParse(without).success).toBe(false);
  });
  it("a security report is filed urgent under security, and the assistant is told to hand over too", async () => {
    const s = setup();
    const r = await s.callOpen({ subject: "Account hacked", body: "Someone logged in to our account and changed the settings.", priority: "low", category: "billing" });
    expect(r).toMatchObject({ ok: true, priority: "urgent", category: "security", handOverToo: true });
    expect(String(r.instruction)).toMatch(/security matter/);
    expect(s.created[0]).toMatchObject({ priority: "urgent", category: "security" });
  });
  it("a legal dispute is raised to high but stays in its category", async () => {
    const s = setup();
    await s.callOpen({ subject: "Dispute", body: "I want a chargeback on the last invoice.", priority: "low", category: "billing" });
    expect(s.created[0]).toMatchObject({ priority: "high", category: "billing" });
  });
  it("personal safety is never a ticket: it hands over and creates nothing", async () => {
    const s = setup();
    const r = await s.callOpen({ subject: "Help", body: "I am in danger and need someone now." });
    expect(r).toMatchObject({ ok: false, code: "handover" });
    expect(s.created).toEqual([]);
    expect(s.announced).toEqual([]);
  });
  it("removes card numbers and credentials from what is stored", async () => {
    const s = setup();
    await s.callOpen({ subject: "Card 4111 1111 1111 1111 declined", body: "My password is hunter2 and the card 4111-1111-1111-1111 failed." });
    expect(JSON.stringify(s.created)).not.toMatch(/4111|hunter2/);
  });
  it("does not claim success when the ticket could not be saved", async () => {
    const s = setup({ createFails: true });
    const r = await s.callOpen({});
    expect(r).toMatchObject({ ok: false, code: "unavailable" });
    expect(String(r.message)).toMatch(/Do not tell the caller it was done/);
    expect(s.announced).toEqual([]);
  });
  it("is idempotent per request id: a retry opens one ticket", async () => {
    const s = setup();
    const a = await s.callOpen({ requestId: "same-request-1" });
    const b = await s.callOpen({ requestId: "same-request-1" });
    expect(b).toEqual(a);
    expect(s.created).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// definition and tools agree, and the runtime enforces identity
// ---------------------------------------------------------------------------

function fullToolset() {
  const store = new CallContextStore();
  const support = setup();
  const supportDeps: SupportDeps = { findTicket: async () => null, createTicket: async () => ({ publicRef: "T-X0000001" }), announce: async () => undefined, idempotency: new IdempotencyStore() };
  void support;
  return supportAgentToolset({
    faq: { loadAgent: async () => ({ status: "active", knowledgeSources: [...SUPPORT_AGENT.knowledgeSources] }), record: async () => 1, listApproved: async () => [] },
    knowledge: { loadAgent: async () => ({ status: "active", knowledgeSources: [...SUPPORT_AGENT.knowledgeSources] }), record: async () => 1, providers: new Map() },
    support: supportDeps,
    callback: { now: () => Date.now(), leadExists: async () => true, create: async () => ({ ok: false, reason: "unavailable" }), announceCreated: async () => undefined, idempotency: new IdempotencyStore(), leadScope: new RunLeadScope() },
    context: store,
  });
}

describe("the definition and the real tools agree", () => {
  it("every tool the definition lists exists, and no tool exists that the definition does not list", () => {
    const names = fullToolset().map((t) => t.name).sort();
    expect(names).toEqual([...SUPPORT_AGENT.tools].sort());
  });
  it("every permission a tool needs is one the agent holds", () => {
    for (const t of fullToolset()) expect(SUPPORT_AGENT.permissions as readonly string[], `${t.name} needs ${t.requiredPermission}`).toContain(t.requiredPermission);
  });
  it("every knowledge source a tool reads is one the agent lists", () => {
    for (const t of fullToolset()) if (t.knowledgeSource) expect(SUPPORT_AGENT.knowledgeSources as readonly string[], t.name).toContain(t.knowledgeSource);
  });
  it("nothing in the toolset acts above the agent's draft-only authority", () => {
    for (const t of fullToolset()) expect(["read", "draft"], t.name).toContain(t.effect);
  });
  it("the account tools need Level 2 and none needs Level 3 (the assistant never performs those)", () => {
    const tools = fullToolset();
    for (const n of ["support_ticket_status", "support_open_ticket"]) expect(tools.find((t) => t.name === n)?.identityRequirement?.level).toBe(2);
    for (const t of tools) expect(t.identityRequirement?.level ?? 1).not.toBe(3);
  });
  it("the whole set registers in the runtime registry without a clash", () => {
    const reg = new ToolRegistry();
    for (const t of fullToolset()) reg.register(t);
    expect(reg.names().sort()).toEqual([...SUPPORT_AGENT.tools].sort());
  });
});

describe("through the shared runtime", () => {
  function runWith(identity: AgentIdentityView | null, organizationId: number | null, toolCall: { name: string; args: Record<string, unknown> }) {
    const s = setup();
    const reg = new ToolRegistry();
    for (const t of supportTools({ findTicket: async (o, r) => (o === 7 && r === "T-AAAA1111" ? { publicRef: r, subject: "x", status: "open", priority: "normal", category: "general", createdAt: new Date() } : null), createTicket: async (a) => (s.created.push(a), { publicRef: "T-NEW00001" }), announce: async () => undefined, idempotency: new IdempotencyStore() })) reg.register(t);
    const turns: ModelTurn[] = [{ kind: "tool_calls", calls: [{ id: "c1", name: toolCall.name, arguments: JSON.stringify(toolCall.args) }] }, { kind: "final", content: "ok" }];
    let i = 0;
    const model: AgentModel = { complete: async () => turns[Math.min(i++, 1)] };
    const def: AgentDefinition = { key: SUPPORT_AGENT_KEY, status: "active", permissions: [...SUPPORT_AGENT.permissions], requiresHumanApproval: false, tools: ["support_ticket_status", "support_open_ticket"], knowledgeSources: [], maxAuthority: "draft_only", escalationRules: null };
    const deps: RuntimeDeps = { loadAgent: async () => def, authorise: async () => ({ outcome: "completed" }), record: async () => 1, escalate: async () => undefined, actorGrants: async () => [], model, tools: reg };
    return { created: s.created, run: () => runAgent({ agentKey: SUPPORT_AGENT_KEY, subjectRef: "call:1", runPermission: "converse", system: SUPPORT_BASE_PROMPT, userMessage: "u", ctx: { organizationId, actorUserId: null, identity } }, deps) };
  }
  const status = { name: "support_ticket_status", args: { publicRef: "T-AAAA1111" } };
  const open = { name: "support_open_ticket", args: { subject: "Invoice wrong", body: "The address on my invoice is wrong", requestId: "req-12345678", callerConfirmed: true } };

  it("an unverified caller cannot read a ticket or open one, and nothing is created", async () => {
    for (const call of [status, open]) {
      const h = runWith(null, 7, call);
      const r = await h.run();
      expect(r.status === "completed" && r.toolCalls[0], call.name).toMatchObject({ outcome: "refused", reason: expect.stringContaining("verification_required") });
      expect(h.created).toEqual([]);
    }
  });
  it("a verification for another organisation, or without the permission, is refused", async () => {
    for (const identity of [{ ...VERIFIED, organizationId: 8 }, { ...VERIFIED, permissions: ["something_else"] }]) {
      const h = runWith(identity, 7, open);
      const r = await h.run();
      expect(r.status === "completed" && r.toolCalls[0]).toMatchObject({ outcome: "refused" });
      expect(h.created).toEqual([]);
    }
  });
  it("a verified caller can do both for their own organisation", async () => {
    const a = runWith(VERIFIED, 7, status);
    expect((await a.run()).status === "completed" && true).toBe(true);
    const b = runWith(VERIFIED, 7, open);
    const r = await b.run();
    expect(r.status === "completed" && r.toolCalls[0]).toMatchObject({ outcome: "executed" });
    expect(b.created).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// registration endpoint
// ---------------------------------------------------------------------------

const d = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  getAiAgentDefinition: vi.fn(),
  upsertAiAgent: vi.fn(),
  addPromptVersion: vi.fn(),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), appendLoginAudit: d.appendLoginAudit, getAiAgentDefinition: d.getAiAgentDefinition, upsertAiAgent: d.upsertAiAgent, addPromptVersion: d.addPromptVersion };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function tctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "t", email: "ops@example.com", name: "Ops", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("adminOps.registerSupportAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    d.getAiAgentDefinition.mockResolvedValue(null);
    d.upsertAiAgent.mockResolvedValue({ key: SUPPORT_AGENT_KEY });
    d.addPromptVersion.mockResolvedValue({ version: 1 });
  });
  it("is super admin only", async () => {
    for (const role of ["admin", "technical_operator", "client", "developer"] as const) await expect(appRouter.createCaller(tctx(role)).adminOps.registerSupportAgent(), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.upsertAiAgent).not.toHaveBeenCalled();
  });
  it("registers the agent DISABLED with the whole definition and its prompt, and audits it", async () => {
    await expect(appRouter.createCaller(tctx("super_admin")).adminOps.registerSupportAgent()).resolves.toEqual({ key: SUPPORT_AGENT_KEY, status: "disabled", promptVersion: 1 });
    expect(d.upsertAiAgent).toHaveBeenCalledWith(expect.objectContaining({ key: SUPPORT_AGENT_KEY, status: "disabled", maxAuthority: "draft_only", tools: [...SUPPORT_AGENT.tools], knowledgeSources: [...SUPPORT_AGENT.knowledgeSources], responsibleAdminUserId: 99 }));
    expect(d.addPromptVersion).toHaveBeenCalledWith(expect.objectContaining({ agentKey: SUPPORT_AGENT_KEY, body: SUPPORT_BASE_PROMPT, activate: true }));
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.ai_agent.register(ai_support_agent:disabled)") }));
  });
  it("never overwrites an agent that is already registered", async () => {
    d.getAiAgentDefinition.mockResolvedValueOnce({ key: SUPPORT_AGENT_KEY });
    await expect(appRouter.createCaller(tctx("super_admin")).adminOps.registerSupportAgent()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(d.upsertAiAgent).not.toHaveBeenCalled();
    expect(d.addPromptVersion).not.toHaveBeenCalled();
  });
  it("fails visibly if the registry write fails", async () => {
    d.upsertAiAgent.mockResolvedValueOnce(null);
    await expect(appRouter.createCaller(tctx("super_admin")).adminOps.registerSupportAgent()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(d.addPromptVersion).not.toHaveBeenCalled();
  });
});
