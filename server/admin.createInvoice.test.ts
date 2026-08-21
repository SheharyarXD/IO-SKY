/*
 * IO SKY — Admin Portal · closes the "New invoice" admin.action
 * dead-button stub with a real, tested mutation.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { appendLoginAuditMock, createClientInvoiceMock } = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  createClientInvoiceMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendLoginAudit: appendLoginAuditMock,
    createClientInvoice: createClientInvoiceMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 6): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "billing-tester@example.com",
    name: "Billing Tester",
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

describe("admin.createInvoice", () => {
  it("creates an invoice and audits it", async () => {
    createClientInvoiceMock.mockResolvedValueOnce({ id: 5, number: "INV-TEST" });
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.createInvoice({
      organizationId: 7,
      description: "Q3 consulting",
      amountCents: 150000,
    });
    expect(r).toMatchObject({ id: 5 });
    expect(createClientInvoiceMock).toHaveBeenCalledWith({
      organizationId: 7,
      description: "Q3 consulting",
      amountCents: 150000,
    });
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.invoice.create(org=7)") }),
    );
  });

  it("rejects a non-positive amount via zod", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.createInvoice({ organizationId: 7, description: "X", amountCents: 0 }),
    ).rejects.toThrow();
    expect(createClientInvoiceMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(
      caller.admin.createInvoice({ organizationId: 7, description: "X", amountCents: 100 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("surfaces INTERNAL_SERVER_ERROR when the insert fails", async () => {
    createClientInvoiceMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.createInvoice({ organizationId: 7, description: "X", amountCents: 100 }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
