export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * Milestone 3 §3.3 (RM-89): deliberate session lifetime.
 *
 * Sessions previously used ONE_YEAR_MS — every login path minted a JWT valid
 * for a full year. Combined with the fact that logout only cleared the cookie
 * (RM-90), a token captured once stayed usable for twelve months. Neither was
 * a considered choice; ONE_YEAR_MS was simply the SDK default.
 *
 * The default is now 12 hours, overridable with SESSION_TTL_HOURS so an
 * operator can tune it without a code change. ONE_YEAR_MS is kept as an
 * export because non-session callers still use it, but no login path does.
 */
export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Lower bound guards against a typo (SESSION_TTL_HOURS=0) silently logging everyone out. */
const MIN_SESSION_TTL_MS = 5 * 60 * 1000;
const MAX_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function getSessionTtlMs(): number {
  const raw = process.env.SESSION_TTL_HOURS?.trim();
  if (!raw) return DEFAULT_SESSION_TTL_MS;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0) {
    console.warn(`[Session] Invalid SESSION_TTL_HOURS="${raw}"; using the 12h default.`);
    return DEFAULT_SESSION_TTL_MS;
  }
  const ms = hours * 60 * 60 * 1000;
  if (ms < MIN_SESSION_TTL_MS) return MIN_SESSION_TTL_MS;
  if (ms > MAX_SESSION_TTL_MS) return MAX_SESSION_TTL_MS;
  return ms;
}
