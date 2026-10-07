-- AI Scan report lifecycle (SRS 9.6, BR-009, BR-016).
--
-- Every report has exactly one of nine statuses and nothing is visible to the
-- customer until it is Published. This is separate from the existing
-- ai_scans.status (pending, scoring, ready, failed), which describes the engine
-- run, not the human review.
--
-- BACKFILL: scans that were already `ready` before this migration were visible
-- to their owners, so they become `published`. Hiding them now would make
-- delivered reports vanish. Anything else maps to its nearest earlier stage.

ALTER TABLE "ai_scans" ADD COLUMN IF NOT EXISTS "reportStatus" varchar(32);
--> statement-breakpoint
UPDATE "ai_scans" SET "reportStatus" = CASE "status"::text
  WHEN 'ready' THEN 'published'
  WHEN 'scoring' THEN 'ai_processing'
  ELSE 'submitted'
END WHERE "reportStatus" IS NULL;
--> statement-breakpoint
ALTER TABLE "ai_scans" ALTER COLUMN "reportStatus" SET DEFAULT 'submitted';
--> statement-breakpoint
ALTER TABLE "ai_scans" ALTER COLUMN "reportStatus" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_scans" ADD COLUMN IF NOT EXISTS "reviewerUserId" integer REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "ai_scans" ADD COLUMN IF NOT EXISTS "reviewNote" text;
--> statement-breakpoint
ALTER TABLE "ai_scans" ADD COLUMN IF NOT EXISTS "approvedByUserId" integer REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "ai_scans" ADD COLUMN IF NOT EXISTS "approvedAt" timestamp;
--> statement-breakpoint
ALTER TABLE "ai_scans" ADD COLUMN IF NOT EXISTS "publishedAt" timestamp;
--> statement-breakpoint
UPDATE "ai_scans" SET "publishedAt" = COALESCE("scoredAt", "updatedAt") WHERE "reportStatus" = 'published' AND "publishedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_scans_report_status_idx" ON "ai_scans" ("reportStatus");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_scans_reviewer_idx" ON "ai_scans" ("reviewerUserId");
--> statement-breakpoint

-- Append-only history of every status change, including the system's own.
CREATE TABLE IF NOT EXISTS "ai_scan_status_events" (
  "id" serial PRIMARY KEY,
  "scanId" integer NOT NULL REFERENCES "ai_scans"("id") ON DELETE CASCADE,
  "fromStatus" varchar(32),
  "toStatus" varchar(32) NOT NULL,
  -- Null for transitions the engine makes on its own.
  "actorUserId" integer REFERENCES "users"("id"),
  "note" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_scan_status_events_scan_idx" ON "ai_scan_status_events" ("scanId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_scan_status_events_actor_idx" ON "ai_scan_status_events" ("actorUserId");
--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_append_only ON "ai_scan_status_events";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "ai_scan_status_events"
  FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
--> statement-breakpoint

ALTER TABLE "ai_scan_status_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_scan_status_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "ai_scan_status_events_admin_all" ON "ai_scan_status_events";
--> statement-breakpoint
CREATE POLICY "ai_scan_status_events_admin_all" ON "ai_scan_status_events" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
