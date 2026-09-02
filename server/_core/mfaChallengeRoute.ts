/**
 * IO SKY — MFA post-login challenge endpoint.
 *
 * After OAuth, if the user has at least one verified MFA factor we redirect to
 * `/mfa-challenge?next=...` with only a short-lived `mfa_pending` JWT cookie.
 * The frontend submits the user's code to this route. On success we mint the
 * real session cookie, clear the pending cookie, and return the destination
 * path. On failure we increment the per-factor failure counter and lock the
 * factor after MAX_FAILED_ATTEMPTS — exactly like the normal verify flow.
 *
 * The route lives outside tRPC because tRPC procedures do not have first-class
 * cookie control: we need to atomically (a) verify the OTP/recovery code,
 * (b) clear `io_sky_mfa_pending`, and (c) set the real session cookie.
 */
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME, getSessionTtlMs } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { envelopeDecrypt } from "./mfaCrypto";
import { verifyRecoveryCode } from "./mfaCrypto";
import { verifyTotpToken } from "./mfaTotp";
import {
  MFA_PENDING_COOKIE,
  sanitiseNext,
  verifyMfaPending,
} from "./mfaChallenge";
import { sdk } from "./sdk";
import { getRequestIp, getRequestUserAgent } from "./requestMeta";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 5 * 60 * 1000;

// Aliases onto the shared implementation (server/_core/requestMeta.ts).
const reqIp = getRequestIp;
const reqUa = getRequestUserAgent;

interface SmsSecretPayload {
  phone: string;
  pendingCode?: string;
  pendingExpiresAt?: number;
}

/** Pure helper: given a verified factor row + raw code, decide if it matches. */
export async function verifyChallengeCode(
  factor: any,
  code: string,
): Promise<boolean> {
  if (!factor || factor.verifiedAt === null) return false;
  if (factor.kind === "totp") {
    try {
      const secret = envelopeDecrypt(factor.secret);
      return verifyTotpToken(code, secret);
    } catch {
      return false;
    }
  }
  if (factor.kind === "sms") {
    try {
      const payload = JSON.parse(envelopeDecrypt(factor.secret)) as SmsSecretPayload;
      if (!payload.pendingCode || !payload.pendingExpiresAt) return false;
      if (payload.pendingExpiresAt <= Date.now()) return false;
      return payload.pendingCode === code;
    } catch {
      return false;
    }
  }
  return false;
}

export function registerMfaChallengeRoutes(app: Express) {
  app.post("/api/mfa/challenge", async (req: Request, res: Response) => {
    try {
      const cookies = parseCookieHeader(req.headers.cookie ?? "");
      const pendingCookie = cookies[MFA_PENDING_COOKIE];
      const pending = await verifyMfaPending(pendingCookie);
      if (!pending) {
        res.status(401).json({ error: "challenge_expired" });
        return;
      }

      const body = req.body ?? {};
      const factorId =
        typeof body.factorId === "number" ? body.factorId : undefined;
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const recoveryCode =
        typeof body.recoveryCode === "string"
          ? body.recoveryCode.trim()
          : undefined;

      const cookieOptions = getSessionCookieOptions(req);

      // Recovery-code path: one-shot burn against any unused row.
      if (recoveryCode && !code) {
        const unused = await db.listUnusedRecoveryCodesForUser(pending.userId);
        const candidate = recoveryCode.replace(/\s+/g, "").toUpperCase();
        const match = unused.find(
          r => r.usedAt === null && verifyRecoveryCode(candidate, r.codeHash),
        );
        if (!match) {
          await db.appendLoginAudit({
            userId: pending.userId,
            provider: "credentials",
            outcome: "failed",
            reason: "mfa_challenge_recovery_invalid",
            ip: reqIp(req),
            userAgent: reqUa(req),
          });
          res.status(401).json({ error: "invalid_code" });
          return;
        }
        await db.markRecoveryCodeUsed(match.id);
        await issueRealSession({ pending, req, res, cookieOptions });
        await db.appendLoginAudit({
          userId: pending.userId,
          provider: "credentials",
          outcome: "success",
          reason: "mfa_challenge_passed_via_recovery",
          ip: reqIp(req),
          userAgent: reqUa(req),
        });
        res.status(200).json({ ok: true, next: sanitiseNext(pending.next) });
        return;
      }

      if (!factorId || !code) {
        res.status(400).json({ error: "factor_and_code_required" });
        return;
      }

      const factor = await db.getMfaFactorById(factorId);
      if (
        !factor ||
        factor.userId !== pending.userId ||
        factor.verifiedAt === null
      ) {
        res.status(404).json({ error: "factor_not_found" });
        return;
      }
      if (
        typeof factor.lockedUntilMs === "number" &&
        factor.lockedUntilMs > Date.now()
      ) {
        res.status(429).json({ error: "factor_locked" });
        return;
      }

      const ok = await verifyChallengeCode(factor, code);
      if (!ok) {
        const next = await db.bumpMfaFactorFailure(factor.id, {
          maxFailedAttempts: MAX_FAILED_ATTEMPTS,
          lockWindowMs: LOCK_WINDOW_MS,
        });
        await db.appendLoginAudit({
          userId: pending.userId,
          provider: "credentials",
          outcome: "failed",
          reason: `mfa_challenge_failed (factor=${factor.kind}, attempt=${next ?? "?"})`,
          ip: reqIp(req),
          userAgent: reqUa(req),
        });
        res.status(401).json({ error: "invalid_code" });
        return;
      }

      await db.clearMfaFactorFailure(factor.id);
      await issueRealSession({ pending, req, res, cookieOptions });
      await db.appendLoginAudit({
        userId: pending.userId,
        provider: "credentials",
        outcome: "success",
        reason: `mfa_challenge_passed (factor=${factor.kind})`,
        ip: reqIp(req),
        userAgent: reqUa(req),
      });
      res.status(200).json({ ok: true, next: sanitiseNext(pending.next) });
    } catch (err) {
      console.error("[MFA] challenge failed:", err);
      res.status(500).json({ error: "internal" });
    }
  });

  /** Status endpoint: tells the frontend whether a pending challenge exists. */
  app.get("/api/mfa/challenge/status", async (req: Request, res: Response) => {
    try {
      const cookies = parseCookieHeader(req.headers.cookie ?? "");
      const pendingCookie = cookies[MFA_PENDING_COOKIE];
      const pending = await verifyMfaPending(pendingCookie);
      if (!pending) {
        res.status(401).json({ active: false });
        return;
      }
      const factors = await db.listVerifiedMfaFactorsForUser(pending.userId);
      res.json({
        active: true,
        next: sanitiseNext(pending.next),
        factors: factors.map(f => ({
          id: f.id,
          kind: f.kind,
          label: f.label,
          phoneHint: (f as any).phoneHint ?? null,
          primary: f.primary === 1 || (f as any).primary === true,
        })),
      });
    } catch (err) {
      console.error("[MFA] status failed:", err);
      res.status(500).json({ active: false });
    }
  });
}

async function issueRealSession(args: {
  pending: { openId: string; name: string };
  req: Request;
  res: Response;
  cookieOptions: ReturnType<typeof getSessionCookieOptions>;
}) {
  const token = await sdk.createSessionToken(args.pending.openId, {
    expiresInMs: getSessionTtlMs(),
    name: args.pending.name,
  });
  args.res.cookie(COOKIE_NAME, token, {
    ...args.cookieOptions,
    maxAge: getSessionTtlMs(),
  });
  args.res.cookie(MFA_PENDING_COOKIE, "", { ...args.cookieOptions, maxAge: 0 });
}
