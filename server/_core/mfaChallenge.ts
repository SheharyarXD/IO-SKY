/**
 * IO SKY — MFA post-login challenge cookie helper.
 *
 * After a user passes OAuth, if they have at least one verified MFA factor
 * we mint a short-lived "mfa_pending" JWT instead of the real session cookie.
 * The frontend redirects to /mfa-challenge?next=... where the user enters
 * either a TOTP/SMS code or a recovery code. On success the server swaps
 * the pending cookie for the real session cookie.
 *
 * The pending JWT is signed with the same JWT_SECRET (HS256) but carries a
 * distinct `typ` claim ("mfa_pending") so it can never be mistaken for a
 * full session token.
 */
import { ENV } from "./env";
import { SignJWT, jwtVerify } from "jose";

export const MFA_PENDING_COOKIE = "io_sky_mfa_pending";
export const MFA_PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type MfaPendingPayload = {
  /** Manus openId of the OAuth-authenticated user. */
  openId: string;
  /** Internal user.id row. */
  userId: number;
  /** Optional display name carried over from OAuth payload. */
  name: string;
  /** Sanitised post-MFA destination path (e.g. /developer-workspace). */
  next: string;
  /** Issued-at (ms) for replay diagnostics. */
  iat: number;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function signMfaPending(
  payload: Omit<MfaPendingPayload, "iat">,
  options: { ttlMs?: number } = {},
): Promise<string> {
  const ttl = options.ttlMs ?? MFA_PENDING_TTL_MS;
  const issuedAt = Date.now();
  const expSeconds = Math.floor((issuedAt + ttl) / 1000);
  return new SignJWT({
    openId: payload.openId,
    userId: payload.userId,
    name: payload.name,
    next: payload.next,
    iat: issuedAt,
  })
    .setProtectedHeader({ alg: "HS256", typ: "mfa_pending" })
    .setExpirationTime(expSeconds)
    .sign(secretKey());
}

export async function verifyMfaPending(
  token: string | undefined | null,
): Promise<MfaPendingPayload | null> {
  if (!token) return null;
  try {
    const { payload, protectedHeader } = await jwtVerify(token, secretKey());
    if (protectedHeader.typ !== "mfa_pending") return null;
    if (
      typeof payload.openId !== "string" ||
      typeof payload.userId !== "number" ||
      typeof payload.next !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      openId: payload.openId,
      userId: payload.userId,
      name: payload.name,
      next: payload.next,
      iat: typeof payload.iat === "number" ? payload.iat : Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Sanitise a return-path: must be a same-origin absolute path, no scheme,
 * no protocol-relative double slash. Falls back to "/" when invalid.
 */
export function sanitiseNext(next: string | undefined | null): string {
  if (!next) return "/";
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}
