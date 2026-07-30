export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
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
 */
export function getCookieSecretBytes(): Uint8Array {
  return new TextEncoder().encode(requireSecret("JWT_SECRET", ENV.cookieSecret));
}
