/**
 * Governance, notification and operations write paths required by Master SRS
 * v1.1: admin notifications (12.15), notification preferences (17.11), the AI
 * registry, prompt versions and execution history (19), configuration history
 * and validation (24, 13.9), incidents (20.10, 25.9), threshold alerts
 * (20.11, 22.12), scheduled reports (21.11) and maintenance mode (25.8).
 *
 * No authorisation opinion here; RBAC lives on the tRPC procedures.
 */
import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  adminNotifications,
  aiAgents,
  aiExecutions,
  aiPromptVersions,
  alertRules,
  configHistory,
  emailDeliveryLog,
  incidents,
  loginAudit,
  notificationPreferences,
  platformSettings,
  scheduledReports,
  webhookDeliveries,
  type AdminNotification,
  type AiAgent,
  type AiExecution,
  type AiPromptVersion,
  type AlertRule,
  type ConfigHistoryRow,
  type Incident,
  type NotificationPreference,
  type ScheduledReport,
} from "../../drizzle/schema";
import {
  authoriseAgentAction,
  nextRunAfter,
  shouldFireAlert,
  validateSettingValue,
  type AlertMetric,
  type Cadence,
  type NotificationCategory,
  type NotificationChannel,
} from "../../shared/srsRules";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Admin notifications
// ---------------------------------------------------------------------------

export async function createAdminNotification(args: {
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  priority?: "low" | "normal" | "high" | "critical";
}): Promise<AdminNotification | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .insert(adminNotifications)
      .values({ kind: args.kind, title: args.title.slice(0, 200), body: args.body ?? null, href: args.href ?? null, priority: args.priority ?? "normal" })
      .returning();
    return rows[0] ?? null;
  } catch (err) {
    // A notification is a side effect of a business event. It must never be
    // the reason that event fails (a lead is still a lead without its bell).
    console.error("[adminNotifications] insert failed:", err);
    return null;
  }
}

export async function listAdminNotifications(limit = 50, unreadOnly = false): Promise<AdminNotification[]> {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(adminNotifications);
  return (unreadOnly ? q.where(isNull(adminNotifications.readAt)) : q).orderBy(desc(adminNotifications.createdAt)).limit(limit);
}

export async function countUnreadAdminNotifications(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select({ n: sql<number>`count(*)::int` }).from(adminNotifications).where(isNull(adminNotifications.readAt));
  return Number(r[0]?.n ?? 0);
}

export async function markAdminNotificationsRead(userId: number, id?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const where = id ? and(eq(adminNotifications.id, id), isNull(adminNotifications.readAt)) : isNull(adminNotifications.readAt);
  const rows = await db.update(adminNotifications).set({ readAt: new Date(), readByUserId: userId }).where(where).returning({ id: adminNotifications.id });
  return rows.length;
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

export async function listNotificationPreferences(userId: number): Promise<NotificationPreference[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
}

export async function setNotificationPreference(args: {
  userId: number;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(notificationPreferences)
    .values(args)
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.category, notificationPreferences.channel],
      set: { enabled: args.enabled, updatedAt: new Date() },
    });
}

// ---------------------------------------------------------------------------
// AI registry, prompts and execution history
// ---------------------------------------------------------------------------

export type AiAgentView = Omit<AiAgent, "permissionsJson"> & { permissions: string[]; activePromptVersion: number | null };

