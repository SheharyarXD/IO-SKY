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
      _client = postgres(process.env.DATABASE_URL, { prepare: false });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
