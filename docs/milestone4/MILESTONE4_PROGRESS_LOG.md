# Milestone 4 progress log

Append-only. One entry per task advanced. Dates are the session date; times are those of the recorded test run. The canonical task state is `MILESTONE4_TASK_REGISTER.csv`; this file records what was done and how it was checked.

Branch: `milestone4-implementation` (created from `main` at `c5bf579`). Nothing has been pushed or deployed. No database migration was added or applied. No Stripe, telephony, email or AI provider was contacted by any code I wrote or ran.

**Correction, recorded because it matters.** The plain `npx vitest run` is not database-free. The test files load the repository `.env` (`import "dotenv/config"`), which holds the project's Supabase `DATABASE_URL`, so the live-database suites (RM-108, RM-110, RM-111, RM-113) ran against that database in this session's full runs, and in the 29 October audit run that I wrongly described as having skipped them. They are read-only, roll back, or write only marker-tagged probe rows that they delete. I did not know this until late in the session. An attempt to check for leftover probe rows was refused by the permission system and was not retried by another route. After discovering it, every further run used `DATABASE_URL=` (blank), which makes those suites skip. See `MILESTONE4_TEST_RESULTS.md`.

What the new tests do: every test I wrote is fully mocked and needs no database. Database behaviour of the changes is verified in two limited ways, stated per entry: the fake query builder (logic only), and the existing RM-113 live suite, which ran with the changed `tryHoldBookingSlot` and passed.

---

## Session setup, 2026-10-29

- Created the branch, moved the September specification tracker to `docs/milestone4/archive/MILESTONE4_CHECKLIST_SPEC_BASELINE_2026-09.md` with `git mv` (history kept), and created the new root `MILESTONE4_CHECKLIST.md`, the register, this log, the blockers file and the test results file.
- Imported the 188 audit tasks unchanged by ID, translated their status and scope into the Milestone 4 vocabulary (rules at the foot of this file), and added four tasks found while working: M4-01 to M4-04. Total 192.
- Source documents checked: the 29 Oct consolidated clarifications PDF (read in the earlier audit pass), the Master SRS v1.1 PDF (text extracted this session and the clauses behind the six fixes read directly: 5.7, 9.10, 12.5, 13.5, 13.8, 14.7, 18.8, 19.18). **Not available:** the remainder of Document 2 after its section 20, and Document 3 (Executive Briefing). Nothing in this log relies on them.

---

## G01 (P0-01) AI permission gate fails open

- Previous status: NOT_STARTED (audit: C). New status: TESTED_LOCAL.
- Change: `guardAiScanRun` now returns `allowed:false` when the registry set-up throws, when the permission lookup throws, when there is no verdict (no database), and when the managed prompt cannot be read. An explicit refusal still blocks. A permitted run is unchanged. The caller already marks the scan failed and notifies admins.
- Files: `server/aiGovernance.ts`, `server/aiGovernance.test.ts`, `server/aiScans.test.ts`.
- Tests: `aiGovernance.test.ts` 10/10 pass (5 new). The previous test that asserted the permissive behaviour was replaced. Three older `aiScans.test.ts` cases had only passed because their db mock had no registry and the gate failed open; the mock now provides a healthy registry.
- Database verification: not possible. Live AI: none.
- Remaining: none for the code defect. Verification against a real registry on staging.
- Next: P08.

## P08 (P0-02) AI Scan report ownership

- Previous: NOT_STARTED (audit: D). New: TESTED_LOCAL, **partial against the audit wording**.
- Change: new rule `decideScanReportAccess` (SRS 9.10). Paid-tier reports (growth, elite) open only for the signed-in account whose email matches the scan, or for admin and super_admin. Anonymous callers get UNAUTHORIZED, other accounts FORBIDDEN, for `getReport` and `getReportPdf`. The result page shows a sign-in prompt. Free guest scans keep the emailed link because no account exists for them.
- Files: `shared/srsRules.ts`, `server/routers/aiScans.ts`, `client/src/pages/AIScanResult.tsx`, tests below.
- Tests: `aiScans.test.ts` 7 new ownership tests (anonymous, cross-tenant, developer and operator, owner with different email case, staff, free guest, unpublished); `srsRules.test.ts` 2 new.
- Database verification: not possible.
- Remaining: M4-02 (decide free guest delivery), M4-01 (log every download, needs a migration), colleagues of the same organisation are not yet owners.
- Next: J11.

