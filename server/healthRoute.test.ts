/**
 * Milestone 3 §3.2 (RM-76) — health endpoint tests.
 *
 * The distinction these pin is the one that causes outages when it is missed:
 * liveness must not depend on the database. An orchestrator restarts anything
 * failing its liveness probe, so a liveness check that queries the database
 * turns a brief database blip into a simultaneous restart of every instance —
 * converting a recoverable dependency failure into a total outage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db/connection", () => ({ getDb: getDbMock }));

const { registerHealthRoutes } = await import("./_core/healthRoute");

async function request(
  app: express.Express,
  path: string,
): Promise<{ status: number; headers: Record<string, string>; body: any }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      fetch(`http://127.0.0.1:${port}${path}`)
        .then(async (r) => {
          const text = await r.text();
          const headers: Record<string, string> = {};
          r.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
          server.close();
          let body: any = text;
          try {
            body = JSON.parse(text);
          } catch {
            /* keep raw */
          }
          resolve({ status: r.status, headers, body });
        })
        .catch(() => {
          server.close();
          resolve({ status: 0, headers: {}, body: null });
        });
    });
  });
}

function buildApp() {
  const app = express();
  registerHealthRoutes(app);
  return app;
}

beforeEach(() => {
  getDbMock.mockReset();
});

describe("RM-76: liveness (/health)", () => {
  it("returns 200 with a status payload", async () => {
    getDbMock.mockResolvedValue(null);
    const res = await request(buildApp(), "/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });

  it("stays 200 even when the database is completely unavailable", async () => {
    // The assertion this file exists for. Liveness answers "is this process
    // alive", not "is every dependency healthy" — coupling them means a
    // database blip restarts every container at once.
    getDbMock.mockRejectedValue(new Error("connection refused"));
    const res = await request(buildApp(), "/health");
    expect(res.status).toBe(200);
  });

  it("never touches the database at all", async () => {
    await request(buildApp(), "/health");
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("forbids caching so a proxy cannot mask a dead instance", async () => {
    const res = await request(buildApp(), "/health");
    expect(res.headers["cache-control"]).toContain("no-store");
  });
});

describe("RM-76: readiness (/health/ready)", () => {
  it("returns 200 when the database answers", async () => {
    getDbMock.mockResolvedValue({ execute: vi.fn(async () => [{ "?column?": 1 }]) });
    const res = await request(buildApp(), "/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.checks.database.ok).toBe(true);
  });

  it("returns 503 when the database is unreachable", async () => {
    // 503 rather than 200-with-a-flag: load balancers route on the status
    // code, so a body-only signal would keep sending traffic to an instance
    // that cannot serve it.
    getDbMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await request(buildApp(), "/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("not_ready");
    expect(res.body.checks.database.ok).toBe(false);
  });

  it("returns 503 when no database is configured at all", async () => {
    getDbMock.mockResolvedValue(null);
    const res = await request(buildApp(), "/health/ready");
    expect(res.status).toBe(503);
  });

  it("reports the probe latency", async () => {
    getDbMock.mockResolvedValue({ execute: vi.fn(async () => []) });
    const res = await request(buildApp(), "/health/ready");
    expect(typeof res.body.checks.database.latencyMs).toBe("number");
  });

  it("never leaks a connection string in the error message", async () => {
    // This endpoint is unauthenticated. A raw driver error can carry the full
    // DSN including the password.
    getDbMock.mockRejectedValue(
      new Error("connect ECONNREFUSED postgresql://postgres:hunter2@db.example.co:5432/postgres"),
    );
    const res = await request(buildApp(), "/health/ready");
    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain("hunter2");
  });
});

describe("RM-76: version (/health/version)", () => {
  it("reports the build commit so a deploy or rollback can be confirmed", async () => {
    const res = await request(buildApp(), "/health/version");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("commit");
    expect(res.body).toHaveProperty("environment");
  });

  it("says 'unknown' rather than inventing a commit when unset", async () => {
    delete process.env.GIT_COMMIT_SHA;
    const res = await request(buildApp(), "/health/version");
    expect(res.body.commit).toBe("unknown");
  });
});

describe("RM-76: credential redaction", () => {
  it("redacts a password embedded in a connection URL", async () => {
    const { redactCredentials } = await import("./_core/healthRoute");
    expect(redactCredentials("connect failed postgresql://postgres:hunter2@db.example.co:5432/x")).toBe(
      "connect failed postgresql://postgres:***@db.example.co:5432/x",
    );
  });

  it("redacts a key/value style password", async () => {
    const { redactCredentials } = await import("./_core/healthRoute");
    expect(redactCredentials("host=db password=s3cr3t sslmode=require")).toContain("password=***");
  });

  it("leaves an innocuous message untouched", async () => {
    const { redactCredentials } = await import("./_core/healthRoute");
    expect(redactCredentials("timeout after 3000ms")).toBe("timeout after 3000ms");
  });
});
