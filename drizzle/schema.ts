import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * IO SKY schema — Supabase PostgreSQL dialect (Milestone 1, RM-43/44/45).
 *
 * Migrated 1:1 from the original MySQL/TiDB schema (see git history for the
 * pre-migration version, and drizzle/_archive_mysql_migrations/ for the old
 * migration history). Translation notes, applying uniformly across every
 * table below:
 *
 *   - mysqlTable(...)              -> pgTable(...)
 *   - int("id").autoincrement()    -> serial("id")           (identical semantics)
 *   - int(col)                     -> integer(col)            (plain, non-PK integer columns)
 *   - varchar(col, {length: N})    -> unchanged (pg-core supports the same API)
 *   - text(col)                    -> unchanged
 *   - bigint(col, {mode:"number"}) -> unchanged (pg-core supports the same API)
 *   - timestamp(col).defaultNow()  -> unchanged
 *   - mysqlEnum(col, [...])        -> a named pgEnum(...) hoisted above the table
 *                                     that uses it. Every enum below keeps its
 *                                     table's exact original value set and name
 *                                     — deliberately NOT consolidated across
 *                                     tables even where two tables happen to
 *                                     share an identical value set, to avoid
 *                                     any risk of accidentally merging two
 *                                     enums that looked similar but weren't
 *                                     guaranteed identical. That consolidation
 *                                     is a valid future code-quality
 *                                     improvement, not part of this migration.
 *   - .onUpdateNow()                -> dropped from the column definition (no
 *                                     Postgres/Drizzle equivalent) and replaced
 *                                     by a `set_updated_at()` BEFORE UPDATE
 *                                     trigger, applied per-table in
 *                                     drizzle/0002_updated_at_triggers.sql —
 *                                     preserves the original auto-update-on-
 *                                     modify behavior rather than dropping it.
 *
 * NEW in this migration (none of this existed in the original MySQL schema —
 * added per the forensic audit's RM-44/45 recommendation, based strictly on
 * the relationships already implied by existing application code, not
 * invented):
 *
 *   - Foreign keys on every FK-shaped column identified by reading the
 *     server/db/*.ts and server/routers/*.ts join/filter patterns.
 *   - ON DELETE policy, applied by category (documented at each table, not
 *     repeated per-column):
 *       * "cascade"   — true parent-child ownership rows with no independent
 *                        meaning without their parent (e.g. a booking's slots/
 *                        answers/reminders/events, a project's milestones/
 *                        tasks/assignments, a document's agreement versions,
 *                        a developer profile's scopes/agreements).
 *       * (omitted, Postgres default "no action") — actor/reference columns
 *         (uploadedByUserId, createdByUserId, reviewedByUserId, and similar
 *         "who did this" pointers) and anything audit/compliance/financial
 *         (login_audit, developer_audit, developer_security_events,
 *         agreement_acceptances, cookie_consents, client_invoices). Deleting
 *         a user or org must not silently cascade away a financial or
 *         compliance record — that needs an explicit, deliberate decision
 *         the application layer makes, not a schema-level default. Flagged
 *         inline as ⚠ REQUIRES VERIFICATION wherever the "right" policy is
 *         a genuine business decision rather than a structural fact.
 *   - One index per foreign key column (Postgres does not auto-index FK
 *     columns, unlike some other engines — every one of these was previously
 *     a full table scan per the forensic audit) plus a handful of extra
 *     indexes on high-traffic `status` columns called out in that audit.
 *   - `leads.sourceId` is deliberately left WITHOUT a foreign key — per its
 *     own doc comment it's a polymorphic pointer ("e.g. bookings.id") that
 *     can reference different tables depending on `source`. A real FK can't
 *     express that without inventing a new discriminated-union modeling
 *     approach, which is out of scope for a structural migration.
 */

// ---------------------------------------------------------------------------
// Core / Auth
// ---------------------------------------------------------------------------

/**
 * RM-57 (resolved): "super_admin" is a 5th tier, a strict superset of
 * "admin" — every super_admin capability is admin-plus, never
 * admin-minus. Assignable (any existing admin can be promoted by an
 * existing super_admin), not a single hardcoded owner. See
 * `drizzle/0006_super_admin_role.sql` for the RLS-layer equivalent
 * (`app_is_admin()` now also returns true for super_admin) and
 * `server/_core/trpc.ts`'s `isAdminRole()`/`superAdminProcedure` for the
 * application-layer equivalent.
 */
export const usersRoleEnum = pgEnum("users_role", ["user", "client", "developer", "admin", "super_admin"]);

/**
 * Core user table backing auth flow.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    /**
     * RM-49/RM-50: link to Supabase Auth's auth.users.id. Nullable because
     * existing rows predate the Supabase Auth migration (they're still
     * identified only by `openId`, the Manus-issued identity) — populated
     * per-user as each account is migrated over during RM-50..54. Once that
     * migration is complete this becomes the join key every RLS policy in
     * this file relies on (see the RLS policy migration for how). The
     * actual foreign key to auth.users(id) is added via raw SQL in the RLS
     * migration, not here — Drizzle's schema DSL only models tables in this
     * file's own `public` schema, not Supabase's separate `auth` schema.
     */
    authUserId: uuid("authUserId").unique(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    /** Bcrypt hash for local email+password login. Nullable: users may exist via OAuth only. */
    passwordHash: varchar("passwordHash", { length: 255 }),
    /** Multi-tenant link — the organization this user belongs to (nullable for legacy/admin accounts). */
    organizationId: integer("organizationId").references((): typeof organizations.id => organizations.id),
    /** Phone for SMS MFA. Optional. */
    phone: varchar("phone", { length: 64 }),
    role: usersRoleEnum("role").default("user").notNull(),
    /** MFA enrolment status — "none" | "totp" | "email" | "sms". */
    mfaMethod: varchar("mfaMethod", { length: 32 }).default("none").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => [index("users_organization_id_idx").on(table.organizationId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Strategy Call bookings made via /book-strategy.
 */
export const bookingsStatusEnum = pgEnum("bookings_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),

    serviceId: varchar("serviceId", { length: 32 }).notNull(),
    slotStartMs: bigint("slotStartMs", { mode: "number" }).notNull(),
    durationMin: integer("durationMin").notNull(),
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

    status: bookingsStatusEnum("status").default("confirmed").notNull(),

    emailSent: integer("emailSent").default(0).notNull(),
    ownerNotified: integer("ownerNotified").default(0).notNull(),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [index("bookings_status_idx").on(table.status)],
);

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

/**
 * Audit log for booking lifecycle events. Cascade: dies with its booking.
 */
export const bookingAudit = pgTable(
  "booking_audit",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("bookingId")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 64 }).notNull(),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("booking_audit_booking_id_idx").on(table.bookingId)],
);

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
export const leadsStatusEnum = pgEnum("leads_status", ["new", "qualified", "engaged", "won", "lost"]);

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    /** Origin surface: booking | contact | ai-scan | eng-access | manual. */
    source: varchar("source", { length: 32 }).notNull(),
    /**
     * Optional pointer to the originating row id (e.g. bookings.id). NO
     * foreign key — polymorphic by design (target table depends on
     * `source`); see file header note.
     */
    sourceId: integer("sourceId"),

    fullName: varchar("fullName", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    company: varchar("company", { length: 200 }),
    phone: varchar("phone", { length: 64 }),

    /** "discovery" | "growth" | "elite" for bookings, or free-form interest tag. */
    interest: varchar("interest", { length: 64 }),
    /** Free-form note (≤2000 chars). */
    note: text("note"),

    /** Lifecycle status — owned by the IO SKY operations team. */
    status: leadsStatusEnum("status").default("new").notNull(),

    utmSource: varchar("utmSource", { length: 120 }),
    utmCampaign: varchar("utmCampaign", { length: 120 }),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [index("leads_status_idx").on(table.status)],
);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Contact form submissions from /contact.
 */
