/**
 * Milestone 3 §3.3 (RM-87): explicit CORS policy.
 *
 * Before this the app registered no CORS middleware at all. That is not the
 * same as "CORS is closed" — it means the browser's default applies: simple
 * cross-origin requests still reach the handler and execute their side
 * effects, the browser just hides the *response* from the calling page. For a
 * cookie-authenticated API that is the wrong default to leave implicit.
 *
 * The policy here is deny-by-default:
 *
 *   - No `CORS_ALLOWED_ORIGINS` set → no cross-origin browser access at all.
 *     Same-origin requests are unaffected (they carry no Origin header that
 *     needs approval), so a single-origin deployment — which is what the
 *     Three-Milestone Plan describes, one Node process serving both the API
 *     and the built client — needs no configuration and gets the tightest
 *     behaviour by default.
 *
 *   - `CORS_ALLOWED_ORIGINS` set → exact-match allowlist, credentials enabled.
 *     Wildcards are rejected on purpose: `Access-Control-Allow-Origin: *`
 *     cannot be combined with credentials, and a wildcard allowlist on a
 *     cookie-authenticated API is a cross-site request forgery primitive.
 *
 * Non-browser callers (server-to-server, webhooks, curl) send no Origin header
 * and are unaffected by any of this. CORS is a browser mechanism; it is not an
 * authentication or authorisation control, and the RBAC/RLS layers remain the
 * actual boundary.
 */
import cors from "cors";
import type { Express } from "express";

/** Parse the operator-supplied allowlist. Exported for the test suite. */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .filter((o) => {
      if (o === "*") {
        console.warn(
          "[CORS] Refusing the '*' wildcard: it cannot be combined with credentialed " +
            "requests, and this API authenticates by cookie. List explicit origins instead.",
        );
        return false;
      }
      try {
        // Normalising through URL also rejects malformed entries early,
        // at boot, rather than on the first cross-origin request.
        new URL(o);
        return true;
      } catch {
        console.warn(`[CORS] Ignoring malformed origin in CORS_ALLOWED_ORIGINS: ${o}`);
        return false;
      }
    })
    .map((o) => new URL(o).origin);
}

/**
 * Decide whether a given Origin header is allowed.
 * Exported so `server/cors.test.ts` can assert the matrix directly without
 * standing up an HTTP server.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowList: string[],
): boolean {
  // No Origin header: same-origin navigation, or a non-browser client.
  // Nothing to approve — CORS does not apply.
  if (!origin) return true;
  if (allowList.length === 0) return false;
  return allowList.includes(origin);
}

export function registerCorsPolicy(app: Express) {
  const allowList = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);

  if (allowList.length > 0) {
    console.log(`[CORS] Cross-origin access allowed for: ${allowList.join(", ")}`);
  }

  app.use(
    cors({
      origin(origin, callback) {
        // Never throw here. Passing an Error makes Express emit a 500, which
        // misreports a policy decision as a server fault; returning `false`
        // simply omits the Access-Control-Allow-Origin header, which is the
        // correct signal for the browser to block the response.
        callback(null, isOriginAllowed(origin, allowList));
      },
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      // Cache preflight results for 10 minutes. Chromium caps this at 2h.
      maxAge: 600,
    }),
  );
}
