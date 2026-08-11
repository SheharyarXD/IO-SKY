CREATE TYPE "public"."agreement_versions_status" AS ENUM('draft', 'published', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."ai_scans_status" AS ENUM('pending', 'scoring', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_scans_tier" AS ENUM('free', 'growth', 'elite');--> statement-breakpoint
CREATE TYPE "public"."availability_windows_kind" AS ENUM('open', 'close');--> statement-breakpoint
CREATE TYPE "public"."booking_reminders_kind" AS ENUM('confirmation', 'reminder_24h', 'reminder_1h', 'reschedule', 'cancellation');--> statement-breakpoint
CREATE TYPE "public"."booking_slots_status" AS ENUM('held', 'booked', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."bookings_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."client_invoices_status" AS ENUM('draft', 'open', 'paid', 'overdue', 'void');--> statement-breakpoint
CREATE TYPE "public"."client_messages_sender" AS ENUM('io-sky', 'client');--> statement-breakpoint
CREATE TYPE "public"."client_project_milestones_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."client_projects_status" AS ENUM('planning', 'active', 'on_hold', 'completed');--> statement-breakpoint
CREATE TYPE "public"."client_recommendations_impact" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."client_recommendations_status" AS ENUM('pending', 'in_progress', 'completed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."client_reports_status" AS ENUM('draft', 'ready', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."client_support_tickets_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."client_support_tickets_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."contact_submissions_status" AS ENUM('new', 'responded', 'closed', 'spam');--> statement-breakpoint
CREATE TYPE "public"."custom_discovery_sessions_preferred_next" AS ENUM('ai-scan', 'strategy-call', 'proposal');--> statement-breakpoint
CREATE TYPE "public"."custom_discovery_sessions_status" AS ENUM('in_progress', 'submitted', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."dev_applications_status" AS ENUM('pending', 'in_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."developer_access_requests_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."developer_access_scopes_level" AS ENUM('baseline', 'extended', 'elevated');--> statement-breakpoint
CREATE TYPE "public"."developer_access_scopes_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."developer_agreements_status" AS ENUM('draft', 'pending', 'signed');--> statement-breakpoint
CREATE TYPE "public"."developer_messages_sender" AS ENUM('admin', 'developer');--> statement-breakpoint
CREATE TYPE "public"."developer_profiles_availability" AS ENUM('available', 'limited', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."developer_profiles_status" AS ENUM('active', 'suspended', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."developer_project_assignments_role" AS ENUM('lead', 'contributor', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."developer_project_assignments_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."developer_projects_status" AS ENUM('planning', 'active', 'on_hold', 'completed');--> statement-breakpoint
CREATE TYPE "public"."developer_security_events_severity" AS ENUM('info', 'warn', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."developer_submissions_kind" AS ENUM('submission', 'commit');--> statement-breakpoint
CREATE TYPE "public"."developer_submissions_status" AS ENUM('pending', 'in_review', 'accepted', 'changes_requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."developer_support_tickets_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."developer_support_tickets_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."developer_task_assignments_status" AS ENUM('active', 'released');--> statement-breakpoint
CREATE TYPE "public"."developer_tasks_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."developer_tasks_status" AS ENUM('planned', 'in_progress', 'blocked', 'in_review', 'done');--> statement-breakpoint
CREATE TYPE "public"."ecosystem_proposal_requests_ecosystem" AS ENUM('growth', 'elite', 'custom');--> statement-breakpoint
CREATE TYPE "public"."ecosystem_proposal_requests_status" AS ENUM('new', 'qualified', 'in_review', 'sent', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."leads_status" AS ENUM('new', 'qualified', 'engaged', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."legal_documents_status" AS ENUM('active', 'draft', 'retired');--> statement-breakpoint
CREATE TYPE "public"."mfa_challenges_expected_kind" AS ENUM('totp', 'sms', 'any');--> statement-breakpoint
CREATE TYPE "public"."mfa_challenges_purpose" AS ENUM('login', 'enroll', 'step_up');--> statement-breakpoint
CREATE TYPE "public"."mfa_factors_kind" AS ENUM('totp', 'sms');--> statement-breakpoint
CREATE TYPE "public"."organization_memberships_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."users_role" AS ENUM('user', 'client', 'developer', 'admin');--> statement-breakpoint
CREATE TABLE "admin_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"consultationType" varchar(32) NOT NULL,
	"weekday" integer NOT NULL,
	"startMinute" integer NOT NULL,
	"endMinute" integer NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"organizationId" integer,
	"versionId" integer NOT NULL,
	"documentKind" varchar(64) NOT NULL,
	"acceptedAt" timestamp DEFAULT now() NOT NULL,
	"ip" varchar(64),
	"userAgent" text,
	"method" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"documentId" integer NOT NULL,
	"version" varchar(32) NOT NULL,
	"language" varchar(8) DEFAULT 'en' NOT NULL,
	"bodyMd" text NOT NULL,
	"bodyHash" varchar(128) NOT NULL,
	"effectiveFrom" timestamp DEFAULT now() NOT NULL,
	"status" "agreement_versions_status" DEFAULT 'published' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer
);
--> statement-breakpoint
CREATE TABLE "ai_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"reportToken" varchar(64) NOT NULL,
	"tier" "ai_scans_tier" NOT NULL,
	"leadId" integer,
	"fullName" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"company" varchar(200),
	"locale" varchar(8) DEFAULT 'en' NOT NULL,
	"responses" text NOT NULL,
	"status" "ai_scans_status" DEFAULT 'pending' NOT NULL,
	"reportPayload" text,
	"overallScore" integer,
	"reportPdfKey" varchar(256),
	"errorMessage" text,
	"utmSource" varchar(120),
	"utmCampaign" varchar(120),
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"scoredAt" timestamp,
	CONSTRAINT "ai_scans_reportToken_unique" UNIQUE("reportToken")
);
--> statement-breakpoint
CREATE TABLE "availability_windows" (
	"id" serial PRIMARY KEY NOT NULL,
	"consultationType" varchar(32),
	"kind" "availability_windows_kind" NOT NULL,
	"startMs" bigint NOT NULL,
	"endMs" bigint NOT NULL,
	"reason" varchar(200),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookingId" integer NOT NULL,
	"question" varchar(200) NOT NULL,
	"answer" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookingId" integer NOT NULL,
	"event" varchar(64) NOT NULL,
	"detail" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookingId" integer NOT NULL,
	"event" varchar(64) NOT NULL,
	"actorOpenId" varchar(128),
	"detail" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookingId" integer NOT NULL,
	"kind" "booking_reminders_kind" NOT NULL,
	"scheduledForMs" bigint NOT NULL,
	"sentAt" timestamp,
	"errorDetail" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"consultationType" varchar(32) NOT NULL,
	"slotStartMs" bigint NOT NULL,
	"slotEndMs" bigint NOT NULL,
	"status" "booking_slots_status" DEFAULT 'held' NOT NULL,
	"bookingId" integer,
	"holdToken" varchar(64),
	"holdExpiresAtMs" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"publicRef" varchar(32) NOT NULL,
	"serviceId" varchar(32) NOT NULL,
	"slotStartMs" bigint NOT NULL,
	"durationMin" integer NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"fullName" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"company" varchar(200),
	"roleTitle" varchar(120),
	"phone" varchar(64),
	"preparation" text,
	"note" text,
	"utmSource" varchar(120),
	"utmCampaign" varchar(120),
	"status" "bookings_status" DEFAULT 'confirmed' NOT NULL,
	"emailSent" integer DEFAULT 0 NOT NULL,
	"ownerNotified" integer DEFAULT 0 NOT NULL,
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_publicRef_unique" UNIQUE("publicRef")
);
--> statement-breakpoint
CREATE TABLE "calendar_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"startMs" bigint NOT NULL,
	"endMs" bigint NOT NULL,
	"label" varchar(200) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(96) DEFAULT 'general' NOT NULL,
	"fileKey" varchar(512) NOT NULL,
	"sizeBytes" integer,
	"mimeType" varchar(96),
	"uploadedByUserId" integer,
	"uploadedBy" varchar(200),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"number" varchar(32) NOT NULL,
	"description" varchar(200) NOT NULL,
	"amountCents" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'EUR' NOT NULL,
	"status" "client_invoices_status" DEFAULT 'open' NOT NULL,
	"issuedMs" bigint NOT NULL,
	"dueMs" bigint,
	"paidMs" bigint,
	"pdfKey" varchar(512),
	CONSTRAINT "client_invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "client_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"threadKey" varchar(64) NOT NULL,
	"sender" "client_messages_sender" NOT NULL,
	"senderName" varchar(200),
	"subject" varchar(200),
	"body" text NOT NULL,
	"readAt" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"href" varchar(512),
	"readAt" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_project_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"dueMs" bigint,
	"status" "client_project_milestones_status" DEFAULT 'pending' NOT NULL,
	"body" text
);
--> statement-breakpoint
CREATE TABLE "client_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"phase" varchar(96) DEFAULT 'Discovery' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"startMs" bigint,
	"targetMs" bigint,
	"status" "client_projects_status" DEFAULT 'active' NOT NULL,
	"summary" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"reportId" integer,
	"title" varchar(200) NOT NULL,
	"category" varchar(96) NOT NULL,
	"impact" "client_recommendations_impact" DEFAULT 'medium' NOT NULL,
	"status" "client_recommendations_status" DEFAULT 'pending' NOT NULL,
	"body" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"publicRef" varchar(32) NOT NULL,
	"title" varchar(200) NOT NULL,
	"scanType" varchar(32) DEFAULT 'ai-scan' NOT NULL,
	"score" integer NOT NULL,
	"delta" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"pdfKey" varchar(512),
	"status" "client_reports_status" DEFAULT 'ready' NOT NULL,
	"pages" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_reports_publicRef_unique" UNIQUE("publicRef")
);
--> statement-breakpoint
CREATE TABLE "client_support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"openedByUserId" integer,
	"publicRef" varchar(32) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"priority" "client_support_tickets_priority" DEFAULT 'normal' NOT NULL,
	"status" "client_support_tickets_status" DEFAULT 'open' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_support_tickets_publicRef_unique" UNIQUE("publicRef")
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"publicRef" varchar(32) NOT NULL,
	"fullName" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(64),
	"company" varchar(200),
	"industry" varchar(64),
	"size" varchar(64),
	"subject" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"status" "contact_submissions_status" DEFAULT 'new' NOT NULL,
	"emailSent" integer DEFAULT 0 NOT NULL,
	"ownerNotified" integer DEFAULT 0 NOT NULL,
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_submissions_publicRef_unique" UNIQUE("publicRef")
);
--> statement-breakpoint
CREATE TABLE "cookie_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"subjectKey" varchar(96) NOT NULL,
	"userId" integer,
	"policyVersionId" integer,
	"categoriesJson" text NOT NULL,
	"decision" varchar(32) NOT NULL,
	"acceptedAt" timestamp DEFAULT now() NOT NULL,
	"ip" varchar(64),
	"userAgent" text
);
--> statement-breakpoint
CREATE TABLE "custom_discovery_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"fullName" varchar(200),
	"email" varchar(320),
	"company" varchar(200),
	"phone" varchar(64),
	"needsTypes" text,
	"currentSystems" text,
	"teamSize" varchar(32),
	"growthStage" varchar(32),
	"complianceTags" text,
	"integrations" text,
	"timeline" varchar(32),
	"urgency" varchar(32),
	"preferredNext" "custom_discovery_sessions_preferred_next",
	"status" "custom_discovery_sessions_status" DEFAULT 'in_progress' NOT NULL,
	"leadId" integer,
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"submittedAt" timestamp,
	CONSTRAINT "custom_discovery_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "dev_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"publicRef" varchar(32) NOT NULL,
	"fullName" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(64),
	"company" varchar(200),
	"roleTitle" varchar(120),
	"yearsExperience" integer,
	"links" text,
	"message" text,
	"ackNda" integer DEFAULT 0 NOT NULL,
	"ackConfidentiality" integer DEFAULT 0 NOT NULL,
	"ackNonSolicitation" integer DEFAULT 0 NOT NULL,
	"status" "dev_applications_status" DEFAULT 'pending' NOT NULL,
	"reviewerNote" text,
	"ownerNotified" integer DEFAULT 0 NOT NULL,
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dev_applications_publicRef_unique" UNIQUE("publicRef")
);
--> statement-breakpoint
CREATE TABLE "developer_access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"developerId" integer NOT NULL,
	"scopeId" integer,
	"reason" text NOT NULL,
	"status" "developer_access_requests_status" DEFAULT 'pending' NOT NULL,
	"reviewerNote" text,
	"reviewedByUserId" integer,
	"reviewedMs" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_access_scopes" (
	"id" serial PRIMARY KEY NOT NULL,
	"developerId" integer NOT NULL,
	"level" "developer_access_scopes_level" DEFAULT 'baseline' NOT NULL,
	"allowedActions" text,
	"allowedRoutes" text,
	"startMs" bigint NOT NULL,
	"expiresMs" bigint,
	"status" "developer_access_scopes_status" DEFAULT 'active' NOT NULL,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"developerId" integer NOT NULL,
	"agreementType" varchar(64) NOT NULL,
	"version" varchar(32) NOT NULL,
	"status" "developer_agreements_status" DEFAULT 'pending' NOT NULL,
	"signedMs" bigint,
	"signedIp" varchar(64),
	"signedUserAgent" text,
	"documentKey" varchar(512),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"developerId" integer,
	"event" varchar(96) NOT NULL,
	"detail" text,
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"developerId" integer NOT NULL,
	"sender" "developer_messages_sender" NOT NULL,
	"senderName" varchar(200),
	"subject" varchar(200),
	"body" text NOT NULL,
	"readAt" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"developerId" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"href" varchar(512),
	"readAt" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"applicationId" integer,
	"fullName" varchar(200) NOT NULL,
	"country" varchar(64),
	"linkedin" varchar(320),
	"github" varchar(320),
	"portfolio" varchar(320),
	"specialties" varchar(320),
	"yearsExperience" integer,
	"availability" "developer_profiles_availability" DEFAULT 'available' NOT NULL,
	"status" "developer_profiles_status" DEFAULT 'active' NOT NULL,
	"mfaRequired" integer DEFAULT 1 NOT NULL,
	"approvedMs" bigint,
	"approvedByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "developer_profiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "developer_project_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"developerId" integer NOT NULL,
	"assignmentRole" "developer_project_assignments_role" DEFAULT 'contributor' NOT NULL,
	"status" "developer_project_assignments_status" DEFAULT 'active' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"startMs" bigint,
	"endMs" bigint,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_project_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"fileKey" varchar(512) NOT NULL,
	"sizeBytes" integer,
	"mimeType" varchar(96),
	"category" varchar(64) DEFAULT 'specification' NOT NULL,
	"uploadedByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"brief" text,
	"track" varchar(64) DEFAULT 'full-stack' NOT NULL,
	"status" "developer_projects_status" DEFAULT 'active' NOT NULL,
	"startMs" bigint,
	"targetMs" bigint,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "developer_projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "developer_security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"developerId" integer,
	"kind" varchar(64) NOT NULL,
	"severity" "developer_security_events_severity" DEFAULT 'warn' NOT NULL,
	"message" varchar(200) NOT NULL,
	"detail" text,
	"ip" varchar(64),
	"userAgent" text,
	"acknowledgedAt" bigint,
	"acknowledgedByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"developerId" integer NOT NULL,
	"kind" "developer_submissions_kind" DEFAULT 'submission' NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"fileKey" varchar(512),
	"repository" varchar(320),
	"sha" varchar(64),
	"branch" varchar(200),
	"status" "developer_submissions_status" DEFAULT 'pending' NOT NULL,
	"reviewerNote" text,
	"reviewedByUserId" integer,
	"reviewedMs" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"developerId" integer NOT NULL,
	"publicRef" varchar(32) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"priority" "developer_support_tickets_priority" DEFAULT 'normal' NOT NULL,
	"status" "developer_support_tickets_status" DEFAULT 'open' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "developer_support_tickets_publicRef_unique" UNIQUE("publicRef")
);
--> statement-breakpoint
CREATE TABLE "developer_task_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"taskId" integer NOT NULL,
	"developerId" integer NOT NULL,
	"status" "developer_task_assignments_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"status" "developer_tasks_status" DEFAULT 'planned' NOT NULL,
	"priority" "developer_tasks_priority" DEFAULT 'normal' NOT NULL,
	"dueMs" bigint,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ecosystem_click_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventKey" varchar(80) NOT NULL,
	"source" varchar(64) DEFAULT 'solutions' NOT NULL,
	"ecosystem" varchar(32),
	"sessionToken" varchar(64),
	"userId" integer,
	"ip" varchar(64),
	"userAgent" text,
	"payload" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ecosystem_proposal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"ecosystem" "ecosystem_proposal_requests_ecosystem" NOT NULL,
	"fullName" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"company" varchar(200),
	"phone" varchar(64),
	"message" text,
	"goals" text,
	"source" varchar(64) DEFAULT 'solutions' NOT NULL,
	"status" "ecosystem_proposal_requests_status" DEFAULT 'new' NOT NULL,
	"leadId" integer,
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(32) NOT NULL,
	"sourceId" integer,
	"fullName" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"company" varchar(200),
	"phone" varchar(64),
	"interest" varchar(64),
	"note" text,
	"status" "leads_status" DEFAULT 'new' NOT NULL,
	"utmSource" varchar(120),
	"utmCampaign" varchar(120),
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_acknowledgements" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"documentKind" varchar(64) NOT NULL,
	"versionId" integer,
	"context" varchar(96) NOT NULL,
	"acknowledgedAt" timestamp DEFAULT now() NOT NULL,
	"ip" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(64) NOT NULL,
	"slug" varchar(96) NOT NULL,
	"title" varchar(200) NOT NULL,
	"jurisdiction" varchar(32),
	"defaultLanguage" varchar(8) DEFAULT 'en' NOT NULL,
	"status" "legal_documents_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "legal_documents_kind_unique" UNIQUE("kind"),
	CONSTRAINT "legal_documents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "login_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"identifier" varchar(320),
	"provider" varchar(32) NOT NULL,
	"outcome" varchar(32) NOT NULL,
	"reason" varchar(200),
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"state" varchar(96) NOT NULL,
	"purpose" "mfa_challenges_purpose" DEFAULT 'login' NOT NULL,
	"expectedKind" "mfa_challenges_expected_kind" DEFAULT 'any' NOT NULL,
	"factorId" integer,
	"failedAttempts" integer DEFAULT 0 NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	"ip" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mfa_challenges_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "mfa_factors" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"kind" "mfa_factors_kind" NOT NULL,
	"label" varchar(120),
	"secret" text NOT NULL,
	"phoneHint" varchar(32),
	"verifiedAt" timestamp,
	"primary" integer DEFAULT 0 NOT NULL,
	"failedAttempts" integer DEFAULT 0 NOT NULL,
	"lockedUntilMs" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "mfa_recovery_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"codeHash" varchar(128) NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"membershipRole" "organization_memberships_role" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"legalName" varchar(200),
	"industry" varchar(64),
	"size" varchar(64),
	"country" varchar(64),
	"operationalScore" integer DEFAULT 72 NOT NULL,
	"accentHex" varchar(16),
	"statusLabel" varchar(64) DEFAULT 'Healthy' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "timezone_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"lastSeenAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"passwordHash" varchar(255),
	"organizationId" integer,
	"phone" varchar(64),
	"role" "users_role" DEFAULT 'user' NOT NULL,
	"mfaMethod" varchar(32) DEFAULT 'none' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
