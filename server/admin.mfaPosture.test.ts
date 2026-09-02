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
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
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

  /*
   * Milestone 3 §3.4 (RM-109): the two tests above covered the offline shape
   * and one rejected role. This endpoint reports platform-wide MFA compliance
   * — i.e. precisely which accounts are unprotected — so the full role matrix
   * is worth pinning rather than sampling. Added when the RM-109 coverage
   * manifest flagged this as the thinnest of the converted-workflow suites.
   */
  it.each(["client", "developer", "user", "technical_operator"] as const)(
    "rejects role %s",
    async (role) => {
      const caller = appRouter.createCaller(makeCtx(role as AuthenticatedUser["role"]));
      await expect(caller.admin.mfaPosture()).rejects.toMatchObject({ code: "FORBIDDEN" });
    },
  );

  it("rejects an unauthenticated caller", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.admin.mfaPosture()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows super_admin as well as admin", async () => {
    // isAdminRole() accepts both; a regression narrowing it to "admin" alone
    // would lock super admins out of the security-monitoring panel with no
    // test noticing.
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    const r = await caller.admin.mfaPosture();
    expect(r.source).toBe("unavailable");
    expect(r.byRole).toEqual([]);
  });

  it("never reports an out-of-range enrolment percentage", async () => {
    // The panel renders this straight into a progress bar.
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.mfaPosture();
    expect(r.mfaEnrolledPct).toBeGreaterThanOrEqual(0);
    expect(r.mfaEnrolledPct).toBeLessThanOrEqual(100);
  });
});
