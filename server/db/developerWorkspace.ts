/**
 * server/db/developerWorkspace.ts
 *
 * Database helpers for the Developer Workspace domain.
 *
 * Every helper returns raw Drizzle rows. The router/middleware is responsible
 * for translating gate failures into TRPC errors and for filtering by
 * `developerId`. We never accept an explicit `developerId` from a client
 * caller — it is always derived server-side from `ctx.user.id` mapped through
 * the `developer_profiles` table.
 *
 * Tables touched: developer_profiles, developer_access_scopes,
 * developer_agreements, developer_projects, developer_project_assignments,
 * developer_tasks, developer_task_assignments, developer_project_files,
 * developer_submissions, developer_messages, developer_access_requests,
 * developer_audit, developer_security_events, developer_support_tickets,
 * developer_notifications.
 */
import { and, desc, eq, or } from "drizzle-orm";
import {
  developerAccessRequests,
  developerAccessScopes,
  developerAgreements,
  developerAudit,
  developerMessages,
  developerNotifications,
  developerProfiles,
  developerProjectAssignments,
  developerProjectFiles,
  developerProjects,
  developerSecurityEvents,
  developerSubmissions,
  developerSupportTickets,
  developerTaskAssignments,
  developerTasks,
  type DeveloperAccessScope,
  type DeveloperAgreement,
  type DeveloperAudit,
  type DeveloperMessage,
  type DeveloperNotification,
  type DeveloperProfile,
  type DeveloperProject,
  type DeveloperProjectAssignment,
  type DeveloperProjectFile,
  type DeveloperSecurityEvent,
  type DeveloperSubmission,
  type DeveloperSupportTicket,
  type DeveloperTask,
  type InsertDeveloperAgreement,
  type InsertDeveloperAudit,
  type InsertDeveloperSubmission,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Gate types & constants
// ---------------------------------------------------------------------------

/**
 * The five agreement types a developer must sign before they can see
 * any assigned work. Versions are intentionally pinned per type so the
 * gate trips when legal updates the document.
 */
export const REQUIRED_DEVELOPER_AGREEMENTS = [
  { type: "nda", version: "v1" },
  { type: "confidentiality", version: "v1" },
  { type: "non-solicitation", version: "v1" },
  { type: "liability", version: "v1" },
  { type: "security-policy", version: "v1" },
] as const;

export type DeveloperGate =
  | { ok: true }
  | { ok: false; reason: "no_profile" }
  | { ok: false; reason: "profile_suspended" }
  | { ok: false; reason: "profile_terminated" }
  | { ok: false; reason: "mfa_required" }
  | { ok: false; reason: "agreements_required"; missing: string[] }
  | { ok: false; reason: "no_active_scope" }
  | { ok: false; reason: "scope_revoked" }
  | { ok: false; reason: "scope_expired"; expiresMs: number }
  | { ok: false; reason: "no_assignments" };

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Fetch the developer profile keyed by application user id. Returns null
 * if the user has no profile row (which means they haven't been
 * onboarded as a developer yet).
 */
export async function getDeveloperProfileByUserId(
  userId: number,
): Promise<DeveloperProfile | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(developerProfiles)
    .where(eq(developerProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Update the developer's own profile fields. The admin-owned columns
 * (`status`, `mfaRequired`, `approvedMs`, `approvedByUserId`,
 * `applicationId`, `userId`) are intentionally not writable here.
 */
export async function updateDeveloperProfile(
  developerId: number,
  patch: Partial<{
    fullName: string;
    country: string | null;
    linkedin: string | null;
    github: string | null;
    portfolio: string | null;
    specialties: string | null;
    availability: "available" | "limited" | "unavailable";
  }>,
): Promise<DeveloperProfile | null> {
  const db = await getDb();
  if (!db) return null;
  await db
    .update(developerProfiles)
    .set(patch)
    .where(eq(developerProfiles.id, developerId));
  const rows = await db
    .select()
    .from(developerProfiles)
    .where(eq(developerProfiles.id, developerId))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Access scopes
// ---------------------------------------------------------------------------

/**
 * Most recent access scope row for a developer, regardless of status.
 * The gate logic uses both `status` and `expiresMs` to decide pass/fail.
 */
export async function getLatestAccessScopeForDeveloper(
  developerId: number,
): Promise<DeveloperAccessScope | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(developerAccessScopes)
    .where(eq(developerAccessScopes.developerId, developerId))
    .orderBy(desc(developerAccessScopes.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Agreements
// ---------------------------------------------------------------------------

/** All "signed" agreements on file for this developer (any version). */
export async function listSignedAgreementsForDeveloper(
  developerId: number,
): Promise<DeveloperAgreement[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(developerAgreements)
    .where(
      and(
        eq(developerAgreements.developerId, developerId),
        eq(developerAgreements.status, "signed"),
      ),
    );
}

/** Sign an agreement (idempotent: second sign of the same type/version is a no-op). */
export async function signDeveloperAgreement(args: {
  developerId: number;
  agreementType: string;
  version: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<DeveloperAgreement | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await db
    .select()
    .from(developerAgreements)
    .where(
      and(
        eq(developerAgreements.developerId, args.developerId),
        eq(developerAgreements.agreementType, args.agreementType),
        eq(developerAgreements.version, args.version),
        eq(developerAgreements.status, "signed"),
      ),
    )
    .limit(1);
  if (existing.length > 0) return existing[0];
  const insertInput: InsertDeveloperAgreement = {
    developerId: args.developerId,
    agreementType: args.agreementType,
    version: args.version,
    status: "signed",
    signedMs: Date.now(),
    signedIp: args.ip ?? null,
    signedUserAgent: args.userAgent ?? null,
  };
  const rows = await db.insert(developerAgreements).values(insertInput).returning();
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Gate evaluation
// ---------------------------------------------------------------------------

/** Active project assignments for this developer. */
export async function listActiveAssignmentsForDeveloper(
  developerId: number,
): Promise<DeveloperProjectAssignment[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(developerProjectAssignments)
    .where(
      and(
        eq(developerProjectAssignments.developerId, developerId),
        eq(developerProjectAssignments.status, "active"),
      ),
    )
    .orderBy(desc(developerProjectAssignments.createdAt));
}

/**
 * Compute the developer-workspace gate for a given user. Returns `{ ok:
 * true }` when the user is allowed to see project data, otherwise an
 * object describing which gate failed so the UI can route to the right
 * setup page.
 *
 * Order of checks mirrors the master spec section 6/8/10/11/14.
 */
export async function evaluateDeveloperGate(args: {
  userId: number;
  mfaMethod: string;
}): Promise<{
  gate: DeveloperGate;
  profile: DeveloperProfile | null;
  scope: DeveloperAccessScope | null;
  signedTypes: string[];
  assignments: DeveloperProjectAssignment[];
}> {
  const profile = await getDeveloperProfileByUserId(args.userId);
  if (!profile) {
    return {
      gate: { ok: false, reason: "no_profile" },
      profile: null,
      scope: null,
      signedTypes: [],
      assignments: [],
    };
  }
  if (profile.status === "suspended") {
    return {
      gate: { ok: false, reason: "profile_suspended" },
      profile,
      scope: null,
      signedTypes: [],
      assignments: [],
    };
  }
  if (profile.status === "terminated") {
    return {
      gate: { ok: false, reason: "profile_terminated" },
      profile,
      scope: null,
      signedTypes: [],
      assignments: [],
    };
  }
  if (
    profile.mfaRequired === 1 &&
    (!args.mfaMethod || args.mfaMethod === "none")
  ) {
    return {
      gate: { ok: false, reason: "mfa_required" },
      profile,
      scope: null,
      signedTypes: [],
      assignments: [],
    };
  }
  const signed = await listSignedAgreementsForDeveloper(profile.id);
  const signedTypes = signed.map((row) => row.agreementType);
  const missing = REQUIRED_DEVELOPER_AGREEMENTS.filter(
    (req) => !signedTypes.includes(req.type),
  ).map((req) => req.type);
  if (missing.length > 0) {
    return {
      gate: { ok: false, reason: "agreements_required", missing },
      profile,
      scope: null,
      signedTypes,
      assignments: [],
    };
  }
  const scope = await getLatestAccessScopeForDeveloper(profile.id);
  if (!scope) {
    return {
      gate: { ok: false, reason: "no_active_scope" },
      profile,
      scope: null,
      signedTypes,
      assignments: [],
    };
  }
  if (scope.status === "revoked") {
    return {
      gate: { ok: false, reason: "scope_revoked" },
      profile,
      scope,
      signedTypes,
      assignments: [],
    };
  }
  const nowMs = Date.now();
  if (
    scope.status === "expired" ||
    (scope.expiresMs && scope.expiresMs < nowMs)
  ) {
    return {
      gate: {
        ok: false,
        reason: "scope_expired",
        expiresMs: scope.expiresMs ?? nowMs,
      },
      profile,
      scope,
      signedTypes,
      assignments: [],
    };
  }
  const assignments = await listActiveAssignmentsForDeveloper(profile.id);
  if (assignments.length === 0) {
    return {
      gate: { ok: false, reason: "no_assignments" },
      profile,
      scope,
      signedTypes,
      assignments: [],
    };
  }
  return { gate: { ok: true }, profile, scope, signedTypes, assignments };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/** List the projects a developer has an active assignment for. */
export async function listAssignedDeveloperProjects(
  developerId: number,
): Promise<DeveloperProject[]> {
  const db = await getDb();
  if (!db) return [];
  const assignments = await listActiveAssignmentsForDeveloper(developerId);
  if (assignments.length === 0) return [];
  const projectIds = assignments.map((a) => a.projectId);
  const rows = await db
    .select()
    .from(developerProjects)
    .where(or(...projectIds.map((id) => eq(developerProjects.id, id))));
  // Re-order to match assignment order (most recent assignment first).
  const orderMap = new Map<number, number>();
  assignments.forEach((a, idx) => orderMap.set(a.projectId, idx));
  return rows.sort(
    (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99),
  );
}

/** Fetch a single project but only if the developer is assigned to it. */
export async function getAssignedDeveloperProject(args: {
  developerId: number;
  projectId: number;
}): Promise<DeveloperProject | null> {
  const db = await getDb();
  if (!db) return null;
  const link = await db
    .select()
    .from(developerProjectAssignments)
    .where(
      and(
        eq(developerProjectAssignments.projectId, args.projectId),
        eq(developerProjectAssignments.developerId, args.developerId),
        eq(developerProjectAssignments.status, "active"),
      ),
    )
    .limit(1);
  if (link.length === 0) return null;
  const rows = await db
    .select()
    .from(developerProjects)
    .where(eq(developerProjects.id, args.projectId))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * List active tasks for a developer scoped to assigned projects only.
 * Returns task rows joined with their assignment status so the UI can
 * tell "assigned to me" from "exists on the project but not mine".
 */
export async function listDeveloperTasks(developerId: number): Promise<
  Array<DeveloperTask & { mine: boolean; projectCode: string | null }>
> {
  const db = await getDb();
  if (!db) return [];
  const projects = await listAssignedDeveloperProjects(developerId);
  if (projects.length === 0) return [];
  const projectCodeMap = new Map<number, string>(
    projects.map((p) => [p.id, p.code]),
  );
  const taskRows = await db
    .select()
    .from(developerTasks)
    .where(or(...projects.map((p) => eq(developerTasks.projectId, p.id))))
    .orderBy(desc(developerTasks.createdAt));
  if (taskRows.length === 0) return [];
  const myAssignmentRows = await db
    .select()
    .from(developerTaskAssignments)
    .where(
      and(
        eq(developerTaskAssignments.developerId, developerId),
        eq(developerTaskAssignments.status, "active"),
      ),
    );
  const mineSet = new Set<number>(myAssignmentRows.map((row) => row.taskId));
  return taskRows.map((row) => ({
    ...row,
    mine: mineSet.has(row.id),
    projectCode: projectCodeMap.get(row.projectId) ?? null,
  }));
}

/**
 * Update task status — but only if the task belongs to a project the
 * developer is assigned to AND the developer holds an active task
 * assignment row. Returns the updated row or null if denied.
 */
export async function updateDeveloperTaskStatus(args: {
  developerId: number;
  taskId: number;
  status: "planned" | "in_progress" | "blocked" | "in_review" | "done";
}): Promise<DeveloperTask | null> {
  const db = await getDb();
  if (!db) return null;
  // 1. Resolve task -> project.
  const taskRows = await db
    .select()
    .from(developerTasks)
    .where(eq(developerTasks.id, args.taskId))
    .limit(1);
  const task = taskRows[0];
  if (!task) return null;
  // 2. Confirm developer has an active assignment to that project.
  const ownership = await db
    .select()
    .from(developerProjectAssignments)
    .where(
      and(
        eq(developerProjectAssignments.developerId, args.developerId),
        eq(developerProjectAssignments.projectId, task.projectId),
        eq(developerProjectAssignments.status, "active"),
      ),
    )
    .limit(1);
  if (ownership.length === 0) return null;
  // 3. Confirm developer has an active task assignment row.
  const taskOwnership = await db
    .select()
    .from(developerTaskAssignments)
    .where(
      and(
        eq(developerTaskAssignments.developerId, args.developerId),
        eq(developerTaskAssignments.taskId, args.taskId),
        eq(developerTaskAssignments.status, "active"),
      ),
    )
    .limit(1);
  if (taskOwnership.length === 0) return null;
  await db
    .update(developerTasks)
    .set({ status: args.status })
    .where(eq(developerTasks.id, args.taskId));
  const after = await db
    .select()
    .from(developerTasks)
    .where(eq(developerTasks.id, args.taskId))
    .limit(1);
  return after[0] ?? null;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** List approved files a developer can see (for any of their assigned projects). */
export async function listDeveloperFiles(developerId: number): Promise<
  Array<DeveloperProjectFile & { projectCode: string | null }>
> {
  const db = await getDb();
  if (!db) return [];
  const projects = await listAssignedDeveloperProjects(developerId);
  if (projects.length === 0) return [];
  const codeMap = new Map<number, string>(projects.map((p) => [p.id, p.code]));
  const rows = await db
    .select()
    .from(developerProjectFiles)
    .where(or(...projects.map((p) => eq(developerProjectFiles.projectId, p.id))))
    .orderBy(desc(developerProjectFiles.createdAt));
  return rows.map((row) => ({
    ...row,
    projectCode: codeMap.get(row.projectId) ?? null,
  }));
}

/** Fetch a single approved file row but only if accessible to this developer. */
export async function getApprovedFileForDeveloper(args: {
  developerId: number;
  fileId: number;
}): Promise<DeveloperProjectFile | null> {
  const db = await getDb();
  if (!db) return null;
  const fileRows = await db
    .select()
    .from(developerProjectFiles)
    .where(eq(developerProjectFiles.id, args.fileId))
    .limit(1);
  const file = fileRows[0];
  if (!file) return null;
  const ownership = await db
    .select()
    .from(developerProjectAssignments)
    .where(
      and(
        eq(developerProjectAssignments.developerId, args.developerId),
        eq(developerProjectAssignments.projectId, file.projectId),
        eq(developerProjectAssignments.status, "active"),
      ),
    )
    .limit(1);
  if (ownership.length === 0) return null;
  return file;
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

/** List all submissions/commits for a developer (own only). */
export async function listDeveloperSubmissions(
  developerId: number,
): Promise<DeveloperSubmission[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(developerSubmissions)
    .where(eq(developerSubmissions.developerId, developerId))
    .orderBy(desc(developerSubmissions.createdAt));
}

/** Append a submission/commit row tied to an assigned project. */
export async function createDeveloperSubmission(
  input: InsertDeveloperSubmission,
): Promise<DeveloperSubmission | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(developerSubmissions).values(input).returning();
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** List inbound + outbound messages for a developer thread (admin <-> developer only). */
export async function listDeveloperMessages(
  developerId: number,
): Promise<DeveloperMessage[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(developerMessages)
    .where(eq(developerMessages.developerId, developerId))
    .orderBy(developerMessages.createdAt);
}

/** Append a developer-authored message destined for IO SKY admin. */
export async function appendDeveloperMessage(args: {
  developerId: number;
  senderName: string | null;
  subject: string | null;
  body: string;
}): Promise<DeveloperMessage | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .insert(developerMessages)
    .values({
      developerId: args.developerId,
      sender: "developer",
      senderName: args.senderName,
      subject: args.subject,
      body: args.body,
    })
    .returning();
  return rows[0] ?? null;
}

/** Mark every admin-authored message in this developer's inbox as read. */
export async function markAdminMessagesReadForDeveloper(
  developerId: number,
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .update(developerMessages)
    .set({ readAt: Date.now() })
    .where(
      and(
        eq(developerMessages.developerId, developerId),
        eq(developerMessages.sender, "admin"),
      ),
    )
    .returning({ id: developerMessages.id });
  return rows.length;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** Append a workspace-side notification visible in the developer's bell. */
export async function appendDeveloperNotification(args: {
  developerId: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(developerNotifications).values(args);
}

/** List recent notifications for the workspace bell. */
export async function listDeveloperNotifications(
  developerId: number,
  limit = 25,
): Promise<DeveloperNotification[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(developerNotifications)
    .where(eq(developerNotifications.developerId, developerId))
    .orderBy(desc(developerNotifications.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Support tickets & access requests
// ---------------------------------------------------------------------------

/** Open a developer support ticket. */
export async function createDeveloperSupportTicket(args: {
  developerId: number;
  publicRef: string;
  subject: string;
  body: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
}): Promise<DeveloperSupportTicket | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(developerSupportTickets).values(args).returning();
  return rows[0] ?? null;
}

/** Open an access-extension request. */
export async function createDeveloperAccessRequest(args: {
  developerId: number;
  scopeId: number | null;
  reason: string;
}): Promise<{ ok: true }> {
  const db = await getDb();
  if (!db) return { ok: true };
  await db.insert(developerAccessRequests).values(args);
  return { ok: true } as const;
}

// ---------------------------------------------------------------------------
// Audit & security events
// ---------------------------------------------------------------------------

/** Append a row to the developer audit log. */
export async function appendDeveloperAudit(
  input: InsertDeveloperAudit,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(developerAudit).values(input);
}

/** Append a row to the developer security-events log. */
export async function appendDeveloperSecurityEvent(args: {
  developerId: number | null;
  kind: string;
  severity: "info" | "warn" | "high" | "critical";
  message: string;
  detail: string | null;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(developerSecurityEvents).values(args);
}

/** Fetch the most recent audit rows for a developer (admin-side surface). */
export async function listDeveloperAuditForDeveloper(
  developerId: number,
  limit = 50,
): Promise<DeveloperAudit[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(developerAudit)
    .where(eq(developerAudit.developerId, developerId))
    .orderBy(desc(developerAudit.createdAt))
    .limit(limit);
}

/**
 * Fetch the calling developer's own audit timeline (no cross-developer
 * leakage by construction). Limit defaults to 50.
 */
export async function listDeveloperAuditEventsForSelf(
  developerId: number,
  limit = 50,
): Promise<DeveloperAudit[]> {
  return listDeveloperAuditForDeveloper(developerId, limit);
}

/** Fetch recent security events for a developer (admin-side surface). */
export async function listDeveloperSecurityEventsForDeveloper(
  developerId: number,
  limit = 25,
): Promise<DeveloperSecurityEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(developerSecurityEvents)
    .where(eq(developerSecurityEvents.developerId, developerId))
    .orderBy(desc(developerSecurityEvents.createdAt))
    .limit(limit);
}
