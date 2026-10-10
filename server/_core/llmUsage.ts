/**
 * LLM usage recording (SRS 19.24 provider usage and cost visibility).
 * Fire and forget: usage logging must never fail or slow an AI call.
 */
import { estimateCostMicros, parsePrices } from "../../shared/modelRouting";

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
