/*
 * IO SKY — Technical Operator / ops router (Milestone 2 §2.5).
 *
 * Locks in the core promise of the new "technical_operator" RBAC tier:
 * a technical_operator can reach every ops.* endpoint, a plain "client"/
 * "developer" cannot, and — critically — a technical_operator still
 * cannot reach adminProcedure-gated endpoints (leads/invoices/reports/
 * documents), because opsProcedure and adminProcedure are deliberately
 * separate gates, not a hierarchy. Also covers the honest "db
 * unavailable" fallback shape for systemHealth and the Security Center
 * acknowledge-event workflow.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  appendLoginAuditMock,
  getDbMock,
  listEmailDeliveryLogMock,
  listRecentSecurityEventsMock,
  acknowledgeDeveloperSecurityEventMock,
} = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  getDbMock: vi.fn(async () => null),
  listEmailDeliveryLogMock: vi.fn(async () => [] as any[]),
  listRecentSecurityEventsMock: vi.fn(async () => [] as any[]),
  acknowledgeDeveloperSecurityEventMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendLoginAudit: appendLoginAuditMock,
    getDb: getDbMock,
    listEmailDeliveryLog: listEmailDeliveryLogMock,
    listRecentSecurityEvents: listRecentSecurityEventsMock,
    acknowledgeDeveloperSecurityEvent: acknowledgeDeveloperSecurityEventMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 77): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "ops-tester@example.com",
    name: "Ops Tester",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: AuthenticatedUser["role"] | null, id = 77): TrpcContext {
  return {
    user: role ? makeUser(role, id) : null,
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

describe("ops RBAC gating (isOpsRole)", () => {
  it("allows technical_operator", async () => {
    const caller = appRouter.createCaller(makeCtx("technical_operator"));
    await expect(caller.ops.systemHealth()).resolves.toMatchObject({ source: "unavailable" });
  });

  it("allows admin (additive, not a replacement for adminProcedure elsewhere)", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.ops.systemHealth()).resolves.toMatchObject({ source: "unavailable" });
  });

  it("allows super_admin", async () => {
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(caller.ops.systemHealth()).resolves.toMatchObject({ source: "unavailable" });
  });

  it("rejects client", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(caller.ops.systemHealth()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects developer", async () => {
    const caller = appRouter.createCaller(makeCtx("developer"));
    await expect(caller.ops.systemHealth()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.ops.systemHealth()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("technical_operator is walled off from customer/financial admin endpoints", () => {
  it("cannot reach admin.billing", async () => {
    const caller = appRouter.createCaller(makeCtx("technical_operator"));
    await expect(caller.admin.billing()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cannot reach admin.documents", async () => {
    const caller = appRouter.createCaller(makeCtx("technical_operator"));
    await expect(caller.admin.documents()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cannot reach admin.crm (leads)", async () => {
    const caller = appRouter.createCaller(makeCtx("technical_operator"));
    await expect(caller.admin.crm()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cannot reach admin.reports", async () => {
    const caller = appRouter.createCaller(makeCtx("technical_operator"));
    await expect(caller.admin.reports()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("ops.systemHealth", () => {
  it("returns an honest empty/unavailable shape when the database is offline", async () => {
    const caller = appRouter.createCaller(makeCtx("technical_operator"));
    const r = await caller.ops.systemHealth();
    expect(r).toMatchObject({
      email: { sent24h: 0, delivered24h: 0, failed24h: 0 },
      failedLogins24h: 0,
      securityEvents24h: { info: 0, warn: 0, high: 0, critical: 0 },
      mfa: { totalUsers: 0, mfaEnrolled: 0, mfaEnrolledPct: 0 },
      source: "unavailable",
    });
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "ops.read.system_health", provider: "ops" }),
    );
  });
});

describe("ops.emailDeliveryLog / ops.securityEvents", () => {
  it("returns the email delivery log", async () => {
    listEmailDeliveryLogMock.mockResolvedValueOnce([{ id: 1, status: "sent" }]);
    const caller = appRouter.createCaller(makeCtx("technical_operator"));
    const r = await caller.ops.emailDeliveryLog();
    expect(r).toEqual([{ id: 1, status: "sent" }]);
  });

  it("returns recent security events", async () => {
    listRecentSecurityEventsMock.mockResolvedValueOnce([{ id: 9, kind: "failed_login" }]);
    const caller = appRouter.createCaller(makeCtx("technical_operator"));
    const r = await caller.ops.securityEvents();
    expect(r).toEqual([{ id: 9, kind: "failed_login" }]);
  });
});

describe("ops.acknowledgeSecurityEvent", () => {
  it("acknowledges an event and audits it", async () => {
    acknowledgeDeveloperSecurityEventMock.mockResolvedValueOnce({
      id: 9,
      acknowledgedAt: Date.now(),
      acknowledgedByUserId: 77,
    });
    const caller = appRouter.createCaller(makeCtx("technical_operator", 77));
    const r = await caller.ops.acknowledgeSecurityEvent({ eventId: 9 });
    expect(r).toMatchObject({ id: 9, acknowledgedByUserId: 77 });
    expect(acknowledgeDeveloperSecurityEventMock).toHaveBeenCalledWith(9, 77);
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("ops.acknowledge_security_event:9") }),
    );
  });

  it("surfaces NOT_FOUND for an unknown event id", async () => {
    acknowledgeDeveloperSecurityEventMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("technical_operator"));
    await expect(caller.ops.acknowledgeSecurityEvent({ eventId: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects non-ops callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(caller.ops.acknowledgeSecurityEvent({ eventId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(acknowledgeDeveloperSecurityEventMock).not.toHaveBeenCalled();
  });
});
