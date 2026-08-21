CREATE TYPE "public"."workflow_definitions_action_type" AS ENUM('notify_owner', 'audit_log');--> statement-breakpoint
CREATE TYPE "public"."workflow_definitions_trigger_type" AS ENUM('document_approved', 'document_rejected', 'booking_completed', 'lead_won', 'ai_scan_completed');--> statement-breakpoint
CREATE TYPE "public"."workflow_runs_status" AS ENUM('succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"triggerType" "workflow_definitions_trigger_type" NOT NULL,
	"actionType" "workflow_definitions_action_type" NOT NULL,
	"actionConfig" text,
	"enabled" integer DEFAULT 1 NOT NULL,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflowDefinitionId" integer NOT NULL,
	"triggerType" "workflow_definitions_trigger_type" NOT NULL,
	"triggerEntityRef" varchar(128),
	"status" "workflow_runs_status" NOT NULL,
	"resultMessage" text,
	"ranAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflowDefinitionId_workflow_definitions_id_fk" FOREIGN KEY ("workflowDefinitionId") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_definitions_trigger_type_idx" ON "workflow_definitions" USING btree ("triggerType");--> statement-breakpoint
CREATE INDEX "workflow_runs_definition_id_idx" ON "workflow_runs" USING btree ("workflowDefinitionId");--> statement-breakpoint
CREATE INDEX "workflow_runs_ran_at_idx" ON "workflow_runs" USING btree ("ranAt");
--> statement-breakpoint

-- Milestone 2 §2.6: workflow engine RLS. Definitions are platform
-- configuration (RM-57 names this category super_admin-exclusive, same
-- reasoning as 0009/0011's write-tightening); runs are an execution log
-- an admin should be able to read for visibility (not just super_admin -
-- this is operational, not configuration) but never write directly (only
-- the executor writes runs, via the service-role connection which bypasses
-- RLS the same way every other server-side write in this app does).
ALTER TABLE "workflow_definitions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_definitions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "workflow_definitions_select_admin" ON "workflow_definitions" FOR SELECT
  USING (app_is_admin());
--> statement-breakpoint
CREATE POLICY "workflow_definitions_write_super_admin_only" ON "workflow_definitions" FOR ALL
  USING (app_is_super_admin())
  WITH CHECK (app_is_super_admin());
--> statement-breakpoint
CREATE POLICY "workflow_runs_select_admin" ON "workflow_runs" FOR SELECT
  USING (app_is_admin());
--> statement-breakpoint
CREATE POLICY "workflow_runs_write_admin_only" ON "workflow_runs" FOR ALL
  USING (app_is_admin())
  WITH CHECK (app_is_admin());