function parsePermissions(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function listAiAgents(): Promise<AiAgentView[]> {
  const db = await getDb();
  if (!db) return [];
  const agents = await db.select().from(aiAgents).orderBy(asc(aiAgents.key));
  const active = await db.select().from(aiPromptVersions).where(eq(aiPromptVersions.isActive, true));
  const byAgent = new Map(active.map((p) => [p.agentKey, p.version]));
  return agents.map(({ permissionsJson, ...a }) => ({
    ...a,
    permissions: parsePermissions(permissionsJson),
    activePromptVersion: byAgent.get(a.key) ?? null,
  }));
}

export async function upsertAiAgent(args: {
  key: string;
  name: string;
  purpose: string | null;
  permissions: string[];
  requiresHumanApproval: boolean;
  status: "active" | "disabled";
}): Promise<AiAgent | null> {
  const db = await getDb();
  if (!db) return null;
  const values = {
    key: args.key,
    name: args.name,
    purpose: args.purpose,
    permissionsJson: JSON.stringify([...new Set(args.permissions)]),
    requiresHumanApproval: args.requiresHumanApproval,
    status: args.status,
  };
  const rows = await db
    .insert(aiAgents)
    .values(values)
    .onConflictDoUpdate({ target: aiAgents.key, set: { ...values, updatedAt: new Date() } })
    .returning();
  return rows[0] ?? null;
}

/**
 * Prompts are versioned, never edited in place (SRS 19.9): every change is a
 * new row, so an output can always be traced to the exact prompt that made it.
 */
export async function addPromptVersion(args: {
  agentKey: string;
  body: string;
  changeNote: string | null;
  createdByUserId: number;
  activate: boolean;
}): Promise<AiPromptVersion | "agent_not_found" | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const agent = (await tx.select({ key: aiAgents.key }).from(aiAgents).where(eq(aiAgents.key, args.agentKey)).for("update").limit(1))[0];
    if (!agent) return "agent_not_found" as const;
    const max = await tx.select({ v: sql<number>`coalesce(max(${aiPromptVersions.version}), 0)::int` }).from(aiPromptVersions).where(eq(aiPromptVersions.agentKey, args.agentKey));
    const version = Number(max[0]?.v ?? 0) + 1;
    if (args.activate) {
      await tx.update(aiPromptVersions).set({ isActive: false }).where(and(eq(aiPromptVersions.agentKey, args.agentKey), eq(aiPromptVersions.isActive, true)));
    }
    const rows = await tx
      .insert(aiPromptVersions)
      .values({ agentKey: args.agentKey, version, body: args.body, changeNote: args.changeNote, createdByUserId: args.createdByUserId, isActive: args.activate })
      .returning();
    return rows[0] ?? null;
  });
}

export async function activatePromptVersion(agentKey: string, version: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async (tx) => {
    const target = (await tx.select().from(aiPromptVersions).where(and(eq(aiPromptVersions.agentKey, agentKey), eq(aiPromptVersions.version, version))).limit(1))[0];
    if (!target) return false;
    await tx.update(aiPromptVersions).set({ isActive: false }).where(and(eq(aiPromptVersions.agentKey, agentKey), eq(aiPromptVersions.isActive, true)));
    await tx.update(aiPromptVersions).set({ isActive: true }).where(eq(aiPromptVersions.id, target.id));
    return true;
  });
}

export async function listPromptVersions(agentKey: string): Promise<AiPromptVersion[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiPromptVersions).where(eq(aiPromptVersions.agentKey, agentKey)).orderBy(desc(aiPromptVersions.version));
}

export async function listAiExecutions(agentKey?: string, limit = 100): Promise<AiExecution[]> {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(aiExecutions);
  return (agentKey ? q.where(eq(aiExecutions.agentKey, agentKey)) : q).orderBy(desc(aiExecutions.createdAt), desc(aiExecutions.id)).limit(limit);
}

export type AgentRunResult =
  | { outcome: "completed" | "awaiting_approval"; executionId: number | null; promptVersion: number | null }
  | { outcome: "blocked_by_permission"; executionId: number | null; reason: string };

/**
 * The single gate every AI action must pass (SRS 19.8, BR-009). It checks the
 * registry, records the attempt either way, and holds the result for a human
 * when the agent requires approval. A blocked attempt is audited too, which is
 * the point: "agents operate according to assigned permissions" is only
 * provable if the refusals are on record.
 */
