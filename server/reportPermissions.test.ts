/*
 * P07 (SRS BR-009, BR-016; 29 Oct Ch13.3, F-23): Review and Publish are independent
 * permissions, enforced in the API and offered correctly to the screen. Pure rules
 * plus the router with the data layer mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actionFor, authorizeReportAction, isReportScope, REPORT_PUBLISH_SCOPE, REPORT_REFUSAL_TEXT } from "../shared/reportPermissions";

const NOW = new Date("2026-10-30T12:00:00Z");
const grant = (over: Partial<{ scope: string; expiresAt: Date | null; revokedAt: Date | null }> = {}) => ({ scope: REPORT_PUBLISH_SCOPE, expiresAt: null, revokedAt: null, ...over });

describe("which action a move is", () => {
  it("publishing is publish; approving, sending back and archiving are review", () => {
    expect(actionFor("published")).toBe("publish");
    for (const to of ["approved", "revision_required", "archived", "awaiting_expert_review"]) expect(actionFor(to), to).toBe("review");
  });
});

describe("authorizeReportAction", () => {
  it("every admin can review, with or without any grant", () => {
    for (const role of ["admin", "super_admin"]) expect(authorizeReportAction({ role, action: "review", grants: [], now: NOW })).toEqual({ allowed: true });
  });
  it("a super admin can always publish", () => {
    expect(authorizeReportAction({ role: "super_admin", action: "publish", grants: [], now: NOW })).toEqual({ allowed: true });
  });
  it("an admin publishes only with an active publish grant", () => {
    expect(authorizeReportAction({ role: "admin", action: "publish", grants: [], now: NOW })).toEqual({ allowed: false, reason: "publish_right_required" });
    expect(authorizeReportAction({ role: "admin", action: "publish", grants: [grant()], now: NOW })).toEqual({ allowed: true });
    expect(authorizeReportAction({ role: "admin", action: "publish", grants: [grant({ expiresAt: new Date("2026-12-01") })], now: NOW })).toEqual({ allowed: true });
  });
  it("an expired or revoked grant does not count, and neither does another scope", () => {
    for (const g of [grant({ expiresAt: new Date("2026-10-30T12:00:00Z") }), grant({ expiresAt: new Date("2026-10-01") }), grant({ revokedAt: new Date("2026-10-15") }), grant({ scope: "backend" }), grant({ scope: "report:publish-all" }), grant({ scope: "agent:x:approve" })]) {
      expect(authorizeReportAction({ role: "admin", action: "publish", grants: [g], now: NOW }), JSON.stringify(g)).toEqual({ allowed: false, reason: "publish_right_required" });
    }
    // one live grant among dead ones is enough
    expect(authorizeReportAction({ role: "admin", action: "publish", grants: [grant({ revokedAt: new Date("2026-10-15") }), grant()], now: NOW }).allowed).toBe(true);
  });
  it("no one else can do either, even holding the grant", () => {
    for (const role of ["technical_operator", "developer", "client", "user", null, undefined, ""]) {
      for (const action of ["review", "publish"] as const) expect(authorizeReportAction({ role, action, grants: [grant()], now: NOW }), `${role}:${action}`).toEqual({ allowed: false, reason: "not_staff" });
    }
  });
  it("recognises the report scope and nothing else", () => {
    expect(isReportScope("report:publish")).toBe(true);
    for (const s of ["report:review", "publish", "backend", "report:publish ", ""]) expect(isReportScope(s), s).toBe(false);
    for (const k of Object.keys(REPORT_REFUSAL_TEXT)) expect(REPORT_REFUSAL_TEXT[k as keyof typeof REPORT_REFUSAL_TEXT].length).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

const m = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  transitionAiScanReport: vi.fn(),
  decideLatestAiExecutionForSubject: vi.fn(async () => null),
  createAdminNotification: vi.fn(async () => null),
  dispatchSimpleEmailMock: vi.fn(async () => ({ ok: true })),
  grants: [] as Array<{ scope: string; expiresAt: Date | null; revokedAt: Date | null }>,
  grantOperatorScope: vi.fn(),
}));

vi.mock("./db/platformGovernance", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getScopeGrants: vi.fn(async () => m.grants), grantOperatorScope: (...a: unknown[]) => m.grantOperatorScope(...a) };
});
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
    appendLoginAudit: m.appendLoginAudit,
    transitionAiScanReport: m.transitionAiScanReport,
    decideLatestAiExecutionForSubject: m.decideLatestAiExecutionForSubject,
    createAdminNotification: m.createAdminNotification,
  };
});
vi.mock("./email", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, dispatchSimpleEmail: (...a: unknown[]) => m.dispatchSimpleEmailMock(...a) };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function ctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "t", email: "ops@example.com", name: "Ops", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}
const ops = (role: U["role"]) => appRouter.createCaller(ctx(role)).adminOps;
const scan = { id: 7, company: "Acme", fullName: "A Person", email: "a@example.com", reportToken: "tok123", locale: "en" };

describe("moveAiScanReport enforces the publish right", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.grants = [];
  });

  it("refuses an admin without the right before touching the report, emailing anyone or notifying", async () => {
    await expect(ops("admin").moveAiScanReport({ scanId: 7, to: "published" })).rejects.toMatchObject({ code: "FORBIDDEN", message: REPORT_REFUSAL_TEXT.publish_right_required });
    expect(m.transitionAiScanReport).not.toHaveBeenCalled();
    expect(m.dispatchSimpleEmailMock).not.toHaveBeenCalled();
    expect(m.createAdminNotification).not.toHaveBeenCalled();
  });

  it("records the refused attempt", async () => {
    await ops("admin").moveAiScanReport({ scanId: 7, to: "published" }).catch(() => undefined);
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.ai_scan.published_refused(7:publish_right_required)") }));
  });

  it("the same admin can still approve and send back", async () => {
    m.transitionAiScanReport.mockResolvedValue({ ok: true, from: "awaiting_expert_review", scan });
    await expect(ops("admin").moveAiScanReport({ scanId: 7, to: "approved" })).resolves.toMatchObject({ status: "approved" });
    await expect(ops("admin").moveAiScanReport({ scanId: 7, to: "revision_required", note: "Fix section 2" })).resolves.toMatchObject({ status: "revision_required" });
    expect(m.transitionAiScanReport).toHaveBeenCalledTimes(2);
  });

  it("an admin holding the grant can publish, and the customer is emailed", async () => {
    m.grants = [grant()];
    m.transitionAiScanReport.mockResolvedValueOnce({ ok: true, from: "approved", scan });
    await expect(ops("admin").moveAiScanReport({ scanId: 7, to: "published" })).resolves.toMatchObject({ status: "published" });
    expect(m.transitionAiScanReport).toHaveBeenCalledWith(expect.objectContaining({ to: "published", actorUserId: 99 }));
    expect(m.dispatchSimpleEmailMock).toHaveBeenCalledTimes(1);
  });

  it("an expired or revoked grant is refused like no grant", async () => {
    for (const g of [grant({ expiresAt: new Date(Date.now() - 1000) }), grant({ revokedAt: new Date(Date.now() - 1000) })]) {
      m.grants = [g];
      await expect(ops("admin").moveAiScanReport({ scanId: 7, to: "published" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(m.transitionAiScanReport).not.toHaveBeenCalled();
  });

  it("a super admin publishes with no grant at all", async () => {
    m.transitionAiScanReport.mockResolvedValueOnce({ ok: true, from: "approved", scan });
    await expect(ops("super_admin").moveAiScanReport({ scanId: 7, to: "published" })).resolves.toMatchObject({ status: "published" });
  });

  it("a technical operator or client holding the grant is still outside the whole procedure", async () => {
    m.grants = [grant()];
    for (const role of ["technical_operator", "client", "developer"] as const) await expect(ops(role).moveAiScanReport({ scanId: 7, to: "published" }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.transitionAiScanReport).not.toHaveBeenCalled();
  });

  it("archiving is review, not publish", async () => {
    m.transitionAiScanReport.mockResolvedValueOnce({ ok: true, from: "published", scan });
    await expect(ops("admin").moveAiScanReport({ scanId: 7, to: "archived" })).resolves.toMatchObject({ status: "archived" });
  });
});

describe("myReportPermissions tells the screen what the API will allow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.grants = [];
  });
  it("matches the enforcement for each role and grant", async () => {
    await expect(ops("admin").myReportPermissions()).resolves.toEqual({ canReview: true, canPublish: false });
    m.grants = [grant()];
    await expect(ops("admin").myReportPermissions()).resolves.toEqual({ canReview: true, canPublish: true });
    m.grants = [];
    await expect(ops("super_admin").myReportPermissions()).resolves.toEqual({ canReview: true, canPublish: true });
  });
  it("is staff only", async () => {
    await expect(ops("client").myReportPermissions()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ops("technical_operator").myReportPermissions()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("granting the publish right", () => {
  const platform = (role: U["role"]) => appRouter.createCaller(ctx(role)).adminPlatform;
  beforeEach(() => vi.clearAllMocks());

  it("only a super admin can grant it", async () => {
    for (const role of ["admin", "technical_operator", "client", "developer"] as const) await expect(platform(role).grantOperatorScope({ userId: 5, scope: "report:publish", expiresInDays: 30 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.grantOperatorScope).not.toHaveBeenCalled();
  });
  it("a super admin grants it with an expiry, and the grant is audited", async () => {
    m.grantOperatorScope.mockResolvedValueOnce({ id: 3 });
    await platform("super_admin").grantOperatorScope({ userId: 5, scope: "report:publish", expiresInDays: 30, note: "Covers publishing in November" });
    const call = m.grantOperatorScope.mock.calls[0][0] as { userId: number; scope: string; expiresAt: Date; grantedByUserId: number };
    expect(call).toMatchObject({ userId: 5, scope: "report:publish", grantedByUserId: 99 });
    expect(call.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.operator_scope.grant(user=5:report:publish:") }));
  });
  it("is refused for someone who is not an admin, with a plain message", async () => {
    m.grantOperatorScope.mockResolvedValueOnce("not_admin");
    await expect(platform("super_admin").grantOperatorScope({ userId: 6, scope: "report:publish", expiresInDays: null })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("only be granted to an admin") });
  });
  it("still rejects an unknown scope, including look-alikes", async () => {
    for (const scope of ["report:review", "report:publish:all", "publish", "REPORT:PUBLISH"]) await expect(platform("super_admin").grantOperatorScope({ userId: 5, scope, expiresInDays: 7 }), scope).rejects.toThrow();
    expect(m.grantOperatorScope).not.toHaveBeenCalled();
  });
});
