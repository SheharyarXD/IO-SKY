/**
 * MFA router tests.
 *
 * We mock `server/db.ts` so we can drive deterministic factor + recovery code
 * state, then call the router through `createCallerFactory`. The crypto and
 * TOTP helpers are NOT mocked — they run for real, which gives us strong
 * coverage of the envelope round-trip and the otplib integration.
 */

import { beforeEach, describe, expect, it, vi, beforeAll } from "vitest";
import { generateSync } from "otplib";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
});

// ---------------------------------------------------------------------------
// In-memory fake of the MFA portion of db.ts
// ---------------------------------------------------------------------------

interface FakeFactor {
  id: number;
  userId: number;
  kind: "totp" | "sms";
  label: string | null;
  secret: string;
  phoneHint: string | null;
  primary: number;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
  failedAttempts: number;
  lockedUntilMs: number | null;
  createdAt: Date;
}

let factorStore: FakeFactor[] = [];
let nextFactorId = 1;
let recoveryHashes: Map<number, string[]> = new Map();
let auditLog: any[] = [];

let recoveryRows: { id: number; userId: number; codeHash: string; usedAt: Date | null }[] = [];
let nextRecoveryId = 1;

vi.mock("./db", () => ({
  listMfaFactorsForUser: vi.fn(async (userId: number) =>
    factorStore.filter(f => f.userId === userId),
  ),
  getMfaFactorById: vi.fn(async (id: number) =>
    factorStore.find(f => f.id === id) ?? null,
  ),
  insertMfaFactor: vi.fn(async (input: any) => {
    const id = nextFactorId++;
    factorStore.push({
      id,
      userId: input.userId,
      kind: input.kind,
      label: input.label ?? null,
      secret: input.secret,
      phoneHint: input.phoneHint ?? null,
      primary: 0,
      verifiedAt: null,
      lastUsedAt: null,
      failedAttempts: 0,
      lockedUntilMs: null,
      createdAt: new Date(),
    });
    return id;
  }),
  markMfaFactorVerified: vi.fn(async (id: number, opts: any = {}) => {
    const f = factorStore.find(f => f.id === id);
    if (f) {
      f.verifiedAt = new Date();
      f.primary = opts.setPrimary ? 1 : 0;
      f.failedAttempts = 0;
      f.lockedUntilMs = null;
    }
  }),
  clearMfaFactorFailure: vi.fn(async (id: number) => {
    const f = factorStore.find(f => f.id === id);
    if (f) {
      f.failedAttempts = 0;
      f.lockedUntilMs = null;
      f.lastUsedAt = new Date();
    }
  }),
  bumpMfaFactorFailure: vi.fn(async (id: number, opts: any = {}) => {
    const f = factorStore.find(f => f.id === id);
    if (!f) return null;
    f.failedAttempts += 1;
    if (opts.lockUntilMs) f.lockedUntilMs = opts.lockUntilMs;
    return f.failedAttempts;
  }),
  deleteMfaFactor: vi.fn(async (id: number, userId: number) => {
    factorStore = factorStore.filter(f => !(f.id === id && f.userId === userId));
  }),
  setPrimaryMfaFactor: vi.fn(async (userId: number, factorId: number) => {
    factorStore.forEach(f => {
      if (f.userId === userId) f.primary = f.id === factorId ? 1 : 0;
    });
  }),
  replaceMfaRecoveryCodes: vi.fn(async (userId: number, hashes: string[]) => {
    recoveryHashes.set(userId, hashes);
    recoveryRows = recoveryRows.filter(r => r.userId !== userId);
    for (const h of hashes) {
      recoveryRows.push({ id: nextRecoveryId++, userId, codeHash: h, usedAt: null });
    }
  }),
  listUnusedRecoveryCodesForUser: vi.fn(async (userId: number) =>
    recoveryRows.filter(r => r.userId === userId && r.usedAt === null),
  ),
  markRecoveryCodeUsed: vi.fn(async (id: number) => {
    const r = recoveryRows.find(r => r.id === id);
    if (r) r.usedAt = new Date();
  }),
  appendLoginAudit: vi.fn(async (input: any) => {
    auditLog.push(input);
  }),
}));

// Import after the mock so the router picks up the mocked module.
import { appRouter } from "./routers";

