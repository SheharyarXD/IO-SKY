/**
 * Engine-level tests for `scoreAiScan`.
 *
 * The engine is built around a deterministic raw-score pass + a structured
 * LLM call. We inject a stub `invokeLLM` so the tests are hermetic and never
 * call out to the live model. We verify:
 *   • Output shape conforms to AiScanReportPayload.
 *   • Tier gating is enforced server-side (Free has empty roadmap, growth
 *     trims opportunities to 12, etc.) regardless of what the LLM returns.
 *   • Raw scoring is used as a fallback when the LLM omits a dimension.
 *   • Transport failures and bad JSON return `{ ok: false }` instead of throwing.
 *   • Locale propagates into the system prompt.
 */
import { describe, expect, it, vi } from "vitest";
import { scoreAiScan, type AiScanScoringInput } from "./_core/aiScanScoring";
import {
  AI_SCAN_DIMENSIONS,
  AI_SCAN_TIER_PROFILE,
  type AiScanDimension,
} from "../shared/aiScanModel";
import { getQuestionsForTier } from "../shared/aiScanQuestionnaire";

function answersFor(tier: "free" | "growth" | "elite", at = 0): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of getQuestionsForTier(tier)) {
    out[q.id] = q.options[Math.min(at, q.options.length - 1)].value;
  }
  return out;
}

function baseInput(
  overrides: Partial<AiScanScoringInput> = {},
): AiScanScoringInput {
  return {
    tier: "free",
    fullName: "Alice Test",
    company: "Acme",
    locale: "en",
    answers: answersFor("free"),
    ...overrides,
  };
}

