/**
 * Persistence for notification templates, the document matrix, operator scopes
 * and AI usage reporting.
 */
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { aiUsage, documentMatrix, notificationTemplates, operatorScopes, users } from "../../drizzle/schema";
import { type ScopeGrant } from "../../shared/platformRules";
import { getDb } from "./connection";

// ---- Templates ---------------------------------------------------------------------------------------------------

export async function listTemplates(eventName?: string) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(notificationTemplates);
  return (eventName ? q.where(eq(notificationTemplates.eventName, eventName)) : q)
    .orderBy(notificationTemplates.eventName, notificationTemplates.channel, notificationTemplates.locale, desc(notificationTemplates.version))
    .limit(500);
}

/** Every edit is a new version. Nothing is overwritten, so history and rollback are free. */
export async function saveTemplateVersion(args: { eventName: string; channel: string; locale: string; subject: string; body: string; userId: number }) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const [{ v }] = await tx
      .select({ v: sql<number>`coalesce(max(${notificationTemplates.version}), 0)::int` })
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.eventName, args.eventName), eq(notificationTemplates.channel, args.channel), eq(notificationTemplates.locale, args.locale)));
    const rows = await tx
      .insert(notificationTemplates)
      .values({ eventName: args.eventName, channel: args.channel, locale: args.locale, version: v + 1, subject: args.subject, body: args.body, status: "draft", createdByUserId: args.userId })
      .returning();
    return rows[0] ?? null;
  });
}

/** Activates one version and archives the previously active one for the same variant. */
export async function activateTemplate(id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const row = (await tx.select().from(notificationTemplates).where(eq(notificationTemplates.id, id)).limit(1))[0];
    if (!row) return "not_found" as const;
    await tx
      .update(notificationTemplates)
      .set({ status: "archived" })
      .where(and(eq(notificationTemplates.eventName, row.eventName), eq(notificationTemplates.channel, row.channel), eq(notificationTemplates.locale, row.locale), eq(notificationTemplates.status, "active")));
    const updated = await tx.update(notificationTemplates).set({ status: "active" }).where(eq(notificationTemplates.id, id)).returning();
    return updated[0]!;
  });
}

export async function getActiveTemplate(eventName: string, channel: string, locale: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(notificationTemplates)
    .where(and(eq(notificationTemplates.eventName, eventName), eq(notificationTemplates.channel, channel), eq(notificationTemplates.locale, locale), eq(notificationTemplates.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

// ---- Document matrix ---------------------------------------------------------------------------------------------

export async function listDocumentMatrix() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentMatrix).orderBy(documentMatrix.label);
}

export async function getDocumentMatrixRow(documentType: string) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(documentMatrix).where(eq(documentMatrix.documentType, documentType)).limit(1))[0] ?? null;
}

export async function updateDocumentMatrixRow(
  documentType: string,
  patch: { authorizedRoles?: string; versioned?: boolean; approvalRequired?: boolean; retentionDays?: number | null; archiveOnProjectCompletion?: boolean; classification?: string; clientVisible?: boolean },
  userId: number,
) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(documentMatrix)
    .set({ ...patch, provisional: false, updatedByUserId: userId, updatedAt: new Date() })
    .where(eq(documentMatrix.documentType, documentType))
    .returning();
  return rows[0] ?? null;
}

// ---- Operator scopes ---------------------------------------------------------------------------------------------

export async function listOperatorScopes(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const q = db
    .select({
      id: operatorScopes.id,
      userId: operatorScopes.userId,
      email: users.email,
      name: users.name,
      scope: operatorScopes.scope,
      expiresAt: operatorScopes.expiresAt,
      revokedAt: operatorScopes.revokedAt,
      note: operatorScopes.note,
      createdAt: operatorScopes.createdAt,
    })
    .from(operatorScopes)
    .innerJoin(users, eq(users.id, operatorScopes.userId));
  return (userId ? q.where(eq(operatorScopes.userId, userId)) : q).orderBy(desc(operatorScopes.createdAt)).limit(300);
}

export async function grantOperatorScope(args: { userId: number; scope: string; expiresAt: Date | null; note: string | null; grantedByUserId: number }) {
  const db = await getDb();
  if (!db) return "unavailable" as const;
  const target = (await db.select({ role: users.role }).from(users).where(eq(users.id, args.userId)).limit(1))[0];
  if (!target) return "no_user" as const;
  if (target.role !== "technical_operator") return "not_operator" as const;
  const rows = await db.insert(operatorScopes).values({ userId: args.userId, scope: args.scope, expiresAt: args.expiresAt, note: args.note, grantedByUserId: args.grantedByUserId }).returning();
  return rows[0]!;
}

export async function revokeOperatorScope(id: number, now = new Date()): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.update(operatorScopes).set({ revokedAt: now }).where(and(eq(operatorScopes.id, id), isNull(operatorScopes.revokedAt))).returning({ id: operatorScopes.id });
  return rows.length > 0;
}

export async function getScopeGrants(userId: number): Promise<ScopeGrant[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select({ scope: operatorScopes.scope, expiresAt: operatorScopes.expiresAt, revokedAt: operatorScopes.revokedAt }).from(operatorScopes).where(eq(operatorScopes.userId, userId));
}

// ---- AI usage ----------------------------------------------------------------------------------------------------

export async function summariseAiUsage(days = 30) {
  const db = await getDb();
  if (!db) return { byModel: [], total: { calls: 0, promptTokens: 0, completionTokens: 0, costMicros: 0, unpriced: 0 } };
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({
      model: aiUsage.model,
      complexity: aiUsage.complexity,
      calls: sql<number>`count(*)::int`,
      promptTokens: sql<number>`coalesce(sum(${aiUsage.promptTokens}),0)::int`,
      completionTokens: sql<number>`coalesce(sum(${aiUsage.completionTokens}),0)::int`,
      costMicros: sql<number>`coalesce(sum(${aiUsage.costMicros}),0)::int`,
      unpriced: sql<number>`count(*) filter (where ${aiUsage.costMicros} is null)::int`,
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since))
    .groupBy(aiUsage.model, aiUsage.complexity)
    .orderBy(desc(sql`count(*)`));
  const total = rows.reduce(
    (a, r) => ({ calls: a.calls + r.calls, promptTokens: a.promptTokens + r.promptTokens, completionTokens: a.completionTokens + r.completionTokens, costMicros: a.costMicros + r.costMicros, unpriced: a.unpriced + r.unpriced }),
    { calls: 0, promptTokens: 0, completionTokens: 0, costMicros: 0, unpriced: 0 },
  );
  return { byModel: rows, total };
}
