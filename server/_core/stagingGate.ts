/**
 * Private staging / pre-launch gate.
 *
 * When STAGING_MODE=on, every anonymous text/html request is intercepted
 * and shown a minimal pre-launch screen with a single password field.
 * Authenticated sessions (admin / developer / client) bypass the gate.
 *
 * Anyone who submits the correct STAGING_PASSWORD receives a long-lived
 * HttpOnly HMAC cookie (`iosky_staging_pass`) and can browse normally.
 *
 * API requests (/api/*) and static assets (/assets/*, /manus-storage/*)
 * are NEVER gated, so authenticated users and CI can keep working.
 *
 * Defaults are off: omitting STAGING_MODE leaves the platform fully public,
 * which is the expected behaviour after public launch.
 */
import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { requireSecret } from "./env";

const STAGING_COOKIE = "iosky_staging_pass";
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function isStagingEnabled() {
  return (process.env.STAGING_MODE ?? "").toLowerCase() === "on";
}

function getStagingSecret() {
  return requireSecret(
    "STAGING_SECRET or JWT_SECRET",
    process.env.STAGING_SECRET || process.env.JWT_SECRET,
  );
}

function hmac(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Constant-time password comparison.
 */
function safeCompare(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Read cookie value by name from the raw Cookie header.
 */
function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Returns true if the request carries a valid staging cookie
 * (signed-token form: `<issuedAt>.<hmac>`).
 */
function hasValidStagingCookie(req: Request): boolean {
  const v = readCookie(req, STAGING_COOKIE);
  if (!v) return false;
  const dot = v.lastIndexOf(".");
  if (dot < 1) return false;
  const issuedAt = v.slice(0, dot);
  const sig = v.slice(dot + 1);
  const expected = hmac(issuedAt, getStagingSecret());
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return false;
  }
  // Reject cookies older than 60 days (defensive).
  const ts = Number(issuedAt);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > 60 * 24 * 60 * 60 * 1000) return false;
  return true;
}

/**
 * Returns true if the user has any authenticated session cookie.
 * We do not validate the JWT here: this gate is defence in depth, not the
 * authoritative session layer. A forged session cookie still fails every
 * downstream tRPC `protectedProcedure`.
 */
function hasSessionCookie(req: Request): boolean {
  return Boolean(readCookie(req, COOKIE_NAME));
}

/**
 * The pre-launch HTML shown to anonymous visitors.
 * Keep it inline + framework-free so it renders even if the SPA bundle
 * is broken or in the middle of a deploy.
 */
function renderPreLaunchHtml(opts: { error?: boolean }): string {
  const errorBlock = opts.error
    ? `<div class="err" role="alert">Incorrect password. Please try again.</div>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
  <title>IO SKY \u2014 Pre-launch</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#0B1020;color:#E6EAF0;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;
      background-image:radial-gradient(60% 38% at 18% 18%,rgba(255,106,0,.10),transparent 70%),
                       radial-gradient(46% 32% at 92% 0%,rgba(120,150,255,.08),transparent 70%);
      background-attachment:fixed;padding:24px}
    .card{width:100%;max-width:440px;border:1px solid rgba(255,255,255,.08);background:rgba(26,35,51,.62);backdrop-filter:blur(14px);padding:28px 28px 26px;border-radius:6px}
    .brand{font-family:"Manrope",Inter,sans-serif;font-weight:800;letter-spacing:.18em;color:#E6EAF0;font-size:14px;margin-bottom:18px}
    .brand span{color:#FF6A00;margin-left:6px;letter-spacing:.16em}
    h1{font-family:"Manrope",Inter,sans-serif;font-size:22px;line-height:1.25;margin:0 0 6px;letter-spacing:-.01em}
    p{margin:0 0 18px;font-size:14px;line-height:1.6;color:#B6BCC8}
    label{display:block;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9AA1AE;margin-bottom:8px;font-family:"JetBrains Mono",ui-monospace,monospace}
    input{width:100%;padding:11px 13px;background:#0B1020;border:1px solid rgba(255,255,255,.10);border-radius:4px;color:#E6EAF0;font-size:15px;font-family:inherit}
    input:focus{outline:none;border-color:#FF6A00;box-shadow:0 0 0 3px rgba(255,106,0,.18)}
    button{margin-top:14px;width:100%;padding:11px 13px;background:#FF6A00;color:#0B1020;font-weight:600;border:0;border-radius:4px;font-size:14px;letter-spacing:.02em;cursor:pointer;font-family:inherit;transition:transform .16s cubic-bezier(.23,1,.32,1)}
    button:active{transform:scale(.97)}
    .err{margin:0 0 14px;padding:9px 12px;background:rgba(220,80,80,.12);border:1px solid rgba(220,80,80,.4);color:#FFB4B4;font-size:13px;border-radius:4px}
    .foot{margin-top:18px;font-size:11px;color:#7C8290;letter-spacing:.05em}
    a{color:#FF6A00;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <main class="card" role="main">
    <div class="brand">IO<span>SKY</span></div>
    <h1>Private pre-launch.</h1>
    <p>This site is currently in a private staging period. If you have an access password, enter it below. If you have an account, you can sign in directly.</p>
    ${errorBlock}
    <form method="POST" action="/api/staging/unlock" autocomplete="off">
      <label for="p">Access password</label>
      <input id="p" name="password" type="password" required autofocus aria-label="Access password" />
      <button type="submit">Continue</button>
    </form>
    <p class="foot">Have an account? <a href="/login">Sign in</a> instead.</p>
  </main>
</body>
</html>`;
}

