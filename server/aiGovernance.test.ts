/*
 * AI governance gate for the AI Scan engine (SRS 19, BR-009): a disabled agent
 * stops the run, the managed prompt is what the model receives, the language
 * instruction cannot be edited away, and a registry outage never takes customer
 * scans down.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ensureDefaultAiAgents: vi.fn(async () => {}),
  authoriseAndRecordAgentAction: vi.fn(),
  getActivePrompt: vi.fn(),
}));

vi.mock("./db", () => ({
  AI_SCAN_AGENT_KEY: "ai_scan_analyst",
  ensureDefaultAiAgents: m.ensureDefaultAiAgents,
  authoriseAndRecordAgentAction: m.authoriseAndRecordAgentAction,
  getActivePrompt: m.getActivePrompt,
}));

import { guardAiScanRun } from "./aiGovernance";
import { DEFAULT_SCAN_BASE_PROMPT, scoreAiScan } from "./_core/aiScanScoring";
import { getQuestionsForTier } from "../shared/aiScanQuestionnaire";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("guardAiScanRun", () => {
  it("registers the defaults, records the attempt and returns the active managed prompt", async () => {
    m.authoriseAndRecordAgentAction.mockResolvedValueOnce({ outcome: "awaiting_approval", executionId: 4, promptVersion: 3 });
    m.getActivePrompt.mockResolvedValueOnce({ version: 3, body: "Be concise." });
    const g = await guardAiScanRun(12);
    expect(g).toEqual({ allowed: true, basePrompt: "Be concise.", promptVersion: 3 });
    expect(m.ensureDefaultAiAgents).toHaveBeenCalledWith(DEFAULT_SCAN_BASE_PROMPT);
    expect(m.authoriseAndRecordAgentAction).toHaveBeenCalledWith({ agentKey: "ai_scan_analyst", action: "generate_scan_report", subjectRef: "scan:12", detail: null });
  });

  it("blocks the run when the agent is disabled or lacks the permission", async () => {
    m.authoriseAndRecordAgentAction.mockResolvedValueOnce({ outcome: "blocked_by_permission", executionId: 5, reason: "agent_disabled" });
    const g = await guardAiScanRun(12);
    expect(g.allowed).toBe(false);
    expect((g as { reason: string }).reason).toContain("agent disabled");
    expect(m.getActivePrompt).not.toHaveBeenCalled();
  });

  it("runs on the default prompt when there is no managed prompt yet", async () => {
    m.authoriseAndRecordAgentAction.mockResolvedValueOnce({ outcome: "awaiting_approval", executionId: 4, promptVersion: null });
    m.getActivePrompt.mockResolvedValueOnce(null);
    expect(await guardAiScanRun(1)).toEqual({ allowed: true });
  });

  it("does not take scans down when the registry itself fails", async () => {
    m.ensureDefaultAiAgents.mockRejectedValueOnce(new Error("db down"));
    expect(await guardAiScanRun(1)).toEqual({ allowed: true });
  });
});

describe("managed prompt in the scoring call", () => {
  const answers = () => Object.fromEntries(getQuestionsForTier("free").map((q) => [q.id, q.options[0].value]));
  const capture = () => {
    let system = "";
    const invokeLLM = vi.fn(async (req: { messages: Array<{ role: string; content: string }> }) => {
      system = req.messages.find((x) => x.role === "system")!.content;
      return { id: "s", object: "chat.completion", created: 0, model: "s", choices: [{ index: 0, message: { role: "assistant", content: "not json" }, finish_reason: "stop" }] };
    });
    return { invokeLLM, system: () => system };
  };

  it("uses the managed text and always appends the language instruction", async () => {
    const c = capture();
    await scoreAiScan({ tier: "free", fullName: "A", company: "B", locale: "nl", answers: answers(), basePrompt: "Managed instruction." }, { invokeLLM: c.invokeLLM as never });
    expect(c.system()).toContain("Managed instruction.");
    expect(c.system()).not.toContain(DEFAULT_SCAN_BASE_PROMPT);
    expect(c.system()).toContain('locale code "nl"');
  });

  it("falls back to the built in text for an empty managed prompt", async () => {
    const c = capture();
    await scoreAiScan({ tier: "free", fullName: "A", company: "B", locale: "en", answers: answers(), basePrompt: "   " }, { invokeLLM: c.invokeLLM as never });
    expect(c.system()).toContain(DEFAULT_SCAN_BASE_PROMPT);
  });
});
