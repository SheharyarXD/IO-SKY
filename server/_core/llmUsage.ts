/**
 * LLM usage recording (SRS 19.24 provider usage and cost visibility).
 * Fire and forget: usage logging must never fail or slow an AI call.
 */
import { estimateCostMicros, parsePrices } from "../../shared/modelRouting";
import { spendWindows } from "../../shared/providerRouting";

export function recordLlmUsage(args: {
  model: string;
  complexity: string;
  purpose: string | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}): void {
  void (async () => {
    try {
      const { getDb } = await import("../db/connection");
      const { aiUsage } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) return;
      const p = args.usage?.prompt_tokens ?? 0;
      const c = args.usage?.completion_tokens ?? 0;
      await db.insert(aiUsage).values({
        model: args.model.slice(0, 96),
        complexity: args.complexity.slice(0, 16),
        purpose: args.purpose ? args.purpose.slice(0, 96) : null,
        promptTokens: p,
        completionTokens: c,
        costMicros: estimateCostMicros(args.model, p, c, parsePrices(process.env.LLM_PRICES_JSON)),
      });
    } catch {
      /* usage logging is best effort */
    }
  })();
}

/**
 * Spend so far today and this month (UTC), in USD micro-units, from the usage records. Calls to a model with no
 * configured price are recorded with no cost and so are not counted here: the budget is only as complete as
 * LLM_PRICES_JSON. Throws if the database is unavailable, so a budget fails closed rather than silently off.
 */
export async function readLlmSpend(nowMs: number): Promise<{ todayMicros: number; monthMicros: number; unpricedCalls: number }> {
  const { getDb } = await import("../db/connection");
  const { aiUsage } = await import("../../drizzle/schema");
  const { gte, sql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("usage database unavailable");
  const { dayStartMs, monthStartMs } = spendWindows(nowMs);
  const month = new Date(monthStartMs);
  const day = new Date(dayStartMs);
  const rows = await db
    .select({
      today: sql<string>`coalesce(sum(case when ${aiUsage.createdAt} >= ${day} then ${aiUsage.costMicros} else 0 end), 0)`,
      month: sql<string>`coalesce(sum(${aiUsage.costMicros}), 0)`,
      unpriced: sql<string>`count(*) filter (where ${aiUsage.costMicros} is null)`,
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, month));
  const r = rows[0];
  return { todayMicros: Number(r?.today ?? 0), monthMicros: Number(r?.month ?? 0), unpricedCalls: Number(r?.unpriced ?? 0) };
}
