/**
 * Shared in-memory sliding-window rate limiter.
 *
 * Previously reimplemented independently (same algorithm, same 60s window
 * constant) in aiScans.ts, bookings.ts (twice), contact.ts, and
 * engineering.ts. Each call site still gets its own independent counter —
 * createRateLimiter() returns a fresh closure per call, matching the
 * original per-router isolation — this only removes the duplicated
 * algorithm, not the per-endpoint limit semantics.
 *
 * Known limitation (unchanged from the original implementations): this is
 * in-memory only, so it resets on process restart and is not shared across
 * multiple server instances. Fine for a single-process deployment; revisit
 * with a shared store (e.g. Redis) if/when this runs behind more than one
 * instance.
 */

const DEFAULT_WINDOW_MS = 60_000;

export function createRateLimiter(limitPerWindow: number, windowMs: number = DEFAULT_WINDOW_MS) {
  const hitsByIp = new Map<string, number[]>();

  return function isRateLimited(ip: string | null): boolean {
    if (!ip) return false;
    const now = Date.now();
    const recent = (hitsByIp.get(ip) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hitsByIp.set(ip, recent);
    return recent.length > limitPerWindow;
  };
}
