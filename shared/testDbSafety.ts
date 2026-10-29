/**
 * Test database safety (Milestone 4, task M4-05).
 *
 * `npx vitest run` used to load the repository `.env` (several suites import
 * "dotenv/config") and so ran live-database suites against the project's real
 * Supabase database. These rules make a normal run database-free and let
 * database integration tests run only against a deliberately configured,
 * isolated TEST database that is provably not the production one.
 *
 * Pure functions: no environment access and no network. vitest.config.ts
 * supplies the environment and the production URLs found in `.env`.
 *
 *   default                      -> DATABASE_URL and SUPABASE_* are blank; every
 *                                   database-gated suite skips by design
 *   ALLOW_DB_TESTS=1 +
 *   TEST_DATABASE_URL=<url>      -> database tests run against that URL only,
 *                                   and only if it is not a production database
 */

export type TestDbMode = "database-free" | "isolated-test-database";

export type TestDbEnvResult = {
  mode: TestDbMode;
  /** Values to force into every test worker. Blank string means "defined but empty". */
  env: Record<string, string>;
};

/** The variables a test worker must never inherit from the shell or `.env`. */
export const GUARDED_VARIABLES = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const;

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(`[test database safety] ${message}`);
    this.name = "UnsafeTestDatabaseError";
  }
}

export type DbIdentity = {
  /** user@host:port/database, lowercased, password excluded. */
  endpoint: string;
  /** Supabase project reference when it can be read from the user or host, else null. */
  projectRef: string | null;
};

/** Identify a database from its URL without ever returning the password. Null when it is not a parseable postgres URL. */
export function dbIdentity(url: string | undefined | null): DbIdentity | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return null;
  const user = decodeURIComponent(u.username).toLowerCase();
  const host = u.hostname.toLowerCase();
  const port = u.port || "5432";
  const db = u.pathname.replace(/^\//, "").toLowerCase() || "postgres";
  // Supavisor pooler users look like "postgres.<ref>"; direct hosts like "db.<ref>.supabase.co".
  const fromUser = user.match(/^[a-z_]+\.([a-z0-9]{16,24})$/)?.[1] ?? null;
  const fromHost = host.match(/^db\.([a-z0-9]{16,24})\.supabase\.co$/)?.[1] ?? null;
  return { endpoint: `${user}@${host}:${port}/${db}`, projectRef: fromUser ?? fromHost };
}

/** True when two database URLs name the same database or the same Supabase project. */
export function sameDatabase(a: string | undefined | null, b: string | undefined | null): boolean {
  const x = dbIdentity(a);
  const y = dbIdentity(b);
  if (!x || !y) return false;
  if (x.endpoint === y.endpoint) return true;
  return x.projectRef !== null && x.projectRef === y.projectRef;
}

function supabaseHost(url: string | undefined | null): string | null {
  try {
    return new URL((url ?? "").trim()).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Decide the database environment for the test workers.
 *
 * @param env              the shell environment
 * @param dotenvValues     values parsed from `.env` (never applied to process.env here)
 */
export function resolveTestDatabaseEnv(env: Record<string, string | undefined>, dotenvValues: Record<string, string | undefined> = {}): TestDbEnvResult {
  const blank: Record<string, string> = Object.fromEntries(GUARDED_VARIABLES.map((k) => [k, ""]));
  const optedIn = (env.ALLOW_DB_TESTS ?? "").trim() === "1";
  if (!optedIn) return { mode: "database-free", env: blank };

  const testUrl = (env.TEST_DATABASE_URL ?? "").trim();
  if (!testUrl) {
    throw new UnsafeTestDatabaseError("ALLOW_DB_TESTS=1 is set but TEST_DATABASE_URL is empty. Database tests need an explicit, isolated test database.");
  }
  if (!dbIdentity(testUrl)) {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL is not a valid postgres:// or postgresql:// URL.");
  }

  // Every place a production database URL can come from.
  const productionCandidates = [env.DATABASE_URL, env.PRODUCTION_DATABASE_URL, dotenvValues.DATABASE_URL, dotenvValues.PRODUCTION_DATABASE_URL];
  for (const prod of productionCandidates) {
    if (sameDatabase(testUrl, prod)) {
      throw new UnsafeTestDatabaseError("TEST_DATABASE_URL points at the production database (same endpoint or Supabase project as DATABASE_URL). Refusing to run database tests.");
    }
  }

  // Optional Supabase API suites (RLS) need their own test project, never production's.
  const testSupabaseUrl = (env.TEST_SUPABASE_URL ?? "").trim();
  const out: Record<string, string> = { ...blank, DATABASE_URL: testUrl };
  if (testSupabaseUrl) {
    const prodHosts = [env.SUPABASE_URL, env.PRODUCTION_SUPABASE_URL, dotenvValues.SUPABASE_URL].map(supabaseHost).filter(Boolean);
    const host = supabaseHost(testSupabaseUrl);
    if (!host) throw new UnsafeTestDatabaseError("TEST_SUPABASE_URL is not a valid URL.");
    if (prodHosts.includes(host)) {
      throw new UnsafeTestDatabaseError("TEST_SUPABASE_URL is the production Supabase project. Refusing to run Supabase API tests.");
    }
    out.SUPABASE_URL = testSupabaseUrl;
    out.SUPABASE_PUBLISHABLE_KEY = (env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
    out.SUPABASE_SECRET_KEY = (env.TEST_SUPABASE_SECRET_KEY ?? "").trim();
  }
  return { mode: "isolated-test-database", env: out };
}

/**
 * Last line of defence, run inside every worker. The config already forces
 * the variables; this catches a run that bypassed the config (another config
 * file, or a custom runner) and fails it loudly instead of letting it reach a
 * database. Returns normally when the worker environment is safe.
 */
export function assertWorkerEnvironmentSafe(env: Record<string, string | undefined>): void {
  const url = (env.DATABASE_URL ?? "").trim();
  if (!url) return;
  const optedIn = (env.ALLOW_DB_TESTS ?? "").trim() === "1";
  const testUrl = (env.TEST_DATABASE_URL ?? "").trim();
  if (optedIn && testUrl && url === testUrl) return;
  throw new UnsafeTestDatabaseError(
    "DATABASE_URL is set in the test process without the isolated-database opt-in (ALLOW_DB_TESTS=1 and DATABASE_URL equal to TEST_DATABASE_URL). Run tests through vitest.config.ts, which blanks it.",
  );
}
