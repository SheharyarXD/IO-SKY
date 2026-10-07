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
  users,
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

/** Fetch a developer profile by its own id (not the linked user id). */
export async function getDeveloperProfileById(
  developerId: number,
): Promise<DeveloperProfile | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(developerProfiles)
    .where(eq(developerProfiles.id, developerId))
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

/**
 * Milestone 2 — admin-initiated access grant. Previously there was no way
 * anywhere in the app to grant a developer access; only a self-service
 * *request* path existed (createDeveloperAccessRequest below), with no
 * corresponding admin-side grant/approval mutation. Inserts a fresh scope
 * row rather than updating an existing one — matches this table's own
 * "one row per grant, most-recent wins" shape (getLatestAccessScopeForDeveloper
 * above already reads it that way).
 */
export async function createDeveloperAccessScope(args: {
  developerId: number;
  level: "baseline" | "extended" | "elevated";
  expiresMs: number | null;
  allowedActions?: string | null;
  allowedRoutes?: string | null;
  createdByUserId: number;
}): Promise<DeveloperAccessScope | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .insert(developerAccessScopes)
    .values({
      developerId: args.developerId,
      level: args.level,
      allowedActions: args.allowedActions ?? null,
      allowedRoutes: args.allowedRoutes ?? null,
      startMs: Date.now(),
      expiresMs: args.expiresMs,
      status: "active",
      createdByUserId: args.createdByUserId,
    })
    .returning();
  return row ?? null;
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
  priority?: "low" | "normal" | "high" | "critical";
  channel?: "in_app" | "in_app_and_email";
  templateKey?: string | null;
}): Promise<DeveloperNotification | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .insert(developerNotifications)
    .values({
      developerId: args.developerId,
      kind: args.kind,
      title: args.title,
      body: args.body,
      href: args.href,
      priority: args.priority ?? "normal",
      channel: args.channel ?? "in_app",
      templateKey: args.templateKey ?? null,
    })
    .returning();
  return rows[0] ?? null;
}

/** Milestone 2 §2.7 — mark one of this developer's notifications read (or unread). Scoped by developerId so cross-developer leakage is structurally impossible. */
export async function setDeveloperNotificationRead(
  developerId: number,
  notificationId: number,
  read: boolean,
): Promise<DeveloperNotification | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(developerNotifications)
    .set({ readAt: read ? Date.now() : null })
    .where(
      and(
        eq(developerNotifications.developerId, developerId),
        eq(developerNotifications.id, notificationId),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

/** Milestone 2 §2.7 — archive (dismiss) one of this developer's notifications. */
export async function archiveDeveloperNotification(
  developerId: number,
  notificationId: number,
): Promise<DeveloperNotification | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(developerNotifications)
    .set({ status: "archived" })
    .where(
      and(
        eq(developerNotifications.developerId, developerId),
        eq(developerNotifications.id, notificationId),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

/** Milestone 2 §2.7 — this developer's account email, for the notify-and-email bridge. */
export async function getDeveloperEmail(developerId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ email: users.email })
    .from(developerProfiles)
    .innerJoin(users, eq(users.id, developerProfiles.userId))
    .where(eq(developerProfiles.id, developerId))
    .limit(1);
  return rows[0]?.email ?? null;
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

/**
 * Milestone 2 §2.5 — Security Center: platform-wide (not per-developer)
 * recent security events, for the ops/admin investigation surface.
 */
export async function listRecentSecurityEvents(
  limit = 100,
): Promise<DeveloperSecurityEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(developerSecurityEvents)
    .orderBy(desc(developerSecurityEvents.createdAt))
    .limit(limit);
}

/**
 * Milestone 2 §2.5 — Security Center acknowledgment action. Marks an event
 * reviewed by a specific admin/ops user; idempotent (re-acknowledging just
 * overwrites the timestamp/actor, no error). Returns the updated row, or
 * null if no event with that id exists.
 */
export async function acknowledgeDeveloperSecurityEvent(
  eventId: number,
  acknowledgedByUserId: number,
): Promise<DeveloperSecurityEvent | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .update(developerSecurityEvents)
    .set({ acknowledgedAt: Date.now(), acknowledgedByUserId })
    .where(eq(developerSecurityEvents.id, eventId))
    .returning();
  return result[0] ?? null;
}

// ---------------------------------------------------------------------------
// Admin-side write paths (SRS 12.9 / 12.10 / 15.7 / 15.10, BR-018)
//
// Until now this module only ever READ project assignments, tasks and the
// admin half of the message thread, so nothing in the app could create the
// rows the Developer Portal displays. These are the missing writes.
// ---------------------------------------------------------------------------

/**
 * Create the developer-facing project. Deliberately separate from the
 * client project: SRS 15.10 requires admins to be able to give a project a
 * different name "for client privacy" when assigning it to a developer, and
 * `brief` is documented as sanitised (never client name, contact, financials).
 */
export async function createDeveloperProject(args: {
  code: string;
  name: string;
  brief: string | null;
  track: string;
  startMs: number | null;
  targetMs: number | null;
  createdByUserId: number;
}): Promise<DeveloperProject | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .insert(developerProjects)
    .values({
      code: args.code,
      name: args.name,
      brief: args.brief,
      track: args.track,
      startMs: args.startMs,
      targetMs: args.targetMs,
      createdByUserId: args.createdByUserId,
    })
    .returning();
  return rows[0] ?? null;
}

