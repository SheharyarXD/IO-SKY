/**
 * Search, audit export and platform health reads (SRS 7.6, 12.5, 16.4, 19.6).
 * No authorisation opinion here; RBAC lives on the tRPC procedures.
 */
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import {
  clientDocuments,
  emailDeliveryLog,
  incidents,
  loginAudit,
  webhookDeliveries,
  webhookRegistrations,
} from "../../drizzle/schema";
import { escapeLike, type ExportDataset } from "../../shared/srsRules";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Audit search
// ---------------------------------------------------------------------------

export type AuditFilter = {
  q?: string;
  outcome?: string;
  provider?: string;
  fromMs?: number;
  toMs?: number;
};

function auditWhere(f: AuditFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (f.q?.trim()) {
    const p = `%${escapeLike(f.q.trim())}%`;
    conds.push(or(ilike(loginAudit.identifier, p), ilike(loginAudit.reason, p), ilike(loginAudit.ip, p))!);
  }
  if (f.outcome) conds.push(eq(loginAudit.outcome, f.outcome));
  if (f.provider) conds.push(eq(loginAudit.provider, f.provider));
  if (f.fromMs) conds.push(gte(loginAudit.createdAt, new Date(f.fromMs)));
  if (f.toMs) conds.push(lte(loginAudit.createdAt, new Date(f.toMs)));
  return conds.length ? and(...conds) : undefined;
}

export async function searchAuditLog(f: AuditFilter, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  const where = auditWhere(f);
  const [rows, total] = await Promise.all([
    db.select().from(loginAudit).where(where).orderBy(desc(loginAudit.createdAt), desc(loginAudit.id)).limit(limit).offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(loginAudit).where(where),
  ]);
  return { rows, total: Number(total[0]?.n ?? 0) };
}

/** Capped so one export cannot pull the whole table through the app server. */
export const AUDIT_EXPORT_LIMIT = 10_000;

export async function exportAuditLog(f: AuditFilter) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(loginAudit).where(auditWhere(f)).orderBy(desc(loginAudit.createdAt), desc(loginAudit.id)).limit(AUDIT_EXPORT_LIMIT);
}

// ---------------------------------------------------------------------------
// Document search (SRS 18.12): same visibility as the document list
// ---------------------------------------------------------------------------

/**
 * `organizationId` is mandatory for a client search and null only for an admin
 * one, so the tenant scope is decided by the caller's role and can never be
 * widened by anything in the search text.
 */
