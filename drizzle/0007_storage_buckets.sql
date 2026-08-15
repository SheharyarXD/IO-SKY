-- Milestone 2 §2.1: Storage Migration — bucket architecture + storage-layer RLS.
--
-- Replaces the Manus Forge presigned-URL storage backend (server/storage.ts,
-- now rewritten against Supabase Storage) with four purpose-scoped buckets.
-- Same defense-in-depth reasoning as 0004_rls_policies.sql: Supabase exposes
-- storage.objects to anon/authenticated callers holding the publishable key,
-- so even though every real read/write in this app currently goes through
-- the backend's service-role client (server/_core/supabaseAuth.ts's
-- getSupabaseAdmin(), which bypasses RLS the same way the Postgres owner
-- connection does), RLS on storage.objects closes off direct-client access
-- as a second independent layer — exactly the "two independent layers
-- enforcing the same access rules" deliverable Milestone 2 §2.1 calls for.
--
-- Reuses the SAME helper functions 0004/0006 already defined
-- (app_is_admin(), app_current_organization_id(), app_current_developer_id())
-- rather than inventing a parallel identity-resolution path.
--
-- IMPORTANT — apply/verify note: authored in a session with no Supabase
-- credentials available (same limitation as 0006_super_admin_role.sql — see
-- that file's header and MILESTONE1_SUPABASE_MIGRATION_REPORT.md §16). Not
-- applied to the live project. The bucket inserts and RLS policies below
-- were written against Supabase's documented storage.buckets/storage.objects
-- shape and the storage.foldername() helper, but have not been run.

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
-- Path convention per bucket (see server/storage.ts's StorageBucket type and
-- each router's call sites for the producers):
--   branding/               <flat filename>                  — public, 3 known assets
--   client-portal/          {organizationId}/{category}/{filename}
--   developer-workspace/    projects/{projectId}/files/{filename}
--                           submissions/{developerId}/{filename}
--   ai-scan-reports/        {reportToken}.pdf

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('branding', 'branding', true, 5242880),
  ('client-portal', 'client-portal', false, 15728640),
  ('developer-workspace', 'developer-workspace', false, 26214400),
  ('ai-scan-reports', 'ai-scan-reports', false, 10485760)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- storage.objects ships with RLS already enabled on every Supabase project;
-- this is a defensive no-op if so, not a functional change, matching this
-- repo's existing convention (0004's comment on FORCE ROW LEVEL SECURITY) of
-- being explicit rather than relying on an unstated default.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- branding — public read (logo/mark/favicon rendered on public marketing
-- pages before login), admin-only write.
-- ---------------------------------------------------------------------------

CREATE POLICY "branding_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');
--> statement-breakpoint
CREATE POLICY "branding_admin_write" ON storage.objects FOR ALL
  USING (bucket_id = 'branding' AND app_is_admin())
  WITH CHECK (bucket_id = 'branding' AND app_is_admin());
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- client-portal — organizationId-scoped, mirrors client_documents /
-- client_reports / client_invoices' own RLS predicate exactly
-- (organizationId = app_current_organization_id() OR app_is_admin()).
-- storage.foldername(name) splits the object path on '/'; segment [1] is
-- the organizationId per the path convention above.
-- ---------------------------------------------------------------------------

CREATE POLICY "client_portal_storage_select_own_org_or_admin" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-portal'
    AND (
      app_is_admin()
      OR (storage.foldername(name))[1] = app_current_organization_id()::text
    )
  );
--> statement-breakpoint
CREATE POLICY "client_portal_storage_write_admin_only" ON storage.objects FOR ALL
  USING (bucket_id = 'client-portal' AND app_is_admin())
  WITH CHECK (bucket_id = 'client-portal' AND app_is_admin());
--> statement-breakpoint
-- (Real uploads happen via uploadDocument's backend service-role call, which
-- bypasses RLS — this write policy is the same defense-in-depth-only pattern
-- 0004 used for the public-intake tables, not the real write path.)

-- ---------------------------------------------------------------------------
-- developer-workspace — two path shapes, two predicates:
--   projects/{projectId}/files/...   — visible to any developer with an
--     active assignment on that project, exactly mirroring
--     developer_project_files' own RLS policy (EXISTS join through
--     developer_project_assignments) in 0004_rls_policies.sql.
--   submissions/{developerId}/...    — self-only, mirrors developer_submissions.
-- ---------------------------------------------------------------------------

CREATE POLICY "developer_workspace_storage_select_assigned_or_admin" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'developer-workspace'
    AND (
      app_is_admin()
      OR (
        (storage.foldername(name))[1] = 'projects'
        AND EXISTS (
          SELECT 1 FROM public.developer_project_assignments dpa
          WHERE dpa."projectId" = NULLIF((storage.foldername(name))[2], '')::integer
            AND dpa."developerId" = app_current_developer_id()
        )
      )
      OR (
        (storage.foldername(name))[1] = 'submissions'
        AND (storage.foldername(name))[2] = app_current_developer_id()::text
      )
    )
  );
--> statement-breakpoint
CREATE POLICY "developer_workspace_storage_write_admin_only" ON storage.objects FOR ALL
  USING (bucket_id = 'developer-workspace' AND app_is_admin())
  WITH CHECK (bucket_id = 'developer-workspace' AND app_is_admin());
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- ai-scan-reports — admin-only through storage RLS, same reasoning
-- 0004_rls_policies.sql documented for the ai_scans table itself: the real
-- end-user access path is the backend's own reportToken-gated flow (an
-- anonymous/token-based capability, not a Supabase Auth session), served
-- via short-lived signed URLs that bypass RLS at fetch time by design.
-- ---------------------------------------------------------------------------

CREATE POLICY "ai_scan_reports_storage_admin_only" ON storage.objects FOR ALL
  USING (bucket_id = 'ai-scan-reports' AND app_is_admin())
  WITH CHECK (bucket_id = 'ai-scan-reports' AND app_is_admin());
