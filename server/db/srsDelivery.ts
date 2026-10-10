/**
 * Delivery-side SRS write paths: developer time registration (SRS 11.8),
 * customer approval gates (BR-019, SRS 15.13) and project archiving (15.17).
 *
 * Same convention as the rest of server/db: no authorisation opinion here.
 * RBAC lives on the tRPC procedures; these functions enforce data integrity
 * (who may log time against what) because that must hold on every path.
 */
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  clientProjectMilestones,
  clientProjects,
  developerProfiles,
  developerProjectAssignments,
  developerProjects,
  developerTimeEntries,
  projectApprovals,
  type DeveloperTimeEntry,
  type ProjectApproval,
} from "../../drizzle/schema";
import { checkCanArchiveProject } from "../../shared/srsRules";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Time registration
// ---------------------------------------------------------------------------

/**
 * BR-018 applies to time too: a developer can only log hours against a project
 * they hold an ACTIVE assignment on, checked in the same transaction as the
 * insert so an assignment ended a moment ago cannot be raced.
 */
export async function createTimeEntry(args: {
  developerId: number;
  projectId: number;
  taskId: number | null;
  workDate: string;
  minutes: number;
  note: string | null;
}): Promise<DeveloperTimeEntry | "not_on_project" | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const onProject = await tx
      .select({ id: developerProjectAssignments.id })
      .from(developerProjectAssignments)
      .where(
        and(
          eq(developerProjectAssignments.projectId, args.projectId),
          eq(developerProjectAssignments.developerId, args.developerId),
          eq(developerProjectAssignments.status, "active"),
          // A reviewer inspects the work; they are not an implementer and do not bill time to it.
          ne(developerProjectAssignments.assignmentRole, "reviewer"),
        ),
      )
      .limit(1);
    if (onProject.length === 0) return "not_on_project" as const;
    const rows = await tx.insert(developerTimeEntries).values(args).returning();
    return rows[0] ?? null;
  });
}

export async function listTimeEntriesForDeveloper(developerId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: developerTimeEntries.id,
      projectId: developerTimeEntries.projectId,
      projectCode: developerProjects.code,
      taskId: developerTimeEntries.taskId,
      workDate: developerTimeEntries.workDate,
      minutes: developerTimeEntries.minutes,
      note: developerTimeEntries.note,
      status: developerTimeEntries.status,
      reviewNote: developerTimeEntries.reviewNote,
    })
    .from(developerTimeEntries)
    .innerJoin(developerProjects, eq(developerProjects.id, developerTimeEntries.projectId))
    .where(eq(developerTimeEntries.developerId, developerId))
    .orderBy(desc(developerTimeEntries.workDate), desc(developerTimeEntries.id))
    .limit(limit);
}

export async function listTimeEntriesForReview(status: "submitted" | "approved" | "rejected" | null, limit = 200) {
  const db = await getDb();
  if (!db) return [];
  const q = db
    .select({
      id: developerTimeEntries.id,
      developerId: developerTimeEntries.developerId,
      developerName: developerProfiles.fullName,
      projectCode: developerProjects.code,
      workDate: developerTimeEntries.workDate,
      minutes: developerTimeEntries.minutes,
      note: developerTimeEntries.note,
      status: developerTimeEntries.status,
    })
    .from(developerTimeEntries)
    .innerJoin(developerProfiles, eq(developerProfiles.id, developerTimeEntries.developerId))
    .innerJoin(developerProjects, eq(developerProjects.id, developerTimeEntries.projectId));
  const filtered = status ? q.where(eq(developerTimeEntries.status, status)) : q;
  return filtered.orderBy(desc(developerTimeEntries.workDate), desc(developerTimeEntries.id)).limit(limit);
}

/** Only a submitted entry can be decided, so a decision is never silently flipped. */
export async function reviewTimeEntry(args: {
  id: number;
  status: "approved" | "rejected";
  reviewerUserId: number;
  note: string | null;
}): Promise<DeveloperTimeEntry | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(developerTimeEntries)
    .set({ status: args.status, reviewedByUserId: args.reviewerUserId, reviewedAt: new Date(), reviewNote: args.note })
    .where(and(eq(developerTimeEntries.id, args.id), eq(developerTimeEntries.status, "submitted")))
    .returning();
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Customer approval gates (BR-019)
// ---------------------------------------------------------------------------

