/**
 * Shared IP / User-Agent extraction.
 *
 * Previously reimplemented independently (same `x-forwarded-for` parsing,
 * same socket fallback) across ~12 call sites in 11 files, under different
 * local names (getIpAndUa, ctxIp/ctxUa, pickIp, callerMeta, reqIp/reqUa,
 * or inlined directly). One of those copies (engineering.ts's redirect
 * drift bug root cause) is exactly the kind of inconsistency this
 * duplication invites.
 *
 * Works for both a tRPC procedure's `ctx.req` and a raw Express `req`
 * (used directly by the non-tRPC auth routes) — both are structurally
 * compatible with the minimal shape below, so one implementation serves
 * both consumer types.
 */

interface MinimalRequest {
  headers: Record<string, unknown>;
  socket?: { remoteAddress?: string } | null;
}

export function getRequestIp(req: MinimalRequest | null | undefined): string | null {
  const xf = req?.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0]?.trim() || null;
  }
  return req?.socket?.remoteAddress ?? null;
}

export function getRequestUserAgent(req: MinimalRequest | null | undefined): string | null {
  const ua = req?.headers?.["user-agent"];
  return typeof ua === "string" ? ua : null;
}

export function getRequestMeta(req: MinimalRequest | null | undefined): {
  ip: string | null;
  userAgent: string | null;
} {
  return { ip: getRequestIp(req), userAgent: getRequestUserAgent(req) };
}
