/*
 * IO SKY — Admin Portal · Milestone 2 §2.5 "broader MFA-enforcement
 * surfacing". admin.mfaPosture existed but was never consumed by any
 * client component; now backs a real per-role MFA compliance panel on
 * Security Monitoring. Locks in the honest offline-fallback shape
 * (including the new `byRole` array) and admin-only gating.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { appendLoginAuditMock, getDbMock } = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  getDbMock: vi.fn(async () => null),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendLoginAudit: appendLoginAuditMock,
    getDb: getDbMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 33): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "mfa-tester@example.com",
    name: "MFA Tester",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: AuthenticatedUser["role"] | null): TrpcContext {
  return {
    user: role ? makeUser(role) : null,
    impersonation: null,
    req: {
      protocol: "https",
      headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDbMock.mockResolvedValue(null);
});

describe("admin.mfaPosture", () => {
  it("returns an honest empty shape (including byRole: []) when the database is offline", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.mfaPosture();
    expect(r).toEqual({
      totalUsers: 0,
      mfaEnrolled: 0,
      mfaEnrolledPct: 0,
      byRole: [],
      source: "unavailable",
    });
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("developer"));
    await expect(caller.admin.mfaPosture()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
