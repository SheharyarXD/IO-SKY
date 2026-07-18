/**
 * IO SKY — Canonical AI Scan questionnaire bank.
 *
 * This file is the single source of truth for the questions that drive the
 * AI Scan, alongside `shared/aiScanModel.ts` which defines the contract for
 * the report. Each question is mapped to exactly one dimension so the
 * scoring engine can attribute responses correctly.
 *
 * Tier mapping (must remain consistent with AI_SCAN_TIER_PROFILE):
 *   - free   → 7 questions covering operationalMaturity + automationReadiness
 *   - growth → 18 questions covering 4 dimensions
 *   - elite  → 35 questions covering all 5 dimensions
 *
 * UI MUST render questions in the order returned by `getQuestionsForTier`.
 */

import {
  type AiScanDimension,
  AI_SCAN_TIER_PROFILE,
} from "./aiScanModel";

export type AiScanAnswerScale = {
  /** Discrete-value choice presented to the respondent. */
  value: string;
  label: string;
  /**
   * Score contribution (0–100) for this answer toward the parent dimension.
   * The engine uses the average of contributions across answered questions
   * for the dimension as the *raw signal*; the LLM then refines and writes
   * the rationale + executive summary.
   */
  score: number;
};

export interface AiScanQuestion {
  id: string;
  dimension: AiScanDimension;
  /** Locale fallback (English). UI should override via t(`aiscan.q.${id}`). */
  prompt: string;
  /** UI hint — short clarifying sentence under the prompt. */
  helper?: string;
  options: AiScanAnswerScale[];
  /** Tiers that include this question. Higher tiers always include lower tiers' questions. */
  tiers: ReadonlyArray<"free" | "growth" | "elite">;
}

const SCALE_MATURITY: AiScanAnswerScale[] = [
  { value: "ad-hoc",      label: "Ad-hoc / undocumented",     score: 15 },
  { value: "developing",  label: "Some structure, inconsistent", score: 40 },
  { value: "established", label: "Documented and repeated",   score: 65 },
  { value: "mature",      label: "Measured and optimised",    score: 80 },
  { value: "leading",     label: "Continuously improved",     score: 95 },
];

const SCALE_READINESS: AiScanAnswerScale[] = [
  { value: "blocked",     label: "Blocked — too many gaps",  score: 15 },
  { value: "early",       label: "Early — pilots only",      score: 40 },
  { value: "scaling",     label: "Scaling — proven in parts", score: 65 },
  { value: "embedded",    label: "Embedded — default mode",  score: 85 },
];

const SCALE_OPPORTUNITY: AiScanAnswerScale[] = [
  { value: "few",         label: "Few or none in mind",      score: 25 },
  { value: "some",        label: "A handful identified",     score: 55 },
  { value: "many",        label: "Many — actively listed",   score: 80 },
  { value: "transformational", label: "Transformational backlog", score: 95 },
];

/**
 * Canonical question bank — order in this array is the canonical render order.
 * Each tier ships a deterministic subset.
 */