export const contactSubmissionsStatusEnum = pgEnum("contact_submissions_status", [
  "new",
  "responded",
  "closed",
  "spam",
]);

export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),

  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  company: varchar("company", { length: 200 }),
  industry: varchar("industry", { length: 64 }),
  size: varchar("size", { length: 64 }),
  subject: varchar("subject", { length: 64 }).notNull(),
  message: text("message").notNull(),

  status: contactSubmissionsStatusEnum("status").default("new").notNull(),

  emailSent: integer("emailSent").default(0).notNull(),
  ownerNotified: integer("ownerNotified").default(0).notNull(),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = typeof contactSubmissions.$inferInsert;

/**
 * Developer / engineering access applications from /engineering-access.
 * Gated by NDA + non-solicitation acknowledgement.
 */
export const devApplicationsStatusEnum = pgEnum("dev_applications_status", [
  "pending",
  "in_review",
  "approved",
  "rejected",
]);

export const devApplications = pgTable("dev_applications", {
  id: serial("id").primaryKey(),
  publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),

  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  company: varchar("company", { length: 200 }),
  roleTitle: varchar("roleTitle", { length: 120 }),
  yearsExperience: integer("yearsExperience"),

  /** GitHub / portfolio / LinkedIn URLs (concatenated, ≤2000 chars). */
  links: text("links"),
  /** Free-form short-form pitch. */
  message: text("message"),

  /** Compliance acknowledgements — all must be true to submit. */
  ackNda: integer("ackNda").default(0).notNull(),
  ackConfidentiality: integer("ackConfidentiality").default(0).notNull(),
  ackNonSolicitation: integer("ackNonSolicitation").default(0).notNull(),

  status: devApplicationsStatusEnum("status").default("pending").notNull(),

  reviewerNote: text("reviewerNote"),

  ownerNotified: integer("ownerNotified").default(0).notNull(),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type DevApplication = typeof devApplications.$inferSelect;
export type InsertDevApplication = typeof devApplications.$inferInsert;

/**
 * Login attempts audit log — populated on every successful or failed
 * authentication so admins can see who logged in, when, and from where.
 * Compliance/audit trail — userId FK deliberately has NO cascade/set-null
 * so a deleted user's login history is never silently altered.
 */
export const loginAudit = pgTable(
  "login_audit",
  {
    id: serial("id").primaryKey(),
    /** Optional user id once the attempt resolved to an existing user. */
    userId: integer("userId").references(() => users.id),
    /** Email or open-id used in the attempt (best-effort). */
    identifier: varchar("identifier", { length: 320 }),
    /** "manus" | "google" | "microsoft" | "apple" | "magic-link" | "local" | "admin" | "credentials". */
    provider: varchar("provider", { length: 32 }).notNull(),
    /** "success" | "failed" | "blocked" | "mfa_required". */
    outcome: varchar("outcome", { length: 32 }).notNull(),
    /** Optional human-readable reason for failed/blocked attempts. */
    reason: varchar("reason", { length: 200 }),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("login_audit_user_id_idx").on(table.userId)],
);

export type LoginAudit = typeof loginAudit.$inferSelect;
export type InsertLoginAudit = typeof loginAudit.$inferInsert;

/* -----------------------------------------------------------------------
 * CLIENT PORTAL (multi-tenant, organization-scoped)
 * Every record below carries `organizationId`. The clientProcedure
 * middleware on the server side filters by ctx.user.organizationId before
 * any data is returned to the client. Postgres RLS (RM-48) now backstops
 * this at the database layer too — see the RLS policy migration.
 * ---------------------------------------------------------------------*/

/**
 * Organization (tenant) record. Each authenticated client user belongs to
 * exactly one organization via `users.organizationId`.
 */
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  legalName: varchar("legalName", { length: 200 }),
  industry: varchar("industry", { length: 64 }),
  size: varchar("size", { length: 64 }),
  country: varchar("country", { length: 64 }),
  /** Operational health 0-100. Recalculated by AI Scan completions. */
  operationalScore: integer("operationalScore").default(72).notNull(),
  /** Optional UI accent (kept restrained — Brand orange by default). */
  accentHex: varchar("accentHex", { length: 16 }),
  /** Cached "current operational status" string, e.g. "Healthy", "Watching". */
  statusLabel: varchar("statusLabel", { length: 64 }).default("Healthy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Organization memberships — join table for users <-> organizations.
 * Cascade both ways: a membership row has no meaning once either side is gone.
 */
export const organizationMembershipsRoleEnum = pgEnum("organization_memberships_role", ["owner", "member"]);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "owner" | "member". Only used inside the client portal. */
    membershipRole: organizationMembershipsRoleEnum("membershipRole").default("member").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("organization_memberships_organization_id_idx").on(table.organizationId),
    index("organization_memberships_user_id_idx").on(table.userId),
  ],
);
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type InsertOrganizationMembership = typeof organizationMemberships.$inferInsert;

/**
 * AI Scan reports produced for a client organization. Cascade: a report is
 * meaningless once its organization is gone.
 */
export const clientReportsStatusEnum = pgEnum("client_reports_status", ["draft", "ready", "delivered"]);

