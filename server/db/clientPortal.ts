/**
 * server/db/clientPortal.ts
 *
 * Database helpers for the Client Portal domain.
 * Covers: organizations, reports, recommendations, projects, milestones,
 * invoices, documents, messages, notifications, support tickets,
 * dashboard bundle, discovery calls for org, and document upload/delete.
 *
 * Every helper scopes by organizationId so the clientProcedure can rely
 * on tenant isolation. Returns raw Drizzle rows.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import {
  bookings as bookingsTable,
  clientDocuments,
  clientInvoices,
  clientMessages,
  clientNotifications,
  clientProjectMilestones,
  clientProjects,
  clientRecommendations,
  clientReports,
  clientSupportTickets,
  organizationMemberships,
  organizations,
  users as usersTable,
  type ClientInvoice,
  type ClientProject,
  type ClientProjectMilestone,
  type ClientReport,
  type Organization,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { generatePublicRef } from "../_core/publicRef";

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export async function getOrganizationById(
  id: number,
): Promise<Organization | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrganizationMemberCount(orgId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.organizationId, orgId));
  return Number(rows[0]?.c ?? 0);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function listClientReports(orgId: number) {
  const db = await getDb();
  if (!db) return [] as ClientReport[];
  return db
    .select()
    .from(clientReports)
    .where(eq(clientReports.organizationId, orgId))
    .orderBy(desc(clientReports.createdAt))
    .limit(50);
}

export async function getClientReport(orgId: number, publicRef: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(clientReports)
    .where(
      and(
        eq(clientReports.organizationId, orgId),
        eq(clientReports.publicRef, publicRef),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** By-id helper used by signed download / detail flows. */
export async function getClientReportById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(clientReports)
    .where(
      and(eq(clientReports.organizationId, orgId), eq(clientReports.id, id)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Milestone 2 §2.4 — admin-authored report creation, including the AI Scan
 * funnel bridge (server/routers/admin.ts's promoteAiScanToClientReport
 * passes the scan's own score/summary through here). publicRef is
 * generated the same way every other public-facing reference in this app
 * is (server/_core/publicRef.ts), not caller-supplied.
 */
export async function createClientReport(input: {
  organizationId: number;
  title: string;
  scanType?: string;
  score: number;
  delta?: number;
  summary?: string | null;
  pdfKey?: string | null;
  status?: "draft" | "ready" | "delivered";
  pages?: number | null;
}): Promise<ClientReport | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .insert(clientReports)
    .values({
      organizationId: input.organizationId,
      publicRef: generatePublicRef("R"),
      title: input.title,
      scanType: input.scanType ?? "ai-scan",
      score: input.score,
      delta: input.delta ?? 0,
      summary: input.summary ?? null,
      pdfKey: input.pdfKey ?? null,
      status: input.status ?? "ready",
      pages: input.pages ?? null,
    })
    .returning();
  return rows[0] ?? null;
}

export async function updateClientReport(
  orgId: number,
  id: number,
  updates: Partial<{
    title: string;
    score: number;
    delta: number;
    summary: string | null;
    pdfKey: string | null;
    status: "draft" | "ready" | "delivered";
    pages: number | null;
  }>,
): Promise<ClientReport | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(clientReports)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(clientReports.organizationId, orgId), eq(clientReports.id, id)))
    .returning();
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export async function listClientRecommendations(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientRecommendations)
    .where(eq(clientRecommendations.organizationId, orgId))
    .orderBy(desc(clientRecommendations.createdAt))
    .limit(100);
}

