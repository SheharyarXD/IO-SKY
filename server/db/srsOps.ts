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
import { escapeLike } from "../../shared/srsRules";
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
