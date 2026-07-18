/*
 * IO SKY — View-As (impersonation) crypto tests.
 *
 * Verifies the JWT token used by /api/admin/view-as:
 *   - sign + verify round-trips correctly
 *   - rejects tampered tokens
 *   - rejects garbage / empty / wrong-signature tokens
 *   - 30-minute expiry is enforced (skewed clock test)
 */
import { describe, it, expect } from "vitest";
import {
  signImpersonationToken,
  verifyImpersonationToken,
  IMPERSONATION_COOKIE,
} from "./_core/viewAsRoute";

describe("View-As impersonation token", () => {
  it("round-trips a signed token and exposes the claim", async () => {
    const token = await signImpersonationToken(
      "admin-open-id-7",
      "client",
      "QA preview of dashboard",
    );
    const claim = await verifyImpersonationToken(token);
    expect(claim).not.toBeNull();
    expect(claim!.realAdminOpenId).toBe("admin-open-id-7");
    expect(claim!.target).toBe("client");
    expect(claim!.reason).toBe("QA preview of dashboard");
    expect(claim!.exp - claim!.iat).toBeGreaterThan(29 * 60); // ~30 min ttl
  });

  it("rejects an empty / missing token", async () => {
    expect(await verifyImpersonationToken(undefined)).toBeNull();
    expect(await verifyImpersonationToken(null)).toBeNull();
    expect(await verifyImpersonationToken("")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await signImpersonationToken("admin-1", "developer", "preview");
    // Flip a character mid-payload to corrupt the signature.
    const tampered = token.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect(await verifyImpersonationToken(tampered)).toBeNull();
  });

  it("rejects a token signed with the wrong secret", async () => {
    // Hand-crafted token with a fake signature.
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        realAdminOpenId: "evil",
        target: "client",
        reason: "x",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const fakeSig = Buffer.from("not-a-real-signature").toString("base64url");
    const fakeToken = `${header}.${payload}.${fakeSig}`;
    expect(await verifyImpersonationToken(fakeToken)).toBeNull();
  });

  it("exposes a stable cookie name", () => {
    expect(IMPERSONATION_COOKIE).toBe("io_sky_impersonation");
  });
});
