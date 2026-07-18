/**
 * Booking action tokens — HMAC-signed, URL-safe, scoped tokens used in
 * reschedule / cancel links sent to guests by email. We deliberately do not
 * use the publicRef alone: publicRef is identifying but not authenticating.
 *
 * Token format:   <bookingId>.<action>.<expiryMs>.<hmac>
 * where hmac = base64url(HMAC-SHA256(secret, `${bookingId}.${action}.${expiryMs}`))
 */
import crypto from "node:crypto";

export type BookingAction = "reschedule" | "cancel";

function secret(): string {
  return process.env.JWT_SECRET || "iosky-dev-fallback-secret";
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function sign(payload: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(payload).digest());
}

export function makeBookingActionToken(input: {
  bookingId: number;
  action: BookingAction;
  ttlMs?: number;
}): string {
  const ttl = input.ttlMs ?? 1000 * 60 * 60 * 24 * 30; // 30d default
  const exp = Date.now() + ttl;
  const payload = `${input.bookingId}.${input.action}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export interface VerifiedToken {
  ok: true;
  bookingId: number;
  action: BookingAction;
  expiresAtMs: number;
}
export interface InvalidToken {
  ok: false;
  reason: "format" | "signature" | "expired" | "action";
}

export function verifyBookingActionToken(
  token: string,
  expectedAction: BookingAction,
): VerifiedToken | InvalidToken {
  const parts = token.split(".");
  if (parts.length !== 4) return { ok: false, reason: "format" };
  const [bookingIdRaw, action, expRaw, mac] = parts;
  const bookingId = Number(bookingIdRaw);
  const exp = Number(expRaw);
  if (!Number.isFinite(bookingId) || !Number.isFinite(exp)) {
    return { ok: false, reason: "format" };
  }
  const expected = sign(`${bookingIdRaw}.${action}.${expRaw}`);
  if (
    expected.length !== mac.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))
  ) {
    return { ok: false, reason: "signature" };
  }
  if (action !== expectedAction) return { ok: false, reason: "action" };
  if (Date.now() > exp) return { ok: false, reason: "expired" };
  return { ok: true, bookingId, action: action as BookingAction, expiresAtMs: exp };
}
