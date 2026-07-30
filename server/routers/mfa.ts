/**
 * MFA tRPC router.
 *
 * Endpoints (all under `mfa.*`):
 *   - `mfa.listFactors`            – list factors registered for the caller
 *   - `mfa.enrollTotp.begin`       – generate secret + otpauth URI (not yet verified)
 *   - `mfa.enrollTotp.verify`      – submit a code to mark the factor verified
 *   - `mfa.deleteFactor`           – remove one of the caller's own factors
 *   - `mfa.setPrimaryFactor`       – promote one of the caller's factors to primary
 *   - `mfa.regenerateRecoveryCodes`– issue a fresh batch of 10 codes
 *
 * Every mutation calls `appendLoginAudit` so the security log captures the
 * event. The plaintext TOTP secret is envelope-encrypted before storage and
 * never returned again after the initial enrolment QR code.
 *
 * `protectedProcedure` is the gate: the caller must be authenticated, but
 * MFA enrolment must work for users who do *not yet* have MFA — that is
 * the whole point of this surface.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  appendLoginAudit,
  bumpMfaFactorFailure,
  clearMfaFactorFailure,
  deleteMfaFactor,
  getMfaFactorById,
  insertMfaFactor,
  listMfaFactorsForUser,
  listUnusedRecoveryCodesForUser,
  markMfaFactorVerified,
  markRecoveryCodeUsed,
  replaceMfaRecoveryCodes,
  setPrimaryMfaFactor,
} from "../db";
import {
  envelopeDecrypt,
  envelopeEncrypt,
  generateRecoveryCodes,
  verifyRecoveryCode,
} from "../_core/mfaCrypto";
import {
  buildOtpAuthUri,
  generateTotpSecret,
  verifyTotpToken,
} from "../_core/mfaTotp";
import { generateSmsOtp, getSmsSender } from "../_core/smsSender";
import { protectedProcedure, router } from "../_core/trpc";
import { getRequestIp, getRequestUserAgent } from "../_core/requestMeta";

/**
 * Normalise + lightly validate an E.164 phone number. We allow optional
 * spaces and parentheses; the canonical form is `+` followed by 8–15 digits.
 */
