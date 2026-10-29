/*
 * Z14 (SRS 8.16): denied access attempts are logged, with bounded volume.
 * Throttle first (injected clock), then the real routers end to end.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DenialAuditThrottle } from "./_core/denialThrottle";

const MIN = 60_000;
const opts = { windowMs: 10 * MIN, maxKeys: 5, budgetPerMinute: { anonymous: 3, signed_in: 4 } };

describe("DenialAuditThrottle", () => {
  it("records the first attempt and counts, without writing, the repeats in the window", () => {
    const t = new DenialAuditThrottle(opts);
    expect(t.decide("anonymous", "ip:1|admin.users|FORBIDDEN", 0)).toEqual({ record: true, suppressed: 0 });
    for (let i = 1; i <= 5; i++) expect(t.decide("anonymous", "ip:1|admin.users|FORBIDDEN", i * 1000).record).toBe(false);
  });

  it("the next row after the window reports how many were not written", () => {
    const t = new DenialAuditThrottle(opts);
    t.decide("signed_in", "u1|admin.users|FORBIDDEN", 0);
    for (let i = 0; i < 7; i++) t.decide("signed_in", "u1|admin.users|FORBIDDEN", 1000 + i);
    expect(t.decide("signed_in", "u1|admin.users|FORBIDDEN", 11 * MIN)).toEqual({ record: true, suppressed: 7 });
    expect(t.decide("signed_in", "u1|admin.users|FORBIDDEN", 11 * MIN + 1)).toEqual({ record: false, suppressed: 0 });
  });

  it("different actors and different endpoints are recorded separately", () => {
    const t = new DenialAuditThrottle(opts);
    expect(t.decide("anonymous", "ip:1|a|FORBIDDEN", 0).record).toBe(true);
    expect(t.decide("anonymous", "ip:2|a|FORBIDDEN", 0).record).toBe(true);
    expect(t.decide("anonymous", "ip:1|b|FORBIDDEN", 0).record).toBe(true);
  });

  it("a flood of distinct anonymous actors is capped per minute, then resumes the next minute", () => {
    const t = new DenialAuditThrottle({ ...opts, maxKeys: 1000 });
    const wrote = (n: number, at: number) => Array.from({ length: n }, (_, i) => t.decide("anonymous", `ip:${at}-${i}|p|FORBIDDEN`, at).record).filter(Boolean).length;
    expect(wrote(50, 0)).toBe(3);
    expect(t.droppedByBudget).toBe(47);
    expect(wrote(50, MIN)).toBe(3);
  });

  it("anonymous and signed-in budgets are independent: a flood of probes cannot hide a real user's denial", () => {
    const t = new DenialAuditThrottle({ ...opts, maxKeys: 1000 });
    for (let i = 0; i < 20; i++) t.decide("anonymous", `ip:${i}|p|FORBIDDEN`, 0);
    expect(t.decide("signed_in", "u9|p|FORBIDDEN", 0).record).toBe(true);
  });

  it("holds at most maxKeys entries in memory", () => {
    const t = new DenialAuditThrottle({ ...opts, budgetPerMinute: { anonymous: 1000, signed_in: 1000 } });
    for (let i = 0; i < 50; i++) t.decide("anonymous", `ip:${i}|p|FORBIDDEN`, i);
    expect(t.size).toBe(5);
  });
});

const m = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => undefined),
  createOpportunity: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendLoginAudit: m.appendLoginAudit,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 5, kind: "totp", verifiedAt: new Date() }]),
  };
});

import { appRouter } from "./routers";
import { resetDenialAuditThrottleForTests } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const req = (ip: string, ua = "vitest-agent") => ({ protocol: "https", headers: { "user-agent": ua, "x-forwarded-for": ip }, socket: { remoteAddress: ip } }) as TrpcContext["req"];
const anon = (ip = "203.0.113.7"): TrpcContext => ({ user: null, impersonation: null, req: req(ip), res: { clearCookie: () => {} } as TrpcContext["res"] });
const asRole = (role: string, id = 5): TrpcContext => ({
  user: { id, openId: "u", email: "who@example.com", name: "W", loginMethod: "local", role, organizationId: 2, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as never,
  impersonation: null,
  req: req("198.51.100.9"),
  res: { clearCookie: () => {} } as TrpcContext["res"],
});
const settle = () => new Promise((r) => setTimeout(r, 20));
const blocked = () => m.appendLoginAudit.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((r) => r.outcome === "blocked");

beforeEach(() => {
  vi.clearAllMocks();
  resetDenialAuditThrottleForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("anonymous attempts at protected endpoints are denied and logged", () => {
  it("an admin endpoint called with no session is refused and recorded once, with IP and agent but no identity", async () => {
    for (let i = 0; i < 5; i++) await expect(appRouter.createCaller(anon()).adminOps.opportunities({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await settle();
    expect(blocked()).toHaveLength(1);
    expect(blocked()[0]).toMatchObject({ provider: "authz", outcome: "blocked", userId: null, identifier: null, ip: "203.0.113.7", userAgent: "vitest-agent", reason: "denied-anon:adminOps.opportunities" });
  });

  it("a client endpoint called with no session (UNAUTHORIZED) is recorded and marked unauthenticated", async () => {
    await expect(appRouter.createCaller(anon()).clientPortal.notifications()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await settle();
    expect(blocked()).toHaveLength(1);
    expect(blocked()[0].reason).toBe("denied-anon:clientPortal.notifications:unauthenticated");
  });

  it("the session probes that portals poll for logged-out visitors are not recorded", async () => {
    await expect(appRouter.createCaller(anon()).admin.gateStatus()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(anon()).ops.gateStatus()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await settle();
    expect(blocked()).toHaveLength(0);
  });

  it("a different source address or endpoint is a separate record", async () => {
    await appRouter.createCaller(anon("203.0.113.7")).adminOps.opportunities({}).catch(() => undefined);
    await appRouter.createCaller(anon("203.0.113.8")).adminOps.opportunities({}).catch(() => undefined);
    await appRouter.createCaller(anon("203.0.113.7")).adminOps.pendingApprovals().catch(() => undefined);
    await settle();
    expect(blocked()).toHaveLength(3);
    expect(new Set(blocked().map((r) => r.reason))).toEqual(new Set(["denied-anon:adminOps.opportunities", "denied-anon:adminOps.pendingApprovals"]));
    expect(new Set(blocked().map((r) => r.ip))).toEqual(new Set(["203.0.113.7", "203.0.113.8"]));
  });

  it("a flood from many addresses writes a bounded number of rows", async () => {
    for (let i = 0; i < 100; i++) await appRouter.createCaller(anon(`203.0.113.${i}`)).adminOps.opportunities({}).catch(() => undefined);
    await settle();
    expect(blocked().length).toBeLessThanOrEqual(10);
    expect(blocked().length).toBeGreaterThan(0);
  });
});

describe("signed-in refusals keep the existing record, now bounded", () => {
  it("records the denial with the user, then collapses repeats", async () => {
    for (let i = 0; i < 4; i++) await expect(appRouter.createCaller(asRole("client")).adminOps.opportunities({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await settle();
    expect(blocked()).toHaveLength(1);
    expect(blocked()[0]).toMatchObject({ userId: 5, identifier: "who@example.com", reason: "denied:adminOps.opportunities" });
  });

  it("two different users are both recorded", async () => {
    await appRouter.createCaller(asRole("client", 5)).adminOps.opportunities({}).catch(() => undefined);
    await appRouter.createCaller(asRole("developer", 6)).adminOps.opportunities({}).catch(() => undefined);
    await settle();
    expect(blocked().map((r) => r.userId).sort()).toEqual([5, 6]);
  });

  it("an allowed call, or a failure that is not an authorization refusal, writes no denial row", async () => {
    await appRouter.createCaller(asRole("admin")).adminOps.createOpportunity({ title: "Deal" }).catch(() => undefined); // BAD_REQUEST
    await settle();
    expect(blocked()).toHaveLength(0);
  });
});
