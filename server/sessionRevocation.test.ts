/**
 * Milestone 3 §3.3 (RM-90) — logout actually revokes sessions.
 *
 * Before this change, `authenticateRequest` accepted any correctly-signed,
 * unexpired session cookie. Logout cleared the browser's copy and nothing
 * else, so a token captured beforehand stayed valid for the rest of its
 * lifetime — which, before RM-89, was a full year.
 *
 * These tests exercise the enforcement point directly: mint a real signed
 * token, stamp a revocation cutoff on the stubbed user row, and assert that
 * authentication now refuses it.
 *
 * `server/db` is stubbed so the suite runs without a live database — the
 * revocation decision is pure logic over (token iat, user cutoff), and that
 * is what needs pinning.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Set inside beforeAll, and to the same value every other test file uses.
// Assigning process.env at module top level leaked into sibling files sharing
// a worker and broke server/viewAs.test.ts's tampered-payload case, which
// signs with its own secret — a failure that only appeared in the full run,
// never in isolation. beforeAll is the convention the rest of the suite
// already follows (bookings, mfa, viewAs, ...).
const TEST_JWT_SECRET = "test-secret-test-secret-test-secret-1234";

beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

/** The stubbed user row the SDK will load. Mutated per test. */
const userRow: {
  id: number;
  openId: string;
  name: string;
  role: string;
  sessionsRevokedAtMs: number | null;
} = {
  id: 1,
  openId: "local-test-user",
  name: "Test User",
  role: "client",
  sessionsRevokedAtMs: null,
};

vi.mock("./db", () => ({
  getUserByOpenId: vi.fn(async () => userRow),
  upsertUser: vi.fn(async () => undefined),
  touchUserLastSignedIn: vi.fn(async () => undefined),
  revokeUserSessions: vi.fn(async () => true),
  revokeUserSessionsByOpenId: vi.fn(async () => true),
}));

const { sdk } = await import("./_core/sdk");

function requestWithCookie(token: string) {
  return {
    headers: { cookie: `app_session_id=${token}` },
  } as unknown as Parameters<typeof sdk.authenticateRequest>[0];
}

describe("RM-90: server-side session revocation", () => {
  beforeEach(() => {
    userRow.sessionsRevokedAtMs = null;
  });

  it("accepts a valid session when nothing has been revoked", async () => {
    const token = await sdk.createSessionToken("local-test-user", { name: "Test User" });
    const user = await sdk.authenticateRequest(requestWithCookie(token));
    expect(user).toBeTruthy();
  });

  it("rejects a token issued before the revocation cutoff", async () => {
    const token = await sdk.createSessionToken("local-test-user", { name: "Test User" });
    // Simulate logout happening one second after the token was minted.
    userRow.sessionsRevokedAtMs = Date.now() + 1000;
    await expect(sdk.authenticateRequest(requestWithCookie(token))).rejects.toThrow(
      /revoked/i,
    );
  });

  it("rejects a token issued in the same second as the revocation", async () => {
    // JWT `iat` has one-second granularity, so a strict `<` comparison would
    // let a token minted during the revocation second slip through — exactly
    // the window a logout-then-replay would aim at.
    const token = await sdk.createSessionToken("local-test-user", { name: "Test User" });
    const iatSecond = Math.floor(Date.now() / 1000) * 1000;
    userRow.sessionsRevokedAtMs = iatSecond;
    await expect(sdk.authenticateRequest(requestWithCookie(token))).rejects.toThrow(
      /revoked/i,
    );
  });

  it("accepts a fresh login issued after a revocation", async () => {
    // Logging out must not lock the user out of logging back in.
    userRow.sessionsRevokedAtMs = Date.now() - 5000;
    const token = await sdk.createSessionToken("local-test-user", { name: "Test User" });
    const user = await sdk.authenticateRequest(requestWithCookie(token));
    expect(user).toBeTruthy();
  });

  it("rejects a legacy token with no iat claim once a revocation exists", async () => {
    // Tokens minted before RM-90 carry no `iat`. They cannot be proven to
    // post-date the revocation, so they must fail closed rather than be
    // treated as infinitely new.
    const { SignJWT } = await import("jose");
    const legacy = await new SignJWT({ openId: "local-test-user", appId: "", name: "Test User" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(new TextEncoder().encode(TEST_JWT_SECRET));

    userRow.sessionsRevokedAtMs = Date.now();
    await expect(sdk.authenticateRequest(requestWithCookie(legacy))).rejects.toThrow(
      /revoked/i,
    );
  });

  it("still accepts a legacy token when the user has never revoked", async () => {
    // Backwards compatibility: existing logged-in users must not all be
    // signed out by deploying this change.
    const { SignJWT } = await import("jose");
    const legacy = await new SignJWT({ openId: "local-test-user", appId: "", name: "Test User" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(new TextEncoder().encode(TEST_JWT_SECRET));

    userRow.sessionsRevokedAtMs = null;
    const user = await sdk.authenticateRequest(requestWithCookie(legacy));
    expect(user).toBeTruthy();
  });
});

describe("RM-89/RM-90: issued-at claim is present on every new session", () => {
  it("signs an iat claim so revocation has something to compare against", async () => {
    const token = await sdk.createSessionToken("local-test-user", { name: "Test User" });
    const session = await sdk.verifySession(token);
    expect(session).toBeTruthy();
    expect(typeof session!.issuedAtMs).toBe("number");
    expect(session!.issuedAtMs!).toBeGreaterThan(Date.now() - 60_000);
  });

  it("mints sessions that expire in hours, not a year", async () => {
    const token = await sdk.createSessionToken("local-test-user", { name: "Test User" });
    const { decodeJwt } = await import("jose");
    const claims = decodeJwt(token);
    const lifetimeMs = claims.exp! * 1000 - claims.iat! * 1000;
    expect(lifetimeMs).toBe(12 * 60 * 60 * 1000);
  });
});