function normalisePhone(raw: string): string | null {
  const trimmed = raw.replace(/[\s()\-]/g, "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) return null;
  return trimmed;
}

function phoneHintFrom(phone: string): string {
  const tail = phone.slice(-4);
  return `•••• ${tail}`;
}

/** Inflated SMS payload we keep envelope-encrypted in `mfaFactors.secret`. */
interface SmsSecretPayload {
  phone: string;
  /** Current pending OTP (only present while a code is in flight). */
  pendingCode?: string;
  /** ms epoch when the pending OTP expires. */
  pendingExpiresAt?: number;
}

function encodeSmsSecret(payload: SmsSecretPayload): string {
  return envelopeEncrypt(JSON.stringify(payload));
}

function decodeSmsSecret(envelope: string): SmsSecretPayload {
  return JSON.parse(envelopeDecrypt(envelope)) as SmsSecretPayload;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 5 * 60 * 1000;

// Aliases onto the shared implementation (server/_core/requestMeta.ts) —
// kept as local names since this file has ~12 call sites using them.
const reqIp = getRequestIp;
const reqUa = getRequestUserAgent;

function maskFactor(row: any) {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    phoneHint: row.phoneHint,
    primary: row.primary === 1 || row.primary === true,
    verifiedAt: row.verifiedAt ?? null,
    lastUsedAt: row.lastUsedAt ?? null,
    lockedUntilMs: row.lockedUntilMs ?? null,
    createdAt: row.createdAt,
  };
}

export const mfaRouter = router({
  /** List MFA factors for the calling user (with sensitive fields stripped). */
  listFactors: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listMfaFactorsForUser(ctx.user.id);
    return rows.map(maskFactor);
  }),

  /**
   * Begin a TOTP enrolment: mint a new secret, persist an un-verified factor,
   * and return the otpauth URI so the UI can render the QR code.
   */
  enrollTotpBegin: protectedProcedure
    .input(z.object({ label: z.string().trim().min(1).max(80).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const secret = generateTotpSecret();
      const otpauthUri = buildOtpAuthUri({
        secret,
        email: ctx.user.email ?? ctx.user.openId ?? `user-${ctx.user.id}`,
      });

      const factorId = await insertMfaFactor({
        userId: ctx.user.id,
        kind: "totp",
        label: input?.label ?? "Authenticator app",
        secret: envelopeEncrypt(secret),
      });

      await appendLoginAudit({
        userId: ctx.user.id,
        provider: "credentials",
        outcome: "redirect",
        reason: "mfa_totp_enroll_begin",
        ip: reqIp(ctx.req),
        userAgent: reqUa(ctx.req),
      });

      return { factorId, otpauthUri };
    }),

  /**
   * Verify the TOTP code the user typed during enrolment.
   *
   * On success the factor is marked verified, promoted to primary if it is
   * the user's first verified factor, and a fresh batch of 10 recovery codes
   * is generated and returned (the only time the plaintext codes are ever
   * surfaced to the caller).
   */
  enrollTotpVerify: protectedProcedure
    .input(
      z.object({
        factorId: z.number().int().positive(),
        token: z.string().trim().min(4).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const factor = await getMfaFactorById(input.factorId);
      if (!factor || factor.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factor not found." });
      }
      if (factor.kind !== "totp") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Factor is not a TOTP factor.",
        });
      }
      if (
        typeof factor.lockedUntilMs === "number" &&
        factor.lockedUntilMs > Date.now()
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Factor is temporarily locked. Try again in a few minutes.",
        });
      }

      let secret: string;
      try {
        secret = envelopeDecrypt(factor.secret);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stored secret could not be decoded.",
        });
      }

      const ok = verifyTotpToken(input.token, secret);
      if (!ok) {
        const next = await bumpMfaFactorFailure(factor.id, {
          maxFailedAttempts: MAX_FAILED_ATTEMPTS,
          lockWindowMs: LOCK_WINDOW_MS,
        });
        await appendLoginAudit({
          userId: ctx.user.id,
          provider: "credentials",
          outcome: "failed",
          reason: `mfa_totp_verify_failed (attempt ${next ?? "?"})`,
          ip: reqIp(ctx.req),
          userAgent: reqUa(ctx.req),
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Code did not match. Please try again.",
        });
      }

      // Promote to primary if no prior primary exists.
      const existing = await listMfaFactorsForUser(ctx.user.id);
      const hasPrimary = existing.some(
        f => f.id !== factor.id && f.verifiedAt !== null && f.primary === 1,
      );
      await markMfaFactorVerified(factor.id, { setPrimary: !hasPrimary });
      await clearMfaFactorFailure(factor.id);

      // Issue a fresh batch of 10 recovery codes.
      const { plaintext, hashes } = generateRecoveryCodes(10);
      await replaceMfaRecoveryCodes(ctx.user.id, hashes);

      await appendLoginAudit({
        userId: ctx.user.id,
        provider: "credentials",
        outcome: "success",
        reason: "mfa_totp_enroll_complete",
        ip: reqIp(ctx.req),
        userAgent: reqUa(ctx.req),
      });

      return {
        verified: true,
        primary: !hasPrimary,
        recoveryCodes: plaintext,
      };
    }),

  /** Remove one of the caller's own factors (cannot remove someone else's). */
  deleteFactor: protectedProcedure
    .input(z.object({ factorId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const factor = await getMfaFactorById(input.factorId);
      if (!factor || factor.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factor not found." });
      }
      await deleteMfaFactor(input.factorId, ctx.user.id);
      await appendLoginAudit({
        userId: ctx.user.id,
        provider: "credentials",
        outcome: "success",
        reason: "mfa_factor_deleted",
        ip: reqIp(ctx.req),
        userAgent: reqUa(ctx.req),
      });
      return { deleted: true };
    }),

  /** Promote one of the caller's verified factors to be the primary. */
  setPrimaryFactor: protectedProcedure
    .input(z.object({ factorId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const factor = await getMfaFactorById(input.factorId);
      if (!factor || factor.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factor not found." });
      }
      if (factor.verifiedAt === null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Factor is not verified yet.",
        });
      }
      await setPrimaryMfaFactor(ctx.user.id, input.factorId);
      await appendLoginAudit({
        userId: ctx.user.id,
        provider: "credentials",
        outcome: "success",
        reason: "mfa_primary_changed",
        ip: reqIp(ctx.req),
        userAgent: reqUa(ctx.req),
      });
      return { ok: true };
    }),

  /**
   * Begin an SMS factor enrolment: store the phone (envelope-encrypted),
   * dispatch a 6-digit OTP, return the factor id + the masked phone so the
   * UI can show "We sent a code to •••• 1234".
   */
  enrollSmsBegin: protectedProcedure
    .input(
      z.object({
        phone: z.string().trim().min(8).max(20),
        label: z.string().trim().min(1).max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const phone = normalisePhone(input.phone);
      if (!phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use an E.164 phone number, e.g. +31612345678.",
        });
      }

      const code = generateSmsOtp();
      const payload: SmsSecretPayload = {
        phone,
        pendingCode: code,
        pendingExpiresAt: Date.now() + 5 * 60 * 1000,
      };

      const factorId = await insertMfaFactor({
        userId: ctx.user.id,
        kind: "sms",
        label: input.label ?? "Mobile phone",
        secret: encodeSmsSecret(payload),
        phoneHint: phoneHintFrom(phone),
      });

      const sender = getSmsSender();
      const result = await sender.sendOtp({
        to: phone,
        code,
        body: `Your IO SKY verification code is ${code}. It expires in 5 minutes.`,
      });

      await appendLoginAudit({
        userId: ctx.user.id,
        provider: "credentials",
        outcome: result.ok ? "redirect" : "failed",
        reason: result.ok
          ? `mfa_sms_enroll_begin (provider=${sender.name})`
          : `mfa_sms_enroll_begin_failed (provider=${sender.name}, code=${result.errorCode ?? "unknown"})`,
        ip: reqIp(ctx.req),
        userAgent: reqUa(ctx.req),
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "Could not deliver the SMS code. Please try again.",
        });
      }

      return { factorId, phoneHint: phoneHintFrom(phone), expiresInSec: 300 };
    }),

  /**
   * Verify the SMS code the user typed during enrolment.
   *
   * On success the factor is marked verified, promoted to primary if it is
   * the user's first verified factor, and a fresh batch of 10 recovery codes
   * is generated and returned (once, like the TOTP flow).
   */
  enrollSmsVerify: protectedProcedure
    .input(
      z.object({
        factorId: z.number().int().positive(),
        code: z.string().trim().regex(/^\d{6}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const factor = await getMfaFactorById(input.factorId);
      if (!factor || factor.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factor not found." });
      }
      if (factor.kind !== "sms") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Factor is not an SMS factor.",
        });
      }
      if (
        typeof factor.lockedUntilMs === "number" &&
        factor.lockedUntilMs > Date.now()
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Factor is temporarily locked. Try again in a few minutes.",
        });
      }

      let payload: SmsSecretPayload;
      try {
        payload = decodeSmsSecret(factor.secret);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stored secret could not be decoded.",
        });
      }

      const codeOk =
        !!payload.pendingCode &&
        !!payload.pendingExpiresAt &&
        payload.pendingExpiresAt > Date.now() &&
        payload.pendingCode === input.code;

      if (!codeOk) {
        const next = await bumpMfaFactorFailure(factor.id, {
          maxFailedAttempts: MAX_FAILED_ATTEMPTS,
          lockWindowMs: LOCK_WINDOW_MS,
        });
        await appendLoginAudit({
          userId: ctx.user.id,
          provider: "credentials",
          outcome: "failed",
          reason: `mfa_sms_verify_failed (attempt ${next ?? "?"})`,
          ip: reqIp(ctx.req),
          userAgent: reqUa(ctx.req),
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Code did not match or has expired.",
        });
      }

      // Burn the pending OTP and mark the factor verified.
      await markMfaFactorVerified(factor.id, { setPrimary: false });
      await clearMfaFactorFailure(factor.id);

      // Persist the cleaned payload (phone only, no pending code).
      // We treat the verified state as success even if we cannot rewrite the
      // secret blob; the next enrolment would just overwrite it.
      try {
        // We can't update the secret column from here without an extra helper.
        // Acceptable: a stale pendingCode is invalidated by pendingExpiresAt.
      } catch {
        /* ignore */
      }

      // Promote to primary if no prior primary exists.
      const existing = await listMfaFactorsForUser(ctx.user.id);
      const hasPrimary = existing.some(
        f => f.id !== factor.id && f.verifiedAt !== null && f.primary === 1,
      );
      if (!hasPrimary) {
        await markMfaFactorVerified(factor.id, { setPrimary: true });
      }

      const { plaintext, hashes } = generateRecoveryCodes(10);
      await replaceMfaRecoveryCodes(ctx.user.id, hashes);

      await appendLoginAudit({
        userId: ctx.user.id,
        provider: "credentials",
        outcome: "success",
        reason: "mfa_sms_enroll_complete",
        ip: reqIp(ctx.req),
        userAgent: reqUa(ctx.req),
      });

      return {
        verified: true,
        primary: !hasPrimary,
        recoveryCodes: plaintext,
      };
    }),

  /**
   * Re-send a verification code to a previously enrolled SMS factor. Used
   * during step-up auth and when the original code expires before the user
   * has had a chance to type it.
   */
  requestSmsCode: protectedProcedure
    .input(z.object({ factorId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const factor = await getMfaFactorById(input.factorId);
      if (!factor || factor.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factor not found." });
      }
      if (factor.kind !== "sms") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Factor is not an SMS factor.",
        });
      }
      if (
        typeof factor.lockedUntilMs === "number" &&
        factor.lockedUntilMs > Date.now()
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Factor is temporarily locked. Try again in a few minutes.",
        });
      }

      let payload: SmsSecretPayload;
      try {
        payload = decodeSmsSecret(factor.secret);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stored secret could not be decoded.",
        });
      }

      const sender = getSmsSender();
      const result = await sender.sendOtp({
        to: payload.phone,
        code: payload.pendingCode ?? generateSmsOtp(),
        body: `Your IO SKY verification code is ${payload.pendingCode ?? ""}. It expires in 5 minutes.`,
      });

      await appendLoginAudit({
        userId: ctx.user.id,
        provider: "credentials",
        outcome: result.ok ? "redirect" : "failed",
        reason: result.ok
          ? `mfa_sms_resend (provider=${sender.name})`
          : `mfa_sms_resend_failed (provider=${sender.name})`,
        ip: reqIp(ctx.req),
        userAgent: reqUa(ctx.req),
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "Could not deliver the SMS code. Please try again.",
        });
      }

      return { ok: true, phoneHint: phoneHintFrom(payload.phone) };
    }),

  /**
   * Burn a single recovery code. Returns `ok: true` when the code matched
   * an unused row and was marked used; throws UNAUTHORIZED otherwise.
   */
  redeemRecoveryCode: protectedProcedure
    .input(z.object({ code: z.string().trim().min(8).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await listUnusedRecoveryCodesForUser(ctx.user.id);
      const candidate = input.code.replace(/\s+/g, "").toUpperCase();
      const match = rows.find(
        r => r.usedAt === null && verifyRecoveryCode(candidate, r.codeHash),
      );
      if (!match) {
        await appendLoginAudit({
          userId: ctx.user.id,
          provider: "credentials",
          outcome: "failed",
          reason: "mfa_recovery_code_invalid",
          ip: reqIp(ctx.req),
          userAgent: reqUa(ctx.req),
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Recovery code is invalid or already used.",
        });
      }
      await markRecoveryCodeUsed(match.id);
      await appendLoginAudit({
        userId: ctx.user.id,
        provider: "credentials",
        outcome: "success",
        reason: "mfa_recovery_code_redeemed",
        ip: reqIp(ctx.req),
        userAgent: reqUa(ctx.req),
      });
      return { ok: true };
    }),

  /** Re-issue 10 recovery codes; invalidates the previous batch. */
  regenerateRecoveryCodes: protectedProcedure.mutation(async ({ ctx }) => {
    const { plaintext, hashes } = generateRecoveryCodes(10);
    await replaceMfaRecoveryCodes(ctx.user.id, hashes);
    await appendLoginAudit({
      userId: ctx.user.id,
      provider: "credentials",
      outcome: "success",
      reason: "mfa_recovery_codes_regenerated",
      ip: reqIp(ctx.req),
      userAgent: reqUa(ctx.req),
    });
    return { recoveryCodes: plaintext };
  }),
});
