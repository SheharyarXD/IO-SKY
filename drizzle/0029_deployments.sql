-- Release tracking (SRS 25.12). Each process start records which build is
-- running, so the platform can show when a release went live and what it
-- replaced. Append only like the other history tables.

CREATE TABLE IF NOT EXISTS "deployments" (
  "id" serial PRIMARY KEY,
  "commitSha" varchar(64),
  "environment" varchar(32) NOT NULL,
  "nodeVersion" varchar(32) NOT NULL,
  "startedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployments_started_idx" ON "deployments" ("startedAt");
--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_append_only ON "deployments";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "deployments"
  FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
--> statement-breakpoint

ALTER TABLE "deployments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "deployments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "deployments_admin_all" ON "deployments";
--> statement-breakpoint
CREATE POLICY "deployments_admin_all" ON "deployments" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
