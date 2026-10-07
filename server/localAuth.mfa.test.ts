/*
 * SRS 8.8 and 8.10: a correct password is only the first factor.
 *
 * Regression for a gap found while preparing the delivery report: the local
 * password sign in minted a full session for an account with a verified second
 * factor, so a stolen password alone was enough. The Supabase and OAuth paths
 * already challenged; this path now does too.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import express from "express";
import type { Request, Response } from "express";
import { COOKIE_NAME } from "@shared/const";

const m = vi.hoisted(() => ({
  getUserByEmailWithPassword: vi.fn(),
  listVerifiedMfaFactorsForUser: vi.fn(),
  appendLoginAudit: vi.fn(async () => {}),
  touchUserLastSignedIn: vi.fn(async () => {}),
}));

vi.mock("./db", () => ({ ...m }));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: vi.fn(async () => "real.session.token") } }));
vi.mock("./_core/cookies", () => ({ getSessionCookieOptions: () => ({ httpOnly: true, secure: true, sameSite: "none" as const, path: "/" }) }));
vi.mock("./_core/mfaChallenge", () => ({
  MFA_PENDING_COOKIE: "io_sky_mfa_pending",
  MFA_PENDING_TTL_MS: 300_000,
  sanitiseNext: (n: string) => n,
  signMfaPending: vi.fn(async () => "pending.token"),
}));

import { registerLocalAuthRoutes } from "./_core/localAuthRoute";

const PW = "correct-horse-battery-staple";
const HASH = bcrypt.hashSync(PW, 4);
const user = (role = "super_admin") => ({ id: 9, openId: "o9", name: "N", role, passwordHash: HASH });

type Cap = { status: number; body: any; cookies: Array<{ name: string; value: string; maxAge?: number }> };

function login(): Promise<Cap> {
  return new Promise((resolve) => {
    const app = express();
    registerLocalAuthRoutes(app);
    const cap: Cap = { status: 0, body: undefined, cookies: [] };
    const req = { body: { email: "a@example.com", password: PW }, headers: { "user-agent": "vitest" }, socket: { remoteAddress: "127.0.0.1" }, method: "POST", url: "/api/auth/local/login" } as unknown as Request;
    const res = {
      status(c: number) {
        cap.status = c;
        return this;
      },
      json(p: unknown) {
        cap.body = p;
        resolve(cap);
        return this;
      },
      cookie(name: string, value: string, opts: { maxAge?: number }) {
        cap.cookies.push({ name, value, maxAge: opts?.maxAge });
        return this;
      },
    } as unknown as Response;
    const layer = ((app as any)._router.stack as any[]).find((l) => l.route?.path === "/api/auth/local/login");
    void Promise.resolve(layer.route.stack[0].handle(req, res));
  });
}

beforeEach(() => vi.clearAllMocks());

describe("local sign in with a second factor enrolled", () => {
  it("issues no session and sends the browser to the challenge", async () => {
    m.getUserByEmailWithPassword.mockResolvedValueOnce(user());
    m.listVerifiedMfaFactorsForUser.mockResolvedValueOnce([{ id: 1 }]);
    const cap = await login();
    expect(cap.status).toBe(200);
    expect(cap.body).toMatchObject({ ok: true, mfaRequired: true });
    expect(cap.body.next).toContain("/mfa-challenge");
    const session = cap.cookies.find((c) => c.name === COOKIE_NAME);
    // The only session cookie touched is a clearing one (empty value, zero life).
    expect(session?.value ?? "").toBe("");
    expect(cap.cookies.some((c) => c.name === COOKIE_NAME && c.value === "real.session.token")).toBe(false);
    expect(cap.cookies.find((c) => c.name === "io_sky_mfa_pending")?.value).toBe("pending.token");
  });

  it("records an mfa_required audit row, not a successful sign in", async () => {
    m.getUserByEmailWithPassword.mockResolvedValueOnce(user());
    m.listVerifiedMfaFactorsForUser.mockResolvedValueOnce([{ id: 1 }]);
    await login();
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "mfa_required", provider: "local" }));
    expect(m.appendLoginAudit).not.toHaveBeenCalledWith(expect.objectContaining({ outcome: "success" }));
    expect(m.touchUserLastSignedIn).not.toHaveBeenCalled();
  });

  it("refuses the login when the factor lookup fails, rather than assuming there is none", async () => {
    m.getUserByEmailWithPassword.mockResolvedValueOnce(user());
    m.listVerifiedMfaFactorsForUser.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cap = await login();
    expect(cap.status).toBe(503);
    expect(cap.cookies.some((c) => c.value === "real.session.token")).toBe(false);
  });
});

describe("local sign in without a second factor", () => {
  it("still signs in with the session cookie", async () => {
    m.getUserByEmailWithPassword.mockResolvedValueOnce(user("client"));
    m.listVerifiedMfaFactorsForUser.mockResolvedValueOnce([]);
    const cap = await login();
    expect(cap.status).toBe(200);
    expect(cap.body).toMatchObject({ ok: true, role: "client" });
    expect(cap.cookies.find((c) => c.name === COOKIE_NAME)?.value).toBe("real.session.token");
  });
});
