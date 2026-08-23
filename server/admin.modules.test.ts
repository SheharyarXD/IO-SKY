/*
 * IO SKY — Admin Portal · per-module RBAC & shape tests.
 *
 * For every sidebar module endpoint we assert:
 *   1. Anonymous callers receive FORBIDDEN.
 *   2. role === "user" callers receive FORBIDDEN.
 *   3. role === "admin" callers receive a payload that is an object or
 *      an array (matches the contract every module page consumes).
 *   4. The successful call writes a `login_audit` row with reason
 *      `admin.read.<module>`.
 *
 * Plus shape spot-checks for endpoints with stable schemas.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { appendLoginAuditMock, listRecentBookingsMock, getDbMock, listVerifiedMfaFactorsForUserMock } = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  listRecentBookingsMock: vi.fn(async () => [] as any[]),
  getDbMock: vi.fn(async () => null),
  listVerifiedMfaFactorsForUserMock: vi.fn(async () => [
    { id: 1, userId: 99, kind: "totp", verifiedAt: new Date() },
  ]),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: listVerifiedMfaFactorsForUserMock,
    appendLoginAudit: appendLoginAuditMock,
    listRecentBookings: listRecentBookingsMock,
    getDb: getDbMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    id: 99,
    openId: "test-admin",
    email: "ops@example.com",
    name: "Ops Admin",
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
  appendLoginAuditMock.mockClear();
  listRecentBookingsMock.mockClear();
  getDbMock.mockClear();
  listVerifiedMfaFactorsForUserMock.mockClear();
  listVerifiedMfaFactorsForUserMock.mockResolvedValue([
    { id: 1, userId: 99, kind: "totp", verifiedAt: new Date() },
  ]);
});

const MODULES = [
  "crm",
  "clients",
  "aiScans",
  "reports",
  "projects",
  "billing",
  "documents",
  "developers",
  "security",
  "campaigns",
  "agents",
  "automations",
  "analytics",
  "users",
  "audit",
  "settings",
  "support",
  "mfaPosture",
] as const;

const READ_REASON: Record<(typeof MODULES)[number], string> = {
  crm: "admin.read.crm",
  clients: "admin.read.clients",
  aiScans: "admin.read.ai_scans",
  reports: "admin.read.reports",
  projects: "admin.read.projects",
  billing: "admin.read.billing",
  documents: "admin.read.documents",
  developers: "admin.read.developers",
  security: "admin.read.security",
  campaigns: "admin.read.campaigns",
  agents: "admin.read.agents",
  automations: "admin.read.automations",
  analytics: "admin.read.analytics",
  users: "admin.read.users",
  audit: "admin.read.audit",
  settings: "admin.read.settings",
  support: "admin.read.support",
  mfaPosture: "admin.read.mfa_posture",
};

describe("admin module RBAC", () => {
  for (const m of MODULES) {
    it(`admin.${m} forbids unauthenticated`, async () => {
      await expect(
        (appRouter.createCaller(makeCtx(null)).admin as any)[m](),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it(`admin.${m} forbids role="user"`, async () => {
      await expect(
        (appRouter.createCaller(makeCtx("user")).admin as any)[m](),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it(`admin.${m} allows role="admin" and writes the read audit row`, async () => {
      const result = await (
        appRouter.createCaller(makeCtx("admin")).admin as any
      )[m]();
      expect(result == null).toBe(false);
      expect(typeof result === "object").toBe(true);

      const reasons = appendLoginAuditMock.mock.calls.map((c: any) => c[0]?.reason);
      expect(reasons).toContain(READ_REASON[m]);
    });
  }
});

describe("admin.action audited stub", () => {
  it("forbids unauthenticated callers", async () => {
    await expect(
      appRouter
        .createCaller(makeCtx(null))
        .admin.action({ module: "crm", action: "lead.export" } as any),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("forbids role='user'", async () => {
    await expect(
      appRouter
        .createCaller(makeCtx("user"))
        .admin.action({ module: "crm", action: "lead.export" } as any),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("succeeds for admin and records an audit row keyed by module + action", async () => {
    const r = await appRouter
      .createCaller(makeCtx("admin"))
      .admin.action({
        module: "crm",
        action: "lead.export",
        meta: { count: 12 },
      } as any);
    expect(r.ok).toBe(true);
    const audited = appendLoginAuditMock.mock.calls.find((c: any) =>
      typeof c[0]?.reason === "string" && c[0].reason.startsWith("admin.action.crm.lead.export"),
    );
    expect(audited).toBeTruthy();
  });
});

describe("admin.viewAs", () => {
  it("forbids non-admin", async () => {
    await expect(
      appRouter
        .createCaller(makeCtx("user"))
        .admin.viewAs({ target: "client", reason: "QA preview" } as any),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin gets a redirect path and audit row", async () => {
    const r = await appRouter
      .createCaller(makeCtx("admin"))
      .admin.viewAs({ target: "developer", reason: "Investigating ticket #4421" } as any);
    expect(r.ok).toBe(true);
    expect(r.target).toBe("developer");
    expect(r.redirect).toBe("/developer-workspace");
    const audited = appendLoginAuditMock.mock.calls.some((c: any) =>
      typeof c[0]?.reason === "string" && c[0].reason.startsWith("admin.view_as.developer"),
    );
    expect(audited).toBe(true);
  });
});

describe("Milestone 2 §2.5 — hard MFA gate (adminProcedure)", () => {
  it("blocks admin/super_admin with no verified MFA factor from every admin.* endpoint", async () => {
    listVerifiedMfaFactorsForUserMock.mockResolvedValue([]);
    for (const role of ["admin", "super_admin"] as const) {
      const caller = appRouter.createCaller(makeCtx(role));
      await expect(caller.admin.summary()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "privileged_gate:mfa_required",
      });
    }
  });

  it("does not block client/developer roles with the MFA message (they never reach adminProcedure at all)", async () => {
    listVerifiedMfaFactorsForUserMock.mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.admin.summary()).rejects.not.toMatchObject({
      message: "privileged_gate:mfa_required",
    });
  });

  it("admin.gateStatus reports mfa_required without throwing", async () => {
    listVerifiedMfaFactorsForUserMock.mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.admin.gateStatus()).resolves.toEqual({
      ok: false,
      reason: "mfa_required",
    });
  });

  it("admin.gateStatus reports ok once a verified factor exists", async () => {
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(caller.admin.gateStatus()).resolves.toEqual({ ok: true });
  });

  it("admin.gateStatus reports denied for a non-admin role, never mfa_required", async () => {
    listVerifiedMfaFactorsForUserMock.mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.admin.gateStatus()).resolves.toEqual({ ok: false, reason: "denied" });
  });

  it("an unverified pending factor (verifiedAt still null) does not satisfy the gate", async () => {
    // listVerifiedMfaFactorsForUser only ever returns verified rows by
    // contract (server/db/mfa.ts) — an empty result here IS the "user has
    // a pending, unverified factor" case from the gate's point of view.
    listVerifiedMfaFactorsForUserMock.mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.admin.summary()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "privileged_gate:mfa_required",
    });
  });
});
