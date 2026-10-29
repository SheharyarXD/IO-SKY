/*
 * G05 (SRS 19.17, 19.20; 29 Oct Doc 1 ACC-36): permission-aware knowledge
 * retrieval. Nothing here uses a database, a vector store or a provider.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { audienceForRole, authorizeRetrieval, filterRetrieved, SOURCE_POLICY } from "../shared/knowledgeAccess";
import { KNOWLEDGE_SOURCES } from "../shared/aiAgentRegistry";
import { knowledgeTools, retrieveKnowledge, type KnowledgeDeps, type KnowledgeItem, type KnowledgeProvider } from "./knowledgeStore";
import { clientDocumentationProvider, documentToKnowledgeItem } from "./knowledgeProviders";
import { runAgent, ToolRegistry, type AgentModel, type ModelTurn, type RuntimeDeps } from "./agentRuntime";

// ---------------------------------------------------------------------------
// pure policy
// ---------------------------------------------------------------------------

describe("source policy", () => {
  it("covers exactly the SRS 19.20 sources", () => {
    expect(Object.keys(SOURCE_POLICY).sort()).toEqual([...KNOWLEDGE_SOURCES].sort());
  });
  it("organisation data is organisation-scoped and never public", () => {
    for (const s of ["ai_scan_reports", "client_documentation", "project_documentation", "operational_data"] as const) {
      expect(SOURCE_POLICY[s].organizationScoped, s).toBe(true);
      expect(SOURCE_POLICY[s].minAudience, s).not.toBe("public");
    }
  });
});

describe("audienceForRole", () => {
  it("staff are internal, a client is a client, everyone else the lowest", () => {
    for (const r of ["admin", "super_admin", "technical_operator"]) expect(audienceForRole(r)).toBe("internal");
    expect(audienceForRole("client")).toBe("client");
    for (const r of ["developer", "user", "", null, undefined, "root"]) expect(audienceForRole(r as never)).toBe("public");
  });
});

describe("authorizeRetrieval", () => {
  const base = { source: "client_documentation", agentSources: ["client_documentation"], audience: "client", organizationId: 5 };
  it("allows a listed source for a high enough audience with an organisation", () => {
    expect(authorizeRetrieval(base)).toMatchObject({ allowed: true });
  });
  it("refuses each way it can fail, with the reason", () => {
    expect(authorizeRetrieval({ ...base, source: "made_up" })).toEqual({ allowed: false, reason: "unknown_source" });
    expect(authorizeRetrieval({ ...base, agentSources: ["business_rules"] })).toEqual({ allowed: false, reason: "source_not_granted" });
    expect(authorizeRetrieval({ ...base, audience: "public" })).toEqual({ allowed: false, reason: "audience_too_low" });
    expect(authorizeRetrieval({ ...base, audience: "nonsense" })).toEqual({ allowed: false, reason: "audience_too_low" });
    expect(authorizeRetrieval({ ...base, organizationId: null })).toEqual({ allowed: false, reason: "organization_required" });
  });
  it("a platform-wide public source needs no organisation", () => {
    expect(authorizeRetrieval({ source: "product_documentation", agentSources: ["product_documentation"], audience: "public", organizationId: null })).toMatchObject({ allowed: true });
  });
  it("internal sources are not offered to a client or the public even when listed", () => {
    for (const audience of ["public", "client"]) expect(authorizeRetrieval({ source: "internal_procedures", agentSources: ["internal_procedures"], audience, organizationId: 5 })).toEqual({ allowed: false, reason: "audience_too_low" });
  });
});

describe("filterRetrieved", () => {
  const item = (organizationId: number | null, visibility: string) => ({ organizationId, visibility, id: `${organizationId}-${visibility}` });
  it("drops another organisation's items and counts them apart from withheld ones", () => {
    const r = filterRetrieved([item(5, "client"), item(6, "client"), item(null, "client"), item(5, "internal")], { audience: "client", organizationId: 5, organizationScoped: true });
    expect(r.kept.map((i) => i.id)).toEqual(["5-client"]);
    expect(r).toMatchObject({ crossOrganization: 2, withheld: 1 });
  });
  it("an item above the audience is withheld; an unknown visibility is withheld too", () => {
    expect(filterRetrieved([item(5, "internal"), item(5, "secret"), item(5, "public"), item(5, "client")], { audience: "client", organizationId: 5, organizationScoped: true })).toMatchObject({ withheld: 2 });
  });
  it("a platform-wide source may not return an item that belongs to some other organisation", () => {
    const r = filterRetrieved([item(null, "public"), item(9, "public")], { audience: "public", organizationId: 5, organizationScoped: false });
    expect(r.kept).toHaveLength(1);
    expect(r.crossOrganization).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// store
// ---------------------------------------------------------------------------

const doc = (id: number, organizationId: number | null, visibility: KnowledgeItem["visibility"] = "client", snippet = "x"): KnowledgeItem => ({ id: `doc:${id}`, title: `Doc ${id}`, snippet, sourceRef: `client_documents:${id}`, visibility, organizationId });

function store(over: { sources?: string[]; status?: string; items?: KnowledgeItem[]; search?: KnowledgeProvider["search"]; loadAgent?: KnowledgeDeps["loadAgent"]; withProvider?: boolean } = {}) {
  const records: Array<{ action: string; detail: string }> = [];
  const search = vi.fn(over.search ?? (async () => over.items ?? []));
  const providers = new Map<string, KnowledgeProvider>(over.withProvider === false ? [] : [["client_documentation", { source: "client_documentation", search }]]);
  const deps: KnowledgeDeps = {
    loadAgent: over.loadAgent ?? (async () => ({ status: over.status ?? "active", knowledgeSources: over.sources ?? ["client_documentation"] })),
    record: async (a) => (records.push({ action: a.action, detail: a.detail }), 1),
    providers,
  };
  return { deps, records, search };
}
const req = (over: Record<string, unknown> = {}) => ({ agentKey: "scribe", source: "client_documentation", query: "contract", subjectRef: "ticket:1", ctx: { organizationId: 5, audience: "client" as const }, ...over });

describe("retrieveKnowledge", () => {
  it("returns permitted items only, without the organisation id, with snippets clipped, and records the retrieval", async () => {
    const s = store({ items: [doc(1, 5, "client", "y".repeat(900)), doc(2, 5, "internal")] });
    const r = await retrieveKnowledge(req(), s.deps);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).not.toHaveProperty("organizationId");
    expect(r.items[0].snippet).toHaveLength(300);
    expect(r.withheld).toBe(1);
    expect(s.records.map((x) => x.action)).toEqual(["knowledge:client_documentation"]);
    expect(s.records[0].detail).toBe("returned=1; withheld=1; querylen=8");
  });

  it("the audit record never contains the query text or any content", async () => {
    const s = store({ items: [doc(1, 5, "client", "TOP-SECRET-CONTENT")] });
    await retrieveKnowledge(req({ query: "acme confidential merger" }), s.deps);
    expect(JSON.stringify(s.records)).not.toMatch(/acme|merger|TOP-SECRET/i);
  });

  it("passes the run's organisation and audience to the provider, never anything the caller invents", async () => {
    const s = store();
    await retrieveKnowledge(req({ ctx: { organizationId: 5, audience: "internal" } }), s.deps);
    expect(s.search).toHaveBeenCalledWith({ query: "contract", organizationId: 5, audience: "internal", limit: 5 });
  });

  it("clamps the limit", async () => {
    const s = store();
    await retrieveKnowledge(req({ limit: 9999 }), s.deps);
    await retrieveKnowledge(req({ limit: -4 }), s.deps);
    expect(s.search.mock.calls.map((c) => c[0].limit)).toEqual([10, 1]);
  });

  it("an organisation's items from a misbehaving provider are dropped, never returned, and the incident is recorded", async () => {
    const s = store({ items: [doc(1, 5), doc(2, 6), doc(3, 7)] });
    const r = await retrieveKnowledge(req(), s.deps);
    expect(r.status === "ok" && r.items.map((i) => i.id)).toEqual(["doc:1"]);
    expect(s.records.map((x) => x.action)).toContain("knowledge_cross_organization_blocked:client_documentation");
    expect(s.records.find((x) => x.action.startsWith("knowledge_cross"))?.detail).toBe("blocked=2");
  });

  it("denies, without calling the provider, when the agent was not granted the source (including after a revocation)", async () => {
    const s = store({ sources: ["business_rules"] });
    expect(await retrieveKnowledge(req(), s.deps)).toEqual({ status: "denied", reason: "source_not_granted" });
    expect(s.search).not.toHaveBeenCalled();
    expect(s.records[0].action).toBe("knowledge_denied:client_documentation");

    // the registry is read on every call: granted, then revoked
    let sources = ["client_documentation"];
    const live = store({ loadAgent: async () => ({ status: "active", knowledgeSources: sources }) });
    expect((await retrieveKnowledge(req(), live.deps)).status).toBe("ok");
    sources = [];
    expect(await retrieveKnowledge(req(), live.deps)).toEqual({ status: "denied", reason: "source_not_granted" });
  });

  it("denies for an unknown, disabled or unreadable agent registry (fails closed)", async () => {
    expect(await retrieveKnowledge(req(), store({ loadAgent: async () => null }).deps)).toEqual({ status: "denied", reason: "agent_unavailable" });
    expect(await retrieveKnowledge(req(), store({ status: "disabled" }).deps)).toEqual({ status: "denied", reason: "agent_unavailable" });
    expect(await retrieveKnowledge(req(), store({ loadAgent: async () => { throw new Error("db down"); } }).deps)).toEqual({ status: "denied", reason: "agent_unavailable" });
  });

  it("denies a low audience and a missing organisation; an unstated audience is treated as public", async () => {
    expect(await retrieveKnowledge(req({ ctx: { organizationId: 5, audience: "public" } }), store().deps)).toEqual({ status: "denied", reason: "audience_too_low" });
    expect(await retrieveKnowledge(req({ ctx: { organizationId: 5 } }), store().deps)).toEqual({ status: "denied", reason: "audience_too_low" });
    expect(await retrieveKnowledge(req({ ctx: { organizationId: null, audience: "internal" } }), store().deps)).toEqual({ status: "denied", reason: "organization_required" });
  });

  it("rejects an empty, tiny or oversized query before anything else", async () => {
    for (const q of ["", " ", "a", "x".repeat(201)]) expect(await retrieveKnowledge(req({ query: q }), store().deps)).toEqual({ status: "denied", reason: "invalid_query" });
  });

  it("a source with no data behind it is 'unavailable', not an empty success", async () => {
    const s = store({ withProvider: false });
    expect(await retrieveKnowledge(req(), s.deps)).toEqual({ status: "unavailable" });
    expect(s.records[0].action).toBe("knowledge_unavailable:client_documentation");
  });

  it("a provider failure becomes a generic error and its message is not passed on", async () => {
    const s = store({ search: async () => { throw new Error("relation client_documents does not exist at 10.0.0.5"); } });
    const r = await retrieveKnowledge(req(), s.deps);
    expect(r).toEqual({ status: "error" });
    expect(JSON.stringify(r)).not.toContain("10.0.0.5");
  });

  it("a failing history write does not break retrieval", async () => {
    const s = store({ items: [doc(1, 5)] });
    s.deps.record = async () => { throw new Error("history down"); };
    expect((await retrieveKnowledge(req(), s.deps)).status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// document provider
// ---------------------------------------------------------------------------

describe("client_documentation provider", () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: 1, organizationId: 5, name: "MSA", category: "contracts", documentType: "contract", version: 2, status: "approved", ...over }) as never;

  it("a document is client-visible only if it is approved AND the matrix opens its type to clients", () => {
    const allowed = new Set(["contract"]);
    expect(documentToKnowledgeItem(row(), allowed).visibility).toBe("client");
    expect(documentToKnowledgeItem(row({ documentType: "internal_note" }), allowed).visibility).toBe("internal");
    expect(documentToKnowledgeItem(row({ status: "pending_review" }), allowed).visibility).toBe("internal");
    expect(documentToKnowledgeItem(row({ status: "rejected" }), allowed).visibility).toBe("internal");
  });

  it("when the matrix cannot be read, typed documents are internal (fails closed); untyped follow the organisation rule", () => {
    expect(documentToKnowledgeItem(row(), null).visibility).toBe("internal");
    expect(documentToKnowledgeItem(row({ documentType: null }), null).visibility).toBe("client");
  });

  it("only searches inside the run's own organisation and never without one", async () => {
    const searchDocuments = vi.fn(async () => [row()]);
    const p = clientDocumentationProvider({ searchDocuments, clientVisibleDocumentTypes: async () => new Set(["contract"]) });
    expect(await p.search({ query: "msa", organizationId: null, audience: "internal", limit: 5 })).toEqual([]);
    expect(searchDocuments).not.toHaveBeenCalled();
    await p.search({ query: "msa", organizationId: 5, audience: "client", limit: 5 });
    expect(searchDocuments).toHaveBeenCalledWith({ organizationId: 5, q: "msa", limit: 15 });
  });

  it("end to end: a client audience gets approved, matrix-visible documents; internal-only ones are withheld; a leaked row from another organisation is blocked", async () => {
    const searchDocuments = vi.fn(async () => [row({ id: 1 }), row({ id: 2, documentType: "internal_note" }), row({ id: 3, status: "pending_review" }), row({ id: 4, organizationId: 6 })]);
    const provider = clientDocumentationProvider({ searchDocuments, clientVisibleDocumentTypes: async () => new Set(["contract"]) });
    const s = store({ search: provider.search });
    const r = await retrieveKnowledge(req(), s.deps);
    expect(r.status === "ok" && r.items.map((i) => i.id)).toEqual(["doc:1"]);
    expect(r.status === "ok" && r.withheld).toBe(2);
    expect(s.records.map((x) => x.action)).toContain("knowledge_cross_organization_blocked:client_documentation");
    // staff see the internal ones too, but still never another organisation's
    const staff = await retrieveKnowledge(req({ ctx: { organizationId: 5, audience: "internal" } }), s.deps);
    expect(staff.status === "ok" && staff.items.map((i) => i.id)).toEqual(["doc:1", "doc:2", "doc:3"]);
  });
});

// ---------------------------------------------------------------------------
// through the agent runtime
// ---------------------------------------------------------------------------

describe("knowledge tools in the shared runtime", () => {
  function runWith(agentSources: string[], audience: "public" | "client" | "internal", items: KnowledgeItem[]) {
    const s = store({ items, sources: agentSources });
    const reg = new ToolRegistry();
    for (const t of knowledgeTools(s.deps)) reg.register(t);
    const turns: ModelTurn[] = [{ kind: "tool_calls", calls: [{ id: "c1", name: "search_client_documentation", arguments: JSON.stringify({ query: "contract" }) }] }, { kind: "final", content: "done" }];
    let i = 0;
    const seen: unknown[] = [];
    const model: AgentModel = { complete: async (r) => (seen.push(structuredClone(r.messages)), turns[Math.min(i++, 1)]) };
    const deps: RuntimeDeps = {
      loadAgent: async () => ({ key: "scribe", status: "active", permissions: ["search_knowledge", "draft"], requiresHumanApproval: true, tools: ["search_client_documentation"], knowledgeSources: agentSources, maxAuthority: "draft_only", escalationRules: null }),
      authorise: async () => ({ outcome: "completed" }),
      record: async () => 1,
      escalate: async () => undefined,
      actorGrants: async () => [],
      model,
      tools: reg,
    };
    return { deps, seen, store: s };
  }
  const input = (audience: "public" | "client" | "internal") => ({ agentKey: "scribe", subjectRef: "ticket:1", runPermission: "draft", system: "s", userMessage: "u", ctx: { organizationId: 5, actorUserId: 2, actorRole: "client", audience } });

  it("a client run reads its own organisation's approved documents through the tool", async () => {
    const h = runWith(["client_documentation"], "client", [doc(1, 5), doc(2, 6)]);
    const r = await runAgent(input("client"), h.deps);
    expect(r.status).toBe("completed");
    const toolMsg = JSON.stringify(h.seen[1]);
    expect(toolMsg).toContain("Doc 1");
    expect(toolMsg).not.toContain("Doc 2");
  });

  it("the runtime refuses the tool when the agent does not list the source; the store is never reached", async () => {
    const h = runWith([], "client", [doc(1, 5)]);
    const r = await runAgent(input("client"), h.deps);
    expect(r.status === "completed" && r.toolCalls[0]).toMatchObject({ outcome: "refused" });
    expect(h.store.search).not.toHaveBeenCalled();
  });

  it("a public audience gets a denial the model can read, not documents", async () => {
    const h = runWith(["client_documentation"], "public", [doc(1, 5)]);
    await runAgent(input("public"), h.deps);
    expect(JSON.stringify(h.seen[1])).toContain("audience_too_low");
    expect(JSON.stringify(h.seen[1])).not.toContain("Doc 1");
  });

  it("every source has a tool, each read-only, organisation-scoped as its policy says", () => {
    const tools = knowledgeTools(store().deps);
    expect(tools.map((t) => t.name).sort()).toEqual(KNOWLEDGE_SOURCES.map((s) => `search_${s}`).sort());
    for (const t of tools) {
      expect(t.effect).toBe("read");
      expect(t.requiredPermission).toBe("search_knowledge");
      expect(t.organizationScoped).toBe(SOURCE_POLICY[t.knowledgeSource as keyof typeof SOURCE_POLICY].organizationScoped);
      expect(t.inputSchema.safeParse({ query: "ok", extra: 1 }).success).toBe(false); // strict
    }
    void z;
  });
});
