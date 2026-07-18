/**
 * Tests for the private staging / pre-launch gate.
 *
 * Verifies that with STAGING_MODE=on:
 *   - anonymous GET /              → returns the pre-launch HTML (200 + noindex)
 *   - GET /api/anything            → bypasses the gate (404 from express, not the HTML)
 *   - GET /assets/x.js             → bypasses the gate
 *   - request with valid session   → bypasses the gate
 *   - POST /api/staging/unlock with wrong password  → 401 + HTML error
 *   - POST /api/staging/unlock with correct password → 302 + Set-Cookie
 *   - request with valid staging cookie  → bypasses the gate
 *   - GET /robots.txt              → Disallow: /
 *
 * And with staging off:
 *   - anonymous GET /              → falls through to the next handler
 *   - GET /robots.txt              → Allow: /
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import crypto from "crypto";
import { registerStagingGate } from "./_core/stagingGate";

const STAGING_PASSWORD = "test-staging-password";
const STAGING_SECRET = "test-staging-secret";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  registerStagingGate(app);
  // A downstream handler that proves the request was not gated.
  app.get("/", (_req, res) => res.status(200).send("HOMEPAGE"));
  app.get("/api/ping", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/assets/app.js", (_req, res) => res.status(200).type("application/javascript").send("// bundle"));
  return app;
}

async function request(
  app: express.Express,
  method: string,
  path: string,
  options: { body?: string; cookie?: string; contentType?: string } = {}
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise(resolve => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      const headers: Record<string, string> = {};
      if (options.cookie) headers["Cookie"] = options.cookie;
      if (options.body) {
        headers["Content-Type"] = options.contentType ?? "application/x-www-form-urlencoded";
      }
      fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers,
        body: options.body,
        redirect: "manual",
      })
        .then(async r => {
          const text = await r.text();
          const out: Record<string, string> = {};
          r.headers.forEach((v, k) => {
            out[k.toLowerCase()] = v;
          });
          server.close();
          resolve({ status: r.status, headers: out, body: text });
        })
        .catch(() => {
          server.close();
          resolve({ status: 0, headers: {}, body: "" });
        });
    });
  });
}

describe("stagingGate — STAGING_MODE=on", () => {
  beforeEach(() => {
    process.env.STAGING_MODE = "on";
    process.env.STAGING_PASSWORD = STAGING_PASSWORD;
    process.env.STAGING_SECRET = STAGING_SECRET;
  });
  afterEach(() => {
    delete process.env.STAGING_MODE;
    delete process.env.STAGING_PASSWORD;
    delete process.env.STAGING_SECRET;
  });

  it("blocks anonymous GET / with the pre-launch screen", async () => {
    const r = await request(buildApp(), "GET", "/");
    expect(r.status).toBe(200);
    expect(r.body).toContain("Private pre-launch");
    expect(r.body).not.toContain("HOMEPAGE");
    expect(r.headers["x-robots-tag"]).toContain("noindex");
  });

  it("does not gate /api/* requests", async () => {
    const r = await request(buildApp(), "GET", "/api/ping");
    expect(r.status).toBe(200);
    expect(r.body).toContain("ok");
  });

  it("does not gate static assets", async () => {
    const r = await request(buildApp(), "GET", "/assets/app.js");
    expect(r.status).toBe(200);
    expect(r.body).toContain("// bundle");
  });

  it("rejects unlock with wrong password", async () => {
    const r = await request(buildApp(), "POST", "/api/staging/unlock", {
      body: "password=wrongpass",
    });
    expect(r.status).toBe(401);
    expect(r.body).toContain("Incorrect password");
  });

  it("accepts unlock with correct password and sets the cookie", async () => {
    const r = await request(buildApp(), "POST", "/api/staging/unlock", {
      body: `password=${STAGING_PASSWORD}`,
    });
    expect(r.status).toBe(302);
    expect(r.headers["set-cookie"]).toContain("iosky_staging_pass");
  });

  it("lets a request through when carrying a valid staging cookie", async () => {
    const issuedAt = String(Date.now());
    const sig = crypto.createHmac("sha256", STAGING_SECRET).update(issuedAt).digest("hex");
    const cookie = `iosky_staging_pass=${issuedAt}.${sig}`;
    const r = await request(buildApp(), "GET", "/", { cookie });
    expect(r.status).toBe(200);
    expect(r.body).toBe("HOMEPAGE");
  });

  it("rejects a tampered staging cookie", async () => {
    const issuedAt = String(Date.now());
    // Wrong signature
    const cookie = `iosky_staging_pass=${issuedAt}.deadbeef`;
    const r = await request(buildApp(), "GET", "/", { cookie });
    expect(r.body).toContain("Private pre-launch");
  });

  it("lets a request through when an authenticated session cookie is present", async () => {
    const cookie = "app_session_id=any-existing-jwt";
    const r = await request(buildApp(), "GET", "/", { cookie });
    expect(r.status).toBe(200);
    expect(r.body).toBe("HOMEPAGE");
  });

  it("returns Disallow: / from /robots.txt", async () => {
    const r = await request(buildApp(), "GET", "/robots.txt");
    expect(r.status).toBe(200);
    expect(r.body).toContain("Disallow: /");
  });
});

describe("stagingGate — STAGING_MODE off", () => {
  beforeEach(() => {
    delete process.env.STAGING_MODE;
  });

  it("does not gate anonymous requests", async () => {
    const r = await request(buildApp(), "GET", "/");
    expect(r.status).toBe(200);
    expect(r.body).toBe("HOMEPAGE");
  });

  it("returns Allow: / from /robots.txt", async () => {
    const r = await request(buildApp(), "GET", "/robots.txt");
    expect(r.status).toBe(200);
    expect(r.body).toContain("Allow: /");
  });
});
