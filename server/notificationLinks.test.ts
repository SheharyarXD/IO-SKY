/*
 * N13 (29 Oct Doc 1 F-28): a notification link is re-validated when it is
 * opened. Pure rule first, then the client and admin routers end to end.
 * (The developer router cases live in developer.test.ts with its gate harness.)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PORTAL_HOME, resolveNotificationLink, safeInternalPath } from "../shared/notificationLinks";

const m = vi.hoisted(() => ({
  getClientNotificationById: vi.fn(),
  setClientNotificationRead: vi.fn(async () => ({ id: 1 })),
  getAdminNotificationById: vi.fn(),
  markAdminNotificationsRead: vi.fn(async () => 1),
  appendLoginAudit: vi.fn(async () => undefined),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ...m,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 5, kind: "totp", verifiedAt: new Date() }]),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("safeInternalPath", () => {
  it("accepts a normal portal path and keeps query and hash", () => {
    expect(safeInternalPath("/client-portal/billing")).toBe("/client-portal/billing");
    expect(safeInternalPath("  /client-portal/billing?pay=INV-1#top ")).toBe("/client-portal/billing?pay=INV-1#top");
  });

  it("refuses external, protocol-relative, script and data URLs", () => {
    for (const bad of ["https://evil.example/x", "//evil.example/x", "///evil.example", "javascript:alert(1)", "data:text/html,x", "mailto:a@b.c", "ftp://x/y"]) {
      expect(safeInternalPath(bad), bad).toBeNull();
    }
  });

  it("refuses backslashes, control characters, traversal and oversize values", () => {
    for (const bad of ["/\\evil.example", "/client-portal\\..\\admin", "/client-portal/x\u0000y", "/a\nb", "/client-portal/../admin", "/client-portal/%2e%2e/admin", "/%zz", "/" + "a".repeat(600)]) {
      expect(safeInternalPath(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("refuses non-strings and empties", () => {
    for (const bad of [null, undefined, 42, {}, "", "   ", "relative/path"]) expect(safeInternalPath(bad as never)).toBeNull();
  });
});

describe("resolveNotificationLink", () => {
  const go = (href: string | null, portal: "admin" | "client" | "developer", role: string | null) => resolveNotificationLink({ href, portal, role });

  it("opens an in-area link for a role that may still use that area", () => {
    expect(go("/client-portal/documents", "client", "client")).toEqual({ allowed: true, href: "/client-portal/documents" });
    expect(go("/developer-workspace/tasks", "developer", "developer")).toEqual({ allowed: true, href: "/developer-workspace/tasks" });
    expect(go("/admin/governance", "admin", "admin")).toEqual({ allowed: true, href: "/admin/governance" });
    expect(go("/admin/governance", "admin", "super_admin")).toMatchObject({ allowed: true });
  });

  it("lets staff open the portal they are supporting (impersonation)", () => {
    expect(go("/client-portal/billing", "client", "admin")).toMatchObject({ allowed: true });
    expect(go("/developer-workspace/time", "developer", "super_admin")).toMatchObject({ allowed: true });
  });

  it("refuses a link into another portal: a client feed never reaches /admin or /developer-workspace", () => {
    for (const href of ["/admin/users", "/ops", "/developer-workspace/tasks"]) {
      expect(go(href, "client", "client")).toMatchObject({ allowed: false, reason: "wrong_area", home: PORTAL_HOME.client });
    }
    expect(go("/client-portal/billing", "developer", "developer")).toMatchObject({ allowed: false, reason: "wrong_area" });
    expect(go("/client-portal/billing", "admin", "admin")).toMatchObject({ allowed: false, reason: "wrong_area" });
  });

  it("refuses when the role was lost since the notification was created", () => {
    expect(go("/client-portal/billing", "client", "user")).toMatchObject({ allowed: false, reason: "role_denied" });
    expect(go("/client-portal/billing", "client", "developer")).toMatchObject({ allowed: false, reason: "role_denied" });
    expect(go("/client-portal/billing", "client", "technical_operator")).toMatchObject({ allowed: false, reason: "role_denied" });
    expect(go("/admin/users", "admin", "client")).toMatchObject({ allowed: false, reason: "role_denied" });
    expect(go("/developer-workspace/tasks", "developer", "client")).toMatchObject({ allowed: false, reason: "role_denied" });
    expect(go("/client-portal/billing", "client", null)).toMatchObject({ allowed: false, reason: "role_denied" });
  });

  it("an admin feed may link to the ops console only for roles allowed there", () => {
    expect(go("/ops", "admin", "admin")).toMatchObject({ allowed: true });
  });

  it("fails closed on unknown areas, near-miss prefixes and unsafe values", () => {
    expect(go("/pricing", "client", "client")).toMatchObject({ allowed: false, reason: "wrong_area" });
    expect(go("/administrator", "admin", "admin")).toMatchObject({ allowed: false, reason: "wrong_area" });
    expect(go("/client-portalx/billing", "client", "client")).toMatchObject({ allowed: false, reason: "wrong_area" });
    expect(go("https://evil.example/client-portal", "client", "client")).toMatchObject({ allowed: false, reason: "unsafe_link" });
    expect(go(null, "client", "client")).toMatchObject({ allowed: false, reason: "no_link" });
    expect(go("", "client", "client")).toMatchObject({ allowed: false, reason: "no_link" });
  });
});

const baseReq = { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"];
const user = (role: string, organizationId: number | null = 2) =>
  ({ id: 5, openId: "u", email: "u@example.com", name: "U", loginMethod: "local", role, organizationId, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }) as never;
const ctxFor = (role: string, organizationId: number | null = 2): TrpcContext => ({ user: user(role, organizationId), impersonation: null, req: baseReq, res: { clearCookie: () => {} } as TrpcContext["res"] });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("clientPortal.openNotification", () => {
  it("returns the link and marks the notification read when it is allowed", async () => {
    m.getClientNotificationById.mockResolvedValueOnce({ id: 9, organizationId: 2, href: "/client-portal/billing" });
    const r = await appRouter.createCaller(ctxFor("client")).clientPortal.openNotification({ notificationId: 9 });
    expect(r).toEqual({ allowed: true, href: "/client-portal/billing", home: null, reason: null });
    expect(m.setClientNotificationRead).toHaveBeenCalledWith(2, 9, true);
    expect(m.getClientNotificationById).toHaveBeenCalledWith(2, 9); // looked up inside the caller's own organisation
  });

  it("another organisation's notification is simply not found", async () => {
    m.getClientNotificationById.mockResolvedValueOnce(null);
    await expect(appRouter.createCaller(ctxFor("client", 7)).clientPortal.openNotification({ notificationId: 9 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.getClientNotificationById).toHaveBeenCalledWith(7, 9);
    expect(m.setClientNotificationRead).not.toHaveBeenCalled();
  });

  it("refuses a tampered stored link, does not mark it read, and audits the refusal", async () => {
    for (const href of ["https://evil.example/phish", "//evil.example", "javascript:alert(1)", "/admin/users"]) {
      m.appendLoginAudit.mockClear();
      m.getClientNotificationById.mockResolvedValueOnce({ id: 9, organizationId: 2, href });
      const r = await appRouter.createCaller(ctxFor("client")).clientPortal.openNotification({ notificationId: 9 });
      expect(r.allowed, href).toBe(false);
      expect(r.href).toBeNull();
      expect(r.home).toBe("/client-portal");
      expect(m.appendLoginAudit, href).toHaveBeenCalledWith(expect.objectContaining({ outcome: "blocked", reason: expect.stringContaining("notification-link-denied") }));
    }
    expect(m.setClientNotificationRead).not.toHaveBeenCalled();
  });

  it("a notification with no link opens nothing and is not an audited denial", async () => {
    m.getClientNotificationById.mockResolvedValueOnce({ id: 9, organizationId: 2, href: null });
    const r = await appRouter.createCaller(ctxFor("client")).clientPortal.openNotification({ notificationId: 9 });
    expect(r).toMatchObject({ allowed: false, reason: "no_link" });
    expect(m.appendLoginAudit).not.toHaveBeenCalled();
  });

  it("refuses callers who are not clients or staff, and anonymous callers", async () => {
    await expect(appRouter.createCaller(ctxFor("developer")).clientPortal.openNotification({ notificationId: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller({ ...ctxFor("client"), user: null }).clientPortal.openNotification({ notificationId: 9 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(m.getClientNotificationById).not.toHaveBeenCalled();
  });
});

describe("adminOps.openNotification", () => {
  it("opens an allowed admin link and marks it read", async () => {
    m.getAdminNotificationById.mockResolvedValueOnce({ id: 3, href: "/admin/governance" });
    const r = await appRouter.createCaller(ctxFor("admin", null)).adminOps.openNotification({ id: 3 });
    expect(r).toEqual({ allowed: true, href: "/admin/governance", home: null, reason: null });
    expect(m.markAdminNotificationsRead).toHaveBeenCalledWith(5, 3);
  });

  it("refuses an external or client-portal link from the admin feed and records an admin event", async () => {
    for (const href of ["https://evil.example", "/client-portal/billing"]) {
      m.appendLoginAudit.mockClear();
      m.getAdminNotificationById.mockResolvedValueOnce({ id: 3, href });
      const r = await appRouter.createCaller(ctxFor("super_admin", null)).adminOps.openNotification({ id: 3 });
      expect(r.allowed, href).toBe(false);
      expect(r.home).toBe("/admin");
      expect(m.appendLoginAudit, href).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("notification_link_denied") }));
    }
    expect(m.markAdminNotificationsRead).not.toHaveBeenCalled();
  });

  it("unknown notification is NOT_FOUND; non-admin callers are refused before any lookup", async () => {
    m.getAdminNotificationById.mockResolvedValueOnce(null);
    await expect(appRouter.createCaller(ctxFor("admin", null)).adminOps.openNotification({ id: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const role of ["client", "developer", "technical_operator"]) {
      m.getAdminNotificationById.mockClear();
      await expect(appRouter.createCaller(ctxFor(role)).adminOps.openNotification({ id: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(m.getAdminNotificationById).not.toHaveBeenCalled();
    }
  });
});
