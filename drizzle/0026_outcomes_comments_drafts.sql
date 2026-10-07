-- Discovery Call outcomes (SRS 14.7), developer task comments and clarification
-- requests (SRS 11.7), and resumable AI Scan questionnaires (SRS 9.7).
-- Idempotent. Every table gets RLS in this same file, following 0004 and 0024.

CREATE TABLE IF NOT EXISTS "booking_outcomes" (
  "id" serial PRIMARY KEY,
  "bookingId" integer NOT NULL UNIQUE REFERENCES "bookings"("id") ON DELETE CASCADE,
  -- qualified | not_a_fit | needs_follow_up | proposal_requested
  "outcome" varchar(32) NOT NULL,
  "notes" text,
  "followUpAt" timestamp,
  "recordedByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_outcomes_recorded_by_idx" ON "booking_outcomes" ("recordedByUserId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "developer_task_comments" (
  "id" serial PRIMARY KEY,
  "taskId" integer NOT NULL REFERENCES "developer_tasks"("id") ON DELETE CASCADE,
  -- Exactly one of these is set: a developer wrote it, or staff did.
  "developerId" integer REFERENCES "developer_profiles"("id") ON DELETE CASCADE,
  "authorUserId" integer REFERENCES "users"("id"),
  -- progress_note | comment | clarification_request
  "kind" varchar(24) NOT NULL,
  "body" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CHECK (("developerId" IS NOT NULL) <> ("authorUserId" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "developer_task_comments_task_idx" ON "developer_task_comments" ("taskId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "developer_task_comments_developer_idx" ON "developer_task_comments" ("developerId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "developer_task_comments_author_idx" ON "developer_task_comments" ("authorUserId");
--> statement-breakpoint

-- A draft questionnaire. The resume token is the only way back to it, so it is
-- unguessable and the row expires; answers are removed when the scan is
-- submitted. Holds personal data, so it is deleted rather than kept.
CREATE TABLE IF NOT EXISTS "ai_scan_drafts" (
  "id" serial PRIMARY KEY,
  "resumeToken" varchar(64) NOT NULL UNIQUE,
  "tier" varchar(16) NOT NULL,
  "email" varchar(320),
  "answersJson" text DEFAULT '{}' NOT NULL,
  "stepIndex" integer DEFAULT 0 NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_scan_drafts_expires_idx" ON "ai_scan_drafts" ("expiresAt");
--> statement-breakpoint

DROP TRIGGER IF EXISTS set_updated_at ON "ai_scan_drafts";
--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "ai_scan_drafts"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['booking_outcomes','developer_task_comments','ai_scan_drafts']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin())', t || '_admin_all', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- A developer reads the comments on tasks they hold.
DROP POLICY IF EXISTS "developer_task_comments_select_assigned" ON "developer_task_comments";
--> statement-breakpoint
CREATE POLICY "developer_task_comments_select_assigned" ON "developer_task_comments" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "developer_task_assignments" a
    WHERE a."taskId" = "developer_task_comments"."taskId"
      AND a."developerId" = app_current_developer_id()
  ));