export async function requestProjectApproval(args: {
  projectId: number;
  milestoneId: number | null;
  title: string;
  description: string | null;
  requestedByUserId: number;
}): Promise<ProjectApproval | "project_not_found" | "milestone_mismatch" | null> {
  const db = await getDb();
  if (!db) return null;
  const project = (await db.select({ id: clientProjects.id }).from(clientProjects).where(eq(clientProjects.id, args.projectId)).limit(1))[0];
  if (!project) return "project_not_found";
  if (args.milestoneId) {
    const m = (
      await db
        .select({ projectId: clientProjectMilestones.projectId })
        .from(clientProjectMilestones)
        .where(eq(clientProjectMilestones.id, args.milestoneId))
        .limit(1)
    )[0];
    if (!m || m.projectId !== args.projectId) return "milestone_mismatch";
  }
  const rows = await db.insert(projectApprovals).values(args).returning();
  return rows[0] ?? null;
}

export async function listApprovalsForProject(projectId: number): Promise<ProjectApproval[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectApprovals).where(eq(projectApprovals.projectId, projectId)).orderBy(desc(projectApprovals.createdAt));
}

/** Tenant scoped: joins through client_projects so one org can never read another's gates. */
export async function listApprovalsForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: projectApprovals.id,
      projectId: projectApprovals.projectId,
      projectName: clientProjects.name,
      title: projectApprovals.title,
      description: projectApprovals.description,
      status: projectApprovals.status,
      decisionNote: projectApprovals.decisionNote,
      decidedAt: projectApprovals.decidedAt,
      createdAt: projectApprovals.createdAt,
    })
    .from(projectApprovals)
    .innerJoin(clientProjects, eq(clientProjects.id, projectApprovals.projectId))
    .where(eq(clientProjects.organizationId, organizationId))
    .orderBy(desc(projectApprovals.createdAt));
}

export async function listPendingApprovalsAcrossProjects(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: projectApprovals.id,
      projectId: projectApprovals.projectId,
      projectName: clientProjects.name,
      title: projectApprovals.title,
      createdAt: projectApprovals.createdAt,
    })
    .from(projectApprovals)
    .innerJoin(clientProjects, eq(clientProjects.id, projectApprovals.projectId))
    .where(eq(projectApprovals.status, "pending"))
    .orderBy(desc(projectApprovals.createdAt))
    .limit(limit);
}

export async function decideProjectApproval(args: {
  id: number;
  organizationId: number;
  userId: number;
  decision: "approved" | "rejected";
  note: string | null;
}): Promise<ProjectApproval | "not_found" | "already_decided" | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const row = (
      await tx
        .select({ a: projectApprovals })
        .from(projectApprovals)
        .innerJoin(clientProjects, eq(clientProjects.id, projectApprovals.projectId))
        .where(and(eq(projectApprovals.id, args.id), eq(clientProjects.organizationId, args.organizationId)))
        .limit(1)
    )[0];
    if (!row) return "not_found" as const;
    if (row.a.status !== "pending") return "already_decided" as const;
    const updated = await tx
      .update(projectApprovals)
      .set({ status: args.decision, decidedByUserId: args.userId, decidedAt: new Date(), decisionNote: args.note })
      .where(and(eq(projectApprovals.id, args.id), eq(projectApprovals.status, "pending")))
      .returning();
    return updated[0] ?? ("already_decided" as const);
  });
}

// ---------------------------------------------------------------------------
// Archive policy (SRS 15.17)
// ---------------------------------------------------------------------------

export async function archiveClientProject(
  projectId: number,
): Promise<{ ok: true } | { ok: false; reason: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const project = (await db.select().from(clientProjects).where(eq(clientProjects.id, projectId)).limit(1))[0];
  if (!project) return { ok: false, reason: "Project not found." };
  const pending = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projectApprovals)
    .where(and(eq(projectApprovals.projectId, projectId), inArray(projectApprovals.status, ["pending"])));
  const verdict = checkCanArchiveProject({
    status: project.status,
    pendingApprovals: pending[0]?.n ?? 0,
    archivedAt: project.archivedAt ?? null,
  });
  if (!verdict.ok) return verdict;
  await db.update(clientProjects).set({ archivedAt: new Date() }).where(eq(clientProjects.id, projectId));
  return { ok: true };
}

export async function getProjectOrganizationId(projectId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select({ o: clientProjects.organizationId }).from(clientProjects).where(eq(clientProjects.id, projectId)).limit(1);
  return r[0]?.o ?? null;
}