## J11 (P0-03) Document matrix fails open

- Previous: NOT_STARTED (audit: C). New: TESTED_LOCAL.
- Change: the three client document paths (list, search, signed download) now use `clientVisibleDocumentTypes()`, an allow-list that returns `null` when the matrix cannot be read; `clientMayViewDocument` hides typed documents when the list is null or lacks the type. Untyped documents keep their organisation-scoped visibility.
- Files: `shared/platformRules.ts`, `server/db/platformGovernance.ts`, `server/routers/clientPortal.ts`.
- Tests: `platformRules.test.ts` 4 new; new `documentMatrix.failClosed.test.ts` 5 (no database, query throws, connection throws, mixed rows, unseeded matrix).
- Database verification: not possible; the query is a plain select.
- Remaining: confirm that untyped documents stay visible. The matrix has no expiry, so "expired permissions" does not apply here.
- Next: Z09.

## Z09 (P0-04) Technical Operator authorization

- Previous: NOT_STARTED (audit: C). New: TESTED_LOCAL.
- Change: `OPS_OPERATION_SCOPES` maps each operator operation to the scopes that open it; `scopedOpsProcedure(operation)` enforces it. Applied to system health, email delivery log, Security Center events and acknowledge (ops router), and to platform health, deployments, incidents (list, create, update), alert rules, evaluate alerts and compliance (adminOps router). Grants are read on every call, so revocation and expiry apply on the next call; a failed lookup refuses. Admins and Super Admins are unaffected. Denials are logged by the existing audited wrapper.
- Files: `shared/platformRules.ts`, `server/_core/trpc.ts`, `server/routers/ops.ts`, `server/routers/adminOps.ts`.
- Tests: new `ops.scopes.test.ts` 66; `platformRules.test.ts` 7 new; fixtures in `ops.test.ts` and `admin.srsOps.test.ts` now give operators the grants they need. `auditCoverage` kept passing by naming the factory `scopedOpsProcedure`, so its scan still sees every mutation.
- Database verification: not possible.
- Remaining: M4-04, the client confirms the mapping. An operator with no relevant grant now loses those console panels, which is the intended effect.
- Next: C09.

## C09 (P0-05) Admin dashboard revenue

- Previous: NOT_STARTED (audit: C). New: TESTED_LOCAL.
- Change: company revenue is Super Admin only (`mayViewCompanyRevenue`). `admin.summary` returns null revenue and an empty daily series to an Admin; `adminOps.financialSummary` withholds paid totals and recurring revenue; `adminOps.history` withholds monthly paid revenue; the scheduled billing report no longer prints paid or recurring figures. Pages show "Restricted" instead of a number. Admins keep outstanding and overdue invoices and invoice-level exports.
- Files: `shared/srsRules.ts`, `server/routers/admin.ts`, `server/routers/adminOps.ts`, `server/db/srsSales.ts`, `server/_core/operations.ts`, `client/src/pages/admin/sections/ExecutiveOverview.tsx`, `client/src/pages/admin/sections/Sales.tsx`.
- Tests: new `admin.revenueAccess.test.ts` 13 across Super Admin, Admin, Technical Operator, Client, Developer and anonymous callers; `admin.summary.test.ts` updated (it had asserted that an Admin receives numeric revenue). The type checker located every page that consumed the old shape. `workflowCoverage` manifest updated with the new suite.
- Database verification: not possible.
- Remaining: a scheduled revenue digest for the Super Admin does not exist and was not added.
- Next: S01.

## S01 (P0-06) Guest reschedule

