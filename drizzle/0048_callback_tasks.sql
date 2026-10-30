-- Callback tasks (task R21). NOT applied by this repository.
-- Additive only: two new tables. Until this is applied callbacks cannot be created (the endpoints and the
-- receptionist tool refuse with an unavailable message) and the escalation sweep is a quiet no-op. Nothing
-- existing is affected. Independent of 0037 to 0047.
CREATE TABLE IF NOT EXISTS "callback_tasks" (
  "id" serial PRIMARY KEY,
  "leadId" integer REFERENCES "leads"("id") ON DELETE SET NULL,
  "organizationId" integer REFERENCES "organizations"("id") ON DELETE SET NULL,
  "callerName" varchar(200),
  "callerPhone" varchar(32) NOT NULL,
  "reason" varchar(500) NOT NULL,
  "source" varchar(24) NOT NULL DEFAULT 'manual',
  "priority" varchar(8) NOT NULL DEFAULT 'normal',
  "status" varchar(16) NOT NULL DEFAULT 'requested',
  "assignedToUserId" integer REFERENCES "users"("id"),
  "dueAt" timestamp NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "lastAttemptAt" timestamp,
  "escalationLevel" integer NOT NULL DEFAULT 0,
  "outcomeNote" varchar(500),
  "createdByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "closedAt" timestamp,
  CONSTRAINT "callback_tasks_status_check" CHECK ("status" IN ('requested','assigned','attempted','completed','unreachable','cancelled')),
  CONSTRAINT "callback_tasks_priority_check" CHECK ("priority" IN ('normal','urgent'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "callback_tasks_open_idx" ON "callback_tasks" ("status", "dueAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "callback_tasks_assignee_idx" ON "callback_tasks" ("assignedToUserId", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "callback_task_events" (
  "id" serial PRIMARY KEY,
  "taskId" integer NOT NULL REFERENCES "callback_tasks"("id") ON DELETE CASCADE,
  "event" varchar(40) NOT NULL,
  "actorUserId" integer REFERENCES "users"("id"),
  "detail" varchar(300),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "callback_task_events_task_idx" ON "callback_task_events" ("taskId", "createdAt");
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['callback_tasks','callback_task_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_append_only ON "callback_task_events";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "callback_task_events" FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
