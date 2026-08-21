-- Milestone 2 §2.7: notification infrastructure schema extension.
-- client_notifications/developer_notifications already had kind/title/
-- body/href("action-URL")/readAt — this adds priority/channel/templateKey/
-- status. No new RLS policies needed: 0004_rls_policies.sql's existing
-- "own org/developer can SELECT+UPDATE, admin-only INSERT/DELETE" policies
-- on both tables already cover these new columns (RLS is table-scoped, not
-- column-scoped) — the "own org can UPDATE" policy is exactly what backs
-- the new mark-as-read/archive mutations added alongside this migration.
--
-- IMPORTANT — apply/verify note: authored with no live database access
-- (the connected Supabase project is unreachable, see
-- MILESTONE2_PROGRESS.md). Not applied or live-verified.

CREATE TYPE "public"."notifications_channel" AS ENUM('in_app', 'in_app_and_email');--> statement-breakpoint
CREATE TYPE "public"."notifications_priority" AS ENUM('low', 'normal', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notifications_status" AS ENUM('active', 'archived');--> statement-breakpoint
ALTER TYPE "public"."email_message_type" ADD VALUE IF NOT EXISTS 'notification';--> statement-breakpoint
ALTER TABLE "client_notifications" ADD COLUMN "priority" "notifications_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_notifications" ADD COLUMN "channel" "notifications_channel" DEFAULT 'in_app' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_notifications" ADD COLUMN "templateKey" varchar(64);--> statement-breakpoint
ALTER TABLE "client_notifications" ADD COLUMN "status" "notifications_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "developer_notifications" ADD COLUMN "priority" "notifications_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "developer_notifications" ADD COLUMN "channel" "notifications_channel" DEFAULT 'in_app' NOT NULL;--> statement-breakpoint
ALTER TABLE "developer_notifications" ADD COLUMN "templateKey" varchar(64);--> statement-breakpoint
ALTER TABLE "developer_notifications" ADD COLUMN "status" "notifications_status" DEFAULT 'active' NOT NULL;