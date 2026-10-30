# Milestone 4 test results

Records what was actually run, with the result. Skipped tests are listed separately and are never counted as passed. A simulated or stubbed test is not evidence of a live integration.

Environment: Windows 10, Node v24.19.0, vitest 2.1.9. No provider credentials were used for any call (no AI, telephony, email, Stripe or video request was made).

## FIXED by M4-05 (see the end of this section): the default test command now skips the database

The text below records the problem as it was found. Since M4-05, `vitest.config.ts` blanks the database variables in every worker, so a plain `npx vitest run` is database-free and the live suites skip. Database tests run only with `ALLOW_DB_TESTS=1` and an isolated `TEST_DATABASE_URL` that is refused if it is the production database. See `docs/TESTING_SAFETY.md`.

## What was found: the default test command reached the live database

`npx vitest run` is **not** database-free. Several test files start with `import "dotenv/config"`, which loads the repository `.env`; that file holds the Supabase `DATABASE_URL`. A shell with no `DATABASE_URL` therefore still runs the live-database suites. CI does the same on purpose (`.github/workflows/ci.yml` injects the secret).

What those suites do, from their own source:

| Suite | Effect on the live database |
|---|---|
| `dbConstraints.test.ts` (RM-108) | Catalog reads; two enforcement probes inside a transaction that always rolls back |
| `queryPerformance.test.ts` (RM-111) | Read-only queries |
| `concurrency.test.ts` (RM-113, RM-110) | Inserts `booking_slots` rows tagged `consultationType = 'rm113-concurrency-probe'` and deletes them in `afterEach`; reads |
| `rls.negative.test.ts` (RM-60) | Needs Supabase API keys; skipped when they are absent |
| `legal.test.ts`, `requireAcceptances.test.ts` | Skipped in both modes shown below |

Consequences, stated plainly:

1. My earlier 29 October audit summary said the suite ran with the database disabled and that no production data was touched. That was wrong. The live-database suites ran then, and in this session's full runs (twice, plus one subset run of those suites).
2. I have **not** confirmed that no probe rows remain. I tried a read-only count restricted to the two probe markers; the permission system refused it and I did not retry another way. Run this yourself, read-only, to close it: `SELECT count(*) FROM booking_slots WHERE "consultationType" = 'rm113-concurrency-probe';` and `SELECT count(*) FROM users WHERE "openId" LIKE 'rm108-orphan-%';`. Both should be 0.
3. To run without touching the database, blank the variable: `DATABASE_URL= npx vitest run` (bash) or `$env:DATABASE_URL=""; npx vitest run` (PowerShell). dotenv does not override a variable that is already defined, even when empty; this was checked. The live suites then skip with a "Skipping" message.

All runs after this was discovered used the blank variable.

### M4-05 verification (no real database was connected to)

- Plain `npx vitest run`, real `.env` present: 94 files passed, 6 skipped; **1,277 passed, 57 skipped, 0 failed**. All six database suites skipped with their "Skipping" messages.
- Config checks with fabricated URLs: a shell `DATABASE_URL` is blank inside the workers (asserted by `server/testDbSafety.test.ts`, 15 tests); an opt-in whose test URL equals the production endpoint or Supabase project is refused at config load; a valid fabricated isolated URL is accepted.
- Not verified: the GitHub Actions workflow change has not run. Leftover probe rows from earlier runs remain unchecked; an authorized operator can run the read-only SQL in `docs/TESTING_SAFETY.md`.

## Results

