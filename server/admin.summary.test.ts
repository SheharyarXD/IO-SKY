/*
 * IO SKY — Admin Portal · admin.summary tests.
 *
 * Verifies:
 *   - RBAC: non-admin callers receive FORBIDDEN.
 *   - Unauthenticated callers receive UNAUTHORIZED.
 *   - Admin callers receive a well-formed AdminSummary payload that the
 *     Executive Overview UI depends on, even when the database is offline.
 *   - Every successful call writes a `summary` audit row.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { appendLoginAuditMock, listRecentBookingsMock, getDbMock } = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  listRecentBookingsMock: vi.fn(async () => [] as any[]),
  getDbMock: vi.fn(async () => null),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendLoginAudit: appendLoginAuditMock,
    listRecentBookings: listRecentBookingsMock,
    getDb: getDbMock,
  };
});

// We import the router only after the mocks are wired so the module sees
// the mocked db helpers.
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
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

beforeEach(() => {
  appendLoginAuditMock.mockClear();
  listRecentBookingsMock.mockClear();
  getDbMock.mockClear();
});

describe("admin.summary RBAC", () => {
  it("rejects unauthenticated callers", async () => {
    // adminProcedure short-circuits any non-admin (including null) caller
    // with FORBIDDEN before we get a chance to write an audit row.
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.admin.summary()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(appendLoginAuditMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin authenticated callers", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.admin.summary()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows admin callers and writes an audit row", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.admin.summary();

    // Audit row was written, with the right action label and metadata.
    expect(appendLoginAuditMock).toHaveBeenCalledTimes(1);
    const audit = appendLoginAuditMock.mock.calls[0]![0]!;
    expect(audit.outcome).toBe("success");
    expect(audit.reason).toBe("admin.summary");
    expect(audit.provider).toBe("admin");
    expect(audit.userId).toBe(99);
    expect(audit.userAgent).toBe("vitest");
    expect(audit.ip).toBe("127.0.0.1");

    // Payload shape powering the Executive Overview UI.
    expect(result.kpis).toMatchObject({
      revenueMTD: expect.any(Number),
      revenueDelta: expect.any(Number),
      activeClients: expect.any(Number),
      aiScans: expect.any(Number),
      openProjects: expect.any(Number),
      openTickets: expect.any(Number),
      compareLabel: expect.any(String),
    });
    expect(Array.isArray(result.recentActivity)).toBe(true);
    expect(Array.isArray(result.liveFeed)).toBe(true);
    expect(result.generatedAtMs).toBeGreaterThan(0);
  });
});

describe("admin.summary when DB is offline", () => {
  it("reports honest zeros/empty arrays, never fabricated positive numbers", async () => {
    // Was: this test asserted a hardcoded "seed defaults" shape
    // (revenueMTD 127430, activeClients 62, etc) was the *expected,
    // correct* behavior when the database is unreachable - i.e. it
    // encoded the fabrication bug as a passing test. A real "no data yet"
    // state must be indistinguishable from a real "genuinely zero
    // activity" state, and both must render as 0, not a fake positive
    // number dressed up as a believable KPI.
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.summary();
    expect(r.kpis.revenueMTD).toBe(0);
    expect(r.kpis.activeClients).toBe(0);
    expect(r.kpis.aiScans).toBe(0);
    expect(r.kpis.openProjects).toBe(0);
    expect(r.kpis.openTickets).toBe(0);
    expect(r.kpis.revenueDelta).toBe(0);
    expect(r.kpis.activeClientsDelta).toBe(0);
    expect(r.kpis.openProjectsDelta).toBe(0);
    expect(r.kpis.openTicketsDelta).toBe(0);
    expect(r.recentActivity).toEqual([]);
    expect(r.liveFeed).toEqual([]);
  });
});

describe("admin.liveFeed", () => {
  it("requires admin and emits a separate audit row", async () => {
    await expect(
      appRouter.createCaller(makeCtx("user")).admin.liveFeed(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    appendLoginAuditMock.mockClear();
    const r = await appRouter.createCaller(makeCtx("admin")).admin.liveFeed();
    expect(Array.isArray(r)).toBe(true);
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "admin.live_feed" }),
    );
  });
});

describe("admin.recentLoginAudit", () => {
  it("returns [] safely when the database is offline and audits the read", async () => {
    const r = await appRouter
      .createCaller(makeCtx("admin"))
      .admin.recentLoginAudit();
    expect(r).toEqual([]);
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "admin.recent_login_audit" }),
    );
  });
});
