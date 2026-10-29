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

## G02 AI Agent Registry minimum fields (and the lead qualifier's fail-open gate)

- Previous status: NOT_STARTED (audit: C). New status: TESTED_LOCAL. Database behaviour unverified.
- Gap: `ai_agents` held 5 of the 13 minimum fields in SRS 19.17 (it had no business function, supported modules, capabilities, tools, knowledge sources, escalation rules, maximum authority, responsible admin or registry version).
- Change: `shared/aiAgentRegistry.ts` defines the controlled vocabularies (knowledge sources from SRS 19.20; authority levels read_only, draft_only, act_with_approval, act_autonomously from 19.18), validation (clean identifiers, no duplicates, limits, an agent that requires human approval cannot have autonomous authority) and `missingRegistryFields`. `ai_agents` gets nine columns (migration 0038, additive, NOT applied; it also records what the two agents that already run actually do, from their code, and leaves responsible admin empty because only a person can assign it). `upsertAiAgent` takes the new fields as optional so an older caller cannot blank them, bumps `registryVersion` on every change and requires the responsible admin to be an admin or super admin. `listAiAgents` returns parsed lists, the admin and what is still missing. The admin page shows a registry-details table with a Complete? column and the form takes the new fields; editing stays Super Admin only. The permission check now selects only the columns it needs.
- Same batch, G01 follow-up: the lead qualifier's gate had the fail-open shape (`gate && gate.outcome === ...` let a null verdict through). It now refuses without a verdict; regression test added.
- Files: see the register row.
- Tests: `aiAgentRegistry.test.ts` 17 (rules, completeness, data layer with a fake query builder), `aiAgentRegistry.router.test.ts` 6, `integrations.test.ts` +1. Full suite 1382 passed, 57 skipped, 0 failed; typecheck and build clean.
- **Deployment order:** apply migration 0038 before deploying this code. Drizzle reads and inserts every `ai_agents` column, so without it the registry page errors and, because the gate fails closed, AI Scans and the lead qualifier are refused. The permission check itself no longer depends on the new columns, but the default-agent inserts do.
- Decisions needed: whether "Authorized Capabilities" and "Assigned Permissions" are the same list (they are kept separate: permissions are enforced, capabilities descriptive); who the responsible admin for each agent is.
- Next: G03.

## G03 Shared permission-aware agent runtime (framework only)

- Previous status: NOT_STARTED (audit: C, "only two single-shot calls exist"). New status: TESTED_LOCAL.
- Change: `server/agentRuntime.ts` is one tool-calling loop for every agent. The model, tool registry and every side effect (registry lookup, permission check, history, escalation) are injected, so it has no provider, database or network dependency and is tested with a scripted model. A run starts only when the agent is registered, active and the permission check returns a verdict. Each tool call is checked in order: registered in code, listed on the agent's registry entry, arguments valid, organisation scope (the run's organisation is the only one reachable), knowledge source allowed, effect within maximum authority (`authorityDecision` in `shared/aiAgentRegistry.ts`), then the per-tool permission, which fails closed. An action that needs a human decision is never executed: the run ends `awaiting_approval` and escalates. Final output is validated against a schema, repaired once, then escalated instead of returned. Step and tool-call limits escalate; a model error becomes a `failed` result. The history stores tool names, never argument values. `server/agentRuntimeWiring.ts` supplies the real dependencies (registry loader, existing permission check and history, `AI_HUMAN_INTERVENTION_REQUIRED` and `AI_OPERATION_FAILED` admin notifications) and an adapter from the existing LLM wrapper.
- Files: see the register row.
- Tests: `agentRuntime.test.ts` 32 (authority matrix, organisation-id scan, the gate, the loop, scope, knowledge, authority, per-tool permission, output validation, limits and failures, tool registry, the LLM adapter with a stub). Mutation checks: disabling the organisation check fails 1 test and disabling the approval gate fails 1. Full suite 1416 passed, 57 skipped, 0 failed; typecheck and build clean.
- What this does NOT make true: no agent runs on it, no business tool is registered, no model is called. It does not make any agent operational. Not built: resuming a run after approval, memory across runs, knowledge retrieval, per-run cost budgets.
- Database verification: `getAiAgentDefinition` is a single-row select, covered only through the injected interface. Needs migration 0038.
- Decisions needed: which agents move onto it first, and their tools (G12 to G17, client decision); the approve-then-execute flow.
- Next: nothing selected in this batch; see the register.

