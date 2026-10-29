# Test database safety

Since Milestone 4 (task M4-05), `npx vitest run` is database-free by default.

## Why

Several suites load the repository `.env` with `import "dotenv/config"`, and that file holds the production `DATABASE_URL`. Before this change an ordinary test run therefore executed the live-database suites (RM-108, RM-110, RM-111, RM-113) against the real Supabase project. Those suites are read-only, roll back, or write marker-tagged probe rows that they delete, but a test run should never reach production.

## How it works

`vitest.config.ts` forces `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` to empty strings in every test worker. `dotenv` does not override a variable that is already defined, so `.env` can no longer inject them. The database-gated suites then skip with a "Skipping" message. The rules live in `shared/testDbSafety.ts`; the worker setup (`client/src/test/setup.ts`) fails the run if a database URL still reaches a worker without the opt-in below.

## Running database tests on purpose

Only against an isolated test database that is **not** the production project:

```
ALLOW_DB_TESTS=1
TEST_DATABASE_URL=postgresql://...          # the isolated test database
# optional, only for the RLS suite, needs a separate test Supabase project:
TEST_SUPABASE_URL=https://<test-project>.supabase.co
TEST_SUPABASE_PUBLISHABLE_KEY=...
TEST_SUPABASE_SECRET_KEY=...
```

The run is refused (before any test starts) if `ALLOW_DB_TESTS=1` has no `TEST_DATABASE_URL`, if the URL is not a postgres URL, or if it names the same endpoint or the same Supabase project as `DATABASE_URL`, `PRODUCTION_DATABASE_URL` or the `DATABASE_URL` in `.env`. The test database needs the application schema applied (all migrations in `drizzle/`).

## CI

`.github/workflows/ci.yml` passes `TEST_DATABASE_URL` (and `ALLOW_DB_TESTS=1` when that secret exists) to the two vitest jobs. The production `DATABASE_URL` secret is passed only as `PRODUCTION_DATABASE_URL`, so the guard can refuse it, and to the artifact secret scanner, which never connects. Until a `TEST_DATABASE_URL` secret is created for an isolated database, CI runs database-free and the live suites skip. Create that secret to restore database coverage in CI.

Not covered here: the Playwright e2e job targets `E2E_BASE_URL`; point it at staging, never production, and keep `E2E_ALLOW_MUTATIONS` off for any shared environment.

## Checking for leftover test rows (read-only, for an authorized operator)

Earlier runs of the RM-113 suite may have left marker rows if a run was interrupted. These queries only read:

```sql
-- booking slots created by the RM-113 concurrency probe (expect 0)
SELECT count(*) FROM booking_slots WHERE "consultationType" = 'rm113-concurrency-probe';

-- the RM-108 orphan probe runs in a rolled-back transaction (expect 0)
SELECT count(*) FROM users WHERE "openId" LIKE 'rm108-orphan-%';
```

If either is not 0, review the rows before deleting anything; deletion is a production data change and needs explicit authorization.
