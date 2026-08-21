-- Milestone 2 §2.5 — Organization Management is a super_admin-exclusive
-- capability per the RM-57 decision record (drizzle/0006_super_admin_role.sql's
-- own header comment: "organization management, role/permission management,
-- platform & integration configuration" are the capabilities super_admin
-- has beyond plain admin). The RLS policy landed in 0004, before RM-57
-- existed, only had one tier ("admin") to gate writes with -
-- 0006 already made super_admin inherit every admin grant transparently
-- (by redefining app_is_admin() to accept both roles), which is correct
-- for everything EXCEPT this one table, where the intent is narrower:
-- plain admin should NOT be able to create/edit organizations, only
-- super_admin should. Replaces organizations_write_admin_only with a
-- super_admin-scoped version; the SELECT policy (any org member, or any
-- admin/super_admin) is unchanged - reading is not the restricted part.
--
-- This is a defense-in-depth policy, same reasoning as every other 0004
-- policy: the actual enforcement for this app's own writes happens at the
-- tRPC layer (server/routers/admin.ts's superAdminProcedure-gated
-- endpoints, added alongside this migration), since the backend's own
-- Postgres connection bypasses RLS as table owner. This closes the same
-- "anyone with the publishable key can hit PostgREST directly" gap 0004
-- closed for every other table, specifically for the capability RM-57
-- carved out as super_admin-only.

DROP POLICY IF EXISTS "organizations_write_admin_only" ON "organizations";
--> statement-breakpoint

CREATE POLICY "organizations_write_super_admin_only" ON "organizations" FOR ALL
  USING (app_is_super_admin()) WITH CHECK (app_is_super_admin());