| Check | Mode | Result |
|---|---|---|
| Historical 29 Oct audit run (before any change) | live database reachable | 91 files passed, 2 skipped; 1,155 passed, 15 skipped, 0 failed |
| Type check `npx tsc --noEmit` | n/a | exit 0, no errors |
| Full suite after the six fixes | live database reachable | 96 files passed, 2 skipped; **1,297 passed, 15 skipped, 0 failed** (about 40 s) |
| Full suite after the six fixes | `DATABASE_URL=` blank | 92 files passed, 6 skipped; **1,255 passed, 57 skipped, 0 failed** |
| Production build `npm run build` | n/a | vite 28 s, `dist/index.js` 952.7 kB, no errors |
| Full suite after M4-05 and N13 | plain `npx vitest run` (database-free by default) | 95 files passed, 6 skipped; **1,300 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after Z14 | plain `npx vitest run` (database-free) | 96 files passed, 6 skipped; **1,315 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after S07 | plain `npx vitest run` (database-free) | 97 files passed, 6 skipped; **1,327 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after N03 | plain `npx vitest run` (database-free) | 99 files passed, 6 skipped; **1,358 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after G02 | plain `npx vitest run` (database-free) | 101 files passed, 6 skipped; **1,382 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after G03 | plain `npx vitest run` (database-free) | 102 files passed, 6 skipped; **1,416 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after I07 (release identity) | `DATABASE_URL=` blank | 93 files passed, 6 skipped; **1,262 passed, 57 skipped, 0 failed** |
| Full suite after G09 | plain `npx vitest run` (database-free) | 103 files passed, 6 skipped; **1,446 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after G05 | plain `npx vitest run` (database-free) | 104 files passed, 6 skipped; **1,478 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after S02 | plain `npx vitest run` (database-free) | 105 files passed, 6 skipped; **1,511 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after R18 | plain `npx vitest run` (database-free) | 106 files passed, 6 skipped; **1,541 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after M4-01 | plain `npx vitest run` (database-free) | 107 files passed, 6 skipped; **1,555 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after J08 | plain `npx vitest run` (database-free) | 108 files passed, 6 skipped; **1,592 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after J09/J10 | plain `npx vitest run` (database-free) | 109 files passed, 6 skipped; **1,619 passed, 57 skipped, 0 failed**; typecheck and build clean |
| Full suite after R10 | plain `npx vitest run` (database-free) | 110 files passed, 6 skipped; 1641 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after R17 | plain `npx vitest run` (database-free) | 111 files passed, 6 skipped; 1670 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after R19 | plain `npx vitest run` (database-free) | 112 files passed, 6 skipped; 1693 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after R15 | plain `npx vitest run` (database-free) | 113 files passed, 6 skipped; 1712 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after I03 | plain `npx vitest run` (database-free) | 114 files passed, 6 skipped; 1727 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after N02 (partial) | plain `npx vitest run` (database-free) | 115 files passed, 6 skipped; 1745 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after J04 (partial) | plain `npx vitest run` (database-free) | 116 files passed, 6 skipped; 1764 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after J03 | plain `npx vitest run` (database-free) | 117 files passed, 6 skipped; 1786 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after G04 | plain `npx vitest run` (database-free) | 118 files passed, 6 skipped; 1824 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after C01 (partial) | plain `npx vitest run` (database-free) | 118 files passed, 6 skipped; 1842 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after C03 | plain `npx vitest run` (database-free) | 120 files passed, 6 skipped; 1857 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after G06 (partial) | plain `npx vitest run` (database-free) | 121 files passed, 6 skipped; 1878 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after B07 (partial) | plain `npx vitest run` (database-free) | 122 files passed, 6 skipped; 1898 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after P07 | plain `npx vitest run` (database-free) | 123 files passed, 6 skipped; 1919 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after N01 | plain `npx vitest run` (database-free) | 124 files passed, 6 skipped; 1926 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after C01 (owner) | plain `npx vitest run` (database-free) | 125 files passed, 6 skipped; 1936 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after T08 | plain `npx vitest run` (database-free) | documentation only; no code changed; tracker check passes |
| Full suite after P06 | plain `npx vitest run` (database-free) | 126 files passed, 6 skipped; 1960 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |
| Full suite after J07 (partial) | plain `npx vitest run` (database-free) | 127 files passed, 6 skipped; 1992 tests passed, 0 failed, 57 skipped; tsc clean; npm run build ok |

The 57 skipped tests in blank mode are: dbConstraints 9, rls.negative 18, concurrency 9, queryPerformance 6, legal 9, requireAcceptances 6. None of them is counted as passed in that row.

Net change from the historical run: +142 passing tests, 0 removed. A first full run after the fixes had 7 failures, all caused by intended behaviour changes or by suites that scan source files; they were corrected as described in the progress log, not skipped or deleted.

### New or extended test files (all fully mocked; none needs a database)

| File | Tests | Covers |
|---|---|---|
| `server/aiGovernance.test.ts` | 10 (5 new) | G01 fail-closed gate, failure paths, no regression |
| `server/aiScans.test.ts` | +7 | P08 ownership: anonymous, cross-tenant, developer and operator, owner, staff, free guest, unpublished |
| `server/srsRules.test.ts` | +2 | report access decision |
| `server/platformRules.test.ts` | +11 | document visibility rule (4), operator operation scopes (7) |
| `server/documentMatrix.failClosed.test.ts` | 5 | J11 lookup failure modes |
| `server/ops.scopes.test.ts` | 66 | Z09 per operation: no grant, wrong scope, expired, revoked, lookup failure, revocation, admin unaffected, other roles refused |
| `server/admin.revenueAccess.test.ts` | 13 | C09 every role across summary, financial summary, history, export, scheduled report |
| `server/bookings.reschedule.test.ts` | 22 | S01 end-state of slots, booking, reminders; conflicts; rollback; idempotency; cancel |
| `server/db.bookings.slots.test.ts` | 11 | S01 slot takeover, conditional confirm, reminder plan (fake query builder) |
| `server/releaseIdentity.test.ts` | 5 | I07 commit and build timestamp resolution; `healthRoute.test.ts` +1 route case |

Existing suites updated, not weakened: `admin.summary.test.ts` (an Admin now receives null revenue; it had asserted numeric revenue), `ops.test.ts` and `admin.srsOps.test.ts` (operator fixtures now hold grants), `bookings.test.ts` and `bookingAdmin.test.ts` (mock gained `updateBookingStatus`), `aiScans.test.ts` (healthy registry in the db mock), `workflowCoverage.test.ts` (new suite registered).

### Mutation check

For S01 the original defect was re-introduced (cancel by booking id after confirming the new slot). 4 of the 22 reschedule tests failed, then the fix was restored and all passed. The other fixes were not mutation-tested.

## What the database suites did and did not prove about these changes

- `concurrency.test.ts` (RM-113) ran with the changed `tryHoldBookingSlot` in the live-database full runs and passed. That is real-SQL evidence for: one winner among 10 parallel holds, independent slots, expired-hold takeover, and a single row after 5 racing takeovers.
- It does **not** exercise the new released (cancelled) slot takeover, `confirmBookingSlot`, the document matrix read or the report lookups. Those are verified by fakes only.
- None of this was on an isolated database, so M4-03 (verification on an isolated database) stays open, together with the question of leftover probe rows above.

## What this does not prove

- No live AI call, telephony, email delivery, Stripe live mode or video generation has been run. Mailbox configuration does not prove delivery.
- Browser behaviour of the changed pages (`AIScanResult`, `ExecutiveOverview`, `Sales`) was type checked and built but not exercised in a browser.
