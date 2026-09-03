/**
 * Milestone 3 §3.2 (RM-76) — HTTP health endpoints for the host.
 *
 * A tRPC `system.health` procedure already existed, but nothing outside the
 * app could use it: it is a POST-shaped tRPC call that requires a `timestamp`
 * input and superjson encoding. Load balancers, container orchestrators and
 * uptime monitors all issue a plain `GET` and read the status code.
 *
 * Two endpoints, because they answer different questions and conflating them
 * causes real outages:
 *
 *   GET /health       LIVENESS. Is this process alive? Touches nothing
 *                     external and always returns 200 while the event loop is
 *                     responsive. Orchestrators restart containers that fail
 *                     this, so it must NOT depend on the database — otherwise
 *                     a brief database blip triggers a restart storm across
 *                     every instance at once, turning a recoverable
 *                     dependency failure into a full outage.
 *
 *   GET /health/ready READINESS. Should this instance receive traffic? Checks
 *                     the database, so an instance that cannot serve requests
 *                     is pulled from the pool instead of failing user
 *                     requests. Returns 503 when not ready.
 *
 * Both are registered before the staging gate so an uptime monitor can reach
 * them without the staging password, and both are excluded from rate limiting.
 */
import type { Express, Request, Response } from "express";
import { getDb } from "../db/connection";
import { sql } from "drizzle-orm";

/** Process start, used to report uptime. */
const STARTED_AT = Date.now();

/**
 * How long a readiness DB probe may take before the instance is considered
 * unready. Deliberately short: readiness is polled frequently, and a probe
 * that hangs for 30s holds a connection and delays the pull-from-pool
 * decision that is the entire point of the check.
 */
const READINESS_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`health probe timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Strip credentials out of a driver error before it is served.
 *
 * `/health/ready` is unauthenticated, and postgres driver errors routinely
 * embed the full DSN — `connect ECONNREFUSED postgresql://user:password@host`.
 * Returning `err.message` unmodified publishes the database password to
 * anyone who can reach the endpoint, which on most hosts is the whole
 * internet. Exported so the test can assert the redaction directly.
 */
export function redactCredentials(message: string): string {
  return (
    message
      // scheme://user:secret@host  ->  scheme://user:***@host
      .replace(/([a-zA-Z][\w+.-]*:\/\/)([^:/@\s]+):([^@\s]+)@/g, "$1$2:***@")
      // Bare "password=..." / "pwd=..." in a key/value DSN.
      .replace(/\b(password|pwd)=([^\s;&]+)/gi, "$1=***")
  );
}

export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    const db = await withTimeout(getDb(), READINESS_TIMEOUT_MS);
    if (!db) {
      return { ok: false, latencyMs: Date.now() - started, error: "no database configured" };
    }
    await withTimeout(db.execute(sql`SELECT 1`), READINESS_TIMEOUT_MS);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      // Message only, credentials redacted — never a raw driver message or a
      // stack trace. Both routinely carry the full DSN, and this endpoint is
      // unauthenticated. A test asserts the redaction rather than trusting it.
      error: err instanceof Error ? redactCredentials(err.message) : "unknown error",
    };
  }
}

export function registerHealthRoutes(app: Express) {
  // ---- Liveness -----------------------------------------------------------
  app.get("/health", (_req: Request, res: Response) => {
    res
      .status(200)
      // Health responses must never be cached: a cached 200 from a proxy makes
      // a dead instance look alive for the cache's lifetime.
      .set("Cache-Control", "no-store, no-cache, must-revalidate")
      .json({
        status: "ok",
        uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
        timestamp: new Date().toISOString(),
      });
  });

  // ---- Readiness ----------------------------------------------------------
  app.get("/health/ready", async (_req: Request, res: Response) => {
    const database = await checkDatabase();
    const ready = database.ok;

    res
      .status(ready ? 200 : 503)
      .set("Cache-Control", "no-store, no-cache, must-revalidate")
      .json({
        status: ready ? "ready" : "not_ready",
        checks: { database },
        uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
        timestamp: new Date().toISOString(),
      });
  });

  // ---- Version ------------------------------------------------------------
  // Lets a deploy be confirmed as actually live, and a rollback be confirmed
  // as actually rolled back — §8 of the rollback plan depends on being able to
  // tell which build is serving traffic.
  app.get("/health/version", (_req: Request, res: Response) => {
    res
      .status(200)
      .set("Cache-Control", "no-store")
      .json({
        // Set by the build/deploy pipeline; "unknown" locally is honest rather
        // than a fabricated value.
        commit: process.env.GIT_COMMIT_SHA ?? "unknown",
        builtAt: process.env.BUILD_TIMESTAMP ?? "unknown",
        environment: process.env.NODE_ENV ?? "development",
      });
  });
}
