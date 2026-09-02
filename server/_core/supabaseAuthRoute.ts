/**
 * IO SKY — Supabase Auth session bridge (RM-50..54).
 *
 * Endpoints
 *   POST /api/auth/supabase/session   { accessToken } -> { ok, role, next }
 *
 * DESIGN — why this is a "bridge" rather than a second parallel session
 * system: Supabase access tokens are short-lived (~1h) and refreshed
 * client-side by supabase-js. The rest of this app (tRPC context, RBAC,
 * MFA challenge, admin impersonation, storage proxy, staging gate) is all
 * built around one long-lived, server-signed session cookie
 * (`app_session_id`, verified by `sdk.verifySession`/`authenticateRequest`
 * in ./sdk.ts). Rebuilding all of that to understand Supabase tokens
 * directly would be the "second competing auth architecture" this
 * migration is explicitly told not to build.
 *
 * Instead: the client signs in with Supabase Auth directly
 * (`client/src/lib/supabase.ts`), then calls this endpoint once with the
 * resulting access token. This route verifies that token
 * (`verifySupabaseAccessToken`, ./supabaseAuth.ts — no DB round-trip, just
 * JWKS signature verification), resolves it to a `users` row (linking or
 * creating one on first sign-in), and mints the exact same session cookie
 * `server/_core/oauth.ts`'s Manus callback does — including the same
 * post-login MFA gate. Everything downstream (context.ts, every
 * *Procedure in trpc.ts, MFA, impersonation) works completely unchanged
 * because, from their point of view, this is just another way to arrive at
 * a valid session cookie for a real `users` row.
 *
 * KNOWN SCOPE LIMIT (documented, not silently decided): once the bridge
 * cookie is minted, session *validity* for the rest of that session's
 * lifetime is governed by our own JWT_SECRET-signed cookie, not by
 * Supabase's session state — revoking/banning a user in the Supabase
 * dashboard does not immediately invalidate an already-issued app cookie.
 * True continuous Supabase-session validation on every request would
 * require a token-refresh dance our current stateless-cookie model doesn't
 * support; that's a larger follow-up, not part of this pass.
 *
 * The pre-existing Manus OAuth (`./oauth.ts`) and local-password
 * (`./localAuthRoute.ts`) login paths are NOT touched or removed by this
 * file — all three mint the same cookie shape and can coexist.
 */
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { sdk } from "./sdk";
import { verifySupabaseAccessToken } from "./supabaseAuth";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, getSessionTtlMs } from "@shared/const";
import { roleBasedDestination } from "./oauth";
import { getRequestIp } from "./requestMeta";
import {
  MFA_PENDING_COOKIE,
  MFA_PENDING_TTL_MS,
  sanitiseNext,
  signMfaPending,
} from "./mfaChallenge";

// RM-89: session lifetime comes from getSessionTtlMs() (12h default).

export function registerSupabaseAuthRoutes(app: Express) {
  app.post("/api/auth/supabase/session", async (req: Request, res: Response) => {
    try {
      const { accessToken } = (req.body ?? {}) as { accessToken?: string };
      if (!accessToken) {
        res.status(400).json({ ok: false, code: "missing_token", error: "accessToken is required" });
        return;
      }

      const claims = await verifySupabaseAccessToken(accessToken);
      if (!claims) {
        res.status(401).json({ ok: false, code: "invalid_token", error: "Invalid or expired token" });
        return;
      }

      const email = claims.email ?? null;

      // Resolve to a users row: by authUserId (already linked), else by
      // email (a Manus-era account signing in via Supabase for the first
      // time), else create a brand-new row.
      //
      // NOTE: despite its name/doc comment, getUserByEmailWithPassword()'s
      // actual query is a plain `WHERE email = ?` with no passwordHash
      // filter - verified directly against its implementation (server/db/
      // users.ts). This linking path deliberately relies on that broader
      // behavior to match OAuth-origin accounts (which have no password)
      // by email too, not just local-password ones. If that function is
      // ever changed to actually filter by passwordHash IS NOT NULL (to
      // match its name), this call site needs to switch to a real
      // password-agnostic lookup instead.
      let user = await db.getUserByAuthUserId(claims.sub);
      if (!user && email) {
        const existingByEmail = await db.getUserByEmailWithPassword(email).catch(() => undefined);
        if (existingByEmail) {
          await db.linkAuthUserId(existingByEmail.id, claims.sub);
          user = { ...existingByEmail, authUserId: claims.sub };
        }
      }
      if (!user) {
        user = await db.createUserFromSupabase({ authUserId: claims.sub, email });
      }

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: (user.name as string | null) ?? "",
        expiresInMs: getSessionTtlMs(),
      });

      const cookieOptions = getSessionCookieOptions(req);
      const destination = roleBasedDestination(user.role, "/");

      // Post-login MFA gate — identical logic to oauth.ts's callback.
      let needsMfa = false;
      try {
        const verified = await db.listVerifiedMfaFactorsForUser(user.id);
        needsMfa = verified.length > 0;
      } catch (mfaError) {
        console.warn("[SupabaseAuth] mfa lookup failed (skipping gate):", mfaError);
      }

      if (needsMfa) {
        const pendingToken = await signMfaPending({
          openId: user.openId,
          userId: user.id,
          name: (user.name as string | null) ?? "",
          next: sanitiseNext(destination),
        });
        res.cookie(MFA_PENDING_COOKIE, pendingToken, {
          ...cookieOptions,
          maxAge: MFA_PENDING_TTL_MS,
        });
        res.cookie(COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });

        try {
          await db.appendLoginAudit({
            userId: user.id,
            identifier: email,
            provider: "supabase",
            outcome: "mfa_required",
            reason: null,
            ip: getRequestIp(req),
            userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
          });
        } catch (err) {
          console.error("[SupabaseAuth] FAILED to record mfa_required audit row:", err);
        }

        res.status(200).json({
          ok: true,
          mfaRequired: true,
          next: `/mfa-challenge?next=${encodeURIComponent(sanitiseNext(destination))}`,
        });
        return;
      }

      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: getSessionTtlMs() });

      try {
        await db.appendLoginAudit({
          userId: user.id,
          identifier: email,
          provider: "supabase",
          outcome: "success",
          reason: null,
          ip: getRequestIp(req),
          userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
        });
        await db.touchUserLastSignedIn(user.id);
      } catch (err) {
        console.error("[SupabaseAuth] FAILED to record successful-login audit row:", err);
      }

      res.status(200).json({ ok: true, role: user.role, next: destination });
    } catch (err) {
      console.error("[SupabaseAuth] session bridge failed:", err);
      res.status(500).json({ ok: false, code: "server_error", error: "Login failed" });
    }
  });
}