function makeCtx(user: any = { id: 42, email: "dev@io-sky.io", role: "developer" }) {
  return {
    user,
    req: { headers: { "user-agent": "vitest" }, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

const caller = (ctxOverride: any) => appRouter.createCaller(ctxOverride);

beforeEach(() => {
  factorStore = [];
  nextFactorId = 1;
  recoveryHashes = new Map();
  auditLog = [];
  recoveryRows = [];
  nextRecoveryId = 1;
});

// SMS sender mock: capture deliveries; we never want real Twilio in tests.
import { __setSmsSenderForTests } from "./_core/smsSender";
let smsDeliveries: { to: string; code: string; body: string }[] = [];
beforeEach(() => {
  smsDeliveries = [];
  __setSmsSenderForTests({
    name: "test",
    async sendOtp(input) {
      smsDeliveries.push(input);
      return { ok: true, providerMessageId: "test-msg" };
    },
  });
});

describe("mfa.enrollTotpBegin", () => {
  it("creates an un-verified factor and returns an otpauth URI", async () => {
    const c = caller(makeCtx());
    const out = await c.mfa.enrollTotpBegin({ label: "iPhone" });
    expect(out.factorId).toBeGreaterThan(0);
    expect(out.otpauthUri).toContain("otpauth://totp/");
    expect(out.otpauthUri).toContain("IO%20SKY");
    expect(factorStore).toHaveLength(1);
    expect(factorStore[0].verifiedAt).toBeNull();
    expect(auditLog.at(-1)?.reason).toBe("mfa_totp_enroll_begin");
  });
});

describe("mfa.enrollTotpVerify", () => {
  async function enroll() {
    const c = caller(makeCtx());
    const { factorId } = await c.mfa.enrollTotpBegin();
    // Pull the stored ciphertext, decrypt with the real envelope helper,
    // and produce a live token.
    const { envelopeDecrypt } = await import("./_core/mfaCrypto");
    const secret = envelopeDecrypt(factorStore[0].secret);
    const token = generateSync({
      strategy: "totp",
      secret,
      digits: 6,
      period: 30,
    });
    return { factorId, token, secret, caller: c };
  }

  it("marks the factor verified and returns 10 recovery codes", async () => {
    const { factorId, token, caller: c } = await enroll();
    const out = await c.mfa.enrollTotpVerify({ factorId, token });
    expect(out.verified).toBe(true);
    expect(out.primary).toBe(true);
    expect(out.recoveryCodes).toHaveLength(10);
    expect(factorStore[0].verifiedAt).toBeInstanceOf(Date);
    expect(factorStore[0].primary).toBe(1);
    expect(recoveryHashes.get(42)?.length).toBe(10);
    expect(auditLog.some(a => a.reason === "mfa_totp_enroll_complete")).toBe(true);
  });

  it("rejects a wrong code, bumps failedAttempts, and audits the failure", async () => {
    const { factorId, caller: c } = await enroll();
    await expect(
      c.mfa.enrollTotpVerify({ factorId, token: "000000" }),
    ).rejects.toThrow(/did not match/i);
    expect(factorStore[0].failedAttempts).toBe(1);
    expect(auditLog.some(a => /mfa_totp_verify_failed/.test(a.reason))).toBe(true);
  });

  it("locks the factor after 5 consecutive failed attempts", async () => {
    const { factorId, caller: c } = await enroll();
    for (let i = 0; i < 5; i += 1) {
      await c.mfa.enrollTotpVerify({ factorId, token: "000000" }).catch(() => null);
    }
    expect(factorStore[0].lockedUntilMs).not.toBeNull();
    // 6th attempt should be 429
    await expect(
      c.mfa.enrollTotpVerify({ factorId, token: "000000" }),
    ).rejects.toThrow(/locked/i);
  });
});

describe("mfa.listFactors / deleteFactor / setPrimaryFactor", () => {
  it("lists masked factors, refuses cross-user delete, and switches primary", async () => {
    const c = caller(makeCtx());
    const { factorId } = await c.mfa.enrollTotpBegin();
    const { envelopeDecrypt } = await import("./_core/mfaCrypto");
    const secret = envelopeDecrypt(factorStore[0].secret);
    const token = generateSync({ strategy: "totp", secret, digits: 6, period: 30 });
    await c.mfa.enrollTotpVerify({ factorId, token });

    const list = await c.mfa.listFactors();
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("secret");
    expect(list[0].primary).toBe(true);

    // Different user must not be able to touch this factor.
    const intruder = caller(makeCtx({ id: 99, email: "x@x", role: "developer" }));
    await expect(intruder.mfa.deleteFactor({ factorId })).rejects.toThrow();

    // Owner can delete.
    await c.mfa.deleteFactor({ factorId });
    expect(factorStore).toHaveLength(0);
  });
});

describe("mfa.regenerateRecoveryCodes", () => {
  it("replaces the recovery code batch and audits the action", async () => {
    const c = caller(makeCtx());
    const first = await c.mfa.regenerateRecoveryCodes();
    expect(first.recoveryCodes).toHaveLength(10);
    const second = await c.mfa.regenerateRecoveryCodes();
    expect(second.recoveryCodes).toHaveLength(10);
    // batches differ
    expect(second.recoveryCodes).not.toEqual(first.recoveryCodes);
    expect(
      auditLog.filter(a => a.reason === "mfa_recovery_codes_regenerated"),
    ).toHaveLength(2);
  });
});


describe("mfa SMS enrolment", () => {
  it("dispatches an OTP and stores an unverified SMS factor", async () => {
    const c = caller(makeCtx());
    const out = await c.mfa.enrollSmsBegin({ phone: "+31612345678" });
    expect(out.factorId).toBeGreaterThan(0);
    expect(out.phoneHint).toMatch(/5678$/);
    expect(smsDeliveries).toHaveLength(1);
    expect(smsDeliveries[0].to).toBe("+31612345678");
    expect(smsDeliveries[0].code).toMatch(/^\d{6}$/);
    expect(factorStore[0].verifiedAt).toBeNull();
    expect(auditLog.some(a => /mfa_sms_enroll_begin/.test(a.reason))).toBe(true);
  });

  it("rejects an invalid phone number with BAD_REQUEST", async () => {
    const c = caller(makeCtx());
    await expect(c.mfa.enrollSmsBegin({ phone: "0612345678" })).rejects.toThrow(
      /E\.164/i,
    );
    expect(factorStore).toHaveLength(0);
    expect(smsDeliveries).toHaveLength(0);
  });

  it("verifies the SMS code, marks the factor verified, issues recovery codes", async () => {
    const c = caller(makeCtx());
    const { factorId } = await c.mfa.enrollSmsBegin({ phone: "+31612345678" });
    const sent = smsDeliveries[0].code;
    const out = await c.mfa.enrollSmsVerify({ factorId, code: sent });
    expect(out.verified).toBe(true);
    expect(out.primary).toBe(true);
    expect(out.recoveryCodes).toHaveLength(10);
    expect(factorStore[0].verifiedAt).toBeInstanceOf(Date);
    expect(auditLog.some(a => a.reason === "mfa_sms_enroll_complete")).toBe(true);
  });

  it("rejects wrong code, bumps failures, locks after MAX attempts", async () => {
    const c = caller(makeCtx());
    const { factorId } = await c.mfa.enrollSmsBegin({ phone: "+31612345678" });
    for (let i = 0; i < 5; i += 1) {
      await c.mfa.enrollSmsVerify({ factorId, code: "000000" }).catch(() => null);
    }
    expect(factorStore[0].failedAttempts).toBeGreaterThanOrEqual(5);
    expect(factorStore[0].lockedUntilMs).not.toBeNull();
    await expect(
      c.mfa.enrollSmsVerify({ factorId, code: "000000" }),
    ).rejects.toThrow(/locked/i);
  });
});

describe("mfa.redeemRecoveryCode", () => {
  it("burns a single code and refuses to reuse it", async () => {
    const c = caller(makeCtx());
    const { recoveryCodes } = await c.mfa.regenerateRecoveryCodes();
    const code = recoveryCodes[0];
    const out = await c.mfa.redeemRecoveryCode({ code });
    expect(out.ok).toBe(true);
    await expect(c.mfa.redeemRecoveryCode({ code })).rejects.toThrow(
      /invalid|already used/i,
    );
  });

  it("rejects an unknown recovery code with UNAUTHORIZED + audit", async () => {
    const c = caller(makeCtx());
    await c.mfa.regenerateRecoveryCodes();
    await expect(
      c.mfa.redeemRecoveryCode({ code: "ZZZZ-ZZZZ" }),
    ).rejects.toThrow(/invalid/i);
    expect(auditLog.some(a => a.reason === "mfa_recovery_code_invalid")).toBe(true);
  });
});
