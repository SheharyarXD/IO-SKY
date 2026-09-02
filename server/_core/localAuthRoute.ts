/**
 * IO SKY — Local Email+Password Authentication Route.
 *
 * Provides a Manus-independent login path so the platform keeps working
 * even without a Manus subscription. Mints the same `io_sky_session`
 * cookie that the OAuth callback mints, so all downstream code (tRPC
 * context, role redirects, MFA gate) works unchanged.
 *
 * Endpoints
 *   POST /api/auth/local/login    { email, password } → { ok, role, next }
 *   POST /api/auth/local/logout   →  clears the session cookie
 *
 * The user must already exist in the `users` table with a non-null
 * `passwordHash`. New accounts are created via the seed script or via the
 * admin user-management UI; we intentionally do not expose a public
 * signup endpoint here because the platform is invite-only.
 */
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as db from "../db";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, getSessionTtlMs } from "@shared/const";
import { roleBasedDestination } from "./oauth";
import { getRequestIp } from "./requestMeta";

// RM-89: session lifetime is the configured TTL (12h default), not a year.

export function registerLocalAuthRoutes(app: Express) {
  app.post("/api/auth/local/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = (req.body ?? {}) as {
        email?: string;
        password?: string;
      };
      // No PII (raw email) in application logs — the real audit trail is the
      // `login_audit` DB row written below, which is access-controlled.
      console.log("[LocalAuth] login attempt received");

      if (!email || !password) {
        // Stable machine-readable code so the UI can render a localized,
        // safe message without leaking which specific field was missing.
        res.status(400).json({
          ok: false,
          code: "missing_fields",
          error: "email and password are required",
        });
        return;
      }

      const user = await db.getUserByEmailWithPassword(email.trim().toLowerCase());

      // Always do a bcrypt compare even when the user is missing — keeps
      // timing constant and prevents user enumeration.
      const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi";
      const ok = await bcrypt.compare(password, hash);

      if (!user || !user.passwordHash || !ok) {
        try {
          await db.appendLoginAudit({
            userId: user?.id ?? null,
            identifier: email,
            provider: "local",
            outcome: "failed",
            reason: "invalid_credentials",
            ip: getRequestIp(req),
            userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
          });
        } catch (err) {
          // A failed-login audit write going silent means brute-force
          // attempts against this endpoint could leave no trail.
          console.error("[LocalAuth] FAILED to record failed-login audit row:", err);
        }
        // Generic error — never reveals whether the email exists, never
        // reveals which factor failed. The client renders a single safe
        // localized message regardless of code.
        res.status(401).json({
          ok: false,
          code: "invalid_credentials",
          error: "Invalid email or password",
        });
        return;
      }

      const sessionTtlMs = getSessionTtlMs();
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: (user.name as string | null) ?? "",
        expiresInMs: sessionTtlMs,
      });
      console.log("[LocalAuth] session token created", { userId: user.id, role: user.role });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: sessionTtlMs });
      console.log("[LocalAuth] session cookie set", { cookieName: COOKIE_NAME, role: user.role });

      try {
        await db.appendLoginAudit({
          userId: user.id,
          identifier: email,
          provider: "local",
          outcome: "success",
          reason: null,
          ip: getRequestIp(req),
          userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
        });
        await db.touchUserLastSignedIn(user.id);
      } catch (err) {
        console.error("[LocalAuth] FAILED to record successful-login audit row:", err);
      }

      const next = roleBasedDestination(user.role, "/");
      console.log("[LocalAuth] login success", { userId: user.id, role: user.role, next });
      res.status(200).json({
        ok: true,
        role: user.role,
        next,
      });
    } catch (err) {
      console.error("[LocalAuth] login failed:", err);
      res.status(500).json({
        ok: false,
        code: "server_error",
        error: "Login failed",
      });
    }
  });

  const logoutHandler = async (req: Request, res: Response) => {
    // Milestone 3 §3.3 (RM-90): revoke server-side before clearing the cookie.
    //
    // Clearing the cookie only removes the browser's copy — the signed JWT
    // itself stayed valid until expiry, so anyone holding a captured token
    // could keep using it after the user had "logged out". Stamping the
    // revocation cutoff is what actually ends the session.
    //
    // Best-effort by design: a revocation failure must not leave the user
    // stuck logged in, so we still clear the cookie and return success. The
    // warning is what surfaces the degraded case.
    try {
      const cookies = req.headers.cookie ?? "";
      const match = /(?:^|;\s*)app_session_id=([^;]+)/.exec(cookies);
      if (match) {
        const session = await sdk.verifySession(decodeURIComponent(match[1]));
        if (session?.openId) {
          const revoked = await db.revokeUserSessionsByOpenId(session.openId);
          if (!revoked) {
            console.warn("[LocalAuth] logout: no DB connection, session not revoked server-side");
          }
        }
      }
    } catch (err) {
      console.warn("[LocalAuth] logout: failed to revoke sessions server-side:", err);
    }

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
    // For GET (link/menu), redirect to /login so the user lands somewhere sane.
    if (req.method === "GET") {
      res.redirect(302, "/login");
      return;
    }
    res.status(200).json({ ok: true });
  };
  app.post("/api/auth/local/logout", logoutHandler);
  app.get("/api/auth/local/logout", logoutHandler);
}
