/*
 * IO SKY — Admin Portal · server router.
 *
 * Single source of truth for every /admin/* surface. The router exposes:
 *   - summary / liveFeed / recentLoginAudit (Executive Overview)
 *   - one read endpoint per sidebar module (crm, clients, ai-scans,
 *     reports, projects, billing, documents, developers, security,
 *     campaigns, agents, automations, analytics, users, audit, settings,
 *     support)
 *   - a generic audited "action stub" mutation (`admin.action`) used by
 *     non-implemented buttons so every interactive UI element still
 *     produces an audit row
 *   - admin.viewAs — Super-Admin-only impersonation that mints a
 *     short-lived audit-tracked breadcrumb (the actual session swap is
 *     handled by an Express route, this RPC is a permission gate +
 *     audit writer)
 *
 * Every procedure below is gated by `adminProcedure` (which already
 * enforces role === "admin"). Every read writes a `read.<module>` audit
 * row, every mutation writes a per-action audit row, so the Audit Logs
 * module reflects exactly what an operator did.
 *
 * The router is *defensive*: each query is wrapped in `safe(...)` so a
 * missing table or transient DB hiccup downgrades gracefully to seed
 * numbers (matching the reference screenshot). That means the dashboard
 * never goes blank, even on first boot before the seed migration runs.
 */
import { z } from "zod";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminProcedure, superAdminProcedure, isAdminRole, router } from "../_core/trpc";
import { getRequestMeta } from "../_core/requestMeta";
import {
  getDb,
  appendLoginAudit,
  listRecentBookings,
  listRecentAiScans,
  listEmailDeliveryLog,
  listFailedEmailDeliveries,
  getAiScanById,
  createClientReport,
  updateClientReport,
  createClientProject,
  updateClientProject,
  getClientProjectById,
  createClientProjectMilestone,
  updateClientProjectMilestone,
  listOrganizations,
  createOrganization,
  updateOrganization,
  getOrganizationBySlug,
  setUserRole,
  assignUserOrganization,
  getUserById,
  listPlatformSettings,
  updatePlatformSetting,
  reviewClientDocument,
  setClientDocumentRetentionNote,
  listClientDocumentVersions,
} from "../db";
import type { AiScanReportPayload } from "../../shared/aiScanModel";
import {
  organizations,
  bookings,
  leads,
  clientProjects,
  clientProjectMilestones,
  clientSupportTickets,
  clientReports,
  clientInvoices,
  clientDocuments,
  clientNotifications,
  clientMessages,
  loginAudit,
  aiScans,
  users,
  developerProfiles,
  developerAccessScopes,
  developerAccessRequests,
  developerSecurityEvents,
  mfaFactors,
} from "../../drizzle/schema";

// ---------------------------------------------------------------------------
// Audit helper
// ---------------------------------------------------------------------------

async function recordAdminEvent(opts: {
  ctx: any;
  reason: string;
  outcome?: "success" | "failed";
}) {
  try {
    const { ip, userAgent } = getRequestMeta(opts.ctx?.req);

    await appendLoginAudit({
      userId: opts.ctx?.user?.id ?? null,
      identifier: opts.ctx?.user?.email ?? null,
      provider: "admin",
      outcome: opts.outcome ?? "success",
      reason: opts.reason.slice(0, 200),
      ip,
      userAgent,
    });
  } catch (err) {
    // Never fail the read/write because of an audit hiccup — but a failed
    // write to the Audit Logs table must not be silent either. This is the
    // system's compliance/security trail; losing an entry with no trace
    // defeats the point of having it. Until a real monitoring/alerting
    // pipeline exists (tracked separately), a loud console.error is the
    // honest minimum — at least it's visible in server logs instead of
    // vanishing into an empty catch block.
    console.error(
      `[AdminAudit] FAILED to record admin event (reason="${opts.reason}", userId=${opts.ctx?.user?.id ?? "?"}):`,
      err,
    );
  }
}

// ---------------------------------------------------------------------------
// Defensive query helper
// ---------------------------------------------------------------------------

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// 1) Executive Overview — `summary`
// ---------------------------------------------------------------------------

export interface AdminSummaryKpis {
  revenueMTD: number;
  revenueDelta: number;
  activeClients: number;
  /** 0 when no real month-over-month comparison basis exists yet (see buildSummary()). */
  activeClientsDelta: number;
  aiScans: number;
  aiScansDelta: number;
  openProjects: number;
  /** 0 when no real month-over-month comparison basis exists yet (see buildSummary()). */
  openProjectsDelta: number;
  openTickets: number;
  /** 0 when no real month-over-month comparison basis exists yet (see buildSummary()). */
  openTicketsDelta: number;
  compareLabel: string;
}

export interface AdminSummary {
  kpis: AdminSummaryKpis;
  recentActivity: Array<{
    id: string;
    icon:
      | "lead"
      | "scan"
      | "report"
      | "payment"
      | "developer"
      | "automation"
      | "security"
      | "client";
    title: string;
    body: string;
    occurredAtMs: number;
  }>;
  liveFeed: Array<{ id: string; message: string; occurredAtMs: number }>;
  /** Real day-by-day paid revenue for the current month, sorted ascending by day. Empty when no invoices have been paid yet. */
  revenueByDay: Array<{ day: string; amountCents: number }>;
  generatedAtMs: number;
}

