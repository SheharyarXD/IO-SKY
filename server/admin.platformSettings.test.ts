/*
 * IO SKY — Admin Portal · Milestone 2 §2.5 platform configuration store.
 * admin.settings was a hardcoded literal list (`source: "static"`);
 * admin.updateSetting is new. Locks in: real data flowing through
 * (via listPlatformSettings), super_admin-exclusive write gating (RM-57's
 * decision names "platform & integration configuration" as super_admin-
 * only), and NOT_FOUND for an unknown key.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { appendLoginAuditMock, listPlatformSettingsMock, updatePlatformSettingMock } = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  listPlatformSettingsMock: vi.fn(async () => [] as any[]),
  updatePlatformSettingMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
    appendLoginAudit: appendLoginAuditMock,
    listPlatformSettings: listPlatformSettingsMock,
    updatePlatformSetting: updatePlatformSettingMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 22): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "settings-tester@example.com",
    name: "Settings Tester",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: AuthenticatedUser["role"] | null, id = 22): TrpcContext {
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
});

describe("admin.settings", () => {
  it("returns real rows from the platform_settings store", async () => {
    listPlatformSettingsMock.mockResolvedValueOnce([
      { key: "branding.summary", title: "Branding", description: "Logo etc.", value: "Configured" },
    ]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.settings();
    expect(r.sections).toEqual([
      { key: "branding.summary", title: "Branding", desc: "Logo etc.", state: "Configured" },
    ]);
    expect(r.source).toBe("db");
  });

  it("reports source: unavailable when the store is empty (DB offline)", async () => {
    listPlatformSettingsMock.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.settings();
    expect(r).toEqual({ sections: [], generatedAtMs: expect.any(Number), source: "unavailable" });
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(caller.admin.settings()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("admin.updateSetting", () => {
  it("rejects plain admin - platform configuration is super_admin-exclusive (RM-57)", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.updateSetting({ key: "branding.summary", value: "New value" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updatePlatformSettingMock).not.toHaveBeenCalled();
  });

  it("allows super_admin, persists, and audits", async () => {
    updatePlatformSettingMock.mockResolvedValueOnce({ key: "branding.summary", value: "New value" });
    const caller = appRouter.createCaller(makeCtx("super_admin", 5));
    const r = await caller.admin.updateSetting({ key: "branding.summary", value: "New value" });
    expect(r).toMatchObject({ key: "branding.summary", value: "New value" });
    expect(updatePlatformSettingMock).toHaveBeenCalledWith("branding.summary", { value: "New value" }, 5);
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.settings.update(branding.summary)") }),
    );
  });

  it("surfaces NOT_FOUND for an unknown key", async () => {
    updatePlatformSettingMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(
      caller.admin.updateSetting({ key: "does.not.exist", value: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