- Previous: NOT_STARTED (audit: C). New: TESTED_LOCAL.
- Defects found: after the new slot was confirmed the code cancelled every slot of the booking, including the new one, so the chosen time became free for anyone; the booking row kept the old time and timezone; the old reminders stayed queued and would send the old time; a cancelled slot row could never be re-booked because the unique index ignores status; guest and admin cancel freed the slot but never marked the booking cancelled, so reminders kept firing.
- Change: hold and confirm the new slot, move the booking and its reminders, then release only the other slot rows; roll back the new slot if the booking update fails; idempotent retry; refuse cancelled, completed, past and under-30-minute requests; one updated confirmation email and one admin notification; slot takeover now also covers released slots, with conditional updates so only one racer wins; confirm is a single conditional update; both cancel paths set the booking to cancelled.
- Files: `server/routers/bookings.ts`, `server/routers/bookingAdmin.ts`, `server/db/bookings.ts`.
- Tests: new `bookings.reschedule.test.ts` 22 and `db.bookings.slots.test.ts` 11; legacy booking mocks extended. Re-introducing the original call makes 4 of the 22 fail, which shows the suite detects the defect.
- Database verification: partial. The takeover and conditional confirm are tested against a fake query builder (logic only). The existing RM-113 suite (`server/concurrency.test.ts`) ran against the live database in the full runs with the changed `tryHoldBookingSlot` and passed: unique hold under 10 parallel callers, independent slots, expired-hold takeover, and one row after 5 racing takeovers. It does not cover the new released-slot takeover or `confirmBookingSlot`, and it ran on the live database rather than an isolated one, so M4-03 stays open.
- Remaining: M4-03. New times are not checked against availability windows on reschedule, as on create.
- Next: batch verification, then P07.

## Batch verification after the six fixes

- Type check clean. Full suite 1297 passed, 15 skipped, 0 failed with the live database reachable; 1255 passed, 57 skipped, 0 failed with `DATABASE_URL=` blank. Production build succeeds. Details in `MILESTONE4_TEST_RESULTS.md`.
- Seven existing tests failed after the first pass and were corrected for the right reasons: five were operator fixtures with no grants (intended behaviour change), one audit-coverage scan (renamed the factory so the scan keeps working), one coverage manifest (registered the new suite). No test was deleted or weakened.

## I07 Release identity in /health/version

- Previous status: NOT_STARTED (audit: C, P2). New status: TESTED_LOCAL.
- Defect: `/health/version` read only `GIT_COMMIT_SHA`, which the Dockerfile defaults to the literal `"unknown"`, so it reported "unknown" even on Railway, which injects `RAILWAY_GIT_COMMIT_SHA` at runtime. Two other modules (deployment record, platform health panel) already used the Railway variable separately.
- Change: one resolver, `resolveReleaseCommit`, used by all three. The first real value among `GIT_COMMIT_SHA`, `RAILWAY_GIT_COMMIT_SHA`, `GIT_COMMIT`, `SOURCE_COMMIT` wins; placeholder, empty or unset gives null and the route says "unknown" rather than inventing a value.
- Files: `server/_core/releaseIdentity.ts` (new), `server/_core/healthRoute.ts`, `server/db/srsGovernance.ts`, `server/db/srsOps.ts`.
- Tests: `releaseIdentity.test.ts` 5 new; `healthRoute.test.ts` 1 new route-level case and the existing "unknown" test hardened to clear all four variables. Run with `DATABASE_URL=` blank: full suite 1262 passed, 57 skipped, 0 failed.
- Database verification: not needed. Remaining: confirm on a deployed instance after the next release; `builtAt` stays "unknown" unless the pipeline passes `BUILD_TIMESTAMP`.
- Next: nothing selected yet (see the register for the next independent baseline tasks).

## M4-05 Test runs must never reach the production database

- Previous status: did not exist (found during this work). New status: TESTED_LOCAL, P0.
- Defect: the test files load `.env` with `dotenv/config`, so a plain `npx vitest run` ran the live-database suites against the project's Supabase database, locally and in CI.
- Change: `vitest.config.ts` forces `DATABASE_URL` and `SUPABASE_*` blank in every worker (dotenv does not override a defined variable). Opt-in requires `ALLOW_DB_TESTS=1` and `TEST_DATABASE_URL`, which is refused if it names the same endpoint or Supabase project as any production URL. `client/src/test/setup.ts` fails a worker that receives a database URL without the opt-in. CI vitest jobs pass `TEST_*` secrets only; the production secret is passed as `PRODUCTION_DATABASE_URL` for the guard to refuse. `docs/TESTING_SAFETY.md` documents it and gives read-only SQL for leftover probe rows.
- Files: `shared/testDbSafety.ts`, `vitest.config.ts`, `client/src/test/setup.ts`, `.github/workflows/ci.yml`, `docs/TESTING_SAFETY.md`.
- Tests: `server/testDbSafety.test.ts` 15, fabricated URLs only. Plain full run: 1277 passed, 57 skipped, 0 failed.
- Database verification: none attempted, by design. Leftover rows from earlier runs were not investigated against production, as instructed.
- Remaining: CI workflow unproven until it runs; create a `TEST_DATABASE_URL` secret for an isolated database to restore DB coverage in CI; e2e job and provider keys are outside this gate.
- Next: N13, Z14.

