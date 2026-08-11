-- Milestone 1 (RM-50): link public.users.authUserId to Supabase's own
-- auth.users(id). Deferred until now (see 0003_add_auth_user_id.sql's
-- column comment) because Drizzle's schema DSL only models the `public`
-- schema, and because it makes sense to land alongside the code that
-- actually populates this column (server/_core/supabaseAuthRoute.ts).
--
-- ON DELETE CASCADE: if a Supabase Auth user is deleted, the linkage should
-- go with it (authUserId becomes irrelevant), not silently block deleting
-- the auth user. This does NOT delete the public.users row itself — only
-- clears its authUserId link, since ON DELETE here targets the FK column,
-- not the referencing row.
ALTER TABLE "users"
  ADD CONSTRAINT "users_authUserId_auth_users_id_fk"
  FOREIGN KEY ("authUserId") REFERENCES auth.users(id) ON DELETE SET NULL;
