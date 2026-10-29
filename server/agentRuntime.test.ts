/*
 * G03 (SRS 19.5 to 19.19; 29 Oct Doc 1 ACC-36): the shared agent runtime.
 * A scripted model drives the real loop. No provider, database or network is
 * used, and nothing here proves a live model behaves; it proves the limits the
 * platform enforces around whatever model is plugged in.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AUTHORITY_LEVELS, authorityDecision } from "../shared/aiAgentRegistry";
import {
  organizationIdsIn,
  runAgent,
  ToolRegistry,
  type AgentDefinition,
  type AgentMessage,
  type AgentModel,
  type AgentTool,
  type ModelTurn,
  type RunInput,
  type RuntimeDeps,
} from "./agentRuntime";
import { llmAgentModel } from "./agentRuntimeWiring";

// ---------------------------------------------------------------------------
// authority rule
// ---------------------------------------------------------------------------

describe("authorityDecision", () => {
  it("read is always allowed; draft needs draft_only or more", () => {
    for (const lvl of AUTHORITY_LEVELS) expect(authorityDecision(lvl, true, "read")).toBe("execute");
    expect(authorityDecision("read_only", false, "draft")).toBe("deny");
    for (const lvl of ["draft_only", "act_with_approval", "act_autonomously"]) expect(authorityDecision(lvl, true, "draft")).toBe("execute");
  });

  it("an action executes only for an autonomous agent that does not require approval", () => {
    expect(authorityDecision("act_autonomously", false, "act")).toBe("execute");
    expect(authorityDecision("act_autonomously", true, "act")).toBe("needs_approval");
    expect(authorityDecision("act_with_approval", false, "act")).toBe("needs_approval");
    expect(authorityDecision("draft_only", false, "act")).toBe("deny");
    expect(authorityDecision("read_only", false, "act")).toBe("deny");
  });

  it("unknown authority or effect is refused, never permissive", () => {
    expect(authorityDecision("root", false, "read")).toBe("deny");
    expect(authorityDecision("", false, "read")).toBe("deny");
    expect(authorityDecision("act_autonomously", false, "delete" as never)).toBe("deny");
  });
});

describe("organizationIdsIn", () => {
  it("finds organisation ids at any depth under common names, and ignores others", () => {
    expect(organizationIdsIn({ organizationId: 5 })).toEqual([5]);
    // nested objects and items inside arrays are both searched
    expect(organizationIdsIn({ a: { b: { org_id: 7 } }, list: [{ tenantId: 9 }] })).toEqual([7, 9]);
    expect(organizationIdsIn({ q: "hello", n: 3, id: 5 })).toEqual([]);
    expect(organizationIdsIn("x")).toEqual([]);
    expect(organizationIdsIn(null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

const agentDef = (over: Partial<AgentDefinition> = {}): AgentDefinition => ({
  key: "support_scribe", status: "active", permissions: ["draft_reply", "read_ticket", "send_reply"], requiresHumanApproval: true,
  tools: ["get_ticket", "draft_reply", "send_reply"], knowledgeSources: ["business_rules"], maxAuthority: "draft_only", escalationRules: "Hand over to the support lead", ...over,
});

function tools() {
  const executed: string[] = [];
  const mk = <I>(t: Partial<AgentTool<I>> & Pick<AgentTool<I>, "name" | "effect" | "inputSchema">): AgentTool<I> =>
    ({ description: t.name, parameters: { type: "object" }, requiredPermission: t.name === "get_ticket" ? "read_ticket" : t.name, organizationScoped: true, execute: async () => { executed.push(t.name); return { ok: true, name: t.name }; }, ...t }) as AgentTool<I>;
  const reg = new ToolRegistry()
    .register(mk({ name: "get_ticket", effect: "read", inputSchema: z.object({ ticketId: z.number(), organizationId: z.number().optional() }), knowledgeSource: undefined }))
    .register(mk({ name: "draft_reply", effect: "draft", inputSchema: z.object({ text: z.string().max(500) }) }))
    .register(mk({ name: "send_reply", effect: "act", inputSchema: z.object({ text: z.string() }) }))
    .register(mk({ name: "search_rules", effect: "read", inputSchema: z.object({ q: z.string() }), knowledgeSource: "business_rules", requiredPermission: "read_ticket", organizationScoped: false }))
    .register(mk({ name: "search_reports", effect: "read", inputSchema: z.object({ q: z.string() }), knowledgeSource: "ai_scan_reports", requiredPermission: "read_ticket", organizationScoped: false }));
  return { reg, executed };
}

function scripted(turns: ModelTurn[]) {
  const seen: Array<{ messages: AgentMessage[]; tools: string[] }> = [];
  let i = 0;
  const model: AgentModel = {
    complete: vi.fn(async (req) => {
      seen.push({ messages: structuredClone(req.messages), tools: req.tools.map((t) => t.name) });
      const t = turns[Math.min(i++, turns.length - 1)];
      if (!t) throw new Error("script exhausted");
      return t;
    }),
  };
  return { model, seen };
}

const call = (name: string, args: unknown, id = `c_${name}`): ModelTurn => ({ kind: "tool_calls", calls: [{ id, name, arguments: typeof args === "string" ? args : JSON.stringify(args) }] });
const final = (content: string): ModelTurn => ({ kind: "final", content });

function harness(opts: { agent?: Partial<AgentDefinition> | null; turns: ModelTurn[]; authorise?: RuntimeDeps["authorise"]; loadAgent?: RuntimeDeps["loadAgent"]; actorGrants?: RuntimeDeps["actorGrants"] }) {
  const { reg, executed } = tools();
  const { model, seen } = scripted(opts.turns);
  const recorded: Array<{ action: string; detail: string }> = [];
  const escalations: Array<{ kind: string; reason: string }> = [];
  const authorised: string[] = [];
  const deps: RuntimeDeps = {
    loadAgent: opts.loadAgent ?? (async () => (opts.agent === null ? null : agentDef(opts.agent ?? {}))),
    authorise: opts.authorise ?? (async (a) => (authorised.push(a.action), { outcome: "completed" })),
    record: async (a) => (recorded.push({ action: a.action, detail: a.detail }), 77),
    escalate: async (e) => void escalations.push({ kind: e.kind, reason: e.reason }),
    actorGrants: opts.actorGrants ?? (async () => []),
    model,
    tools: reg,
  };
  const input: RunInput = { agentKey: "support_scribe", subjectRef: "ticket:12", runPermission: "draft_reply", system: "You help support.", userMessage: "Please help.", ctx: { organizationId: 5, actorUserId: 9, actorRole: "admin" } };
  return { deps, input, executed, recorded, escalations, authorised, seen, model };
}

const run = (h: ReturnType<typeof harness>, over: Partial<RunInput> = {}) => runAgent({ ...h.input, ...over }, h.deps);

// ---------------------------------------------------------------------------
// the gate in front of the run
// ---------------------------------------------------------------------------

describe("a run starts only when permission is verified (fails closed)", () => {
  it("unknown, disabled or unreadable agent: blocked and the model is never called", async () => {
    for (const h of [
      harness({ agent: null, turns: [final("x")] }),
      harness({ agent: { status: "disabled" }, turns: [final("x")] }),
      harness({ loadAgent: async () => { throw new Error("db down"); }, turns: [final("x")] }),
    ]) {
      expect((await run(h)).status).toBe("blocked");
      expect(h.model.complete).not.toHaveBeenCalled();
    }
  });

  it("no permission verdict, a thrown check, or a refusal all block the run", async () => {
    for (const authorise of [async () => null, async () => { throw new Error("registry down"); }, async () => ({ outcome: "blocked_by_permission", reason: "action_not_permitted" })] as RuntimeDeps["authorise"][]) {
      const h = harness({ turns: [final("x")], authorise });
      const r = await run(h);
      expect(r.status).toBe("blocked");
      expect(h.model.complete).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// the loop
// ---------------------------------------------------------------------------

describe("tool-calling loop", () => {
  it("runs a permitted tool with the run's context, returns its result to the model and records it", async () => {
    const h = harness({ turns: [call("get_ticket", { ticketId: 12 }), final("All done")] });
    const r = await run(h);
    expect(r).toMatchObject({ status: "completed", text: "All done", steps: 2, executionId: 77, needsHumanReview: true });
    expect(h.executed).toEqual(["get_ticket"]);
    const toolMsg = h.seen[1].messages.find((m) => m.role === "tool");
    expect(toolMsg).toMatchObject({ name: "get_ticket", content: expect.stringContaining('"ok":true') });
    expect(h.recorded.map((x) => x.action)).toEqual(["tool:get_ticket", "run_result"]);
    expect(r.status === "completed" && r.toolCalls).toEqual([{ name: "get_ticket", outcome: "executed" }]);
  });

  it("offers the model only tools that are both registered in code and listed on the agent", async () => {
    const h = harness({ agent: { tools: ["get_ticket", "not_in_code"] }, turns: [final("x")] });
    await run(h);
    expect(h.seen[0].tools).toEqual(["get_ticket"]);
  });

  it("a tool the model invents, or one the agent is not listed for, is refused and never executed", async () => {
    const h = harness({ agent: { tools: ["get_ticket"] }, turns: [call("delete_everything", {}), call("draft_reply", { text: "hi" }), final("ok")] });
    const r = await run(h);
    expect(h.executed).toEqual([]);
    expect(r.status === "completed" && r.toolCalls.map((t) => t.outcome)).toEqual(["refused", "refused"]);
    expect(h.seen[2].messages.filter((m) => m.role === "tool").map((m) => m.content)).toEqual([expect.stringContaining("Refused: unknown tool"), expect.stringContaining("not allowed to use that tool")]);
  });

  it("invalid or non-JSON arguments are refused with a reason and never executed", async () => {
    const h = harness({ turns: [call("get_ticket", { ticketId: "twelve" }), call("get_ticket", "{not json"), final("ok")] });
    await run(h);
    expect(h.executed).toEqual([]);
    const msgs = h.seen[2].messages.filter((m) => m.role === "tool").map((m) => m.content);
    expect(msgs[0]).toContain("arguments invalid");
    expect(msgs[1]).toContain("not valid JSON");
  });

  it("a tool that throws is reported as failed, the model is told not to assume success, and the run continues", async () => {
    const h = harness({ turns: [call("get_ticket", { ticketId: 1 }), final("could not read it")] });
    h.deps.tools.get("get_ticket")!.execute = async () => { throw new Error("db timeout"); };
    const r = await run(h);
    expect(r.status).toBe("completed");
    expect(r.status === "completed" && r.toolCalls[0]).toMatchObject({ outcome: "failed", reason: "db timeout" });
    expect(h.seen[1].messages.find((m) => m.role === "tool")?.content).toContain("Do not assume it succeeded");
  });

  it("argument values are never copied into the history, only the names", async () => {
    const h = harness({ turns: [call("get_ticket", { ticketId: 12, organizationId: 5 }), call("draft_reply", { text: "my password is hunter2" }), final("ok")] });
    await run(h);
    expect(JSON.stringify(h.recorded)).not.toContain("hunter2");
    expect(h.recorded.find((r) => r.action === "tool:draft_reply")?.detail).toBe("args=text");
  });
});

// ---------------------------------------------------------------------------
// scope, knowledge, authority, permission
// ---------------------------------------------------------------------------

describe("organisation scope (SRS 19.20)", () => {
  it("the run's own organisation passes; another one, in any position, is refused", async () => {
    const h = harness({ turns: [call("get_ticket", { ticketId: 1, organizationId: 5 }), call("get_ticket", { ticketId: 1, organizationId: 6 }), call("get_ticket", { ticketId: 1, organizationId: "5" }), final("ok")] });
    const r = await run(h);
    expect(h.executed).toEqual(["get_ticket"]);
    expect(r.status === "completed" && r.toolCalls.map((t) => t.outcome)).toEqual(["executed", "refused", "refused"]);
  });

  it("a tool that needs an organisation is refused for a platform-level run", async () => {
    const h = harness({ turns: [call("get_ticket", { ticketId: 1 }), final("ok")] });
    const r = await run(h, { ctx: { organizationId: null, actorUserId: null } });
    expect(h.executed).toEqual([]);
    expect(r.status === "completed" && r.toolCalls[0]).toMatchObject({ outcome: "refused", reason: expect.stringContaining("needs an organisation") });
  });
});

describe("knowledge sources (SRS 19.17, 19.20)", () => {
  it("reads only the sources the registry entry lists", async () => {
    const h = harness({ agent: { tools: ["search_rules", "search_reports"] }, turns: [call("search_rules", { q: "refund" }), call("search_reports", { q: "client x" }), final("ok")] });
    const r = await run(h);
    expect(h.executed).toEqual(["search_rules"]);
    expect(r.status === "completed" && r.toolCalls[1]).toMatchObject({ outcome: "refused", reason: expect.stringContaining("ai_scan_reports") });
  });
});

describe("maximum authority (SRS 19.18)", () => {
  it("a draft tool is refused for a read-only agent", async () => {
    const h = harness({ agent: { maxAuthority: "read_only" }, turns: [call("draft_reply", { text: "hi" }), final("ok")] });
    const r = await run(h);
    expect(h.executed).toEqual([]);
    expect(r.status === "completed" && r.toolCalls[0].reason).toContain("above this agent's maximum authority");
  });

  it("an action is NOT executed for an agent that needs approval: the run ends awaiting a human and escalates", async () => {
    for (const agent of [{ maxAuthority: "act_with_approval", requiresHumanApproval: false }, { maxAuthority: "act_autonomously", requiresHumanApproval: true }]) {
      const h = harness({ agent, turns: [call("send_reply", { text: "hello customer" }), final("sent")] });
      const r = await run(h);
      expect(r).toMatchObject({ status: "awaiting_approval", pending: { tool: "send_reply", arguments: { text: "hello customer" } } });
      expect(h.executed).toEqual([]);
      expect(h.escalations).toEqual([expect.objectContaining({ kind: "approval_needed" })]);
      expect(h.model.complete).toHaveBeenCalledTimes(1); // the model is not asked to continue as if it had happened
    }
  });

  it("an action executes only for an autonomous agent that does not require approval", async () => {
    const h = harness({ agent: { maxAuthority: "act_autonomously", requiresHumanApproval: false }, turns: [call("send_reply", { text: "hi" }), final("sent")] });
    const r = await run(h);
    expect(r).toMatchObject({ status: "completed", needsHumanReview: false });
    expect(h.executed).toEqual(["send_reply"]);
  });

  it("an action is refused outright for a draft-only agent", async () => {
    const h = harness({ turns: [call("send_reply", { text: "hi" }), final("ok")] });
    const r = await run(h);
    expect(h.executed).toEqual([]);
    expect(r.status).toBe("completed");
    expect(h.escalations).toHaveLength(0);
  });
});

describe("the permission check, per tool, fails closed", () => {
  it("a tool whose permission the agent lacks is refused", async () => {
    const h = harness({ agent: { permissions: ["draft_reply"] }, turns: [call("get_ticket", { ticketId: 1 }), final("ok")], authorise: async (a) => (a.action === "read_ticket" ? { outcome: "blocked_by_permission", reason: "action_not_permitted" } : { outcome: "completed" }) });
    const r = await run(h);
    expect(h.executed).toEqual([]);
    expect(r.status === "completed" && r.toolCalls[0].reason).toContain("permission denied");
  });

  it("no verdict, or a failing check, mid-run refuses the tool rather than running it", async () => {
    let n = 0;
    const authorise: RuntimeDeps["authorise"] = async () => {
      n++;
      if (n === 1) return { outcome: "completed" };
      if (n === 2) return null;
      throw new Error("registry down");
    };
    const h = harness({ turns: [call("get_ticket", { ticketId: 1 }), call("get_ticket", { ticketId: 2 }), final("ok")], authorise });
    const r = await run(h);
    expect(h.executed).toEqual([]);
    expect(r.status === "completed" && r.toolCalls.map((t) => t.outcome)).toEqual(["refused", "refused"]);
  });
});

// ---------------------------------------------------------------------------
// output validation, limits, failures
// ---------------------------------------------------------------------------

describe("output validation", () => {
  const schema = z.object({ summary: z.string().min(3), priority: z.enum(["low", "high"]) });

  it("returns parsed, validated output (code fences allowed)", async () => {
    const h = harness({ turns: [final('```json\n{"summary":"All fine","priority":"low"}\n```')] });
    const r = await run(h, { outputSchema: schema });
    expect(r).toMatchObject({ status: "completed", output: { summary: "All fine", priority: "low" } });
  });

  it("asks once for a repair, then accepts a valid answer", async () => {
    const h = harness({ turns: [final("not json at all"), final('{"summary":"Fixed","priority":"high"}')] });
    const r = await run(h, { outputSchema: schema });
    expect(r).toMatchObject({ status: "completed", steps: 2, output: { priority: "high" } });
    expect(h.seen[1].messages.at(-1)).toMatchObject({ role: "user", content: expect.stringContaining("not usable") });
  });

  it("two unusable answers are never returned: the run is escalated to a person", async () => {
    const h = harness({ turns: [final("nope"), final('{"summary":"x","priority":"urgent"}')] });
    const r = await run(h, { outputSchema: schema });
    expect(r).toMatchObject({ status: "escalated", reason: "invalid_output" });
    expect("output" in r).toBe(false);
    expect(h.escalations).toEqual([expect.objectContaining({ kind: "human_needed", reason: "invalid_output" })]);
  });
});

describe("limits and failures", () => {
  it("a model that keeps calling tools is stopped at the step limit and escalated", async () => {
    const h = harness({ turns: [call("get_ticket", { ticketId: 1 })] });
    const r = await run(h, { maxSteps: 3 });
    expect(r).toMatchObject({ status: "escalated", reason: "step_limit", steps: 3 });
    expect(h.escalations[0]).toMatchObject({ reason: "step_limit" });
  });

  it("too many tool calls in total are escalated", async () => {
    const many: ModelTurn = { kind: "tool_calls", calls: Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, name: "get_ticket", arguments: JSON.stringify({ ticketId: i }) })) };
    const h = harness({ turns: [many, final("ok")] });
    const r = await run(h, { maxToolCalls: 3 });
    expect(r).toMatchObject({ status: "escalated", reason: "tool_call_limit" });
    expect(h.executed).toHaveLength(3);
  });

  it("a model error becomes a failed result and an escalation, not an exception", async () => {
    const h = harness({ turns: [] });
    (h.model.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("credit_balance_exhausted"));
    const r = await run(h);
    expect(r).toMatchObject({ status: "failed", reason: expect.stringContaining("credit_balance_exhausted") });
    expect(h.escalations).toEqual([expect.objectContaining({ kind: "failed" })]);
  });

  it("a failing escalation does not crash the run", async () => {
    const h = harness({ turns: [call("get_ticket", { ticketId: 1 })] });
    h.deps.escalate = async () => { throw new Error("notifications down"); };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(run(h, { maxSteps: 2 })).resolves.toMatchObject({ status: "escalated" });
  });

  it("a failing history write does not break the run", async () => {
    const h = harness({ turns: [call("get_ticket", { ticketId: 1 }), final("ok")] });
    h.deps.record = async () => { throw new Error("history down"); };
    await expect(run(h)).resolves.toMatchObject({ status: "completed", executionId: null });
  });
});

describe("ToolRegistry", () => {
  const base = { description: "d", parameters: {}, inputSchema: z.object({}), effect: "read" as const, requiredPermission: "p", organizationScoped: false, execute: async () => null };
  it("rejects duplicate names, bad names and a tool with no permission", () => {
    const r = new ToolRegistry().register({ ...base, name: "ok_tool" });
    expect(() => r.register({ ...base, name: "ok_tool" })).toThrow(/already registered/);
    expect(() => r.register({ ...base, name: "Bad Name" })).toThrow(/Invalid tool name/);
    expect(() => r.register({ ...base, name: "no_perm", requiredPermission: " " })).toThrow(/permission/);
  });
});

// ---------------------------------------------------------------------------
// LLM adapter (stubbed; no live call)
// ---------------------------------------------------------------------------

describe("llmAgentModel adapter", () => {
  const result = (message: Record<string, unknown>) => ({ id: "x", created: 0, model: "stub", choices: [{ index: 0, message, finish_reason: "stop" }] }) as never;

  it("maps tool calls and plain answers, and echoes tool calls back on the assistant turn", async () => {
    const invoke = vi.fn(async () => result({ role: "assistant", content: "", tool_calls: [{ id: "t1", type: "function", function: { name: "get_ticket", arguments: '{"ticketId":1}' } }] }));
    const model = llmAgentModel(invoke, { purpose: "agent.test" });
    const turn = await model.complete({
      system: "sys",
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "", toolCalls: [{ id: "t0", name: "get_ticket", arguments: "{}" }] },
        { role: "tool", toolCallId: "t0", name: "get_ticket", content: "{}" },
      ],
      tools: [{ name: "get_ticket", description: "d", parameters: { type: "object" } }],
    });
    expect(turn).toEqual({ kind: "tool_calls", calls: [{ id: "t1", name: "get_ticket", arguments: '{"ticketId":1}' }] });
    const sent = (invoke.mock.calls[0] as unknown as [{ messages: Array<Record<string, unknown>>; tools: unknown[]; toolChoice?: string; purpose: string }])[0];
    expect(sent.messages[0]).toMatchObject({ role: "system", content: "sys" });
    expect(sent.messages[2]).toMatchObject({ role: "assistant", tool_calls: [{ id: "t0", function: { name: "get_ticket" } }] });
    expect(sent.messages[3]).toMatchObject({ role: "tool", tool_call_id: "t0" });
    expect(sent.toolChoice).toBe("auto");
    expect(sent.purpose).toBe("agent.test");

    const plain = llmAgentModel(vi.fn(async () => result({ role: "assistant", content: [{ type: "text", text: "Hello " }, { type: "text", text: "there" }] })), { purpose: "p" });
    expect(await plain.complete({ system: "s", messages: [{ role: "user", content: "x" }], tools: [] })).toEqual({ kind: "final", content: "Hello there" });
  });

  it("sends no tools at all when the agent has none, and treats an empty reply as an error", async () => {
    const invoke = vi.fn(async () => ({ id: "x", created: 0, model: "m", choices: [] }) as never);
    const model = llmAgentModel(invoke, { purpose: "p" });
    await expect(model.complete({ system: "s", messages: [{ role: "user", content: "x" }], tools: [] })).rejects.toThrow(/no answer/);
    const sent = (invoke.mock.calls[0] as unknown as [{ tools?: unknown; toolChoice?: unknown }])[0];
    expect(sent.tools).toBeUndefined();
    expect(sent.toolChoice).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// G09: a Technical Operator reaches only the agents they hold a grant for
// ---------------------------------------------------------------------------

describe("per-agent operator access in the runtime (G09)", () => {
  const grant = (scope: string, over: Record<string, unknown> = {}) => ({ scope, expiresAt: null, revokedAt: null, ...over }) as never;
  const operator = { organizationId: 5, actorUserId: 9, actorRole: "technical_operator" };
  const turns = [call("get_ticket", { ticketId: 1 }), final("done")];

  it("an operator with a run grant for THIS agent can run it", async () => {
    const h = harness({ turns, actorGrants: async () => [grant("agent:support_scribe:run")] });
    expect((await run(h, { ctx: operator })).status).toBe("completed");
  });

  it("an operator with no grant, a grant for ANOTHER agent, or only view or approve, is blocked and the model is never called", async () => {
    for (const grants of [[], [grant("agent:other_agent:run")], [grant("agent:support_scribe:view")], [grant("agent:support_scribe:approve")], [grant("backend")]]) {
      const h = harness({ turns, actorGrants: async () => grants });
      const r = await run(h, { ctx: operator });
      expect(r.status, JSON.stringify(grants)).toBe("blocked");
      expect(h.model.complete).not.toHaveBeenCalled();
      expect(h.recorded.map((x) => x.action)).toContain("operator_denied:run"); // the refusal is on record
    }
  });

  it("an expired or revoked grant does not count", async () => {
    for (const over of [{ expiresAt: new Date(Date.now() - 1000) }, { revokedAt: new Date() }]) {
      const h = harness({ turns, actorGrants: async () => [grant("agent:support_scribe:run", over)] });
      expect((await run(h, { ctx: operator })).status).toBe("blocked");
    }
  });

  it("if the grants cannot be read the run is blocked, not allowed", async () => {
    const h = harness({ turns, actorGrants: async () => { throw new Error("db down"); } });
    const r = await run(h, { ctx: operator });
    expect(r).toMatchObject({ status: "blocked", reason: expect.stringContaining("could not be verified") });
    expect(h.model.complete).not.toHaveBeenCalled();
  });

  it("a grant revoked MID-RUN stops the next tool call", async () => {
    let calls = 0;
    const h = harness({
      turns: [call("get_ticket", { ticketId: 1 }), call("get_ticket", { ticketId: 2 }), final("done")],
      actorGrants: async () => (++calls <= 2 ? [grant("agent:support_scribe:run")] : []), // allowed at start and for the first call, revoked after
    });
    const r = await run(h, { ctx: operator });
    expect(h.executed).toEqual(["get_ticket"]); // only the first call ran
    expect(r.status === "completed" && r.toolCalls.map((t) => t.outcome)).toEqual(["executed", "refused"]);
    expect(r.status === "completed" && r.toolCalls[1].reason).toContain("operator access to this agent ended");
  });

  it("a run started by a person whose role is unknown is blocked; system runs, admins and customers are not limited by operator grants", async () => {
    const unknown = harness({ turns });
    expect((await run(unknown, { ctx: { organizationId: 5, actorUserId: 9 } })).status).toBe("blocked");
    for (const ctx of [{ organizationId: 5, actorUserId: null }, { organizationId: 5, actorUserId: 1, actorRole: "admin" }, { organizationId: 5, actorUserId: 1, actorRole: "super_admin" }, { organizationId: 5, actorUserId: 2, actorRole: "client" }]) {
      const h = harness({ turns, actorGrants: async () => { throw new Error("must not be consulted"); } });
      expect((await run(h, { ctx })).status, JSON.stringify(ctx)).toBe("completed");
    }
  });
});

