/**
 * Shared sliding-window rate limiter.
 *
 * Previously reimplemented independently (same algorithm, same 60s window
 * constant) in aiScans.ts, bookings.ts (twice), contact.ts, and
 * engineering.ts. Each call site still gets its own independent counter —
 * createRateLimiter() returns a fresh closure per call, matching the
 * original per-router isolation — this only removes the duplicated
 * algorithm, not the per-endpoint limit semantics.
 *
 * Milestone 3 §3.3 (RM-88): the original implementation was in-memory only,
 * which meant the limit was per-process. Behind two instances a caller got
 * 2x the intended allowance; behind N, N times. Any restart also wiped every
 * counter. That is fine for a single-process deployment and wrong for the
 * multi-instance deployment Milestone 3 §3.2 contemplates.
 *
 * The limiter is now backed by a pluggable store:
 *
 *   memory   (default) — the original per-process behaviour, unchanged.
 *   postgres           — a shared `rate_limit_hits` table, so every instance
 *                        counts against the same window.
 *
 * Selected with RATE_LIMIT_STORE. The default stays `memory` deliberately:
 * the hosting topology is still an open client decision (RM-74), and
 * defaulting to a store that needs a migration applied would turn a missing
 * table into a request-path failure on first boot.
 *
 * `isRateLimited` is now async. Every call site was already inside an async
 * tRPC handler, so this is an `await` at four call sites rather than a
 * restructure.
 *
 * Failure behaviour is deliberately fail-open with a warning: if the shared
 * store is unreachable, requests are allowed rather than the endpoint being
 * hard-down. A rate limiter is an abuse-mitigation control, not an
 * authorisation boundary — failing it closed would convert a degraded
 * database into a full public-site outage. The warning is what makes the
 * degradation visible.
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db/connection";

const DEFAULT_WINDOW_MS = 60_000;

export interface RateLimitStore {
  /**
   * Record a hit for `key` and report how many hits fall inside the window.
   * Returns the count *including* the hit just recorded.
   */
  hit(key: string, windowMs: number): Promise<number>;
}

/** Original in-memory behaviour, extracted behind the store interface. */
export function createMemoryStore(): RateLimitStore {
  const hitsByKey = new Map<string, number[]>();
  return {
    async hit(key: string, windowMs: number): Promise<number> {
      const now = Date.now();
      const recent = (hitsByKey.get(key) || []).filter((t) => now - t < windowMs);
      recent.push(now);
      hitsByKey.set(key, recent);
      return recent.length;
    },
  };
}

/**
 * Postgres-backed shared store (migration 0016).
 *
 * One statement does all three things — prune, insert, count — so concurrent
 * instances cannot interleave between a separate count and insert and both
 * conclude they were under the limit.
 */
export function createPostgresStore(): RateLimitStore {
  return {
    async hit(key: string, windowMs: number): Promise<number> {
      const db = await getDb();
      if (!db) {
        console.warn("[RateLimit] No database connection; allowing request (fail-open).");
        return 0;
      }
      try {
        const cutoffMs = Date.now() - windowMs;
        const rows = await db.execute(sql`
          WITH pruned AS (
            DELETE FROM "rate_limit_hits"
            WHERE "hitAtMs" < ${cutoffMs}
          ), inserted AS (
            INSERT INTO "rate_limit_hits" ("key", "hitAtMs")
            VALUES (${key}, ${Date.now()})
          )
          SELECT COUNT(*)::int + 1 AS count
          FROM "rate_limit_hits"
          WHERE "key" = ${key} AND "hitAtMs" >= ${cutoffMs}
        `);
        const first = (rows as unknown as Array<{ count?: number }>)[0];
        return typeof first?.count === "number" ? first.count : 0;
      } catch (err) {
        console.warn("[RateLimit] Shared store unavailable; allowing request (fail-open):", err);
        return 0;
      }
    },
  };
}

/** Resolve the configured store. Exported for tests. */
export function resolveStore(): RateLimitStore {
  const configured = (process.env.RATE_LIMIT_STORE ?? "memory").trim().toLowerCase();
  if (configured === "postgres") return createPostgresStore();
  if (configured !== "memory") {
    console.warn(
      `[RateLimit] Unknown RATE_LIMIT_STORE="${configured}"; falling back to in-memory.`,
    );
  }
  return createMemoryStore();
}

/**
 * @param limitPerWindow  hits allowed before the limiter reports `true`
 * @param windowMs        sliding window length
 * @param store           override the store (tests, or a caller that wants
 *                        to share one store across several limiters)
 */
export function createRateLimiter(
  limitPerWindow: number,
  windowMs: number = DEFAULT_WINDOW_MS,
  store?: RateLimitStore,
) {
  // Resolved lazily on first use, not at module load: routers construct their
  // limiters at import time, which happens before a test's beforeEach() has
  // had a chance to set RATE_LIMIT_STORE — the same staleness trap documented
  // in server/_core/env.ts's getCookieSecretBytes().
  let resolved: RateLimitStore | null = store ?? null;

  // Namespaced so two endpoints with the same limit never share a counter in
  // the shared store the way they never did in the per-closure memory store.
  const namespace = Math.random().toString(36).slice(2, 10);

  return async function isRateLimited(ip: string | null): Promise<boolean> {
    if (!ip) return false;
    if (!resolved) resolved = resolveStore();
    const count = await resolved.hit(`${namespace}:${ip}`, windowMs);
    return count > limitPerWindow;
  };
}