/**
 * True if the request is for a path that should never be gated:
 *  - all /api/* (tRPC + auth + storage proxy)
 *  - all /manus-storage/* (signed asset redirects)
 *  - anything that looks like a static asset
 *  - the favicon and the robots file (we render robots ourselves below)
 *  - the pre-launch unlock endpoint and the login page
 */
function isExempt(req: Request): boolean {
  const url = req.path || req.url || "";
  if (url.startsWith("/api/")) return true;
  if (url.startsWith("/manus-storage/")) return true;
  if (url.startsWith("/assets/")) return true;
  if (url.startsWith("/__manus__/")) return true;
  if (url === "/favicon.ico" || url === "/robots.txt") return true;
  if (url === "/login") return true;
  // Static-file extensions
  if (/\.(?:js|mjs|css|map|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|otf|json|txt)$/i.test(url)) {
    return true;
  }
  return false;
}

export function registerStagingGate(app: Express) {
  // Always serve robots.txt (whether staging is on or off).
  app.get("/robots.txt", (_req: Request, res: Response) => {
    if (isStagingEnabled()) {
      res.type("text/plain").send("User-agent: *\nDisallow: /\n");
    } else {
      res.type("text/plain").send(
        "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /client-portal\nDisallow: /developer-workspace\n"
      );
    }
  });

  // Public unlock endpoint.
  app.post("/api/staging/unlock", (req: Request, res: Response) => {
    if (!isStagingEnabled()) {
      res.redirect("/");
      return;
    }
    const submitted = String((req.body as { password?: string })?.password ?? "");
    const expected = String(process.env.STAGING_PASSWORD ?? "");
    if (!expected || !safeCompare(submitted, expected)) {
      res
        .status(401)
        .type("text/html")
        .send(renderPreLaunchHtml({ error: true }));
      return;
    }
    const issuedAt = String(Date.now());
    const sig = hmac(issuedAt, getStagingSecret());
    const value = `${issuedAt}.${sig}`;
    res.cookie(STAGING_COOKIE, value, {
      ...getSessionCookieOptions(req),
      maxAge: ONE_MONTH_MS,
    });
    res.redirect("/");
  });

  // The main gate.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isStagingEnabled()) return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (isExempt(req)) return next();
    if (hasSessionCookie(req)) return next();
    if (hasValidStagingCookie(req)) return next();

    res
      .status(200)
      .type("text/html")
      .setHeader("X-Robots-Tag", "noindex, nofollow")
      .send(renderPreLaunchHtml({ error: false }));
  });
}
