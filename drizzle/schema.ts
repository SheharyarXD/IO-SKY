import {
  bigint,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** Bcrypt hash for local email+password login. Nullable: users may exist via OAuth only. */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Multi-tenant link — the organization this user belongs to (nullable for legacy/admin accounts). */
  organizationId: int("organizationId"),
  /** Phone for SMS MFA. Optional. */
  phone: varchar("phone", { length: 64 }),
  role: mysqlEnum("role", ["user", "client", "developer", "admin"]).default("user").notNull(),
  /** MFA enrolment status — "none" | "totp" | "email" | "sms". */
  mfaMethod: varchar("mfaMethod", { length: 32 }).default("none").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Strategy Call bookings made via /book-strategy.
 */
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),

  serviceId: varchar("serviceId", { length: 32 }).notNull(),
  slotStartMs: bigint("slotStartMs", { mode: "number" }).notNull(),
  durationMin: int("durationMin").notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull(),

  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 200 }),
  role: varchar("roleTitle", { length: 120 }),
  phone: varchar("phone", { length: 64 }),

  preparation: text("preparation"),
  note: text("note"),

  utmSource: varchar("utmSource", { length: 120 }),
  utmCampaign: varchar("utmCampaign", { length: 120 }),

  status: mysqlEnum("status", [
    "pending",
    "confirmed",
    "cancelled",
    "completed",
  ])
    .default("confirmed")
    .notNull(),

  emailSent: int("emailSent").default(0).notNull(),
  ownerNotified: int("ownerNotified").default(0).notNull(),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

/**
 * Audit log for booking lifecycle events.
 */
