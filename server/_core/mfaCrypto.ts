/**
 * MFA cryptography helpers.
 *
 * Two responsibilities:
 *
 *   1. **Envelope encryption** for at-rest secrets (TOTP shared key, salted
 *      SMS phone hash). Uses AES-256-GCM with a per-process key derived from
 *      `JWT_SECRET` via HKDF-SHA256 (label `io-sky/mfa-envelope/v1`).
 *
 *   2. **Recovery-code hashing**. Codes are stored as scrypt(N=2^14, r=8, p=1)
 *      with a per-row salt. Verification uses a constant-time compare.
 *
 * The module exports pure functions and is fully unit-testable. It does not
 * touch the database or the OTP libraries — those layers live elsewhere.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const ENV_LABEL = Buffer.from("io-sky/mfa-envelope/v1");
const ENV_SALT = Buffer.from("io-sky/mfa-envelope/salt/v1");

function getMasterKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short; MFA crypto cannot derive a master key.",
    );
  }
  // hkdfSync returns ArrayBuffer; coerce to Buffer for downstream APIs.
  const derived = hkdfSync("sha256", Buffer.from(secret), ENV_SALT, ENV_LABEL, 32);
  return Buffer.from(derived);
}

/**
 * Encrypt a UTF-8 plaintext string. The output is a self-describing string
 * of the form `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>` so we can rotate the
 * scheme later by changing the prefix.
 */
export function envelopeEncrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Reverse of {@link envelopeEncrypt}. Throws on tamper or wrong key. */
export function envelopeDecrypt(envelope: string): string {
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Malformed envelope: expected v1:<iv>:<tag>:<ct>");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = getMasterKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/**
 * Hash a phone number for "I recognise this device" lookups without storing
 * plaintext. Output is `sha256:<salt-b64>:<hmac-b64>` so we can rotate salts
 * if needed. Uses HMAC-SHA256 over a per-row 16-byte salt.
 */
export function hashPhoneNumber(phone: string): string {
  const normalised = phone.replace(/\s+/g, "").trim();
  const salt = randomBytes(16);
  const hmac = createHmac("sha256", salt);
  hmac.update(normalised, "utf8");
  return `sha256:${salt.toString("base64")}:${hmac.digest("base64")}`;
}

/** Constant-time compare of a candidate phone against a stored hash. */
export function verifyPhoneHash(candidate: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "sha256") return false;
  const [, saltB64, digestB64] = parts;
  const hmac = createHmac("sha256", Buffer.from(saltB64, "base64"));
  hmac.update(candidate.replace(/\s+/g, "").trim(), "utf8");
  const want = Buffer.from(digestB64, "base64");
  const got = hmac.digest();
  if (want.length !== got.length) return false;
  return timingSafeEqual(want, got);
}

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/**
 * Generate 10 user-facing recovery codes of the form `XXXX-XXXX`, plus their
 * server-side scrypt hashes for storage. The plaintext codes are returned
 * once and must be shown to the user immediately; they are not recoverable
 * after this call.
 */
export function generateRecoveryCodes(count = 10): {
  plaintext: string[];
  hashes: string[];
} {
  const plaintext: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let code = "";
    const buf = randomBytes(8);
    for (let j = 0; j < 8; j += 1) {
      code += RECOVERY_ALPHABET[buf[j] % RECOVERY_ALPHABET.length];
      if (j === 3) code += "-";
    }
    plaintext.push(code);
    hashes.push(hashRecoveryCode(code));
  }
  return { plaintext, hashes };
}

/** Hash a single recovery code for storage (scrypt + per-row salt). */
export function hashRecoveryCode(code: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(code.replace(/-/g, "").toUpperCase(), salt, 32, {
    N: 1 << 14,
    r: 8,
    p: 1,
  });
  return `scrypt:${salt.toString("base64")}:${dk.toString("base64")}`;
}

/** Constant-time compare a recovery code against its stored hash. */
export function verifyRecoveryCode(code: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltB64, dkB64] = parts;
  const want = Buffer.from(dkB64, "base64");
  const got = scryptSync(
    code.replace(/-/g, "").toUpperCase(),
    Buffer.from(saltB64, "base64"),
    want.length,
    { N: 1 << 14, r: 8, p: 1 },
  );
  if (want.length !== got.length) return false;
  return timingSafeEqual(want, got);
}
