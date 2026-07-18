/**
 * IO SKY — AI Scan scoring engine.
 *
 * Translates a questionnaire payload into a typed `AiScanReportPayload` by
 * combining a deterministic raw-score pass over the question bank with a
 * structured LLM call that:
 *
 *   1. Refines each per-dimension score (within ±10 of the raw signal).
 *   2. Writes a one-paragraph rationale per dimension, in the requested locale.
 *   3. Generates the executive summary, opportunities and roadmap, gated by
 *      the tier's profile (free / growth / elite).
 *
 * The engine never throws on LLM transport errors — it returns a typed
 * `{ ok: false, error }` shape so the caller can persist a failure record
 * and surface a friendly "we'll email you" message to the user.
 *
 * Test seam: pass `invokeLLM` via the `deps` argument to inject a stub.
 */

import {
  AI_SCAN_DIMENSIONS,
  AI_SCAN_DIMENSION_LABELS,
  AI_SCAN_DEFAULT_DISCLAIMERS,
  AI_SCAN_TIER_PROFILE,
  gradeForScore,
  type AiScanDimension,
  type AiScanReportPayload,
} from "../../shared/aiScanModel";
import {
  computeRawDimensionScores,
} from "../../shared/aiScanQuestionnaire";
import { invokeLLM as defaultInvokeLLM, type InvokeParams, type InvokeResult } from "./llm";

export interface AiScanScoringInput {
  tier: "free" | "growth" | "elite";
  locale?: string;
  fullName: string;
  company: string;
  /** Map of questionId → answer-value. */
  answers: Record<string, string>;
  /** Optional free-form note from the intake form. */
  contextNote?: string;
}

export type AiScanScoringResult =
  | { ok: true; report: AiScanReportPayload }
  | { ok: false; error: string };

interface Deps {
  invokeLLM?: (p: InvokeParams) => Promise<InvokeResult>;
  /** Override for deterministic tests. */
  now?: () => number;
}

/** JSON schema we constrain the LLM to. Mirrors AiScanReportPayload. */
const REPORT_JSON_SCHEMA = {
  name: "ai_scan_report",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "overallScore",
      "dimensions",
      "executiveSummary",
      "opportunities",
      "roadmap",
    ],
    properties: {
      overallScore: { type: "integer", minimum: 0, maximum: 100 },
      dimensions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["dimension", "score", "rationale"],
          properties: {
            dimension: {
              type: "string",
              enum: AI_SCAN_DIMENSIONS as unknown as string[],
            },
            score: { type: "integer", minimum: 0, maximum: 100 },
            rationale: { type: "string", minLength: 30, maxLength: 600 },
          },
        },
      },
      executiveSummary: { type: "string", minLength: 80, maxLength: 1500 },
      opportunities: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "category", "impact", "effort", "horizon", "summary"],
          properties: {
            id: { type: "string" },
            title: { type: "string", minLength: 4, maxLength: 140 },
            category: {
              type: "string",
              enum: AI_SCAN_DIMENSIONS as unknown as string[],
            },
            impact: {
              type: "string",
              enum: ["low", "medium", "high", "transformational"],
            },
            effort: { type: "string", enum: ["low", "medium", "high"] },
            horizon: {
              type: "string",
              enum: ["0-30d", "30-90d", "90-180d", "180d+"],
            },
            summary: { type: "string", minLength: 20, maxLength: 400 },
          },
        },
      },
      roadmap: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["horizon", "items"],
          properties: {
            horizon: {
              type: "string",
              enum: ["0-30d", "30-90d", "90-180d", "180d+"],
            },
            items: {
              type: "array",
              items: { type: "string", minLength: 4, maxLength: 220 },
            },
          },
        },
      },
    },
  },
};

function buildSystemPrompt(locale: string): string {
  return [
    "You are the IO SKY AI Scan analyst. You produce structured, accurate operational-maturity reports.",
    `Respond in the language with locale code "${locale}". If unsupported, fall back to English.`,
    "Stay grounded in the answers provided. Never invent numerical evidence not present in the input.",
    "Rationales must be a single paragraph each, plain prose, no bullet points.",
    "Executive summary must read like a board memo — 2 short paragraphs, decisive but balanced.",
  ].join(" ");
}

function buildUserPrompt(
  input: AiScanScoringInput,
  rawScores: Partial<Record<AiScanDimension, number>>,
): string {
  const profile = AI_SCAN_TIER_PROFILE[input.tier];
  const dims = profile.dimensionsCovered;

  const lines: string[] = [];
  lines.push(`Tier: ${input.tier}`);
  lines.push(`Company: ${input.company}`);
  lines.push(`Respondent: ${input.fullName}`);
  if (input.contextNote) lines.push(`Context note: ${input.contextNote}`);
  lines.push("");
  lines.push("Raw scoring signals (engine-computed, refine within ±10):");
  for (const d of dims) {
    const raw = rawScores[d];
    lines.push(`- ${AI_SCAN_DIMENSION_LABELS[d]}: ${raw ?? "n/a"}`);
  }
  lines.push("");
  lines.push("Answer summary:");
  for (const [qid, value] of Object.entries(input.answers)) {
    lines.push(`- ${qid}: ${value}`);
  }
  lines.push("");
  lines.push(
    `Produce a JSON object that conforms to the schema. The dimensions array MUST contain exactly the dimensions covered by the ${input.tier} tier (${dims.join(", ")}), in order. The opportunities array MUST contain exactly ${profile.opportunitiesIncluded} items, each tied to one of the covered dimensions. The roadmap array ${
      profile.includesRoadmap
        ? "MUST contain at least one item per horizon (0-30d, 30-90d, 90-180d) and may include 180d+ items"
        : "MUST be an empty array (free tier does not include a roadmap)"
    }.`,
  );
  return lines.join("\n");
}

