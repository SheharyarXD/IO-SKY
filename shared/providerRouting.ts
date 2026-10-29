/**
 * LLM provider priority, fallback and budget limits (task G04; SRS 19.25; 29 Oct
 * Ch5). Pure rules, with the clock passed in. Model choice per task class stays in
 * shared/modelRouting.ts; this decides WHICH provider is tried, when to give up on
 * one, and whether a call may be made at all.
 *
 *  - Providers come from LLM_PROVIDERS_JSON as a list with a priority. API keys are
 *    never in that JSON: each entry names the environment variable that holds its
 *    key. With no list the single provider from the existing variables is used and
 *    behaviour is exactly as before.
 *  - Fallback happens only for failures that are about the PROVIDER (unreachable,
 *    timed out, rate limited, server error, rejected credentials). A request the
 *    provider rejected as invalid would fail anywhere, so it is not retried
 *    elsewhere, which also avoids sending the same content to several vendors.
 *  - A provider that keeps failing is skipped for a growing cooldown (a circuit
 *    breaker) so calls fail over fast instead of waiting on a dead endpoint.
 *  - A budget stops spending when the day or month limit is reached. If a budget is
 *    set and spend cannot be read, calls are refused (fail closed): a cost control
 *    that quietly stops working is worse than a pause.
 */
import { routeModel, type TaskComplexity } from "./modelRouting";

export const MAX_PROVIDERS = 5;

export type ProviderConfig = {
  name: string;
  apiUrl: string;
  /** Name of the environment variable holding the key. The key itself is never configured here. */
  apiKeyEnv: string;
  /** Pins every task class to one model on this provider; null uses the class routing. */
  model: string | null;
  priority: number;
};

export type ProviderParse = { providers: ProviderConfig[]; problems: string[]; source: "list" | "single" | "none" };

const NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const clean = (v: unknown): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length > 0 ? t : null;
};

function validUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.username || u.password) return false; // credentials never travel in the URL
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

/** The single provider the existing variables describe, or none. */
export function legacyProvider(env: Record<string, string | undefined>): ProviderConfig | null {
  const url = clean(env.LLM_API_URL) ?? (clean(env.OPENAI_API_KEY) ? OPENAI_URL : null);
  const keyEnv = clean(env.LLM_API_KEY) ? "LLM_API_KEY" : clean(env.OPENAI_API_KEY) ? "OPENAI_API_KEY" : null;
  if (!url || !keyEnv) return null;
  return { name: "default", apiUrl: url, apiKeyEnv: keyEnv, model: null, priority: 0 };
}

export function parseProviders(env: Record<string, string | undefined>): ProviderParse {
  const raw = clean(env.LLM_PROVIDERS_JSON);
  const single = (problems: string[]): ProviderParse => {
    const p = legacyProvider(env);
    return { providers: p ? [p] : [], problems, source: p ? "single" : "none" };
  };
  if (!raw) return single([]);
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return single(["providers_json_invalid"]); // a broken list falls back to the known-good single provider
  }
  if (!Array.isArray(list)) return single(["providers_json_not_a_list"]);

  const problems: string[] = [];
  const seen = new Set<string>();
  const providers: ProviderConfig[] = [];
  list.slice(0, MAX_PROVIDERS * 2).forEach((e, index) => {
    const o = (e ?? {}) as Record<string, unknown>;
    const name = clean(o.name)?.toLowerCase() ?? "";
    const apiUrl = clean(o.apiUrl) ?? "";
    const apiKeyEnv = clean(o.apiKeyEnv) ?? "";
    const where = name || `#${index + 1}`;
    if (!NAME.test(name)) return void problems.push(`provider_${index + 1}_bad_name`);
    if (seen.has(name)) return void problems.push(`${where}_duplicate`);
    if (!validUrl(apiUrl)) return void problems.push(`${where}_bad_url`);
    if (!ENV_NAME.test(apiKeyEnv)) return void problems.push(`${where}_bad_key_variable`);
    const model = o.model === undefined || o.model === null ? null : clean(o.model);
    if (o.model !== undefined && o.model !== null && (model === null || model.length > 96)) return void problems.push(`${where}_bad_model`);
    const priority = typeof o.priority === "number" && Number.isInteger(o.priority) && o.priority >= 0 && o.priority <= 1000 ? o.priority : index;
    seen.add(name);
    providers.push({ name, apiUrl, apiKeyEnv, model, priority });
  });
  providers.sort((a, b) => a.priority - b.priority);
  if (providers.length > MAX_PROVIDERS) problems.push("too_many_providers");
  const kept = providers.slice(0, MAX_PROVIDERS);
  if (kept.length === 0) return single([...problems, "providers_json_empty"]);
  return { providers: kept, problems, source: "list" };
}

/** The model to send to a provider: its pinned model, otherwise the class routing. */
export function modelFor(p: ProviderConfig, complexity: TaskComplexity | string | undefined, env: Record<string, string | undefined>): string {
  return p.model ?? routeModel(complexity, env).model;
}

// ---------------------------------------------------------------------------
// failures
// ---------------------------------------------------------------------------

export type FailureKind = "unreachable" | "timeout" | "rate_limited" | "server_error" | "auth" | "provider_not_found" | "request_rejected" | "misconfigured" | "unknown";

export type FailureInput = { status?: number; timeout?: boolean; network?: boolean; missingKey?: boolean };

