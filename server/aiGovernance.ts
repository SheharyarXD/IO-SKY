/**
 * Gate for the AI Scan engine (SRS 19.8, 19.9, BR-009).
 *
 * Before the model is called, the run must pass the agent registry: the agent
 * must exist, be active, and be permitted to generate scan reports. The attempt
 * is recorded either way, and the active managed prompt is returned so the
 * engine uses the versioned text rather than a hard coded one.
 *
 * The gate fails closed (SRS 19.18, BR-009). An explicit refusal blocks the run
 * (a super admin disabling the agent is a kill switch), and so does any
 * condition under which permission cannot be verified: a registry error, or no
 * verdict at all. A blocked run is marked failed and the admin team is notified
 * by the caller, so the scan can be re-run once the registry is healthy; an
 * unverified model call is never made.
 */
import { DEFAULT_SCAN_BASE_PROMPT } from "./_core/aiScanScoring";
import { AI_SCAN_AGENT_KEY, authoriseAndRecordAgentAction, ensureDefaultAiAgents, getActivePrompt } from "./db";

export type AiGuard =
  | { allowed: true; basePrompt?: string; promptVersion?: number }
  | { allowed: false; reason: string };

export async function guardAiScanRun(scanId: number): Promise<AiGuard> {
  try {
    await ensureDefaultAiAgents(DEFAULT_SCAN_BASE_PROMPT);
    const verdict = await authoriseAndRecordAgentAction({
      agentKey: AI_SCAN_AGENT_KEY,
      action: "generate_scan_report",
      subjectRef: `scan:${scanId}`,
      detail: null,
    });
    if (!verdict) {
      return { allowed: false, reason: "The AI Scan analyst could not be run because its permission could not be verified (no registry verdict)." };
    }
    if (verdict.outcome === "blocked_by_permission") {
      return { allowed: false, reason: `The AI Scan analyst is not permitted to run (${verdict.reason.replace(/_/g, " ")}).` };
    }
    const prompt = await getActivePrompt(AI_SCAN_AGENT_KEY);
    return prompt ? { allowed: true, basePrompt: prompt.body, promptVersion: prompt.version } : { allowed: true };
  } catch (err) {
    console.error("[aiGovernance] registry unavailable, blocking the run (fail closed):", err);
    return { allowed: false, reason: "The AI Scan analyst could not be run because its permission could not be verified (registry unavailable)." };
  }
}
