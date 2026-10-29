/*
 * P0-05 / C09 (SRS 13.5, 12.5): company-wide revenue belongs to the Super Admin
 * Executive Dashboard. An Admin keeps the invoices and the outstanding view but
 * never receives the revenue aggregates, whatever endpoint, export or report
 * could carry them. These tests drive the real routers for every role.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getDb: vi.fn(async () => null),
  readFinancialSummary: vi.fn(),
  readMonthlyHistory: vi.fn(),
  readExportDataset: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getDb: m.getDb,
    appendLoginAudit: vi.fn(async () => {}),
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 5, kind: "totp", verifiedAt: new Date() }]),
    readFinancialSummary: m.readFinancialSummary,
    readMonthlyHistory: m.readMonthlyHistory,
    readExportDataset: m.readExportDataset,
  };
});

import { appRouter } from "./routers";
import { shapeSummaryForRole, type AdminSummary } from "./routers/admin";
import { shapeFinancialSummaryForRole } from "./db/srsSales";
import { buildReportBody } from "./_core/operations";
import { mayViewCompanyRevenue } from "../shared/srsRules";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
const ctx = (role: U["role"] | null): TrpcContext => ({
  user: role ? ({ id: 5, openId: `t-${role}`, email: "x@example.com", name: "X", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as U) : null,
  impersonation: null,
  req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
  res: { clearCookie: () => {} } as TrpcContext["res"],
});

const FIN = { currency: "EUR", outstandingCents: 120_000, overdueCents: 30_000, paidLast30DaysCents: 987_654, paidLast90DaysCents: 2_345_678, openInvoices: 4, overdueInvoices: 1, monthlyRecurringCents: 555_000, activeSubscriptions: 7 };
const HIST = [{ month: "2026-09", leads: 3, paidCents: 424_242, wonDeals: 1 }];

beforeEach(() => {
  vi.clearAllMocks();
  m.getDb.mockResolvedValue(null);
  m.readFinancialSummary.mockResolvedValue({ ...FIN });
  m.readMonthlyHistory.mockResolvedValue(HIST.map((h) => ({ ...h })));
});

describe("who may see company revenue", () => {
  it("is the Super Admin and nobody else", () => {
    expect(mayViewCompanyRevenue("super_admin")).toBe(true);
    for (const r of ["admin", "technical_operator", "client", "developer", "user", null, undefined, ""]) expect(mayViewCompanyRevenue(r)).toBe(false);
  });
});

describe("admin.summary", () => {
  it("withholds revenue from an Admin and returns it to a Super Admin", async () => {
    const admin = await appRouter.createCaller(ctx("admin")).admin.summary();
    expect(admin.kpis.revenueMTD).toBeNull();
    expect(admin.kpis.revenueDelta).toBeNull();
    expect(admin.revenueByDay).toEqual([]);
    expect(admin.revenueVisible).toBe(false);

    const sa = await appRouter.createCaller(ctx("super_admin")).admin.summary();
    expect(sa.kpis.revenueMTD).toBe(0); // database offline: an honest zero, but a number
    expect(sa.revenueVisible).toBe(true);
  });

  it("refuses Technical Operator, Client, Developer and anonymous callers outright", async () => {
    for (const role of ["technical_operator", "client", "developer", "user", null] as const) {
      await expect(appRouter.createCaller(ctx(role)).admin.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("removes every revenue field from a populated summary for an Admin (shape check)", () => {
    const full: AdminSummary = {
      kpis: { revenueMTD: 98_000, revenueDelta: 12.5, activeClients: 3, activeClientsDelta: 0, aiScans: 4, aiScansDelta: 0, openProjects: 2, openProjectsDelta: 0, openTickets: 1, openTicketsDelta: 0, compareLabel: "last month" },
      recentActivity: [], liveFeed: [], revenueByDay: [{ day: "2026-10-02", amountCents: 5000 }], revenueVisible: true, generatedAtMs: 1,
    };
    const forAdmin = shapeSummaryForRole(full, "admin");
    expect(JSON.stringify(forAdmin)).not.toMatch(/98000|12\.5|5000/);
    expect(forAdmin.kpis.activeClients).toBe(3); // non-financial KPIs are untouched
    expect(shapeSummaryForRole(full, "super_admin").kpis.revenueMTD).toBe(98_000);
    expect(shapeSummaryForRole(full, "technical_operator").kpis.revenueMTD).toBeNull();
    expect(shapeSummaryForRole(full, undefined).kpis.revenueMTD).toBeNull();
  });
});

describe("adminOps.financialSummary", () => {
  it("gives an Admin outstanding and overdue but not paid totals or recurring revenue", async () => {
    const f = (await appRouter.createCaller(ctx("admin")).adminOps.financialSummary())!;
    expect(f.outstandingCents).toBe(120_000);
    expect(f.openInvoices).toBe(4);
    expect(f.overdueCents).toBe(30_000);
    expect(f.paidLast30DaysCents).toBeNull();
    expect(f.paidLast90DaysCents).toBeNull();
    expect(f.monthlyRecurringCents).toBeNull();
    expect(f.revenueVisible).toBe(false);
    expect(JSON.stringify(f)).not.toMatch(/987654|2345678|555000/);
  });

  it("gives the Super Admin everything", async () => {
    const f = (await appRouter.createCaller(ctx("super_admin")).adminOps.financialSummary())!;
    expect(f.paidLast30DaysCents).toBe(987_654);
    expect(f.monthlyRecurringCents).toBe(555_000);
    expect(f.revenueVisible).toBe(true);
  });

  it("refuses a Technical Operator and a Client", async () => {
    for (const role of ["technical_operator", "client"] as const) {
      await expect(appRouter.createCaller(ctx(role)).adminOps.financialSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("handles an unavailable database for both roles", async () => {
    m.readFinancialSummary.mockResolvedValue(null);
    expect(await appRouter.createCaller(ctx("admin")).adminOps.financialSummary()).toBeNull();
    expect(shapeFinancialSummaryForRole(null, "super_admin")).toBeNull();
  });
});

describe("adminOps.history", () => {
  it("withholds monthly paid revenue from an Admin but keeps leads and deals", async () => {
    const rows = await appRouter.createCaller(ctx("admin")).adminOps.history();
    expect(rows).toEqual([{ month: "2026-09", leads: 3, paidCents: null, wonDeals: 1 }]);
  });
  it("returns it to the Super Admin", async () => {
    const rows = await appRouter.createCaller(ctx("super_admin")).adminOps.history();
    expect(rows[0]!.paidCents).toBe(424_242);
  });
  it("refuses a Technical Operator and a Client", async () => {
    for (const role of ["technical_operator", "client"] as const) {
      await expect(appRouter.createCaller(ctx(role)).adminOps.history()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("adminOps.exportDataset", () => {
  it("still exports invoice level records for an Admin (authorised billing records, not aggregates)", async () => {
    m.readExportDataset.mockResolvedValue({ columns: ["number", "status"], rows: [{ number: "INV-1", status: "paid" }] });
    const r = await appRouter.createCaller(ctx("admin")).adminOps.exportDataset({ dataset: "invoices" });
    expect(r.rows).toBe(1);
    expect(r.csv).toContain("INV-1");
  });
});

describe("scheduled billing report", () => {
  it("lists outstanding and overdue only, with no paid totals or recurring revenue", async () => {
    const body = await buildReportBody("billing");
    const text = body.lines.join("\n");
    expect(text).not.toMatch(/Paid in the last|Monthly recurring/i);
    expect(text).not.toMatch(/987,?654|555,?000/);
  });
});