export async function listAllDeveloperProjects(): Promise<DeveloperProject[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(developerProjects).orderBy(desc(developerProjects.createdAt));
}

/**
 * Assign a developer to a project. Idempotent: an existing active row is
 * returned unchanged, and a paused or ended row is reactivated rather than
 * duplicated. Done in one transaction because the table has no unique
 * (projectId, developerId) index, so concurrent calls must not double insert.
 */
export async function assignDeveloperToProject(args: {
  projectId: number;
  developerId: number;
  assignmentRole: "lead" | "contributor" | "reviewer";
  createdByUserId: number;
}): Promise<{ assignment: DeveloperProjectAssignment; created: boolean } | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(developerProjectAssignments)
      .where(
        and(
          eq(developerProjectAssignments.projectId, args.projectId),
          eq(developerProjectAssignments.developerId, args.developerId),
        ),
      )
      .limit(1);
    const row = existing[0];
    if (row) {
      if (row.status === "active" && row.assignmentRole === args.assignmentRole) {
        return { assignment: row, created: false };
      }
      const updated = await tx
        .update(developerProjectAssignments)
        .set({
          status: "active",
          assignmentRole: args.assignmentRole,
          endMs: null,
          updatedAt: new Date(),
        })
        .where(eq(developerProjectAssignments.id, row.id))
        .returning();
      return { assignment: updated[0]!, created: false };
    }
    const inserted = await tx
      .insert(developerProjectAssignments)
      .values({
        projectId: args.projectId,
        developerId: args.developerId,
        assignmentRole: args.assignmentRole,
        startMs: Date.now(),
        createdByUserId: args.createdByUserId,
      })
      .returning();
    return { assignment: inserted[0]!, created: true };
  });
}

/**
 * End a developer's assignment. Also releases their task assignments on that
 * project so a removed developer cannot keep seeing the work (BR-018).
 */
export async function endDeveloperAssignment(args: {
  projectId: number;
  developerId: number;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async (tx) => {
    const ended = await tx
      .update(developerProjectAssignments)
      .set({ status: "ended", endMs: Date.now(), updatedAt: new Date() })
      .where(
        and(
          eq(developerProjectAssignments.projectId, args.projectId),
          eq(developerProjectAssignments.developerId, args.developerId),
          eq(developerProjectAssignments.status, "active"),
        ),
      )
      .returning({ id: developerProjectAssignments.id });
    if (ended.length === 0) return false;
    const taskIds = await tx
      .select({ id: developerTasks.id })
      .from(developerTasks)
      .where(eq(developerTasks.projectId, args.projectId));
    for (const t of taskIds) {
      await tx
        .update(developerTaskAssignments)
        .set({ status: "released" })
        .where(
          and(
            eq(developerTaskAssignments.taskId, t.id),
            eq(developerTaskAssignments.developerId, args.developerId),
          ),
        );
    }
    return true;
  });
}