export const clientReports = pgTable(
  "client_reports",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    scanType: varchar("scanType", { length: 32 }).default("ai-scan").notNull(),
    /** Operational score 0-100 at the time of this report. */
    score: integer("score").notNull(),
    /** Delta vs the previous report (signed integer). */
    delta: integer("delta").default(0).notNull(),
    /** Plain-text excerpt shown on dashboard cards. */
    summary: text("summary"),
    /** Signed URL key in object storage (we will resolve via storageGet). */
    pdfKey: varchar("pdfKey", { length: 512 }),
    status: clientReportsStatusEnum("status").default("ready").notNull(),
    pages: integer("pages"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [index("client_reports_organization_id_idx").on(table.organizationId)],
);
export type ClientReport = typeof clientReports.$inferSelect;
export type InsertClientReport = typeof clientReports.$inferInsert;

/**
 * AI Recommendations attached to an organization. Cascade with org and
 * (optionally) with the report that produced them.
 */
export const clientRecommendationsImpactEnum = pgEnum("client_recommendations_impact", ["low", "medium", "high"]);
export const clientRecommendationsStatusEnum = pgEnum("client_recommendations_status", [
  "pending",
  "in_progress",
  "completed",
  "dismissed",
]);

export const clientRecommendations = pgTable(
  "client_recommendations",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reportId: integer("reportId").references(() => clientReports.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    category: varchar("category", { length: 96 }).notNull(),
    impact: clientRecommendationsImpactEnum("impact").default("medium").notNull(),
    status: clientRecommendationsStatusEnum("status").default("pending").notNull(),
    body: text("body"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("client_recommendations_organization_id_idx").on(table.organizationId),
    index("client_recommendations_report_id_idx").on(table.reportId),
  ],
);
export type ClientRecommendation = typeof clientRecommendations.$inferSelect;
export type InsertClientRecommendation = typeof clientRecommendations.$inferInsert;

/**
 * Project (implementation) records. Cascade with org.
 */
export const clientProjectsStatusEnum = pgEnum("client_projects_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
]);

export const clientProjects = pgTable(
  "client_projects",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    phase: varchar("phase", { length: 96 }).default("Discovery").notNull(),
    progress: integer("progress").default(0).notNull(),
    startMs: bigint("startMs", { mode: "number" }),
    targetMs: bigint("targetMs", { mode: "number" }),
    status: clientProjectsStatusEnum("status").default("active").notNull(),
    summary: text("summary"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("client_projects_organization_id_idx").on(table.organizationId)],
);
export type ClientProject = typeof clientProjects.$inferSelect;

/**
 * Project milestones. Cascade: a milestone has no meaning without its
 * project. NOTE: this table has no organizationId of its own — tenant
 * scoping requires a join through client_projects.organizationId. Flagged
 * in the original forensic audit as a place a future query could
 * accidentally skip tenant filtering; the RLS policy for this table (RM-48)
 * expresses the same join so the database enforces it even if application
 * code forgets.
 */
export const clientProjectMilestonesStatusEnum = pgEnum("client_project_milestones_status", [
  "pending",
  "in_progress",
  "completed",
]);

export const clientProjectMilestones = pgTable(
  "client_project_milestones",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId")
      .notNull()
      .references(() => clientProjects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    dueMs: bigint("dueMs", { mode: "number" }),
    status: clientProjectMilestonesStatusEnum("status").default("pending").notNull(),
    body: text("body"),
  },
  (table) => [index("client_project_milestones_project_id_idx").on(table.projectId)],
);
export type ClientProjectMilestone = typeof clientProjectMilestones.$inferSelect;

/**
 * Invoice records for a client organization. Financial record — NO cascade
 * from organizations (⚠ REQUIRES VERIFICATION: confirm with the client
 * whether deleting an org should be blocked while paid/open invoices exist,
 * which is what the omitted onDelete currently enforces, or whether
 * invoices should be preserved independently via a different mechanism —
 * e.g. archival — before an org can ever be deleted).
 */
export const clientInvoicesStatusEnum = pgEnum("client_invoices_status", [
  "draft",
  "open",
  "paid",
  "overdue",
  "void",
]);

export const clientInvoices = pgTable(
  "client_invoices",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id),
    number: varchar("number", { length: 32 }).notNull().unique(),
    description: varchar("description", { length: 200 }).notNull(),
    amountCents: integer("amountCents").notNull(),
    currency: varchar("currency", { length: 8 }).default("EUR").notNull(),
    status: clientInvoicesStatusEnum("status").default("open").notNull(),
    issuedMs: bigint("issuedMs", { mode: "number" }).notNull(),
    dueMs: bigint("dueMs", { mode: "number" }),
    paidMs: bigint("paidMs", { mode: "number" }),
    pdfKey: varchar("pdfKey", { length: 512 }),
  },
  (table) => [
    index("client_invoices_organization_id_idx").on(table.organizationId),
    index("client_invoices_status_idx").on(table.status),
  ],
);
export type ClientInvoice = typeof clientInvoices.$inferSelect;

/**
 * Secure documents library. Cascade with org.
 */
export const clientDocuments = pgTable(
  "client_documents",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 96 }).default("general").notNull(),
    fileKey: varchar("fileKey", { length: 512 }).notNull(),
    sizeBytes: integer("sizeBytes"),
    mimeType: varchar("mimeType", { length: 96 }),
    uploadedByUserId: integer("uploadedByUserId").references(() => users.id),
    uploadedBy: varchar("uploadedBy", { length: 200 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("client_documents_organization_id_idx").on(table.organizationId)],
);
export type ClientDocument = typeof clientDocuments.$inferSelect;

/**
 * Messages between IO SKY team and a client. Cascade with org.
 */
export const clientMessagesSenderEnum = pgEnum("client_messages_sender", ["io-sky", "client"]);