export const AI_SCAN_QUESTION_BANK: AiScanQuestion[] = [
  // ── operationalMaturity
  {
    id: "om.processes",
    dimension: "operationalMaturity",
    prompt: "How would you describe the documentation of your core operating processes?",
    helper: "Sales, delivery, finance, hiring — pick the level that fits the majority.",
    options: SCALE_MATURITY,
    tiers: ["free", "growth", "elite"],
  },
  {
    id: "om.handoffs",
    dimension: "operationalMaturity",
    prompt: "How smooth are the handoffs between teams or tools today?",
    options: SCALE_MATURITY,
    tiers: ["free", "growth", "elite"],
  },
  {
    id: "om.kpis",
    dimension: "operationalMaturity",
    prompt: "How clearly are operational KPIs tracked and acted on across the team?",
    options: SCALE_MATURITY,
    tiers: ["free", "growth", "elite"],
  },
  {
    id: "om.reporting",
    dimension: "operationalMaturity",
    prompt: "How reliable is the reporting that leadership uses to make decisions?",
    options: SCALE_MATURITY,
    tiers: ["growth", "elite"],
  },
  {
    id: "om.ownership",
    dimension: "operationalMaturity",
    prompt: "Are roles, responsibilities and decision rights clearly defined?",
    options: SCALE_MATURITY,
    tiers: ["growth", "elite"],
  },
  {
    id: "om.continuity",
    dimension: "operationalMaturity",
    prompt: "How well does the operation run when key people are unavailable?",
    options: SCALE_MATURITY,
    tiers: ["elite"],
  },
  {
    id: "om.feedback",
    dimension: "operationalMaturity",
    prompt: "How systematically do you collect and act on customer feedback?",
    options: SCALE_MATURITY,
    tiers: ["elite"],
  },
  // ── automationReadiness
  {
    id: "ar.dataquality",
    dimension: "automationReadiness",
    prompt: "How clean and trustworthy is the data your operations rely on?",
    options: SCALE_READINESS,
    tiers: ["free", "growth", "elite"],
  },
  {
    id: "ar.toolstack",
    dimension: "automationReadiness",
    prompt: "How well-integrated is your current tool stack?",
    options: SCALE_READINESS,
    tiers: ["free", "growth", "elite"],
  },
  {
    id: "ar.repetitive",
    dimension: "automationReadiness",
    prompt: "How much of the day-to-day work is repetitive enough to automate?",
    options: SCALE_READINESS,
    tiers: ["free", "growth", "elite"],
  },
  {
    id: "ar.apicoverage",
    dimension: "automationReadiness",
    prompt: "How many of your core systems expose APIs or webhooks for automation?",
    options: SCALE_READINESS,
    tiers: ["free", "growth", "elite"],
  },
  {
    id: "ar.experimentation",
    dimension: "automationReadiness",
    prompt: "How comfortable is the team running automation pilots?",
    options: SCALE_READINESS,
    tiers: ["growth", "elite"],
  },
  {
    id: "ar.tooling",
    dimension: "automationReadiness",
    prompt: "Do you have automation tooling in place (Zapier, n8n, Make, custom)?",
    options: SCALE_READINESS,
    tiers: ["elite"],
  },
  // ── infrastructureMaturity
  {
    id: "im.observability",
    dimension: "infrastructureMaturity",
    prompt: "Do you have observability into systems before something breaks?",
    options: SCALE_MATURITY,
    tiers: ["growth", "elite"],
  },
  {
    id: "im.security",
    dimension: "infrastructureMaturity",
    prompt: "How would you rate your security posture (access control, logs, MFA)?",
    options: SCALE_MATURITY,
    tiers: ["growth", "elite"],
  },
  {
    id: "im.reliability",
    dimension: "infrastructureMaturity",
    prompt: "How predictable is your platform during peak usage?",
    options: SCALE_MATURITY,
    tiers: ["growth", "elite"],
  },
  {
    id: "im.compliance",
    dimension: "infrastructureMaturity",
    prompt: "How well-documented is the technical compliance posture (GDPR, audit trails)?",
    options: SCALE_MATURITY,
    tiers: ["elite"],
  },
  {
    id: "im.recovery",
    dimension: "infrastructureMaturity",
    prompt: "How confident are you that you could recover from a major incident?",
    options: SCALE_MATURITY,
    tiers: ["elite"],
  },
  {
    id: "im.devops",
    dimension: "infrastructureMaturity",
    prompt: "How mature are your release and change-management practices?",
    options: SCALE_MATURITY,
    tiers: ["growth", "elite"],
  },
  {
    id: "im.dataresidency",
    dimension: "infrastructureMaturity",
    prompt: "Do you have clear answers on data residency and processor locations?",
    options: SCALE_MATURITY,
    tiers: ["elite"],
  },
  // ── scalabilityReadiness
  {
    id: "sr.team",
    dimension: "scalabilityReadiness",
    prompt: "Could the current team absorb 5× volume without breakage?",
    options: SCALE_READINESS,
    tiers: ["growth", "elite"],
  },
  {
    id: "sr.processes",
    dimension: "scalabilityReadiness",
    prompt: "Do your processes still work if the customer base grows 10×?",
    options: SCALE_READINESS,
    tiers: ["growth", "elite"],
  },
  {
    id: "sr.platform",
    dimension: "scalabilityReadiness",
    prompt: "Does the platform scale horizontally without re-architecture?",
    options: SCALE_READINESS,
    tiers: ["elite"],
  },
  {
    id: "sr.geography",
    dimension: "scalabilityReadiness",
    prompt: "Could the operation expand into another region with limited rework?",
    options: SCALE_READINESS,
    tiers: ["elite"],
  },
  {
    id: "sr.unitcost",
    dimension: "scalabilityReadiness",
    prompt: "Is your unit-cost per customer trending in the right direction?",
    options: SCALE_READINESS,
    tiers: ["elite"],
  },
  {
    id: "sr.commercial",
    dimension: "scalabilityReadiness",
    prompt: "How predictable is the commercial pipeline given the current motion?",
    options: SCALE_READINESS,
    tiers: ["growth", "elite"],
  },
  {
    id: "sr.financial",
    dimension: "scalabilityReadiness",
    prompt: "How well does finance forecast cash flow against operational growth scenarios?",
    options: SCALE_READINESS,
    tiers: ["growth", "elite"],
  },
  // ── aiOpportunityPotential
  {
    id: "ai.density",
    dimension: "aiOpportunityPotential",
    prompt: "How many concrete AI / automation use cases can you list right now?",
    options: SCALE_OPPORTUNITY,
    tiers: ["elite"],
  },
  {
    id: "ai.dataaccess",
    dimension: "aiOpportunityPotential",
    prompt: "How accessible is your operational data for an AI model?",
    options: SCALE_READINESS,
    tiers: ["elite"],
  },
  {
    id: "ai.appetite",
    dimension: "aiOpportunityPotential",
    prompt: "How much organisational appetite is there to use AI in production?",
    options: SCALE_OPPORTUNITY,
    tiers: ["elite"],
  },
  {
    id: "ai.coverage",
    dimension: "aiOpportunityPotential",
    prompt: "How many functions could be augmented with AI today (sales, support, ops, finance)?",
    options: SCALE_OPPORTUNITY,
    tiers: ["elite"],
  },
  {
    id: "ai.measurement",
    dimension: "aiOpportunityPotential",
    prompt: "Could you measure ROI of an AI deployment within 90 days?",
    options: SCALE_READINESS,
    tiers: ["elite"],
  },
  {
    id: "ai.literacy",
    dimension: "aiOpportunityPotential",
    prompt: "How AI-literate is the team that would own the deployment day-to-day?",
    options: SCALE_OPPORTUNITY,
    tiers: ["elite"],
  },
  {
    id: "ai.guardrails",
    dimension: "aiOpportunityPotential",
    prompt: "Do you have guardrails (review, audit, escalation) for AI-driven decisions?",
    options: SCALE_READINESS,
    tiers: ["elite"],
  },
  {
    id: "ai.priority",
    dimension: "aiOpportunityPotential",
    prompt: "Where does AI rank in the leadership team's top 5 priorities right now?",
    options: SCALE_OPPORTUNITY,
    tiers: ["elite"],
  },
];

