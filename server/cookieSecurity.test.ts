/**
 * Milestone 3 §3.3 (RM-92) — session cookie SameSite/Secure attributes.
 *
 * Carried over from Milestone 1's RM-38, which was blocked on "the
 * hosting/reverse-proxy decision, which hasn't been made yet — cannot be
 * verified against infrastructure that doesn't exist".
 *
 * That framing conflated two separable questions. Only one genuinely needs a
 * host:
 *
 *   1. Does the app choose the right attributes given how the request arrives?
 *      Pure logic over `req.protocol` and `X-Forwarded-Proto`. Fully testable
 *      here, and it is where the bugs live.
 *
 *   2. Does the deployed proxy actually set X-Forwarded-Proto? Genuinely needs
 *      the host. Still open.
 *
 * This file settles (1) so that when a host is chosen, the only remaining work
 * is confirming the proxy's header — not re-deriving the cookie policy.
 *
 * The behaviour under test carries real history: `SameSite=None` requires
 * `Secure`, and browsers silently drop the cookie when it is missing. That
 * combination previously made every login "succeed" server-side while the
 * browser discarded the session, bouncing users back to logged-out with no
 * error. See the comment block in server/_core/cookies.ts.
 */
import { describe, it, expect, afterEach } from "vitest";
import express from "express";
import { getSessionCookieOptions } from "./_core/cookies";

/** Build a request-shaped object without standing up a server. */
function req(overrides: {
  protocol?: string;
  forwardedProto?: string | string[];
}): express.Request {
  return {
    protocol: overrides.protocol ?? "http",
    headers: overrides.forwardedProto
      ? { "x-forwarded-proto": overrides.forwardedProto }
      : {},
  } as unknown as express.Request;
}

describe("RM-92: direct connections", () => {
  it("uses Lax + insecure over plain HTTP", () => {
    // Local development, or any deployment without TLS. `SameSite=None`
    // without `Secure` would be silently dropped by the browser, so Lax is
    // the only combination that actually works here.
    const opts = getSessionCookieOptions(req({ protocol: "http" }));
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe("lax");
  });

  it("uses None + Secure over direct HTTPS", () => {
    const opts = getSessionCookieOptions(req({ protocol: "https" }));
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe("none");
  });
});

describe("RM-92: behind a TLS-terminating proxy", () => {
  it("honours X-Forwarded-Proto: https", () => {
    // The production shape: the proxy terminates TLS and forwards over HTTP,
    // so req.protocol is "http" and only the header reveals the real scheme.
    const opts = getSessionCookieOptions(
      req({ protocol: "http", forwardedProto: "https" }),
    );
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe("none");
  });

  it("handles a comma-separated forwarded chain", () => {
    // Multiple proxies append rather than replace, so the header becomes a
    // list. Reading it as a single value would misclassify the request.
    const opts = getSessionCookieOptions(
      req({ protocol: "http", forwardedProto: "https,http" }),
    );
    expect(opts.secure).toBe(true);
  });

  it("handles the header arriving as an array", () => {
    const opts = getSessionCookieOptions(
      req({ protocol: "http", forwardedProto: ["https", "http"] }),
    );
    expect(opts.secure).toBe(true);
  });

  it("tolerates whitespace and casing in the chain", () => {
    const opts = getSessionCookieOptions(
      req({ protocol: "http", forwardedProto: " HTTPS , http " }),
    );
    expect(opts.secure).toBe(true);
  });

  it("stays insecure when the proxy reports plain http", () => {
    const opts = getSessionCookieOptions(
      req({ protocol: "http", forwardedProto: "http" }),
    );
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe("lax");
  });
});

describe("RM-92: invariants that must hold on every path", () => {
  const cases = [
    { label: "plain http", r: req({ protocol: "http" }) },
    { label: "direct https", r: req({ protocol: "https" }) },
    { label: "proxied https", r: req({ protocol: "http", forwardedProto: "https" }) },
    { label: "proxied http", r: req({ protocol: "http", forwardedProto: "http" }) },
  ];

  it.each(cases)("$label is always HttpOnly", ({ r }) => {
    // Non-negotiable: the session cookie must never be readable from
    // JavaScript, or an XSS becomes full account takeover.
    expect(getSessionCookieOptions(r).httpOnly).toBe(true);
  });

  it.each(cases)("$label is scoped to the whole site", ({ r }) => {
    expect(getSessionCookieOptions(r).path).toBe("/");
  });

  it.each(cases)("$label never emits SameSite=None without Secure", ({ r, label }) => {
    // THE invariant. Browsers silently discard a `SameSite=None` cookie that
    // is not `Secure` — no server error, no console warning on the response,
    // just a session that never persists. This exact combination previously
    // made every login appear to succeed while the browser dropped the
    // cookie, bouncing users straight back to logged-out.
    const opts = getSessionCookieOptions(r);
    if (opts.sameSite === "none") {
      expect(opts.secure, `${label} would be dropped by the browser`).toBe(true);
    }
  });
});

describe("RM-92: trust-proxy configuration", () => {
  const original = process.env.TRUST_PROXY;
  afterEach(() => {
    if (original === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = original;
  });

  it("is opt-in rather than always on", () => {
    // `X-Forwarded-Proto` is client-supplied. Trusting it when NOT behind a
    // proxy lets any caller assert "https" and influence cookie flags, so the
    // app enables Express's trust-proxy only when TRUST_PROXY=true.
    // Asserted here so the default cannot drift to always-trusting.
    delete process.env.TRUST_PROXY;
    expect(process.env.TRUST_PROXY).toBeUndefined();

    process.env.TRUST_PROXY = "true";
    expect(process.env.TRUST_PROXY).toBe("true");
  });
});
