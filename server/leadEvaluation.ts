/**
 * AI assisted lead evaluation (SRS 14.16, 19.7), the second module routed through
 * the AI agent registry after the AI Scan.
 *
 * The result is a recommendation. It is recorded against the agent run, which
 * needs a person's decision, and it never changes the lead by itself (BR-009).
 * Anything inferred about a prospect is labelled a hypothesis.
 */
import { invokeLLM as defaultInvoke, type InvokeParams, type InvokeResult } from "./_core/llm";
import { authoriseAndRecordAgentAction, ensureAgent, getActivePrompt, recordAgentResult } from "./db/srsGovernance";

export const LEAD_AGENT_KEY = "lead_qualifier";

export const DEFAULT_LEAD_PROMPT =
  "You assess an inbound sales lead for IO SKY, a provider of AI Scans, recurring operating systems and custom software. " +
  "Use only the facts supplied. Anything you infer is a hypothesis and must be worded as one. " +
  "Return fit (high, medium or low), a short summary, the most likely service (ai_scan, recurring_system, custom_project or unclear), " +
  "one suggested next step, and up to three qualification questions. Do not invent company facts.";

export type LeadEvaluation = {
  fit: "high" | "medium" | "low";
  summary: string;
  likelyService: "ai_scan" | "recurring_system" | "custom_project" | "unclear";
  nextStep: string;
  questions: string[];
};

const FITS = ["high", "medium", "low"] as const;
const SERVICES = ["ai_scan", "recurring_system", "custom_project", "unclear"] as const;

/** Strict parse: a malformed model answer is rejected rather than half trusted. */
export function parseLeadEvaluation(raw: unknown): LeadEvaluation | null {
  try {
    const j = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!j || typeof j !== "object") return null;
    const o = j as Record<string, unknown>;
    if (!(FITS as readonly unknown[]).includes(o.fit)) return null;
    if (!(SERVICES as readonly unknown[]).includes(o.likelyService)) return null;
    if (typeof o.summary !== "string" || !o.summary.trim() || typeof o.nextStep !== "string") return null;
    const questions = Array.isArray(o.questions) ? o.questions.filter((q): q is string => typeof q === "string").slice(0, 3) : [];
    return { fit: o.fit as LeadEvaluation["fit"], summary: o.summary.slice(0, 800), likelyService: o.likelyService as LeadEvaluation["likelyService"], nextStep: o.nextStep.slice(0, 300), questions: questions.map((q) => q.slice(0, 200)) };
  } catch {
    return null;
  }
}

const SCHEMA = {
  name: "lead_evaluation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["fit", "summary", "likelyService", "nextStep", "questions"],
    properties: {
      fit: { type: "string", enum: [...FITS] },
      summary: { type: "string" },
      likelyService: { type: "string", enum: [...SERVICES] },
      nextStep: { type: "string" },
      questions: { type: "array", items: { type: "string" } },
    },
  },
};

export type LeadFacts = { id: number; fullName: string; company: string | null; interest: string | null; note: string | null; source: string };

export async function evaluateLead(
  lead: LeadFacts,
  deps: { invokeLLM?: (p: InvokeParams) => Promise<InvokeResult> } = {},
): Promise<{ ok: true; evaluation: LeadEvaluation; executionId: number | null } | { ok: false; reason: string }> {
  await ensureAgent({
    key: LEAD_AGENT_KEY,
    name: "Lead qualifier",
    purpose: "Assesses fit for an inbound lead and suggests a next step. A person decides what happens to the lead.",
    permissions: ["evaluate_lead"],
    requiresHumanApproval: true,
    basePrompt: DEFAULT_LEAD_PROMPT,
  });
  const gate = await authoriseAndRecordAgentAction({ agentKey: LEAD_AGENT_KEY, action: "evaluate_lead", subjectRef: `lead:${lead.id}`, detail: null });
  if (gate && gate.outcome === "blocked_by_permission") return { ok: false, reason: `The lead qualifier is not permitted to run (${gate.reason.replace(/_/g, " ")}).` };
  const prompt = (await getActivePrompt(LEAD_AGENT_KEY))?.body ?? DEFAULT_LEAD_PROMPT;
  const facts = [`Name: ${lead.fullName}`, `Company: ${lead.company ?? "unknown"}`, `Source: ${lead.source}`, `Stated interest: ${lead.interest ?? "none"}`, `Note: ${lead.note ?? "none"}`].join("\n");
  const invoke = deps.invokeLLM ?? defaultInvoke;
  let result: InvokeResult;
  try {
    result = await invoke({
      messages: [{ role: "system", content: prompt }, { role: "user", content: facts }],
      response_format: { type: "json_schema", json_schema: SCHEMA },
      complexity: "simple",
      purpose: "lead.evaluation",
      maxTokens: 600,
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "The AI provider could not be reached." };
  }
  const content = result.choices?.[0]?.message?.content;
  const evaluation = parseLeadEvaluation(typeof content === "string" ? content : null);
  if (!evaluation) return { ok: false, reason: "The AI answer could not be understood, so nothing was recorded." };
  const executionId = await recordAgentResult({ agentKey: LEAD_AGENT_KEY, action: "evaluate_lead_result", subjectRef: `lead:${lead.id}`, detail: JSON.stringify(evaluation) });
  return { ok: true, evaluation, executionId };
}