## G09 Per-agent Technical Operator permissions

- Previous status: NOT_STARTED (audit: C). New status: TESTED_LOCAL.
- Gap: operator scopes were platform-wide (frontend, backend, infrastructure, security, ...). Nothing tied an operator to an individual AI agent, so authorisation for one agent could not be separated from another (SRS 5.7, 13.8; F-26).
- Change: agent access is a grant in the existing `operator_scopes` table written `agent:<key>:<action>` with action view, run or approve, so expiry, revocation and the grant audit come for free. `shared/agentOperatorScopes.ts` holds the pure rules. Runtime: an operator actor needs the run grant for this agent at the start and before every tool call (a revocation mid-run stops the next call); a person with an unknown role is refused. API: `ops.myAgents`, `ops.agentExecutions` (view) and `ops.decideAgentExecution` (approve, checked against the execution's own agent; an operator cannot tell a missing id from a forbidden one). Grants: `adminPlatform.grantOperatorScope` accepts a well-formed agent scope only for a registered agent. The decision mutation is on the central audit list.
- Migration: `drizzle/0039_operator_scope_length.sql` widens the scope column from 32 to 80 characters. Written, NOT applied, independent of 0037 and 0038.
- Tests: `agentOperatorScopes.test.ts` 23 and 6 runtime cases in `agentRuntime.test.ts`: Agent A does not open Agent B, each action separate, platform scopes never open an agent, expiry and revocation to the second, lookup failure refuses, mid-run revocation, grant endpoint validation. Existing agentRuntime fixtures needed an actor role (a user id without a role is now refused by design). Full suite 1446 passed, 57 skipped, 0 failed; typecheck and build clean.
- Remaining: apply 0039 on a non-production database; no operator UI for the new endpoints; verification against a real database.
- Next: G05.

## G05 Permission-aware agent knowledge access

- Previous status: NOT_STARTED (audit: D). New status: TESTED_LOCAL.
- Gap: SRS 19.20 requires agents to retrieve only what the requesting user or agent is authorised to access, with organisation isolation. No retrieval layer existed at all.
- What exists to retrieve from: only `client_documents` (metadata). There are no knowledge-base, FAQ, procedure or rules tables and no extracted file text, so the store is the reusable piece and one real provider sits behind it; the other nine SRS sources are honestly 'unavailable'.
- Change: `shared/knowledgeAccess.ts` (pure): per-source policy (organisation-scoped or not, minimum audience), `authorizeRetrieval`, `filterRetrieved`, `audienceForRole`. `server/knowledgeStore.ts`: `retrieveKnowledge` reads the agent's registry entry on every call (revocation is immediate; unreadable/missing/disabled denies), checks source grant, audience and organisation, calls the provider, then re-filters what it returned (other organisations' items dropped and recorded; above-audience items withheld), clips snippets, strips the organisation id and records counts only. `knowledgeTools` exposes one read-only tool per source to the shared runtime. `server/knowledgeProviders.ts`: `client_documentation` over the existing `searchDocuments`, with the document matrix applied (approved AND matrix-visible for client audience; fails closed). The runtime now passes agent key and subject to tools and the run context carries an `audience` (default public).
- Tests: `knowledgeStore.test.ts` 30 (policy, filtering, every denial reason, revocation, fail-closed registry, misbehaving provider, audit has no query text, document provider, end to end through `runAgent`). Mutation check: trusting the provider fails 4 tests.
- Database verification: none needed; `searchDocuments` is unchanged.
- Remaining: content extraction for documents; data and providers for the other nine sources; confirmation of the per-source minimum audiences; developer visibility by assignment (J09/J10).
- Next: S02.

## S02 AI scheduling agent tool API

