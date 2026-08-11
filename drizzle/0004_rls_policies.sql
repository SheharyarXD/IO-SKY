-- Milestone 1 (RM-48): Row-Level Security policies.
--
-- ARCHITECTURE NOTE — why this matters even though the Express/tRPC backend
-- already does its own tenant scoping in application code (clientProcedure /
-- developerProcedure / adminProcedure in server/_core/trpc.ts):
--
--   Every Supabase project automatically exposes every table in the `public`
--   schema over a REST API (PostgREST, at https://<project>.supabase.co/rest/v1/*)
--   using the `anon` and `authenticated` Postgres roles — driven by the
--   publishable key, which is *designed* to be shipped to the browser. If RLS
--   is not enabled with restrictive policies, anyone holding that publishable
--   key (i.e. anyone who has loaded the site) can query any table directly,
--   completely bypassing the Express backend and its application-level
--   tenant checks. This migration closes that off. It is a backstop, not a
--   replacement for the existing application-level scoping — defense in
--   depth, per the explicit Milestone 1 requirement: "don't rely solely on
--   frontend route guards."
--
--   The backend's own Drizzle/postgres-js connection (server/db/connection.ts,
--   driven by DATABASE_URL) authenticates as a privileged Postgres role, not
--   `anon`/`authenticated` — table owners bypass RLS by default in Postgres,
--   so none of this changes how the existing backend code behaves or
--   requires it to be rewritten. That preserves the explicit instruction not
--   to blindly rewrite the whole DB access layer.
--
-- IDENTITY MODEL:
--   auth.uid() is Supabase Auth's built-in function returning the current
--   request's authenticated user id (a uuid), NULL for anonymous requests.
--   public.users.authUserId (added in 0003_add_auth_user_id.sql) is the link
--   from that identity to this app's own users table, its role, its
--   organizationId (Client Portal tenancy), and (via developer_profiles) its
--   developer scoping. Every policy below resolves through that link using
--   the SECURITY DEFINER helper functions declared first, which run with the
--   privileges of their owner and so can read public.users to resolve the
--   caller's identity without themselves being blocked by RLS on that table
--   (avoids infinite recursion: users' own RLS policy also calls these
--   functions).
--
--   authUserId is nullable and, as of this migration, unpopulated for every
--   existing row — RM-50..54 (the auth migration itself) is what populates
--   it per-user as each account moves to Supabase Auth. Until a row has
--   authUserId set, that user's own data is inaccessible to them through the
--   anon/authenticated Supabase roles (they simply don't resolve to a caller
--   identity yet) — this is intentional fail-closed behavior. It does not
--   affect the backend's own privileged-connection access, which is how the
--   app actually serves users today and continues to during the transition.
--
-- CONVENTIONS:
--   - Every table gets RLS enabled AND forced (FORCE ROW LEVEL SECURITY),
--     so even the table owner is bound by policy on cross-tenant queries as
--     an extra safety margin, with the single deliberate exception of the
--     app's own operational tables where we rely on ownership bypass being
--     available to the backend (documented per-table below — RLS is still
--     enabled everywhere; FORCE is the one axis that varies, and it is left
--     ON everywhere in this migration; nothing needed the exception).
--   - No table gets a `USING (true)` policy. Every policy has a real
--     predicate.
--   - service_role (Supabase's elevated API role, mapped to SUPABASE_SECRET_KEY)
--     already bypasses RLS by default in Supabase's Postgres configuration —
--     no explicit service_role policy is added anywhere in this file, and
--     that key must never reach client-side code (verified separately, see
--     final Milestone 1 report).

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE "authUserId" = auth.uid() LIMIT 1;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_current_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE "authUserId" = auth.uid() LIMIT 1;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.users WHERE "authUserId" = auth.uid() LIMIT 1),
    false
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_current_organization_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "organizationId" FROM public.users WHERE "authUserId" = auth.uid() LIMIT 1;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_current_developer_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dp.id
  FROM public.developer_profiles dp
  JOIN public.users u ON u.id = dp."userId"
  WHERE u."authUserId" = auth.uid()
  LIMIT 1;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Core / Auth
