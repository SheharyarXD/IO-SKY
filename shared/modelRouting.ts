/**
 * AI model routing (SRS 19.6 orchestration, 19.25 provider management).
 *
 * Each AI call declares how demanding it is. The router maps that class to a
 * configured model, so cheap work does not run on an expensive model and the
 * provider or model can change without touching any business workflow.
 * Pure on purpose: the environment is passed in.
 */
export const TASK_COMPLEXITIES = ["simple", "medium", "complex"] as const;
export type TaskComplexity = (typeof TASK_COMPLEXITIES)[number];

/** Defaults apply only when nothing is configured. Real names come from configuration. */
export const DEFAULT_ROUTED_MODELS: Record<TaskComplexity, string> = {
  simple: "gpt-4o-mini",
  medium: "gpt-4o-mini",
  complex: "gpt-4o",
};

export function isTaskComplexity(v: unknown): v is TaskComplexity {
  return typeof v === "string" && (TASK_COMPLEXITIES as readonly string[]).includes(v);
}

const clean = (v: string | undefined | null) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length > 0 ? t : null;
};

/**
 * Resolution order: LLM_MODEL_<CLASS>, then a single LLM_MODEL that pins every
 * class to one model (the pre-routing behaviour), then the default for the class.
 * An unknown class is treated as "complex": the safe choice is the most capable model.
 */
export function routeModel(
  complexity: TaskComplexity | string | undefined,
  env: Record<string, string | undefined>,
): { model: string; complexity: TaskComplexity; source: "class" | "pinned" | "default" } {
  const c: TaskComplexity = isTaskComplexity(complexity) ? complexity : "complex";
  const perClass = clean(env[`LLM_MODEL_${c.toUpperCase()}`]);
  if (perClass) return { model: perClass, complexity: c, source: "class" };
  const pinned = clean(env.LLM_MODEL);
  if (pinned) return { model: pinned, complexity: c, source: "pinned" };
  return { model: DEFAULT_ROUTED_MODELS[c], complexity: c, source: "default" };
}

/** Price table from LLM_PRICES_JSON: {"model": {"in": usd_per_1M_input, "out": usd_per_1M_output}}. */
export type ModelPrices = Record<string, { in: number; out: number }>;

export function parsePrices(raw: string | undefined | null): ModelPrices {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as Record<string, { in?: unknown; out?: unknown }>;
    const out: ModelPrices = {};
    for (const [k, v] of Object.entries(j)) {
      if (v && typeof v.in === "number" && typeof v.out === "number" && v.in >= 0 && v.out >= 0) out[k] = { in: v.in, out: v.out };
    }
    return out;
  } catch {
    return {};
  }
}

/** Cost in USD micro-units (1e-6), or null when the model has no configured price. */
export function estimateCostMicros(model: string, promptTokens: number, completionTokens: number, prices: ModelPrices): number | null {
  const p = prices[model];
  if (!p) return null;
  return Math.round(promptTokens * p.in + completionTokens * p.out);
}
