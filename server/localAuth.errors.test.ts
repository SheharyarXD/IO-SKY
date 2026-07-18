/**
 * IO SKY — Local-auth endpoint error-feedback specs.
 *
 * Locks the user-facing safety contract for `/api/auth/local/login`:
 *   1. Missing email or password → 400 with stable code "missing_fields".
 *   2. Unknown email             → 401 with code "invalid_credentials"
 *                                  (NEVER reveals "email not found").
 *   3. Wrong password            → 401 with code "invalid_credentials"
 *                                  (same code/message — no enumeration).
 *   4. Internal error            → 500 with code "server_error".
 *   5. Success                   → 200 with role + next, mints cookie.
 *
 * Failure outcomes are written to `login_audit` for forensic review.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import express from "express";
import type { Request, Response } from "express";

// --- Mock the db module BEFORE importing the route. -----------------
vi.mock("../server/db", () => ({
  getUserByEmailWithPassword: vi.fn(),
  appendLoginAudit: vi.fn(async () => {}),
  touchUserLastSignedIn: vi.fn(async () => {}),
}));
vi.mock("./_core/sdk", () => ({
  sdk: { createSessionToken: vi.fn(async () => "fake.session.token") },
}));
vi.mock("./_core/cookies", () => ({
  getSessionCookieOptions: () => ({
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
  }),
}));

import * as db from "./db";
import { registerLocalAuthRoutes } from "./_core/localAuthRoute";

// ---- Helpers -------------------------------------------------------

type Capture = {
  status: number;
  body: any;
  cookieName?: string;
  cookieValue?: string;
};

function callLogin(body: unknown, knownPassword?: string): Promise<Capture> {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    registerLocalAuthRoutes(app);

    const cap: Capture = { status: 0, body: undefined };
    const req = {
      body,
      headers: { "user-agent": "vitest" },
      socket: { remoteAddress: "127.0.0.1" },
      method: "POST",
      url: "/api/auth/local/login",
    } as unknown as Request;

    const res = {
      status(code: number) {
        cap.status = code;
        return this;
      },
      json(payload: any) {
        cap.body = payload;
        resolve(cap);
        return this;
      },
      cookie(name: string, value: string) {
        cap.cookieName = name;
        cap.cookieValue = value;
        return this;
      },
    } as unknown as Response;

    // Find the registered handler and invoke it directly.
    const stack = (app as any)._router.stack as Array<any>;
    const layer = stack.find(
      (l) => l.route && l.route.path === "/api/auth/local/login",
    );
    const handler = layer.route.stack[0].handle as (
      r: Request,
      s: Response,
    ) => Promise<void> | void;
    void Promise.resolve(handler(req, res));
  });
}

// Pre-computed bcrypt hash for the password "correct-horse-battery-staple".
// Generated once and reused so tests stay fast.
const KNOWN_PW = "correct-horse-battery-staple";
const KNOWN_HASH = bcrypt.hashSync(KNOWN_PW, 4); // cost=4 keeps tests <50ms

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- 1. Missing fields ---------------------------------------------

describe("POST /api/auth/local/login — missing fields", () => {
  it("returns 400 with stable code 'missing_fields' when email is empty", async () => {
    const cap = await callLogin({ email: "", password: "abc" });
    expect(cap.status).toBe(400);
    expect(cap.body).toMatchObject({ ok: false, code: "missing_fields" });
  });

  it("returns 400 with stable code 'missing_fields' when password is empty", async () => {
    const cap = await callLogin({ email: "x@y.com", password: "" });
    expect(cap.status).toBe(400);
    expect(cap.body).toMatchObject({ ok: false, code: "missing_fields" });
  });

  it("returns 400 when body is empty object", async () => {
    const cap = await callLogin({});
    expect(cap.status).toBe(400);
    expect(cap.body.code).toBe("missing_fields");
  });

  it("missing-fields path does NOT touch the database", async () => {
    await callLogin({ email: "", password: "" });
    expect(vi.mocked(db.getUserByEmailWithPassword)).not.toHaveBeenCalled();
  });
});

// ---- 2. Unknown email ----------------------------------------------

describe("POST /api/auth/local/login — unknown email", () => {
  it("returns 401 with the SAME generic code as wrong-password", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce(undefined as any);

    const cap = await callLogin({
      email: "ghost@iosky.local",
      password: "anything",
    });
    expect(cap.status).toBe(401);
    expect(cap.body).toMatchObject({ ok: false, code: "invalid_credentials" });
    // The error string MUST be generic — must not mention "email" or "exists".
    expect(String(cap.body.error).toLowerCase()).not.toMatch(/no.*account|not found|email.*exist/);
  });

  it("still runs a bcrypt compare to keep timing constant (anti-enumeration)", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce(undefined as any);
    const spy = vi.spyOn(bcrypt, "compare");
    await callLogin({ email: "ghost@iosky.local", password: "anything" });
    expect(spy).toHaveBeenCalled();
  });

  it("audits the failed attempt with reason 'invalid_credentials'", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce(undefined as any);
    await callLogin({ email: "ghost@iosky.local", password: "anything" });
    expect(vi.mocked(db.appendLoginAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        reason: "invalid_credentials",
        provider: "local",
        userId: null,
      }),
    );
  });
});

// ---- 3. Wrong password ---------------------------------------------

describe("POST /api/auth/local/login — wrong password", () => {
  it("returns 401 with code 'invalid_credentials' for a real user", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce({
      id: 42,
      openId: "user-42",
      email: "real@iosky.local",
      passwordHash: KNOWN_HASH,
      role: "client",
      name: "Real User",
    } as any);

    const cap = await callLogin({
      email: "real@iosky.local",
      password: "definitely-wrong",
    });
    expect(cap.status).toBe(401);
    expect(cap.body.code).toBe("invalid_credentials");
  });

  it("does NOT mint a session cookie on wrong password", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce({
      id: 42,
      openId: "user-42",
      email: "real@iosky.local",
      passwordHash: KNOWN_HASH,
      role: "client",
      name: "Real User",
    } as any);
    const cap = await callLogin({
      email: "real@iosky.local",
      password: "definitely-wrong",
    });
    expect(cap.cookieName).toBeUndefined();
  });

  it("audits the failed attempt linked to the real user id", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce({
      id: 42,
      openId: "user-42",
      email: "real@iosky.local",
      passwordHash: KNOWN_HASH,
      role: "client",
      name: "Real User",
    } as any);
    await callLogin({
      email: "real@iosky.local",
      password: "definitely-wrong",
    });
    expect(vi.mocked(db.appendLoginAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        reason: "invalid_credentials",
        userId: 42,
      }),
    );
  });
});

// ---- 4. Disabled / passwordless account ----------------------------

describe("POST /api/auth/local/login — passwordless account", () => {
  it("treats user.passwordHash=null exactly like wrong-password (401, no enumeration)", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce({
      id: 7,
      openId: "user-7",
      email: "oauth-only@iosky.local",
      passwordHash: null,
      role: "client",
      name: "OAuth User",
    } as any);

    const cap = await callLogin({
      email: "oauth-only@iosky.local",
      password: "anything",
    });
    expect(cap.status).toBe(401);
    expect(cap.body.code).toBe("invalid_credentials");
  });
});

// ---- 5. Successful login -------------------------------------------

describe("POST /api/auth/local/login — success path", () => {
  it("returns 200 with role + next, mints io_sky_session cookie, audits success", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce({
      id: 90007,
      openId: "local-client-iosky",
      email: "client@iosky.local",
      passwordHash: KNOWN_HASH,
      role: "client",
      name: "IO SKY Test Client",
    } as any);

    const cap = await callLogin({
      email: "client@iosky.local",
      password: KNOWN_PW,
    });
    expect(cap.status).toBe(200);
    expect(cap.body).toMatchObject({
      ok: true,
      role: "client",
      next: "/client-portal",
    });
    expect(cap.cookieName).toBe("app_session_id");
    expect(cap.cookieValue).toBeTruthy();
    expect(vi.mocked(db.appendLoginAudit)).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "success", userId: 90007 }),
    );
    expect(vi.mocked(db.touchUserLastSignedIn)).toHaveBeenCalledWith(90007);
  });

  it("admin role redirects to /admin/bookings", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce({
      id: 90006,
      openId: "local-admin-iosky",
      email: "admin@iosky.local",
      passwordHash: KNOWN_HASH,
      role: "admin",
      name: "Admin",
    } as any);
    const cap = await callLogin({
      email: "admin@iosky.local",
      password: KNOWN_PW,
    });
    expect(cap.body.next).toBe("/admin/bookings");
  });

  it("developer role redirects to /developer-workspace", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockResolvedValueOnce({
      id: 90008,
      openId: "local-dev-iosky",
      email: "dev@iosky.local",
      passwordHash: KNOWN_HASH,
      role: "developer",
      name: "Dev",
    } as any);
    const cap = await callLogin({
      email: "dev@iosky.local",
      password: KNOWN_PW,
    });
    expect(cap.body.next).toBe("/developer-workspace");
  });
});

// ---- 6. Internal server error --------------------------------------

describe("POST /api/auth/local/login — internal error", () => {
  it("returns 500 with code 'server_error' when the DB lookup throws", async () => {
    vi.mocked(db.getUserByEmailWithPassword).mockRejectedValueOnce(
      new Error("connection lost"),
    );
    const cap = await callLogin({ email: "x@y.com", password: "abc" });
    expect(cap.status).toBe(500);
    expect(cap.body.code).toBe("server_error");
  });
});
