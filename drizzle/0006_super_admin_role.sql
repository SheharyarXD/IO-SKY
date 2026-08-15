-- Milestone 1 (RM-57, resolved): add the "super_admin" role tier.
--
-- Client decision (recorded, not invented): super_admin is a new 5th enum
-- value, a strict superset of admin (every admin capability remains
-- available to super_admin; nothing is taken away from plain admin), and
-- assignable — any existing admin can be promoted to super_admin by an
-- existing super_admin (not a single hardcoded owner). The extra
-- capabilities super_admin gets beyond admin (organization management,
-- role/permission management, platform & integration configuration) are
-- Milestone 2 §2.5 deliverables built on top of this foundation; this
-- migration only lands the role tier itself and its RLS/RBAC recognition.
--
-- IMPORTANT — apply/verify note: this migration was authored in a session
-- with no database credentials available (no .env, no Supabase project
-- access) and has NOT been applied to the live database or verified via
-- `drizzle-kit migrate` / direct SQL query, unlike 0000-0005. Do not mark
-- RM-57 "done and live-verified" until that has actually happened — see
-- PHASE1_CHECKLIST.md / MILESTONE1_SUPABASE_MIGRATION_REPORT.md for the
-- honest status.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction as a
-- statement that reads the new value (PostgreSQL restriction), so this is
-- deliberately its own statement-breakpoint, applied before anything below
-- references 'super_admin'.

ALTER TYPE "public"."users_role" ADD VALUE IF NOT EXISTS 'super_admin';
--> statement-breakpoint

-- Redefine the single RLS choke-point every existing policy already calls
-- (see 0004_rls_policies.sql) so super_admin transparently inherits every
-- admin-level RLS grant across all 53 tables without touching a single
-- policy definition — this is exactly what "strict superset" requires at
-- the RLS layer.
CREATE OR REPLACE FUNCTION app_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'super_admin') FROM public.users WHERE "authUserId" = auth.uid() LIMIT 1),
    false
  );
$$;
--> statement-breakpoint

-- New helper for the super_admin-exclusive capabilities Milestone 2 §2.5
-- will add policies for (organization management, role/permission
-- management, platform configuration tables) — not used by any policy yet
-- as of this migration, same pattern 0004's original helper functions
-- followed (declared ahead of their first consumer).
CREATE OR REPLACE FUNCTION app_is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM public.users WHERE "authUserId" = auth.uid() LIMIT 1),
    false
  );
$$;