/**
 * Returns the questions for a given tier in canonical order.
 * The count must match AI_SCAN_TIER_PROFILE[tier].questionCount + the
 * narrative open-ended questions appended by the UI (see UI layer).
 */
export function getQuestionsForTier(tier: "free" | "growth" | "elite"): AiScanQuestion[] {
  const all = AI_SCAN_QUESTION_BANK.filter(q => q.tiers.includes(tier));
  return all;
}

/**
 * Validate that an answer payload covers every required question for the tier.
 * Returns the list of missing question IDs (empty array means complete).
 */
export function findMissingAnswers(
  tier: "free" | "growth" | "elite",
  answers: Record<string, string>,
): string[] {
  return getQuestionsForTier(tier)
    .filter(q => !answers[q.id])
    .map(q => q.id);
}

/**
 * Compute the raw per-dimension score from the questionnaire answers, before
 * the LLM enriches with rationale text. Returns a map of dimension → 0-100.
 * Unanswered dimensions are excluded from the result.
 */
export function computeRawDimensionScores(
  answers: Record<string, string>,
): Partial<Record<AiScanDimension, number>> {
  const grouped = new Map<AiScanDimension, number[]>();

  for (const q of AI_SCAN_QUESTION_BANK) {
    const value = answers[q.id];
    if (!value) continue;
    const option = q.options.find(o => o.value === value);
    if (!option) continue;
    const list = grouped.get(q.dimension) ?? [];
    list.push(option.score);
    grouped.set(q.dimension, list);
  }

  const result: Partial<Record<AiScanDimension, number>> = {};
  grouped.forEach((scores: number[], dim: AiScanDimension) => {
    if (scores.length === 0) return;
    const avg = scores.reduce((s: number, v: number) => s + v, 0) / scores.length;
    result[dim] = Math.round(avg);
  });
  return result;
}

/** Tier → questionCount must always be ≤ length of `getQuestionsForTier(tier)`. */
export function isQuestionnaireConsistent(): true | string {
  for (const tier of ["free", "growth", "elite"] as const) {
    const profile = AI_SCAN_TIER_PROFILE[tier];
    const actual = getQuestionsForTier(tier).length;
    if (actual !== profile.questionCount) {
      return `Tier ${tier}: expected ${profile.questionCount} questions, found ${actual}`;
    }
  }
  return true;
}