- Previous status: NOT_STARTED (audit: C, "engine exists, no agent tools"). New status: TESTED_LOCAL.
- Refactor first: the booking create, cancel and reschedule logic lived inside tRPC procedures, so tools could only have duplicated it. It was moved verbatim to `server/bookingService.ts` and the router became a thin caller; the schema moved to `server/routers/bookingSchemas.ts` so the RM-93 validator-coverage scan still sees it. All 76 existing booking tests pass unchanged, which is the evidence that nothing about the website changed.
- Tools (`server/schedulingTools.ts`, `shared/schedulingRules.ts`): `scheduling_find_slots`, `scheduling_get_booking` (read) and `scheduling_book`, `scheduling_reschedule`, `scheduling_cancel` (act). Structured results with stable codes; times returned as UTC and local wall-clock in a validated IANA zone; 14-day window cap and 30-minute floor; an existing booking needs reference AND email and a mismatch looks like not found; lookup returns no personal data and reports a pending booking as 'requested'; changing tools need `callerConfirmed: true`, are approval-gated by the runtime, and are idempotent per request id.
- Tests: `schedulingTools.test.ts` 30, including the real website schema accepting the tool's payload, the runtime ending `awaiting_approval` for a default agent, an autonomous agent booking, and permission and authority refusals. Mutation check: always-owned fails 2. Full suite 1511 passed, 57 skipped, 0 failed; typecheck and build clean.
- Remaining: register an agent with these tools and the scheduling permissions once the agent is specified; calendar provider integration (S03/S04) and the duration policy (S05) are separate decisions; persistent idempotency key would need a migration.
- Next: R18.

## R18 AI Receptionist CRM tool wrappers

- Previous status: NOT_STARTED (audit: C, "CRM exists, no agent tool wrapper"). New status: TESTED_LOCAL. This builds tools only; it does not make the AI Receptionist work.
- Data functions added (`server/db/crm.ts`): `findLeadsByContact` (email case-insensitive; phone by identifying digits), `isExistingClientEmail` (a client-role account), `fillLeadBlanks` (fills only empty fields). `createActivity` now accepts a null author, because an assistant is not a user.
- Tools (`server/crmTools.ts`, `shared/crmRules.ts`): find, create prospect, add note with structured qualification, create follow-up, fill details.
- Safety model: resource scope per conversation (`RunLeadScope`), no disclosure without verification (an unverified lookup is only yes or no; an existing client is never described and is routed to verification), deduplication before insert, append-only updates (no overwrite, no name, email or status), assistant-authored records with a timeline note as audit, per-request-id idempotency, generic errors. The run context gained a `verification` field (default unverified).
- Tests: `crmTools.test.ts` 29 (rules, scope, every disclosure path, dedupe by email and phone variants, protected client, append-only, follow-up bounds, runtime authority and permission refusals, verification reaching the tool). Mutation check: removing the scope guard fails 2. Full suite 1541 passed, 57 skipped, 0 failed; typecheck and build clean.
- Not done and not claimed: voice, speech, conversation, identity verification (R10/R11), a unique index on lead email, registering an agent with these tools. Verification flag semantics need client confirmation.
- Next: M4-01.

## M4-01 AI Scan report download auditing

- Previous status: NOT_STARTED (found while fixing P0-02: SRS 9.10 requires "Log all report downloads"). New status: TESTED_LOCAL.
- Change: new append-only table `report_download_audit` (migration 0040, written, NOT applied) following the existing audit convention (`audit_is_append_only`, RLS forced, cascade only from the parent scan). `authorizeReportAccess` replaces the P0-02 assertion: it makes the same ownership decision, records a refused view or download (bounded by the existing throttle) and returns a recorder that the two PDF return paths call after the signed URL exists. Rows carry who, what, release and when, plus a hash prefix of the link; never the token, the URL or report content.
- Decision recorded: best effort. An audit failure is logged once and never blocks the customer or changes a refusal. Stricter fail-closed auditing is the client's call.
- Tests: `reportDownloadAudit.test.ts` 14 (allowed rows for owner, staff and guest link; cached and generated paths; nothing sensitive in rows; denials with reasons; throttling; unpublished, failed-URL and unknown-token cases; audit failures do not change the outcome). Mutation check: removing the audit calls fails 4. Full suite 0 failed; typecheck and build clean.
- Deployment order: independent. The code can ship before the migration; it then does nothing and logs once.
- Remaining: apply 0040 on a non-production database; verify the trigger and cascade there; a view of the audit in the admin portal (not built).
- Next: J09, J10, J08.

## J08 Upload validation and security checks

