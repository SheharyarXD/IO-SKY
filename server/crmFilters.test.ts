/*
 * C01 (SRS 14.16; 29 Oct Ch8): combinable CRM lead filters. The matching rule is
 * pure; the endpoint is tested with the data layer mocked. The 2000-row scan in
 * listLeadsFiltered has not run against PostgreSQL (task M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activeFilterCount, filterLeads, LEAD_QUERY, leadFilterSchema, leadMatches, type FilterableLead, type LeadFilter } from "../shared/crmFilters";

const lead = (over: Partial<FilterableLead> = {}): FilterableLead => ({
  fullName: "Pat Prospect",
  email: "pat@example.com",
  company: "Pat BV",
  phone: "+31 6 12345678",
  source: "booking",
  interest: "discovery",
  status: "new",
  utmSource: "linkedin",
  utmCampaign: "spring-launch",
  createdAt: "2026-10-15T10:00:00.000Z",
  ...over,
});
const m = (f: LeadFilter, l: Partial<FilterableLead> = {}) => leadMatches(lead(l), f);

describe("single conditions", () => {
  it("no filter matches everything", () => {
    expect(m({})).toBe(true);
    expect(m({ statuses: [], sources: [], q: "  " })).toBe(true);
  });
  it("stage: any of the listed", () => {
    expect(m({ statuses: ["new"] })).toBe(true);
    expect(m({ statuses: ["won", "new"] })).toBe(true);
    expect(m({ statuses: ["won", "lost"] })).toBe(false);
  });
  it("source: any of the listed, ignoring case", () => {
    expect(m({ sources: ["ai-scan", "booking"] })).toBe(true);
    expect(m({ sources: ["BOOKING"] })).toBe(true);
    expect(m({ sources: ["contact"] })).toBe(false);
  });
  it("free text searches name, email, company and interest, ignoring case, and nothing else", () => {
    for (const q of ["pat", "PROSPECT", "example.com", "pat bv", "discovery"]) expect(m({ q }), q).toBe(true);
    expect(m({ q: "spring-launch" })).toBe(false); // the campaign is not part of free text
    expect(m({ q: "+31" })).toBe(false); // nor the phone number
    expect(m({ q: "nobody" })).toBe(false);
    expect(m({ q: "pat" }, { company: null, interest: null })).toBe(true);
  });
  it("company and interest are contains-matches", () => {
    expect(m({ company: "bv" })).toBe(true);
    expect(m({ company: "acme" })).toBe(false);
    expect(m({ company: "bv" }, { company: null })).toBe(false);
    expect(m({ interest: "disc" })).toBe(true);
    expect(m({ interest: "growth" })).toBe(false);
  });
  it("campaign attribution is an exact match, ignoring case", () => {
    expect(m({ utmSource: "LinkedIn" })).toBe(true);
    expect(m({ utmSource: "link" })).toBe(false);
    expect(m({ utmCampaign: "Spring-Launch" })).toBe(true);
    expect(m({ utmCampaign: "spring" })).toBe(false);
    expect(m({ utmCampaign: "x" }, { utmCampaign: null })).toBe(false);
  });
  it("phone present or absent, treating blank as absent", () => {
    expect(m({ hasPhone: true })).toBe(true);
    expect(m({ hasPhone: false })).toBe(false);
    for (const phone of [null, "", "   "]) {
      expect(m({ hasPhone: true }, { phone }), String(phone)).toBe(false);
      expect(m({ hasPhone: false }, { phone }), String(phone)).toBe(true);
    }
  });
  it("created dates are whole UTC days, inclusive at both ends", () => {
    expect(m({ createdFrom: "2026-10-15" })).toBe(true);
    expect(m({ createdFrom: "2026-10-16" })).toBe(false);
    expect(m({ createdTo: "2026-10-15" })).toBe(true);
    expect(m({ createdTo: "2026-10-14" })).toBe(false);
    expect(m({ createdFrom: "2026-10-15", createdTo: "2026-10-15" })).toBe(true);
    expect(m({ createdTo: "2026-10-15" }, { createdAt: "2026-10-15T23:59:59.999Z" })).toBe(true);
    expect(m({ createdTo: "2026-10-15" }, { createdAt: "2026-10-16T00:00:00.000Z" })).toBe(false);
    expect(m({ createdFrom: "2026-10-15" }, { createdAt: "2026-10-14T23:59:59.999Z" })).toBe(false);
    expect(m({ createdFrom: "2026-10-01" }, { createdAt: new Date("2026-10-20T00:00:00Z") })).toBe(true);
    expect(m({ createdFrom: "2026-10-01" }, { createdAt: "garbage" })).toBe(false);
  });
});

describe("combining", () => {
  it("every condition given must hold", () => {
    const all: LeadFilter = { statuses: ["new"], sources: ["booking"], company: "bv", utmCampaign: "spring-launch", hasPhone: true, createdFrom: "2026-10-01", createdTo: "2026-10-31", q: "pat" };
    expect(m(all)).toBe(true);
    // break each condition in turn: the whole filter must then fail
    const breakers: Array<Partial<FilterableLead>> = [{ status: "won" }, { source: "contact" }, { company: "Acme" }, { utmCampaign: "other" }, { phone: null }, { createdAt: "2026-09-30T10:00:00Z" }, { createdAt: "2026-11-01T10:00:00Z" }, { fullName: "Sam", email: "sam@x.io", company: "Sam BV", interest: null }];
    for (const b of breakers) expect(m(all, b), JSON.stringify(b)).toBe(false);
  });
  it("adding a condition can only shrink the result", () => {
    const leads = [lead(), lead({ status: "won" }), lead({ source: "contact", phone: null }), lead({ company: "Acme", createdAt: "2026-08-01T00:00:00Z" }), lead({ fullName: "Sam", email: "sam@x.io", utmCampaign: null })];
    const steps: LeadFilter[] = [{}, { statuses: ["new"] }, { statuses: ["new"], hasPhone: true }, { statuses: ["new"], hasPhone: true, company: "bv" }, { statuses: ["new"], hasPhone: true, company: "bv", utmCampaign: "spring-launch" }];
    let previous = Infinity;
    for (const f of steps) {
      const n = filterLeads(leads, f).length;
      expect(n).toBeLessThanOrEqual(previous);
      previous = n;
    }
    expect(filterLeads(leads, steps[1]).length).toBeGreaterThan(filterLeads(leads, steps[4]).length - 1);
  });
  it("filterLeads keeps the original order and returns the same objects", () => {
    const a = lead({ fullName: "A" });
    const b = lead({ fullName: "B", status: "won" });
    const c = lead({ fullName: "C" });
    const out = filterLeads([a, b, c], { statuses: ["new"] });
    expect(out).toEqual([a, c]);
    expect(out[0]).toBe(a);
  });
  it("counts active conditions", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ q: " ", statuses: [] })).toBe(0);
    expect(activeFilterCount({ q: "x", statuses: ["new"], sources: ["a"], hasPhone: false, createdFrom: "2026-01-01", createdTo: "2026-02-01", company: "c", interest: "i", utmSource: "u", utmCampaign: "c" })).toBe(10);
  });
});

describe("the filter schema", () => {
  it("accepts a normal filter and trims text", () => {
    expect(leadFilterSchema.parse({ q: "  pat  ", statuses: ["new"], createdFrom: "2026-10-01" })).toEqual({ q: "pat", statuses: ["new"], createdFrom: "2026-10-01" });
    expect(leadFilterSchema.parse({})).toEqual({});
  });
  it("rejects unknown keys, bad stages, bad dates, an inverted range and oversized input", () => {
    for (const bad of [{ owner: "me" }, { statuses: ["archived"] }, { createdFrom: "15/10/2026" }, { createdFrom: "2026-10-20", createdTo: "2026-10-01" }, { q: "x".repeat(121) }, { sources: Array(11).fill("a") }, { hasPhone: "yes" }]) expect(leadFilterSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });
  it("the scan is bounded", () => {
    expect(LEAD_QUERY.scan).toBeGreaterThan(LEAD_QUERY.return);
    expect(LEAD_QUERY.return).toBeLessThanOrEqual(500);
  });
});

// ---------------------------------------------------------------------------
// endpoint
// ---------------------------------------------------------------------------

const d = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  listLeadsFiltered: vi.fn(async () => ({ rows: [], matched: 0, scanned: 0, truncated: false })),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), ...d };
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

describe("admin.crmLeads", () => {
  beforeEach(() => vi.clearAllMocks());
  it("is staff only", async () => {
    for (const role of ["client", "developer"] as const) await expect(appRouter.createCaller(ctx(role)).admin.crmLeads({}), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.listLeadsFiltered).not.toHaveBeenCalled();
  });
  it("passes the validated filter through and audits the read with the number of conditions, not their values", async () => {
    const f = { q: "pat", statuses: ["new" as const], createdFrom: "2026-10-01" };
    await appRouter.createCaller(ctx("admin")).admin.crmLeads(f);
    expect(d.listLeadsFiltered).toHaveBeenCalledWith(f);
    const reason = (d.appendLoginAudit.mock.calls.at(-1)?.[0] as { reason: string }).reason;
    expect(reason).toContain("admin.read.crm_leads(filters=3)");
    expect(reason).not.toContain("pat");
  });
  it("works with no input and refuses an invalid filter before reading", async () => {
    await expect(appRouter.createCaller(ctx("admin")).admin.crmLeads()).resolves.toMatchObject({ rows: [] });
    await expect(appRouter.createCaller(ctx("admin")).admin.crmLeads({ createdFrom: "2026-10-20", createdTo: "2026-10-01" })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx("admin")).admin.crmLeads({ owner: "me" } as never)).rejects.toThrow();
    expect(d.listLeadsFiltered).toHaveBeenCalledTimes(1);
  });
});
