/**
 * Shared, permission-aware AI agent runtime (task G03; SRS 19.5 to 19.19,
 * 29 Oct Doc 1 ACC-36 "tool-calling loop, permission-scoped context, output
 * validation, human escalation").
 *
 * One loop for every agent, so an agent cannot get a capability by being
 * written differently. The model, the tool registry and every side effect
 * (loading the registry entry, the permission check, recording, escalating) are
 * injected: the runtime has no provider, database or network dependency of its
 * own, which is also how it is tested, with a scripted model. Nothing here calls
 * a model by itself.
 *
 * Rules enforced for every tool call, in this order, each refusal recorded and
 * returned to the model as a short error (never as data):
 *   1. the tool exists in the code registry (approved tool registration);
 *   2. the agent's registry entry lists it (SRS 19.17 "Available Tools");
 *   3. the arguments validate against the tool's schema;
 *   4. organisation scope: the run's organisation is the only one reachable, and
 *      an argument naming another organisation is refused (SRS 19.20);
 *   5. the knowledge source the tool reads is one the agent may access;
 *   6. the effect fits the agent's maximum authority; an action that needs a
 *      human decision is NOT executed, it ends the run as awaiting approval;
 *   7. the permission check (SRS 19.18) passes, and fails CLOSED when it cannot
 *      be evaluated.
 * Final output is validated against a schema before it is returned; an unusable
 * answer is repaired once, then escalated to a person instead of returned.
 */
import type { z } from "zod";
import { authorityDecision, type ToolEffect } from "../shared/aiAgentRegistry";
import { operatorMayOnAgent } from "../shared/agentOperatorScopes";
import type { ScopeGrant } from "../shared/platformRules";
import type { Audience } from "../shared/knowledgeAccess";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentDefinition = {
  key: string;
  status: string;
  permissions: string[];
  requiresHumanApproval: boolean;
  tools: string[];
  knowledgeSources: string[];
  maxAuthority: string;
  escalationRules: string | null;
};

export type RunContext = {
  /** The only organisation this run may touch. Null for platform-level agents. */
  organizationId: number | null;
  /** The person who started the run, or null for a system run (a scan, a webhook, a schedule). */
  actorUserId: number | null;
  /**
   * The actor's role. Required whenever actorUserId is set: a run started by a
   * person whose role is unknown is refused (G09). A Technical Operator needs a
   * per-agent `run` grant; the other roles are limited by the agent's own
   * permissions, tools and organisation scope.
   */
  actorRole?: string | null;
  /**
   * Who the run is serving, for knowledge access (G05): public (an unauthenticated caller), client (a signed-in
   * customer) or internal (platform staff). Anything not stated is treated as public.
   */
  audience?: Audience;
  /**
   * Whether the person on the other end has been verified (identity levels, R10/R11). Anything not stated is
   * unverified: tools then reveal nothing about existing records.
   */
  verification?: "unverified" | "verified";
};

/** What a tool receives: the run's context plus which agent and subject it is running for. */
export type ToolContext = RunContext & { agentKey: string; subjectRef: string };

export type AgentTool<I = unknown, O = unknown> = {
  name: string;
  description: string;
  /** JSON Schema shown to the model. The zod schema below is what is enforced. */
  parameters: Record<string, unknown>;
  inputSchema: z.ZodType<I>;
  effect: ToolEffect;
  /** The permission string checked against the agent's assigned permissions. */
  requiredPermission: string;
  /** Set when the tool reads from one of the SRS 19.20 knowledge sources. */
  knowledgeSource?: string;
  /** True when the tool reads or changes organisation data. */
  organizationScoped: boolean;
  execute(input: I, ctx: ToolContext): Promise<O>;
};

const TOOL_NAME = /^[a-z][a-z0-9_]{1,63}$/;

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();
  register<I, O>(tool: AgentTool<I, O>): this {
    if (!TOOL_NAME.test(tool.name)) throw new Error(`Invalid tool name "${tool.name}".`);
    if (this.tools.has(tool.name)) throw new Error(`Tool "${tool.name}" is already registered.`);
    if (!tool.requiredPermission.trim()) throw new Error(`Tool "${tool.name}" must name the permission it needs.`);
    this.tools.set(tool.name, tool as AgentTool);
    return this;
  }
  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }
  names(): string[] {
    return [...this.tools.keys()];
  }
}

export type AgentMessage =
  | { role: "user" | "assistant"; content: string; toolCalls?: ModelToolCall[] }
  | { role: "tool"; content: string; toolCallId: string; name: string };