function fakeLlmResponse(json: unknown) {
  return {
    id: "stub",
    object: "chat.completion",
    created: 0,
    model: "stub",
    choices: [
      {
        index: 0,
        message: { role: "assistant" as const, content: JSON.stringify(json) },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

describe("scoreAiScan", () => {
  it("returns a typed report and stamps tier + grade for free tier", async () => {
    const stub = vi.fn().mockResolvedValue(
      fakeLlmResponse({
        overallScore: 60,
        dimensions: AI_SCAN_TIER_PROFILE.free.dimensionsCovered.map(
          (d: AiScanDimension) => ({
            dimension: d,
            score: 60,
            rationale:
              "Strong fundamentals with documented playbooks but uneven cadence.",
          }),
        ),
        executiveSummary:
          "Acme shows a Developing operational footprint. Documentation is partial; "
          + "automation pilots exist but are not yet standardised across teams.",
        opportunities: [
          {
            id: "op-1",
            title: "Standardise daily ops cadence",
            category: "operationalMaturity",
            impact: "medium",
            effort: "low",
            horizon: "30-90d",
            summary: "Establish weekly KPI reviews and a single dashboard.",
          },
          {
            id: "op-2",
            title: "Reduce data hygiene debt",
            category: "automationReadiness",
            impact: "high",
            effort: "medium",
            horizon: "30-90d",
            summary: "Centralise customer records before launching automations.",
          },
          {
            id: "op-3",
            title: "Pilot one quick automation",
            category: "automationReadiness",
            impact: "medium",
            effort: "low",
            horizon: "0-30d",
            summary: "Pick one repetitive flow and document the win.",
          },
        ],
        roadmap: [],
      }),
    );

    const out = await scoreAiScan(baseInput(), { invokeLLM: stub, now: () => 1700000000000 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.report.tier).toBe("free");
    expect(out.report.scoredAt).toBe(1700000000000);
    expect(out.report.dimensions).toHaveLength(
      AI_SCAN_TIER_PROFILE.free.dimensionsCovered.length,
    );
    expect(out.report.roadmap).toEqual([]); // Free tier has no roadmap.
    expect(out.report.opportunities.length).toBeLessThanOrEqual(
      AI_SCAN_TIER_PROFILE.free.opportunitiesIncluded,
    );
    expect(out.report.disclaimers.length).toBeGreaterThan(0);
    expect(out.report.charts.timeline).toBe(false);
  });

  it("trims opportunities to the tier cap even if LLM returns more", async () => {
    const tooMany = Array.from({ length: 20 }, (_, i) => ({
      id: `op-${i + 1}`,
      title: `Opportunity ${i + 1}`,
      category: "operationalMaturity",
      impact: "medium",
      effort: "medium",
      horizon: "30-90d",
      summary: "Stub summary that is long enough to pass length validation.",
    }));
    const stub = vi.fn().mockResolvedValue(
      fakeLlmResponse({
        overallScore: 70,
        dimensions: AI_SCAN_TIER_PROFILE.growth.dimensionsCovered.map(
          (d: AiScanDimension) => ({
            dimension: d,
            score: 70,
            rationale: "Stable execution with room to industrialise the data fabric.",
          }),
        ),
        executiveSummary:
          "Growth-tier executive summary that exceeds the minimum length to satisfy "
          + "downstream consumer validators across the system.",
        opportunities: tooMany,
        roadmap: [
          { horizon: "0-30d", items: ["Quick win one"] },
          { horizon: "30-90d", items: ["Standardise data ingestion"] },
        ],
      }),
    );

    const out = await scoreAiScan(
      baseInput({ tier: "growth", answers: answersFor("growth", 1) }),
      { invokeLLM: stub },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.report.opportunities).toHaveLength(
      AI_SCAN_TIER_PROFILE.growth.opportunitiesIncluded,
    );
    expect(out.report.roadmap.length).toBeGreaterThan(0); // growth includes roadmap
  });

  it("locks dimensions to the tier profile even if LLM returns extra dimensions", async () => {
    const stub = vi.fn().mockResolvedValue(
      fakeLlmResponse({
        overallScore: 55,
        dimensions: [
          ...AI_SCAN_DIMENSIONS.map((d) => ({
            dimension: d,
            score: 55,
            rationale:
              "Refined rationale long enough to clear minimum length validation.",
          })),
        ],
        executiveSummary:
          "An executive summary that is long enough to satisfy the validator and "
          + "describe the company's overall operational maturity in two paragraphs.",
        opportunities: [],
        roadmap: [],
      }),
    );

    const out = await scoreAiScan(baseInput({ tier: "free" }), { invokeLLM: stub });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const returnedDims = out.report.dimensions.map((d) => d.dimension);
    expect(returnedDims).toEqual(AI_SCAN_TIER_PROFILE.free.dimensionsCovered);
  });

  it("falls back to deterministic raw scores when LLM omits a dimension", async () => {
    const stub = vi.fn().mockResolvedValue(
      fakeLlmResponse({
        overallScore: 50,
        dimensions: [], // empty
        executiveSummary:
          "Sparse LLM output triggers the deterministic fallback path that scores "
          + "every covered dimension from the raw signal directly.",
        opportunities: [],
        roadmap: [],
      }),
    );
    const out = await scoreAiScan(
      baseInput({ tier: "free", answers: answersFor("free", 4) }),
      { invokeLLM: stub },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.report.dimensions).toHaveLength(2);
    for (const d of out.report.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it("returns ok=false (not throw) on LLM transport failure", async () => {
    const stub = vi.fn().mockRejectedValue(new Error("network down"));
    const out = await scoreAiScan(baseInput(), { invokeLLM: stub });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("network down");
  });

  it("returns ok=false on unparseable LLM response", async () => {
    const stub = vi.fn().mockResolvedValue({
      id: "x",
      object: "chat.completion",
      created: 0,
      model: "stub",
      choices: [
        { index: 0, message: { role: "assistant" as const, content: "not-json" }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
    const out = await scoreAiScan(baseInput(), { invokeLLM: stub });
    expect(out.ok).toBe(false);
  });

  it("propagates locale into the system prompt", async () => {
    const stub = vi.fn().mockResolvedValue(
      fakeLlmResponse({
        overallScore: 50,
        dimensions: [],
        executiveSummary:
          "Filler executive summary long enough to satisfy minimum-length validators "
          + "for the AI Scan report payload contract.",
        opportunities: [],
        roadmap: [],
      }),
    );
    await scoreAiScan(baseInput({ locale: "nl" }), { invokeLLM: stub });
    const callArgs = stub.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const sys = callArgs.messages.find((m) => m.role === "system");
    expect(sys?.content).toContain("\"nl\"");
  });
});