- Previous status: NOT_STARTED (audit: C, "malware scan missing"). New status: TESTED_LOCAL.
- Gap: `uploadDocument` blocked six extensions by name and capped size at 15 MB, but never looked at the content: a program named `.pdf` or a text file named `.pdf` was accepted and stored with whatever mime type the browser claimed.
- Change: `shared/uploadValidation.ts` replaces the block-list with an allow-list and checks content against the claim (magic bytes, OOXML structure, text sanity), refuses executables by signature, double extensions, PDFs with active content and the EICAR test signature, validates names, and returns the canonical mime type and a storage-safe name. `uploadDocument` uses it, audits refusals (`document-upload-refused:<code>`), stores nothing on refusal, and accepts an optional note that is shown in the team notification.
- Tests: `uploadValidation.test.ts` 35 (every allowed type, every refusal class, boundary sizes, name edge cases) and 2 router tests. Two legacy fixtures were fixed because they uploaded plain text as a PDF. Full suite 1592 passed, 57 skipped, 0 failed; typecheck and build clean.
- Honest limit: this is not an antivirus engine. The engine choice is the client's. Macro-enabled Office formats are simply not allowed.
- Remaining: an antivirus integration once the engine is chosen; storing the note needs a column (migration); other upload paths.
- Next: J09, J10.

## J09 and J10 Controlled document handoff

- Previous status: both NOT_STARTED (audit: J09 C "no project or type on upload", J10 C "verify default-private"). New status: TESTED_LOCAL, SQL unverified. Done together because the release gate (J10) needs the association (J09).
- Finding that shaped the design: `developer_projects` is organisation-blind on purpose and nothing links it to a client project, so "which client documents may go to which developer project" cannot be derived. Without an explicit link a release would rest on a staff member picking two ids correctly. So staff link a developer project to a client project, and a release is allowed only when the document's organisation equals the linked client project's.
- Change: new tables `project_documents`, `developer_project_links`, `document_releases`, `document_release_events` (migration 0041, written, NOT applied). Rules in `shared/documentHandoff.ts`; persistence in `server/db/documentHandoff.ts`. Client: `associateDocument` and `projectDocuments` organise the client's own vault and share nothing. Staff: `linkDeveloperProject`, `unlinkDeveloperProject`, `releaseDocumentToDevelopers`, `revokeDocumentRelease`, `documentReleases`. Developer: `listReleasedDocuments` and `requestReleasedDocumentUrl`, which need assignment AND release AND still-approved document, enforced in the query.
- Default-private is true by construction: no code path exposes a client document to a developer except a staff-created release row.
- Tests: `documentHandoff.test.ts` 22 and 4 developer cases. Full suite 1619 passed, 57 skipped, 0 failed; typecheck and build clean.
- Not built: the developer-to-client direction, screens, client visibility of release status, a separate request state for clients.
- Next: select the next eligible baseline task.

## R10 - three-level identity policy engine (TESTED_LOCAL)

Added shared/identityPolicy.ts: verification state machine (start rate limit, pending and verified lifetimes, lockout, replay and wrong-interaction refusal, invalidation, audit event names) and authorizeOperation for Level 1/2/3. The shared agent runtime now evaluates each tool's identityRequirement on every call using an injectable clock, so a verification that expires mid-run stops the next call, and tells the model the safe next step. Level 3 always refuses, even for a verified caller and an autonomous agent. CRM tools moved from the old verification flag to the real identity view. 22 new tests plus updated CRM tests. R11 (the flow that creates a verification) is not built and nothing is persisted.

## R17 - approved FAQ store with grounded answers (TESTED_LOCAL)

Added shared/faqRules.ts (workflow, separation of duties, edit-resets-approval, deterministic matcher with ambiguity and weak-match refusal, authoring checks and reviewer warnings), server/db/faq.ts, server/faqStore.ts (knowledge provider and the answer_faq tool), admin endpoints, schema and migration 0042. An assistant can answer a general question only with an approved entry's stored text, or must decline. 27 new tests including a mutation check. The store ships empty and there is no admin page yet.

## R19 - discovery qualification capture to CRM and appointment (TESTED_LOCAL)

Added shared/discoveryQualification.ts (sanitising, card and credential scrubbing, completeness assessment, appointment block compose/parse/replace), server/discoveryCapture.ts (the tool and a factory sharing one per-conversation lead scope with the CRM tools) and updateBookingNote. The qualification is recorded on the prospect record and on the caller's own live appointment, or on neither if the appointment does not match. 22 new tests including a mutation check. No agent is operational and no migration is needed.