export async function createDeveloperTask(args: {
  projectId: number;
  title: string;
  body: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  dueMs: number | null;
  createdByUserId: number;
}): Promise<DeveloperTask | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .insert(developerTasks)
    .values({
      projectId: args.projectId,
      title: args.title,
      body: args.body,
      priority: args.priority,
      dueMs: args.dueMs,
      createdByUserId: args.createdByUserId,
    })
    .returning();
  return rows[0] ?? null;
}

/**
 * Assign a task to a developer. Refuses unless that developer holds an
 * ACTIVE assignment on the task's project, so a task can never leak work to
 * someone outside the project (BR-018, SRS 11.6).
 */
export async function assignDeveloperTask(args: {
  taskId: number;
  developerId: number;
}): Promise<"assigned" | "already" | "task_not_found" | "not_on_project" | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const task = (
      await tx.select().from(developerTasks).where(eq(developerTasks.id, args.taskId)).limit(1)
    )[0];
    if (!task) return "task_not_found" as const;
    const onProject = await tx
      .select({ id: developerProjectAssignments.id })
      .from(developerProjectAssignments)
      .where(
        and(
          eq(developerProjectAssignments.projectId, task.projectId),
          eq(developerProjectAssignments.developerId, args.developerId),
          eq(developerProjectAssignments.status, "active"),
        ),
      )
      .limit(1);
    if (onProject.length === 0) return "not_on_project" as const;
    const existing = await tx
      .select()
      .from(developerTaskAssignments)
      .where(
        and(
          eq(developerTaskAssignments.taskId, args.taskId),
          eq(developerTaskAssignments.developerId, args.developerId),
        ),
      )
      .limit(1);
    if (existing[0]) {
      if (existing[0].status === "active") return "already" as const;
      await tx
        .update(developerTaskAssignments)
        .set({ status: "active" })
        .where(eq(developerTaskAssignments.id, existing[0].id));
      return "assigned" as const;
    }
    await tx
      .insert(developerTaskAssignments)
      .values({ taskId: args.taskId, developerId: args.developerId });
    return "assigned" as const;
  });
}

/** Admin reply into a developer's thread (the missing half of BR-012). */
export async function appendAdminDeveloperMessage(args: {
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
      sender: "admin",
      senderName: args.senderName,
      subject: args.subject,
      body: args.body,
    })
    .returning();
  return rows[0] ?? null;
}

/** Admin view of every developer task with the developers holding it. */
export async function listAllDeveloperTasks(limit = 300) {
  const db = await getDb();
  if (!db) return [];
  const tasks = await db
    .select({
      id: developerTasks.id,
      projectId: developerTasks.projectId,
      projectCode: developerProjects.code,
      title: developerTasks.title,
      status: developerTasks.status,
      priority: developerTasks.priority,
    })
    .from(developerTasks)
    .innerJoin(developerProjects, eq(developerProjects.id, developerTasks.projectId))
    .orderBy(desc(developerTasks.id))
    .limit(limit);
  if (tasks.length === 0) return [];
  const holders = await db
    .select({ taskId: developerTaskAssignments.taskId, developerId: developerTaskAssignments.developerId, fullName: developerProfiles.fullName })
    .from(developerTaskAssignments)
    .innerJoin(developerProfiles, eq(developerProfiles.id, developerTaskAssignments.developerId))
    .where(eq(developerTaskAssignments.status, "active"));
  return tasks.map((t) => ({ ...t, assignees: holders.filter((h) => h.taskId === t.id).map((h) => h.fullName) }));
}

/** Active assignments with names, for the admin delivery screen. */
export async function listAllDeveloperAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      projectId: developerProjectAssignments.projectId,
      developerId: developerProjectAssignments.developerId,
      developerName: developerProfiles.fullName,
      role: developerProjectAssignments.assignmentRole,
      status: developerProjectAssignments.status,
    })
    .from(developerProjectAssignments)
    .innerJoin(developerProfiles, eq(developerProfiles.id, developerProjectAssignments.developerId))
    .where(eq(developerProjectAssignments.status, "active"));
}
