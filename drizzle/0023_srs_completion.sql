-- SRS completion: the tables Master SRS v1.1 requires that did not exist.
--
-- Covers time registration (11.8), CRM opportunities, proposals and activities
-- (14.8 to 14.12), quotations and subscriptions (16), notification preferences
-- (17), an admin notification source (12.15), project approvals (15.13), the
-- AI registry, prompt versions and execution history (19), configuration
-- history (24), incidents and alert rules (20, 25), and scheduled reports (21).
--
-- Every table is CREATE IF NOT EXISTS so the file is safe to re-run. Status
-- columns are varchar, not enums, so a new state never needs ALTER TYPE.
--
-- AUDIT IMMUTABILITY (BR-020, SRS 20)
-- Section at the end. UPDATE is always refused. DELETE is refused only when it
-- is issued directly: pg_trigger_depth() is 0 for a direct statement and above
-- 0 when the delete is the cascade of a foreign key, which is how
-- booking_audit rows legitimately disappear with their booking. A naive
-- BEFORE DELETE trigger would have made deleting any booking impossible.

CREATE TABLE IF NOT EXISTS "developer_time_entries" (
  "id" serial PRIMARY KEY,
  "developerId" integer NOT NULL REFERENCES "developer_profiles"("id") ON DELETE CASCADE,
  "projectId" integer NOT NULL REFERENCES "developer_projects"("id") ON DELETE CASCADE,
  "taskId" integer REFERENCES "developer_tasks"("id") ON DELETE SET NULL,
  "workDate" date NOT NULL,
  "minutes" integer NOT NULL CHECK ("minutes" > 0 AND "minutes" <= 1440),
  "note" text,
  -- submitted | approved | rejected
  "status" varchar(24) DEFAULT 'submitted' NOT NULL,
  "reviewedByUserId" integer REFERENCES "users"("id"),
  "reviewedAt" timestamp,
  "reviewNote" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "developer_time_entries_dev_idx" ON "developer_time_entries" ("developerId", "workDate");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "developer_time_entries_project_idx" ON "developer_time_entries" ("projectId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "crm_opportunities" (
  "id" serial PRIMARY KEY,
  "title" varchar(200) NOT NULL,
  "leadId" integer REFERENCES "leads"("id") ON DELETE SET NULL,
  "organizationId" integer REFERENCES "organizations"("id") ON DELETE SET NULL,
  -- qualification | discovery | proposal | negotiation | won | lost
  "stage" varchar(24) DEFAULT 'qualification' NOT NULL,
  "valueCents" bigint DEFAULT 0 NOT NULL,
  "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  "ownerUserId" integer REFERENCES "users"("id"),
  "expectedCloseDate" date,
  "lostReason" text,
  -- BR: a won opportunity creates a project handover (SRS 14.8, 14.15).
  "handoverClientProjectId" integer REFERENCES "client_projects"("id") ON DELETE SET NULL,
  "closedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_opportunities_stage_idx" ON "crm_opportunities" ("stage");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "crm_proposals" (
  "id" serial PRIMARY KEY,
  "opportunityId" integer NOT NULL REFERENCES "crm_opportunities"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  -- draft | sent | accepted | rejected | expired
  "status" varchar(24) DEFAULT 'draft' NOT NULL,
  "amountCents" bigint DEFAULT 0 NOT NULL,
  "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  "validUntil" date,
  "body" text,
  "sentAt" timestamp,
  "decidedAt" timestamp,
  "createdByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_proposals_opp_idx" ON "crm_proposals" ("opportunityId");
--> statement-breakpoint

-- One timeline source for a customer: calls, emails, meetings, notes and
-- follow ups (SRS 14.9, 14.10).
CREATE TABLE IF NOT EXISTS "crm_activities" (
  "id" serial PRIMARY KEY,
  -- call | email | meeting | note | follow_up
  "kind" varchar(24) NOT NULL,
  "subject" varchar(200) NOT NULL,
  "body" text,
  "leadId" integer REFERENCES "leads"("id") ON DELETE CASCADE,
  "opportunityId" integer REFERENCES "crm_opportunities"("id") ON DELETE CASCADE,
  "organizationId" integer REFERENCES "organizations"("id") ON DELETE CASCADE,
  "dueAt" timestamp,
  "completedAt" timestamp,
  "createdByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_lead_idx" ON "crm_activities" ("leadId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_opp_idx" ON "crm_activities" ("opportunityId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_open_followups_idx" ON "crm_activities" ("dueAt") WHERE "completedAt" IS NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "quotes" (
  "id" serial PRIMARY KEY,
  "publicRef" varchar(32) NOT NULL UNIQUE,
  "organizationId" integer REFERENCES "organizations"("id") ON DELETE SET NULL,
  "opportunityId" integer REFERENCES "crm_opportunities"("id") ON DELETE SET NULL,
  "title" varchar(200) NOT NULL,
  -- JSON text: [{description, quantity, unitCents}]
  "linesJson" text DEFAULT '[]' NOT NULL,
  "totalCents" bigint DEFAULT 0 NOT NULL,
  "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  -- draft | sent | accepted | rejected | expired
  "status" varchar(24) DEFAULT 'draft' NOT NULL,
  "validUntil" date,
  "createdByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" serial PRIMARY KEY,
  "organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "plan" varchar(96) NOT NULL,
  -- active | paused | past_due | cancelled
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "amountCents" bigint DEFAULT 0 NOT NULL,
  "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  -- monthly | quarterly | yearly
  "billingInterval" varchar(16) DEFAULT 'monthly' NOT NULL,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "renewsAt" timestamp,
  "cancelledAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_org_idx" ON "subscriptions" ("organizationId");
--> statement-breakpoint

-- User notification preferences (SRS 17.11). Security notifications cannot be
-- switched off: the delivery resolver ignores a false here for the security
-- category (SRS 17.13), so the row is allowed to exist but never honoured.
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- account | project | billing | support | marketing | security
  "category" varchar(32) NOT NULL,
  -- email | in_app
  "channel" varchar(16) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_unique_idx"
  ON "notification_preferences" ("userId", "category", "channel");
--> statement-breakpoint

-- Admin notification source. Until now an admin had no bell: a lead, a
-- failed webhook or a security alert only ever reached the owner mailbox.
CREATE TABLE IF NOT EXISTS "admin_notifications" (
  "id" serial PRIMARY KEY,
  "kind" varchar(64) NOT NULL,
  "title" varchar(200) NOT NULL,
  "body" text,
  "href" varchar(256),
  -- low | normal | high | critical
  "priority" varchar(16) DEFAULT 'normal' NOT NULL,
  "readAt" timestamp,
  "readByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_notifications_unread_idx" ON "admin_notifications" ("createdAt") WHERE "readAt" IS NULL;
--> statement-breakpoint

-- BR-019: customer approval gate on a project phase or milestone.
CREATE TABLE IF NOT EXISTS "project_approvals" (
  "id" serial PRIMARY KEY,
  "projectId" integer NOT NULL REFERENCES "client_projects"("id") ON DELETE CASCADE,
  "milestoneId" integer REFERENCES "client_project_milestones"("id") ON DELETE SET NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  -- pending | approved | rejected
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "requestedByUserId" integer REFERENCES "users"("id"),
  "decidedByUserId" integer REFERENCES "users"("id"),
  "decisionNote" text,
  "decidedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_approvals_project_idx" ON "project_approvals" ("projectId", "status");
--> statement-breakpoint

-- AI Intelligence Layer (SRS 19). The registry is what makes "agents operate
-- according to assigned permissions" checkable: an agent can only perform an
-- action listed in its permissionsJson, and requiresHumanApproval holds its
-- output until a person releases it (BR-009).
CREATE TABLE IF NOT EXISTS "ai_agents" (
  "id" serial PRIMARY KEY,
  "key" varchar(64) NOT NULL UNIQUE,
  "name" varchar(120) NOT NULL,
  "purpose" text,
  -- active | disabled
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "permissionsJson" text DEFAULT '[]' NOT NULL,
  "requiresHumanApproval" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_prompt_versions" (
  "id" serial PRIMARY KEY,
  "agentKey" varchar(64) NOT NULL REFERENCES "ai_agents"("key") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "body" text NOT NULL,
  "changeNote" text,
  "isActive" boolean DEFAULT false NOT NULL,
  "createdByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_prompt_versions_unique_idx" ON "ai_prompt_versions" ("agentKey", "version");
--> statement-breakpoint
-- Exactly one active prompt per agent.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_prompt_versions_one_active_idx"
  ON "ai_prompt_versions" ("agentKey") WHERE "isActive";
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_executions" (
  "id" serial PRIMARY KEY,
  "agentKey" varchar(64) NOT NULL,
  "promptVersion" integer,
  "action" varchar(96) NOT NULL,
  "subjectRef" varchar(128),
  -- completed | failed | blocked_by_permission | awaiting_approval | approved | rejected
  "outcome" varchar(32) NOT NULL,
  "detail" text,
  "approvedByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_executions_agent_idx" ON "ai_executions" ("agentKey", "createdAt");
--> statement-breakpoint

-- Configuration history (SRS 24.9). One row per attempted change, including
-- the ones refused by validation, so the trail shows what was tried.
CREATE TABLE IF NOT EXISTS "config_history" (
  "id" serial PRIMARY KEY,
  "settingKey" varchar(128) NOT NULL,
  "oldValue" text,
  "newValue" text NOT NULL,
  -- applied | rejected
  "outcome" varchar(16) NOT NULL,
  "reason" text,
  "changedByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "config_history_key_idx" ON "config_history" ("settingKey", "createdAt");
--> statement-breakpoint

-- One register for security incidents (SRS 20.10) and operational incidents
-- (SRS 25.9): register, classify, assign, close.
CREATE TABLE IF NOT EXISTS "incidents" (
  "id" serial PRIMARY KEY,
  -- security | operational
  "category" varchar(16) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  -- low | medium | high | critical
  "severity" varchar(16) DEFAULT 'medium' NOT NULL,
  -- open | investigating | resolved | closed
  "status" varchar(16) DEFAULT 'open' NOT NULL,
  "assignedToUserId" integer REFERENCES "users"("id"),
  "resolution" text,
  "reportedByUserId" integer REFERENCES "users"("id"),
  "closedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_open_idx" ON "incidents" ("category", "status");
--> statement-breakpoint

-- Threshold alert rules (SRS 20.11, 22.12). Evaluated by the alert engine;
-- a firing raises an admin notification and, for security metrics, an incident.
CREATE TABLE IF NOT EXISTS "alert_rules" (
  "id" serial PRIMARY KEY,
  "key" varchar(64) NOT NULL UNIQUE,
  "title" varchar(200) NOT NULL,
  -- failed_logins | webhook_failures | email_failures | open_critical_incidents
  "metric" varchar(48) NOT NULL,
  "threshold" integer NOT NULL CHECK ("threshold" > 0),
  "windowMinutes" integer DEFAULT 60 NOT NULL CHECK ("windowMinutes" > 0),
  "severity" varchar(16) DEFAULT 'high' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "lastFiredAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "scheduled_reports" (
  "id" serial PRIMARY KEY,
  "name" varchar(160) NOT NULL,
  -- pipeline | billing | delivery | security
  "reportKind" varchar(32) NOT NULL,
  -- daily | weekly | monthly
  "cadence" varchar(16) NOT NULL,
  "recipientsJson" text DEFAULT '[]' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "nextRunAt" timestamp NOT NULL,
  "lastRunAt" timestamp,
  "lastStatus" varchar(16),
  "createdByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- updatedAt convention (0002/0017).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_opportunities','crm_proposals','quotes','subscriptions','ai_agents','incidents']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Audit immutability (SRS 20.12, BR-020)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_is_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit table % is append only: UPDATE refused', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- A cascade from a parent row runs inside the RI trigger, so the depth is
  -- above zero. A direct DELETE is depth zero and is refused.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'audit table % is append only: DELETE refused', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- developer_security_events is deliberately NOT here: it is an event queue whose
-- acknowledgedAt and acknowledgedByUserId are written when an admin reviews an
-- event, so an UPDATE refusal would break the Security Center.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'login_audit','developer_audit',
    'booking_audit','privacy_request_events','config_history','ai_executions'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_append_only ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION audit_is_append_only()', t);
  END LOOP;
END $$;

--> statement-breakpoint

-- Project archive policy (SRS 15.17): archived projects leave the active views but
-- are never deleted.
ALTER TABLE "client_projects" ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;