export type ModelToolCall = { id: string; name: string; arguments: string };

export type ModelTurn = { kind: "final"; content: string } | { kind: "tool_calls"; calls: ModelToolCall[] };

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

export interface AgentModel {
  complete(req: { system: string; messages: AgentMessage[]; tools: ToolSpec[] }): Promise<ModelTurn>;
}

export type Verdict = { outcome: string; reason?: string } | null;

export type EscalationKind = "human_needed" | "approval_needed" | "failed";

export type RuntimeDeps = {
  loadAgent(key: string): Promise<AgentDefinition | null>;
  /** The SRS 19.18 permission check, which also records the attempt. Null means it could not be evaluated. */
  authorise(a: { agentKey: string; action: string; subjectRef: string; detail: string | null }): Promise<Verdict>;
  /** Append a result row to the execution history. */
  record(a: { agentKey: string; action: string; subjectRef: string; detail: string }): Promise<number | null>;
  escalate(a: { agentKey: string; kind: EscalationKind; reason: string; subjectRef: string; escalationRules: string | null; detail?: string }): Promise<void>;
  /** The actor's operator grants (operator_scopes), read fresh each time so a revocation applies at once. */
  actorGrants(userId: number): Promise<ScopeGrant[]>;
  model: AgentModel;
  tools: ToolRegistry;
};

export type RunInput = {
  agentKey: string;
  /** What the run is about, e.g. "ticket:12". Used for recording and de-duplication. */
  subjectRef: string;
  /** The permission needed to run this agent at all. */
  runPermission: string;
  system: string;
  userMessage: string;
  ctx: RunContext;
  outputSchema?: z.ZodType<unknown>;
  maxSteps?: number;
  maxToolCalls?: number;
};

export type ToolTrace = { name: string; outcome: "executed" | "refused" | "failed" | "needs_approval"; reason?: string };

export type RunResult =
  | { status: "completed"; output: unknown; text: string; needsHumanReview: boolean; toolCalls: ToolTrace[]; steps: number; executionId: number | null }
  | { status: "blocked"; reason: string; toolCalls: ToolTrace[]; steps: number }
  | { status: "awaiting_approval"; pending: { tool: string; arguments: unknown }; toolCalls: ToolTrace[]; steps: number }
  | { status: "escalated"; reason: string; toolCalls: ToolTrace[]; steps: number }
  | { status: "failed"; reason: string; toolCalls: ToolTrace[]; steps: number };

const MAX_TOOL_OUTPUT_CHARS = 8000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Any property that names an organisation, at any depth (bounded), and its value. */
const ORG_KEYS = new Set(["organizationid", "organization_id", "orgid", "org_id", "organisationid", "organisation_id", "tenantid", "tenant_id"]);
export function organizationIdsIn(value: unknown, depth = 0): unknown[] {
  if (depth > 6 || value === null || typeof value !== "object") return [];
  const found: unknown[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (ORG_KEYS.has(k.toLowerCase())) found.push(v);
    else found.push(...organizationIdsIn(v, depth + 1));
  }
  return found;
}