## N13 Notification links revalidate permission when opened

- Previous status: NOT_STARTED (audit: C). New status: TESTED_LOCAL.
- Gap: the stored link was navigated with a plain `Link`; nothing on the server re-checked it when clicked.
- Change: new `openNotification` mutation on the client, developer and admin feeds. It finds the notification inside the caller's own organisation or developer feed, accepts only a same-origin portal path, requires the link to stay in that feed's portal area, and re-checks the caller's current role. A refusal returns the portal home, leaves the item unread and is audited (`appendLoginAudit` blocked for client and developer, `recordAdminEvent` for admin). The bell takes an optional `onOpen`, so existing uses are unchanged.
- Bug found by the tests: `new URL()` rewrote `/client-portal/../admin` to `/admin` before the traversal check; the check now runs on the raw path.
- Files: `shared/notificationLinks.ts`, the three routers, three db getters, `NotificationBell.tsx`, both portal layouts, `AdminBell.tsx`.
- Tests: `notificationLinks.test.ts` 26, `developer.test.ts` +3, `NotificationBell.test.tsx` +2. Full suite 1300 passed, 57 skipped, 0 failed; typecheck and build clean. No database was used.
- Remaining: not seen in a browser; middle-click or open-in-new-tab bypasses the check, but the destination still enforces its own data permissions. Decision needed only if per-resource deep links (a specific invoice id) are introduced.
- Next: Z14.

## Z14 Audit unauthorized access attempts safely

- Previous status: NOT_STARTED (audit: C, policy decision). New status: TESTED_LOCAL.
- Gap: SRS 8.16 says unauthorized attempts are "denied and logged", but only a signed-in caller's FORBIDDEN was recorded. Anonymous probes of privileged endpoints and UNAUTHORIZED were deliberately not logged because the audit table is append-only and cannot be pruned.
- Change: `auditDenials` now records anonymous and UNAUTHORIZED refusals too, through `DenialAuditThrottle`: one row per actor and endpoint per 10 minutes (the next row reports `+N similar`), at most 10 anonymous and 60 signed-in rows a minute per instance, 5000 keys in memory. Anonymous rows carry IP and user agent, no identity. The three `gateStatus` session probes are exempt. The signed-in row text `denied:<path>` is unchanged.
- Files: `server/_core/denialThrottle.ts` (new), `server/_core/trpc.ts`.
- Tests: `denialThrottle.test.ts` 14 (6 throttle with an injected clock, 8 through the real routers including a 100-address flood capped at 10 rows); `admin.srsOps.test.ts` resets the process-wide throttle for its denial group.
- Database verification: not used (audit writes are mocked).
- Decisions needed (made as safe defaults, reversible): log anonymous attempts at all; the window and budgets; retention of anonymous IP and user agent, which no document defines. Public endpoints and the REST auth routes are not covered. The throttle is per instance, so several instances multiply the cap.
- Next: S07.

## S07 Requested versus confirmed scheduling, idempotent triggers

