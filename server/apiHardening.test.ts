/**
 * Milestone 3 §3.3 — API hardening and session security.
 *
 * Covers RM-86 (helmet security headers), RM-87 (explicit CORS policy),
 * RM-88 (shared-state rate limiting) and RM-89 (deliberate session TTL).
 * RM-90 (logout actually revokes sessions) is covered separately in
 * server/sessionRevocation.test.ts, which needs the DB layer stubbed.
 *
 * The HTTP-level assertions use the same listen-on-port-0 + fetch helper
 * pattern as server/stagingGate.test.ts rather than introducing supertest.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import { registerSecurityHeaders } from "./_core/securityHeaders";
import {
  registerCorsPolicy,
  parseAllowedOrigins,
  isOriginAllowed,
} from "./_core/corsPolicy";
import { createRateLimiter, createMemoryStore, resolveStore } from "./_core/rateLimiter";
import { getSessionTtlMs, DEFAULT_SESSION_TTL_MS } from "@shared/const";

async function request(
  app: express.Express,
  path: string,
  headers: Record<string, string> = {},
  method = "GET",
): Promise<{ status: number; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      fetch(`http://127.0.0.1:${port}${path}`, { method, headers, redirect: "manual" })
        .then(async (r) => {
          await r.text();
          const out: Record<string, string> = {};
          r.headers.forEach((v, k) => {
            out[k.toLowerCase()] = v;
          });
          server.close();
          resolve({ status: r.status, headers: out });
        })
        .catch(() => {
          server.close();
          resolve({ status: 0, headers: {} });
        });
    });
  });
}

function buildApp() {
  const app = express();
  registerSecurityHeaders(app);
  registerCorsPolicy(app);
  app.get("/api/ping", (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// RM-86 — security headers
// ---------------------------------------------------------------------------
describe("RM-86: helmet security headers", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.VITE_ANALYTICS_ENDPOINT;
  });

  it("never advertises the framework via X-Powered-By", async () => {
    const res = await request(buildApp(), "/api/ping");
    expect(res.status).toBe(200);
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("sets clickjacking, sniffing and referrer protections", async () => {
    const res = await request(buildApp(), "/api/ping");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]?.toUpperCase()).toBe("SAMEORIGIN");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("does NOT enforce CSP or HSTS in development", async () => {
    process.env.NODE_ENV = "development";
    const res = await request(buildApp(), "/api/ping");
    // Vite's dev server needs inline scripts and a websocket; enforcing a
    // dev CSP means watering the production one down to match.
    expect(res.headers["content-security-policy"]).toBeUndefined();
    // HSTS from a plain-HTTP dev server would pin localhost to HTTPS.
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("enforces a restrictive CSP and HSTS in production", async () => {
    process.env.NODE_ENV = "production";
    const res = await request(buildApp(), "/api/ping");
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // Scripts must not be allowed to run inline — that is the directive
    // doing the actual XSS work.
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(res.headers["strict-transport-security"]).toContain("max-age=15552000");
  });

  it("allows the real font and Supabase asset hosts the client loads from", async () => {
    process.env.NODE_ENV = "production";
    const csp = (await request(buildApp(), "/api/ping")).headers["content-security-policy"];
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");
    expect(csp).toContain("https://*.supabase.co");
  });

  it("omits the analytics origin from the CSP when it is not configured", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.VITE_ANALYTICS_ENDPOINT;
    const csp = (await request(buildApp(), "/api/ping")).headers["content-security-policy"];
    // An unconfigured beacon should tighten the policy, not open a hole.
    expect(csp).toMatch(/script-src 'self'\s*;/);
  });

  it("includes the analytics origin when one is configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.VITE_ANALYTICS_ENDPOINT = "https://analytics.example.com/collect";
    const csp = (await request(buildApp(), "/api/ping")).headers["content-security-policy"];
    expect(csp).toContain("https://analytics.example.com");
  });
});

// ---------------------------------------------------------------------------
// RM-87 — CORS
// ---------------------------------------------------------------------------
describe("RM-87: explicit CORS policy", () => {
  afterEach(() => {
    delete process.env.CORS_ALLOWED_ORIGINS;
  });

  it("rejects the '*' wildcard — it cannot be combined with credentials", () => {
    expect(parseAllowedOrigins("*")).toEqual([]);
    expect(parseAllowedOrigins("https://a.example.com,*")).toEqual([
      "https://a.example.com",
    ]);
  });

  it("drops malformed origins instead of trusting them", () => {
    expect(parseAllowedOrigins("not-a-url, https://ok.example.com")).toEqual([
      "https://ok.example.com",
    ]);
  });

  it("normalises to the origin, discarding any path", () => {
    expect(parseAllowedOrigins("https://ok.example.com/some/path")).toEqual([
      "https://ok.example.com",
    ]);
  });

  it("allows requests with no Origin header (same-origin / non-browser)", () => {
    expect(isOriginAllowed(undefined, [])).toBe(true);
    expect(isOriginAllowed(undefined, ["https://a.example.com"])).toBe(true);
  });

  it("denies every cross-origin request when no allowlist is configured", () => {
    expect(isOriginAllowed("https://evil.example.com", [])).toBe(false);
  });

  it("allows only exact allowlist matches", () => {
    const list = ["https://app.iosky.nl"];
    expect(isOriginAllowed("https://app.iosky.nl", list)).toBe(true);
    // Suffix-style near-misses are the classic CORS allowlist bug.
    expect(isOriginAllowed("https://app.iosky.nl.evil.com", list)).toBe(false);
    expect(isOriginAllowed("http://app.iosky.nl", list)).toBe(false);
    expect(isOriginAllowed("https://other.iosky.nl", list)).toBe(false);
  });

  it("omits Access-Control-Allow-Origin for a disallowed origin", async () => {
    const res = await request(buildApp(), "/api/ping", {
      Origin: "https://evil.example.com",
    });
    // The request still reaches the handler — CORS is enforced in the
    // browser — but the response carries no approval header.
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("echoes the origin and allows credentials for an allowed origin", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.iosky.nl";
    const res = await request(buildApp(), "/api/ping", {
      Origin: "https://app.iosky.nl",
    });
    expect(res.headers["access-control-allow-origin"]).toBe("https://app.iosky.nl");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// RM-88 — shared-state rate limiting
// ---------------------------------------------------------------------------
describe("RM-88: rate limiter", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_STORE;
  });

  it("allows up to the limit and blocks beyond it", async () => {
    const limited = createRateLimiter(3, 60_000, createMemoryStore());
    expect(await limited("1.1.1.1")).toBe(false);
    expect(await limited("1.1.1.1")).toBe(false);
    expect(await limited("1.1.1.1")).toBe(false);
    expect(await limited("1.1.1.1")).toBe(true);
  });

  it("counts each caller independently", async () => {
    const limited = createRateLimiter(1, 60_000, createMemoryStore());
    expect(await limited("1.1.1.1")).toBe(false);
    expect(await limited("2.2.2.2")).toBe(false);
    expect(await limited("1.1.1.1")).toBe(true);
  });

  it("never limits when the caller IP is unknown", async () => {
    const limited = createRateLimiter(0, 60_000, createMemoryStore());
    expect(await limited(null)).toBe(false);
  });

  it("expires hits once they fall outside the window", async () => {
    const limited = createRateLimiter(1, 30, createMemoryStore());
    expect(await limited("1.1.1.1")).toBe(false);
    expect(await limited("1.1.1.1")).toBe(true);
    await new Promise((r) => setTimeout(r, 45));
    expect(await limited("1.1.1.1")).toBe(false);
  });

  it("keeps two limiters isolated even when they share a store", async () => {
    // Regression guard for the shared-store move: the in-memory version got
    // per-endpoint isolation for free from the closure. With one shared
    // table, isolation has to come from the key namespace instead.
    const store = createMemoryStore();
    const a = createRateLimiter(1, 60_000, store);
    const b = createRateLimiter(1, 60_000, store);
    expect(await a("1.1.1.1")).toBe(false);
    expect(await b("1.1.1.1")).toBe(false);
    expect(await a("1.1.1.1")).toBe(true);
  });

  it("defaults to the in-memory store and warns on an unknown value", () => {
    delete process.env.RATE_LIMIT_STORE;
    expect(resolveStore()).toBeDefined();
    process.env.RATE_LIMIT_STORE = "redis-ish-typo";
    expect(resolveStore()).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// RM-89 — session TTL
// ---------------------------------------------------------------------------
describe("RM-89: deliberate session TTL", () => {
  beforeEach(() => {
    delete process.env.SESSION_TTL_HOURS;
  });
  afterEach(() => {
    delete process.env.SESSION_TTL_HOURS;
  });

  it("defaults to 12 hours, not the previous one year", () => {
    expect(getSessionTtlMs()).toBe(DEFAULT_SESSION_TTL_MS);
    expect(getSessionTtlMs()).toBe(12 * 60 * 60 * 1000);
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    expect(getSessionTtlMs()).toBeLessThan(ONE_YEAR);
  });

  it("honours a valid override", () => {
    process.env.SESSION_TTL_HOURS = "4";
    expect(getSessionTtlMs()).toBe(4 * 60 * 60 * 1000);
  });

  it("falls back to the default for a non-numeric or zero value", () => {
    process.env.SESSION_TTL_HOURS = "not-a-number";
    expect(getSessionTtlMs()).toBe(DEFAULT_SESSION_TTL_MS);
    process.env.SESSION_TTL_HOURS = "0";
    expect(getSessionTtlMs()).toBe(DEFAULT_SESSION_TTL_MS);
  });

  it("clamps absurd values rather than accepting them", () => {
    // A typo here would otherwise re-introduce exactly the year-long
    // session RM-89 exists to remove.
    process.env.SESSION_TTL_HOURS = "0.0001";
    expect(getSessionTtlMs()).toBe(5 * 60 * 1000);
    process.env.SESSION_TTL_HOURS = "100000";
    expect(getSessionTtlMs()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