export async function getClientRecommendationById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(clientRecommendations)
    .where(
      and(
        eq(clientRecommendations.organizationId, orgId),
        eq(clientRecommendations.id, id),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function updateClientRecommendationStatus(
  orgId: number,
  id: number,
  status: "pending" | "in_progress" | "completed" | "dismissed",
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(clientRecommendations)
    .set({ status })
    .where(
      and(
        eq(clientRecommendations.organizationId, orgId),
        eq(clientRecommendations.id, id),
      ),
    );
}

// ---------------------------------------------------------------------------
// Projects & milestones
// ---------------------------------------------------------------------------

export async function listClientProjects(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientProjects)
    .where(eq(clientProjects.organizationId, orgId))
    .orderBy(desc(clientProjects.createdAt))
    .limit(50);
}

export async function listClientProjectMilestones(projectIds: number[]) {
  const db = await getDb();
  if (!db || projectIds.length === 0) return [];
  return db
    .select()
    .from(clientProjectMilestones)
    .where(
      sql`${clientProjectMilestones.projectId} IN (${sql.join(
        projectIds.map((id) => sql`${id}`),
        sql`,`,
      )})`,
    );
}

/** By-id helper, tenant-scoped — needed to verify a projectId belongs to
 * the calling admin's target org before creating/updating a milestone
 * under it (client_project_milestones has no organizationId of its own —
 * see the schema comment above clientProjectMilestonesStatusEnum). */
export async function getClientProjectById(
  orgId: number,
  id: number,
): Promise<ClientProject | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(clientProjects)
    .where(and(eq(clientProjects.organizationId, orgId), eq(clientProjects.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createClientProject(input: {
  organizationId: number;
  name: string;
  phase?: string;
  status?: "planning" | "active" | "on_hold" | "completed";
  progress?: number;
  startMs?: number | null;
  targetMs?: number | null;
  summary?: string | null;
}): Promise<ClientProject | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .insert(clientProjects)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      phase: input.phase ?? "Discovery",
      status: input.status ?? "active",
      progress: input.progress ?? 0,
      startMs: input.startMs ?? null,
      targetMs: input.targetMs ?? null,
      summary: input.summary ?? null,
    })
    .returning();
  return rows[0] ?? null;
}

export async function updateClientProject(
  orgId: number,
  id: number,
  updates: Partial<{
    name: string;
    phase: string;
    status: "planning" | "active" | "on_hold" | "completed";
    progress: number;
    startMs: number | null;
    targetMs: number | null;
    summary: string | null;
  }>,
): Promise<ClientProject | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(clientProjects)
    .set(updates)
    .where(and(eq(clientProjects.organizationId, orgId), eq(clientProjects.id, id)))
    .returning();
  return rows[0] ?? null;
}

/**
 * Tenant-scoped via an explicit projectId ownership check by the caller
 * (server/routers/admin.ts calls getClientProjectById first) — mirrors
 * exactly what client_project_milestones' own RLS policy does at the
 * database layer (an EXISTS join through client_projects, since this
 * table carries no organizationId column of its own).
 */
export async function createClientProjectMilestone(input: {
  projectId: number;
  title: string;
  dueMs?: number | null;
  status?: "pending" | "in_progress" | "completed";
  body?: string | null;
}): Promise<ClientProjectMilestone | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .insert(clientProjectMilestones)
    .values({
      projectId: input.projectId,
      title: input.title,
      dueMs: input.dueMs ?? null,
      status: input.status ?? "pending",
      body: input.body ?? null,
    })
    .returning();
  return rows[0] ?? null;
}

export async function updateClientProjectMilestone(
  projectId: number,
  id: number,
  updates: Partial<{
    title: string;
    dueMs: number | null;
    status: "pending" | "in_progress" | "completed";
    body: string | null;
  }>,
): Promise<ClientProjectMilestone | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(clientProjectMilestones)
    .set(updates)
    .where(and(eq(clientProjectMilestones.projectId, projectId), eq(clientProjectMilestones.id, id)))
    .returning();
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function listClientInvoices(orgId: number): Promise<ClientInvoice[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientInvoices)
    .where(eq(clientInvoices.organizationId, orgId))
    .orderBy(desc(clientInvoices.issuedMs))
    .limit(100);
}

