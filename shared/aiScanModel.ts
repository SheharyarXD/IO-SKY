/**
 * IO SKY — AI Scan scoring model (canonical contract).
 *
 * This file is the single source of truth for what an AI Scan produces:
 *
 *   • The five maturity dimensions
 *   • The shape of an executive report
 *   • The grading bands (0–100 → label)
 *   • The roadmap horizon enum
 *
 * The contract is consumed by:
 *   • The intake form (which dimension a question maps to)
 *   • The (forthcoming) scoring engine (server/_core/aiScanScoring.ts)
 *   • The report renderer (PDF + portal dashboard)
 *   • The admin moderation surface (manual override)
 *
 * Keeping this contract typed and locale-aware ensures the marketing claim
 * "Operational maturity, Automation readiness, Infrastructure maturity,
 * Scalability readiness, AI opportunity potential" maps to real fields the
 * engine emits — no marketing-only language.
 */

export const AI_SCAN_DIMENSIONS = [
  "operationalMaturity",
  "automationReadiness",
  "infrastructureMaturity",
  "scalabilityReadiness",
  "aiOpportunityPotential",
] as const;

export type AiScanDimension = (typeof AI_SCAN_DIMENSIONS)[number];

/**
 * Human-facing labels for each dimension. Wire through `t()` in the UI by
 * using key `aiscan.dimension.{key}` so locales can override; this file
 * provides the canonical English fallback.
 */
export const AI_SCAN_DIMENSION_LABELS: Record<AiScanDimension, string> = {
  operationalMaturity: "Operational maturity",
  automationReadiness: "Automation readiness",
  infrastructureMaturity: "Infrastructure maturity",
  scalabilityReadiness: "Scalability readiness",
  aiOpportunityPotential: "AI opportunity potential",
};

/**
 * Concise description of what each dimension measures. Used as the
 * radar-axis subtitle in the report PDF and in the operational dashboard.
 */
export const AI_SCAN_DIMENSION_DESCRIPTIONS: Record<AiScanDimension, string> = {
  operationalMaturity:
    "How structured, documented, and repeatable day-to-day operations are.",
  automationReadiness:
    "How well processes are positioned for automation today (data quality, tool stack, ownership).",
  infrastructureMaturity:
    "Stability, observability, and security posture of the underlying technical stack.",
  scalabilityReadiness:
    "Capacity of people, processes and systems to absorb 5–10× growth without breakage.",
  aiOpportunityPotential:
    "Density of high-leverage AI/automation opportunities discovered during the scan.",
};

export type AiScanGrade = "critical" | "developing" | "established" | "mature" | "leading";

/** Standard grading band — applied uniformly across dimensions and overall score. */
export const AI_SCAN_GRADE_BANDS: Array<{ min: number; max: number; grade: AiScanGrade }> = [
  { min: 0,  max: 39,  grade: "critical" },
  { min: 40, max: 54,  grade: "developing" },
  { min: 55, max: 69,  grade: "established" },
  { min: 70, max: 84,  grade: "mature" },
  { min: 85, max: 100, grade: "leading" },
];

export function gradeForScore(score: number): AiScanGrade {
  const band = AI_SCAN_GRADE_BANDS.find((b) => score >= b.min && score <= b.max);
  return band?.grade ?? "developing";
}

/** Per-dimension score (0–100). */
export interface AiScanDimensionScore {
  dimension: AiScanDimension;
  score: number;
  grade: AiScanGrade;
  rationale: string;
}

/** A single AI-detected opportunity within the scanned business. */
export interface AiScanOpportunity {
  id: string;
  title: string;
  category: AiScanDimension;
  impact: "low" | "medium" | "high" | "transformational";
  effort: "low" | "medium" | "high";
  horizon: "0-30d" | "30-90d" | "90-180d" | "180d+";
  summary: string;
}

/** The structured payload an executive report contains. */
export interface AiScanReportPayload {
  /** 0–100 weighted average across dimensions. */
  overallScore: number;
  overallGrade: AiScanGrade;
  scoredAt: number; // epoch ms (UTC)
  tier: "free" | "growth" | "elite";
  dimensions: AiScanDimensionScore[];
  executiveSummary: string;
  opportunities: AiScanOpportunity[];
  /** Operational roadmap, grouped by horizon. */
  roadmap: Array<{
    horizon: AiScanOpportunity["horizon"];
    items: string[];
  }>;
  /** Charts requested by the report renderer. Keep types explicit. */
  charts: {
    radar: boolean; // dimensions radar
    bar: boolean; // opportunity impact bars
    timeline: boolean; // roadmap timeline
  };
  disclaimers: string[];
}

/**
 * Tier-specific report depth. The marketing copy on the public site MUST
 * stay aligned with these values so we never overpromise.
 */
export const AI_SCAN_TIER_PROFILE: Record<
  "free" | "growth" | "elite",
  {
    questionCount: number;
    dimensionsCovered: AiScanDimension[];
    opportunitiesIncluded: number;
    includesRoadmap: boolean;
    expertRefinement: boolean;
  }
> = {
  free: {
    questionCount: 7,
    dimensionsCovered: ["operationalMaturity", "automationReadiness"],
    opportunitiesIncluded: 3,
    includesRoadmap: false,
    expertRefinement: false,
  },
  growth: {
    questionCount: 18,
    dimensionsCovered: [
      "operationalMaturity",
      "automationReadiness",
      "infrastructureMaturity",
      "scalabilityReadiness",
    ],
    opportunitiesIncluded: 12,
    includesRoadmap: true,
    expertRefinement: true,
  },
  elite: {
    questionCount: 35,
    dimensionsCovered: [...AI_SCAN_DIMENSIONS],
    opportunitiesIncluded: 25,
    includesRoadmap: true,
    expertRefinement: true,
  },
};

/**
 * Required disclaimers attached to every AI Scan report.
 * Sourced from the AI Disclaimer page so they stay in sync.
 */
export const AI_SCAN_DEFAULT_DISCLAIMERS = [
  "This report is generated with the assistance of AI models and reflects the information you provided. It is not a substitute for professional advisory.",
  "Scores are indicative and meant to direct attention; absolute values should not be over-interpreted.",
  "All processing follows the IO SKY Privacy Notice. No data is sold to third parties.",
] as const;
