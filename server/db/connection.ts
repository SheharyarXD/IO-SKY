/**
 * server/db/connection.ts
 *
 * Shared lazy Drizzle connection factory.
 * Every domain module imports `getDb` from here — there is exactly one
 * connection instance for the whole process.
 *
 * Milestone 1 (RM-43/46): migrated from drizzle-orm/mysql2 (TiDB) to
 * drizzle-orm/postgres-js (Supabase PostgreSQL). DATABASE_URL must now be
 * the Supabase project's direct Postgres connection string.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

/**
 * Lazily create the Drizzle instance so local tooling can run without a DB.
 * Returns null when DATABASE_URL is not set.
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // `prepare: false` is required against Supabase's connection pooler
      // (transaction mode / pgbouncer) — prepared statements aren't safe
      // there. Harmless against a direct (non-pooled) connection too.
      //
      // Milestone 3 §3.2/§3.5 (RM-77/RM-110): the remaining options are not
      // cosmetic tuning. Measured against the configured transaction pooler
      // (aws-0-*.pooler.supabase.com:6543), a burst of concurrent queries
      // LARGER THAN THE POOL hangs indefinitely rather than queueing and
      // draining:
      //
      //     max=5,  burst=10  ->  still hung after 15s (never completes)
      //     max=20, burst=10  ->  completes in 1.7s
      //
      // With postgres.js's default of max=10, the 11th concurrent request
      // would therefore never return — it holds a request slot forever and
      // the server degrades into an outage rather than getting slower. That
      // is a capacity cliff, not a gradient.
      //
      // `max` is raised and made configurable so it can be matched to the
      // Supabase plan's pool size, and the timeouts below ensure a connection
      // that does get stuck is recycled instead of being held for the life of
      // the process.
      //
      // NOTE this mitigates the cliff by making it far less likely to be
      // reached; it does not remove it. Sizing the pool correctly against the
      // production Supabase tier is still RM-77, and a real load test against
      // a deployed environment is still RM-110.
      const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 20);
      _client = postgres(process.env.DATABASE_URL, {
        prepare: false,
        max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 20,
        // Close idle connections so pgbouncer reclaims server slots rather
        // than us pinning them for the process lifetime.
        idle_timeout: 30,
        // Recycle connections periodically — a long-lived pooled connection
        // that has gone bad otherwise stays in rotation indefinitely.
        max_lifetime: 60 * 30,
        // Fail fast on an unreachable database instead of hanging the request.
        connect_timeout: 10,
      });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