export async function authoriseAndRecordAgentAction(args: {
  agentKey: string;
  action: string;
  subjectRef: string | null;
  detail: string | null;
}): Promise<AgentRunResult | null> {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(aiAgents).where(eq(aiAgents.key, args.agentKey)).limit(1))[0];
  const verdict = authoriseAgentAction(
    row ? { status: row.status, permissions: parsePermissions(row.permissionsJson), requiresHumanApproval: row.requiresHumanApproval } : null,
    args.action,
  );
  if (!verdict.allowed) {
    const rec = await db
      .insert(aiExecutions)
      .values({ agentKey: args.agentKey, action: args.action, subjectRef: args.subjectRef, outcome: "blocked_by_permission", detail: verdict.reason })
      .returning({ id: aiExecutions.id });
    return { outcome: "blocked_by_permission", executionId: rec[0]?.id ?? null, reason: verdict.reason };
  }
  const active = (await db.select().from(aiPromptVersions).where(and(eq(aiPromptVersions.agentKey, args.agentKey), eq(aiPromptVersions.isActive, true))).limit(1))[0];
  const outcome = verdict.needsApproval ? ("awaiting_approval" as const) : ("completed" as const);
  const rec = await db
    .insert(aiExecutions)
    .values({ agentKey: args.agentKey, promptVersion: active?.version ?? null, action: args.action, subjectRef: args.subjectRef, outcome, detail: args.detail })
    .returning({ id: aiExecutions.id });
  return { outcome, executionId: rec[0]?.id ?? null, promptVersion: active?.version ?? null };
}

/**
 * ai_executions is append-only, so a human decision is a new row that points at
 * the awaiting one rather than an update of it.
 */
export async function decideAiExecution(args: { executionId: number; approve: boolean; userId: number; note: string | null }): Promise<"ok" | "not_found" | "not_awaiting" | "already_decided" | null> {
  const db = await getDb();
  if (!db) return null;
  const original = (await db.select().from(aiExecutions).where(eq(aiExecutions.id, args.executionId)).limit(1))[0];
  if (!original) return "not_found";
  if (original.outcome !== "awaiting_approval") return "not_awaiting";
  const ref = `execution:${original.id}`;
  const prior = await db.select({ id: aiExecutions.id }).from(aiExecutions).where(and(eq(aiExecutions.agentKey, original.agentKey), eq(aiExecutions.subjectRef, ref))).limit(1);
  if (prior.length > 0) return "already_decided";
  await db.insert(aiExecutions).values({
    agentKey: original.agentKey,
    promptVersion: original.promptVersion,
    action: original.action,
    subjectRef: ref,
    outcome: args.approve ? "approved" : "rejected",
    detail: args.note,
    approvedByUserId: args.userId,
  });
  return "ok";
}

// ---------------------------------------------------------------------------
// Configuration with validation and history
// ---------------------------------------------------------------------------

export async function applyConfigChange(args: {
  key: string;
  value: string;
  userId: number;
}): Promise<{ ok: true } | { ok: false; reason: string; code: "NOT_FOUND" | "BAD_REQUEST" } | null> {
  const db = await getDb();
  if (!db) return null;
  const current = (await db.select().from(platformSettings).where(eq(platformSettings.key, args.key)).limit(1))[0];
  if (!current) return { ok: false, code: "NOT_FOUND", reason: "Unknown setting." };
  const verdict = validateSettingValue(args.key, args.value);
  if (!verdict.ok) {
    await db.insert(configHistory).values({ settingKey: args.key, oldValue: current.value, newValue: args.value.slice(0, 2000), outcome: "rejected", reason: verdict.reason, changedByUserId: args.userId });
    return { ok: false, code: "BAD_REQUEST", reason: verdict.reason };
  }
  const value = args.value.trim();
  await db.transaction(async (tx) => {
    await tx.update(platformSettings).set({ value, updatedByUserId: args.userId, updatedAt: new Date() }).where(eq(platformSettings.key, args.key));
    await tx.insert(configHistory).values({ settingKey: args.key, oldValue: current.value, newValue: value, outcome: "applied", changedByUserId: args.userId });
  });
  return { ok: true };
}

export async function listConfigHistory(settingKey?: string, limit = 100): Promise<ConfigHistoryRow[]> {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(configHistory);
  return (settingKey ? q.where(eq(configHistory.settingKey, settingKey)) : q).orderBy(desc(configHistory.createdAt), desc(configHistory.id)).limit(limit);
}

// ---------------------------------------------------------------------------
// Maintenance mode (SRS 25.8)
// ---------------------------------------------------------------------------

