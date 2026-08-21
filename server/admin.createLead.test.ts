/*
 * IO SKY — Admin Portal · closes the "New lead" admin.action dead-button
 * stub with a real, tested mutation. Uses source: "manual", one of the
 * values the leads schema's own doc comment already anticipated.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { appendLoginAuditMock, createLeadMock } = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  createLeadMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendLoginAudit: appendLoginAuditMock,
    createLead: createLeadMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 9): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "crm-tester@example.com",
    name: "CRM Tester",
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

describe("admin.createLead", () => {
  it("creates a lead with source: manual and audits it", async () => {
    createLeadMock.mockResolvedValueOnce({ id: 42, fullName: "Jane Doe" });
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.createLead({ fullName: "Jane Doe", email: "jane@example.com" });
    expect(r).toMatchObject({ id: 42 });
    expect(createLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "manual", fullName: "Jane Doe", email: "jane@example.com" }),
    );
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.lead.create(42)") }),
    );
  });

  it("rejects an invalid email via zod", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.createLead({ fullName: "X", email: "not-an-email" }),
    ).rejects.toThrow();
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(
      caller.admin.createLead({ fullName: "X", email: "x@example.com" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("surfaces INTERNAL_SERVER_ERROR when the insert fails", async () => {
    createLeadMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.createLead({ fullName: "X", email: "x@example.com" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
