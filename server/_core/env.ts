export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // RM-41/RM-50: Supabase project config (Milestone 1 auth/DB/storage
  // migration). supabaseSecretKey is a service-role-equivalent credential —
  // server-only, must never reach client bundles (never VITE_-prefixed).
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL ?? "",
};

/**
 * Validates a signing secret before it's used, instead of silently falling
 * back to an empty string or a hardcoded value. Mirrors the fail-fast check
 * already used in mfaCrypto.ts's getMasterKey(). Call this at the point a
 * secret is actually needed (not at module load), so tooling that imports
 * these modules without JWT_SECRET set (e.g. some test setups) doesn't
 * crash on import — only on an actual attempt to sign/verify.
 */
export function requireSecret(name: string, value: string | undefined | null): string {
  if (!value || value.length < 16) {
    throw new Error(
      `${name} is missing or too short (minimum 16 characters) — refusing to sign or verify tokens with an insecure secret.`,
    );
  }
  return value;
}

/**
 * Shared signing key for session cookies, the MFA-pending cookie, and the
 * admin impersonation cookie. Throws instead of silently signing with an
 * empty-string key when JWT_SECRET is unset.
 *
 * Deliberately re-reads process.env.JWT_SECRET directly rather than the
 * frozen `ENV.cookieSecret` snapshot above (which is captured once, at
 * module-import time). Discovered via `pnpm test`: several test files set
 * `process.env.JWT_SECRET` in a `beforeAll()`, which runs *after* this
 * module's top-level `ENV` object has already been evaluated (by whatever
 * imported it first in the module graph) — so `ENV.cookieSecret` stayed ""
 * for the rest of that test run no matter what the test set afterward.
 * Matches the pattern mfaCrypto.ts's getMasterKey() already uses correctly.
 */
export function getCookieSecretBytes(): Uint8Array {
  return new TextEncoder().encode(requireSecret("JWT_SECRET", process.env.JWT_SECRET));
}
