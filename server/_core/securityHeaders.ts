/**
 * Milestone 3 §3.3 (RM-86): security response headers via helmet.
 *
 * Before this, the Express app sent no security headers at all — no CSP, no
 * HSTS, no frame-ancestors protection, and `X-Powered-By: Express` advertised
 * the stack on every response.
 *
 * The Content-Security-Policy is deliberately environment-dependent:
 *
 *   development — CSP is OFF. Vite's dev server injects inline module
 *     preambles and opens a websocket for HMR; every workable dev CSP ends up
 *     so permissive ('unsafe-inline' + 'unsafe-eval' + ws:) that it provides
 *     no real protection while still being able to break HMR in confusing
 *     ways. Enforcing it only in production keeps the production policy tight
 *     instead of watering it down to something dev can tolerate.
 *
 *   production — CSP is ON, with an allowlist derived from what
 *     `client/index.html` and `client/src/index.css` actually load:
 *       fonts.googleapis.com   stylesheet
 *       fonts.gstatic.com      font files
 *       *.supabase.co          branding assets, storage objects, auth/REST API
 *       d2xsxph8kpxj0f.cloudfront.net  preconnected asset host
 *     plus the analytics endpoint, which is configurable rather than
 *     hardcoded (Milestone 2 §2.2 repointed the beacon off Manus
 *     infrastructure, so the host is deployment-specific).
 *
 * `styleSrc` keeps 'unsafe-inline' in production: the app ships inline style
 * attributes from Tailwind/Radix/framer-motion, and there is no nonce plumbing
 * on the static-file path. That is a real, deliberate limitation rather than an
 * oversight — documented here so it shows up in review instead of being
 * silently inherited. `scriptSrc` does NOT get 'unsafe-inline'.
 */
import helmet from "helmet";
import type { Express } from "express";

/** Hosts the production bundle legitimately loads from. */
const SUPABASE_WILDCARD = "https://*.supabase.co";
const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com";
const GOOGLE_FONTS_FILES = "https://fonts.gstatic.com";
const CLOUDFRONT_ASSETS = "https://d2xsxph8kpxj0f.cloudfront.net";

/**
 * The analytics beacon host, read fresh from the environment.
 *
 * Returns an empty list when unset so an unconfigured deployment gets a
 * *tighter* policy rather than a broken one — the beacon simply does not load.
 */
function analyticsOrigins(): string[] {
  const raw = process.env.VITE_ANALYTICS_ENDPOINT?.trim();
  if (!raw) return [];
  try {
    return [new URL(raw).origin];
  } catch {
    // A malformed endpoint must not take the whole server down at boot.
    console.warn(
      "[Security] VITE_ANALYTICS_ENDPOINT is not a valid absolute URL; omitting it from the CSP.",
    );
    return [];
  }
}

/**
 * Extra origins an operator can allow without a code change — comma-separated.
 * Exists because CDN/storage hosts are deployment-specific and the hosting
 * provider is still an open decision (Milestone 3 §3.2 RM-74); without this,
 * the first deployment onto a different asset host would require a patch
 * release rather than a config change.
 */
function extraConnectOrigins(): string[] {
  return (process.env.CSP_EXTRA_CONNECT_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function registerSecurityHeaders(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";

  // Never advertise the framework. Independent of helmet's own config so it
  // applies in development too.
  app.disable("x-powered-by");

  app.use(
    helmet({
      // Enforced in production only — see the file header for why.
      contentSecurityPolicy: isProduction
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              // No 'unsafe-inline' / 'unsafe-eval': the production bundle is
              // built by Vite into real script files.
              scriptSrc: ["'self'", ...analyticsOrigins()],
              // See header note — inline styles are load-bearing here.
              styleSrc: ["'self'", "'unsafe-inline'", GOOGLE_FONTS_CSS],
              fontSrc: ["'self'", GOOGLE_FONTS_FILES, "data:"],
              imgSrc: ["'self'", "data:", "blob:", SUPABASE_WILDCARD, CLOUDFRONT_ASSETS],
              connectSrc: [
                "'self'",
                SUPABASE_WILDCARD,
                "https://*.supabase.in",
                ...analyticsOrigins(),
                ...extraConnectOrigins(),
              ],
              // The app never embeds plugins or Flash-era objects.
              objectSrc: ["'none'"],
              // Clickjacking protection; supersedes X-Frame-Options for
              // browsers that support it (helmet still sets both).
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,

      // HSTS only makes sense once TLS actually terminates in front of the
      // app. Sending it from a plain-HTTP dev server would pin localhost to
      // HTTPS in the developer's browser and is genuinely painful to undo.
      hsts: isProduction
        ? { maxAge: 15_552_000, includeSubDomains: true, preload: false }
        : false,

      // Cross-origin isolation headers: COEP is deliberately left off. It
      // would block the third-party font/branding assets above unless every
      // one of them served CORP headers, which is not under our control.
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
}
