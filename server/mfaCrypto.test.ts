import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
});

describe("envelopeEncrypt / envelopeDecrypt", () => {
  it("round-trips arbitrary plaintext", async () => {
    const { envelopeEncrypt, envelopeDecrypt } = await import("./_core/mfaCrypto");
    const plain = "JBSWY3DPEHPK3PXP";
    const ct = envelopeEncrypt(plain);
    expect(ct.startsWith("v1:")).toBe(true);
    expect(envelopeDecrypt(ct)).toBe(plain);
  });

  it("rejects tampered ciphertext", async () => {
    const { envelopeEncrypt, envelopeDecrypt } = await import("./_core/mfaCrypto");
    const ct = envelopeEncrypt("topsecret");
    const tampered = ct.slice(0, -2) + "AA";
    expect(() => envelopeDecrypt(tampered)).toThrow();
  });
});

describe("hashPhoneNumber / verifyPhoneHash", () => {
  it("verifies the same phone but rejects a different one", async () => {
    const { hashPhoneNumber, verifyPhoneHash } = await import("./_core/mfaCrypto");
    const stored = hashPhoneNumber("+31 6 1234 5678");
    expect(verifyPhoneHash("+31612345678", stored)).toBe(true);
    expect(verifyPhoneHash("+31600000000", stored)).toBe(false);
  });
});

describe("recovery codes", () => {
  it("generates 10 codes that match their hashes", async () => {
    const { generateRecoveryCodes, verifyRecoveryCode } = await import(
      "./_core/mfaCrypto"
    );
    const { plaintext, hashes } = generateRecoveryCodes(10);
    expect(plaintext).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    for (let i = 0; i < 10; i += 1) {
      expect(verifyRecoveryCode(plaintext[i], hashes[i])).toBe(true);
    }
    // wrong code rejected
    expect(verifyRecoveryCode("WRONG-CODE", hashes[0])).toBe(false);
  });
});
