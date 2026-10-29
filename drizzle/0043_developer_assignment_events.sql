-- Developer assignment history (task J04). NOT applied by this repository.
-- Additive only: one new table, no existing table is altered. Until it is applied, the existing assign and
-- unassign operations carry on without recording history (the insert is best effort inside a savepoint), and
-- the new reassign and replace operations are refused rather than run without a record. Independent of 0037 to 0042.
CREATE TABLE IF NOT EXISTS "developer_assignment_events" (
  "id" serial PRIMARY KEY,
  "projectId" integer NOT NULL REFERENCES "developer_projects"("id") ON DELETE CASCADE,
  "taskId" integer REFERENCES "developer_tasks"("id") ON DELETE CASCADE,
  "developerId" integer NOT NULL REFERENCES "developer_profiles"("id") ON DELETE CASCADE,
  "counterpartDeveloperId" integer REFERENCES "developer_profiles"("id") ON DELETE SET NULL,
  "event" varchar(20) NOT NULL,
  "actorUserId" integer REFERENCES "users"("id"),
  "reason" varchar(500),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "developer_assignment_events_event_check" CHECK ("event" IN ('assigned','released','reassigned_out','reassigned_in','replaced_out','replaced_in'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "developer_assignment_events_task_idx" ON "developer_assignment_events" ("taskId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "developer_assignment_events_project_idx" ON "developer_assignment_events" ("projectId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "developer_assignment_events_developer_idx" ON "developer_assignment_events" ("developerId", "createdAt");
--> statement-breakpoint
ALTER TABLE "developer_assignment_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_assignment_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_append_only ON "developer_assignment_events";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "developer_assignment_events" FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