function clip(text: string, max = MAX_TOOL_OUTPUT_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}…[truncated]` : text;
}

function toolResultText(value: unknown): string {
  try {
    return clip(typeof value === "string" ? value : JSON.stringify(value ?? null));
  } catch {
    return "[unserialisable result]";
  }
}

/** Extract JSON from a model answer that may be wrapped in a code fence. */
function parseJsonAnswer(text: string): unknown {
  const t = text.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : t);
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

export async function runAgent(input: RunInput, deps: RuntimeDeps): Promise<RunResult> {
  const trace: ToolTrace[] = [];
  let steps = 0;
  const maxSteps = input.maxSteps ?? 6;
  const maxToolCalls = input.maxToolCalls ?? 8;

  // ---- 1. Is this agent allowed to run at all? Fails closed. ----------------------------------------------------
  let agent: AgentDefinition | null;
  try {
    agent = await deps.loadAgent(input.agentKey);
  } catch (err) {
    return { status: "blocked", reason: `The agent registry could not be read (${(err as Error).message}).`, toolCalls: trace, steps };
  }
  if (!agent) return { status: "blocked", reason: "agent_not_found", toolCalls: trace, steps };
  if (agent.status !== "active") return { status: "blocked", reason: "agent_disabled", toolCalls: trace, steps };

  // ---- 1b. Is the PERSON who started it allowed to operate THIS agent? (G09) ------------------------------------
  // A Technical Operator authorised for Agent A has no access to Agent B. Checked now and again before every tool
  // call, so a grant that is revoked or expires mid-run stops the next call. Fails closed.
  const actorAllowed = async (): Promise<{ ok: true } | { ok: false; reason: string }> => {
    const { actorUserId, actorRole } = input.ctx;
    if (actorUserId === null) return { ok: true }; // system run: governed by the agent's own permissions
    if (!actorRole) return { ok: false, reason: "The actor's role is unknown." };
    if (actorRole !== "technical_operator") return { ok: true }; // staff and customers: governed by permissions, tools and organisation scope
    try {
      const grants = await deps.actorGrants(actorUserId);
      return operatorMayOnAgent(actorRole, grants, input.agentKey, "run")
        ? { ok: true }
        : { ok: false, reason: "This operator has no active grant to run this agent." };
    } catch (err) {
      return { ok: false, reason: `Operator access could not be verified (${(err as Error).message}).` };
    }
  };
  const first = await actorAllowed();
  if (!first.ok) {
    await deps.record({ agentKey: input.agentKey, action: "operator_denied:run", subjectRef: input.subjectRef, detail: first.reason }).catch(() => null);
    return { status: "blocked", reason: first.reason, toolCalls: trace, steps };
  }

  let start: Verdict;
  try {
    start = await deps.authorise({ agentKey: agent.key, action: input.runPermission, subjectRef: input.subjectRef, detail: null });
  } catch (err) {
    return { status: "blocked", reason: `Permission could not be verified (${(err as Error).message}).`, toolCalls: trace, steps };
  }
  if (!start) return { status: "blocked", reason: "Permission could not be verified (no verdict).", toolCalls: trace, steps };
  if (start.outcome === "blocked_by_permission") return { status: "blocked", reason: start.reason ?? "action_not_permitted", toolCalls: trace, steps };

  // Only tools that are BOTH registered in code AND listed on the registry entry are ever shown to the model.
  const offered = agent.tools.map((n) => deps.tools.get(n)).filter((t): t is AgentTool => Boolean(t));
  const specs: ToolSpec[] = offered.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));

  const messages: AgentMessage[] = [{ role: "user", content: input.userMessage }];
  let toolCallsMade = 0;
  let repaired = false;

  const escalate = async (kind: EscalationKind, reason: string, detail?: string) => {
    try {
      await deps.escalate({ agentKey: agent!.key, kind, reason, subjectRef: input.subjectRef, escalationRules: agent!.escalationRules, detail });
    } catch (err) {
      console.error("[agentRuntime] escalation could not be raised:", err);
    }
  };

  while (steps < maxSteps) {
    steps++;
    let turn: ModelTurn;
    try {
      turn = await deps.model.complete({ system: input.system, messages, tools: specs });
    } catch (err) {
      const reason = `model_error: ${(err as Error).message}`.slice(0, 300);
      await escalate("failed", reason);
      return { status: "failed", reason, toolCalls: trace, steps };
    }

    // ---- Final answer ----------------------------------------------------------------------------------------------
    if (turn.kind === "final") {
      let output: unknown = turn.content;
      if (input.outputSchema) {
        let problem: string | null = null;
        try {
          const parsed = input.outputSchema.safeParse(parseJsonAnswer(turn.content));
          if (parsed.success) output = parsed.data;
          else problem = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "answer"}: ${i.message}`).join("; ");
        } catch {
          problem = "the answer was not valid JSON";
        }
        if (problem) {
          if (!repaired && steps < maxSteps) {
            repaired = true;
            messages.push({ role: "assistant", content: turn.content });
            messages.push({ role: "user", content: `Your answer was not usable: ${problem}. Answer again in the required format only.` });
            continue;
          }
          await escalate("human_needed", "invalid_output", problem);
          return { status: "escalated", reason: "invalid_output", toolCalls: trace, steps };
        }
      }
      const executionId = await deps.record({ agentKey: agent.key, action: "run_result", subjectRef: input.subjectRef, detail: `steps=${steps}; tools=${trace.filter((t) => t.outcome === "executed").length}` }).catch(() => null);
      // An agent that requires approval hands back an output a person must still accept.
      return { status: "completed", output, text: turn.content, needsHumanReview: agent.requiresHumanApproval, toolCalls: trace, steps, executionId };
    }

    // ---- Tool calls ------------------------------------------------------------------------------------------------
    messages.push({ role: "assistant", content: "", toolCalls: turn.calls });
    for (const call of turn.calls) {
      toolCallsMade++;
      const reply = (text: string) => messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: text });
      const refuse = async (reason: string) => {
        trace.push({ name: call.name, outcome: "refused", reason });
        await deps.record({ agentKey: agent!.key, action: `tool_refused:${call.name}`.slice(0, 120), subjectRef: input.subjectRef, detail: reason }).catch(() => null);
        reply(`Refused: ${reason}`);
      };

      if (toolCallsMade > maxToolCalls) {
        await escalate("human_needed", "tool_call_limit");
        return { status: "escalated", reason: "tool_call_limit", toolCalls: trace, steps };
      }

      const still = await actorAllowed();
      if (!still.ok) {
        await refuse(`operator access to this agent ended: ${still.reason}`);
        continue;
      }

      const tool = deps.tools.get(call.name);
      if (!tool) { await refuse("unknown tool"); continue; }
      if (!agent.tools.includes(tool.name)) { await refuse("this agent is not allowed to use that tool"); continue; }

      let args: unknown;
      try {
        args = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        await refuse("arguments were not valid JSON");
        continue;
      }
      const parsed = tool.inputSchema.safeParse(args);
      if (!parsed.success) { await refuse(`arguments invalid: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`); continue; }

      if (tool.organizationScoped) {
        if (input.ctx.organizationId === null) { await refuse("this tool needs an organisation and the run has none"); continue; }
        if (organizationIdsIn(args).some((v) => v !== input.ctx.organizationId)) { await refuse("cross-organisation access is not allowed"); continue; }
      }
      if (tool.knowledgeSource && !agent.knowledgeSources.includes(tool.knowledgeSource)) { await refuse(`this agent may not read ${tool.knowledgeSource}`); continue; }

      const decision = authorityDecision(agent.maxAuthority, agent.requiresHumanApproval, tool.effect);
      if (decision === "deny") { await refuse(`${tool.effect} is above this agent's maximum authority`); continue; }

      let verdict: Verdict;
      try {
        verdict = await deps.authorise({ agentKey: agent.key, action: tool.requiredPermission, subjectRef: input.subjectRef, detail: `tool:${tool.name}` });
      } catch (err) {
        await refuse(`permission could not be verified (${(err as Error).message})`);
        continue;
      }
      if (!verdict) { await refuse("permission could not be verified (no verdict)"); continue; }
      if (verdict.outcome === "blocked_by_permission") { await refuse(`permission denied (${(verdict.reason ?? "not permitted").replace(/_/g, " ")})`); continue; }

      if (decision === "needs_approval") {
        trace.push({ name: tool.name, outcome: "needs_approval" });
        await deps.record({ agentKey: agent.key, action: `tool_awaiting_approval:${tool.name}`.slice(0, 120), subjectRef: input.subjectRef, detail: "an action needs a human decision" }).catch(() => null);
        await escalate("approval_needed", `approval needed to run ${tool.name}`, `arguments: ${Object.keys((args as Record<string, unknown>) ?? {}).join(", ") || "none"}`);
        return { status: "awaiting_approval", pending: { tool: tool.name, arguments: parsed.data }, toolCalls: trace, steps };
      }

      try {
        const out = await tool.execute(parsed.data, { ...input.ctx, agentKey: agent.key, subjectRef: input.subjectRef });
        trace.push({ name: tool.name, outcome: "executed" });
        // The record keeps names and sizes, not argument values, so personal data is not copied into the history.
        await deps.record({ agentKey: agent.key, action: `tool:${tool.name}`.slice(0, 120), subjectRef: input.subjectRef, detail: `args=${Object.keys((args as Record<string, unknown>) ?? {}).join(",")}` }).catch(() => null);
        reply(toolResultText(out));
      } catch (err) {
        trace.push({ name: tool.name, outcome: "failed", reason: (err as Error).message.slice(0, 200) });
        await deps.record({ agentKey: agent.key, action: `tool_failed:${tool.name}`.slice(0, 120), subjectRef: input.subjectRef, detail: (err as Error).message.slice(0, 300) }).catch(() => null);
        reply("The tool failed. Do not assume it succeeded.");
      }
    }
  }

  await escalate("human_needed", "step_limit");
  return { status: "escalated", reason: "step_limit", toolCalls: trace, steps };
}
