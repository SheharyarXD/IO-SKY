/**
 * TOTP helpers (RFC 6238) for IO SKY MFA.
 *
 * Wraps the functional `otplib` v13 API with sensible defaults:
 *  - SHA-1 digest, 6 digits, 30 s period (most authenticator-app defaults)
 *  - ±30 s epoch tolerance, so a code is accepted from one step before to
 *    one step after the current time
 *  - Issuer `IO SKY`, label set to the user's email
 *
 * The plaintext base32 secret is **never** persisted directly; callers must
 * envelope-encrypt it via `mfaCrypto.envelopeEncrypt`.
 */

import { generateSecret, generateURI, verifySync } from "otplib";

const ISSUER = "IO SKY";
const PERIOD_SECONDS = 30;
const DIGITS = 6;
const EPOCH_TOLERANCE = PERIOD_SECONDS; // ±1 step

/** Generate a fresh base32 secret for a new authenticator pairing. */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * Build an `otpauth://` provisioning URI that authenticator apps can scan.
 * Always rendered with the `IO SKY` issuer so multiple deployments stay
 * visually distinct in the user's authenticator list.
 */
export function buildOtpAuthUri(opts: { secret: string; email: string }): string {
  return generateURI({
    strategy: "totp",
    issuer: ISSUER,
    label: opts.email,
    secret: opts.secret,
    digits: DIGITS,
    period: PERIOD_SECONDS,
  });
}

/**
 * Verify a 6-digit token (synchronously). Strips whitespace and non-digit
 * characters so users can paste `123 456` or `123-456` without grief.
 *
 * Returns `true` only if the token matches the current step or ±1 step.
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  const clean = token.replace(/[^0-9]/g, "");
  if (clean.length !== DIGITS) return false;
  try {
    const result = verifySync({
      strategy: "totp",
      secret,
      token: clean,
      digits: DIGITS,
      period: PERIOD_SECONDS,
      epochTolerance: EPOCH_TOLERANCE,
    });
    return result.valid === true;
  } catch {
    return false;
  }
}
