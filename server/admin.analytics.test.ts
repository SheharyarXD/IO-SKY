/*
 * IO SKY — Admin Portal · Milestone 2 §2.5 Business Intelligence dashboards.
 * `admin.analytics` previously returned a hardcoded funnel
 * (412/367/318/187/134) and "top scans by revenue" with fabricated EUR
 * figures, neither backed by any table. Locks in the honest "database
 * unavailable" fallback shape (empty funnel/topScans, not fake seed
 * numbers) and that the endpoint stays admin-gated.
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

function makeUser(role: AuthenticatedUser["role"], id = 11): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "analytics-tester@example.com",
    name: "Analytics Tester",
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

describe("admin.analytics (Business Intelligence)", () => {
  it("returns an honest empty shape (not fabricated seed numbers) when the database is offline", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.analytics();
    expect(r).toEqual({
      funnel: [],
      topScans: [],
      leads30d: 0,
      leadsDelta: 0,
      bookings30d: 0,
      aiScans30d: 0,
      wonDeals30d: 0,
      generatedAtMs: expect.any(Number),
      source: "unavailable",
    });
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(caller.admin.analytics()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows super_admin too (isAdminRole)", async () => {
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(caller.admin.analytics()).resolves.toMatchObject({ source: "unavailable" });
  });
});
