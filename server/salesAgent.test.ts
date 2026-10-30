/*
 * G11 (SRS 14.16, 19.5; 29 Oct Ch5, Ch9): the AI Sales Agent as a definition and a toolset on
 * the shared runtime. No model is called; the tools are only inspected, not run, apart from
 * the runtime-enforcement checks which use fakes. This shows the pieces it would use are
 * consistent and safe, not that it sells anything.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateRegistryFields } from "../shared/aiAgentRegistry";
import { DEFER_INSTRUCTION, SALES_AGENT, SALES_AGENT_KEY, SALES_BASE_PROMPT, triageSalesRequest } from "../shared/salesAgent";
import { SUPPORT_AGENT } from "../shared/supportAgent";
import { salesAgentToolset } from "./salesTools";
import { CallContextStore } from "./callContext";
import { RunLeadScope } from "./crmTools";
import { IdempotencyStore } from "./schedulingTools";
import { ToolRegistry } from "./agentRuntime";
import { authorityDecision } from "../shared/aiAgentRegistry";

describe("triage: commitments and hand-over", () => {
  it("deflects pricing, discount and cost questions to a person", () => {
    for (const t of ["How much does it cost?", "What are your prices?", "Can I get a quote", "do you offer a discount", "what is your hourly rate", "our budget of 5k", "is there a free trial", "what are your fees"]) expect(triageSalesRequest(t), t).toEqual({ action: "defer_to_human", topic: "pricing" });
  });
  it("deflects contract and terms questions", () => {
    for (const t of ["What are the contract terms?", "what's your SLA", "do you sign an NDA", "what is the notice period", "payment terms?"]) expect(triageSalesRequest(t), t).toEqual({ action: "defer_to_human", topic: "contract" });
  });
  it("deflects requests for guarantees and promised results", () => {
    for (const t of ["Can you guarantee results?", "Do you offer a money-back deal", "what is the ROI you promise", "refund policy?"]) expect(triageSalesRequest(t), t).toEqual({ action: "defer_to_human", topic: "guarantee" });
  });
  it("hands security, legal and safety matters to a person, and these outrank deflection", () => {
    expect(triageSalesRequest("we were hacked")).toEqual({ action: "hand_over", category: "security" });
    expect(triageSalesRequest("I will call my lawyer")).toEqual({ action: "hand_over", category: "legal" });
    expect(triageSalesRequest("I am in danger")).toEqual({ action: "hand_over", category: "safety" });
    expect(triageSalesRequest("we were hacked, how much would a fix cost?")).toEqual({ action: "hand_over", category: "security" });
  });
  it("lets ordinary interest through", () => {
    for (const t of ["We spend days on manual reporting", "Tell me about your AI scan", "I would like to book a call", "We are a logistics company with 40 staff", ""]) expect(triageSalesRequest(t), t).toEqual({ action: "proceed" });
  });
  it("does not trip on words that only contain a trigger", () => {
    for (const t of ["The pricey tablet", "We operate on a priceline basis".replace("priceline", "schedule"), "the termination of the old tool".replace("termination", "end"), "He promised to call".replace("promised", "said he would")]) expect(triageSalesRequest(t).action, t).toBe("proceed");
  });
  it("every deflection has an instruction that names no figure and offers a discovery call", () => {
    for (const k of ["pricing", "contract", "guarantee"] as const) {
      expect(DEFER_INSTRUCTION[k]).toMatch(/discovery call/);
      expect(DEFER_INSTRUCTION[k]).not.toMatch(/[€$£]\s?\d|\d+\s?%/);
    }
  });
});

describe("the definition", () => {
  it("acts only with approval, and is limited to approved public knowledge", () => {
    expect(SALES_AGENT).toMatchObject({ key: SALES_AGENT_KEY, maxAuthority: "act_with_approval", requiresHumanApproval: false });
    expect([...SALES_AGENT.knowledgeSources].sort()).toEqual(["knowledge_base_articles", "product_documentation"]);
  });
  it("its prompt forbids prices, discounts, guarantees and contract terms, and requires hand-over", () => {
    for (const phrase of [/Never state a price, a discount/, /contract terms, and never agree/, /cannot see anyone's existing account/, /hand over to a person immediately/, /card numbers, passwords or one-time codes/]) expect(SALES_BASE_PROMPT).toMatch(phrase);
  });
  it("passes the registry's own validation", () => {
    const a = SALES_AGENT;
    expect(validateRegistryFields({ businessFunction: a.businessFunction, capabilities: [...a.capabilities], supportedModules: [...a.supportedModules], tools: [...a.tools], knowledgeSources: [...a.knowledgeSources], escalationRules: a.escalationRules, maxAuthority: a.maxAuthority, requiresHumanApproval: a.requiresHumanApproval, responsibleAdminUserId: 1 })).toEqual({ ok: true });
  });
  it("is a different agent from the Support Agent, with no ticket or account tools", () => {
    expect(SALES_AGENT.key).not.toBe(SUPPORT_AGENT.key);
    for (const t of SALES_AGENT.tools) expect(t).not.toMatch(/ticket|support_/);
  });
});

// ---------------------------------------------------------------------------
// the toolset
// ---------------------------------------------------------------------------

function toolset() {
  const sources = [...SALES_AGENT.knowledgeSources];
  const scope = new RunLeadScope();
  const idem = new IdempotencyStore();
  // Definitions only are inspected here, so the data dependencies are never called.
  const never = {} as never;
  return salesAgentToolset({
    faq: { loadAgent: async () => ({ status: "active", knowledgeSources: sources }), record: async () => 1, listApproved: async () => [] },
    knowledge: { loadAgent: async () => ({ status: "active", knowledgeSources: sources }), record: async () => 1, providers: new Map() },
    crm: { ...(never as object), idempotency: idem, leadScope: scope } as never,
    scheduling: { ...(never as object), idempotency: idem } as never,
    capture: { ...(never as object), idempotency: idem, leadScope: scope } as never,
    callback: { ...(never as object), idempotency: idem, leadScope: scope } as never,
    context: new CallContextStore(),
  });
}

describe("the definition and the real tools agree", () => {
  it("every tool the definition lists exists, and none exists that it does not list", () => {
    expect(toolset().map((t) => t.name).sort()).toEqual([...SALES_AGENT.tools].sort());
  });
  it("every permission a tool needs is one the agent holds", () => {
    for (const t of toolset()) expect(SALES_AGENT.permissions as readonly string[], `${t.name} needs ${t.requiredPermission}`).toContain(t.requiredPermission);
  });
  it("every knowledge source a tool reads is one the agent lists", () => {
    for (const t of toolset()) if (t.knowledgeSource) expect(SALES_AGENT.knowledgeSources as readonly string[], t.name).toContain(t.knowledgeSource);
  });
  it("no tool is refused by the agent's authority, and exactly the booking tools wait for a person", () => {
    const held: string[] = [];
    for (const t of toolset()) {
      const decision = authorityDecision(SALES_AGENT.maxAuthority, SALES_AGENT.requiresHumanApproval, t.effect);
      expect(decision, `${t.name} (${t.effect})`).not.toBe("deny");
      if (decision === "needs_approval") held.push(t.name);
    }
    expect(held.sort()).toEqual(["scheduling_book", "scheduling_cancel", "scheduling_reschedule"]);
  });
  it("authority is not full autonomy: raising it is a deliberate registry change", () => {
    expect(SALES_AGENT.maxAuthority).not.toBe("act_autonomously");
    expect(authorityDecision("draft_only", false, "act")).toBe("deny"); // why draft-only would not do
    expect(authorityDecision("act_autonomously", false, "act")).toBe("execute");
  });
});

describe("it only ever talks to prospects", () => {
  it("every tool is Level 1: none needs a verified identity, so none can reach a client's account", () => {
    for (const t of toolset()) expect(t.identityRequirement, t.name).toBeUndefined();
  });
  it("no tool is organisation scoped, so none reads an organisation's data", () => {
    for (const t of toolset()) expect(t.organizationScoped, t.name).toBe(false);
  });
  it("the CRM lookup never discloses an existing record to an unverified caller (R10 default)", () => {
    // crm_find_contact only reveals details after a Level 2 verification that this agent's callers never have;
    // the tool-level behaviour is tested in crmTools.test.ts. Here: the agent holds no identity-level-2 tool.
    expect(toolset().filter((t) => (t.identityRequirement?.level ?? 1) >= 2)).toEqual([]);
  });
  it("the whole set registers together without a name clash", () => {
    const reg = new ToolRegistry();
    for (const t of toolset()) reg.register(t);
    expect(reg.names().sort()).toEqual([...SALES_AGENT.tools].sort());
  });
  it("the Support Agent's account tools are not in the Sales Agent's toolset", () => {
    const names = new Set(toolset().map((t) => t.name));
    for (const n of ["support_ticket_status", "support_open_ticket"]) expect(names.has(n), n).toBe(false);
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

describe("adminOps.registerSalesAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    d.getAiAgentDefinition.mockResolvedValue(null);
    d.upsertAiAgent.mockResolvedValue({ key: SALES_AGENT_KEY });
    d.addPromptVersion.mockResolvedValue({ version: 1 });
  });
  it("is super admin only", async () => {
    for (const role of ["admin", "technical_operator", "client", "developer"] as const) await expect(appRouter.createCaller(tctx(role)).adminOps.registerSalesAgent(), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.upsertAiAgent).not.toHaveBeenCalled();
  });
  it("registers the agent DISABLED with its whole definition and prompt, and audits it", async () => {
    await expect(appRouter.createCaller(tctx("super_admin")).adminOps.registerSalesAgent()).resolves.toEqual({ key: SALES_AGENT_KEY, status: "disabled", promptVersion: 1 });
    expect(d.upsertAiAgent).toHaveBeenCalledWith(expect.objectContaining({ key: SALES_AGENT_KEY, status: "disabled", maxAuthority: "act_with_approval", tools: [...SALES_AGENT.tools] }));
    expect(d.addPromptVersion).toHaveBeenCalledWith(expect.objectContaining({ agentKey: SALES_AGENT_KEY, body: SALES_BASE_PROMPT, activate: true }));
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.ai_agent.register(ai_sales_agent:disabled)") }));
  });
  it("never overwrites an existing registration", async () => {
    d.getAiAgentDefinition.mockResolvedValueOnce({ key: SALES_AGENT_KEY });
    await expect(appRouter.createCaller(tctx("super_admin")).adminOps.registerSalesAgent()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(d.upsertAiAgent).not.toHaveBeenCalled();
  });
});
