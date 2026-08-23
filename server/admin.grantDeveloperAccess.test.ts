/*
 * IO SKY — Admin Portal · closes the Developer Management "Grant access"
 * admin.action dead-button stub with a real, tested mutation. Before this,
 * only a self-service *request* path existed (developer.
 * createDeveloperAccessRequest) — no admin-initiated grant flow anywhere.
 * Inserts into the existing `developer_access_scopes` table, no new schema.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  appendLoginAuditMock,
  getDeveloperProfileByIdMock,
  createDeveloperAccessScopeMock,
} = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  getDeveloperProfileByIdMock: vi.fn(),
  createDeveloperAccessScopeMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
    appendLoginAudit: appendLoginAuditMock,
    getDeveloperProfileById: getDeveloperProfileByIdMock,
    createDeveloperAccessScope: createDeveloperAccessScopeMock,
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
  vi.clearAllMocks();
});

describe("admin.grantDeveloperAccess", () => {
  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(
      caller.admin.grantDeveloperAccess({ developerId: 1, level: "baseline" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createDeveloperAccessScopeMock).not.toHaveBeenCalled();
  });

  it("404s for an unknown developer without ever calling createDeveloperAccessScope", async () => {
    getDeveloperProfileByIdMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.grantDeveloperAccess({ developerId: 999, level: "baseline" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createDeveloperAccessScopeMock).not.toHaveBeenCalled();
  });

  it("grants access with an expiry and audits it", async () => {
    getDeveloperProfileByIdMock.mockResolvedValueOnce({ id: 5, fullName: "Alex Engineer" });
    createDeveloperAccessScopeMock.mockResolvedValueOnce({
      id: 1,
      developerId: 5,
      level: "extended",
      status: "active",
    });
    const before = Date.now();
    const caller = appRouter.createCaller(makeCtx("admin"));
    const out = await caller.admin.grantDeveloperAccess({
      developerId: 5,
      level: "extended",
      expiresInDays: 30,
    });
    expect(out).toMatchObject({ id: 1, developerId: 5, level: "extended" });
    expect(createDeveloperAccessScopeMock).toHaveBeenCalledTimes(1);
    const call = createDeveloperAccessScopeMock.mock.calls[0][0];
    expect(call.developerId).toBe(5);
    expect(call.level).toBe("extended");
    expect(call.createdByUserId).toBe(99);
    expect(call.expiresMs).toBeGreaterThan(before + 29 * 24 * 60 * 60 * 1000);
    expect(call.expiresMs).toBeLessThan(before + 31 * 24 * 60 * 60 * 1000);
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.developer.grant_access(5:extended)") }),
    );
  });

  it("grants access with no expiry when expiresInDays is omitted", async () => {
    getDeveloperProfileByIdMock.mockResolvedValueOnce({ id: 6, fullName: "Sam Coder" });
    createDeveloperAccessScopeMock.mockResolvedValueOnce({ id: 2, developerId: 6, level: "baseline" });
    const caller = appRouter.createCaller(makeCtx("admin"));
    await caller.admin.grantDeveloperAccess({ developerId: 6, level: "baseline" });
    expect(createDeveloperAccessScopeMock).toHaveBeenCalledWith(
      expect.objectContaining({ expiresMs: null }),
    );
  });

  it("surfaces INTERNAL_SERVER_ERROR when the insert fails", async () => {
    getDeveloperProfileByIdMock.mockResolvedValueOnce({ id: 7, fullName: "Jo Dev" });
    createDeveloperAccessScopeMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.grantDeveloperAccess({ developerId: 7, level: "elevated" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("rejects an invalid access level via zod", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.grantDeveloperAccess({ developerId: 1, level: "superuser" as any }),
    ).rejects.toThrow();
    expect(createDeveloperAccessScopeMock).not.toHaveBeenCalled();
  });
});