let maintenanceCache: { at: number; on: boolean } | null = null;
const MAINTENANCE_TTL_MS = 10_000;

/** Cached for a few seconds: this runs on every request, so it must not hit the database each time. */
export async function isMaintenanceModeOn(now = Date.now()): Promise<boolean> {
  if (maintenanceCache && now - maintenanceCache.at < MAINTENANCE_TTL_MS) return maintenanceCache.on;
  const db = await getDb();
  if (!db) return false;
  try {
    const row = (await db.select({ value: platformSettings.value }).from(platformSettings).where(eq(platformSettings.key, "operations.maintenance_mode")).limit(1))[0];
    const on = row?.value === "on";
    maintenanceCache = { at: now, on };
    return on;
  } catch {
    // Fail open: a settings read error must not take the platform down.
    return false;
  }
}

export function resetMaintenanceCache(): void {
  maintenanceCache = null;
}

/** Ensures the toggle exists so it can be flipped through the validated config path. */
export async function ensureOperationsSettings(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(platformSettings)
    .values([
      { section: "operations", key: "operations.maintenance_mode", title: "Maintenance mode", description: 'Set to "on" to return a maintenance response to everyone except administrators.', value: "off" },
    ])
    .onConflictDoNothing();
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export async function createIncident(args: {
  category: "security" | "operational";
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  reportedByUserId: number | null;
}): Promise<Incident | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(incidents).values(args).returning();
  return rows[0] ?? null;
}

export async function listIncidents(filter: { category?: "security" | "operational"; status?: string } = {}): Promise<Incident[]> {
  const db = await getDb();
  if (!db) return [];
  const conds = [];
  if (filter.category) conds.push(eq(incidents.category, filter.category));
  if (filter.status) conds.push(eq(incidents.status, filter.status));
  const q = db.select().from(incidents);
  return (conds.length ? q.where(and(...conds)) : q).orderBy(desc(incidents.createdAt)).limit(300);
}

export async function updateIncident(args: {
  id: number;
  status?: "open" | "investigating" | "resolved" | "closed";
  severity?: "low" | "medium" | "high" | "critical";
  assignedToUserId?: number | null;
  resolution?: string | null;
}): Promise<{ ok: true; incident: Incident } | { ok: false; reason: string; code: "NOT_FOUND" | "PRECONDITION_FAILED" } | null> {
  const db = await getDb();
  if (!db) return null;
  const current = (await db.select().from(incidents).where(eq(incidents.id, args.id)).limit(1))[0];
  if (!current) return { ok: false, code: "NOT_FOUND", reason: "Incident not found." };
  if (current.status === "closed") return { ok: false, code: "PRECONDITION_FAILED", reason: "A closed incident cannot be changed." };
  const resolution = args.resolution !== undefined ? args.resolution : current.resolution;
  if ((args.status === "resolved" || args.status === "closed") && !resolution?.trim()) {
    return { ok: false, code: "PRECONDITION_FAILED", reason: "Record the resolution before resolving or closing an incident." };
  }
  const rows = await db
    .update(incidents)
    .set({
      status: args.status ?? current.status,
      severity: args.severity ?? current.severity,
      assignedToUserId: args.assignedToUserId === undefined ? current.assignedToUserId : args.assignedToUserId,
      resolution,
      closedAt: args.status === "closed" ? new Date() : current.closedAt,
    })
    .where(eq(incidents.id, args.id))
    .returning();
  return { ok: true, incident: rows[0]! };
}

// ---------------------------------------------------------------------------
// Alert rules and the evaluator
// ---------------------------------------------------------------------------

const DEFAULT_ALERT_RULES: Array<Pick<AlertRule, "key" | "title" | "metric" | "threshold" | "windowMinutes" | "severity">> = [
  { key: "failed_logins_burst", title: "Burst of failed sign-ins", metric: "failed_logins", threshold: 10, windowMinutes: 15, severity: "high" },
  { key: "webhook_failure_burst", title: "Webhook deliveries failing", metric: "webhook_failures", threshold: 5, windowMinutes: 60, severity: "medium" },
  { key: "email_failure_burst", title: "Email deliveries failing", metric: "email_failures", threshold: 5, windowMinutes: 60, severity: "high" },
  { key: "open_critical_incidents", title: "Critical incident left open", metric: "open_critical_incidents", threshold: 1, windowMinutes: 240, severity: "critical" },
];