async function buildSummary(): Promise<AdminSummary> {
  const now = Date.now();
  const startOfMonthMs = (() => {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  })();
  const previousMonthStartMs = (() => {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  })();

  const db = await getDb();
  if (!db) {
    // Was: returned a full shape of hardcoded numbers (127430 revenue, 62
    // clients, 99.99% "system health" etc) presented as a normal successful
    // response - indistinguishable from real data. Fixed to honestly report
    // "no data" (real zeros/empty arrays) instead of fabricating positive
    // numbers, while still succeeding rather than throwing - every other
    // read in this file degrades the same way (safe() wraps each query with
    // a zero/empty fallback) rather than taking the whole Executive
    // Overview page down over one unreachable database call.
    return {
      kpis: {
        revenueMTD: 0,
        revenueDelta: 0,
        activeClients: 0,
        activeClientsDelta: 0,
        aiScans: 0,
        aiScansDelta: 0,
        openProjects: 0,
        openProjectsDelta: 0,
        openTickets: 0,
        openTicketsDelta: 0,
        compareLabel: "last month",
      },
      recentActivity: [],
      liveFeed: [],
      revenueByDay: [],
      generatedAtMs: now,
    };
  }

  const [
    activeClients,
    newOrgsThisMonth,
    newOrgsLastMonth,
    openProjects,
    openTickets,
    aiScansThisMonth,
    aiScansLastMonth,
    invoicePaidSumThisMonth,
    invoicePaidSumLastMonth,
    revenueByDayThisMonth,
    recentBookings,
    recentLeads,
  ] = await Promise.all([
    safe(async () => {
      const r = await db.select({ c: count() }).from(organizations);
      return Number(r[0]?.c ?? 0);
    }, 0),
    safe(async () => {
      const r = await db
        .select({ c: count() })
        .from(organizations)
        .where(gte(organizations.createdAt, new Date(startOfMonthMs) as any));
      return Number(r[0]?.c ?? 0);
    }, 0),
    safe(async () => {
      const r = await db
        .select({ c: count() })
        .from(organizations)
        .where(
          sql`${organizations.createdAt} >= ${new Date(previousMonthStartMs)} AND ${organizations.createdAt} < ${new Date(startOfMonthMs)}`,
        );
      return Number(r[0]?.c ?? 0);
    }, 0),
    safe(async () => {
      const r = await db
        .select({ c: count() })
        .from(clientProjects)
        .where(sql`${clientProjects.status} <> 'completed'`);
      return Number(r[0]?.c ?? 0);
    }, 0),
    safe(async () => {
      const r = await db
        .select({ c: count() })
        .from(clientSupportTickets)
        .where(sql`${clientSupportTickets.status} IN ('open','in_progress')`);
      return Number(r[0]?.c ?? 0);
    }, 0),
    safe(async () => {
      const r = await db
        .select({ c: count() })
        .from(aiScans)
        .where(gte(aiScans.createdAt, new Date(startOfMonthMs) as any));
      return Number(r[0]?.c ?? 0);
    }, 0),
    safe(async () => {
      const r = await db
        .select({ c: count() })
        .from(aiScans)
        .where(
          sql`${aiScans.createdAt} >= ${new Date(previousMonthStartMs)} AND ${aiScans.createdAt} < ${new Date(startOfMonthMs)}`,
        );
      return Number(r[0]?.c ?? 0);
    }, 0),
    safe(async () => {
      const r = await db
        .select({
          s: sql<number>`COALESCE(SUM(${clientInvoices.amountCents}), 0)`,
        })
        .from(clientInvoices)
        .where(
          sql`${clientInvoices.status} = 'paid' AND ${clientInvoices.paidMs} >= ${startOfMonthMs}`,
        );
      return Number(r[0]?.s ?? 0);
    }, 0),
    safe(async () => {
      const r = await db
        .select({
          s: sql<number>`COALESCE(SUM(${clientInvoices.amountCents}), 0)`,
        })
        .from(clientInvoices)
        .where(
          sql`${clientInvoices.status} = 'paid' AND ${clientInvoices.paidMs} >= ${previousMonthStartMs} AND ${clientInvoices.paidMs} < ${startOfMonthMs}`,
        );
      return Number(r[0]?.s ?? 0);
    }, 0),
    // Real day-by-day paid-revenue series for the Executive Overview's
    // Revenue Intelligence chart (client/src/pages/admin/sections/
    // ExecutiveOverview.tsx) - was previously a hand-drawn SVG shape with
    // hardcoded points and a fabricated "May 20, 2026 - EUR127,430"
    // annotation, entirely disconnected from real invoice data.
    safe(async () => {
      const rows = await db
        .select({
          day: sql<string>`to_char(to_timestamp(${clientInvoices.paidMs} / 1000.0), 'YYYY-MM-DD')`,
          s: sql<number>`COALESCE(SUM(${clientInvoices.amountCents}), 0)`,
        })
        .from(clientInvoices)
        .where(
          sql`${clientInvoices.status} = 'paid' AND ${clientInvoices.paidMs} >= ${startOfMonthMs}`,
        )
        .groupBy(sql`1`)
        .orderBy(sql`1`);
      return rows.map((r) => ({ day: r.day, amountCents: Number(r.s) }));
    }, [] as Array<{ day: string; amountCents: number }>),
    safe(async () => listRecentBookings(8), [] as Awaited<ReturnType<typeof listRecentBookings>>),
    safe(async () => {
      const rows = await db
        .select({
          id: leads.id,
          name: leads.fullName,
          source: leads.source,
          createdAt: leads.createdAt,
        })
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .limit(8);
      return rows as Array<{ id: number; name: string; source: string; createdAt: Date }>;
    }, [] as Array<{ id: number; name: string; source: string; createdAt: Date }>),
  ]);

  // Real values only - a genuine 0 (no revenue/clients/scans yet) must render
  // as 0, not silently become a fabricated positive number. Was: every one
  // of these fell back to a hardcoded "seed" value whenever the real count
  // was 0, making an honest "nothing has happened yet" state indistinguishable
  // from real activity.
  const revenueMTD = invoicePaidSumThisMonth / 100;
  const revenueLast = invoicePaidSumLastMonth / 100;
  const revenueDelta = revenueLast === 0 ? 0 : ((revenueMTD - revenueLast) / revenueLast) * 100;

  const aiScansDelta =
    aiScansLastMonth === 0
      ? aiScansThisMonth > 0
        ? 100
        : 0
      : ((aiScansThisMonth - aiScansLastMonth) / aiScansLastMonth) * 100;

  // Real month-over-month delta for "new clients" (organizations created
  // this period vs last), using the same pattern as aiScansDelta above.
  // openProjects/openTickets are live-state counts (currently open right
  // now) with no historical snapshot in this schema to compare against, so
  // their deltas are honestly 0 rather than a fabricated trend - see the
  // AdminSummaryKpis doc comments.
  const activeClientsDelta =
    newOrgsLastMonth === 0
      ? newOrgsThisMonth > 0
        ? 100
        : 0
      : ((newOrgsThisMonth - newOrgsLastMonth) / newOrgsLastMonth) * 100;

  const activity: AdminSummary["recentActivity"] = [];
  for (const b of recentBookings) {
    activity.push({
      id: `booking-${b.id}`,
      icon: "scan",
      title: "Discovery call booked",
      body: `${b.fullName} — ${b.serviceId}`,
      occurredAtMs: new Date(b.createdAt).getTime(),
    });
  }
  for (const l of recentLeads) {
    activity.push({
      id: `lead-${l.id}`,
      icon: "lead",
      title: "New lead captured",
      body: `${l.name ?? "Unknown"} · ${l.source ?? "direct"}`,
      occurredAtMs: l.createdAt ? new Date(l.createdAt).getTime() : Date.now(),
    });
  }
  activity.sort((a, b) => b.occurredAtMs - a.occurredAtMs);

  const feed: AdminSummary["liveFeed"] = activity.slice(0, 5).map((a) => ({
    id: a.id,
    message: a.title,
    occurredAtMs: a.occurredAtMs,
  }));

  return {
    kpis: {
      revenueMTD: Math.round(revenueMTD),
      revenueDelta: Number(revenueDelta.toFixed(1)),
      activeClients,
      activeClientsDelta: Number(activeClientsDelta.toFixed(1)),
      aiScans: aiScansThisMonth,
      aiScansDelta: Number(aiScansDelta.toFixed(1)),
      openProjects,
      openProjectsDelta: 0,
      openTickets,
      openTicketsDelta: 0,
      compareLabel: "last month",
    },
    recentActivity: activity.slice(0, 12),
    liveFeed: feed,
    revenueByDay: revenueByDayThisMonth,
    generatedAtMs: now,
  };
}

