/**
 * IO SKY — Supabase Auth integration (RM-50..54).
 *
 * NEW, additive infrastructure for the Path A migration (Supabase Auth as
 * the primary auth system — see RM-49 decision record in
 * PHASE1_CHECKLIST.md). This module does NOT replace `server/_core/sdk.ts`
 * (the current Manus-OAuth-based session system) yet — per the explicit
 * working rule for this migration, the old auth implementation stays live
 * and wired in until this replacement is fully built AND verified end to
 * end against a real Supabase project. That verification needs a live
 * Postgres connection (to read/write `users.authUserId`), which is not yet
 * available in this environment — see PHASE1_CHECKLIST.md's "central
 * blocker" note. What IS safe to build and unit-test without a live DB is
 * the JWT-verification plumbing below, since Supabase Auth JWTs are
 * verified against its public JWKS endpoint (SUPABASE_JWKS_URL), not
 * against Postgres.
 *
 * Two clients are exposed:
 *   - `supabaseAdmin` — service-role-equivalent client (SUPABASE_SECRET_KEY).
 *     Server-only. Never expose this client or its key to the browser.
 *   - `verifySupabaseAccessToken` — verifies a Supabase Auth access token
 *     (the JWT a client sends after `supabase.auth.signInWith*`) against
 *     Supabase's JWKS, without needing the secret key or a DB round-trip.
 *     This is what will eventually replace `sdk.authenticateRequest`'s
 *     Manus-token verification once wired into tRPC context (RM-55).
 */
import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Deliberately reads process.env fresh at call time rather than importing
// the frozen `ENV` snapshot from ./env — same reasoning as
// getCookieSecretBytes() in env.ts: a module-load-time snapshot would stay
// stale for any test that sets these vars in a beforeAll(), which runs
// after this module is first imported by the module graph.
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

/**
 * Service-role-equivalent Supabase client for server-side administrative
 * operations (e.g. creating/deleting auth users, sending admin-triggered
 * password resets). Throws if SUPABASE_URL/SUPABASE_SECRET_KEY are not
 * configured, rather than silently returning a non-functional client.
 */
export function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY are required to use the Supabase admin client.",
    );
  }
  _supabaseAdmin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabaseAdmin;
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let _jwksUrl: string | null = null;

function getJwks() {
  const url = process.env.SUPABASE_JWKS_URL;
  if (!url) {
    throw new Error("SUPABASE_JWKS_URL is required to verify Supabase Auth tokens.");
  }
  // Rebuild if the configured URL ever changes (e.g. across test cases) —
  // createRemoteJWKSet caches its own key fetches internally, so this stays
  // cheap in the steady-state case where the URL doesn't change.
  if (!_jwks || _jwksUrl !== url) {
    _jwks = createRemoteJWKSet(new URL(url));
    _jwksUrl = url;
  }
  return _jwks;
}

export type SupabaseAccessTokenClaims = {
  /** Supabase Auth user id (uuid) — this is what users.authUserId links to. */
  sub: string;
  email?: string;
  phone?: string;
  role?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
};

/**
 * Verify a Supabase Auth access token (JWT) against the project's JWKS.
 * Returns the decoded claims on success, or null if the token is missing,
 * malformed, expired, or fails signature verification. Never throws for
 * "just an invalid token" — only for missing server configuration (a
 * genuine setup bug, not a client-input error).
 */
export async function verifySupabaseAccessToken(
  token: string | null | undefined,
): Promise<SupabaseAccessTokenClaims | null> {
  if (!token) return null;
  // Resolve config outside the try/catch below so a missing
  // SUPABASE_JWKS_URL surfaces as a thrown setup error, not a silently
  // swallowed "invalid token" — matches getSupabaseAdmin()'s behavior.
  const jwks = getJwks();
  try {
    const { payload } = await jwtVerify(token, jwks);
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return payload as SupabaseAccessTokenClaims;
  } catch {
    return null;
  }
}
