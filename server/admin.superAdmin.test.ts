/*
 * IO SKY — Admin Portal · Milestone 2 §2.5 Organization Management + role/
 * tenant assignment. Before this pass there was no way to create an
 * organization or link a user to one anywhere in the app (every existing
 * endpoint took an organizationId as *input*, assuming the row already
 * existed). Locks in: super_admin-exclusive gating (plain admin must be
 * rejected, matching RM-57's decision that these are super_admin-only
 * capabilities, not general admin ones), audit logging, and the
 * self-role-change safety guard.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  appendLoginAuditMock,
  listOrganizationsMock,
  createOrganizationMock,
  updateOrganizationMock,
  getOrganizationBySlugMock,
  setUserRoleMock,
  assignUserOrganizationMock,
  getUserByIdMock,
} = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  listOrganizationsMock: vi.fn(async () => []),
  createOrganizationMock: vi.fn(),
  updateOrganizationMock: vi.fn(),
  getOrganizationBySlugMock: vi.fn(async () => null),
  setUserRoleMock: vi.fn(),
  assignUserOrganizationMock: vi.fn(),
  getUserByIdMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendLoginAudit: appendLoginAuditMock,
    listOrganizations: listOrganizationsMock,
    createOrganization: createOrganizationMock,
    updateOrganization: updateOrganizationMock,
    getOrganizationBySlug: getOrganizationBySlugMock,
    setUserRole: setUserRoleMock,
    assignUserOrganization: assignUserOrganizationMock,
    getUserById: getUserByIdMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 99): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "ops@example.com",
    name: "Ops",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: AuthenticatedUser["role"] | null, id = 99): TrpcContext {
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

describe("admin.listOrganizations", () => {
  it("allows plain admin (read-only)", async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      { id: 1, slug: "acme", name: "Acme", memberCount: 3 },
    ]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.listOrganizations();
    expect(r).toHaveLength(1);
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "admin.org.list" }),
    );
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(caller.admin.listOrganizations()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("admin.createOrganization", () => {
  it("rejects plain admin - this is a super_admin-exclusive capability (RM-57)", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.createOrganization({ slug: "acme", name: "Acme Corp" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createOrganizationMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    // Matches adminProcedure's own convention (server/_core/trpc.ts):
    // superAdminProcedure doesn't distinguish "no session" from "wrong
    // role" - both are FORBIDDEN, not UNAUTHORIZED.
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.admin.createOrganization({ slug: "acme", name: "Acme Corp" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows super_admin, checks slug uniqueness first, and audits", async () => {
    getOrganizationBySlugMock.mockResolvedValueOnce(null);
    createOrganizationMock.mockResolvedValueOnce({ id: 5, slug: "acme", name: "Acme Corp" });
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    const r = await caller.admin.createOrganization({ slug: "acme", name: "Acme Corp" });
    expect(r).toMatchObject({ id: 5, slug: "acme" });
    expect(getOrganizationBySlugMock).toHaveBeenCalledWith("acme");
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.org.create") }),
    );
  });

  it("rejects a duplicate slug with CONFLICT before ever calling createOrganization", async () => {
    getOrganizationBySlugMock.mockResolvedValueOnce({ id: 1, slug: "acme", name: "Existing" });
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(
      caller.admin.createOrganization({ slug: "acme", name: "New Org" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(createOrganizationMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid slug shape via zod before touching the database", async () => {
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(
      caller.admin.createOrganization({ slug: "Not A Valid Slug!", name: "Acme" }),
    ).rejects.toThrow();
    expect(getOrganizationBySlugMock).not.toHaveBeenCalled();
  });
});

describe("admin.updateOrganization", () => {
  it("rejects plain admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.updateOrganization({ id: 1, name: "New Name" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows super_admin and audits", async () => {
    updateOrganizationMock.mockResolvedValueOnce({ id: 1, name: "New Name" });
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    const r = await caller.admin.updateOrganization({ id: 1, name: "New Name" });
    expect(r).toMatchObject({ id: 1, name: "New Name" });
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.org.update(1)") }),
    );
  });

  it("surfaces NOT_FOUND when the organization doesn't exist", async () => {
    updateOrganizationMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(
      caller.admin.updateOrganization({ id: 999, name: "X" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("admin.setUserRole", () => {
  it("rejects plain admin - role/permission management is super_admin-exclusive (RM-57)", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.setUserRole({ userId: 5, role: "developer" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(setUserRoleMock).not.toHaveBeenCalled();
  });

  it("refuses to let a super_admin change their own role", async () => {
    const caller = appRouter.createCaller(makeCtx("super_admin", 42));
    await expect(
      caller.admin.setUserRole({ userId: 42, role: "admin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(setUserRoleMock).not.toHaveBeenCalled();
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it("allows super_admin to change another user's role and audits the before/after", async () => {
    getUserByIdMock.mockResolvedValueOnce({ id: 5, role: "user" });
    setUserRoleMock.mockResolvedValueOnce({ id: 5, role: "developer" });
    const caller = appRouter.createCaller(makeCtx("super_admin", 42));
    const r = await caller.admin.setUserRole({ userId: 5, role: "developer" });
    expect(r).toEqual({ id: 5, role: "developer" });
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringContaining("admin.user.set_role(5: user -> developer)"),
      }),
    );
  });

  it("surfaces NOT_FOUND for an unknown user without calling setUserRole", async () => {
    getUserByIdMock.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(makeCtx("super_admin", 42));
    await expect(
      caller.admin.setUserRole({ userId: 999, role: "admin" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(setUserRoleMock).not.toHaveBeenCalled();
  });
});

describe("admin.assignUserOrganization", () => {
  it("rejects plain admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.assignUserOrganization({ userId: 5, organizationId: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows super_admin to link a user to an organization and audits it", async () => {
    getUserByIdMock.mockResolvedValueOnce({ id: 5, organizationId: null });
    assignUserOrganizationMock.mockResolvedValueOnce({ id: 5, organizationId: 1 });
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    const r = await caller.admin.assignUserOrganization({ userId: 5, organizationId: 1 });
    expect(r).toEqual({ id: 5, organizationId: 1 });
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringContaining("admin.user.assign_org(5: none -> 1)"),
      }),
    );
  });

  it("allows clearing a user's organization (organizationId: null)", async () => {
    getUserByIdMock.mockResolvedValueOnce({ id: 5, organizationId: 1 });
    assignUserOrganizationMock.mockResolvedValueOnce({ id: 5, organizationId: null });
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    const r = await caller.admin.assignUserOrganization({ userId: 5, organizationId: null });
    expect(r).toEqual({ id: 5, organizationId: null });
  });
});