export async function getClientInvoiceById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(clientInvoices)
    .where(
      and(
        eq(clientInvoices.organizationId, orgId),
        eq(clientInvoices.id, id),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function listClientDocuments(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientDocuments)
    .where(eq(clientDocuments.organizationId, orgId))
    .orderBy(desc(clientDocuments.createdAt))
    .limit(200);
}

export async function getClientDocumentById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(clientDocuments)
    .where(
      and(
        eq(clientDocuments.organizationId, orgId),
        eq(clientDocuments.id, id),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function insertClientDocument(input: {
  organizationId: number;
  name: string;
  category: string;
  fileKey: string;
  sizeBytes: number | null;
  mimeType: string | null;
  uploadedByUserId: number | null;
  uploadedBy: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(clientDocuments).values(input).returning();
  return rows[0] ? { id: rows[0].id } : null;
}

export async function deleteClientDocumentById(
  orgId: number,
  id: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(clientDocuments)
    .where(
      and(
        eq(clientDocuments.organizationId, orgId),
        eq(clientDocuments.id, id),
      ),
    );
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function listClientMessages(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientMessages)
    .where(eq(clientMessages.organizationId, orgId))
    .orderBy(desc(clientMessages.createdAt))
    .limit(100);
}

export async function appendClientMessage(input: {
  organizationId: number;
  threadKey: string;
  sender: "io-sky" | "client";
  senderName?: string | null;
  subject?: string | null;
  body: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const res = await db.insert(clientMessages).values({
    organizationId: input.organizationId,
    threadKey: input.threadKey,
    sender: input.sender,
    senderName: input.senderName ?? null,
    subject: input.subject ?? null,
    body: input.body,
  });
  return res;
}

/**
 * Mark every IO-SKY-authored message in this tenant's inbox as read.
 * We only flip readAt for messages the client did *not* author themselves —
 * outbound messages are implicitly read by the sender.
 */
export async function markIoSkyMessagesRead(orgId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .update(clientMessages)
    .set({ readAt: Date.now() })
    .where(
      and(
        eq(clientMessages.organizationId, orgId),
        eq(clientMessages.sender, "io-sky"),
      ),
    )
    .returning({ id: clientMessages.id });
  return rows.length;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function listClientNotifications(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientNotifications)
    .where(eq(clientNotifications.organizationId, orgId))
    .orderBy(desc(clientNotifications.createdAt))
    .limit(40);
}

export async function appendClientNotification(input: {
  organizationId: number;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(clientNotifications).values({
    organizationId: input.organizationId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
  });
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

export async function listClientSupportTickets(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientSupportTickets)
    .where(eq(clientSupportTickets.organizationId, orgId))
    .orderBy(desc(clientSupportTickets.createdAt))
    .limit(100);
}

export async function createClientSupportTicket(input: {
  organizationId: number;
  openedByUserId: number | null;
  publicRef: string;
  subject: string;
  body: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(clientSupportTickets).values({
    organizationId: input.organizationId,
    openedByUserId: input.openedByUserId ?? null,
    publicRef: input.publicRef,
    subject: input.subject,
    body: input.body,
    category: input.category ?? "general",
    priority: input.priority ?? "normal",
  });
  return { publicRef: input.publicRef };
}

// ---------------------------------------------------------------------------
// Dashboard bundle
// ---------------------------------------------------------------------------

/**
 * Build a single bundle for the client-portal dashboard so the UI only
 * needs one round-trip for the overview card grid + activity feed.
 */
export async function getClientPortalDashboard(orgId: number) {
  const [
    org,
    reports,
    recommendations,
    projects,
    invoices,
    messages,
    notifications,
  ] = await Promise.all([
    getOrganizationById(orgId),
    listClientReports(orgId),
    listClientRecommendations(orgId),
    listClientProjects(orgId),
    listClientInvoices(orgId),
    listClientMessages(orgId),
    listClientNotifications(orgId),
  ]);
  return {
    organization: org,
    latestReport: reports[0] ?? null,
    reportCount: reports.length,
    recommendations: recommendations.slice(0, 5),
    activeRecommendationCount: recommendations.filter(
      (r) => r.status !== "completed" && r.status !== "dismissed",
    ).length,
    projects,
    invoices,
    messages: messages.slice(0, 5),
    notifications: notifications.slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Discovery calls for org (matches by member emails)
// ---------------------------------------------------------------------------

export async function listOrgMemberEmails(orgId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.organizationId, orgId));
  return rows.map((r) => (r.email ?? "").toLowerCase()).filter(Boolean);
}

/**
 * Discovery Calls for the client portal. We don't have a direct
 * organizationId on bookings, so we match by emails of the
 * organization's members (case-insensitive).
 */
export async function listStrategyCallsForOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const emails = await listOrgMemberEmails(orgId);
  if (emails.length === 0) return [];
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(
      sql`LOWER(${bookingsTable.email}) IN (${sql.join(
        emails.map((e) => sql`${e}`),
        sql`,`,
      )})`,
    )
    .orderBy(desc(bookingsTable.slotStartMs))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    publicRef: r.publicRef,
    serviceLabel: r.serviceId,
    slotStart: new Date(r.slotStartMs),
    slotStartMs: r.slotStartMs,
    durationMin: r.durationMin,
    timezone: r.timezone,
    status: r.status,
    meetingUrl: null as string | null,
  }));
}

// NOTE: listLoginAuditForUser is defined in server/db/auth.ts
// and re-exported via server/db/index.ts — do not duplicate here.

/**
 * Fetch a single booking only if its email belongs to the caller's
 * organization. Returns null otherwise so the procedure can throw NOT_FOUND
 * without leaking existence across tenants.
 */
export async function getBookingForOrg(
  orgId: number,
  id: number,
) {
  const db = await getDb();
  if (!db) return null;
  const emails = await listOrgMemberEmails(orgId);
  if (emails.length === 0) return null;
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!emails.includes((row.email ?? "").toLowerCase())) return null;
  return row;
}
