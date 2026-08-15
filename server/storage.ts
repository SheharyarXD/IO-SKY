/**
 * IO SKY — object storage (Milestone 2 §2.1).
 *
 * Replaces the Manus Forge presigned-URL backend (S3 via a Forge presign
 * API — see git history for the prior implementation) with Supabase
 * Storage. Every call goes through the backend's service-role client
 * (getSupabaseAdmin(), server/_core/supabaseAuth.ts), which bypasses
 * storage.objects RLS the same way the app's own Postgres connection
 * bypasses table RLS — the actual tenant-isolation boundary for direct
 * client access is drizzle/0007_storage_buckets.sql's RLS policies, not
 * this module. This module is the single write/read path so that
 * boundary can't be bypassed by a router reaching for the Supabase SDK
 * directly.
 *
 * Four buckets, one per tenancy shape — see 0007_storage_buckets.sql's
 * header for the exact path convention each one expects. Passing the
 * wrong bucket for a path shape won't fail at this layer (bucket and key
 * are independent strings); callers are expected to use the constants in
 * StorageBucket and match the path convention documented there and in the
 * migration.
 */
import { getSupabaseAdmin } from "./_core/supabaseAuth";

export const STORAGE_BUCKETS = [
  "branding",
  "client-portal",
  "developer-workspace",
  "ai-scan-reports",
] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/**
 * Upload bytes to the given bucket. Appends a short random suffix to the
 * key (before the extension) so concurrent uploads with the same
 * caller-chosen name never collide — same behavior the prior Forge-backed
 * implementation had, preserved because callers (clientPortal.ts's
 * uploadDocument, aiScans.ts's report generator) rely on the returned key
 * being the actual stored key, not necessarily the one they passed in.
 */
export async function storagePut(
  bucket: StorageBucket,
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ bucket: StorageBucket; key: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body =
    typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);

  const { error } = await getSupabaseAdmin()
    .storage.from(bucket)
    .upload(key, body, { contentType, upsert: false });

  if (error) {
    throw new Error(`Storage upload failed (bucket=${bucket}, key=${key}): ${error.message}`);
  }

  return { bucket, key };
}

/**
 * Short-lived signed URL for a private object. Default 10 minutes, matching
 * every current caller's `expiresInSec: 600` response contract
 * (clientPortal.ts's report/invoice/document downloads).
 */
export async function storageGetSignedUrl(
  bucket: StorageBucket,
  relKey: string,
  expiresInSec = 600,
): Promise<string> {
  const key = normalizeKey(relKey);

  const { data, error } = await getSupabaseAdmin()
    .storage.from(bucket)
    .createSignedUrl(key, expiresInSec);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Storage signed URL failed (bucket=${bucket}, key=${key}): ${error?.message ?? "empty response"}`,
    );
  }

  return data.signedUrl;
}

/**
 * Permanent public URL for an object in the `branding` bucket — the one
 * bucket created with `public: true` (0007_storage_buckets.sql). Does not
 * hit the network; Supabase public URLs are deterministic from the project
 * URL + bucket + key, so this is safe to call from a hot path.
 */
export function storageGetPublicUrl(bucket: "branding", relKey: string): string {
  const key = normalizeKey(relKey);
  const { data } = getSupabaseAdmin().storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

/**
 * Delete an object. Not used by any current caller (no delete UI exists
 * yet for client documents / developer files / AI Scan reports), exposed
 * ahead of Milestone 2 §2.6's Document Lifecycle work needing it, same
 * "declare ahead of first consumer" pattern the RLS helper functions use.
 */
export async function storageDelete(bucket: StorageBucket, relKey: string): Promise<void> {
  const key = normalizeKey(relKey);
  const { error } = await getSupabaseAdmin().storage.from(bucket).remove([key]);
  if (error) {
    throw new Error(`Storage delete failed (bucket=${bucket}, key=${key}): ${error.message}`);
  }
}
