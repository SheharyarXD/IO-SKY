CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhookRegistrationId" integer NOT NULL,
	"triggerType" "workflow_definitions_trigger_type" NOT NULL,
	"triggerEntityRef" varchar(128),
	"success" integer NOT NULL,
	"statusCode" integer,
	"errorMessage" text,
	"requestedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"secret" varchar(128),
	"triggerType" "workflow_definitions_trigger_type" NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookRegistrationId_webhook_registrations_id_fk" FOREIGN KEY ("webhookRegistrationId") REFERENCES "public"."webhook_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_registrations" ADD CONSTRAINT "webhook_registrations_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_registration_id_idx" ON "webhook_deliveries" USING btree ("webhookRegistrationId");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_requested_at_idx" ON "webhook_deliveries" USING btree ("requestedAt");--> statement-breakpoint
CREATE INDEX "webhook_registrations_trigger_type_idx" ON "webhook_registrations" USING btree ("triggerType");
--> statement-breakpoint

-- Milestone 2 §2.6: webhook registry RLS, same split as 0013's workflow
-- engine tables — registrations are platform configuration (super_admin-
-- exclusive write, RM-57's boundary; the secret column especially should
-- never be writable/readable by a plain admin), deliveries are an
-- execution log an admin should be able to read for visibility but never
-- write directly (only the server-side dispatcher writes them, via the
-- service-role connection that bypasses RLS the same way every other
-- server-side write in this app does).
ALTER TABLE "webhook_registrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "webhook_registrations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "webhook_registrations_select_super_admin_only" ON "webhook_registrations" FOR SELECT
  USING (app_is_super_admin());
--> statement-breakpoint
CREATE POLICY "webhook_registrations_write_super_admin_only" ON "webhook_registrations" FOR ALL
  USING (app_is_super_admin())
  WITH CHECK (app_is_super_admin());
--> statement-breakpoint
CREATE POLICY "webhook_deliveries_select_admin" ON "webhook_deliveries" FOR SELECT
  USING (app_is_admin());
--> statement-breakpoint
CREATE POLICY "webhook_deliveries_write_admin_only" ON "webhook_deliveries" FOR ALL
  USING (app_is_admin())
  WITH CHECK (app_is_admin());