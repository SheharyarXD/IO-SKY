/*
 * IO SKY — Admin Portal · Milestone 2 §2.6 integration/webhook registry
 * router endpoints. Locks in: registrations are super_admin-exclusive for
 * BOTH read and write (unlike workflow definitions — a registration holds
 * a signing secret, so unlike workflow definitions this isn't
 * plain-admin-readable), deliveries are admin-readable, URL validation
 * (https-only), and NOT_FOUND for an unknown registration.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  appendLoginAuditMock,
  listWebhookRegistrationsMock,
  listWebhookDeliveriesMock,
  createWebhookRegistrationMock,
  setWebhookRegistrationEnabledMock,
} = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  listWebhookRegistrationsMock: vi.fn(async () => [] as any[]),
  listWebhookDeliveriesMock: vi.fn(async () => [] as any[]),
  createWebhookRegistrationMock: vi.fn(),
  setWebhookRegistrationEnabledMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
    appendLoginAudit: appendLoginAuditMock,
    listWebhookRegistrations: listWebhookRegistrationsMock,
    listWebhookDeliveries: listWebhookDeliveriesMock,
    createWebhookRegistration: createWebhookRegistrationMock,
    setWebhookRegistrationEnabled: setWebhookRegistrationEnabledMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 3): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "webhook-tester@example.com",
    name: "Webhook Tester",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: AuthenticatedUser["role"] | null, id = 3): TrpcContext {
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

describe("admin.webhookRegistrations (read)", () => {
  it("rejects plain admin - registrations carry a signing secret", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.admin.webhookRegistrations()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows super_admin", async () => {
    listWebhookRegistrationsMock.mockResolvedValueOnce([{ id: 1, name: "X" }]);
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    const r = await caller.admin.webhookRegistrations();
    expect(r).toHaveLength(1);
  });
});

describe("admin.webhookDeliveries (read)", () => {
  it("allows plain admin", async () => {
    listWebhookDeliveriesMock.mockResolvedValueOnce([{ id: 1 }]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.webhookDeliveries();
    expect(r).toHaveLength(1);
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(caller.admin.webhookDeliveries()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("admin.createWebhookRegistration", () => {
  it("rejects plain admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.createWebhookRegistration({ name: "X", url: "https://example.com/hook", triggerType: "document_approved" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createWebhookRegistrationMock).not.toHaveBeenCalled();
  });

  it("rejects a non-https URL", async () => {
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(
      caller.admin.createWebhookRegistration({ name: "X", url: "http://example.com/hook", triggerType: "document_approved" }),
    ).rejects.toThrow();
    expect(createWebhookRegistrationMock).not.toHaveBeenCalled();
  });

  it("allows super_admin, persists, and audits", async () => {
    createWebhookRegistrationMock.mockResolvedValueOnce({ id: 9, name: "X" });
    const caller = appRouter.createCaller(makeCtx("super_admin", 3));
    const r = await caller.admin.createWebhookRegistration({
      name: "X",
      url: "https://example.com/hook",
      secret: "supersecret1",
      triggerType: "document_approved",
    });
    expect(r).toMatchObject({ id: 9 });
    expect(createWebhookRegistrationMock).toHaveBeenCalledWith({
      name: "X",
      url: "https://example.com/hook",
      secret: "supersecret1",
      triggerType: "document_approved",
      createdByUserId: 3,
    });
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.webhook.create(9)") }),
    );
  });
});

describe("admin.setWebhookRegistrationEnabled", () => {
  it("surfaces NOT_FOUND for an unknown id", async () => {
    setWebhookRegistrationEnabledMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    await expect(
      caller.admin.setWebhookRegistrationEnabled({ id: 999, enabled: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