export async function searchDocuments(args: { organizationId: number | null; q: string; category?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const p = `%${escapeLike(args.q.trim())}%`;
  const conds: SQL[] = [or(ilike(clientDocuments.name, p), ilike(clientDocuments.category, p), ilike(clientDocuments.uploadedBy, p))!];
  if (args.organizationId !== null) conds.push(eq(clientDocuments.organizationId, args.organizationId));
  if (args.category) conds.push(eq(clientDocuments.category, args.category));
  return db
    .select({
      id: clientDocuments.id,
      organizationId: clientDocuments.organizationId,
      name: clientDocuments.name,
      category: clientDocuments.category,
      version: clientDocuments.version,
      status: clientDocuments.status,
      uploadedBy: clientDocuments.uploadedBy,
      createdAt: clientDocuments.createdAt,
    })
    .from(clientDocuments)
    .where(and(...conds))
    .orderBy(desc(clientDocuments.createdAt))
    .limit(Math.min(args.limit ?? 50, 200));
}

// ---------------------------------------------------------------------------
// Platform health: integrations, capacity, release
// ---------------------------------------------------------------------------

export type PlatformHealth = {
  generatedAt: number;
  release: { commit: string | null; startedAt: number; nodeVersion: string; environment: string };
  capacity: {
    uptimeSeconds: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    databaseSizeMb: number | null;
    tableRows: Record<string, number>;
  };
  integrations: {
    providers: Array<{ name: string; configured: boolean }>;
    email24h: { sent: number; failed: number };
    webhooks: Array<{ id: number; name: string; enabled: boolean; attempts24h: number; failures24h: number; lastSuccessAt: Date | null }>;
  };
  openIncidents: { security: number; operational: number };
};

const STARTED_AT = Date.now();
const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

export async function readPlatformHealth(): Promise<PlatformHealth> {
  const mem = process.memoryUsage();
  const base: PlatformHealth = {
    generatedAt: Date.now(),
    release: {
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? process.env.SOURCE_COMMIT ?? null,
      startedAt: STARTED_AT,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? "development",
    },
    capacity: {
      uptimeSeconds: Math.round(process.uptime()),
      rssMb: mb(mem.rss),
      heapUsedMb: mb(mem.heapUsed),
      heapTotalMb: mb(mem.heapTotal),
      databaseSizeMb: null,
      tableRows: {},
    },
    integrations: {
      providers: [
        { name: "Email (Resend)", configured: Boolean(process.env.RESEND_API_KEY) },
        { name: "SMS (Twilio)", configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) },
        { name: "AI (LLM)", configured: Boolean(process.env.LLM_API_KEY || process.env.OPENAI_API_KEY) },
        { name: "Storage and auth (Supabase)", configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) },
      ],
      email24h: { sent: 0, failed: 0 },
      webhooks: [],
    },
    openIncidents: { security: 0, operational: 0 },
  };
  const db = await getDb();
  if (!db) return base;
  const since = new Date(Date.now() - 24 * 3_600_000);

  try {
    const size = await db.execute(sql`select pg_database_size(current_database()) as bytes`);
    const bytes = Number((size as unknown as Array<{ bytes: string | number }>)[0]?.bytes ?? (size as { rows?: Array<{ bytes: string | number }> }).rows?.[0]?.bytes ?? NaN);
    if (Number.isFinite(bytes)) base.capacity.databaseSizeMb = mb(bytes);
  } catch {
    // pg_database_size can be denied on a managed database; the rest still renders.
  }

  const count = async (table: string) => {
    try {
      const r = await db.execute(sql.raw(`select count(*)::int as n from "${table}"`));
      const row = (r as unknown as Array<{ n: number }>)[0] ?? (r as { rows?: Array<{ n: number }> }).rows?.[0];
      return Number(row?.n ?? 0);
    } catch {
      return 0;
    }
  };
  // Fixed list, never interpolated from input.
  for (const t of ["users", "leads", "ai_scans", "client_documents", "login_audit"]) base.capacity.tableRows[t] = await count(t);

  const email = await db
    .select({ status: emailDeliveryLog.status, n: sql<number>`count(*)::int` })
    .from(emailDeliveryLog)
    .where(gte(emailDeliveryLog.createdAt, since))
    .groupBy(emailDeliveryLog.status);
  for (const r of email) {
    if (r.status === "failed" || r.status === "bounced" || r.status === "complained") base.integrations.email24h.failed += Number(r.n);
    else base.integrations.email24h.sent += Number(r.n);
  }

  const regs = await db.select().from(webhookRegistrations);
  const stats = await db
    .select({
      id: webhookDeliveries.webhookRegistrationId,
      attempts: sql<number>`count(*)::int`,
      failures: sql<number>`count(*) filter (where ${webhookDeliveries.success} = 0)::int`,
      lastSuccess: sql<Date | null>`max(${webhookDeliveries.requestedAt}) filter (where ${webhookDeliveries.success} = 1)`,
    })
    .from(webhookDeliveries)
    .where(gte(webhookDeliveries.requestedAt, since))
    .groupBy(webhookDeliveries.webhookRegistrationId);
  base.integrations.webhooks = regs.map((w) => {
    const s = stats.find((x) => x.id === w.id);
    return { id: w.id, name: w.name, enabled: w.enabled === 1, attempts24h: Number(s?.attempts ?? 0), failures24h: Number(s?.failures ?? 0), lastSuccessAt: s?.lastSuccess ?? null };
  });

  const open = await db
    .select({ category: incidents.category, n: sql<number>`count(*)::int` })
    .from(incidents)
    .where(sql`${incidents.status} in ('open','investigating')`)
    .groupBy(incidents.category);
  for (const r of open) {
    if (r.category === "security") base.openIncidents.security = Number(r.n);
    else base.openIncidents.operational = Number(r.n);
  }
  return base;
}

/** Recent email attempts, newest first, for the communication history view (SRS 17.13). */
export async function listRecentEmailLog(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: emailDeliveryLog.id, createdAt: emailDeliveryLog.createdAt, recipient: emailDeliveryLog.recipient, subject: emailDeliveryLog.subject, status: emailDeliveryLog.status, messageType: emailDeliveryLog.messageType, errorMessage: emailDeliveryLog.errorMessage })
    .from(emailDeliveryLog)
    .orderBy(desc(emailDeliveryLog.createdAt))
    .limit(limit);
}

