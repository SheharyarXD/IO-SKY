-- Project lifecycle (SRS 15.5) with an append only stage history.
ALTER TABLE "client_projects" ADD COLUMN IF NOT EXISTS "lifecycle" varchar(24) NOT NULL DEFAULT 'created';
--> statement-breakpoint
UPDATE "client_projects" SET "lifecycle" = CASE
  WHEN "archivedAt" IS NOT NULL THEN 'archived'
  WHEN "status" = 'completed' THEN 'completed'
  WHEN "status" = 'planning' THEN 'planning'
  ELSE 'in_progress' END
WHERE "lifecycle" = 'created';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_lifecycle_events" (
  "id" serial PRIMARY KEY,
  "projectId" integer NOT NULL REFERENCES "client_projects"("id") ON DELETE CASCADE,
  "fromState" varchar(24),
  "toState" varchar(24) NOT NULL,
  "actorUserId" integer REFERENCES "users"("id"),
  "note" varchar(500),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_lifecycle_events_project_idx" ON "project_lifecycle_events" ("projectId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_lifecycle_events_actor_idx" ON "project_lifecycle_events" ("actorUserId");
--> statement-breakpoint
ALTER TABLE "project_lifecycle_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "project_lifecycle_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_append_only ON "project_lifecycle_events";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "project_lifecycle_events" FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
