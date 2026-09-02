-- Milestone 3 §3.3 — API hardening and session security.
--
-- RM-88: shared-state rate limiting.
--   The Milestone 1 limiter (server/_core/rateLimiter.ts) kept its sliding
--   window in process memory, so the configured limit applied per instance
--   rather than per deployment, and every restart reset it. This table is the
--   shared backing store that makes the limit hold across instances.
--
-- RM-90: server-side session revocation.
--   Session cookies are stateless signed JWTs. Logout previously cleared only
--   the browser's copy; the token stayed valid until expiry. `sessionsRevokedAtMs`
--   gives authenticateRequest() a cutoff to reject pre-logout tokens against.
--
-- Both changes are additive and backwards compatible: existing rows get NULL
-- (never revoked), and nothing reads the new table unless RATE_LIMIT_STORE=postgres.

-- ---------------------------------------------------------------------------
-- RM-90: session revocation cutoff
-- ---------------------------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "sessionsRevokedAtMs" bigint;

COMMENT ON COLUMN "users"."sessionsRevokedAtMs" IS
  'Epoch ms. Sessions issued at or before this instant are rejected at authentication. NULL = never revoked. Set on logout, password change, and admin-forced sign-out (Milestone 3 RM-90).';

-- ---------------------------------------------------------------------------
-- RM-88: shared rate-limit window
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "rate_limit_hits" (
  "id"      bigserial PRIMARY KEY,
  -- "<limiter-namespace>:<client ip>" — namespaced so two endpoints sharing a
  -- limit never share a counter, matching the per-closure isolation the
  -- in-memory implementation had.
  "key"     varchar(200) NOT NULL,
  "hitAtMs" bigint       NOT NULL
);

-- The limiter's hot path prunes by "hitAtMs" and counts by ("key", "hitAtMs").
-- Without this the count degrades to a sequential scan on a table that is, by
-- design, written to on every rate-limited request.
CREATE INDEX IF NOT EXISTS "rate_limit_hits_key_time_idx"
  ON "rate_limit_hits" ("key", "hitAtMs");

CREATE INDEX IF NOT EXISTS "rate_limit_hits_time_idx"
  ON "rate_limit_hits" ("hitAtMs");

-- This table holds only ephemeral counters — no tenant-scoped or personal data
-- beyond a short-lived client IP — and is written by the server's own
-- connection, never by an end-user session. RLS is enabled with no permissive
-- policy so that a misconfigured anon/authenticated role cannot read or mine
-- it, while the service-role connection the server uses bypasses RLS as usual.
ALTER TABLE "rate_limit_hits" ENABLE ROW LEVEL SECURITY;