- Previous status: NOT_STARTED (audit: C, "duplicate-event test missing"). New status: TESTED_LOCAL.
- Defects found: `bookings.create` wrote the booking as `confirmed` before the slot was committed, so a lost slot left a "confirmed" booking with no slot; it did not check that a supplied hold matched the requested time and service; a repeated submission created a second booking row; guest and admin cancel could fire a second owner message and notification; the reminder worker would remind about any booking that was not cancelled.
- Change: the booking is created `pending` with a `requested` event; the hold is validated first (`isHeldSlotValid`: token, time, service) so a stale, foreign or mismatched hold leaves nothing behind; after the atomic slot confirm the booking becomes `confirmed` with a `confirmed` event, and only then do the email, notifications, reminders and CRM lead run. A lost slot closes the request as cancelled with `confirmation_failed`; a failed status write releases the slot. Guest and admin cancel are idempotent. The reminder worker skips anything not `confirmed`.
- Files: `server/routers/bookings.ts`, `server/routers/bookingAdmin.ts`, `server/db/bookings.ts`, `server/_core/bookingReminders.ts`.
- Tests: new `bookings.scheduling.test.ts` 11 (stateful model, asserts the order of side effects); `bookingReminders.test.ts` +1; the legacy `bookings.test.ts` and `bookingAdmin.test.ts` mocks now model status updates and lookups. Mutation check: bypassing the hold validation fails 2 tests. Full suite 1327 passed, 57 skipped, 0 failed; typecheck and build clean.
- Database verification: not used. `isHeldSlotValid` is a single-row select, tested through the in-memory model only.
- Remaining: a repeated create after success is refused rather than answered with the original booking (a real idempotency key needs a column and a migration, not written); rows left `pending` by a crash are not swept; calendar-provider events and the scheduling agent are separate tasks.
- Next: N03.

## N03 Persistent retry and escalation for failed emails

- Previous status: NOT_STARTED (audit: D, "logging only"). New status: TESTED_LOCAL, with database behaviour unverified.
- Gap: a failed send was logged (`email_delivery_log`) and forgotten. SRS 17.11 requires retry "according to configurable policies" and the 29 Oct document requires "visible failure and retry states". Nobody was told when a customer never received a message.
- Change: `shared/emailRetryPolicy.ts` (pure): classifies an error as transient or permanent, backoff (default 5 sends in all, waits 5, 15, 45, 135 minutes, cap 6 h), and three platform settings that configure it, validated by the existing configuration rules and seeded for existing installs. `server/emailOutbox.ts`: `queueFailedEmail` records the first failure with the content needed to resend it (permanent failures are abandoned at once and keep no content); `processEmailRetries` retries what is due, logs each attempt to the delivery log, updates the booking record when a confirmation finally goes out, and abandons plus escalates a permanent or exhausted message with an `INTEGRATION_FAILURE` admin notification (masked recipient, once per message). `server/db/emailOutbox.ts`: leased claim with `FOR UPDATE SKIP LOCKED`. `server/email.ts`: both send paths hand a provider failure to the queue (best effort, loaded lazily, never recursing). A 5-minute interval runs the worker. Read-only `adminOps.emailRetries` lists states without content.
- Migration: `drizzle/0037_email_outbox.sql`, additive (one table, two indexes, RLS on). Written, **not applied**. Without it the queue and worker are quiet no-ops and log once.
- Files: see the register row.
- Tests: `emailRetry.test.ts` 21 (policy, settings, worker with injected dependencies, queueing), `email.queueing.test.ts` 8 (both send paths, console mode, queueing failure, no recursion). Provider calls are stubbed; no email was sent. Full suite 1358 passed, 57 skipped, 0 failed; typecheck and build clean.
- Database verification: none. The claim SQL has been reviewed, not run; apply the migration to a non-production database and run a pass there before enabling in production.
- Decisions needed: retention of abandoned rows and of stored message content; whether an admin screen for the queue is wanted (the endpoint exists); the default policy numbers.
- Next: G02, then G03.

---

## Status translation rules used for the import

| Audit status | Milestone 4 status |
|---|---|
| A done and verified | COMPLETED_VERIFIED |
| B implemented, not live verified | LIVE_VERIFICATION_PENDING |
| C partial or D not implemented, scope S1, S2, S6 | NOT_STARTED (the audit status column keeps C or D) |
| C or D, scope S4 or S5 | AWAITING_CLIENT_DECISION: not started without written authorization |
| E externally blocked | BLOCKED_EXTERNAL |
| F needs clarification | AWAITING_CLIENT_DECISION |

| Audit scope | Commercial classification |
|---|---|
| S1, S2 | BASELINE, or ALREADY_DELIVERED when the audit status is A or B |
| S3 | PAID_M4_APPROVED (none exist) |
| S4 | PAID_M4_PROPOSED |
| S5 | SCOPE_DISPUTED |
| S6 | EXTERNAL_DEPENDENCY |
