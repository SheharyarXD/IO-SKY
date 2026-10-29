/*
 * R18 (SRS 14.16; 29 Oct Doc 1 Ch6, ACC-05): CRM tools for the future AI
 * receptionist. In-memory fakes only; no database, no voice, no provider. These
 * tests do not show the receptionist works, only that the tools it would use
 * enforce the rules around the CRM.
 */
import { describe, expect, it, vi } from "vitest";
import { composeNoteBody, matchedOn, normalizeEmail, phoneKey } from "../shared/crmRules";
import { crmTools, RunLeadScope, type CrmDeps } from "./crmTools";
import { IdempotencyStore } from "./schedulingTools";
import { runAgent, ToolRegistry, type AgentDefinition, type AgentModel, type ModelTurn, type RuntimeDeps, type ToolContext } from "./agentRuntime";

describe("crm rules", () => {
  it("normalises emails and phone lines so formatting differences still match", () => {
    expect(normalizeEmail("  Gina@Example.COM ")).toBe("gina@example.com");
    for (const bad of ["", "nope", "a@b", "a b@c.de", null, undefined]) expect(normalizeEmail(bad as never)).toBeNull();
    const variants = ["+31 6 12 34 56 78", "0031612345678", "06-12345678", "(+31) 612345678"];
    expect(new Set(variants.map(phoneKey)).size).toBe(1);
    expect(phoneKey("12345")).toBeNull();
    expect(phoneKey(null)).toBeNull();
    expect(phoneKey("1234567")).toBe("1234567");
  });

  it("reports what a lead matched on", () => {
    const lead = { email: "Gina@Example.com", phone: "+31 6 12345678" };
    expect(matchedOn(lead, { email: "gina@example.com", phone: "0612345678" })).toEqual(["email", "phone"]);
    expect(matchedOn(lead, { email: "other@example.com" })).toEqual([]);
    expect(matchedOn({ email: "x@y.zz", phone: null }, { phone: "0612345678" })).toEqual([]);
  });

  it("a note always says an assistant wrote it, and lays out the qualification", () => {
    const body = composeNoteBody({ reason: "Wants an AI Scan", qualification: { businessChallenge: "Manual reporting", desiredOutcome: "Weekly dashboards", constraints: "Budget" }, text: "Prefers mornings" });
    expect(body.split("\n")[0]).toMatch(/AI assistant/);
    expect(body).toContain("Reason for contact: Wants an AI Scan");
    expect(body).toContain("Business challenge: Manual reporting");
    expect(body).toContain("Constraints: Budget");
    expect(body).not.toContain("undefined");
    expect(body.endsWith("Prefers mornings")).toBe(true);
  });
});