/** Raw counts behind the compliance checks. Every number is a live query. */
export async function readComplianceInputs(now = new Date()): Promise<import("../../shared/srsRules").ComplianceInputs> {
  const empty = { adminsWithoutMfa: 0, overduePrivacyRequests: 0, staleDocumentReviews: 0, scansWaitingTooLong: 0, openCriticalIncidents: 0, expiredActiveDeveloperScopes: 0, enabledAlertRules: 0 };
  const db = await getDb();
  if (!db) return empty;
  const n = async (q: ReturnType<typeof sql>) => {
    try {
      const r = (await db.execute(q)) as unknown as Array<{ n: number }> & { rows?: Array<{ n: number }> };
      return Number((r[0] ?? r.rows?.[0])?.n ?? 0);
    } catch (err) {
      // Never report a failed query as a clean zero: a check that cannot run must not pass.
      console.error("[compliance] query failed:", err);
      throw err;
    }
  };
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const twoDays = new Date(now.getTime() - 48 * 3_600_000);
  return {
    adminsWithoutMfa: await n(sql`select count(*)::int n from users u where u.role in ('admin','super_admin') and not exists (select 1 from mfa_factors f where f."userId" = u.id and f."verifiedAt" is not null)`),
    overduePrivacyRequests: await n(sql`select count(*)::int n from privacy_requests where "dueAt" is not null and "dueAt" < ${now.toISOString()}::timestamp and status not in ('completed','rejected','withdrawn')`),
    staleDocumentReviews: await n(sql`select count(*)::int n from client_documents where status = 'pending_review' and "createdAt" < ${week.toISOString()}::timestamp`),
    scansWaitingTooLong: await n(sql`select count(*)::int n from ai_scans where "reportStatus" = 'awaiting_expert_review' and "updatedAt" < ${twoDays.toISOString()}::timestamp`),
    openCriticalIncidents: await n(sql`select count(*)::int n from incidents where severity = 'critical' and status in ('open','investigating')`),
    expiredActiveDeveloperScopes: await n(sql`select count(*)::int n from developer_access_scopes where status = 'active' and "expiresMs" is not null and "expiresMs" < ${now.getTime()}`),
    enabledAlertRules: await n(sql`select count(*)::int n from alert_rules where enabled`),
  };
}

/** Twelve months of leads, paid revenue and won deals (SRS 21.10). */
export async function readMonthlyHistory(months = 12, now = new Date()) {
  const { lastMonths, fillMonthly } = await import("../../shared/srsRules");
  const list = lastMonths(months, now);
  const db = await getDb();
  const zero = { leads: 0, paidCents: 0, wonDeals: 0 };
  if (!db) return list.map((month) => ({ month, ...zero }));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const run = async <R,>(q: ReturnType<typeof sql>): Promise<R[]> => {
    try {
      return (await db.execute(q)) as unknown as R[];
    } catch (err) {
      console.error("[history] query failed:", err);
      throw err;
    }
  };
  const [leadsRows, paidRows, wonRows] = await Promise.all([
    run<{ month: string; n: number }>(sql`select to_char("createdAt", 'YYYY-MM') as month, count(*)::int as n from leads where "createdAt" >= ${since.toISOString()}::timestamp group by 1`),
    run<{ month: string; n: string }>(sql`select to_char(to_timestamp("paidMs"/1000.0), 'YYYY-MM') as month, coalesce(sum("amountCents"),0)::bigint as n from client_invoices where status = 'paid' and "paidMs" >= ${since.getTime()} group by 1`),
    run<{ month: string; n: number }>(sql`select to_char("closedAt", 'YYYY-MM') as month, count(*)::int as n from crm_opportunities where stage = 'won' and "closedAt" >= ${since.toISOString()}::timestamp group by 1`),
  ]);
  const merged = new Map<string, { month: string; leads: number; paidCents: number; wonDeals: number }>();
  const get = (m: string) => merged.get(m) ?? (merged.set(m, { month: m, ...zero }), merged.get(m)!);
  for (const r of leadsRows) get(r.month).leads = Number(r.n);
  for (const r of paidRows) get(r.month).paidCents = Number(r.n);
  for (const r of wonRows) get(r.month).wonDeals = Number(r.n);
  return fillMonthly(list, [...merged.values()], zero);
}


/** Fixed column lists per dataset, so an export can never include a column nobody chose to expose. */
export async function readExportDataset(name: ExportDataset): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }> {
  const db = await getDb();
  if (!db) return { columns: [], rows: [] };
  const table: Record<ExportDataset, { sql: string; columns: string[] }> = {
    leads: { sql: 'select id, "fullName", email, company, source, interest, "createdAt" from leads order by "createdAt" desc limit 10000', columns: ["id", "fullName", "email", "company", "source", "interest", "createdAt"] },
    invoices: { sql: 'select id, number, "organizationId", description, "amountCents", currency, status, "issuedMs", "paidMs" from client_invoices order by id desc limit 10000', columns: ["id", "number", "organizationId", "description", "amountCents", "currency", "status", "issuedMs", "paidMs"] },
    opportunities: { sql: 'select id, title, stage, "valueCents", currency, "expectedCloseDate", "closedAt", "createdAt" from crm_opportunities order by id desc limit 10000', columns: ["id", "title", "stage", "valueCents", "currency", "expectedCloseDate", "closedAt", "createdAt"] },
    time_entries: { sql: 'select id, "developerId", "projectId", "workDate", minutes, status, "createdAt" from developer_time_entries order by id desc limit 10000', columns: ["id", "developerId", "projectId", "workDate", "minutes", "status", "createdAt"] },
    incidents: { sql: 'select id, category, title, severity, status, "createdAt", "closedAt" from incidents order by id desc limit 10000', columns: ["id", "category", "title", "severity", "status", "createdAt", "closedAt"] },
  };
  const def = table[name];
  const res = (await db.execute(sql.raw(def.sql))) as unknown as Array<Record<string, unknown>>;
  return { columns: def.columns, rows: res };
}
