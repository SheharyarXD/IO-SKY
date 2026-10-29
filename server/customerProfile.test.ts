/*
 * C03 (SRS 14.16; 29 Oct Ch8): contextual customer profile with history, calls,
 * scans, projects and files. Pure rules plus the endpoint with the data layer
 * mocked. The queries in customerTimeline have not run against PostgreSQL
 * (task M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callEntry, fileEntry, projectEntry, scanEntry, sortTimeline, summarizeProfile, TIMELINE_TYPES, type TimelineEntry } from "../shared/profileRules";

const NOW = new Date("2026-10-30T12:00:00Z");
const d = (iso: string) => new Date(iso);
const entry = (type: TimelineEntry["type"], ref: string, at: string, title = "t"): TimelineEntry => ({ type, ref, at: d(at), title, detail: null });

describe("entries say what a record is, not what is in it", () => {
  it("a call shows its service, day and state", () => {
    const e = callEntry({ id: 4, serviceId: "discovery", slotStartMs: Date.UTC(2026, 10, 3, 9, 0), status: "confirmed", createdAt: d("2026-10-20T00:00:00Z") });
    expect(e).toMatchObject({ type: "call", ref: "booking:4", title: "Discovery call: discovery on 2026-11-03 (confirmed)", detail: null });
    expect(e.at.toISOString()).toBe("2026-11-03T09:00:00.000Z"); // dated by the appointment, not by when it was booked
  });
  it("a scan shows its tier and state only", () => {
    const e = scanEntry({ id: 9, tier: "paid_report", status: "ready_for_review", createdAt: d("2026-10-01T00:00:00Z") });
    expect(e).toMatchObject({ type: "scan", ref: "scan:9", title: "AI Scan: paid report (ready for review)", detail: null });
  });
  it("a project shows its name, state and phase", () => {
    expect(projectEntry({ id: 2, name: "Portal rebuild", phase: "Build", status: "active", createdAt: d("2026-09-01T00:00:00Z") })).toMatchObject({ type: "project", ref: "project:2", title: "Project: Portal rebuild (active, Build)" });
  });
  it("a file shows name, category, version and state, with no link or content", () => {
    const e = fileEntry({ id: 7, name: "Brief.pdf", category: "contracts", version: 3, status: "pending_review", createdAt: d("2026-10-10T00:00:00Z") });
    expect(e).toMatchObject({ type: "file", ref: "file:7", title: "File: Brief.pdf (contracts, version 3, pending review)", detail: null });
    expect(JSON.stringify(e)).not.toMatch(/https?:|storage|path|key/i);
  });
  it("every entry has a null detail, so nothing free-form from a record can leak through these four types", () => {
    const all = [
      callEntry({ id: 1, serviceId: "discovery", slotStartMs: 0, status: "confirmed", createdAt: d("2026-01-01") }),
      scanEntry({ id: 1, tier: "free", status: "pending", createdAt: d("2026-01-01") }),
      projectEntry({ id: 1, name: "n", phase: "p", status: "active", createdAt: d("2026-01-01") }),
      fileEntry({ id: 1, name: "n", category: "c", version: 1, status: "approved", createdAt: d("2026-01-01") }),
    ];
    for (const e of all) expect(e.detail).toBeNull();
  });
});

describe("sorting", () => {
  it("newest first with a stable order for equal times", () => {
    const out = sortTimeline([entry("activity", "activity:1", "2026-10-01T00:00:00Z"), entry("call", "booking:2", "2026-10-20T00:00:00Z"), entry("scan", "scan:b", "2026-10-10T00:00:00Z"), entry("scan", "scan:a", "2026-10-10T00:00:00Z")]);
    expect(out.map((e) => e.ref)).toEqual(["booking:2", "scan:a", "scan:b", "activity:1"]);
  });
  it("drops a record listed twice and respects the limit", () => {
    const a = entry("file", "file:1", "2026-10-01T00:00:00Z");
    expect(sortTimeline([a, { ...a }, entry("file", "file:2", "2026-10-02T00:00:00Z")])).toHaveLength(2);
    const many = Array.from({ length: 10 }, (_, i) => entry("activity", `activity:${i}`, `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
    expect(sortTimeline(many, 3).map((e) => e.ref)).toEqual(["activity:9", "activity:8", "activity:7"]);
  });
});

describe("the summary", () => {
  it("counts every type, including those with none", () => {
    const s = summarizeProfile([entry("call", "booking:1", "2026-10-01T00:00:00Z"), entry("call", "booking:2", "2026-10-02T00:00:00Z"), entry("file", "file:1", "2026-10-03T00:00:00Z")], NOW);
    expect(Object.keys(s.byType).sort()).toEqual([...TIMELINE_TYPES].sort());
    expect(s.byType).toMatchObject({ call: 2, file: 1, scan: 0, project: 0, lead: 0, activity: 0, opportunity: 0, proposal: 0 });
    expect(s.total).toBe(3);
  });
  it("reports first and last activity and days since the last one", () => {
    const s = summarizeProfile([entry("lead", "lead:1", "2026-09-01T00:00:00Z"), entry("activity", "activity:1", "2026-10-25T12:00:00Z")], NOW);
    expect(s.firstAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(s.lastAt?.toISOString()).toBe("2026-10-25T12:00:00.000Z");
    expect(s.daysSinceLastActivity).toBe(5);
  });
  it("a future appointment is upcoming, not 'last activity', and cancelled or completed ones do not count", () => {
    const s = summarizeProfile(
      [entry("activity", "activity:1", "2026-10-20T00:00:00Z"), entry("call", "booking:1", "2026-11-05T09:00:00Z", "Discovery call: discovery on 2026-11-05 (confirmed)"), entry("call", "booking:2", "2026-11-06T09:00:00Z", "Discovery call: discovery on 2026-11-06 (cancelled)"), entry("call", "booking:3", "2026-11-07T09:00:00Z", "Discovery call: discovery on 2026-11-07 (completed)")],
      NOW,
    );
    expect(s.upcomingCalls).toBe(1);
    expect(s.daysSinceLastActivity).toBe(10);
    expect(s.lastAt?.toISOString()).toBe("2026-11-07T09:00:00.000Z");
  });
  it("an empty profile has no dates", () => {
    expect(summarizeProfile([], NOW)).toMatchObject({ total: 0, firstAt: null, lastAt: null, daysSinceLastActivity: null, upcomingCalls: 0 });
  });
  it("only future entries leave 'days since' empty", () => {
    expect(summarizeProfile([entry("call", "booking:1", "2026-12-01T00:00:00Z")], NOW).daysSinceLastActivity).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// endpoint
// ---------------------------------------------------------------------------

const m = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  customerProfile: vi.fn(async () => ({ summary: { total: 0 }, timeline: [] })),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), ...m };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function ctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "test-admin", email: "ops@example.com", name: "Ops Admin", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("adminOps.customerProfile", () => {
  beforeEach(() => vi.clearAllMocks());
  it("is staff only", async () => {
    for (const role of ["client", "developer"] as const) await expect(appRouter.createCaller(ctx(role)).adminOps.customerProfile({ leadId: 1 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.customerProfile).not.toHaveBeenCalled();
  });
  it("needs a lead or an organization, and rejects bad ids", async () => {
    const c = appRouter.createCaller(ctx("admin")).adminOps;
    await expect(c.customerProfile({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(c.customerProfile({ leadId: -1 })).rejects.toThrow();
    await expect(c.customerProfile({ leadId: 1, extra: 1 } as never)).resolves.toBeDefined();
    expect(m.customerProfile).toHaveBeenCalledTimes(1);
  });
  it("passes the lead and organization through", async () => {
    await appRouter.createCaller(ctx("admin")).adminOps.customerProfile({ leadId: 4, organizationId: 9 });
    expect(m.customerProfile).toHaveBeenCalledWith({ leadId: 4, organizationId: 9 });
  });
});
