/**
 * IO SKY — MFA post-login challenge route specs.
 *
 * The challenge endpoint lives outside tRPC (Express handler) because it has
 * to read AND write cookies atomically: verify the user's code, swap the
 * short-lived `io_sky_mfa_pending` cookie for the real session cookie. We
 * therefore mock `server/db.ts` (factor store + audit) but run the real
 * crypto helpers, the real otplib code, and the real JWT signer.
 *
 * Scenarios covered:
 *   1. `verifyChallengeCode` happy paths (TOTP + SMS) and rejection paths
 *      (no factor, wrong kind, expired SMS code).
 *   2. POST /api/mfa/challenge with no pending cookie  → 401 challenge_expired
 *   3. POST /api/mfa/challenge with valid TOTP code    → 200 + session cookie
 *   4. POST /api/mfa/challenge with valid recovery     → 200, recovery burned
 *   5. POST /api/mfa/challenge with wrong code         → 401 + failure bumped
 *   6. POST /api/mfa/challenge against locked factor   → 429 factor_locked
 *   7. POST /api/mfa/challenge with factor owned by    → 404 factor_not_found
 *      a different user
 *
 * The route handler is invoked through a fake Express app — we don't spin
 * up an HTTP server. `registerMfaChallengeRoutes` calls `app.post()` and
 * `app.get()`, and we capture the registered handlers, then invoke them
 * directly with synthesized `req`/`res` mocks. This keeps the test fast
 * and deterministic without supertest.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateSync } from "otplib";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.VITE_APP_ID = "io-sky-test";
});

// ---------------------------------------------------------------------------
// In-memory fake of the slice of db.ts the challenge route touches.
// ---------------------------------------------------------------------------

interface FakeFactor {
  id: number;
  userId: number;
  kind: "totp" | "sms";
  label: string | null;
  secret: string; // ciphertext blob produced by envelopeEncrypt
  phoneHint: string | null;
  primary: number;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
  failedAttempts: number;
  lockedUntilMs: number | null;
  createdAt: Date;
}

let factors: FakeFactor[] = [];
let recoveryRows: {
  id: number;
  userId: number;
  codeHash: string;
  usedAt: Date | null;
}[] = [];
let auditLog: any[] = [];

vi.mock("./db", () => ({
  getMfaFactorById: vi.fn(async (id: number) =>
    factors.find(f => f.id === id) ?? null,
  ),
  listVerifiedMfaFactorsForUser: vi.fn(async (userId: number) =>
    factors.filter(f => f.userId === userId && f.verifiedAt !== null),
  ),
  bumpMfaFactorFailure: vi.fn(async (id: number, opts: any = {}) => {
    const f = factors.find(f => f.id === id);
    if (!f) return null;
    f.failedAttempts += 1;
    if (opts.lockUntilMs) f.lockedUntilMs = opts.lockUntilMs;
    return f.failedAttempts;
  }),
  clearMfaFactorFailure: vi.fn(async (id: number) => {
    const f = factors.find(f => f.id === id);
    if (f) {
      f.failedAttempts = 0;
      f.lockedUntilMs = null;
      f.lastUsedAt = new Date();
    }
  }),
  listUnusedRecoveryCodesForUser: vi.fn(async (userId: number) =>
    recoveryRows.filter(r => r.userId === userId && r.usedAt === null),
  ),
  markRecoveryCodeUsed: vi.fn(async (codeId: number) => {
    const r = recoveryRows.find(r => r.id === codeId);
    if (r) r.usedAt = new Date();
  }),
  appendLoginAudit: vi.fn(async (input: any) => {
    auditLog.push(input);
  }),
}));

// Imported after the mock so the route module picks up the fakes.
import {
  registerMfaChallengeRoutes,
  verifyChallengeCode,
} from "./_core/mfaChallengeRoute";
import {
  MFA_PENDING_COOKIE,
  signMfaPending,
} from "./_core/mfaChallenge";
import {
  envelopeEncrypt,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "./_core/mfaCrypto";

beforeEach(() => {
  factors = [];
  recoveryRows = [];
  auditLog = [];
});

// ---------------------------------------------------------------------------
// Tiny Express-shim that captures the route handlers so we can call them
// directly with synthesized req/res objects.
// ---------------------------------------------------------------------------

type Handler = (req: any, res: any) => Promise<void> | void;
function makeApp(): {
  app: any;
  post: Map<string, Handler>;
  get: Map<string, Handler>;
} {
  const post = new Map<string, Handler>();
  const get = new Map<string, Handler>();
  const app: any = {
    post(path: string, h: Handler) {
      post.set(path, h);
    },
    get(path: string, h: Handler) {
      get.set(path, h);
    },
  };
  return { app, post, get };
}

function makeRes() {
  const cookies: Record<string, { value: string; opts: any }> = {};
  const res: any = {
    statusCode: 200,
    body: null as any,
    cookies,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    cookie(name: string, value: string, opts: any) {
      cookies[name] = { value, opts };
      return this;
    },
    clearCookie(name: string) {
      delete cookies[name];
      return this;
    },
    redirect() {
      return this;
    },
  };
  return res;
}

async function makePendingCookie(opts: {
  openId?: string;
  userId: number;
  name?: string;
  next?: string;
  ttlMs?: number;
}) {
  return await signMfaPending(
    {
      openId: opts.openId ?? "open-123",
      userId: opts.userId,
      name: opts.name ?? "Test User",
      next: opts.next ?? "/developer-workspace",
    },
    { ttlMs: opts.ttlMs },
  );
}

function seedTotpFactor(userId = 42) {
  // 32-character base32 secret; otplib generates these in production but a
  // fixed string makes the test deterministic.
  const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
  const ciphertext = envelopeEncrypt(secret);
  const factor: FakeFactor = {
    id: 1,
    userId,
    kind: "totp",
    label: "Test phone",
    secret: ciphertext,
    phoneHint: null,
    primary: 1,
    verifiedAt: new Date(),
    lastUsedAt: null,
    failedAttempts: 0,
    lockedUntilMs: null,
    createdAt: new Date(),
  };
  factors.push(factor);
  return { factor, secret };
}

function seedSmsFactor(opts: {
  userId?: number;
  code: string;
  expiresInMs?: number;
}) {
  const userId = opts.userId ?? 42;
  const expiresInMs = opts.expiresInMs ?? 5 * 60 * 1000;
  const payload = {
    phone: "+31612345678",
    pendingCode: opts.code,
    pendingExpiresAt: Date.now() + expiresInMs,
  };
  const ciphertext = envelopeEncrypt(JSON.stringify(payload));
  const factor: FakeFactor = {
    id: 2,
    userId,
    kind: "sms",
    label: "iPhone",
    secret: ciphertext,
    phoneHint: "•••• 5678",
    primary: 0,
    verifiedAt: new Date(),
    lastUsedAt: null,
    failedAttempts: 0,
    lockedUntilMs: null,
    createdAt: new Date(),
  };
  factors.push(factor);
  return factor;
}

// ---------------------------------------------------------------------------
// 1. verifyChallengeCode pure helper
// ---------------------------------------------------------------------------

describe("verifyChallengeCode", () => {
  it("accepts a fresh TOTP code generated from the same secret", async () => {
    const { factor, secret } = seedTotpFactor();
    const token = generateSync({
      strategy: "totp",
      secret,
      digits: 6,
      period: 30,
    });
    expect(await verifyChallengeCode(factor, token)).toBe(true);
  });

  it("rejects a TOTP code that is plainly wrong", async () => {
    const { factor } = seedTotpFactor();
    expect(await verifyChallengeCode(factor, "000000")).toBe(false);
  });

  it("accepts an SMS code while its expiry is in the future", async () => {
    const factor = seedSmsFactor({ code: "918273" });
    expect(await verifyChallengeCode(factor, "918273")).toBe(true);
  });

  it("rejects an SMS code once it has expired", async () => {
    const factor = seedSmsFactor({ code: "918273", expiresInMs: -1000 });
    expect(await verifyChallengeCode(factor, "918273")).toBe(false);
  });

  it("rejects when the factor is not verified", async () => {
    const { factor, secret } = seedTotpFactor();
    factor.verifiedAt = null;
    const token = generateSync({
      strategy: "totp",
      secret,
      digits: 6,
      period: 30,
    });
    expect(await verifyChallengeCode(factor, token)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. End-to-end through the Express handler
// ---------------------------------------------------------------------------

describe("POST /api/mfa/challenge", () => {
  function setup() {
    const { app, post, get } = makeApp();
    registerMfaChallengeRoutes(app);
    return {
      challenge: post.get("/api/mfa/challenge")!,
      status: get.get("/api/mfa/challenge/status")!,
    };
  }

  it("returns 401 challenge_expired when no pending cookie is set", async () => {
    const { challenge } = setup();
    const res = makeRes();
    await challenge(
      { headers: { cookie: "" }, socket: {}, body: { factorId: 1, code: "000000" } },
      res,
    );
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "challenge_expired" });
  });

  it("issues a real session cookie and clears the pending cookie on a valid TOTP code", async () => {
    const { factor, secret } = seedTotpFactor(42);
    const { challenge } = setup();
    const pending = await makePendingCookie({ userId: 42 });
    const token = generateSync({
      strategy: "totp",
      secret,
      digits: 6,
      period: 30,
    });
    const res = makeRes();

    await challenge(
      {
        headers: {
          cookie: `${MFA_PENDING_COOKIE}=${pending}`,
          "user-agent": "vitest",
        },
        socket: { remoteAddress: "127.0.0.1" },
        body: { factorId: factor.id, code: token },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.next).toBe("/developer-workspace");
    // Real session cookie set
    const sessionCookieName = Object.keys(res.cookies).find(
      n => n !== MFA_PENDING_COOKIE,
    );
    expect(sessionCookieName).toBeTruthy();
    // Pending cookie cleared (maxAge 0)
    expect(res.cookies[MFA_PENDING_COOKIE]?.opts.maxAge).toBe(0);
    // Failure counter cleared
    expect(factor.failedAttempts).toBe(0);
    // Success audit row
    expect(
      auditLog.some(
        a => a.outcome === "success" && a.reason?.includes("mfa_challenge_passed"),
      ),
    ).toBe(true);
  });

  it("returns 401 + bumps the failure counter on a wrong code", async () => {
    const { factor } = seedTotpFactor(42);
    const { challenge } = setup();
    const pending = await makePendingCookie({ userId: 42 });
    const res = makeRes();
    await challenge(
      {
        headers: {
          cookie: `${MFA_PENDING_COOKIE}=${pending}`,
          "user-agent": "vitest",
        },
        socket: { remoteAddress: "127.0.0.1" },
        body: { factorId: factor.id, code: "000000" },
      },
      res,
    );
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "invalid_code" });
    expect(factor.failedAttempts).toBe(1);
    expect(
      auditLog.some(
        a => a.outcome === "failed" && a.reason?.includes("mfa_challenge_failed"),
      ),
    ).toBe(true);
  });

  it("returns 429 when the factor is already locked", async () => {
    const { factor } = seedTotpFactor(42);
    factor.lockedUntilMs = Date.now() + 5 * 60 * 1000;
    const { challenge } = setup();
    const pending = await makePendingCookie({ userId: 42 });
    const res = makeRes();
    await challenge(
      {
        headers: { cookie: `${MFA_PENDING_COOKIE}=${pending}` },
        socket: {},
        body: { factorId: factor.id, code: "000000" },
      },
      res,
    );
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "factor_locked" });
  });

  it("returns 404 when the factor belongs to a different user", async () => {
    const { factor } = seedTotpFactor(7);
    const { challenge } = setup();
    const pending = await makePendingCookie({ userId: 42 });
    const res = makeRes();
    await challenge(
      {
        headers: { cookie: `${MFA_PENDING_COOKIE}=${pending}` },
        socket: {},
        body: { factorId: factor.id, code: "000000" },
      },
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "factor_not_found" });
  });

  it("redeems a valid recovery code one-shot and marks it used", async () => {
    seedTotpFactor(42);
    // Seed one unused recovery code we know the plaintext of.
    const plain = "ABCD-1234";
    recoveryRows.push({
      id: 11,
      userId: 42,
      codeHash: hashRecoveryCode(plain),
      usedAt: null,
    });
    const { challenge } = setup();
    const pending = await makePendingCookie({ userId: 42 });
    const res = makeRes();
    await challenge(
      {
        headers: { cookie: `${MFA_PENDING_COOKIE}=${pending}` },
        socket: {},
        body: { recoveryCode: plain },
      },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    // The code is now marked used → cannot be redeemed again.
    expect(recoveryRows[0].usedAt).not.toBeNull();

    const res2 = makeRes();
    await challenge(
      {
        headers: { cookie: `${MFA_PENDING_COOKIE}=${pending}` },
        socket: {},
        body: { recoveryCode: plain },
      },
      res2,
    );
    expect(res2.statusCode).toBe(401);
  });

  it("rejects an unrelated recovery code", async () => {
    seedTotpFactor(42);
    const { plaintext, hashes } = generateRecoveryCodes(1);
    recoveryRows.push({
      id: 12,
      userId: 42,
      codeHash: hashes[0],
      usedAt: null,
    });
    expect(plaintext[0]).toBeTruthy();

    const { challenge } = setup();
    const pending = await makePendingCookie({ userId: 42 });
    const res = makeRes();
    await challenge(
      {
        headers: { cookie: `${MFA_PENDING_COOKIE}=${pending}` },
        socket: {},
        body: { recoveryCode: "ZZZZ-ZZZZ" },
      },
      res,
    );
    expect(res.statusCode).toBe(401);
    expect(recoveryRows[0].usedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/mfa/challenge/status
// ---------------------------------------------------------------------------

describe("GET /api/mfa/challenge/status", () => {
  function setup() {
    const { app, post, get } = makeApp();
    registerMfaChallengeRoutes(app);
    return { status: get.get("/api/mfa/challenge/status")! };
  }

  it("returns 401 inactive when there is no pending cookie", async () => {
    const { status } = setup();
    const res = makeRes();
    await status({ headers: { cookie: "" } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ active: false });
  });

  it("returns the list of verified factors for the pending user", async () => {
    const { factor } = seedTotpFactor(42);
    seedSmsFactor({ userId: 42, code: "123456" });
    const { status } = setup();
    const pending = await makePendingCookie({ userId: 42 });
    const res = makeRes();
    await status(
      { headers: { cookie: `${MFA_PENDING_COOKIE}=${pending}` } },
      res,
    );
    expect(res.body.active).toBe(true);
    expect(res.body.next).toBe("/developer-workspace");
    expect(res.body.factors).toHaveLength(2);
    const totpEntry = res.body.factors.find((f: any) => f.kind === "totp");
    expect(totpEntry?.id).toBe(factor.id);
    expect(totpEntry?.primary).toBe(true);
  });
});
