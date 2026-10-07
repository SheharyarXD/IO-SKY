-- More workflow triggers and scheduled workflows (SRS 23.9, 23.10).
--
-- New event triggers join the existing five, and a `schedule` trigger runs a
-- definition on a cadence. ALTER TYPE ... ADD VALUE is idempotent with IF NOT
-- EXISTS and is not used again inside this file, which Postgres requires.

ALTER TYPE "workflow_definitions_trigger_type" ADD VALUE IF NOT EXISTS 'schedule';
--> statement-breakpoint
ALTER TYPE "workflow_definitions_trigger_type" ADD VALUE IF NOT EXISTS 'opportunity_won';
--> statement-breakpoint
ALTER TYPE "workflow_definitions_trigger_type" ADD VALUE IF NOT EXISTS 'invoice_created';
--> statement-breakpoint
ALTER TYPE "workflow_definitions_trigger_type" ADD VALUE IF NOT EXISTS 'incident_created';
--> statement-breakpoint
ALTER TYPE "workflow_definitions_trigger_type" ADD VALUE IF NOT EXISTS 'approval_decided';
--> statement-breakpoint

-- daily | weekly | monthly. Only meaningful when the trigger is `schedule`.
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "scheduleCadence" varchar(16);
--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "nextRunAt" timestamp;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_definitions_next_run_idx" ON "workflow_definitions" ("nextRunAt") WHERE "nextRunAt" IS NOT NULL;
