import { describe, expect, it } from "vitest";
import { generateSync } from "otplib";

import {
  buildOtpAuthUri,
  generateTotpSecret,
  verifyTotpToken,
} from "./_core/mfaTotp";

describe("TOTP helper", () => {
  it("generates a base32 secret that can be re-used to verify a token", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThanOrEqual(16);
    const token = generateSync({
      strategy: "totp",
      secret,
      digits: 6,
      period: 30,
    });
    expect(verifyTotpToken(token, secret)).toBe(true);
  });

  it("rejects a malformed or wrong token", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken("12345", secret)).toBe(false); // too short
    expect(verifyTotpToken("abcdef", secret)).toBe(false); // non-digit
    expect(verifyTotpToken("000000", secret)).toBe(false); // overwhelmingly likely wrong
  });

  it("strips whitespace and dashes from the user-supplied token", () => {
    const secret = generateTotpSecret();
    const token = generateSync({
      strategy: "totp",
      secret,
      digits: 6,
      period: 30,
    });
    const padded = `${token.slice(0, 3)} ${token.slice(3)}`;
    expect(verifyTotpToken(padded, secret)).toBe(true);
  });

  it("renders an otpauth URI with the IO SKY issuer and the user's email", () => {
    const secret = generateTotpSecret();
    const uri = buildOtpAuthUri({ secret, email: "dev@io-sky.io" });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("IO%20SKY");
    expect(uri).toContain("dev%40io-sky.io");
    expect(uri).toContain(`secret=${secret}`);
  });
});
