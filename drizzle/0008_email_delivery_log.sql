-- Milestone 2 §2.3: Email delivery tracking (delivery log + Resend webhook
-- handling), so email failures are visible instead of silently
-- disappearing. See drizzle/schema.ts's emailDeliveryLog table comment for
-- the full column rationale.
--
-- IMPORTANT — apply/verify note: authored in a session with no Supabase
-- credentials available (same limitation as 0006/0007 — see
-- MILESTONE1_SUPABASE_MIGRATION_REPORT.md §16 and MILESTONE2_PROGRESS.md
-- §2.1). Not applied to the live database.

CREATE TYPE "public"."email_message_type" AS ENUM ('booking-confirmation', 'contact-confirmation', 'devapp-ack', 'owner-alert');
--> statement-breakpoint
CREATE TYPE "public"."email_delivery_status" AS ENUM ('sent', 'delivered', 'bounced', 'complained', 'failed');
--> statement-breakpoint

CREATE TABLE "email_delivery_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "messageType" "email_message_type" NOT NULL,
  "transport" varchar(16) NOT NULL,
  "providerMessageId" varchar(255),
  "recipient" varchar(320) NOT NULL,
  "subject" varchar(500),
  "relatedRef" varchar(64),
  "status" "email_delivery_status" DEFAULT 'sent' NOT NULL,
  "errorMessage" text,
  "providerResponse" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "email_delivery_log_provider_message_id_idx" ON "email_delivery_log" USING btree ("providerMessageId");
--> statement-breakpoint
CREATE INDEX "email_delivery_log_status_idx" ON "email_delivery_log" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "email_delivery_log_created_at_idx" ON "email_delivery_log" USING btree ("createdAt");
--> statement-breakpoint

-- Same set_updated_at() trigger function every other updatedAt column in
-- this schema uses (declared in 0002_updated_at_triggers.sql).
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "email_delivery_log" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- RLS: admin-only, same pattern as login_audit/booking_audit — a
-- compliance/operational log, not tenant-scoped data, and only the
-- backend's privileged connection (send-time) or the webhook route
-- (service-role client) ever writes to it.
ALTER TABLE "email_delivery_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_delivery_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "email_delivery_log_admin_only" ON "email_delivery_log" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
