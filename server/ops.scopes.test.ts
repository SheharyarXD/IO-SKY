/*
 * P0-04 / Z09 (SRS 5.7, 13.8, GOV-06): every Technical Operator operation is
 * enforced against the operator's granted scopes at the backend. The role alone
 * opens nothing. These tests drive the real routers with a variable grant list
 * and check: no grant, wrong scope (escalation), expired, revoked, a failing
 * lookup, immediate effect of a revocation, and that admins are unaffected.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getScopeGrants: vi.fn(),
  getDb: vi.fn(async () => null),
  listVerified: vi.fn(async () => [{ id: 1, userId: 77, kind: "totp", verifiedAt: new Date() }]),
}));

vi.mock("./db/platformGovernance", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getScopeGrants: m.getScopeGrants };
});

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getDb: m.getDb,
    appendLoginAudit: vi.fn(async () => {}),
    listVerifiedMfaFactorsForUser: m.listVerified,
    listEmailDeliveryLog: vi.fn(async () => []),
    listRecentSecurityEvents: vi.fn(async () => []),
    acknowledgeDeveloperSecurityEvent: vi.fn(async () => ({ id: 1 })),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;

function ctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 77, openId: `t-${role}`, email: "ops@example.com", name: "Ops", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as U,
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const grant = (scope: string, extra: Partial<{ expiresAt: Date | null; revokedAt: Date | null }> = {}) => ({ scope, expiresAt: null, revokedAt: null, ...extra });
const past = new Date(Date.now() - 60_000);
const future = new Date(Date.now() + 3_600_000);

// Every operator-reachable operation: the caller, the scope that opens it, and one that must not.
const OPERATIONS: Array<{ name: string; scope: string; call: (c: ReturnType<typeof appRouter.createCaller>) => Promise<unknown> }> = [
  { name: "ops.systemHealth", scope: "infrastructure", call: (c) => c.ops.systemHealth() },
  { name: "ops.emailDeliveryLog", scope: "backend", call: (c) => c.ops.emailDeliveryLog() },
  { name: "ops.securityEvents", scope: "security", call: (c) => c.ops.securityEvents() },
  { name: "ops.acknowledgeSecurityEvent", scope: "security", call: (c) => c.ops.acknowledgeSecurityEvent({ eventId: 1 }) },
  { name: "adminOps.platformHealth", scope: "infrastructure", call: (c) => c.adminOps.platformHealth() },
  { name: "adminOps.deployments", scope: "infrastructure", call: (c) => c.adminOps.deployments() },
  { name: "adminOps.incidents", scope: "security", call: (c) => c.adminOps.incidents({}) },
  { name: "adminOps.alertRules", scope: "infrastructure", call: (c) => c.adminOps.alertRules() },
  { name: "adminOps.compliance", scope: "security", call: (c) => c.adminOps.compliance() },
];

/** The scope check refuses with this wording; any other outcome means the gate let the call through. */
const SCOPE_REFUSAL = /technical scope|could not be verified/i;
async function outcome(p: Promise<unknown>) {
  try {
    await p;
    return { refused: false as const };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { refused: err.code === "FORBIDDEN" && SCOPE_REFUSAL.test(err.message ?? ""), code: err.code, message: err.message };
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getDb.mockResolvedValue(null);
  m.listVerified.mockResolvedValue([{ id: 1, userId: 77, kind: "totp", verifiedAt: new Date() }]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe.each(OPERATIONS)("$name", ({ scope, call }) => {
  it("refuses a technical operator with no grants at all", async () => {
    m.getScopeGrants.mockResolvedValue([]);
    expect((await outcome(call(appRouter.createCaller(ctx("technical_operator"))))).refused).toBe(true);
  });

  it("refuses an operator whose only grant is an unrelated scope (no escalation)", async () => {
    m.getScopeGrants.mockResolvedValue([grant("frontend"), grant("ui_ux"), grant("database")]);
    expect((await outcome(call(appRouter.createCaller(ctx("technical_operator"))))).refused).toBe(true);
  });

  it("refuses an expired grant and a revoked grant", async () => {
    m.getScopeGrants.mockResolvedValue([grant(scope, { expiresAt: past })]);
    expect((await outcome(call(appRouter.createCaller(ctx("technical_operator"))))).refused).toBe(true);
    m.getScopeGrants.mockResolvedValue([grant(scope, { revokedAt: past })]);
    expect((await outcome(call(appRouter.createCaller(ctx("technical_operator"))))).refused).toBe(true);
  });

  it("refuses when the grants cannot be read (fails closed)", async () => {
    m.getScopeGrants.mockRejectedValue(new Error("db down"));
    const r = await outcome(call(appRouter.createCaller(ctx("technical_operator"))));
    expect(r.refused).toBe(true);
    expect(r.code).toBe("FORBIDDEN");
  });

  it("lets an operator with an active, unexpired grant through the scope gate", async () => {
    m.getScopeGrants.mockResolvedValue([grant(scope, { expiresAt: future })]);
    expect((await outcome(call(appRouter.createCaller(ctx("technical_operator"))))).refused).toBe(false);
  });

  it("does not scope limit admins or super admins", async () => {
    m.getScopeGrants.mockResolvedValue([]);
    for (const role of ["admin", "super_admin"] as const) {
      expect((await outcome(call(appRouter.createCaller(ctx(role))))).refused).toBe(false);
    }
    expect(m.getScopeGrants).not.toHaveBeenCalled();
  });

  it("still refuses clients and developers outright", async () => {
    m.getScopeGrants.mockResolvedValue([grant(scope)]);
    for (const role of ["client", "developer", "user"] as const) {
      const r = await outcome(call(appRouter.createCaller(ctx(role))));
      expect(r.code).toBe("FORBIDDEN");
    }
  });
});

describe("revocation takes effect on the next call", () => {
  it("allows, then refuses once the same grant is revoked", async () => {
    const caller = appRouter.createCaller(ctx("technical_operator"));
    m.getScopeGrants.mockResolvedValue([grant("infrastructure")]);
    await expect(caller.ops.systemHealth()).resolves.toBeTruthy();
    m.getScopeGrants.mockResolvedValue([grant("infrastructure", { revokedAt: new Date() })]);
    await expect(caller.ops.systemHealth()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("one scope does not open another operator area", () => {
  it("a security-only operator cannot read system health, the email log or deployments", async () => {
    m.getScopeGrants.mockResolvedValue([grant("security")]);
    const c = appRouter.createCaller(ctx("technical_operator"));
    await expect(c.ops.systemHealth()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.ops.emailDeliveryLog()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.adminOps.deployments()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("an infrastructure-only operator cannot open the Security Center or compliance", async () => {
    m.getScopeGrants.mockResolvedValue([grant("infrastructure")]);
    const c = appRouter.createCaller(ctx("technical_operator"));
    await expect(c.ops.securityEvents()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.ops.acknowledgeSecurityEvent({ eventId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
