/*
 * The client notification feed is stored once per organization, so each member's
 * in-app preferences (SRS 17.11) apply when it is read. Security notifications
 * can never be hidden (SRS 17.13).
 */
import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listClientNotifications: vi.fn(),
  listNotificationPreferences: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listClientNotifications: m.listClientNotifications, listNotificationPreferences: m.listNotificationPreferences };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const ctx = (): TrpcContext => ({
  user: { id: 5, openId: "c", email: "c@example.com", name: "C", loginMethod: "local", role: "client", organizationId: 2, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as never,
  impersonation: null,
  req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
  res: { clearCookie: () => {} } as TrpcContext["res"],
});

const feed = [
  { id: 1, kind: "billing", title: "Invoice" },
  { id: 2, kind: "project", title: "Milestone" },
  { id: 3, kind: "security", title: "New sign in" },
  { id: 4, kind: "marketing", title: "News" },
];

describe("clientPortal.notifications", () => {
  it("shows everything when the member has set no preferences", async () => {
    m.listClientNotifications.mockResolvedValueOnce(feed);
    m.listNotificationPreferences.mockResolvedValueOnce([]);
    const r = await appRouter.createCaller(ctx()).clientPortal.notifications();
    expect(r.map((n) => n.id)).toEqual([1, 2, 3, 4]);
  });

  it("hides a category this member opted out of, for in app only", async () => {
    m.listClientNotifications.mockResolvedValueOnce(feed);
    m.listNotificationPreferences.mockResolvedValueOnce([
      { category: "marketing", channel: "in_app", enabled: false },
      { category: "billing", channel: "email", enabled: false },
    ]);
    const r = await appRouter.createCaller(ctx()).clientPortal.notifications();
    expect(r.map((n) => n.id)).toEqual([1, 2, 3]);
  });

  it("never hides a security notification, even if a preference row says so", async () => {
    m.listClientNotifications.mockResolvedValueOnce(feed);
    m.listNotificationPreferences.mockResolvedValueOnce([{ category: "security", channel: "in_app", enabled: false }]);
    const r = await appRouter.createCaller(ctx()).clientPortal.notifications();
    expect(r.map((n) => n.id)).toContain(3);
  });
});
