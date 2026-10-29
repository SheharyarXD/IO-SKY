/**
 * Provider fallback and budget enforcement around an LLM call (task G04). Generic
 * over the call itself, so it is tested without any provider; server/_core/llm.ts
 * supplies the real HTTP call. Rules are in shared/providerRouting.ts.
 *
 * Order of events for one call:
 *   1. If a budget is set, read the spend; refuse when it is exhausted or cannot
 *      be read (fail closed).
 *   2. Try the providers in priority order, skipping those whose circuit is open.
 *   3. A failure about the provider moves on to the next one; a failure about the
 *      request itself is raised at once, so one rejected request is not replayed
 *      to every vendor.
 * Nothing here logs or returns request content or credentials: errors and events
 * carry provider names and failure kinds only.
 */
import { classifyFailure, evaluateBudget, hasBudget, planAttempts, type Budget, type CircuitBreaker, type FailureInput, type FailureKind, type ProviderConfig } from "../shared/providerRouting";

export class LlmBudgetError extends Error {
  constructor(readonly reason: "daily_budget_exhausted" | "monthly_budget_exhausted" | "budget_unavailable") {
    super(
      reason === "budget_unavailable"
        ? "AI calls are paused: a spending limit is set but current spend could not be read."
        : `AI calls are paused: the ${reason === "daily_budget_exhausted" ? "daily" : "monthly"} spending limit has been reached.`,
    );
    this.name = "LlmBudgetError";
  }
}

export class AllProvidersFailedError extends Error {
  constructor(readonly attempts: Array<{ provider: string; kind: FailureKind }>) {
    super(attempts.length === 0 ? "No AI provider is available: every provider is cooling down after repeated failures." : `All AI providers failed (${attempts.map((a) => `${a.provider}: ${a.kind}`).join(", ")}).`);
    this.name = "AllProvidersFailedError";
  }
}

export type RouterEvent =
  | { type: "fallback"; failed: string; kind: FailureKind; next: string | null }
  | { type: "served_by_fallback"; provider: string; after: number }
  | { type: "budget_warning"; usedFraction: number }
  | { type: "budget_blocked"; reason: "daily_budget_exhausted" | "monthly_budget_exhausted" | "budget_unavailable" };

export type RouterDeps<P, R> = {
  providers: ProviderConfig[];
  budget: Budget;
  breaker: CircuitBreaker;
  now(): number;
  spend(nowMs: number): Promise<{ todayMicros: number; monthMicros: number }>;
  call(provider: ProviderConfig, params: P): Promise<R>;
  describeFailure(err: unknown): FailureInput;
  onEvent?(e: RouterEvent): void;
};

export async function invokeRouted<P, R>(params: P, deps: RouterDeps<P, R>): Promise<R> {
  const emit = (e: RouterEvent) => {
    try {
      deps.onEvent?.(e);
    } catch {
      /* observing a call must never break it */
    }
  };
  const now = deps.now();

  if (hasBudget(deps.budget)) {
    let spent: { todayMicros: number; monthMicros: number };
    try {
      spent = await deps.spend(now);
    } catch {
      emit({ type: "budget_blocked", reason: "budget_unavailable" });
      throw new LlmBudgetError("budget_unavailable");
    }
    const verdict = evaluateBudget({ budget: deps.budget, spentTodayMicros: spent.todayMicros, spentMonthMicros: spent.monthMicros });
    if (!verdict.allowed) {
      emit({ type: "budget_blocked", reason: verdict.reason });
      throw new LlmBudgetError(verdict.reason);
    }
    if (verdict.warn) emit({ type: "budget_warning", usedFraction: verdict.usedFraction });
  }

  const order = planAttempts(deps.providers, deps.breaker, now);
  const attempts: Array<{ provider: string; kind: FailureKind }> = [];
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    try {
      const result = await deps.call(p, params);
      deps.breaker.onSuccess(p.name);
      if (attempts.length > 0) emit({ type: "served_by_fallback", provider: p.name, after: attempts.length });
      return result;
    } catch (err) {
      const verdict = classifyFailure(deps.describeFailure(err));
      if (verdict.countsAgainstProvider) deps.breaker.onFailure(p.name, deps.now());
      attempts.push({ provider: p.name, kind: verdict.kind });
      if (!verdict.fallback) throw err; // the request itself is the problem: do not replay it elsewhere
      emit({ type: "fallback", failed: p.name, kind: verdict.kind, next: order[i + 1]?.name ?? null });
    }
  }
  throw new AllProvidersFailedError(attempts);
}