## R15 - active-call context memory (TESTED_LOCAL)

Added server/callContext.ts: a bounded, expiring, per-conversation fact store and three agent tools, independent of recording, transcription and the execution log. Facts come from a fixed key set, are cleaned and scrubbed, and are presented to the model as unverified. 18 new tests with a mutation check. No agent is operational; conversation recovery across sessions and persistence are not built.

## I03 - backup policy visibility and configuration (TESTED_LOCAL)

Added shared/backupPolicy.ts (settings, validation, declared-policy assessment), seeded backup.* settings with undeclared defaults, routed their validation through the existing configuration pipeline, added the admin.backupPolicy read endpoint and a Backup policy panel in Governance, Configuration. 15 new tests with a mutation check. Declared values only: nothing is verified against the provider, and the page says so. No migration needed.

## N02 - deadline and blocker notification events (IN_PROGRESS, 3 more events wired)

Added shared/deadlineRules.ts and server/deadlineSweeps.ts and wired DC-08, PD-07 and PD-13 to existing triggers: due CRM follow-ups, missed task deadlines and resolved task blockers. The sweep runs on the existing operations tick with a bounded lookback and dispatcher de-duplication. 17 new tests with a mutation check. 38 events remain unwired and are grouped by what blocks them in the task notes; the task stays IN_PROGRESS.

## J04 - task reassignment, developer replacement and assignment history (IN_PROGRESS)

Added shared/taskAssignmentRules.ts, migration 0043 and schema for an append-only assignment history, transactional reassignDeveloperTask and replaceProjectDeveloper, four admin endpoints and Delivery screen forms and history table. Finished work stays with whoever did it, unfinished work moves, a removed developer loses access immediately, and every move needs a reason. 19 new tests. Per-developer milestones are not built and the SQL has not run against PostgreSQL, so the task stays IN_PROGRESS.

## J03 - developer teams (TESTED_LOCAL)

Added shared/teamRules.ts, migration 0044 and schema, server/db/developerTeams.ts, seven admin endpoints, developer.myTeams and a Teams tab in the admin Delivery screen. Teams keep exactly one primary contact at all times, removal of that contact needs a successor, members are removed not deleted, and a developer sees only their own teams. 21 new tests including a 2000-step invariant check and a mutation check. Team-to-project assignment is not built.

## G04 - provider priority, fallback and budget limits (TESTED_LOCAL)

Added shared/providerRouting.ts and server/llmRouter.ts, refactored server/_core/llm.ts so invokeLLM routes through them only when a provider list or a budget is configured, added readLlmSpend and the admin.aiProviderRouting read. Fallback is for provider failures only, a rejected request is never replayed to another vendor, a circuit breaker avoids dead providers, and a configured budget fails closed. 37 new tests with a mutation check; legacy behaviour unchanged. Nothing live was exercised.

## C01 - combinable CRM lead filters (IN_PROGRESS)

Added shared/crmFilters.ts (one matching rule), listLeadsFiltered, the audited admin.crmLeads read and working filter controls on the CRM page, replacing toolbar labels that did nothing. Filters AND together across the nine attributes a lead has. Owner, qualification verdict and opportunity stage are not covered because the data is not on the lead, so the task stays IN_PROGRESS. 18 new tests with a mutation check.

## C03 - contextual customer profile (TESTED_LOCAL)

Added shared/profileRules.ts and extended the customer timeline with discovery calls, AI Scans, projects and files, plus a summary and a staff-only customerProfile endpoint and summary line in the Sales page. Metadata only: no file content, links or scan answers. 15 new tests with a mutation check. Lead and organization are still not linked in the data, which limits what a single lookup can show.

## G06 - prompt compare and preview (IN_PROGRESS)

Added shared/promptTools.ts (line diff, safe placeholder preview, warnings, token estimate), the comparePromptVersions and previewPrompt reads and a Compare and preview panel in Governance. Local only, no model call. Tests found and fixed an inherited-property lookup bug. Voice and script configuration are not built (no such model exists), so the task stays IN_PROGRESS. 21 new tests with a mutation check.

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
