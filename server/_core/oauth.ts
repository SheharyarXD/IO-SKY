import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import {
  MFA_PENDING_COOKIE,
  MFA_PENDING_TTL_MS,
  sanitiseNext,
  signMfaPending,
} from "./mfaChallenge";
import { sdk } from "./sdk";

/**
 * Decode the IO SKY OAuth state.
 *
 * Returns the `returnPath` requested by the frontend (default `/`) and a
 * sane fallback when the state is the legacy plain-redirect-URI shape.
 */
function parseStateForReturnPath(state: string): string {
  try {
    const decoded = Buffer.from(state, "base64").toString("utf8");
    if (decoded.startsWith("{")) {
      const parsed = JSON.parse(decoded) as { returnPath?: string };
      if (
        typeof parsed.returnPath === "string" &&
        parsed.returnPath.startsWith("/") &&
        !parsed.returnPath.startsWith("//")
      ) {
        return parsed.returnPath;
      }
    }
  } catch {
    /* fall through */
  }
  return "/";
}

/**
 * Map a user role to its preferred portal landing page.
 * Falls back to the requested returnPath when no role-specific destination
 * applies, then finally to `/`.
 */
export function roleBasedDestination(
  role: string | null | undefined,
  fallback: string,
): string {
  switch (role) {
    case "admin":
      return "/admin/bookings";
    case "client":
    case "client_member":
      return "/client-portal";
    case "developer":
      return "/developer-workspace";
    default:
      return fallback;
  }
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Pull the freshly upserted row so we can read id + role.
      const userRow = await db.getUserByOpenId(userInfo.openId);

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Best-effort audit row for the successful login.
      try {
        await db.appendLoginAudit({
          userId: userRow?.id ?? null,
          identifier: userInfo.email ?? null,
          provider: "manus",
          outcome: "success",
          reason: null,
          ip: req.socket?.remoteAddress ?? null,
          userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
        });
      } catch (auditError) {
        console.warn("[OAuth] login audit failed:", auditError);
      }

      const requestedReturnPath = parseStateForReturnPath(state);
      const destination = roleBasedDestination(
        userRow?.role ?? null,
        requestedReturnPath,
      );

      // Post-login MFA gate: if the user has at least one verified factor,
      // we mint a short-lived pending cookie and redirect to /mfa-challenge
      // instead of the real session cookie.
      let needsMfa = false;
      try {
        if (userRow?.id) {
          const verified = await db.listVerifiedMfaFactorsForUser(userRow.id);
          needsMfa = verified.length > 0;
        }
      } catch (mfaError) {
        console.warn("[OAuth] mfa lookup failed (skipping gate):", mfaError);
      }

      if (needsMfa && userRow) {
        const pendingToken = await signMfaPending({
          openId: userInfo.openId,
          userId: userRow.id,
          name: userInfo.name || "",
          next: sanitiseNext(destination),
        });
        // Clear any stale session cookie and set the pending cookie.
        res.clearCookie(COOKIE_NAME, cookieOptions);
        res.cookie(MFA_PENDING_COOKIE, pendingToken, {
          ...cookieOptions,
          maxAge: MFA_PENDING_TTL_MS,
        });
        // Important: the session cookie set a few lines above must not be
        // sent. We can't unset a cookie we already queued, so we replace it
        // with an immediate-expire cookie of the same name.
        res.cookie(COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
        res.redirect(
          302,
          `/mfa-challenge?next=${encodeURIComponent(sanitiseNext(destination))}`,
        );
        return;
      }

      res.redirect(302, destination);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
