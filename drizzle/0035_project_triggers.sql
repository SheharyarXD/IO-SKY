-- Project automation triggers (SRS 15.16). Fired when a project changes stage and when it completes.
ALTER TYPE "workflow_definitions_trigger_type" ADD VALUE IF NOT EXISTS 'project_stage_changed';
--> statement-breakpoint
ALTER TYPE "workflow_definitions_trigger_type" ADD VALUE IF NOT EXISTS 'project_completed';