export const bookingAudit = mysqlTable("booking_audit", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  event: varchar("event", { length: 64 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookingAudit = typeof bookingAudit.$inferSelect;
export type InsertBookingAudit = typeof bookingAudit.$inferInsert;

/**
 * IO SKY CRM leads — single funnel that aggregates inbound interest from
 * every surface (Strategy Call booking, Contact form, AI Scan request,
 * Engineering Access application, future inbound channels).
 *
 * One row per (source + email + company) capture event. Same email may have
 * multiple leads if they re-engage through different surfaces — that's
 * intentional, the CRM merges them downstream.
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  /** Origin surface: booking | contact | ai-scan | eng-access | manual. */
  source: varchar("source", { length: 32 }).notNull(),
  /** Optional pointer to the originating row id (e.g. bookings.id). */
  sourceId: int("sourceId"),

  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 200 }),
  phone: varchar("phone", { length: 64 }),

  /** "discovery" | "growth" | "elite" for bookings, or free-form interest tag. */
  interest: varchar("interest", { length: 64 }),
  /** Free-form note (≤2000 chars). */
  note: text("note"),

  /** Lifecycle status — owned by the IO SKY operations team. */
  status: mysqlEnum("status", [
    "new",
    "qualified",
    "engaged",
    "won",
    "lost",
  ])
    .default("new")
    .notNull(),

  utmSource: varchar("utmSource", { length: 120 }),
  utmCampaign: varchar("utmCampaign", { length: 120 }),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Contact form submissions from /contact.
 */
export const contactSubmissions = mysqlTable("contact_submissions", {
  id: int("id").autoincrement().primaryKey(),
  publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),

  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  company: varchar("company", { length: 200 }),
  industry: varchar("industry", { length: 64 }),
  size: varchar("size", { length: 64 }),
  subject: varchar("subject", { length: 64 }).notNull(),
  message: text("message").notNull(),

  status: mysqlEnum("status", [
    "new",
    "responded",
    "closed",
    "spam",
  ])
    .default("new")
    .notNull(),

  emailSent: int("emailSent").default(0).notNull(),
  ownerNotified: int("ownerNotified").default(0).notNull(),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = typeof contactSubmissions.$inferInsert;

/**
 * Developer / engineering access applications from /engineering-access.
 * Gated by NDA + non-solicitation acknowledgement.
 */
export const devApplications = mysqlTable("dev_applications", {
  id: int("id").autoincrement().primaryKey(),
  publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),

  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  company: varchar("company", { length: 200 }),
  roleTitle: varchar("roleTitle", { length: 120 }),
  yearsExperience: int("yearsExperience"),

  /** GitHub / portfolio / LinkedIn URLs (concatenated, ≤2000 chars). */
  links: text("links"),
  /** Free-form short-form pitch. */
  message: text("message"),

  /** Compliance acknowledgements — all must be true to submit. */
  ackNda: int("ackNda").default(0).notNull(),
  ackConfidentiality: int("ackConfidentiality").default(0).notNull(),
  ackNonSolicitation: int("ackNonSolicitation").default(0).notNull(),

  status: mysqlEnum("status", [
    "pending",
    "in_review",
    "approved",
    "rejected",
  ])
    .default("pending")
    .notNull(),

  reviewerNote: text("reviewerNote"),

  ownerNotified: int("ownerNotified").default(0).notNull(),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DevApplication = typeof devApplications.$inferSelect;
export type InsertDevApplication = typeof devApplications.$inferInsert;

/**
 * Login attempts audit log — populated on every successful or failed
 * authentication so admins can see who logged in, when, and from where.
 */
export const loginAudit = mysqlTable("login_audit", {
  id: int("id").autoincrement().primaryKey(),
  /** Optional user id once the attempt resolved to an existing user. */
  userId: int("userId"),
  /** Email or open-id used in the attempt (best-effort). */
  identifier: varchar("identifier", { length: 320 }),
  /** "manus" | "google" | "microsoft" | "apple" | "magic-link". */
  provider: varchar("provider", { length: 32 }).notNull(),
  /** "success" | "failed" | "blocked" | "mfa_required". */
  outcome: varchar("outcome", { length: 32 }).notNull(),
  /** Optional human-readable reason for failed/blocked attempts. */
  reason: varchar("reason", { length: 200 }),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoginAudit = typeof loginAudit.$inferSelect;
export type InsertLoginAudit = typeof loginAudit.$inferInsert;


/* -----------------------------------------------------------------------
 * CLIENT PORTAL (multi-tenant, organization-scoped)
 * Every record below carries `organizationId`. The clientProcedure
 * middleware on the server side filters by ctx.user.organizationId before
 * any data is returned to the client.
 * ---------------------------------------------------------------------*/

/**
 * Organization (tenant) record. Each authenticated client user belongs to
 * exactly one organization via `users.organizationId` (added implicitly via
 * the role-based migration; existing users default to null until invited).
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  legalName: varchar("legalName", { length: 200 }),
  industry: varchar("industry", { length: 64 }),
  size: varchar("size", { length: 64 }),
  country: varchar("country", { length: 64 }),
  /** Operational health 0-100. Recalculated by AI Scan completions. */
  operationalScore: int("operationalScore").default(72).notNull(),
  /** Optional UI accent (kept restrained — Brand orange by default). */
  accentHex: varchar("accentHex", { length: 16 }),
  /** Cached "current operational status" string, e.g. "Healthy", "Watching". */
  statusLabel: varchar("statusLabel", { length: 64 }).default("Healthy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Organization memberships — join table for users <-> organizations.
 * (Kept as a separate table so a user can in future belong to multiple
 *  organizations; today there is at most one row per user.)
 */
export const organizationMemberships = mysqlTable("organization_memberships", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  /** "owner" | "member". Only used inside the client portal. */
  membershipRole: mysqlEnum("membershipRole", ["owner", "member"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type InsertOrganizationMembership = typeof organizationMemberships.$inferInsert;

/**
 * AI Scan reports produced for a client organization.
 */
export const clientReports = mysqlTable("client_reports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  scanType: varchar("scanType", { length: 32 }).default("ai-scan").notNull(),
  /** Operational score 0-100 at the time of this report. */
  score: int("score").notNull(),
  /** Delta vs the previous report (signed integer). */
  delta: int("delta").default(0).notNull(),
  /** Plain-text excerpt shown on dashboard cards. */
  summary: text("summary"),
  /** Signed URL key in object storage (we will resolve via storageGet). */
  pdfKey: varchar("pdfKey", { length: 512 }),
  /** "draft" | "ready" | "delivered". */
  status: mysqlEnum("status", ["draft", "ready", "delivered"]).default("ready").notNull(),
  pages: int("pages"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ClientReport = typeof clientReports.$inferSelect;
export type InsertClientReport = typeof clientReports.$inferInsert;

/**
 * AI Recommendations attached to an organization.
 */
export const clientRecommendations = mysqlTable("client_recommendations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  reportId: int("reportId"),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 96 }).notNull(),
  impact: mysqlEnum("impact", ["low", "medium", "high"]).default("medium").notNull(),
  /** "pending" | "in_progress" | "completed" | "dismissed". */
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "dismissed"]).default("pending").notNull(),
  body: text("body"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientRecommendation = typeof clientRecommendations.$inferSelect;
export type InsertClientRecommendation = typeof clientRecommendations.$inferInsert;

/**
 * Project (implementation) records.
 */
export const clientProjects = mysqlTable("client_projects", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  phase: varchar("phase", { length: 96 }).default("Discovery").notNull(),
  progress: int("progress").default(0).notNull(),
  startMs: bigint("startMs", { mode: "number" }),
  targetMs: bigint("targetMs", { mode: "number" }),
  status: mysqlEnum("status", ["planning", "active", "on_hold", "completed"]).default("active").notNull(),
  summary: text("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientProject = typeof clientProjects.$inferSelect;

/**
 * Project milestones.
 */
export const clientProjectMilestones = mysqlTable("client_project_milestones", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  dueMs: bigint("dueMs", { mode: "number" }),
  status: mysqlEnum("status", ["pending", "in_progress", "completed"]).default("pending").notNull(),
  body: text("body"),
});
export type ClientProjectMilestone = typeof clientProjectMilestones.$inferSelect;

/**
 * Invoice records for a client organization.
 */
export const clientInvoices = mysqlTable("client_invoices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  number: varchar("number", { length: 32 }).notNull().unique(),
  description: varchar("description", { length: 200 }).notNull(),
  amountCents: int("amountCents").notNull(),
  currency: varchar("currency", { length: 8 }).default("EUR").notNull(),
  status: mysqlEnum("status", ["draft", "open", "paid", "overdue", "void"]).default("open").notNull(),
  issuedMs: bigint("issuedMs", { mode: "number" }).notNull(),
  dueMs: bigint("dueMs", { mode: "number" }),
  paidMs: bigint("paidMs", { mode: "number" }),
  pdfKey: varchar("pdfKey", { length: 512 }),
});
export type ClientInvoice = typeof clientInvoices.$inferSelect;

/**
 * Secure documents library.
 */
export const clientDocuments = mysqlTable("client_documents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 96 }).default("general").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  sizeBytes: int("sizeBytes"),
  mimeType: varchar("mimeType", { length: 96 }),
  uploadedByUserId: int("uploadedByUserId"),
  uploadedBy: varchar("uploadedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientDocument = typeof clientDocuments.$inferSelect;

/**
 * Messages between IO SKY team and a client.
 */
export const clientMessages = mysqlTable("client_messages", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  threadKey: varchar("threadKey", { length: 64 }).notNull(),
  /** "io-sky" | "client". */
  sender: mysqlEnum("sender", ["io-sky", "client"]).notNull(),
  senderName: varchar("senderName", { length: 200 }),
  subject: varchar("subject", { length: 200 }),
  body: text("body").notNull(),
  readAt: bigint("readAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientMessage = typeof clientMessages.$inferSelect;

/**
 * Notifications shown in the portal bell + recent-activity feed.
 */
export const clientNotifications = mysqlTable("client_notifications", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  /** "report" | "booking" | "payment" | "document" | "message" | "security". */
  kind: varchar("kind", { length: 32 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  href: varchar("href", { length: 512 }),
  readAt: bigint("readAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientNotification = typeof clientNotifications.$inferSelect;

/**
 * Support tickets opened from the client portal.
 */
export const clientSupportTickets = mysqlTable("client_support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  openedByUserId: int("openedByUserId"),
  publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 64 }).default("general").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientSupportTicket = typeof clientSupportTickets.$inferSelect;


/* -----------------------------------------------------------------------
 * DEVELOPER WORKSPACE (assignment-scoped, role="developer" only)
 *
 * The Developer Workspace is a restricted engineering surface, completely
 * separate from the Client Portal. Every record below is keyed to a
 * `developer` user (`developerId`) and (where work is involved) a project
 * assignment (`assignmentId`).
 *
 * Engine: Drizzle / MySQL (TiDB) — chosen as the project's enterprise-grade
 * equivalent for the PostgreSQL recommendation in the master spec. Schema
 * is kept portable: no MySQL-specific functions used in column defaults.
 *
 * Visibility rules (enforced by the developerProcedure middleware on the
 * server side):
 *   1. The user must have role="developer".
 *   2. A developer_profiles row must exist for the user.
 *   3. The profile must reference a non-revoked, non-expired access scope.
 *   4. All required agreements (NDA, confidentiality, non-solicitation,
 *      liability, security policy) must be signed.
 *   5. MFA must be enrolled (mfaMethod !== "none").
 *
 * If any gate fails, the procedure returns the relevant gate error so the
 * UI can route the developer to the right setup page (MFA / Agreements /
 * Access Expired / No Assignments).
 *
 * Sub-tabs `commits` and `submissions` share the same table
 * (`developerSubmissions`) — a "commit-style" row carries `kind="commit"`
 * with a repository / sha / branch payload, while a regular submitted
 * deliverable carries `kind="submission"` with a fileKey.
 * ---------------------------------------------------------------------*/

/**
 * Developer profile — one row per user with role="developer". Captures
 * the structured information that the application form collects, plus the
 * fields admins toggle later (status, MFA requirement, primary admin
 * contact, etc.). Sensitive identifiers (full name, links) are stored
 * here, not on the public users table.
 */
export const developerProfiles = mysqlTable("developer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  /** Source application that produced this developer (FK to dev_applications.id, optional). */
  applicationId: int("applicationId"),
  fullName: varchar("fullName", { length: 200 }).notNull(),
  country: varchar("country", { length: 64 }),
  linkedin: varchar("linkedin", { length: 320 }),
  github: varchar("github", { length: 320 }),
  portfolio: varchar("portfolio", { length: 320 }),
  /** Comma-separated specialty tags (e.g. "ai,backend,enterprise-systems"). */
  specialties: varchar("specialties", { length: 320 }),
  yearsExperience: int("yearsExperience"),
  /** "available" | "limited" | "unavailable". Owned by the developer. */
  availability: mysqlEnum("availability", ["available", "limited", "unavailable"])
    .default("available")
    .notNull(),
  /** "active" | "suspended" | "terminated". Owned by the admin. */
  status: mysqlEnum("status", ["active", "suspended", "terminated"]).default("active").notNull(),
  /** Required-MFA flag (enforced by middleware once true). */
  mfaRequired: int("mfaRequired").default(1).notNull(),
  /** Date when admin approved this developer (ms since epoch). */
  approvedMs: bigint("approvedMs", { mode: "number" }),
  approvedByUserId: int("approvedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DeveloperProfile = typeof developerProfiles.$inferSelect;
export type InsertDeveloperProfile = typeof developerProfiles.$inferInsert;

/**
 * Per-developer access scope. Admins create one row per access window;
 * the most recent non-revoked row decides whether the developer can
 * see anything at all.
 */
export const developerAccessScopes = mysqlTable("developer_access_scopes", {
  id: int("id").autoincrement().primaryKey(),
  developerId: int("developerId").notNull(),
  /** "baseline" | "extended" | "elevated". Drives feature gates. */
  level: mysqlEnum("level", ["baseline", "extended", "elevated"]).default("baseline").notNull(),
  /** Comma-separated permission keys (e.g. "files:download,submissions:write"). */
  allowedActions: text("allowedActions"),
  /** Comma-separated sidebar route keys allowed (e.g. "overview,tasks,files"). */
  allowedRoutes: text("allowedRoutes"),
  startMs: bigint("startMs", { mode: "number" }).notNull(),
  expiresMs: bigint("expiresMs", { mode: "number" }),
  /** "active" | "expired" | "revoked". */
  status: mysqlEnum("status", ["active", "expired", "revoked"]).default("active").notNull(),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DeveloperAccessScope = typeof developerAccessScopes.$inferSelect;
export type InsertDeveloperAccessScope = typeof developerAccessScopes.$inferInsert;

/**
 * Legal agreements signed by the developer (NDA, confidentiality,
 * non-solicitation, liability, security-policy). One row per (developer,
 * agreementType, version) pair. The Agreements gate fails until at least
 * one row exists for every required type at the current required version.
 */
export const developerAgreements = mysqlTable("developer_agreements", {
  id: int("id").autoincrement().primaryKey(),
  developerId: int("developerId").notNull(),
  /** "nda" | "confidentiality" | "non-solicitation" | "liability" | "security-policy". */
  agreementType: varchar("agreementType", { length: 64 }).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  /** "draft" | "pending" | "signed". */
  status: mysqlEnum("status", ["draft", "pending", "signed"]).default("pending").notNull(),
  signedMs: bigint("signedMs", { mode: "number" }),
  signedIp: varchar("signedIp", { length: 64 }),
  signedUserAgent: text("signedUserAgent"),
  documentKey: varchar("documentKey", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperAgreement = typeof developerAgreements.$inferSelect;
export type InsertDeveloperAgreement = typeof developerAgreements.$inferInsert;

/**
 * Project (engineering work) records visible to developers ONLY through
 * an explicit assignment. Unlike `clientProjects`, this row carries no
 * client identifying information — only the engineering brief.
 */
export const developerProjects = mysqlTable("developer_projects", {
  id: int("id").autoincrement().primaryKey(),
  /** Internal project code (e.g. "PRJ-AI-WORKFLOW"). Always shown to the developer. */
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  /** Sanitized brief — never includes client name, contact, financials. */
  brief: text("brief"),
  /** "backend" | "frontend" | "full-stack" | "ai" | "infra" | "research". */
  track: varchar("track", { length: 64 }).default("full-stack").notNull(),
  /** "planning" | "active" | "on_hold" | "completed". */
  status: mysqlEnum("status", ["planning", "active", "on_hold", "completed"])
    .default("active")
    .notNull(),
  startMs: bigint("startMs", { mode: "number" }),
  targetMs: bigint("targetMs", { mode: "number" }),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DeveloperProject = typeof developerProjects.$inferSelect;
export type InsertDeveloperProject = typeof developerProjects.$inferInsert;

/**
 * Project ↔ developer assignment join table. Without an active assignment
 * row, a developer cannot see the project, its tasks, files, or commits.
 */
export const developerProjectAssignments = mysqlTable(
  "developer_project_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    developerId: int("developerId").notNull(),
    /** "lead" | "contributor" | "reviewer". */
    assignmentRole: mysqlEnum("assignmentRole", ["lead", "contributor", "reviewer"])
      .default("contributor")
      .notNull(),
    /** "active" | "paused" | "ended". */
    status: mysqlEnum("status", ["active", "paused", "ended"]).default("active").notNull(),
    progress: int("progress").default(0).notNull(),
    startMs: bigint("startMs", { mode: "number" }),
    endMs: bigint("endMs", { mode: "number" }),
    createdByUserId: int("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
);
export type DeveloperProjectAssignment = typeof developerProjectAssignments.$inferSelect;
export type InsertDeveloperProjectAssignment = typeof developerProjectAssignments.$inferInsert;

/**
 * Tasks belonging to a project. Visible to a developer only via
 * `developerTaskAssignments`. We keep tasks separate from
 * `clientProjectMilestones` because tasks are engineering-internal and
 * may include implementation notes that clients should never see.
 */
export const developerTasks = mysqlTable("developer_tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  /** "planned" | "in_progress" | "blocked" | "in_review" | "done". */
  status: mysqlEnum("status", ["planned", "in_progress", "blocked", "in_review", "done"])
    .default("planned")
    .notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"])
    .default("normal")
    .notNull(),
  dueMs: bigint("dueMs", { mode: "number" }),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DeveloperTask = typeof developerTasks.$inferSelect;
export type InsertDeveloperTask = typeof developerTasks.$inferInsert;

/**
 * Task ↔ developer assignment.
 */
export const developerTaskAssignments = mysqlTable("developer_task_assignments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  developerId: int("developerId").notNull(),
  status: mysqlEnum("status", ["active", "released"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperTaskAssignment = typeof developerTaskAssignments.$inferSelect;

/**
 * Approved files for a project. Only files explicitly admin-approved as
 * "developer-readable" appear here; client-only and admin-only files live
 * in different storage prefixes (see master spec section 13).
 */
export const developerProjectFiles = mysqlTable("developer_project_files", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  /** Storage key under the developer-approved prefix. Never expose raw bucket URLs. */
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  sizeBytes: int("sizeBytes"),
  mimeType: varchar("mimeType", { length: 96 }),
  category: varchar("category", { length: 64 }).default("specification").notNull(),
  uploadedByUserId: int("uploadedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperProjectFile = typeof developerProjectFiles.$inferSelect;

/**
 * Submissions / commits the developer reports back. Same table covers
 * the Submissions tab and the Commits tab (master spec lists
 * `/developer-workspace/commits` but the sidebar locks 11 items so
 * commits live as a sub-tab inside Submissions).
 */
export const developerSubmissions = mysqlTable("developer_submissions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  developerId: int("developerId").notNull(),
  /** "submission" | "commit". */
  kind: mysqlEnum("kind", ["submission", "commit"]).default("submission").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  /** Only present for kind="submission". */
  fileKey: varchar("fileKey", { length: 512 }),
  /** Only present for kind="commit". */
  repository: varchar("repository", { length: 320 }),
  sha: varchar("sha", { length: 64 }),
  branch: varchar("branch", { length: 200 }),
  /** "pending" | "in_review" | "accepted" | "changes_requested" | "rejected". */
  status: mysqlEnum("status", [
    "pending",
    "in_review",
    "accepted",
    "changes_requested",
    "rejected",
  ])
    .default("pending")
    .notNull(),
  reviewerNote: text("reviewerNote"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedMs: bigint("reviewedMs", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperSubmission = typeof developerSubmissions.$inferSelect;
export type InsertDeveloperSubmission = typeof developerSubmissions.$inferInsert;

/**
 * Messages between admin and developer. Developers may only thread with
 * IO SKY admin — never with clients or with other developers (master
 * spec section 7).
 */
export const developerMessages = mysqlTable("developer_messages", {
  id: int("id").autoincrement().primaryKey(),
  developerId: int("developerId").notNull(),
  /** "admin" | "developer". */
  sender: mysqlEnum("sender", ["admin", "developer"]).notNull(),
  senderName: varchar("senderName", { length: 200 }),
  subject: varchar("subject", { length: 200 }),
  body: text("body").notNull(),
  readAt: bigint("readAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperMessage = typeof developerMessages.$inferSelect;
export type InsertDeveloperMessage = typeof developerMessages.$inferInsert;

/**
 * Access-extension requests raised by a developer when their access
 * scope is about to expire.
 */
export const developerAccessRequests = mysqlTable("developer_access_requests", {
  id: int("id").autoincrement().primaryKey(),
  developerId: int("developerId").notNull(),
  scopeId: int("scopeId"),
  reason: text("reason").notNull(),
  /** "pending" | "approved" | "denied". */
  status: mysqlEnum("status", ["pending", "approved", "denied"]).default("pending").notNull(),
  reviewerNote: text("reviewerNote"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedMs: bigint("reviewedMs", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperAccessRequest = typeof developerAccessRequests.$inferSelect;

/**
 * Generic developer audit log — every gate check, file download, status
 * change, message send, etc. lands here for the admin's security view.
 */
export const developerAudit = mysqlTable("developer_audit", {
  id: int("id").autoincrement().primaryKey(),
  developerId: int("developerId"),
  /** Action key (e.g. "gate.passed", "file.downloaded", "submission.created"). */
  event: varchar("event", { length: 96 }).notNull(),
  detail: text("detail"),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperAudit = typeof developerAudit.$inferSelect;
export type InsertDeveloperAudit = typeof developerAudit.$inferInsert;

/**
 * Security events specific to the developer workspace (failed logins,
 * country-of-origin changes, unauthorized-route attempts, download
 * spikes, role-escalation attempts, …). Stored separately so admins can
 * triage them without sifting through the general audit log.
 */
export const developerSecurityEvents = mysqlTable("developer_security_events", {
  id: int("id").autoincrement().primaryKey(),
  developerId: int("developerId"),
  /** "failed_login" | "unauthorized_route" | "download_spike" | "ip_change" | "role_escalation" | "expired_access" | "abnormal_api". */
  kind: varchar("kind", { length: 64 }).notNull(),
  severity: mysqlEnum("severity", ["info", "warn", "high", "critical"]).default("warn").notNull(),
  message: varchar("message", { length: 200 }).notNull(),
  detail: text("detail"),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
  acknowledgedAt: bigint("acknowledgedAt", { mode: "number" }),
  acknowledgedByUserId: int("acknowledgedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperSecurityEvent = typeof developerSecurityEvents.$inferSelect;

/**
 * Support tickets opened by a developer to IO SKY admin (technical or
 * access-related). Distinct from `clientSupportTickets` to keep
 * developer-only signal separated.
 */
export const developerSupportTickets = mysqlTable("developer_support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  developerId: int("developerId").notNull(),
  publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 64 }).default("general").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperSupportTicket = typeof developerSupportTickets.$inferSelect;

/**
 * Developer-side notifications (the workspace bell). Mirrors the client
 * notifications table but scoped to a single developer so we never leak
 * cross-developer signal.
 */
export const developerNotifications = mysqlTable("developer_notifications", {
  id: int("id").autoincrement().primaryKey(),
  developerId: int("developerId").notNull(),
  /** "assignment" | "task" | "message" | "review" | "agreement" | "access" | "security". */
  kind: varchar("kind", { length: 32 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  href: varchar("href", { length: 512 }),
  readAt: bigint("readAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeveloperNotification = typeof developerNotifications.$inferSelect;

// ---------------------------------------------------------------------------
// MFA — full track (TOTP + SMS + recovery codes + verification challenges)
// ---------------------------------------------------------------------------

/**
 * A registered second-factor for a user. A user may have multiple factors
 * (e.g. one TOTP authenticator + one SMS number) but only one of each kind.
 *
 *  - `kind`     "totp" | "sms".
 *  - `label`    Friendly name (e.g. "iPhone" or "+31•••••12").
 *  - `secret`   AES-GCM-encrypted ciphertext envelope. For TOTP this is the
 *               base32 shared secret; for SMS this is the salted SHA-256
 *               hash of the phone number (the plaintext is never stored).
 *  - `phoneHint`   Last-4 of the phone number, plaintext, for UI display.
 *  - `verifiedAt`  Set when the user proves possession with a valid code.
 *  - `primary`     1 means this is the user's default factor.
 */
export const mfaFactors = mysqlTable("mfa_factors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  kind: mysqlEnum("kind", ["totp", "sms"]).notNull(),
  label: varchar("label", { length: 120 }),
  /** Encrypted secret envelope (iv:tag:ciphertext, all base64). */
  secret: text("secret").notNull(),
  /** Public display hint, e.g. "•••• 1234" or the authenticator app name. */
  phoneHint: varchar("phoneHint", { length: 32 }),
  verifiedAt: timestamp("verifiedAt"),
  primary: int("primary").default(0).notNull(),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntilMs: bigint("lockedUntilMs", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
});
export type MfaFactor = typeof mfaFactors.$inferSelect;
export type InsertMfaFactor = typeof mfaFactors.$inferInsert;

/**
 * One-shot recovery codes. Hashed at rest (argon2id-style envelope, stored
 * as base64 of scrypt-derived hash). Marked usedAt once consumed.
 */
export const mfaRecoveryCodes = mysqlTable("mfa_recovery_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  codeHash: varchar("codeHash", { length: 128 }).notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MfaRecoveryCode = typeof mfaRecoveryCodes.$inferSelect;

/**
 * Pending MFA verification challenges minted at the end of the OAuth
 * callback. The user must POST a valid code (or recovery code) within
 * the expiry to swap the `mfa_pending` cookie for a real session cookie.
 *
 *  - `state`        URL-safe token stored both server-side and in the
 *                   short-lived cookie.
 *  - `purpose`      "login" | "enroll" | "step_up".
 *  - `expectedKind` "totp" | "sms" | "any".
 *  - `failedAttempts` per-challenge throttle separate from the per-factor
 *                   lockout to make brute-force more expensive.
 *  - `consumedAt`   Set when the challenge is satisfied; from this point
 *                   the row is dead and must not be reused.
 */
export const mfaChallenges = mysqlTable("mfa_challenges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  state: varchar("state", { length: 96 }).notNull().unique(),
  purpose: mysqlEnum("purpose", ["login", "enroll", "step_up"]).default("login").notNull(),
  expectedKind: mysqlEnum("expectedKind", ["totp", "sms", "any"]).default("any").notNull(),
  factorId: int("factorId"),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MfaChallenge = typeof mfaChallenges.$inferSelect;
export type InsertMfaChallenge = typeof mfaChallenges.$inferInsert;


// ---------------------------------------------------------------------------
// Native IO SKY Booking System
// ---------------------------------------------------------------------------
// Self-hosted booking infrastructure. The adapter pattern (server/_core/booking)
// lets us later plug Google Calendar / Microsoft Calendar / Cal.com without
// changing the public booking UX. The NativeBookingAdapter is the source of
// truth for availability + slot allocation today.

export const adminAvailability = mysqlTable("admin_availability", {
  id: int("id").autoincrement().primaryKey(),
  consultationType: varchar("consultationType", { length: 32 }).notNull(),
  /** 0=Sunday ... 6=Saturday (JS Date.getDay convention). */
  weekday: int("weekday").notNull(),
  startMinute: int("startMinute").notNull(),
  endMinute: int("endMinute").notNull(),
  /** IANA timezone the window is expressed in. */
  timezone: varchar("timezone", { length: 64 }).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AdminAvailabilityRow = typeof adminAvailability.$inferSelect;
export type InsertAdminAvailability = typeof adminAvailability.$inferInsert;

export const availabilityWindows = mysqlTable("availability_windows", {
  id: int("id").autoincrement().primaryKey(),
  consultationType: varchar("consultationType", { length: 32 }),
  kind: mysqlEnum("kind", ["open", "close"]).notNull(),
  startMs: bigint("startMs", { mode: "number" }).notNull(),
  endMs: bigint("endMs", { mode: "number" }).notNull(),
  reason: varchar("reason", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AvailabilityWindow = typeof availabilityWindows.$inferSelect;
export type InsertAvailabilityWindow = typeof availabilityWindows.$inferInsert;

export const calendarBlocks = mysqlTable("calendar_blocks", {
  id: int("id").autoincrement().primaryKey(),
  startMs: bigint("startMs", { mode: "number" }).notNull(),
  endMs: bigint("endMs", { mode: "number" }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CalendarBlock = typeof calendarBlocks.$inferSelect;
export type InsertCalendarBlock = typeof calendarBlocks.$inferInsert;

export const bookingSlots = mysqlTable("booking_slots", {
  id: int("id").autoincrement().primaryKey(),
  consultationType: varchar("consultationType", { length: 32 }).notNull(),
  slotStartMs: bigint("slotStartMs", { mode: "number" }).notNull(),
  slotEndMs: bigint("slotEndMs", { mode: "number" }).notNull(),
  status: mysqlEnum("status", ["held", "booked", "cancelled"]).default("held").notNull(),
  bookingId: int("bookingId"),
  holdToken: varchar("holdToken", { length: 64 }),
  holdExpiresAtMs: bigint("holdExpiresAtMs", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BookingSlot = typeof bookingSlots.$inferSelect;
export type InsertBookingSlot = typeof bookingSlots.$inferInsert;

export const bookingAnswers = mysqlTable("booking_answers", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  question: varchar("question", { length: 200 }).notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BookingAnswer = typeof bookingAnswers.$inferSelect;
export type InsertBookingAnswer = typeof bookingAnswers.$inferInsert;

export const bookingReminders = mysqlTable("booking_reminders", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  kind: mysqlEnum("kind", [
    "confirmation",
    "reminder_24h",
    "reminder_1h",
    "reschedule",
    "cancellation",
  ]).notNull(),
  scheduledForMs: bigint("scheduledForMs", { mode: "number" }).notNull(),
  sentAt: timestamp("sentAt"),
  errorDetail: text("errorDetail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BookingReminder = typeof bookingReminders.$inferSelect;
export type InsertBookingReminder = typeof bookingReminders.$inferInsert;

export const bookingEvents = mysqlTable("booking_events", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  event: varchar("event", { length: 64 }).notNull(),
  actorOpenId: varchar("actorOpenId", { length: 128 }),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BookingEvent = typeof bookingEvents.$inferSelect;
export type InsertBookingEvent = typeof bookingEvents.$inferInsert;

export const timezonePreferences = mysqlTable("timezone_preferences", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TimezonePreference = typeof timezonePreferences.$inferSelect;
export type InsertTimezonePreference = typeof timezonePreferences.$inferInsert;

/* ----------------------------------------------------------------------
 * Package 7 — Solutions Ecosystem
 *
 * Persistent tables backing the IO SKY ecosystem conversion funnel:
 *   • ecosystem_click_events       — every CTA tap on /solutions
 *   • ecosystem_proposal_requests  — branded proposal requests
 *   • custom_discovery_sessions    — multi-step Custom Intelligence intake
 * ---------------------------------------------------------------------- */

export const ecosystemClickEvents = mysqlTable("ecosystem_click_events", {
  id: int("id").autoincrement().primaryKey(),
  eventKey: varchar("eventKey", { length: 80 }).notNull(),
  source: varchar("source", { length: 64 }).notNull().default("solutions"),
  ecosystem: varchar("ecosystem", { length: 32 }),
  sessionToken: varchar("sessionToken", { length: 64 }),
  userId: int("userId"),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
  payload: text("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EcosystemClickEvent = typeof ecosystemClickEvents.$inferSelect;
export type InsertEcosystemClickEvent = typeof ecosystemClickEvents.$inferInsert;

export const ecosystemProposalRequests = mysqlTable(
  "ecosystem_proposal_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    ecosystem: mysqlEnum("ecosystem", ["growth", "elite", "custom"]).notNull(),
    fullName: varchar("fullName", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    company: varchar("company", { length: 200 }),
    phone: varchar("phone", { length: 64 }),
    message: text("message"),
    goals: text("goals"),
    source: varchar("source", { length: 64 }).notNull().default("solutions"),
    status: mysqlEnum("status", [
      "new",
      "qualified",
      "in_review",
      "sent",
      "won",
      "lost",
    ])
      .default("new")
      .notNull(),
    leadId: int("leadId"),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
);
export type EcosystemProposalRequest = typeof ecosystemProposalRequests.$inferSelect;
export type InsertEcosystemProposalRequest = typeof ecosystemProposalRequests.$inferInsert;

export const customDiscoverySessions = mysqlTable("custom_discovery_sessions", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  fullName: varchar("fullName", { length: 200 }),
  email: varchar("email", { length: 320 }),
  company: varchar("company", { length: 200 }),
  phone: varchar("phone", { length: 64 }),
  needsTypes: text("needsTypes"),
  currentSystems: text("currentSystems"),
  teamSize: varchar("teamSize", { length: 32 }),
  growthStage: varchar("growthStage", { length: 32 }),
  complianceTags: text("complianceTags"),
  integrations: text("integrations"),
  timeline: varchar("timeline", { length: 32 }),
  urgency: varchar("urgency", { length: 32 }),
  preferredNext: mysqlEnum("preferredNext", [
    "ai-scan",
    "strategy-call",
    "proposal",
  ]),
  status: mysqlEnum("status", ["in_progress", "submitted", "abandoned"])
    .default("in_progress")
    .notNull(),
  leadId: int("leadId"),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  submittedAt: timestamp("submittedAt"),
});
export type CustomDiscoverySession = typeof customDiscoverySessions.$inferSelect;
export type InsertCustomDiscoverySession = typeof customDiscoverySessions.$inferInsert;

/* ─────────────────────────────────────────────────────────────────────────────
 *  LEGAL, COMPLIANCE & CONSENT INFRASTRUCTURE
 *  Master Prompt v1 — Privacy / ToS / Cookies / AI Disclaimer / Developer
 *  Agreement (NDA + Access) / DPA scaffold + audit trail.
 *
 *  Versioning model: every legal text is a row in `legal_documents`.
 *  Each publication of that text is a row in `agreement_versions`. Acceptance
 *  rows in `agreement_acceptances` reference an `agreement_versions.id` so we
 *  always know exactly which body of text the user consented to.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Catalogue of legal documents in the system. One row per kind.
 * Examples: privacy-policy, terms-of-service, cookie-policy, ai-disclaimer,
 *           developer-agreement, nda, access-agreement, dpa.
 *
 * The `slug` is the URL-friendly identifier used in routes (`/legal/<slug>`).
 */
export const legalDocuments = mysqlTable("legal_documents", {
  id: int("id").autoincrement().primaryKey(),
  /** Stable machine identifier. */
  kind: varchar("kind", { length: 64 }).notNull().unique(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  /** Human-facing title used in headers and acceptance prompts. */
  title: varchar("title", { length: 200 }).notNull(),
  /** Optional jurisdiction tag, e.g. "EU", "NL", "US". */
  jurisdiction: varchar("jurisdiction", { length: 32 }),
  /** Default language of the canonical version (locale code, e.g. "en"). */
  defaultLanguage: varchar("defaultLanguage", { length: 8 }).default("en").notNull(),
  /** Whether this document is active and shown to users. */
  status: mysqlEnum("status", ["active", "draft", "retired"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type InsertLegalDocument = typeof legalDocuments.$inferInsert;

/**
 * One row per published version of a legal document. The body is markdown
 * with optional placeholders. `bodyHash` is sha-256 of the body so that we
 * can detect tampering (immutable history) and so audit rows can refer to a
 * stable hash.
 */
export const agreementVersions = mysqlTable("agreement_versions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  /** Semver-ish or simple incremental version, e.g. "1.0", "1.1", "2.0". */
  version: varchar("version", { length: 32 }).notNull(),
  /** Locale this body is authored in. */
  language: varchar("language", { length: 8 }).default("en").notNull(),
  /** Markdown body. */
  bodyMd: text("bodyMd").notNull(),
  /** SHA-256 hex of bodyMd at publish time. */
  bodyHash: varchar("bodyHash", { length: 128 }).notNull(),
  /** When this version becomes the live one. */
  effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
  /** Lifecycle: draft → published → superseded. */
  status: mysqlEnum("status", ["draft", "published", "superseded"]).default("published").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
});
export type AgreementVersion = typeof agreementVersions.$inferSelect;
export type InsertAgreementVersion = typeof agreementVersions.$inferInsert;

/**
 * Each time a user accepts (or re-accepts) a specific version of a document
 * we record it here. This is the source of truth for "did this user agree
 * to the current Terms?".
 *
 * `method` records how the acceptance happened: signup, login-revalidation,
 * checkout, ai-scan, proposal, etc.
 */
export const agreementAcceptances = mysqlTable("agreement_acceptances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId"),
  versionId: int("versionId").notNull(),
  /** The kind of document accepted, denormalized for quick filtering. */
  documentKind: varchar("documentKind", { length: 64 }).notNull(),
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
  /** signup | login-revalidation | ai-scan | booking | proposal | dev-onboarding | manual */
  method: varchar("method", { length: 64 }).notNull(),
});
export type AgreementAcceptance = typeof agreementAcceptances.$inferSelect;
export type InsertAgreementAcceptance = typeof agreementAcceptances.$inferInsert;

/**
 * Cookie consent records. One row per (subjectKey, version). The subjectKey
 * is either the userId (when authenticated) or an anonymous device id stored
 * in a long-lived cookie (`io_sky_consent_id`).
 *
 * Categories are stored as a JSON-encoded object, e.g.
 *   {"functional": true, "analytics": true, "marketing": false}.
 */
export const cookieConsents = mysqlTable("cookie_consents", {
  id: int("id").autoincrement().primaryKey(),
  /** "user:<id>" for known users, "anon:<uuid>" for visitors. */
  subjectKey: varchar("subjectKey", { length: 96 }).notNull(),
  userId: int("userId"),
  /** Reference to the cookie-policy version that was current at consent time. */
  policyVersionId: int("policyVersionId"),
  /** JSON: { functional: bool, analytics: bool, marketing: bool, ... } */
  categoriesJson: text("categoriesJson").notNull(),
  /** "accepted-all" | "rejected-all" | "custom" */
  decision: varchar("decision", { length: 32 }).notNull(),
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
});
export type CookieConsent = typeof cookieConsents.$inferSelect;
export type InsertCookieConsent = typeof cookieConsents.$inferInsert;

/**
 * Acknowledgements that are weaker than full acceptance (e.g. a banner the
 * user dismissed, or an in-product disclaimer the user clicked through).
 * Useful for AI disclaimers shown contextually.
 */
export const legalAcknowledgements = mysqlTable("legal_acknowledgements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  documentKind: varchar("documentKind", { length: 64 }).notNull(),
  versionId: int("versionId"),
  context: varchar("context", { length: 96 }).notNull(),
  acknowledgedAt: timestamp("acknowledgedAt").defaultNow().notNull(),
  ip: varchar("ip", { length: 64 }),
});
export type LegalAcknowledgement = typeof legalAcknowledgements.$inferSelect;
export type InsertLegalAcknowledgement = typeof legalAcknowledgements.$inferInsert;


/**
 * AI Scan completed scans — questionnaire responses + LLM-generated executive
 * report. The report payload conforms to AiScanReportPayload from
 * shared/aiScanModel.ts and is stored as JSON-serialized text for portability
 * across MySQL versions.
 *
 * Lifecycle:
 *   pending  → questionnaire submitted, scoring engine queued
 *   scoring  → LLM call in flight
 *   ready    → report payload ready, available to lead
 *   failed   → scoring engine failed, payload null, errorMessage set
 *
 * The lead is linked via leadId (nullable for anonymous flow); the public-
 * facing reportToken is the unguessable URL slug used by /ai-scan/result/:token.
 */
export const aiScans = mysqlTable("ai_scans", {
  id: int("id").autoincrement().primaryKey(),
  /** Unguessable token used in public report URLs. ~32 hex chars. */
  reportToken: varchar("reportToken", { length: 64 }).notNull().unique(),

  /** Tier requested at submission. */
  tier: mysqlEnum("tier", ["free", "growth", "elite"]).notNull(),

  /** Optional CRM lead link (created at submission for non-anonymous flow). */
  leadId: int("leadId"),

  /** Identity captured by intake form (mirror of leads for direct lookups). */
  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 200 }),

  /** Locale used at intake (so report renders in same language). */
  locale: varchar("locale", { length: 8 }).default("en").notNull(),

  /** Questionnaire responses — JSON-serialized AiScanResponses. */
  responses: text("responses").notNull(),

  /** Engine status. */
  status: mysqlEnum("status", ["pending", "scoring", "ready", "failed"])
    .default("pending")
    .notNull(),

  /** Executive report payload — JSON-serialized AiScanReportPayload. Null until ready. */
  reportPayload: text("reportPayload"),

  /** Overall score, denormalized for fast indexing/sorting. */
  overallScore: int("overallScore"),

  /** Storage key for the cached executive PDF (generated on first download). */
  reportPdfKey: varchar("reportPdfKey", { length: 256 }),

  /** Engine error message if status=failed. */
  errorMessage: text("errorMessage"),

  utmSource: varchar("utmSource", { length: 120 }),
  utmCampaign: varchar("utmCampaign", { length: 120 }),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  scoredAt: timestamp("scoredAt"),
});

export type AiScan = typeof aiScans.$inferSelect;
export type InsertAiScan = typeof aiScans.$inferInsert;