export type FailureVerdict = {
  kind: FailureKind;
  /** Try the next provider. */
  fallback: boolean;
  /** Count against this provider's circuit breaker. */
  countsAgainstProvider: boolean;
};

export function classifyFailure(f: FailureInput): FailureVerdict {
  if (f.missingKey) return { kind: "misconfigured", fallback: true, countsAgainstProvider: false };
  if (f.timeout) return { kind: "timeout", fallback: true, countsAgainstProvider: true };
  if (f.network) return { kind: "unreachable", fallback: true, countsAgainstProvider: true };
  const s = f.status;
  if (s === undefined) return { kind: "unknown", fallback: false, countsAgainstProvider: false };
  if (s === 429) return { kind: "rate_limited", fallback: true, countsAgainstProvider: true };
  if (s === 408) return { kind: "timeout", fallback: true, countsAgainstProvider: true };
  if (s >= 500 && s <= 599) return { kind: "server_error", fallback: true, countsAgainstProvider: true };
  if (s === 401 || s === 403) return { kind: "auth", fallback: true, countsAgainstProvider: true };
  if (s === 404) return { kind: "provider_not_found", fallback: true, countsAgainstProvider: true };
  if (s >= 400 && s <= 499) return { kind: "request_rejected", fallback: false, countsAgainstProvider: false };
  return { kind: "unknown", fallback: false, countsAgainstProvider: false };
}

// ---------------------------------------------------------------------------
// circuit breaker
// ---------------------------------------------------------------------------

export const BREAKER = { failureThreshold: 3, baseCooldownMs: 30_000, maxCooldownMs: 10 * 60_000 } as const;

type Circuit = { failures: number; opens: number; openUntil: number };

export class CircuitBreaker {
  private readonly c = new Map<string, Circuit>();

  /** Closed, or open but past its cooldown (a half-open probe is allowed). */
  canAttempt(name: string, now: number): boolean {
    const s = this.c.get(name);
    return !s || now >= s.openUntil;
  }

  onSuccess(name: string): void {
    this.c.delete(name);
  }

  onFailure(name: string, now: number): void {
    const s = this.c.get(name) ?? { failures: 0, opens: 0, openUntil: 0 };
    s.failures++;
    // A failed half-open probe keeps the count at or above the threshold, so it reopens at once with a longer wait.
    if (s.failures >= BREAKER.failureThreshold) {
      s.opens++;
      s.openUntil = now + Math.min(BREAKER.baseCooldownMs * 2 ** (s.opens - 1), BREAKER.maxCooldownMs);
    }
    this.c.set(name, s);
  }

  reset(): void {
    this.c.clear();
  }

  state(name: string, now: number): "closed" | "open" | "half_open" {
    const s = this.c.get(name);
    if (!s || s.failures < BREAKER.failureThreshold) return "closed";
    return now >= s.openUntil ? "half_open" : "open";
  }
}

/** The providers to try, in priority order, leaving out those whose circuit is open. */
export function planAttempts(providers: ProviderConfig[], breaker: CircuitBreaker, now: number): ProviderConfig[] {
  return providers.filter((p) => breaker.canAttempt(p.name, now));
}

// ---------------------------------------------------------------------------
// budget
// ---------------------------------------------------------------------------

export type Budget = { dailyMicros: number | null; monthlyMicros: number | null };

export type BudgetParse = { budget: Budget; problems: string[] };

/** LLM_BUDGET_DAILY_USD and LLM_BUDGET_MONTHLY_USD, in USD. Unset means no limit. */
export function parseBudget(env: Record<string, string | undefined>): BudgetParse {
  const problems: string[] = [];
  const read = (name: string, key: string): number | null => {
    const raw = clean(env[name]);
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
      problems.push(`${key}_invalid`);
      return null;
    }
    return Math.round(n * 1_000_000);
  };
  return { budget: { dailyMicros: read("LLM_BUDGET_DAILY_USD", "daily_budget"), monthlyMicros: read("LLM_BUDGET_MONTHLY_USD", "monthly_budget") }, problems };
}

export const hasBudget = (b: Budget): boolean => b.dailyMicros !== null || b.monthlyMicros !== null;

export const BUDGET_WARN_AT = 0.8;

export type BudgetVerdict = { allowed: true; warn: boolean; usedFraction: number } | { allowed: false; reason: "daily_budget_exhausted" | "monthly_budget_exhausted" };

export function evaluateBudget(a: { budget: Budget; spentTodayMicros: number; spentMonthMicros: number }): BudgetVerdict {
  const { dailyMicros, monthlyMicros } = a.budget;
  if (dailyMicros !== null && a.spentTodayMicros >= dailyMicros) return { allowed: false, reason: "daily_budget_exhausted" };
  if (monthlyMicros !== null && a.spentMonthMicros >= monthlyMicros) return { allowed: false, reason: "monthly_budget_exhausted" };
  const fractions = [dailyMicros !== null ? a.spentTodayMicros / dailyMicros : 0, monthlyMicros !== null ? a.spentMonthMicros / monthlyMicros : 0];
  const usedFraction = Math.max(...fractions);
  return { allowed: true, warn: usedFraction >= BUDGET_WARN_AT, usedFraction: Math.round(usedFraction * 1000) / 1000 };
}

/** Start of the UTC day and month containing `nowMs`, for spend windows. */
export function spendWindows(nowMs: number): { dayStartMs: number; monthStartMs: number } {
  const d = new Date(nowMs);
  return { dayStartMs: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), monthStartMs: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) };
}
