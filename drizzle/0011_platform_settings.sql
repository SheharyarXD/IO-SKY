CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"section" varchar(64) NOT NULL,
	"key" varchar(128) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"value" text NOT NULL,
	"updatedByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updatedByUserId_users_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_settings_section_idx" ON "platform_settings" USING btree ("section");
--> statement-breakpoint

-- Milestone 2 §2.5: platform configuration store RLS. Read: any admin
-- (admin/super_admin/technical_operator would need visibility too if this
-- ever grows to include ops-relevant settings, but for now this table only
-- holds branding/storage/security/i18n/integrations/observability config,
-- which is an admin concern, not an ops one — app_is_admin() only, same
-- boundary the settings page itself has always been gated behind).
-- Write: super_admin only, same reasoning as 0009's organizations tightening
-- (RM-57's decision record names "platform & integration configuration" as
-- one of the capabilities super_admin gets beyond plain admin).
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "platform_settings_select_admin" ON "platform_settings" FOR SELECT
  USING (app_is_admin());
--> statement-breakpoint
CREATE POLICY "platform_settings_write_super_admin_only" ON "platform_settings" FOR ALL
  USING (app_is_super_admin())
  WITH CHECK (app_is_super_admin());