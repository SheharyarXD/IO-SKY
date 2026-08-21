/*
 * IO SKY — Admin Portal · closes the "New ticket" admin.action dead-button
 * stub — an admin opening a support ticket on a client's behalf.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { appendLoginAuditMock, createClientSupportTicketMock } = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  createClientSupportTicketMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendLoginAudit: appendLoginAuditMock,
    createClientSupportTicket: createClientSupportTicketMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 12): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "support-tester@example.com",
    name: "Support Tester",
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

describe("admin.createSupportTicket", () => {
  it("creates a ticket with a generated publicRef and audits it", async () => {
    createClientSupportTicketMock.mockResolvedValueOnce({ publicRef: "T-TEST" });
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.createSupportTicket({
      organizationId: 7,
      subject: "Called about billing",
      body: "Client called to ask about invoice INV-001.",
    });
    expect(r).toMatchObject({ publicRef: "T-TEST" });
    expect(createClientSupportTicketMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 7,
        openedByUserId: null,
        subject: "Called about billing",
        publicRef: expect.stringMatching(/T/),
      }),
    );
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.support.create_ticket(") }),
    );
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(
      caller.admin.createSupportTicket({ organizationId: 7, subject: "X", body: "Y" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("surfaces INTERNAL_SERVER_ERROR when the insert fails", async () => {
    createClientSupportTicketMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.createSupportTicket({ organizationId: 7, subject: "X", body: "Y" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
