/**
 * Production wiring for the agent runtime (task G03). Nothing calls this yet:
 * no agent has been moved onto the runtime, no tool is registered, and no model
 * call is made by importing it. It exists so that when an agent is approved and
 * specified, it runs through the same enforced loop as every other.
 */
import type { InvokeParams, InvokeResult, Message, Tool } from "./_core/llm";
import type { AgentMessage, AgentModel, ModelTurn, RuntimeDeps, ToolRegistry, ToolSpec } from "./agentRuntime";

/** Adapt the platform's LLM wrapper (OpenAI chat format) to the runtime's provider-independent model interface. */
export function llmAgentModel(invoke: (p: InvokeParams) => Promise<InvokeResult>, opts: { complexity?: InvokeParams["complexity"]; purpose: string }): AgentModel {
  return {
    async complete({ system, messages, tools }): Promise<ModelTurn> {
      const wire: Message[] = [{ role: "system", content: system }];
      for (const m of messages) {
        if (m.role === "tool") wire.push({ role: "tool", content: m.content, tool_call_id: m.toolCallId, name: m.name });
        else if (m.role === "assistant" && m.toolCalls?.length) {
          // The wrapper's Message type has no tool_calls field; the provider needs them echoed back on the assistant turn.
          wire.push({ role: "assistant", content: m.content, tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })) } as unknown as Message);
        } else wire.push({ role: m.role, content: m.content });
      }
      const spec: Tool[] | undefined = tools.length
        ? tools.map((t: ToolSpec) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }))
        : undefined;
      const res = await invoke({ messages: wire, tools: spec, toolChoice: spec ? "auto" : undefined, complexity: opts.complexity, purpose: opts.purpose });
      const msg = res.choices[0]?.message;
      if (!msg) throw new Error("The model returned no answer.");
      if (msg.tool_calls?.length) {
        return { kind: "tool_calls", calls: msg.tool_calls.map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })) };
      }
      const text = typeof msg.content === "string" ? msg.content : msg.content.map((p) => (p.type === "text" ? p.text : "")).join("");
      return { kind: "final", content: text };
    },
  };
}

/** The runtime's dependencies backed by the real registry, history and notifications. */
export async function realRuntimeDeps(model: AgentModel, tools: ToolRegistry): Promise<RuntimeDeps> {
  const [gov, dispatcher] = await Promise.all([import("./db/srsGovernance"), import("./notificationDispatcher")]);
  return {
    loadAgent: gov.getAiAgentDefinition,
    authorise: (a) => gov.authoriseAndRecordAgentAction(a),
    record: (a) => gov.recordAgentResult(a),
    escalate: async ({ agentKey, kind, reason, subjectRef, escalationRules, detail }) => {
      await dispatcher.emitNotification({
        event: kind === "failed" ? "AI_OPERATION_FAILED" : "AI_HUMAN_INTERVENTION_REQUIRED",
        audience: { type: "admin" },
        dedupeRef: `agent:${agentKey}:${subjectRef}:${reason}`.slice(0, 190),
        title: kind === "approval_needed" ? `An AI action needs your approval (${agentKey})` : kind === "failed" ? `An AI agent run failed (${agentKey})` : `An AI agent needs a person (${agentKey})`,
        body: `${reason}${detail ? ` (${detail})` : ""}. Subject: ${subjectRef}.${escalationRules ? ` Escalation rule: ${escalationRules}` : ""}`.slice(0, 900),
        href: "/admin/governance",
      });
    },
    model,
    tools,
  };
}

export type { AgentMessage };