describe("RunLeadScope", () => {
  const c = (subjectRef: string) => ({ agentKey: "reception", subjectRef });
  it("keeps one conversation's leads apart from another's and expires them", () => {
    const s = new RunLeadScope(1000, 3);
    s.add(c("call:1"), 7, 0);
    expect(s.has(c("call:1"), 7, 500)).toBe(true);
    expect(s.has(c("call:2"), 7, 500)).toBe(false);
    expect(s.has({ agentKey: "other", subjectRef: "call:1" }, 7, 500)).toBe(false);
    expect(s.has(c("call:1"), 8, 500)).toBe(false);
    expect(s.has(c("call:1"), 7, 2000)).toBe(false);
  });
  it("caps how many conversations it remembers", () => {
    const s = new RunLeadScope(10_000, 2);
    for (const n of [1, 2, 3]) s.add(c(`call:${n}`), n, 0);
    expect(s.has(c("call:1"), 1, 1)).toBe(false);
    expect(s.has(c("call:3"), 3, 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tools
// ---------------------------------------------------------------------------

type L = { id: number; fullName: string; email: string; company: string | null; phone: string | null; interest: string | null; status: string; note: string | null };
function fake(over: Partial<CrmDeps> = {}) {
  const leads: L[] = [{ id: 10, fullName: "Pat Prospect", email: "pat@example.com", company: "Pat BV", phone: "+31 6 11111111", interest: null, status: "new", note: null }];
  const clients = new Set(["client@acme.com"]);
  const activities: Array<Record<string, unknown>> = [];
  const deps: CrmDeps = {
    now: () => Date.now(),
    findLeadsByContact: vi.fn(async ({ email, phoneKey: pk }) => leads.filter((l) => (email && l.email.toLowerCase() === email) || (pk && phoneKey(l.phone) === pk)) as never),
    isExistingClientEmail: vi.fn(async (e) => clients.has(e)),
    createLead: vi.fn(async (input) => {
      const l: L = { id: 100 + leads.length, status: "new", ...(input as object) } as L;
      leads.push(l);
      return l as never;
    }),
    getLeadById: vi.fn(async (id) => (leads.find((l) => l.id === id) as never) ?? null),
    fillLeadBlanks: vi.fn(async (id, patch) => {
      const l = leads.find((x) => x.id === id);
      if (!l) return null;
      const filled: string[] = [];
      for (const k of ["company", "phone", "interest"] as const) if (patch[k] && !(l[k] ?? "").trim()) { l[k] = patch[k]!; filled.push(k); }
      return filled;
    }),
    createActivity: vi.fn(async (a) => (activities.push(a), { id: activities.length } as never)),
    idempotency: new IdempotencyStore(),
    leadScope: new RunLeadScope(),
    ...over,
  };
  return { deps, leads, clients, activities };
}
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({ organizationId: null, actorUserId: null, agentKey: "reception", subjectRef: "call:1", ...over });
const exec = async (deps: CrmDeps, name: string, args: unknown, c: ToolContext = ctx()) => {
  const t = crmTools(deps).find((x) => x.name === name)!;
  const p = t.inputSchema.safeParse(args);
  return p.success ? ((await t.execute(p.data, c)) as Record<string, unknown>) : { schemaError: p.error.issues.map((i) => i.message).join("; ") };
};
const create = (over: Record<string, unknown> = {}) => ({ fullName: "Nora New", email: "nora@example.com", phone: "+31 6 22222222", company: "Nora BV", reason: "Wants help with reporting", requestId: "req-00000001", ...over });

describe("crm_find_contact", () => {
  it("without verification says only whether something matched, never who or what", async () => {
    const f = fake();
    for (const probe of [{ email: "pat@example.com" }, { phone: "0611111111" }, { email: "client@acme.com" }]) {
      expect(await exec(f.deps, "crm_find_contact", probe)).toEqual({ ok: true, matched: true });
    }
    expect(await exec(f.deps, "crm_find_contact", { email: "nobody@example.com" })).toEqual({ ok: true, matched: false });
  });

  it("an unverified lookup of an existing client looks exactly like a lookup of a prospect", async () => {
    const f = fake();
    expect(await exec(f.deps, "crm_find_contact", { email: "client@acme.com" })).toEqual(await exec(f.deps, "crm_find_contact", { email: "pat@example.com" }));
  });

  it("a verified caller gets prospect details and those records join the conversation's scope", async () => {
    const f = fake();
    const c = ctx({ verification: "verified" });
    const r = (await exec(f.deps, "crm_find_contact", { email: "PAT@example.com", phone: "0611111111" }, c)) as { matches: Array<Record<string, unknown>> };
    expect(r.matches).toEqual([{ leadId: 10, fullName: "Pat Prospect", company: "Pat BV", status: "new", newProspect: true, matchedOn: ["email", "phone"] }]);
    expect(await exec(f.deps, "crm_add_note", { leadId: 10, text: "Called back", requestId: "req-00000002" }, c)).toMatchObject({ ok: true });
  });

  it("an existing client is never described, even to a verified caller", async () => {
    const f = fake();
    const r = await exec(f.deps, "crm_find_contact", { email: "client@acme.com" }, ctx({ verification: "verified" }));
    expect(r).toEqual({ ok: true, matched: true, existingClient: true, matches: [] });
  });

  it("needs a usable email or phone", async () => {
    const f = fake();
    expect(await exec(f.deps, "crm_find_contact", {})).toMatchObject({ ok: false, code: "invalid" });
    expect(await exec(f.deps, "crm_find_contact", { email: "nope", phone: "12" })).toMatchObject({ ok: false, code: "invalid" });
    expect(f.deps.findLeadsByContact).not.toHaveBeenCalled();
  });

  it("a CRM failure is a generic unavailable result", async () => {
    const f = fake({ findLeadsByContact: async () => { throw new Error("relation leads does not exist 10.0.0.4"); } });
    const r = await exec(f.deps, "crm_find_contact", { email: "a@b.co" });
    expect(r).toMatchObject({ ok: false, code: "unavailable" });
    expect(JSON.stringify(r)).not.toContain("10.0.0.4");
  });
});

describe("crm_create_prospect", () => {
  it("creates a New Prospect, normalised, with provenance, an audit timeline entry and conversation scope", async () => {
    const f = fake();
    const r = await exec(f.deps, "crm_create_prospect", create({ email: "Nora@Example.COM" }));
    expect(r).toMatchObject({ ok: true, created: true, newProspect: true });
    expect(f.deps.createLead).toHaveBeenCalledWith(expect.objectContaining({ source: "ai-receptionist", email: "nora@example.com", status: "new", ip: null, userAgent: "ai-receptionist" }));
    expect((f.deps.createLead as ReturnType<typeof vi.fn>).mock.calls[0][0].note).toContain("Reason for contact: Wants help with reporting");
    expect(f.activities[0]).toMatchObject({ kind: "note", subject: "New prospect created by the AI assistant", createdByUserId: null, leadId: (r as { leadId: number }).leadId });
    expect(String(f.activities[0].body)).toContain("Conversation: call:1");
    // the new record is usable in this conversation
    expect(await exec(f.deps, "crm_add_note", { leadId: (r as { leadId: number }).leadId, text: "x", requestId: "req-00000003" })).toMatchObject({ ok: true });
  });

  it("does not create a duplicate for the same email or phone; an unverified caller is not told which record", async () => {
    const f = fake();
    const byEmail = await exec(f.deps, "crm_create_prospect", create({ email: "pat@example.com", requestId: "req-00000004" }));
    const byPhone = await exec(f.deps, "crm_create_prospect", create({ email: "new@example.com", phone: "0611111111", requestId: "req-00000005" }));
    for (const r of [byEmail, byPhone]) expect(r).toEqual({ ok: true, created: false, deduplicated: true });
    expect(f.deps.createLead).not.toHaveBeenCalled();
    // and the existing record did NOT become usable in this conversation
    expect(await exec(f.deps, "crm_add_note", { leadId: 10, text: "x", requestId: "req-00000006" })).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("a verified caller is given the existing record and may work on it", async () => {
    const f = fake();
    const c = ctx({ verification: "verified" });
    expect(await exec(f.deps, "crm_create_prospect", create({ email: "pat@example.com" }), c)).toEqual({ ok: true, created: false, deduplicated: true, leadId: 10 });
    expect(await exec(f.deps, "crm_add_note", { leadId: 10, text: "x", requestId: "req-00000007" }, c)).toMatchObject({ ok: true });
  });

  it("an existing client is protected: nothing is created or recorded and the model is told to route to verification", async () => {
    const f = fake();
    const r = await exec(f.deps, "crm_create_prospect", create({ email: "CLIENT@acme.com" }));
    expect(r).toMatchObject({ ok: false, code: "protected", message: expect.stringContaining("verification") });
    expect(f.deps.createLead).not.toHaveBeenCalled();
    expect(f.activities).toHaveLength(0);
  });

  it("a repeated call with the same request id creates one record; two different ids with the same email still create one (dedupe)", async () => {
    const f = fake();
    const a = await exec(f.deps, "crm_create_prospect", create());
    const b = await exec(f.deps, "crm_create_prospect", create());
    expect(a).toEqual(b);
    const c = await exec(f.deps, "crm_create_prospect", create({ requestId: "req-00000009" }));
    expect(c).toMatchObject({ created: false, deduplicated: true });
    expect(f.deps.createLead).toHaveBeenCalledTimes(1);
  });

  it("rejects bad input and unknown fields before touching the CRM; a CRM failure is generic and retryable", async () => {
    const f = fake();
    for (const bad of [create({ email: "nope" }), create({ fullName: "x" }), create({ reason: "" }), create({ status: "won" }), create({ requestId: "short" })]) {
      expect(await exec(f.deps, "crm_create_prospect", bad)).toHaveProperty("schemaError");
    }
    expect(f.deps.createLead).not.toHaveBeenCalled();
    let n = 0;
    const flaky = fake({ createLead: vi.fn(async () => (n++ === 0 ? null : ({ id: 55 } as never))) });
    expect(await exec(flaky.deps, "crm_create_prospect", create({ requestId: "req-retry-001" }))).toMatchObject({ ok: false, code: "unavailable" });
    expect(await exec(flaky.deps, "crm_create_prospect", create({ requestId: "req-retry-001" }))).toMatchObject({ ok: true, created: true });
  });

  it("a failing timeline write does not undo a created record", async () => {
    const f = fake({ createActivity: async () => { throw new Error("activities down"); } });
    expect(await exec(f.deps, "crm_create_prospect", create())).toMatchObject({ ok: true, created: true });
  });
});

describe("notes, follow-ups and detail filling work only inside the conversation's scope", () => {
  const scoped = async () => {
    const f = fake();
    const r = (await exec(f.deps, "crm_create_prospect", create())) as { leadId: number };
    return { f, id: r.leadId };
  };

  it("a lead from another conversation, or a guessed id, is refused and nothing is written", async () => {
    const { f, id } = await scoped();
    const other = ctx({ subjectRef: "call:2" });
    const before = f.activities.length;
    expect(await exec(f.deps, "crm_add_note", { leadId: id, text: "x", requestId: "req-00000011" }, other)).toMatchObject({ ok: false, code: "not_allowed" });
    expect(await exec(f.deps, "crm_add_note", { leadId: 10, text: "x", requestId: "req-00000012" })).toMatchObject({ ok: false, code: "not_allowed" });
    expect(await exec(f.deps, "crm_create_follow_up", { leadId: 10, subject: "Call", dueAtMs: Date.now() + 3600_000, requestId: "req-00000013" })).toMatchObject({ ok: false, code: "not_allowed" });
    expect(await exec(f.deps, "crm_fill_lead_details", { leadId: 10, company: "Evil", requestId: "req-00000014" })).toMatchObject({ ok: false, code: "not_allowed" });
    expect(f.activities.length).toBe(before);
    expect(f.leads.find((l) => l.id === 10)!.company).toBe("Pat BV");
  });

  it("adds a structured note authored by no user, with the qualification laid out", async () => {
    const { f, id } = await scoped();
    const r = await exec(f.deps, "crm_add_note", { leadId: id, reason: "Reporting pain", qualification: { businessChallenge: "Manual reports", schedulingPreference: "Mornings" }, requestId: "req-00000015" });
    expect(r).toMatchObject({ ok: true });
    const a = f.activities.at(-1)!;
    expect(a).toMatchObject({ kind: "note", subject: "Conversation note", leadId: id, createdByUserId: null, organizationId: null, opportunityId: null });
    expect(String(a.body)).toContain("Business challenge: Manual reports");
  });

  it("a note needs some content, and unknown qualification fields are refused", async () => {
    const { f, id } = await scoped();
    expect(await exec(f.deps, "crm_add_note", { leadId: id, requestId: "req-00000016" })).toHaveProperty("schemaError");
    expect(await exec(f.deps, "crm_add_note", { leadId: id, qualification: { credit_card: "4111" }, requestId: "req-00000017" })).toHaveProperty("schemaError");
  });

  it("follow-ups are real future tasks within 90 days", async () => {
    const { f, id } = await scoped();
    const due = Date.now() + 2 * 86_400_000;
    expect(await exec(f.deps, "crm_create_follow_up", { leadId: id, subject: "Call back", dueAtMs: due, requestId: "req-00000018" })).toMatchObject({ ok: true, dueIso: new Date(due).toISOString() });
    expect(f.activities.at(-1)).toMatchObject({ kind: "follow_up", dueAt: new Date(due), createdByUserId: null });
    for (const bad of [Date.now() - 1000, Date.now() + 60_000, Date.now() + 120 * 86_400_000]) {
      expect(await exec(f.deps, "crm_create_follow_up", { leadId: id, subject: "x y", dueAtMs: bad, requestId: `req-bad-${bad}` })).toMatchObject({ ok: false, code: "invalid" });
    }
  });

  it("fills only empty details and never overwrites", async () => {
    const f = fake();
    const c = ctx({ verification: "verified" });
    await exec(f.deps, "crm_find_contact", { email: "pat@example.com" }, c); // brings lead 10 into scope
    const r = await exec(f.deps, "crm_fill_lead_details", { leadId: 10, company: "Overwritten BV", phone: "+31 6 99999999", interest: "ai-scan", requestId: "req-00000019" }, c);
    expect(r).toEqual({ ok: true, filled: ["interest"], unchanged: false }); // company and phone were already set
    const l = f.leads.find((x) => x.id === 10)!;
    expect(l).toMatchObject({ company: "Pat BV", phone: "+31 6 11111111", interest: "ai-scan" });
    expect(await exec(f.deps, "crm_fill_lead_details", { leadId: 10, requestId: "req-00000020" }, c)).toHaveProperty("schemaError");
  });

  it("a lead that has since been deleted is reported as not found", async () => {
    const { f, id } = await scoped();
    f.leads.splice(0, f.leads.length);
    expect(await exec(f.deps, "crm_add_note", { leadId: id, text: "x", requestId: "req-00000021" })).toMatchObject({ ok: false, code: "not_found" });
  });

  it("status, name and email can never be changed through these tools", async () => {
    const { f, id } = await scoped();
    for (const field of [{ status: "won" }, { email: "x@y.zz" }, { fullName: "Someone Else" }]) {
      expect(await exec(f.deps, "crm_fill_lead_details", { leadId: id, company: "A", requestId: "req-00000022", ...field })).toHaveProperty("schemaError");
    }
  });
});

// ---------------------------------------------------------------------------
// in the shared runtime
// ---------------------------------------------------------------------------

describe("CRM tools in the shared runtime", () => {
  function runTool(agent: Partial<AgentDefinition>, name: string, args: unknown, ctxOver: Record<string, unknown> = {}) {
    const f = fake();
    const reg = new ToolRegistry();
    for (const t of crmTools(f.deps)) reg.register(t);
    const turns: ModelTurn[] = [{ kind: "tool_calls", calls: [{ id: "c1", name, arguments: JSON.stringify(args) }] }, { kind: "final", content: "done" }];
    let i = 0;
    const seen: string[] = [];
    const model: AgentModel = { complete: async (r) => (seen.push(JSON.stringify(r.messages)), turns[Math.min(i++, 1)]) };
    const def: AgentDefinition = { key: "reception", status: "active", permissions: ["crm_read", "crm_write", "converse"], requiresHumanApproval: true, tools: reg.names(), knowledgeSources: [], maxAuthority: "draft_only", escalationRules: "Hand over to a person", ...agent };
    const deps: RuntimeDeps = { loadAgent: async () => def, authorise: async (a) => (def.permissions.includes(a.action) ? { outcome: "completed" } : { outcome: "blocked_by_permission", reason: "action_not_permitted" }), record: async () => 1, escalate: async () => undefined, actorGrants: async () => [], model, tools: reg };
    return { f, seen, run: () => runAgent({ agentKey: "reception", subjectRef: "call:1", runPermission: "converse", system: "s", userMessage: "u", ctx: { organizationId: null, actorUserId: null, ...ctxOver } }, deps) };
  }

  it("a draft-authority agent (even one that needs approval) can look up and record, because these are reviewable drafts", async () => {
    const h = runTool({}, "crm_create_prospect", create());
    const r = await h.run();
    expect(r.status === "completed" && r.toolCalls[0].outcome).toBe("executed");
    expect(h.f.deps.createLead).toHaveBeenCalledTimes(1);
  });

  it("a read-only agent can search but cannot create", async () => {
    const find = await runTool({ maxAuthority: "read_only" }, "crm_find_contact", { email: "pat@example.com" }).run();
    expect(find.status === "completed" && find.toolCalls[0].outcome).toBe("executed");
    const h = runTool({ maxAuthority: "read_only" }, "crm_create_prospect", create());
    const r = await h.run();
    expect(r.status === "completed" && r.toolCalls[0].outcome).toBe("refused");
    expect(h.f.deps.createLead).not.toHaveBeenCalled();
  });

  it("an agent without the crm_write permission cannot write", async () => {
    const h = runTool({ permissions: ["crm_read", "converse"] }, "crm_create_prospect", create());
    const r = await h.run();
    expect(r.status === "completed" && r.toolCalls[0].outcome).toBe("refused");
    expect(h.f.deps.createLead).not.toHaveBeenCalled();
  });

  it("the run's verification level reaches the tool: unverified learns only yes or no, verified sees the prospect", async () => {
    const unverified = runTool({}, "crm_find_contact", { email: "pat@example.com" });
    await unverified.run();
    expect(unverified.seen[1]).toContain('\\"matched\\":true');
    expect(unverified.seen[1]).not.toMatch(/Pat Prospect|Pat BV|leadId/);

    const verified = runTool({}, "crm_find_contact", { email: "pat@example.com" }, { verification: "verified" });
    await verified.run();
    expect(verified.seen[1]).toContain("Pat Prospect");
    expect(verified.seen[1]).toContain("leadId");
  });
});
