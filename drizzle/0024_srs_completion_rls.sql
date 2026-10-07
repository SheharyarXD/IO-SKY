-- Row Level Security for the tables added in 0023, following 0004's conventions.
--
-- Supabase exposes every public table to the publishable key over PostgREST, so
-- a table without RLS is readable by anyone who has loaded the site. 0023
-- shipped without this; the RM-108 constraint suite caught it against the live
-- database. The backend connects as a privileged role and is unaffected.
--
-- Policy shape:
--   - Staff-only tables: one admin-only policy (app_is_admin()).
--   - Tables a customer or user legitimately reads directly: a select policy
--     scoped to their organization or their own user id, plus admin for all.
--   - No table gets USING (true).

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'developer_time_entries','crm_opportunities','crm_proposals','crm_activities',
    'quotes','subscriptions','notification_preferences','admin_notifications',
    'project_approvals','ai_agents','ai_prompt_versions','ai_executions',
    'config_history','incidents','alert_rules','scheduled_reports'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin())', t || '_admin_all', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- A customer may read their own organization's subscriptions and quotations.
DROP POLICY IF EXISTS "subscriptions_select_own_org" ON "subscriptions";
--> statement-breakpoint
CREATE POLICY "subscriptions_select_own_org" ON "subscriptions" FOR SELECT
  USING ("organizationId" = app_current_organization_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "quotes_select_own_org" ON "quotes";
--> statement-breakpoint
CREATE POLICY "quotes_select_own_org" ON "quotes" FOR SELECT
  USING ("organizationId" = app_current_organization_id());
--> statement-breakpoint
-- crm_activities carries organizationId for filtering only; they are internal
-- notes, so just the admin policy applies.

-- Approvals: the customer reads those on their own projects.
DROP POLICY IF EXISTS "project_approvals_select_own_org" ON "project_approvals";
--> statement-breakpoint
CREATE POLICY "project_approvals_select_own_org" ON "project_approvals" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "client_projects" p
    WHERE p."id" = "project_approvals"."projectId"
      AND p."organizationId" = app_current_organization_id()
  ));
--> statement-breakpoint

-- Notification preferences belong to the person.
DROP POLICY IF EXISTS "notification_preferences_own" ON "notification_preferences";
--> statement-breakpoint
CREATE POLICY "notification_preferences_own" ON "notification_preferences" FOR ALL
  USING ("userId" = app_current_user_id()) WITH CHECK ("userId" = app_current_user_id());
--> statement-breakpoint

-- The one table 0023 missed for the updatedAt convention.
DROP TRIGGER IF EXISTS set_updated_at ON "notification_preferences";
--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "notification_preferences"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