export async function listAlertRules(): Promise<AlertRule[]> {
  const db = await getDb();
  if (!db) return [];
  const existing = await db.select().from(alertRules).orderBy(asc(alertRules.id));
  if (existing.length > 0) return existing;
  await db.insert(alertRules).values(DEFAULT_ALERT_RULES).onConflictDoNothing();
  return db.select().from(alertRules).orderBy(asc(alertRules.id));
}

export async function updateAlertRule(args: { id: number; threshold?: number; windowMinutes?: number; enabled?: boolean }): Promise<AlertRule | null> {
  const db = await getDb();
  if (!db) return null;
  const { id, ...set } = args;
  if (Object.keys(set).length === 0) return null;
  const rows = await db.update(alertRules).set(set).where(eq(alertRules.id, id)).returning();
  return rows[0] ?? null;
}

async function countMetric(metric: AlertMetric, windowMinutes: number, now: Date): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const since = new Date(now.getTime() - windowMinutes * 60_000);
  if (metric === "failed_logins") {
    const r = await db.select({ n: sql<number>`count(*)::int` }).from(loginAudit).where(and(eq(loginAudit.outcome, "failed"), gte(loginAudit.createdAt, since)));
    return Number(r[0]?.n ?? 0);
  }
  if (metric === "webhook_failures") {
    const r = await db.select({ n: sql<number>`count(*)::int` }).from(webhookDeliveries).where(and(eq(webhookDeliveries.success, 0), gte(webhookDeliveries.requestedAt, since)));
    return Number(r[0]?.n ?? 0);
  }
  if (metric === "email_failures") {
    const r = await db.select({ n: sql<number>`count(*)::int` }).from(emailDeliveryLog).where(and(eq(emailDeliveryLog.status, "failed"), gte(emailDeliveryLog.createdAt, since)));
    return Number(r[0]?.n ?? 0);
  }
  const r = await db.select({ n: sql<number>`count(*)::int` }).from(incidents).where(and(eq(incidents.severity, "critical"), sql`${incidents.status} in ('open','investigating')`));
  return Number(r[0]?.n ?? 0);
}

export type AlertEvaluation = { ruleKey: string; metric: string; count: number; threshold: number; fired: boolean };

/**
 * Evaluate every enabled rule. A firing raises an admin notification, and for
 * the security metrics also registers an incident so it enters the register
 * that SRS 20.10 requires rather than only flashing past in a bell.
 */