export const clientMessages = pgTable(
  "client_messages",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    threadKey: varchar("threadKey", { length: 64 }).notNull(),
    sender: clientMessagesSenderEnum("sender").notNull(),
    senderName: varchar("senderName", { length: 200 }),
    subject: varchar("subject", { length: 200 }),
    body: text("body").notNull(),
    readAt: bigint("readAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("client_messages_organization_id_idx").on(table.organizationId)],
);
export type ClientMessage = typeof clientMessages.$inferSelect;

/**
 * Notifications shown in the portal bell + recent-activity feed. Cascade
 * with org.
 */
export const clientNotifications = pgTable(
  "client_notifications",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** "report" | "booking" | "payment" | "document" | "message" | "security". */
    kind: varchar("kind", { length: 32 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    href: varchar("href", { length: 512 }),
    readAt: bigint("readAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("client_notifications_organization_id_idx").on(table.organizationId)],
);
export type ClientNotification = typeof clientNotifications.$inferSelect;

/**
 * Support tickets opened from the client portal. Cascade with org.
 */
export const clientSupportTicketsPriorityEnum = pgEnum("client_support_tickets_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);
export const clientSupportTicketsStatusEnum = pgEnum("client_support_tickets_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const clientSupportTickets = pgTable(
  "client_support_tickets",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    openedByUserId: integer("openedByUserId").references(() => users.id),
    publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),
    subject: varchar("subject", { length: 200 }).notNull(),
    body: text("body").notNull(),
    category: varchar("category", { length: 64 }).default("general").notNull(),
    priority: clientSupportTicketsPriorityEnum("priority").default("normal").notNull(),
    status: clientSupportTicketsStatusEnum("status").default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("client_support_tickets_organization_id_idx").on(table.organizationId),
    index("client_support_tickets_status_idx").on(table.status),
  ],
);
export type ClientSupportTicket = typeof clientSupportTickets.$inferSelect;

/* -----------------------------------------------------------------------
 * DEVELOPER WORKSPACE (assignment-scoped, role="developer" only)
 *
 * The Developer Workspace is a restricted engineering surface, completely
 * separate from the Client Portal. Every record below is keyed to a
 * `developer` user (`developerId`) and (where work is involved) a project
 * assignment (`assignmentId`).
 *
 * Visibility rules (enforced by the developerProcedure middleware on the
 * server side, backstopped by RLS at the database layer — RM-48):
 *   1. The user must have role="developer".
 *   2. A developer_profiles row must exist for the user.
 *   3. The profile must reference a non-revoked, non-expired access scope.
 *   4. All required agreements (NDA, confidentiality, non-solicitation,
 *      liability, security policy) must be signed.
 *   5. MFA must be enrolled (mfaMethod !== "none").
 *
 * Sub-tabs `commits` and `submissions` share the same table
 * (`developerSubmissions`) — a "commit-style" row carries `kind="commit"`
 * with a repository / sha / branch payload, while a regular submitted
 * deliverable carries `kind="submission"` with a fileKey.
 * ---------------------------------------------------------------------*/

/**
 * Developer profile — one row per user with role="developer". Cascade with
 * the user; no cascade to the source application (kept for history even if
 * the application record itself changes).
 */
export const developerProfilesAvailabilityEnum = pgEnum("developer_profiles_availability", [
  "available",
  "limited",
  "unavailable",
]);
export const developerProfilesStatusEnum = pgEnum("developer_profiles_status", [
  "active",
  "suspended",
  "terminated",
]);

export const developerProfiles = pgTable(
  "developer_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Source application that produced this developer (optional). */
    applicationId: integer("applicationId").references(() => devApplications.id),
    fullName: varchar("fullName", { length: 200 }).notNull(),
    country: varchar("country", { length: 64 }),
    linkedin: varchar("linkedin", { length: 320 }),
    github: varchar("github", { length: 320 }),
    portfolio: varchar("portfolio", { length: 320 }),
    /** Comma-separated specialty tags (e.g. "ai,backend,enterprise-systems"). */
    specialties: varchar("specialties", { length: 320 }),
    yearsExperience: integer("yearsExperience"),
    availability: developerProfilesAvailabilityEnum("availability").default("available").notNull(),
    status: developerProfilesStatusEnum("status").default("active").notNull(),
    /** Required-MFA flag (enforced by middleware once true). */
    mfaRequired: integer("mfaRequired").default(1).notNull(),
    /** Date when admin approved this developer (ms since epoch). */
    approvedMs: bigint("approvedMs", { mode: "number" }),
    approvedByUserId: integer("approvedByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [index("developer_profiles_application_id_idx").on(table.applicationId)],
);
export type DeveloperProfile = typeof developerProfiles.$inferSelect;
export type InsertDeveloperProfile = typeof developerProfiles.$inferInsert;

/**
 * Per-developer access scope. Cascade with the developer profile.
 */
export const developerAccessScopesLevelEnum = pgEnum("developer_access_scopes_level", [
  "baseline",
  "extended",
  "elevated",
]);
export const developerAccessScopesStatusEnum = pgEnum("developer_access_scopes_status", [
  "active",
  "expired",
  "revoked",
]);

export const developerAccessScopes = pgTable(
  "developer_access_scopes",
  {
    id: serial("id").primaryKey(),
    developerId: integer("developerId")
      .notNull()
      .references(() => developerProfiles.id, { onDelete: "cascade" }),
    level: developerAccessScopesLevelEnum("level").default("baseline").notNull(),
    /** Comma-separated permission keys (e.g. "files:download,submissions:write"). */
    allowedActions: text("allowedActions"),
    /** Comma-separated sidebar route keys allowed (e.g. "overview,tasks,files"). */
    allowedRoutes: text("allowedRoutes"),
    startMs: bigint("startMs", { mode: "number" }).notNull(),
    expiresMs: bigint("expiresMs", { mode: "number" }),
    status: developerAccessScopesStatusEnum("status").default("active").notNull(),
    createdByUserId: integer("createdByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [index("developer_access_scopes_developer_id_idx").on(table.developerId)],
);
export type DeveloperAccessScope = typeof developerAccessScopes.$inferSelect;
export type InsertDeveloperAccessScope = typeof developerAccessScopes.$inferInsert;

/**
 * Legal agreements signed by the developer. Cascade with the developer
 * profile.
 */
export const developerAgreementsStatusEnum = pgEnum("developer_agreements_status", [
  "draft",
  "pending",
  "signed",
]);

export const developerAgreements = pgTable(
  "developer_agreements",
  {
    id: serial("id").primaryKey(),
    developerId: integer("developerId")
      .notNull()
      .references(() => developerProfiles.id, { onDelete: "cascade" }),
    /** "nda" | "confidentiality" | "non-solicitation" | "liability" | "security-policy". */
    agreementType: varchar("agreementType", { length: 64 }).notNull(),
    version: varchar("version", { length: 32 }).notNull(),
    status: developerAgreementsStatusEnum("status").default("pending").notNull(),
    signedMs: bigint("signedMs", { mode: "number" }),
    signedIp: varchar("signedIp", { length: 64 }),
    signedUserAgent: text("signedUserAgent"),
    documentKey: varchar("documentKey", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("developer_agreements_developer_id_idx").on(table.developerId)],
);
export type DeveloperAgreement = typeof developerAgreements.$inferSelect;
export type InsertDeveloperAgreement = typeof developerAgreements.$inferInsert;

/**
 * Project (engineering work) records visible to developers ONLY through
 * an explicit assignment.
 */
export const developerProjectsStatusEnum = pgEnum("developer_projects_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
]);

export const developerProjects = pgTable("developer_projects", {
  id: serial("id").primaryKey(),
  /** Internal project code (e.g. "PRJ-AI-WORKFLOW"). Always shown to the developer. */
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  /** Sanitized brief — never includes client name, contact, financials. */
  brief: text("brief"),
  /** "backend" | "frontend" | "full-stack" | "ai" | "infra" | "research". */
  track: varchar("track", { length: 64 }).default("full-stack").notNull(),
  status: developerProjectsStatusEnum("status").default("active").notNull(),
  startMs: bigint("startMs", { mode: "number" }),
  targetMs: bigint("targetMs", { mode: "number" }),
  createdByUserId: integer("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type DeveloperProject = typeof developerProjects.$inferSelect;
export type InsertDeveloperProject = typeof developerProjects.$inferInsert;

/**
 * Project ↔ developer assignment join table. Cascade both ways: an
 * assignment has no meaning once either side is gone.
 */
export const developerProjectAssignmentsRoleEnum = pgEnum("developer_project_assignments_role", [
  "lead",
  "contributor",
  "reviewer",
]);
export const developerProjectAssignmentsStatusEnum = pgEnum("developer_project_assignments_status", [
  "active",
  "paused",
  "ended",
]);

export const developerProjectAssignments = pgTable(
  "developer_project_assignments",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId")
      .notNull()
      .references(() => developerProjects.id, { onDelete: "cascade" }),
    developerId: integer("developerId")
      .notNull()
      .references(() => developerProfiles.id, { onDelete: "cascade" }),
    assignmentRole: developerProjectAssignmentsRoleEnum("assignmentRole").default("contributor").notNull(),
    status: developerProjectAssignmentsStatusEnum("status").default("active").notNull(),
    progress: integer("progress").default(0).notNull(),
    startMs: bigint("startMs", { mode: "number" }),
    endMs: bigint("endMs", { mode: "number" }),
    createdByUserId: integer("createdByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [
    index("developer_project_assignments_project_id_idx").on(table.projectId),
    index("developer_project_assignments_developer_id_idx").on(table.developerId),
  ],
);
export type DeveloperProjectAssignment = typeof developerProjectAssignments.$inferSelect;
export type InsertDeveloperProjectAssignment = typeof developerProjectAssignments.$inferInsert;

/**
 * Tasks belonging to a project. Cascade with project.
 */
export const developerTasksStatusEnum = pgEnum("developer_tasks_status", [
  "planned",
  "in_progress",
  "blocked",
  "in_review",
  "done",
]);
export const developerTasksPriorityEnum = pgEnum("developer_tasks_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const developerTasks = pgTable(
  "developer_tasks",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId")
      .notNull()
      .references(() => developerProjects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    status: developerTasksStatusEnum("status").default("planned").notNull(),
    priority: developerTasksPriorityEnum("priority").default("normal").notNull(),
    dueMs: bigint("dueMs", { mode: "number" }),
    createdByUserId: integer("createdByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [
    index("developer_tasks_project_id_idx").on(table.projectId),
    index("developer_tasks_status_idx").on(table.status),
  ],
);
export type DeveloperTask = typeof developerTasks.$inferSelect;
export type InsertDeveloperTask = typeof developerTasks.$inferInsert;

/**
 * Task ↔ developer assignment. Cascade both ways.
 */
export const developerTaskAssignmentsStatusEnum = pgEnum("developer_task_assignments_status", [
  "active",
  "released",
]);

export const developerTaskAssignments = pgTable(
  "developer_task_assignments",
  {
    id: serial("id").primaryKey(),
    taskId: integer("taskId")
      .notNull()
      .references(() => developerTasks.id, { onDelete: "cascade" }),
    developerId: integer("developerId")
      .notNull()
      .references(() => developerProfiles.id, { onDelete: "cascade" }),
    status: developerTaskAssignmentsStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("developer_task_assignments_task_id_idx").on(table.taskId),
    index("developer_task_assignments_developer_id_idx").on(table.developerId),
  ],
);
export type DeveloperTaskAssignment = typeof developerTaskAssignments.$inferSelect;

/**
 * Approved files for a project. Cascade with project.
 */
export const developerProjectFiles = pgTable(
  "developer_project_files",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId")
      .notNull()
      .references(() => developerProjects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    /** Storage key under the developer-approved prefix. Never expose raw bucket URLs. */
    fileKey: varchar("fileKey", { length: 512 }).notNull(),
    sizeBytes: integer("sizeBytes"),
    mimeType: varchar("mimeType", { length: 96 }),
    category: varchar("category", { length: 64 }).default("specification").notNull(),
    uploadedByUserId: integer("uploadedByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("developer_project_files_project_id_idx").on(table.projectId)],
);
export type DeveloperProjectFile = typeof developerProjectFiles.$inferSelect;

/**
 * Submissions / commits the developer reports back. Cascade with project
 * and developer profile.
 */
export const developerSubmissionsKindEnum = pgEnum("developer_submissions_kind", ["submission", "commit"]);
export const developerSubmissionsStatusEnum = pgEnum("developer_submissions_status", [
  "pending",
  "in_review",
  "accepted",
  "changes_requested",
  "rejected",
]);

export const developerSubmissions = pgTable(
  "developer_submissions",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId")
      .notNull()
      .references(() => developerProjects.id, { onDelete: "cascade" }),
    developerId: integer("developerId")
      .notNull()
      .references(() => developerProfiles.id, { onDelete: "cascade" }),
    kind: developerSubmissionsKindEnum("kind").default("submission").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    /** Only present for kind="submission". */
    fileKey: varchar("fileKey", { length: 512 }),
    /** Only present for kind="commit". */
    repository: varchar("repository", { length: 320 }),
    sha: varchar("sha", { length: 64 }),
    branch: varchar("branch", { length: 200 }),
    status: developerSubmissionsStatusEnum("status").default("pending").notNull(),
    reviewerNote: text("reviewerNote"),
    reviewedByUserId: integer("reviewedByUserId").references(() => users.id),
    reviewedMs: bigint("reviewedMs", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("developer_submissions_project_id_idx").on(table.projectId),
    index("developer_submissions_developer_id_idx").on(table.developerId),
  ],
);
export type DeveloperSubmission = typeof developerSubmissions.$inferSelect;
export type InsertDeveloperSubmission = typeof developerSubmissions.$inferInsert;

/**
 * Messages between admin and developer. Cascade with developer profile.
 */
export const developerMessagesSenderEnum = pgEnum("developer_messages_sender", ["admin", "developer"]);

export const developerMessages = pgTable(
  "developer_messages",
  {
    id: serial("id").primaryKey(),
    developerId: integer("developerId")
      .notNull()
      .references(() => developerProfiles.id, { onDelete: "cascade" }),
    sender: developerMessagesSenderEnum("sender").notNull(),
    senderName: varchar("senderName", { length: 200 }),
    subject: varchar("subject", { length: 200 }),
    body: text("body").notNull(),
    readAt: bigint("readAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("developer_messages_developer_id_idx").on(table.developerId)],
);
export type DeveloperMessage = typeof developerMessages.$inferSelect;
export type InsertDeveloperMessage = typeof developerMessages.$inferInsert;

/**
 * Access-extension requests raised by a developer when their access
 * scope is about to expire. Cascade with developer profile.
 */
export const developerAccessRequestsStatusEnum = pgEnum("developer_access_requests_status", [
  "pending",
  "approved",
  "denied",
]);

export const developerAccessRequests = pgTable(
  "developer_access_requests",
  {
    id: serial("id").primaryKey(),
    developerId: integer("developerId")
      .notNull()
      .references(() => developerProfiles.id, { onDelete: "cascade" }),
    scopeId: integer("scopeId").references(() => developerAccessScopes.id),
    reason: text("reason").notNull(),
    status: developerAccessRequestsStatusEnum("status").default("pending").notNull(),
    reviewerNote: text("reviewerNote"),
    reviewedByUserId: integer("reviewedByUserId").references(() => users.id),
    reviewedMs: bigint("reviewedMs", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("developer_access_requests_developer_id_idx").on(table.developerId)],
);
export type DeveloperAccessRequest = typeof developerAccessRequests.$inferSelect;

/**
 * Generic developer audit log. Compliance record — NO cascade from the
 * developer profile (⚠ REQUIRES VERIFICATION: confirm retention
 * expectations with the client; omitted onDelete currently blocks deleting
 * a developer profile while audit rows reference it).
 */
export const developerAudit = pgTable(
  "developer_audit",
  {
    id: serial("id").primaryKey(),
    developerId: integer("developerId").references(() => developerProfiles.id),
    /** Action key (e.g. "gate.passed", "file.downloaded", "submission.created"). */
    event: varchar("event", { length: 96 }).notNull(),
    detail: text("detail"),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("developer_audit_developer_id_idx").on(table.developerId)],
);
export type DeveloperAudit = typeof developerAudit.$inferSelect;
export type InsertDeveloperAudit = typeof developerAudit.$inferInsert;

/**
 * Security events specific to the developer workspace. Compliance record —
 * same NO-cascade reasoning as developer_audit above.
 */
export const developerSecurityEventsSeverityEnum = pgEnum("developer_security_events_severity", [
  "info",
  "warn",
  "high",
  "critical",
]);

export const developerSecurityEvents = pgTable(
  "developer_security_events",
  {
    id: serial("id").primaryKey(),
    developerId: integer("developerId").references(() => developerProfiles.id),
    /** "failed_login" | "unauthorized_route" | "download_spike" | "ip_change" | "role_escalation" | "expired_access" | "abnormal_api". */
    kind: varchar("kind", { length: 64 }).notNull(),
    severity: developerSecurityEventsSeverityEnum("severity").default("warn").notNull(),
    message: varchar("message", { length: 200 }).notNull(),
    detail: text("detail"),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    acknowledgedAt: bigint("acknowledgedAt", { mode: "number" }),
    acknowledgedByUserId: integer("acknowledgedByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("developer_security_events_developer_id_idx").on(table.developerId),
    index("developer_security_events_severity_idx").on(table.severity),
  ],
);
export type DeveloperSecurityEvent = typeof developerSecurityEvents.$inferSelect;

/**
 * Support tickets opened by a developer to IO SKY admin. Cascade with
 * developer profile.
 */
export const developerSupportTicketsPriorityEnum = pgEnum("developer_support_tickets_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);
export const developerSupportTicketsStatusEnum = pgEnum("developer_support_tickets_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const developerSupportTickets = pgTable(
  "developer_support_tickets",
  {
    id: serial("id").primaryKey(),
    developerId: integer("developerId")
      .notNull()
      .references(() => developerProfiles.id, { onDelete: "cascade" }),
    publicRef: varchar("publicRef", { length: 32 }).notNull().unique(),
    subject: varchar("subject", { length: 200 }).notNull(),
    body: text("body").notNull(),
    category: varchar("category", { length: 64 }).default("general").notNull(),
    priority: developerSupportTicketsPriorityEnum("priority").default("normal").notNull(),
    status: developerSupportTicketsStatusEnum("status").default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("developer_support_tickets_developer_id_idx").on(table.developerId)],
);
export type DeveloperSupportTicket = typeof developerSupportTickets.$inferSelect;

/**
 * Developer-side notifications (the workspace bell). Mirrors the client
 * notifications table but scoped to a single developer so we never leak
 * cross-developer signal. Cascade with developer profile.
 */
export const developerNotifications = pgTable(
  "developer_notifications",
  {
    id: serial("id").primaryKey(),
    developerId: integer("developerId")
      .notNull()
      .references(() => developerProfiles.id, { onDelete: "cascade" }),
    /** "assignment" | "task" | "message" | "review" | "agreement" | "access" | "security". */
    kind: varchar("kind", { length: 32 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    href: varchar("href", { length: 512 }),
    readAt: bigint("readAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("developer_notifications_developer_id_idx").on(table.developerId)],
);
export type DeveloperNotification = typeof developerNotifications.$inferSelect;

// ---------------------------------------------------------------------------
// MFA — full track (TOTP + SMS + recovery codes + verification challenges)
// ---------------------------------------------------------------------------

/**
 * A registered second-factor for a user. Cascade with user — MFA factors
 * are meaningless once the account they protect is gone.
 */
export const mfaFactorsKindEnum = pgEnum("mfa_factors_kind", ["totp", "sms"]);

export const mfaFactors = pgTable(
  "mfa_factors",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: mfaFactorsKindEnum("kind").notNull(),
    label: varchar("label", { length: 120 }),
    /** Encrypted secret envelope (iv:tag:ciphertext, all base64). */
    secret: text("secret").notNull(),
    /** Public display hint, e.g. "•••• 1234" or the authenticator app name. */
    phoneHint: varchar("phoneHint", { length: 32 }),
    verifiedAt: timestamp("verifiedAt"),
    primary: integer("primary").default(0).notNull(),
    failedAttempts: integer("failedAttempts").default(0).notNull(),
    lockedUntilMs: bigint("lockedUntilMs", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
  },
  (table) => [index("mfa_factors_user_id_idx").on(table.userId)],
);
export type MfaFactor = typeof mfaFactors.$inferSelect;
export type InsertMfaFactor = typeof mfaFactors.$inferInsert;

/**
 * One-shot recovery codes. Cascade with user.
 */
export const mfaRecoveryCodes = pgTable(
  "mfa_recovery_codes",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("codeHash", { length: 128 }).notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("mfa_recovery_codes_user_id_idx").on(table.userId)],
);
export type MfaRecoveryCode = typeof mfaRecoveryCodes.$inferSelect;

/**
 * Pending MFA verification challenges. Cascade with user; the referenced
 * factor is nullable (challenge may predate a specific-factor choice).
 */
export const mfaChallengesPurposeEnum = pgEnum("mfa_challenges_purpose", ["login", "enroll", "step_up"]);
export const mfaChallengesExpectedKindEnum = pgEnum("mfa_challenges_expected_kind", ["totp", "sms", "any"]);

export const mfaChallenges = pgTable(
  "mfa_challenges",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: varchar("state", { length: 96 }).notNull().unique(),
    purpose: mfaChallengesPurposeEnum("purpose").default("login").notNull(),
    expectedKind: mfaChallengesExpectedKindEnum("expectedKind").default("any").notNull(),
    factorId: integer("factorId").references(() => mfaFactors.id, { onDelete: "cascade" }),
    failedAttempts: integer("failedAttempts").default(0).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    consumedAt: timestamp("consumedAt"),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("mfa_challenges_user_id_idx").on(table.userId)],
);
export type MfaChallenge = typeof mfaChallenges.$inferSelect;
export type InsertMfaChallenge = typeof mfaChallenges.$inferInsert;

// ---------------------------------------------------------------------------
// Native IO SKY Booking System
// ---------------------------------------------------------------------------
// Self-hosted booking infrastructure. The adapter pattern (server/_core/booking)
// lets us later plug Google Calendar / Microsoft Calendar / Cal.com without
// changing the public booking UX. The NativeBookingAdapter is the source of
// truth for availability + slot allocation today.

export const adminAvailability = pgTable("admin_availability", {
  id: serial("id").primaryKey(),
  consultationType: varchar("consultationType", { length: 32 }).notNull(),
  /** 0=Sunday ... 6=Saturday (JS Date.getDay convention). */
  weekday: integer("weekday").notNull(),
  startMinute: integer("startMinute").notNull(),
  endMinute: integer("endMinute").notNull(),
  /** IANA timezone the window is expressed in. */
  timezone: varchar("timezone", { length: 64 }).notNull(),
  active: integer("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AdminAvailabilityRow = typeof adminAvailability.$inferSelect;
export type InsertAdminAvailability = typeof adminAvailability.$inferInsert;

export const availabilityWindowsKindEnum = pgEnum("availability_windows_kind", ["open", "close"]);

export const availabilityWindows = pgTable("availability_windows", {
  id: serial("id").primaryKey(),
  consultationType: varchar("consultationType", { length: 32 }),
  kind: availabilityWindowsKindEnum("kind").notNull(),
  startMs: bigint("startMs", { mode: "number" }).notNull(),
  endMs: bigint("endMs", { mode: "number" }).notNull(),
  reason: varchar("reason", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AvailabilityWindow = typeof availabilityWindows.$inferSelect;
export type InsertAvailabilityWindow = typeof availabilityWindows.$inferInsert;

export const calendarBlocks = pgTable("calendar_blocks", {
  id: serial("id").primaryKey(),
  startMs: bigint("startMs", { mode: "number" }).notNull(),
  endMs: bigint("endMs", { mode: "number" }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CalendarBlock = typeof calendarBlocks.$inferSelect;
export type InsertCalendarBlock = typeof calendarBlocks.$inferInsert;

/**
 * bookingId is deliberately left un-referenced by a hard FK even though it
 * conceptually points at bookings.id: a slot is "held" (bookingId still
 * null) before a booking row exists at all, and tryHoldBookingSlot's retry
 * path re-purposes an expired held slot without going through the booking
 * flow. Modeling this as a real FK would require a more invasive rework of
 * server/db/bookings.ts's slot lifecycle than a structural migration should
 * do — flagged, not silently added.
 */
export const bookingSlotsStatusEnum = pgEnum("booking_slots_status", ["held", "booked", "cancelled"]);

export const bookingSlots = pgTable(
  "booking_slots",
  {
    id: serial("id").primaryKey(),
    consultationType: varchar("consultationType", { length: 32 }).notNull(),
    slotStartMs: bigint("slotStartMs", { mode: "number" }).notNull(),
    slotEndMs: bigint("slotEndMs", { mode: "number" }).notNull(),
    status: bookingSlotsStatusEnum("status").default("held").notNull(),
    bookingId: integer("bookingId"),
    holdToken: varchar("holdToken", { length: 64 }),
    holdExpiresAtMs: bigint("holdExpiresAtMs", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [
    index("booking_slots_booking_id_idx").on(table.bookingId),
    index("booking_slots_status_idx").on(table.status),
  ],
);
export type BookingSlot = typeof bookingSlots.$inferSelect;
export type InsertBookingSlot = typeof bookingSlots.$inferInsert;

export const bookingAnswers = pgTable(
  "booking_answers",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("bookingId")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    question: varchar("question", { length: 200 }).notNull(),
    answer: text("answer").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("booking_answers_booking_id_idx").on(table.bookingId)],
);
export type BookingAnswer = typeof bookingAnswers.$inferSelect;
export type InsertBookingAnswer = typeof bookingAnswers.$inferInsert;

export const bookingRemindersKindEnum = pgEnum("booking_reminders_kind", [
  "confirmation",
  "reminder_24h",
  "reminder_1h",
  "reschedule",
  "cancellation",
]);

export const bookingReminders = pgTable(
  "booking_reminders",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("bookingId")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    kind: bookingRemindersKindEnum("kind").notNull(),
    scheduledForMs: bigint("scheduledForMs", { mode: "number" }).notNull(),
    sentAt: timestamp("sentAt"),
    errorDetail: text("errorDetail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("booking_reminders_booking_id_idx").on(table.bookingId)],
);
export type BookingReminder = typeof bookingReminders.$inferSelect;
export type InsertBookingReminder = typeof bookingReminders.$inferInsert;

/**
 * Booking lifecycle event log — compliance-adjacent, NO cascade from
 * bookings (⚠ REQUIRES VERIFICATION: same retention question as the other
 * audit tables above).
 */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("bookingId")
      .notNull()
      .references(() => bookings.id),
    event: varchar("event", { length: 64 }).notNull(),
    actorOpenId: varchar("actorOpenId", { length: 128 }),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("booking_events_booking_id_idx").on(table.bookingId)],
);
export type BookingEvent = typeof bookingEvents.$inferSelect;
export type InsertBookingEvent = typeof bookingEvents.$inferInsert;

export const timezonePreferences = pgTable("timezone_preferences", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
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

export const ecosystemClickEvents = pgTable(
  "ecosystem_click_events",
  {
    id: serial("id").primaryKey(),
    eventKey: varchar("eventKey", { length: 80 }).notNull(),
    source: varchar("source", { length: 64 }).notNull().default("solutions"),
    ecosystem: varchar("ecosystem", { length: 32 }),
    sessionToken: varchar("sessionToken", { length: 64 }),
    userId: integer("userId").references(() => users.id),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    payload: text("payload"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("ecosystem_click_events_user_id_idx").on(table.userId)],
);
export type EcosystemClickEvent = typeof ecosystemClickEvents.$inferSelect;
export type InsertEcosystemClickEvent = typeof ecosystemClickEvents.$inferInsert;

export const ecosystemProposalRequestsEcosystemEnum = pgEnum("ecosystem_proposal_requests_ecosystem", [
  "growth",
  "elite",
  "custom",
]);
export const ecosystemProposalRequestsStatusEnum = pgEnum("ecosystem_proposal_requests_status", [
  "new",
  "qualified",
  "in_review",
  "sent",
  "won",
  "lost",
]);

export const ecosystemProposalRequests = pgTable(
  "ecosystem_proposal_requests",
  {
    id: serial("id").primaryKey(),
    ecosystem: ecosystemProposalRequestsEcosystemEnum("ecosystem").notNull(),
    fullName: varchar("fullName", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    company: varchar("company", { length: 200 }),
    phone: varchar("phone", { length: 64 }),
    message: text("message"),
    goals: text("goals"),
    source: varchar("source", { length: 64 }).notNull().default("solutions"),
    status: ecosystemProposalRequestsStatusEnum("status").default("new").notNull(),
    leadId: integer("leadId").references(() => leads.id),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [index("ecosystem_proposal_requests_lead_id_idx").on(table.leadId)],
);
export type EcosystemProposalRequest = typeof ecosystemProposalRequests.$inferSelect;
export type InsertEcosystemProposalRequest = typeof ecosystemProposalRequests.$inferInsert;

export const customDiscoverySessionsPreferredNextEnum = pgEnum("custom_discovery_sessions_preferred_next", [
  "ai-scan",
  "strategy-call",
  "proposal",
]);
export const customDiscoverySessionsStatusEnum = pgEnum("custom_discovery_sessions_status", [
  "in_progress",
  "submitted",
  "abandoned",
]);

export const customDiscoverySessions = pgTable(
  "custom_discovery_sessions",
  {
    id: serial("id").primaryKey(),
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
    preferredNext: customDiscoverySessionsPreferredNextEnum("preferredNext"),
    status: customDiscoverySessionsStatusEnum("status").default("in_progress").notNull(),
    leadId: integer("leadId").references(() => leads.id),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    submittedAt: timestamp("submittedAt"),
  },
  (table) => [index("custom_discovery_sessions_lead_id_idx").on(table.leadId)],
);
export type CustomDiscoverySession = typeof customDiscoverySessions.$inferSelect;
export type InsertCustomDiscoverySession = typeof customDiscoverySessions.$inferInsert;

/* ─────────────────────────────────────────────────────────────────────────────
 *  LEGAL, COMPLIANCE & CONSENT INFRASTRUCTURE
 *
 *  Versioning model: every legal text is a row in `legal_documents`.
 *  Each publication of that text is a row in `agreement_versions`. Acceptance
 *  rows in `agreement_acceptances` reference an `agreement_versions.id` so we
 *  always know exactly which body of text the user consented to.
 * ────────────────────────────────────────────────────────────────────────── */

export const legalDocumentsStatusEnum = pgEnum("legal_documents_status", ["active", "draft", "retired"]);

export const legalDocuments = pgTable("legal_documents", {
  id: serial("id").primaryKey(),
  /** Stable machine identifier. */
  kind: varchar("kind", { length: 64 }).notNull().unique(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  jurisdiction: varchar("jurisdiction", { length: 32 }),
  defaultLanguage: varchar("defaultLanguage", { length: 8 }).default("en").notNull(),
  status: legalDocumentsStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type InsertLegalDocument = typeof legalDocuments.$inferInsert;

/**
 * One row per published version of a legal document. Cascade with the
 * parent document — a version has no independent meaning.
 */
export const agreementVersionsStatusEnum = pgEnum("agreement_versions_status", [
  "draft",
  "published",
  "superseded",
]);

export const agreementVersions = pgTable(
  "agreement_versions",
  {
    id: serial("id").primaryKey(),
    documentId: integer("documentId")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 32 }).notNull(),
    language: varchar("language", { length: 8 }).default("en").notNull(),
    bodyMd: text("bodyMd").notNull(),
    /** SHA-256 hex of bodyMd at publish time. */
    bodyHash: varchar("bodyHash", { length: 128 }).notNull(),
    effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
    status: agreementVersionsStatusEnum("status").default("published").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    createdBy: integer("createdBy").references(() => users.id),
  },
  (table) => [index("agreement_versions_document_id_idx").on(table.documentId)],
);
export type AgreementVersion = typeof agreementVersions.$inferSelect;
export type InsertAgreementVersion = typeof agreementVersions.$inferInsert;

/**
 * Each time a user accepts (or re-accepts) a specific version of a document
 * we record it here. Compliance record — NO cascade from users/organizations
 * (⚠ REQUIRES VERIFICATION: same retention question as the audit tables).
 */
export const agreementAcceptances = pgTable(
  "agreement_acceptances",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id),
    organizationId: integer("organizationId").references(() => organizations.id),
    versionId: integer("versionId")
      .notNull()
      .references(() => agreementVersions.id),
    documentKind: varchar("documentKind", { length: 64 }).notNull(),
    acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    /** signup | login-revalidation | ai-scan | booking | proposal | dev-onboarding | manual */
    method: varchar("method", { length: 64 }).notNull(),
  },
  (table) => [
    index("agreement_acceptances_user_id_idx").on(table.userId),
    index("agreement_acceptances_version_id_idx").on(table.versionId),
  ],
);
export type AgreementAcceptance = typeof agreementAcceptances.$inferSelect;
export type InsertAgreementAcceptance = typeof agreementAcceptances.$inferInsert;

/**
 * Cookie consent records. Categories stored as JSON-encoded text (portable
 * across dialects; a future improvement is native jsonb, out of scope here
 * to avoid an unrequested behavior change during the migration). Compliance
 * record — NO cascade from users.
 */
export const cookieConsents = pgTable(
  "cookie_consents",
  {
    id: serial("id").primaryKey(),
    /** "user:<id>" for known users, "anon:<uuid>" for visitors. */
    subjectKey: varchar("subjectKey", { length: 96 }).notNull(),
    userId: integer("userId").references(() => users.id),
    policyVersionId: integer("policyVersionId").references(() => agreementVersions.id),
    /** JSON: { functional: bool, analytics: bool, marketing: bool, ... } */
    categoriesJson: text("categoriesJson").notNull(),
    /** "accepted-all" | "rejected-all" | "custom" */
    decision: varchar("decision", { length: 32 }).notNull(),
    acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
  },
  (table) => [index("cookie_consents_user_id_idx").on(table.userId)],
);
export type CookieConsent = typeof cookieConsents.$inferSelect;
export type InsertCookieConsent = typeof cookieConsents.$inferInsert;

/**
 * Acknowledgements weaker than full acceptance. NO cascade from users
 * (compliance-adjacent).
 */
export const legalAcknowledgements = pgTable(
  "legal_acknowledgements",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").references(() => users.id),
    documentKind: varchar("documentKind", { length: 64 }).notNull(),
    versionId: integer("versionId").references(() => agreementVersions.id),
    context: varchar("context", { length: 96 }).notNull(),
    acknowledgedAt: timestamp("acknowledgedAt").defaultNow().notNull(),
    ip: varchar("ip", { length: 64 }),
  },
  (table) => [index("legal_acknowledgements_user_id_idx").on(table.userId)],
);
export type LegalAcknowledgement = typeof legalAcknowledgements.$inferSelect;
export type InsertLegalAcknowledgement = typeof legalAcknowledgements.$inferInsert;

/**
 * AI Scan completed scans — questionnaire responses + LLM-generated
 * executive report. leadId is nullable/unreferenced-on-delete since the
 * anonymous free-tier flow may never create a lead at all.
 */
export const aiScansTierEnum = pgEnum("ai_scans_tier", ["free", "growth", "elite"]);
export const aiScansStatusEnum = pgEnum("ai_scans_status", ["pending", "scoring", "ready", "failed"]);

export const aiScans = pgTable(
  "ai_scans",
  {
    id: serial("id").primaryKey(),
    /** Unguessable token used in public report URLs. ~32 hex chars. */
    reportToken: varchar("reportToken", { length: 64 }).notNull().unique(),
    tier: aiScansTierEnum("tier").notNull(),
    /** Optional CRM lead link (created at submission for non-anonymous flow). */
    leadId: integer("leadId").references(() => leads.id),
    fullName: varchar("fullName", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    company: varchar("company", { length: 200 }),
    /** Locale used at intake (so report renders in same language). */
    locale: varchar("locale", { length: 8 }).default("en").notNull(),
    /** Questionnaire responses — JSON-serialized AiScanResponses. */
    responses: text("responses").notNull(),
    status: aiScansStatusEnum("status").default("pending").notNull(),
    /** Executive report payload — JSON-serialized AiScanReportPayload. Null until ready. */
    reportPayload: text("reportPayload"),
    /** Overall score, denormalized for fast indexing/sorting. */
    overallScore: integer("overallScore"),
    /** Storage key for the cached executive PDF. */
    reportPdfKey: varchar("reportPdfKey", { length: 256 }),
    errorMessage: text("errorMessage"),
    utmSource: varchar("utmSource", { length: 120 }),
    utmCampaign: varchar("utmCampaign", { length: 120 }),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    scoredAt: timestamp("scoredAt"),
  },
  (table) => [
    index("ai_scans_lead_id_idx").on(table.leadId),
    index("ai_scans_status_idx").on(table.status),
  ],
);

export type AiScan = typeof aiScans.$inferSelect;
export type InsertAiScan = typeof aiScans.$inferInsert;