// ---------------------------------------------------------------------------
// 2) Module reads
// ---------------------------------------------------------------------------

export interface ModuleResponse<T> {
  rows: T[];
  total: number;
  generatedAtMs: number;
  source: "db" | "seed";
}

async function readCrm() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: leads.id,
          fullName: leads.fullName,
          email: leads.email,
          company: leads.company,
          source: leads.source,
          status: leads.status,
          interest: leads.interest,
          createdAt: leads.createdAt,
        })
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .limit(50),
    [] as any[],
  );
  return {
    rows,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readClients() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
          industry: organizations.industry,
          country: organizations.country,
          operationalScore: organizations.operationalScore,
          statusLabel: organizations.statusLabel,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .orderBy(desc(organizations.createdAt))
        .limit(100),
    [] as any[],
  );
  return {
    rows,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readProjects() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: clientProjects.id,
          organizationId: clientProjects.organizationId,
          name: clientProjects.name,
          phase: clientProjects.phase,
          progress: clientProjects.progress,
          status: clientProjects.status,
          startMs: clientProjects.startMs,
          targetMs: clientProjects.targetMs,
        })
        .from(clientProjects)
        .orderBy(desc(clientProjects.createdAt))
        .limit(100),
    [] as any[],
  );
  const milestoneCounts = await safe(
    async () => {
      const rs = await db
        .select({
          projectId: clientProjectMilestones.projectId,
          c: count(),
        })
        .from(clientProjectMilestones)
        .groupBy(clientProjectMilestones.projectId);
      return rs as Array<{ projectId: number; c: number }>;
    },
    [] as Array<{ projectId: number; c: number }>,
  );
  const milestoneMap = new Map<number, number>();
  for (const r of milestoneCounts) milestoneMap.set(r.projectId, Number(r.c ?? 0));
  const upcomingMilestones = await safe(
    () =>
      db
        .select({
          id: clientProjectMilestones.id,
          projectId: clientProjectMilestones.projectId,
          title: clientProjectMilestones.title,
          dueMs: clientProjectMilestones.dueMs,
          status: clientProjectMilestones.status,
        })
        .from(clientProjectMilestones)
        .where(sql`${clientProjectMilestones.status} <> 'completed' AND ${clientProjectMilestones.dueMs} IS NOT NULL`)
        .orderBy(clientProjectMilestones.dueMs)
        .limit(5),
    [] as any[],
  );
  return {
    rows: rows.map((r: any) => ({ ...r, milestones: milestoneMap.get(r.id) ?? 0 })),
    upcomingMilestones,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readBilling() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: clientInvoices.id,
          number: clientInvoices.number,
          organizationId: clientInvoices.organizationId,
          description: clientInvoices.description,
          amountCents: clientInvoices.amountCents,
          currency: clientInvoices.currency,
          status: clientInvoices.status,
          issuedMs: clientInvoices.issuedMs,
          dueMs: clientInvoices.dueMs,
          paidMs: clientInvoices.paidMs,
        })
        .from(clientInvoices)
        .orderBy(desc(clientInvoices.issuedMs))
        .limit(50),
    [] as any[],
  );
  return {
    rows,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readDocuments() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "unavailable" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: clientDocuments.id,
          name: clientDocuments.name,
          category: clientDocuments.category,
          mimeType: clientDocuments.mimeType,
          sizeBytes: clientDocuments.sizeBytes,
          uploadedBy: clientDocuments.uploadedBy,
          createdAt: clientDocuments.createdAt,
          version: clientDocuments.version,
          status: clientDocuments.status,
          reviewedAt: clientDocuments.reviewedAt,
          reviewNote: clientDocuments.reviewNote,
          retentionNote: clientDocuments.retentionNote,
        })
        .from(clientDocuments)
        .orderBy(desc(clientDocuments.createdAt))
        .limit(50),
    [] as any[],
  );
  return {
    rows,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readReports() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: clientReports.id,
          publicRef: clientReports.publicRef,
          title: clientReports.title,
          status: clientReports.status,
          createdAt: clientReports.createdAt,
        })
        .from(clientReports)
        .orderBy(desc(clientReports.createdAt))
        .limit(50),
    [] as any[],
  );
  return {
    rows,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readSupport() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: clientSupportTickets.id,
          publicRef: clientSupportTickets.publicRef,
          subject: clientSupportTickets.subject,
          category: clientSupportTickets.category,
          priority: clientSupportTickets.priority,
          status: clientSupportTickets.status,
          createdAt: clientSupportTickets.createdAt,
          organizationName: organizations.name,
        })
        .from(clientSupportTickets)
        .leftJoin(organizations, eq(clientSupportTickets.organizationId, organizations.id))
        .orderBy(desc(clientSupportTickets.createdAt))
        .limit(50),
    [] as any[],
  );
  return {
    rows,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readUsers() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          mfaMethod: users.mfaMethod,
          organizationId: users.organizationId,
          lastSignedIn: users.lastSignedIn,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.lastSignedIn))
        .limit(100),
    [] as any[],
  );
  return {
    rows,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readDevelopers() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: developerProfiles.id,
          userId: developerProfiles.userId,
          fullName: developerProfiles.fullName,
          country: developerProfiles.country,
          status: developerProfiles.status,
          availability: developerProfiles.availability,
          mfaRequired: developerProfiles.mfaRequired,
          approvedMs: developerProfiles.approvedMs,
        })
        .from(developerProfiles)
        .orderBy(desc(developerProfiles.createdAt))
        .limit(50),
    [] as any[],
  );
  const scopes = await safe(
    () =>
      db
        .select({
          developerId: developerAccessScopes.developerId,
          level: developerAccessScopes.level,
          status: developerAccessScopes.status,
          expiresMs: developerAccessScopes.expiresMs,
        })
        .from(developerAccessScopes)
        .orderBy(desc(developerAccessScopes.createdAt))
        .limit(200),
    [] as any[],
  );
  const pendingRequests = await safe(
    async () => {
      const r = await db
        .select({ c: count() })
        .from(developerAccessRequests)
        .where(sql`${developerAccessRequests.status} = 'pending'`);
      return Number(r[0]?.c ?? 0);
    },
    0,
  );
  return {
    rows,
    scopes,
    pendingRequests,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readSecurity() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select({
          id: developerSecurityEvents.id,
          kind: developerSecurityEvents.kind,
          severity: developerSecurityEvents.severity,
          message: developerSecurityEvents.message,
          ip: developerSecurityEvents.ip,
          acknowledgedAt: developerSecurityEvents.acknowledgedAt,
          createdAt: developerSecurityEvents.createdAt,
        })
        .from(developerSecurityEvents)
        .orderBy(desc(developerSecurityEvents.createdAt))
        .limit(50),
    [] as any[],
  );
  const failedLogins24h = await safe(
    async () => {
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const r = await db
        .select({ c: count() })
        .from(loginAudit)
        .where(
          sql`${loginAudit.outcome} = 'failed' AND ${loginAudit.createdAt} >= ${new Date(since)}`,
        );
      return Number(r[0]?.c ?? 0);
    },
    0,
  );
  return {
    rows,
    failedLogins24h,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readAudit() {
  const db = await getDb();
  if (!db) {
    return {
      rows: [],
      total: 0,
      generatedAtMs: Date.now(),
      source: "seed" as const,
    };
  }
  const rows = await safe(
    () =>
      db
        .select()
        .from(loginAudit)
        .orderBy(desc(loginAudit.createdAt))
        .limit(200),
    [] as any[],
  );
  const failures = rows.filter((r: any) => r.outcome !== "success").length;
  return {
    rows,
    total: rows.length,
    failures,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

async function readMfa() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, mfaEnrolled: 0, mfaEnrolledPct: 0, byRole: [] as Array<{ role: string; total: number; enrolled: number }>, source: "unavailable" as const };
  const totalUsers = await safe(
    async () => {
      const r = await db.select({ c: count() }).from(users);
      return Number(r[0]?.c ?? 0);
    },
    0,
  );
  const mfaEnrolled = await safe(
    async () => {
      const r = await db
        .select({ c: sql<number>`COUNT(DISTINCT ${mfaFactors.userId})` })
        .from(mfaFactors)
        .where(sql`${mfaFactors.verifiedAt} IS NOT NULL`);
      return Number(r[0]?.c ?? 0);
    },
    0,
  );
  const mfaEnrolledPct =
    totalUsers === 0 ? 0 : Number(((mfaEnrolled / totalUsers) * 100).toFixed(1));

  /**
   * Milestone 2 §2.5 — "broader MFA-enforcement surfacing". Per-role
   * compliance breakdown, real (grouped query, not the previously-dead
   * `mfaPosture` endpoint's aggregate-only shape). Deliberately visibility
   * only: this surfaces who is/isn't enrolled per role so an operator can
   * actually see and follow up on gaps. It does NOT add a hard login-time
   * MFA gate for admin/client/super_admin/technical_operator roles (unlike
   * `developer`, which already has one via resolveDeveloperContext) —
   * that would touch every authenticated request path in the app and
   * needs to be verified against a live session flow, which the currently
   * unreachable Supabase project makes impossible to do safely in this
   * pass. Documented here rather than silently built half-checked.
   */
  const byRole = await safe(
    async () => {
      const rows = await db
        .select({
          role: users.role,
          total: count(),
          enrolled: sql<number>`COUNT(DISTINCT CASE WHEN ${mfaFactors.verifiedAt} IS NOT NULL THEN ${users.id} END)`,
        })
        .from(users)
        .leftJoin(mfaFactors, eq(mfaFactors.userId, users.id))
        .groupBy(users.role);
      return rows.map((r) => ({
        role: r.role,
        total: Number(r.total ?? 0),
        enrolled: Number(r.enrolled ?? 0),
      }));
    },
    [] as Array<{ role: string; total: number; enrolled: number }>,
  );

  return { totalUsers, mfaEnrolled, mfaEnrolledPct, byRole, source: "db" as const };
}

// Synthesised but typed module data — for surfaces with no schema yet
// (campaigns, agents, automations, ai-scans). Returning typed deterministic
// content keeps the UI honest about loading/empty/error states.
async function synthesisedAiScans() {
  // Real read from the ai_scans table. Maps engine rows into the shape the
  // admin AI Scans table expects. Empty table -> empty rows (honest empty
  // state in the UI), never fabricated numbers.
  const scans = await listRecentAiScans(50);
  const statusMap: Record<string, string> = {
    pending: "in_progress",
    scoring: "in_progress",
    ready: "completed",
    failed: "review",
  };
  const rows = scans.map((s) => {
    const createdMs =
      s.createdAt instanceof Date ? s.createdAt.getTime() : new Date(s.createdAt as any).getTime();
    const scoredMs =
      s.scoredAt instanceof Date
        ? s.scoredAt.getTime()
        : s.scoredAt
          ? new Date(s.scoredAt as any).getTime()
          : null;
    return {
      id: `AS-${s.id}`,
      target: s.company || s.fullName || "—",
      operator: "AI Scan engine",
      score: s.overallScore ?? 0,
      status: statusMap[s.status] ?? s.status,
      durationSec: scoredMs ? Math.max(0, Math.round((scoredMs - createdMs) / 1000)) : 0,
      createdAtMs: createdMs,
    };
  });
  return {
    rows,
    total: rows.length,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

/**
 * Milestone 2 §2.5 — Business Intelligence dashboards. Previously
 * `admin.analytics` returned a hardcoded funnel (412/367/318/187/134) and
 * a "top contributing scans by revenue" list with fabricated EUR figures —
 * neither backed by any real table. Real funnel, computed over a rolling
 * 30-day window from the three tables that actually exist for it
 * (bookings, ai_scans, leads); "top scans" now ranks by real AI Scan
 * score (there is no per-scan revenue attribution anywhere in this schema,
 * so ranking by fabricated revenue was never honestly fixable — ranking by
 * the score the engine actually produced is the real equivalent).
 */
async function readBusinessIntelligence() {
  const db = await getDb();
  if (!db) {
    return {
      funnel: [] as Array<{ stage: string; count: number; pct: number }>,
      topScans: [] as Array<{ name: string; score: number }>,
      leads30d: 0,
      leadsDelta: 0,
      bookings30d: 0,
      aiScans30d: 0,
      wonDeals30d: 0,
      generatedAtMs: Date.now(),
      source: "unavailable" as const,
    };
  }

  const now = Date.now();
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const since60d = new Date(now - 60 * 24 * 60 * 60 * 1000);

  const bookingsTotal = await safe(async () => {
    const r = await db.select({ c: count() }).from(bookings).where(gte(bookings.createdAt, since30d));
    return Number(r[0]?.c ?? 0);
  }, 0);
  const bookingsCompleted = await safe(async () => {
    const r = await db
      .select({ c: count() })
      .from(bookings)
      .where(sql`${bookings.status} = 'completed' AND ${bookings.createdAt} >= ${since30d}`);
    return Number(r[0]?.c ?? 0);
  }, 0);
  const aiScans30d = await safe(async () => {
    const r = await db.select({ c: count() }).from(aiScans).where(gte(aiScans.createdAt, since30d));
    return Number(r[0]?.c ?? 0);
  }, 0);
  const qualifiedLeads = await safe(async () => {
    const r = await db
      .select({ c: count() })
      .from(leads)
      .where(
        sql`${leads.status} IN ('qualified', 'engaged', 'won') AND ${leads.createdAt} >= ${since30d}`,
      );
    return Number(r[0]?.c ?? 0);
  }, 0);
  const wonDeals30d = await safe(async () => {
    const r = await db
      .select({ c: count() })
      .from(leads)
      .where(sql`${leads.status} = 'won' AND ${leads.createdAt} >= ${since30d}`);
    return Number(r[0]?.c ?? 0);
  }, 0);
  const leads30d = await safe(async () => {
    const r = await db.select({ c: count() }).from(leads).where(gte(leads.createdAt, since30d));
    return Number(r[0]?.c ?? 0);
  }, 0);
  const leadsPrior30d = await safe(async () => {
    const r = await db
      .select({ c: count() })
      .from(leads)
      .where(sql`${leads.createdAt} >= ${since60d} AND ${leads.createdAt} < ${since30d}`);
    return Number(r[0]?.c ?? 0);
  }, 0);
  const leadsDelta =
    leadsPrior30d === 0 ? (leads30d > 0 ? 100 : 0) : ((leads30d - leadsPrior30d) / leadsPrior30d) * 100;

  const pct = (n: number) => (bookingsTotal === 0 ? 0 : Math.round((n / bookingsTotal) * 100));
  const funnel = [
    { stage: "Discovery calls booked", count: bookingsTotal, pct: 100 },
    { stage: "Calls completed", count: bookingsCompleted, pct: pct(bookingsCompleted) },
    { stage: "AI Scans triggered", count: aiScans30d, pct: pct(aiScans30d) },
    { stage: "Qualified leads", count: qualifiedLeads, pct: pct(qualifiedLeads) },
    { stage: "Won deals", count: wonDeals30d, pct: pct(wonDeals30d) },
  ];

  const topScans = await safe(async () => {
    const rows = await listRecentAiScans(50);
    return rows
      .filter((s) => s.overallScore != null)
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
      .slice(0, 4)
      .map((s) => ({ name: s.company || s.fullName || `Scan #${s.id}`, score: s.overallScore ?? 0 }));
  }, [] as Array<{ name: string; score: number }>);

  return {
    funnel,
    topScans,
    leads30d,
    leadsDelta: Number(leadsDelta.toFixed(1)),
    bookings30d: bookingsTotal,
    aiScans30d,
    wonDeals30d,
    generatedAtMs: Date.now(),
    source: "db" as const,
  };
}

function synthesisedCampaigns() {
  return {
    rows: [
      { id: "C-218", name: "Q2 Discovery Call Push", channel: "email", recipients: 8420, openedPct: 42.6, clickedPct: 18.2, status: "running",  startedMs: Date.now() - 3 * 24 * 3600_000 },
      { id: "C-217", name: "AI Scan Reactivation",  channel: "email", recipients: 3120, openedPct: 38.4, clickedPct: 12.7, status: "running",  startedMs: Date.now() - 5 * 24 * 3600_000 },
      { id: "C-216", name: "MFA Enrolment Reminder",channel: "sms",   recipients: 942,  openedPct: 99.2, clickedPct: 41.0, status: "completed",startedMs: Date.now() - 10 * 24 * 3600_000 },
      { id: "C-215", name: "Renewal Nudge — May",   channel: "email", recipients: 612,  openedPct: 51.1, clickedPct: 22.4, status: "scheduled", startedMs: Date.now() + 2 * 24 * 3600_000 },
    ],
    total: 4,
    generatedAtMs: Date.now(),
    source: "seed" as const,
  };
}

function synthesisedAgents() {
  return {
    rows: [
      { id: "AG-01", name: "Inbound IVR",   kind: "ivr",      activeCalls: 7, csat: 4.7, escalations: 1 },
      { id: "AG-02", name: "Outbound AI",   kind: "voice-ai", activeCalls: 12,csat: 4.5, escalations: 3 },
      { id: "AG-03", name: "Triage Bot",    kind: "chat",     activeCalls: 31,csat: 4.6, escalations: 0 },
      { id: "AG-04", name: "Renewal Bot",   kind: "voice-ai", activeCalls: 4, csat: 4.4, escalations: 1 },
    ],
    total: 4,
    generatedAtMs: Date.now(),
    source: "seed" as const,
  };
}

function synthesisedAutomations() {
  return {
    rows: [
      { id: "WF-218", name: "AI Scan → Lead",            trigger: "scan.completed", runs24h: 142, successPct: 99.4, status: "healthy" },
      { id: "WF-217", name: "Discovery Call Confirmation",trigger: "booking.created",runs24h: 28,  successPct: 100,  status: "healthy" },
      { id: "WF-216", name: "Invoice Retry",             trigger: "payment.failed", runs24h: 12,  successPct: 91.7, status: "degraded" },
      { id: "WF-215", name: "Owner Alert · Critical",    trigger: "critical.event", runs24h: 4,   successPct: 100,  status: "healthy" },
      { id: "WF-214", name: "Renewal Nudge",             trigger: "cron.daily.09",  runs24h: 1,   successPct: 100,  status: "healthy" },
    ],
    total: 5,
    generatedAtMs: Date.now(),
    source: "seed" as const,
  };
}

// ---------------------------------------------------------------------------
// 3) admin.action — generic audited stub for non-implemented buttons
// ---------------------------------------------------------------------------

const adminActionInput = z.object({
  module: z.string().min(1).max(64),
  action: z.string().min(1).max(64),
  /** Optional opaque payload — only the keys are recorded into the audit log to keep PII out. */
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

// ---------------------------------------------------------------------------
// 4) admin.viewAs — short-lived impersonation breadcrumb
// ---------------------------------------------------------------------------

const viewAsInput = z.object({
  target: z.enum(["client", "developer"]),
  reason: z.string().min(4).max(200),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const adminRouter = router({
  // -- Executive Overview --------------------------------------------------
  summary: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.summary" });
    return buildSummary();
  }),

  liveFeed: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.live_feed" });
    const summary = await buildSummary();
    return summary.liveFeed;
  }),

  recentLoginAudit: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.recent_login_audit" });
    const db = await getDb();
    if (!db) return [];
    return safe(
      () =>
        db
          .select()
          .from(loginAudit)
          .orderBy(desc(loginAudit.createdAt))
          .limit(100),
      [] as any[],
    );
  }),

  /**
   * Milestone 2 §2.3 — "make failures visible": every send attempt
   * (booking/contact/devapp/owner-alert) is logged to email_delivery_log
   * (server/email.ts) and updated in place as Resend webhook events
   * arrive (server/_core/resendWebhookRoute.ts). This surfaces both the
   * full recent log and the failures-only view an operator actually cares
   * about day to day.
   */
  emailDeliveryLog: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.email_delivery_log" });
    return safe(() => listEmailDeliveryLog(200), []);
  }),
  emailDeliveryFailures: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.email_delivery_failures" });
    return safe(() => listFailedEmailDeliveries(200), []);
  }),

  // -- Module reads --------------------------------------------------------
  crm: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.crm" });
    return readCrm();
  }),
  clients: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.clients" });
    return readClients();
  }),
  aiScans: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.ai_scans" });
    return await synthesisedAiScans();
  }),
  reports: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.reports" });
    return readReports();
  }),
  projects: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.projects" });
    return readProjects();
  }),
  billing: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.billing" });
    return readBilling();
  }),
  documents: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.documents" });
    return readDocuments();
  }),
  /**
   * Milestone 2 §2.6 — document lifecycle: approve/reject a pending
   * document. `documentId` alone (no organizationId) is enough since this
   * is an admin-side action across all orgs, matching every other
   * admin.* mutation's scope.
   */
  reviewDocument: adminProcedure
    .input(
      z.object({
        documentId: z.number().int().positive(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await reviewClientDocument(
        input.documentId,
        input.decision,
        ctx.user.id,
        input.note ?? null,
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      }
      await recordAdminEvent({ ctx, reason: `admin.document.${input.decision}(${input.documentId})` });
      return updated;
    }),
  /** Milestone 2 §2.6 — documented retention policy record (not an enforced TTL, see schema doc comment). */
  setDocumentRetention: adminProcedure
    .input(z.object({ documentId: z.number().int().positive(), note: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await setClientDocumentRetentionNote(input.documentId, input.note);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      }
      await recordAdminEvent({ ctx, reason: `admin.document.set_retention(${input.documentId})` });
      return updated;
    }),
  /** Milestone 2 §2.6 — full version chain for one document's group. */
  listDocumentVersions: adminProcedure
    .input(z.object({ organizationId: z.number().int().positive(), documentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await recordAdminEvent({ ctx, reason: `admin.document.list_versions(${input.documentId})` });
      return safe(() => listClientDocumentVersions(input.organizationId, input.documentId), []);
    }),
  developers: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.developers" });
    return readDevelopers();
  }),
  security: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.security" });
    return readSecurity();
  }),
  campaigns: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.campaigns" });
    return synthesisedCampaigns();
  }),
  agents: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.agents" });
    return synthesisedAgents();
  }),
  automations: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.automations" });
    return synthesisedAutomations();
  }),
  analytics: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.analytics" });
    return readBusinessIntelligence();
  }),
  users: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.users" });
    return readUsers();
  }),
  audit: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.audit" });
    return readAudit();
  }),
  /**
   * Milestone 2 §2.4: this is a reference/documentation panel, not a
   * configurable-settings system backed by real state — there is no
   * database table for "branding"/"integrations"/etc config in this
   * schema, so unlike users/audit/support/developers above there is no
   * real query this could bind to without building that system first
   * (a large, separate feature, not a wiring fix). Previously mislabeled
   * `source: "db"` despite being a static literal — corrected to "static"
   * so the client can render it as reference info rather than live state.
   * client/src/pages/admin/sections/AutomationsAnalyticsRest.tsx's
   * SystemSettings component carries the matching `sampleData` disclosure.
   */
  /**
   * Milestone 2 §2.5 — platform configuration store. Was a hardcoded
   * literal list (explicitly disclosed as `source: "static"` since §2.4);
   * now backed by the real `platform_settings` table (auto-seeded with the
   * same original copy on first read, so nothing visually regresses until
   * a super_admin actually edits a row). See platformSettings.ts /
   * drizzle/schema.ts for the deliberate scope boundary — this is a
   * labeled config-state store, not live third-party provider wiring.
   */
  settings: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.settings" });
    const rows = await safe(() => listPlatformSettings(), []);
    return {
      sections: rows.map((r) => ({ key: r.key, title: r.title, desc: r.description ?? "", state: r.value })),
      generatedAtMs: Date.now(),
      source: rows.length > 0 ? ("db" as const) : ("unavailable" as const),
    };
  }),
  updateSetting: superAdminProcedure
    .input(
      z.object({
        key: z.string().min(1).max(128),
        value: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await updatePlatformSetting(input.key, { value: input.value }, ctx.user.id);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Setting not found." });
      }
      await recordAdminEvent({ ctx, reason: `admin.settings.update(${input.key})` });
      return updated;
    }),
  support: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.support" });
    return readSupport();
  }),

  // -- Reports & Projects mutations (Milestone 2 §2.4) ---------------------
  // Previously read-only: client_reports/client_projects/client_project_
  // milestones had no create/update path anywhere in the app, so those
  // tables could never actually be populated outside a manual SQL insert.

  createReport: adminProcedure
    .input(
      z.object({
        organizationId: z.number().int().positive(),
        title: z.string().min(1).max(200),
        score: z.number().int().min(0).max(100),
        delta: z.number().int().optional(),
        summary: z.string().max(4000).optional(),
        status: z.enum(["draft", "ready", "delivered"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const report = await createClientReport(input);
      if (!report) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create report." });
      }
      await recordAdminEvent({ ctx, reason: `admin.report.create(org=${input.organizationId})` });
      return report;
    }),

  updateReport: adminProcedure
    .input(
      z.object({
        organizationId: z.number().int().positive(),
        id: z.number().int().positive(),
        title: z.string().min(1).max(200).optional(),
        score: z.number().int().min(0).max(100).optional(),
        delta: z.number().int().optional(),
        summary: z.string().max(4000).optional(),
        status: z.enum(["draft", "ready", "delivered"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { organizationId, id, ...updates } = input;
      const report = await updateClientReport(organizationId, id, updates);
      if (!report) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found for this organization." });
      }
      await recordAdminEvent({ ctx, reason: `admin.report.update(${id})` });
      return report;
    }),

  /**
   * Milestone 2 §2.4 — "bridge AI Scan funnel data to the Client Portal
   * reports tab." Promotes a completed AI Scan (public-intake, anonymous
   * marketing funnel — ai_scans has no organizationId) into a real
   * client_reports row once that prospect has become a client with a real
   * organization. Does not copy the PDF (it lives under the ai-scan-reports
   * bucket, a different tenancy shape than client-portal's
   * {orgId}/reports/{filename} convention — see MILESTONE2_PROGRESS.md
   * §2.1); pdfKey stays null until a formal report PDF is generated for
   * the client's own portal.
   */
  promoteAiScanToClientReport: adminProcedure
    .input(
      z.object({
        aiScanId: z.number().int().positive(),
        organizationId: z.number().int().positive(),
        title: z.string().min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scan = await getAiScanById(input.aiScanId);
      if (!scan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "AI Scan not found." });
      }
      if (scan.status !== "ready" || scan.overallScore === null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This AI Scan has not finished scoring yet.",
        });
      }
      let summary: string | undefined;
      if (scan.reportPayload) {
        try {
          const payload = JSON.parse(scan.reportPayload) as AiScanReportPayload;
          summary = payload.executiveSummary;
        } catch {
          // Corrupted payload shouldn't block the bridge — the score alone
          // is still enough to create a meaningful report row.
        }
      }
      const report = await createClientReport({
        organizationId: input.organizationId,
        title: input.title ?? `AI Scan — ${scan.company ?? scan.fullName}`,
        scanType: "ai-scan",
        score: scan.overallScore,
        summary,
        status: "ready",
      });
      if (!report) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create report." });
      }
      await recordAdminEvent({
        ctx,
        reason: `admin.report.promote_ai_scan(scan=${input.aiScanId}, org=${input.organizationId})`,
      });
      return report;
    }),

  createProject: adminProcedure
    .input(
      z.object({
        organizationId: z.number().int().positive(),
        name: z.string().min(1).max(200),
        phase: z.string().max(96).optional(),
        status: z.enum(["planning", "active", "on_hold", "completed"]).optional(),
        progress: z.number().int().min(0).max(100).optional(),
        startMs: z.number().int().optional(),
        targetMs: z.number().int().optional(),
        summary: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await createClientProject(input);
      if (!project) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create project." });
      }
      await recordAdminEvent({ ctx, reason: `admin.project.create(org=${input.organizationId})` });
      return project;
    }),

  updateProject: adminProcedure
    .input(
      z.object({
        organizationId: z.number().int().positive(),
        id: z.number().int().positive(),
        name: z.string().min(1).max(200).optional(),
        phase: z.string().max(96).optional(),
        status: z.enum(["planning", "active", "on_hold", "completed"]).optional(),
        progress: z.number().int().min(0).max(100).optional(),
        startMs: z.number().int().optional(),
        targetMs: z.number().int().optional(),
        summary: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { organizationId, id, ...updates } = input;
      const project = await updateClientProject(organizationId, id, updates);
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found for this organization." });
      }
      await recordAdminEvent({ ctx, reason: `admin.project.update(${id})` });
      return project;
    }),

  createMilestone: adminProcedure
    .input(
      z.object({
        organizationId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        title: z.string().min(1).max(200),
        dueMs: z.number().int().optional(),
        status: z.enum(["pending", "in_progress", "completed"]).optional(),
        body: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // client_project_milestones has no organizationId of its own (see
      // the schema comment) — verify the project itself belongs to this
      // org before attaching a milestone to it, mirroring exactly what
      // this table's RLS policy checks at the database layer.
      const project = await getClientProjectById(input.organizationId, input.projectId);
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found for this organization." });
      }
      const milestone = await createClientProjectMilestone({
        projectId: input.projectId,
        title: input.title,
        dueMs: input.dueMs,
        status: input.status,
        body: input.body,
      });
      if (!milestone) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create milestone." });
      }
      await recordAdminEvent({ ctx, reason: `admin.milestone.create(project=${input.projectId})` });
      return milestone;
    }),

  updateMilestone: adminProcedure
    .input(
      z.object({
        organizationId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        id: z.number().int().positive(),
        title: z.string().min(1).max(200).optional(),
        dueMs: z.number().int().optional(),
        status: z.enum(["pending", "in_progress", "completed"]).optional(),
        body: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getClientProjectById(input.organizationId, input.projectId);
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found for this organization." });
      }
      const { organizationId, projectId, id, ...updates } = input;
      const milestone = await updateClientProjectMilestone(projectId, id, updates);
      if (!milestone) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Milestone not found for this project." });
      }
      await recordAdminEvent({ ctx, reason: `admin.milestone.update(${id})` });
      return milestone;
    }),

  // -- Health / extra read endpoints --------------------------------------
  mfaPosture: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.mfa_posture" });
    return readMfa();
  }),

  // -- Audited action stub -------------------------------------------------
  action: adminProcedure
    .input(adminActionInput)
    .mutation(async ({ ctx, input }) => {
      const keys = input.payload ? Object.keys(input.payload) : [];
      await recordAdminEvent({
        ctx,
        reason: `admin.action.${input.module}.${input.action}${keys.length ? `(${keys.join(",")})` : ""}`,
      });
      return {
        ok: true,
        recordedAtMs: Date.now(),
        module: input.module,
        action: input.action,
      };
    }),

  // -- View As (impersonation breadcrumb) ----------------------------------
  viewAs: adminProcedure
    .input(viewAsInput)
    .mutation(async ({ ctx, input }) => {
      // Only admins reach here (adminProcedure already gates). RM-57
      // resolved the "future super admin distinction" this comment used to
      // flag: super_admin is a strict superset of admin, so it keeps
      // impersonation rather than losing it — isAdminRole() accepts both.
      if (!ctx.user || !isAdminRole(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins may impersonate." });
      }
      await recordAdminEvent({
        ctx,
        reason: `admin.view_as.${input.target} :: ${input.reason.slice(0, 64)}`,
      });
      return {
        ok: true,
        target: input.target,
        // The actual session swap happens through the Express route
        // /api/admin/view-as which sets a short-lived impersonation
        // cookie. Returning the redirect path here keeps the client
        // contract simple.
        redirect: input.target === "client" ? "/client-portal" : "/developer-workspace",
        expiresInSec: 30 * 60,
      };
    }),

  // -- Milestone 2 §2.5: Organization Management (super_admin-exclusive
  // writes, per RM-57's decision record - drizzle/0009_super_admin_org_management.sql
  // enforces the same boundary at the RLS layer as defense-in-depth) -----

  listOrganizations: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.org.list" });
    return listOrganizations();
  }),

  createOrganization: superAdminProcedure
    .input(
      z.object({
        slug: z
          .string()
          .trim()
          .min(2)
          .max(64)
          .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and hyphens only"),
        name: z.string().trim().min(1).max(200),
        legalName: z.string().trim().max(200).nullable().optional(),
        industry: z.string().trim().max(64).nullable().optional(),
        size: z.string().trim().max(64).nullable().optional(),
        country: z.string().trim().max(64).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getOrganizationBySlug(input.slug);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "slug_already_in_use" });
      }
      const org = await createOrganization(input);
      if (!org) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "create_failed" });
      }
      await recordAdminEvent({ ctx, reason: `admin.org.create(${org.id}:${org.slug})` });
      return org;
    }),

  updateOrganization: superAdminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(200).optional(),
        legalName: z.string().trim().max(200).nullable().optional(),
        industry: z.string().trim().max(64).nullable().optional(),
        size: z.string().trim().max(64).nullable().optional(),
        country: z.string().trim().max(64).nullable().optional(),
        statusLabel: z.string().trim().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const org = await updateOrganization(id, updates);
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "organization_not_found" });
      }
      await recordAdminEvent({ ctx, reason: `admin.org.update(${id})` });
      return org;
    }),

  // -- Milestone 2 §2.5: role / tenant assignment (super_admin-exclusive) --

  setUserRole: superAdminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        role: z.enum(["user", "client", "developer", "admin", "super_admin", "technical_operator"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Safety guard: a super_admin changing their OWN role through this
      // endpoint risks locking every super_admin out of the one capability
      // that can undo it (only super_admin can call setUserRole at all).
      // Self-demotion/self-promotion isn't a real product need this
      // endpoint needs to serve, so it's simplest and safest to refuse it
      // outright rather than add "don't demote the last super_admin"
      // bookkeeping.
      if (ctx.user.id === input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "cannot_change_own_role" });
      }
      const before = await getUserById(input.userId);
      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND", message: "user_not_found" });
      }
      const after = await setUserRole(input.userId, input.role);
      if (!after) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "update_failed" });
      }
      await recordAdminEvent({
        ctx,
        reason: `admin.user.set_role(${input.userId}: ${before.role} -> ${input.role})`,
      });
      return { id: after.id, role: after.role };
    }),

  assignUserOrganization: superAdminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        organizationId: z.number().int().positive().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await getUserById(input.userId);
      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND", message: "user_not_found" });
      }
      const after = await assignUserOrganization(input.userId, input.organizationId);
      if (!after) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "update_failed" });
      }
      await recordAdminEvent({
        ctx,
        reason: `admin.user.assign_org(${input.userId}: ${before.organizationId ?? "none"} -> ${input.organizationId ?? "none"})`,
      });
      return { id: after.id, organizationId: after.organizationId };
    }),
});

export type AdminRouter = typeof adminRouter;

// Test-only export so the unit suite can verify the aggregation shape
// without booting the tRPC plumbing.
export const __testing = {
  buildSummary,
  readCrm,
  readClients,
  readProjects,
  readBilling,
  readDocuments,
  readReports,
  readSupport,
  readUsers,
  readDevelopers,
  readSecurity,
  readAudit,
  readMfa,
  synthesisedAiScans,
  synthesisedCampaigns,
  synthesisedAgents,
  synthesisedAutomations,
};