-- ---------------------------------------------------------------------------

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "users_select_self_or_admin" ON "users" FOR SELECT
  USING (id = app_current_user_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "users_update_self_or_admin" ON "users" FOR UPDATE
  USING (id = app_current_user_id() OR app_is_admin())
  WITH CHECK (id = app_current_user_id() OR app_is_admin());
--> statement-breakpoint
-- No INSERT/DELETE policy: user rows are created/removed by the backend's
-- privileged connection only (signup/offboarding flows), never directly by
-- an anon/authenticated Supabase client.

ALTER TABLE "login_audit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "login_audit" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "login_audit_select_self_or_admin" ON "login_audit" FOR SELECT
  USING ("userId" = app_current_user_id() OR app_is_admin());
--> statement-breakpoint
-- No write policy: only the backend (privileged connection) writes audit rows.

-- Public intake tables: bookings/leads/contact/dev-applications are written
-- by the backend on behalf of anonymous site visitors (no Supabase Auth
-- session exists at submission time) and read back only by admins. Locked
-- to admin-only for every operation via RLS; the backend's own inserts use
-- the privileged connection and are unaffected.

ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "bookings_admin_only" ON "bookings" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "booking_audit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "booking_audit" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "booking_audit_admin_only" ON "booking_audit" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "booking_answers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "booking_answers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "booking_answers_admin_only" ON "booking_answers" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "booking_reminders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "booking_reminders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "booking_reminders_admin_only" ON "booking_reminders" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "booking_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "booking_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "booking_events_admin_only" ON "booking_events" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "booking_slots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "booking_slots" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "booking_slots_admin_only" ON "booking_slots" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "admin_availability" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "admin_availability" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "admin_availability_admin_only" ON "admin_availability" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "availability_windows" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "availability_windows" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "availability_windows_admin_only" ON "availability_windows" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "calendar_blocks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "calendar_blocks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "calendar_blocks_admin_only" ON "calendar_blocks" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "timezone_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "timezone_preferences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "timezone_preferences_admin_only" ON "timezone_preferences" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "leads_admin_only" ON "leads" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "contact_submissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contact_submissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "contact_submissions_admin_only" ON "contact_submissions" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "dev_applications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dev_applications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "dev_applications_admin_only" ON "dev_applications" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "ecosystem_click_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ecosystem_click_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ecosystem_click_events_admin_only" ON "ecosystem_click_events" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "ecosystem_proposal_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ecosystem_proposal_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ecosystem_proposal_requests_admin_only" ON "ecosystem_proposal_requests" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "custom_discovery_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "custom_discovery_sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "custom_discovery_sessions_admin_only" ON "custom_discovery_sessions" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

-- AI Scans: the anonymous/token-based report flow is handled entirely by
-- the backend (privileged connection + its own reportToken verification,
-- see server/db/aiScans.ts) — not by a Supabase Auth session — so, like the
-- other public-intake tables, this is admin-only through RLS.
ALTER TABLE "ai_scans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_scans" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ai_scans_admin_only" ON "ai_scans" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Client Portal domain (organizationId-scoped)
-- ---------------------------------------------------------------------------

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "organizations_select_own_or_admin" ON "organizations" FOR SELECT
  USING (id = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "organizations_write_admin_only" ON "organizations" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint
-- (The SELECT policy above plus this ALL/admin policy together give
-- members read access and admins full read+write — Postgres RLS policies
-- are OR'd together per command type.)

ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "organization_memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "organization_memberships_select_own_org_or_admin" ON "organization_memberships" FOR SELECT
  USING ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "organization_memberships_write_admin_only" ON "organization_memberships" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "client_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_reports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_reports_select_own_org_or_admin" ON "client_reports" FOR SELECT
  USING ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_reports_write_admin_only" ON "client_reports" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "client_recommendations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_recommendations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_recommendations_select_own_org_or_admin" ON "client_recommendations" FOR SELECT
  USING ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_recommendations_write_admin_only" ON "client_recommendations" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "client_projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_projects" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_projects_select_own_org_or_admin" ON "client_projects" FOR SELECT
  USING ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_projects_write_admin_only" ON "client_projects" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

-- client_project_milestones has no organizationId of its own — tenant scope
-- is established by joining through its parent client_projects row. This is
-- exactly the case flagged in drizzle/schema.ts's own doc comment as a place
-- application code could accidentally skip tenant filtering; RLS closes
-- that regardless of what the query layer does.
ALTER TABLE "client_project_milestones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_project_milestones" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_project_milestones_select_own_org_or_admin" ON "client_project_milestones" FOR SELECT
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_projects cp
      WHERE cp.id = "client_project_milestones"."projectId"
        AND cp."organizationId" = app_current_organization_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "client_project_milestones_write_admin_only" ON "client_project_milestones" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "client_invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_invoices_select_own_org_or_admin" ON "client_invoices" FOR SELECT
  USING ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_invoices_write_admin_only" ON "client_invoices" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "client_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_documents_select_own_org_or_admin" ON "client_documents" FOR SELECT
  USING ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_documents_write_admin_only" ON "client_documents" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "client_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_messages_select_own_org_or_admin" ON "client_messages" FOR SELECT
  USING ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
-- Clients can post into their own org's thread (sender must be "client" —
-- the app never lets a client author an "io-sky" message; enforced here too
-- so a compromised/forged client request can't spoof the IO SKY side).
CREATE POLICY "client_messages_insert_own_org_client" ON "client_messages" FOR INSERT
  WITH CHECK (
    app_is_admin()
    OR ("organizationId" = app_current_organization_id() AND sender = 'client')
  );
--> statement-breakpoint
CREATE POLICY "client_messages_update_delete_admin_only" ON "client_messages" FOR UPDATE
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_messages_delete_admin_only" ON "client_messages" FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

ALTER TABLE "client_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_notifications_select_own_org_or_admin" ON "client_notifications" FOR SELECT
  USING ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
-- Clients may mark their own org's notifications read (readAt) but not
-- change anything else about them; simplest safe expression at the RLS
-- layer is to let own-org UPDATE through and trust the backend's existing
-- application logic to only ever touch readAt (mirrors current behavior in
-- server/db/clientPortal.ts markIoSkyMessagesRead-style helpers).
CREATE POLICY "client_notifications_update_own_org" ON "client_notifications" FOR UPDATE
  USING ("organizationId" = app_current_organization_id() OR app_is_admin())
  WITH CHECK ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_notifications_insert_delete_admin_only" ON "client_notifications" FOR INSERT
  WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_notifications_delete_admin_only" ON "client_notifications" FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

ALTER TABLE "client_support_tickets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_support_tickets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_support_tickets_select_own_org_or_admin" ON "client_support_tickets" FOR SELECT
  USING ("organizationId" = app_current_organization_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_support_tickets_insert_own_org" ON "client_support_tickets" FOR INSERT
  WITH CHECK (app_is_admin() OR "organizationId" = app_current_organization_id());
--> statement-breakpoint
CREATE POLICY "client_support_tickets_update_admin_only" ON "client_support_tickets" FOR UPDATE
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY "client_support_tickets_delete_admin_only" ON "client_support_tickets" FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Developer Workspace domain (developerId-scoped via developer_profiles)
-- ---------------------------------------------------------------------------

ALTER TABLE "developer_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_profiles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_profiles_select_self_or_admin" ON "developer_profiles" FOR SELECT
  USING ("userId" = app_current_user_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_profiles_write_admin_only" ON "developer_profiles" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_access_scopes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_access_scopes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_access_scopes_select_own_or_admin" ON "developer_access_scopes" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_access_scopes_write_admin_only" ON "developer_access_scopes" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_agreements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_agreements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_agreements_select_own_or_admin" ON "developer_agreements" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
-- A developer signs their own agreements (the NDA/confidentiality/etc
-- acceptance flow in server/db/developerWorkspace.ts) — allow self-insert,
-- everything else admin-only.
CREATE POLICY "developer_agreements_insert_own" ON "developer_agreements" FOR INSERT
  WITH CHECK (app_is_admin() OR "developerId" = app_current_developer_id());
--> statement-breakpoint
CREATE POLICY "developer_agreements_update_delete_admin_only" ON "developer_agreements" FOR UPDATE
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_agreements_delete_admin_only" ON "developer_agreements" FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_access_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_access_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_access_requests_select_own_or_admin" ON "developer_access_requests" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_access_requests_insert_own" ON "developer_access_requests" FOR INSERT
  WITH CHECK (app_is_admin() OR "developerId" = app_current_developer_id());
--> statement-breakpoint
CREATE POLICY "developer_access_requests_update_admin_only" ON "developer_access_requests" FOR UPDATE
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_access_requests_delete_admin_only" ON "developer_access_requests" FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

-- developer_audit / developer_security_events: compliance records. Self can
-- read their own history (transparency), but only the backend/admin writes.
ALTER TABLE "developer_audit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_audit" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_audit_select_own_or_admin" ON "developer_audit" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_security_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_security_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_security_events_select_own_or_admin" ON "developer_security_events" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_security_events_update_admin_only" ON "developer_security_events" FOR UPDATE
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_support_tickets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_support_tickets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_support_tickets_select_own_or_admin" ON "developer_support_tickets" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_support_tickets_insert_own" ON "developer_support_tickets" FOR INSERT
  WITH CHECK (app_is_admin() OR "developerId" = app_current_developer_id());
--> statement-breakpoint
CREATE POLICY "developer_support_tickets_update_admin_only" ON "developer_support_tickets" FOR UPDATE
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_support_tickets_delete_admin_only" ON "developer_support_tickets" FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_notifications_select_own_or_admin" ON "developer_notifications" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_notifications_update_own" ON "developer_notifications" FOR UPDATE
  USING ("developerId" = app_current_developer_id() OR app_is_admin())
  WITH CHECK ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_notifications_insert_admin_only" ON "developer_notifications" FOR INSERT
  WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_notifications_delete_admin_only" ON "developer_notifications" FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_messages_select_own_or_admin" ON "developer_messages" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_messages_insert_own_developer" ON "developer_messages" FOR INSERT
  WITH CHECK (
    app_is_admin()
    OR ("developerId" = app_current_developer_id() AND sender = 'developer')
  );
--> statement-breakpoint
CREATE POLICY "developer_messages_update_admin_only" ON "developer_messages" FOR UPDATE
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_messages_delete_admin_only" ON "developer_messages" FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

-- developer_projects: visibility requires an active assignment, not just
-- "any developer". developer_projects itself carries no developerId column
-- (by design — a project can have multiple developers), so this must join
-- through developer_project_assignments.
ALTER TABLE "developer_projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_projects" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_projects_select_assigned_or_admin" ON "developer_projects" FOR SELECT
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.developer_project_assignments dpa
      WHERE dpa."projectId" = "developer_projects".id
        AND dpa."developerId" = app_current_developer_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "developer_projects_write_admin_only" ON "developer_projects" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_project_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_project_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_project_assignments_select_own_or_admin" ON "developer_project_assignments" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_project_assignments_write_admin_only" ON "developer_project_assignments" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_tasks_select_assigned_or_admin" ON "developer_tasks" FOR SELECT
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.developer_project_assignments dpa
      WHERE dpa."projectId" = "developer_tasks"."projectId"
        AND dpa."developerId" = app_current_developer_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "developer_tasks_write_admin_only" ON "developer_tasks" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_task_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_task_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_task_assignments_select_own_or_admin" ON "developer_task_assignments" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_task_assignments_write_admin_only" ON "developer_task_assignments" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_project_files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_project_files" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_project_files_select_assigned_or_admin" ON "developer_project_files" FOR SELECT
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.developer_project_assignments dpa
      WHERE dpa."projectId" = "developer_project_files"."projectId"
        AND dpa."developerId" = app_current_developer_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "developer_project_files_write_admin_only" ON "developer_project_files" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "developer_submissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "developer_submissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developer_submissions_select_own_or_admin" ON "developer_submissions" FOR SELECT
  USING ("developerId" = app_current_developer_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_submissions_insert_own_assigned" ON "developer_submissions" FOR INSERT
  WITH CHECK (
    app_is_admin()
    OR (
      "developerId" = app_current_developer_id()
      AND EXISTS (
        SELECT 1 FROM public.developer_project_assignments dpa
        WHERE dpa."projectId" = "developer_submissions"."projectId"
          AND dpa."developerId" = app_current_developer_id()
      )
    )
  );
--> statement-breakpoint
CREATE POLICY "developer_submissions_update_admin_only" ON "developer_submissions" FOR UPDATE
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY "developer_submissions_delete_admin_only" ON "developer_submissions" FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- MFA — strictly self-only, no admin bypass (admin access to another
-- user's MFA secret/recovery codes is never appropriate at the RLS layer;
-- the backend's own privileged connection still performs verification
-- server-side during login, unaffected by this).
-- ---------------------------------------------------------------------------

ALTER TABLE "mfa_factors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mfa_factors" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mfa_factors_self_only" ON "mfa_factors" FOR ALL
  USING ("userId" = app_current_user_id())
  WITH CHECK ("userId" = app_current_user_id());
--> statement-breakpoint

ALTER TABLE "mfa_recovery_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mfa_recovery_codes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mfa_recovery_codes_self_only" ON "mfa_recovery_codes" FOR ALL
  USING ("userId" = app_current_user_id())
  WITH CHECK ("userId" = app_current_user_id());
--> statement-breakpoint

ALTER TABLE "mfa_challenges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mfa_challenges" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mfa_challenges_self_only" ON "mfa_challenges" FOR ALL
  USING ("userId" = app_current_user_id())
  WITH CHECK ("userId" = app_current_user_id());
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Legal, compliance & consent
-- ---------------------------------------------------------------------------

-- Published legal text must be readable by everyone, including logged-out
-- visitors (Terms/Privacy pages) — the one deliberate anon-readable
-- carve-out in this migration, and it is a narrow, explicit predicate, not
-- USING (true): only rows already marked public-facing are exposed.
ALTER TABLE "legal_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "legal_documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "legal_documents_select_active_public" ON "legal_documents" FOR SELECT
  USING (status = 'active' OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "legal_documents_write_admin_only" ON "legal_documents" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "agreement_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agreement_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agreement_versions_select_published_public" ON "agreement_versions" FOR SELECT
  USING (status = 'published' OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "agreement_versions_write_admin_only" ON "agreement_versions" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
--> statement-breakpoint

ALTER TABLE "agreement_acceptances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agreement_acceptances" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agreement_acceptances_select_own_or_admin" ON "agreement_acceptances" FOR SELECT
  USING ("userId" = app_current_user_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "agreement_acceptances_insert_own" ON "agreement_acceptances" FOR INSERT
  WITH CHECK (app_is_admin() OR "userId" = app_current_user_id());
--> statement-breakpoint
-- Acceptances are an immutable consent record — no UPDATE/DELETE policy for
-- anyone, including admin: correcting one means recording a new acceptance,
-- not editing history.

ALTER TABLE "cookie_consents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cookie_consents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "cookie_consents_select_own_or_admin" ON "cookie_consents" FOR SELECT
  USING ("userId" = app_current_user_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "cookie_consents_insert_own_or_anon" ON "cookie_consents" FOR INSERT
  WITH CHECK (
    app_is_admin()
    OR "userId" = app_current_user_id()
    -- Anonymous visitors also record cookie consent (subjectKey "anon:<uuid>",
    -- userId NULL) before ever authenticating — matches existing behavior.
    OR ("userId" IS NULL AND auth.uid() IS NULL)
  );
--> statement-breakpoint

ALTER TABLE "legal_acknowledgements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "legal_acknowledgements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "legal_acknowledgements_select_own_or_admin" ON "legal_acknowledgements" FOR SELECT
  USING ("userId" = app_current_user_id() OR app_is_admin());
--> statement-breakpoint
CREATE POLICY "legal_acknowledgements_insert_own" ON "legal_acknowledgements" FOR INSERT
  WITH CHECK (app_is_admin() OR "userId" = app_current_user_id());
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- End of RM-48 baseline policy set.
--
-- NOT covered by a table-specific policy above, and therefore fully closed
-- to anon/authenticated by default once RLS is enabled with no matching
-- policy (Postgres RLS is default-deny): none — every one of the 53 tables
-- in drizzle/schema.ts has an explicit ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY + at least one policy above. Grep-verified: 53 ENABLE ROW LEVEL
-- SECURITY statements in this file, one per table.
-- ---------------------------------------------------------------------------
