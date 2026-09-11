-- Profile photos for every role.
--
-- The client asked for profile completion including a profile photo across
-- Client, Developer, Technical Operator, Admin and Super Admin. There was no
-- avatar column on `users` and no bucket that fitted the shape: the four
-- existing buckets are tenant-scoped (client-portal keys start with an
-- organizationId) or purpose-scoped (ai-scan-reports), and an avatar belongs
-- to a person rather than to a tenant. Admin, Super Admin and Technical
-- Operator accounts have no organizationId at all, so reusing client-portal
-- would have left three of the five roles with nowhere to put the file.
--
-- Path convention:
--   avatars/{userId}/{filename}
--
-- Two columns rather than a single URL: the bucket is private and reads go
-- through a signed URL minted per request, so a stored URL would expire. The
-- key is the durable identifier; `avatarUpdatedAt` exists so a client can
-- cache-bust without the server having to mint a new key on every change.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarKey" varchar(512);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUpdatedAt" timestamp;
--> statement-breakpoint

-- 2 MiB. Large enough for a high-DPI portrait, small enough that an
-- unbounded-upload mistake cannot fill the bucket. The server enforces the
-- same limit before the bytes are ever sent, so this is the second layer.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('avatars', 'avatars', false, 2097152)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- RLS is already enabled on storage.objects on every Supabase project, so
-- this is a no-op assertion rather than a change. It is wrapped because the
-- application role is not the owner of storage.objects and a bare ALTER
-- therefore raises insufficient_privilege — which would abort an otherwise
-- successful migration over a statement that had nothing left to do.
DO $$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'storage.objects RLS left as-is (not owner); Supabase enables it by default.';
END
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- avatars — a user owns exactly the folder named after their own users.id.
--
-- The first path segment is compared against the caller's numeric users.id,
-- resolved from auth.uid() via users."authUserId" — the same join key every
-- other policy in 0004/0006/0007 relies on. Anyone signed in may READ any
-- avatar (a photo is shown next to its owner's name across the portals, so
-- restricting reads to self would blank out every other person's picture),
-- but only the owner may write or delete their own.
-- ---------------------------------------------------------------------------

CREATE POLICY "avatars_authenticated_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
--> statement-breakpoint

CREATE POLICY "avatars_owner_write" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (
      SELECT u."id"::text FROM "users" u WHERE u."authUserId" = auth.uid()
    )
  );
--> statement-breakpoint

CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (
      SELECT u."id"::text FROM "users" u WHERE u."authUserId" = auth.uid()
    )
  );
--> statement-breakpoint

CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (
      SELECT u."id"::text FROM "users" u WHERE u."authUserId" = auth.uid()
    )
  );