export async function evaluateAlertRules(now = new Date()): Promise<AlertEvaluation[]> {
  const db = await getDb();
  if (!db) return [];
  const rules = (await listAlertRules()).filter((r) => r.enabled);
  const results: AlertEvaluation[] = [];
  for (const rule of rules) {
    const count = await countMetric(rule.metric as AlertMetric, rule.windowMinutes, now);
    const fired = shouldFireAlert({ count, threshold: rule.threshold, windowMinutes: rule.windowMinutes, lastFiredAt: rule.lastFiredAt, now });
    results.push({ ruleKey: rule.key, metric: rule.metric, count, threshold: rule.threshold, fired });
    if (!fired) continue;
    // Claim the firing first (conditional on lastFiredAt unchanged) so two
    // concurrent evaluators cannot both raise the same alert.
    const claimed = await db
      .update(alertRules)
      .set({ lastFiredAt: now })
      .where(and(eq(alertRules.id, rule.id), rule.lastFiredAt ? eq(alertRules.lastFiredAt, rule.lastFiredAt) : isNull(alertRules.lastFiredAt)))
      .returning({ id: alertRules.id });
    if (claimed.length === 0) {
      results[results.length - 1]!.fired = false;
      continue;
    }
    await createAdminNotification({
      kind: "alert",
      title: `Alert: ${rule.title}`,
      body: `${count} in the last ${rule.windowMinutes} minutes (threshold ${rule.threshold}).`,
      href: "/admin/security",
      priority: rule.severity === "critical" ? "critical" : "high",
    });
    if (rule.metric === "failed_logins" || rule.metric === "open_critical_incidents") {
      if (rule.metric === "failed_logins") {
        await createIncident({
          category: "security",
          title: rule.title,
          description: `${count} failed sign-ins in ${rule.windowMinutes} minutes (threshold ${rule.threshold}). Raised by alert rule ${rule.key}.`,
          severity: rule.severity as "low" | "medium" | "high" | "critical",
          reportedByUserId: null,
        });
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Scheduled reports
// ---------------------------------------------------------------------------

export async function createScheduledReport(args: {
  name: string;
  reportKind: "pipeline" | "billing" | "delivery" | "security";
  cadence: Cadence;
  recipients: string[];
  firstRunAt: Date;
  createdByUserId: number;
}): Promise<ScheduledReport | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .insert(scheduledReports)
    .values({ name: args.name, reportKind: args.reportKind, cadence: args.cadence, recipientsJson: JSON.stringify(args.recipients), nextRunAt: args.firstRunAt, createdByUserId: args.createdByUserId })
    .returning();
  return rows[0] ?? null;
}

export async function listScheduledReports(): Promise<ScheduledReport[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduledReports).orderBy(asc(scheduledReports.nextRunAt));
}

export async function setScheduledReportEnabled(id: number, enabled: boolean): Promise<ScheduledReport | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.update(scheduledReports).set({ enabled }).where(eq(scheduledReports.id, id)).returning();
  return rows[0] ?? null;
}

/**
 * Claim every report that is due and advance its schedule in one statement, so
 * two app instances cannot both send the same report. Returns only the rows
 * this call won.
 */
export async function claimDueScheduledReports(now = new Date()): Promise<ScheduledReport[]> {
  const db = await getDb();
  if (!db) return [];
  const due = await db.select().from(scheduledReports).where(and(eq(scheduledReports.enabled, true), sql`${scheduledReports.nextRunAt} <= ${now}`));
  const won: ScheduledReport[] = [];
  for (const r of due) {
    const next = nextRunAfter(r.cadence as Cadence, now);
    const claimed = await db
      .update(scheduledReports)
      .set({ nextRunAt: next, lastRunAt: now })
      .where(and(eq(scheduledReports.id, r.id), eq(scheduledReports.nextRunAt, r.nextRunAt)))
      .returning();
    if (claimed[0]) won.push(r);
  }
  return won;
}

export async function recordScheduledReportResult(id: number, status: "sent" | "failed"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledReports).set({ lastStatus: status }).where(eq(scheduledReports.id, id));
}

// ---------------------------------------------------------------------------
// Delivery policy lookups used by the central notification service
// ---------------------------------------------------------------------------

import { inArray } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { shouldDeliver } from "../../shared/srsRules";

/** Whether one user wants this category on this channel. Security is always true. */
export async function isDeliveryAllowedForUser(userId: number, category: NotificationCategory, channel: NotificationChannel): Promise<boolean> {
  if (category === "security") return true;
  const db = await getDb();
  if (!db) return true;
  const prefs = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  return shouldDeliver({ category, channel, prefs });
}

/** Filters a list of recipient emails down to those who have not opted out of email for this category. */
export async function filterEmailsByPreference(emails: string[], category: NotificationCategory): Promise<string[]> {
  if (category === "security" || emails.length === 0) return emails;
  const db = await getDb();
  if (!db) return emails;
  const rows = await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.email, emails));
  const prefs = rows.length ? await db.select().from(notificationPreferences).where(inArray(notificationPreferences.userId, rows.map((r) => r.id))) : [];
  const allowed = new Set<string>();
  for (const r of rows) {
    if (!r.email) continue;
    const mine = prefs.filter((p) => p.userId === r.id);
    if (shouldDeliver({ category, channel: "email", prefs: mine })) allowed.add(r.email);
  }
  // An address with no matching user has no preferences, so it defaults to delivering.
  return emails.filter((e) => allowed.has(e) || !rows.some((r) => r.email === e));
}
