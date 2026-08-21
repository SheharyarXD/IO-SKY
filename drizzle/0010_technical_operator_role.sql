-- Milestone 2 §2.5: add the "technical_operator" role tier.
--
-- Unlike super_admin (0006_super_admin_role.sql, a strict superset of
-- admin), technical_operator is a lateral, narrower tier: infrastructure
-- and operational visibility only (system health, email delivery health,
-- security-event volume), deliberately walled off from customer and
-- financial data. It does NOT inherit admin's RLS grants — app_is_admin()
-- is intentionally left unchanged by this migration. Gated server-side by
-- opsProcedure (server/_core/trpc.ts), which accepts technical_operator +
-- admin + super_admin (admins are not losing anything; this is additive).
--
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as a
-- statement that reads the new value, so this is its own
-- statement-breakpoint, same pattern as 0006.
--
-- IMPORTANT — apply/verify note: authored with no live database access
-- (the connected Supabase project is unreachable, see MILESTONE2_PROGRESS.md).
-- Not applied or live-verified. Do not mark this "done and live-verified"
-- until it has actually run against a real database.

ALTER TYPE "public"."users_role" ADD VALUE IF NOT EXISTS 'technical_operator';
--> statement-breakpoint

-- Helper for the ops-only RLS policies this role needs. Deliberately
-- narrow: only the tables a technical_operator legitimately needs to read
-- (system/email/security telemetry) should ever reference this function.
-- No table policy references it yet as of this migration — first consumer
-- lands with the Security Center / ops endpoints work in this same pass.
CREATE OR REPLACE FUNCTION app_is_technical_operator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('technical_operator', 'admin', 'super_admin') FROM public.users WHERE "authUserId" = auth.uid() LIMIT 1),
    false
  );
$$;