function clampScore(n: unknown, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toReportPayload(
  raw: unknown,
  input: AiScanScoringInput,
  rawScores: Partial<Record<AiScanDimension, number>>,
  now: number,
): AiScanReportPayload {
  const profile = AI_SCAN_TIER_PROFILE[input.tier];
  const obj = raw as Record<string, unknown>;
  const dimensionsRaw = Array.isArray(obj.dimensions) ? obj.dimensions : [];
  const opportunitiesRaw = Array.isArray(obj.opportunities) ? obj.opportunities : [];
  const roadmapRaw = Array.isArray(obj.roadmap) ? obj.roadmap : [];

  // Force the dimensions array to exactly the tier's covered dimensions, in
  // the canonical order. Fill missing entries from the raw signal.
  const dimensions = profile.dimensionsCovered.map((dim) => {
    const fromLLM = dimensionsRaw.find(
      (d) => (d as Record<string, unknown>).dimension === dim,
    ) as Record<string, unknown> | undefined;
    const score = clampScore(fromLLM?.score, rawScores[dim] ?? 50);
    const rationale =
      typeof fromLLM?.rationale === "string" && fromLLM.rationale.trim().length > 20
        ? (fromLLM.rationale as string).trim()
        : `${AI_SCAN_DIMENSION_LABELS[dim]} signal computed from your answers; an expert review will refine the rationale.`;
    return {
      dimension: dim,
      score,
      grade: gradeForScore(score),
      rationale,
    };
  });

  const overall = clampScore(
    obj.overallScore,
    Math.round(
      dimensions.reduce((s, d) => s + d.score, 0) / Math.max(dimensions.length, 1),
    ),
  );

  // Trim opportunities to the tier-allowed count, keep type-safe shape.
  const opportunities = opportunitiesRaw
    .slice(0, profile.opportunitiesIncluded)
    .map((o, idx) => {
      const r = o as Record<string, unknown>;
      const cat = (r.category as AiScanDimension) ?? profile.dimensionsCovered[0];
      return {
        id: typeof r.id === "string" ? r.id : `op-${idx + 1}`,
        title: typeof r.title === "string" ? r.title : `Opportunity ${idx + 1}`,
        category: profile.dimensionsCovered.includes(cat) ? cat : profile.dimensionsCovered[0],
        impact: (r.impact as "low" | "medium" | "high" | "transformational") ?? "medium",
        effort: (r.effort as "low" | "medium" | "high") ?? "medium",
        horizon:
          (r.horizon as "0-30d" | "30-90d" | "90-180d" | "180d+") ?? "30-90d",
        summary:
          typeof r.summary === "string"
            ? r.summary
            : "Summary to be expanded during expert review.",
      };
    });

  const roadmap = profile.includesRoadmap
    ? roadmapRaw.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          horizon:
            (r.horizon as "0-30d" | "30-90d" | "90-180d" | "180d+") ?? "0-30d",
          items: Array.isArray(r.items)
            ? (r.items as unknown[]).filter((x): x is string => typeof x === "string")
            : [],
        };
      })
    : [];

  const executiveSummary =
    typeof obj.executiveSummary === "string" && obj.executiveSummary.length > 60
      ? obj.executiveSummary
      : `${input.company} shows an overall operational maturity of ${overall}/100. The strongest dimension is ${
          dimensions
            .slice()
            .sort((a, b) => b.score - a.score)[0]?.dimension ?? "operationalMaturity"
        }; the highest-leverage opportunity area is ${
          dimensions.slice().sort((a, b) => a.score - b.score)[0]?.dimension ??
          "operationalMaturity"
        }. Expert refinement is recommended for board-grade certainty.`;

  return {
    overallScore: overall,
    overallGrade: gradeForScore(overall),
    scoredAt: now,
    tier: input.tier,
    dimensions,
    executiveSummary,
    opportunities,
    roadmap,
    charts: { radar: true, bar: true, timeline: profile.includesRoadmap },
    disclaimers: [...AI_SCAN_DEFAULT_DISCLAIMERS],
  };
}

export async function scoreAiScan(
  input: AiScanScoringInput,
  deps: Deps = {},
): Promise<AiScanScoringResult> {
  const invoke = deps.invokeLLM ?? defaultInvokeLLM;
  const now = (deps.now ?? Date.now)();
  const locale = input.locale ?? "en";

  const rawScores = computeRawDimensionScores(input.answers);

  let result: InvokeResult;
  try {
    result = await invoke({
      messages: [
        { role: "system", content: buildSystemPrompt(locale) },
        { role: "user", content: buildUserPrompt(input, rawScores) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: REPORT_JSON_SCHEMA,
      },
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "LLM invocation failed",
    };
  }

  const content = result.choices?.[0]?.message?.content;
  let parsed: unknown;
  try {
    if (typeof content === "string") {
      parsed = JSON.parse(content);
    } else if (Array.isArray(content)) {
      const text = content
        .filter((p) => typeof p === "object" && p !== null && (p as { type?: string }).type === "text")
        .map((p) => (p as { text?: string }).text ?? "")
        .join("");
      parsed = JSON.parse(text);
    } else {
      throw new Error("LLM returned no content");
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not parse LLM response",
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "LLM response was not an object" };
  }

  const report = toReportPayload(parsed, input, rawScores, now);
  return { ok: true, report };
}
