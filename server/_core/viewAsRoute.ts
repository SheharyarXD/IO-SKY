/**
 * IO SKY — View-As impersonation routes (Super Admin only).
 *
 * POST   /api/admin/view-as   { target: "client" | "developer", reason }
 *   - Verifies the caller is an admin via the normal session cookie.
 *   - Mints a 30-minute signed JWT in `io_sky_impersonation` cookie:
 *       { realAdminOpenId, target, reason, exp }
 *   - Writes a `login_audit` row with reason `admin.view_as.{target}`.
 *   - Returns the redirect path the SPA should send the user to.
 *
 * DELETE /api/admin/view-as
 *   - Clears the impersonation cookie and writes an audit row.
 *
 * The downstream effect is implemented in `context.ts`: when the
 * impersonation cookie is present *and* the underlying session is a
 * real admin, the tRPC context exposes `ctx.user.role` as the impersonation
 * target while keeping `ctx.realAdminOpenId` for the audit pipeline.
 */
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";
import { getCookieSecretBytes } from "./env";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";

export const IMPERSONATION_COOKIE = "io_sky_impersonation";
const IMPERSONATION_TTL_SEC = 30 * 60;

export interface ImpersonationPayload {
  realAdminOpenId: string;
  target: "client" | "developer";
  reason: string;
  iat: number;
  exp: number;
}

function secretKey() {
  return getCookieSecretBytes();
}

export async function signImpersonationToken(
  realAdminOpenId: string,
  target: "client" | "developer",
  reason: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    realAdminOpenId,
    target,
    reason: reason.slice(0, 200),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + IMPERSONATION_TTL_SEC)
    .sign(secretKey());
}

export async function verifyImpersonationToken(
  token: string | undefined | null,
): Promise<ImpersonationPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    const { realAdminOpenId, target, reason, iat, exp } = payload as Record<string, unknown>;
    if (
      typeof realAdminOpenId !== "string" ||
      (target !== "client" && target !== "developer") ||
      typeof iat !== "number" ||
      typeof exp !== "number"
    ) {
      return null;
    }
    return {
      realAdminOpenId,
      target,
      reason: typeof reason === "string" ? reason : "",
      iat,
      exp,
    };
  } catch {
    return null;
  }
}

function readImpersonationCookie(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  return cookies[IMPERSONATION_COOKIE] ?? null;
}

export function getImpersonationFromRequest(req: Request) {
  return readImpersonationCookie(req);
}

export function registerViewAsRoutes(app: Express) {
  app.post("/api/admin/view-as", async (req: Request, res: Response) => {
    let admin;
    try {
      admin = await sdk.authenticateRequest(req);
    } catch {
      return res.status(401).json({ ok: false, error: "Unauthenticated" });
    }
    if (admin.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const target = (req.body?.target ?? "").toString();
    if (target !== "client" && target !== "developer") {
      return res.status(400).json({ ok: false, error: "target must be 'client' or 'developer'" });
    }
    const reason = (req.body?.reason ?? "").toString().trim();
    if (reason.length < 4) {
      return res
        .status(400)
        .json({ ok: false, error: "reason is required and must be at least 4 characters" });
    }

    const token = await signImpersonationToken(admin.openId, target, reason);
    const opts = getSessionCookieOptions(req);
    res.cookie(IMPERSONATION_COOKIE, token, {
      ...opts,
      maxAge: IMPERSONATION_TTL_SEC * 1000,
    });

    try {
      await db.appendLoginAudit({
        userId: admin.id,
        provider: "manus",
        outcome: "success",
        reason: `admin.view_as.enter.${target} :: ${reason.slice(0, 80)}`,
        ip: req.ip ?? null,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      });
    } catch (err) {
      // Impersonation is the primary control for detecting/investigating
      // admin misuse of "View As" — losing this audit row silently is a
      // materially worse outcome than losing a routine notification.
      console.error(
        `[ViewAs] FAILED to record impersonation-enter audit row (admin=${admin.id}, target=${target}):`,
        err,
      );
    }

    res.json({
      ok: true,
      target,
      redirect: target === "client" ? "/client-portal" : "/developer-workspace",
      expiresInSec: IMPERSONATION_TTL_SEC,
    });
  });

  app.delete("/api/admin/view-as", async (req: Request, res: Response) => {
    const token = readImpersonationCookie(req);
    const claim = await verifyImpersonationToken(token);

    res.clearCookie(IMPERSONATION_COOKIE, { path: "/" });

    if (claim) {
      try {
        const real = await db.getUserByOpenId(claim.realAdminOpenId);
        if (real) {
          await db.appendLoginAudit({
            userId: real.id,
            provider: "manus",
            outcome: "success",
            reason: `admin.view_as.exit.${claim.target}`,
            ip: req.ip ?? null,
            userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
          });
        }
      } catch (err) {
        console.error(
          `[ViewAs] FAILED to record impersonation-exit audit row (target=${claim.target}):`,
          err,
        );
      }
    }

    res.json({ ok: true });
  });

  // Convenience GET so the SPA can render the banner without exposing
  // the cookie to JavaScript directly.
  app.get("/api/admin/view-as", async (req: Request, res: Response) => {
    const token = readImpersonationCookie(req);
    const claim = await verifyImpersonationToken(token);
    if (!claim) return res.json({ active: false });
    res.json({
      active: true,
      target: claim.target,
      reason: claim.reason,
      expiresAt: claim.exp * 1000,
    });
  });
}

// expose COOKIE_NAME for tests that need to read both cookies
export const SESSION_COOKIE_NAME = COOKIE_NAME;
