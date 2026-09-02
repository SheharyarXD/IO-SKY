# Milestone 3 Implementation Checklist

Live tracking document, same convention as `PHASE1_CHECKLIST.md` (Milestone 1) and
`MILESTONE2_PROGRESS.md` (Milestone 2). Source of truth for scope: `IO_SKY_Three_Milestone_Plan.pdf`,
Milestone 3 ("Notification Events, Deployment, Security & Production Readiness"), §3.1–3.5 plus the
Milestone 3 Exit Gate. Task IDs continue the `RM-` numbering used by Milestone 1/2 documents, starting
at RM-64 (Milestone 1 ran RM-01..RM-63).

Legend: ✅ Done + locally verified · 🔶 Partial · ⛔ Blocked (external access/decision required) · ⏭ Not started

Nothing in this milestone has been started yet — it depends on Milestone 2 being exit-gated first, and
several workstreams are gated on client-supplied material (notification specification documents, hosting
provider decision) that is not yet in this repo. Every row below is ⏭ until that groundwork lands.

---

## Workstream 3.1 — Notification Event Catalog Implementation

**Blocked as a whole on the client's Notification specification documents** — §3.1 cannot start until
these are supplied (called out explicitly in the source plan as the outstanding blocker gating this
section).

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-64 | Obtain client Notification Event Catalog / specification documents | ⛔ | Client deliverable. Gates every other task in this workstream. |
| RM-65 | Map every catalog event to an existing trigger point (extend) or a new one (build) | ⏭ | Depends on RM-64. Builds on the Milestone 2 §2.7 notification write service/schema. |
| RM-66 | Define recipient resolution, priority, channel, template and CTA per event | ⏭ | Depends on RM-64/65. |
| RM-67 | Implement queue retry / dead-lettering | ⏭ | Depends on Milestone 2's delivery-queue foundation. |
| RM-68 | Implement escalation rules | ⏭ | Depends on RM-64 spec. |
| RM-69 | Implement quiet-hours logic | ⏭ | Depends on RM-64 spec. |
| RM-70 | Implement digest cadence and grouping | ⏭ | Depends on RM-64 spec. |
| RM-71 | Idempotency / duplicate-delivery prevention | ⏭ | A retried or duplicate event must produce exactly one delivered notification. |
| RM-72 | Extend existing 10-locale i18n to notification content | ⏭ | Reuses the platform's existing i18n system (`client/src/lib/i18n/*`). |
| RM-73 | Delivery / read-receipt analytics | ⏭ | New tracking, not present yet. |

## Workstream 3.2 — Deployment

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-74 | Client decision: hosting provider | ⛔ | Client deliverable — must support a long-lived Node process. Carried over as unresolved from Milestone 1 §1.3. |
| RM-75 | Stand up production hosting, bind to explicit port | ⏭ | Depends on RM-74. |
| RM-76 | Wire existing health-check endpoint into the host | ⏭ | `server/routers/ops.ts` / health endpoint already exists; needs host-level wiring. |
| RM-77 | Supabase production configuration: connection pooling | ⏭ | Dev/staging already provisioned per Milestone 1 §1.4; production tier config is new. |
| RM-78 | Supabase production configuration: automated backups | ⏭ | |
| RM-79 | Tested backup restore before go-live | ⏭ | Must be exercised, not just configured. |
| RM-80 | Full CI/CD pipeline: build + staging-deploy + approval-gated production deploy | 🔶 | **Build half done, deploy half blocked.** `ci.yml` now runs three jobs — typecheck+test, the RM-107 security suite, and build + RM-82 artifact scan — so every merge is gated on a real production build, not just a typecheck. The staging-deploy and approval-gated production-deploy stages are **not** written: they depend on the hosting provider (RM-74), an open client decision. Writing deploy jobs against an unknown host would be scaffolding that has never executed — precisely the unverified-claim pattern the Milestone 2 feedback asked us to stop. |
| RM-81 | Secrets management: move all production secrets into host/CI secret manager | ⏭ | Depends on RM-74 hosting decision. |
| RM-82 | Confirm no secret files ship in any build/deploy artifact | ✅ | New `scripts/scan-build-artifact.mjs`, wired as its own CI job and as `pnpm run scan:artifact`. Scans what is actually deployed rather than source — a distinction that matters because Vite inlines every `VITE_`-prefixed var into the client bundle, so a mis-prefixed secret is absent from source yet public in the artifact. Two independent halves: verbatim value-matching against real env secrets (catches a credential that does not look like one) and narrow pattern matching (AWS keys, `sb_secret_*`, `sk-*`, `sk_live_*`, inline-password Postgres URLs, PEM blocks, Slack tokens), plus forbidden-filename checks (`.env*`, `.npmrc`, `*.pem`, `id_rsa`, `.project-config.json`). Refuses to report a clean scan against a missing or empty `dist/`, and says explicitly when no secrets were in the environment so only the pattern half ran. **Result: PASS — 395 files scanned, 0 findings.** |
| RM-83 | DNS cutover: iosky.nl staging subdomain → production apex, low-TTL rollback window | ⏭ | Depends on RM-74 and the Milestone 1 §1.3 DNS staging work. |

## Workstream 3.3 — Security Hardening & Verification

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-84 | RBAC & tenant-isolation sweep vs. original audit baseline | ⏭ | Re-run/extend `server/rbac.authOrigin.test.ts` and `server/rls.negative.test.ts` against the deployed environment. |
| RM-85 | Negative cross-tenant tests on the deployed environment | ⏭ | The Milestone 1 suite (RM-60) ran against dev/staging; needs re-verification against production config. |
| RM-86 | API hardening: helmet security headers | ✅ | New `server/_core/securityHeaders.ts`, registered before all routes in `_core/index.ts`. `x-powered-by` disabled. CSP + HSTS enforced in production only (Vite dev needs inline scripts + ws; a dev-tolerant CSP would have to be watered down to uselessness). CSP allowlist derived from what `client/index.html`/`index.css` actually load (fonts.googleapis/gstatic, `*.supabase.co`, cloudfront) plus a configurable analytics origin. `script-src` has no `unsafe-inline`/`unsafe-eval`; `style-src` keeps `unsafe-inline` — a real, documented limitation (Tailwind/Radix/framer-motion inline styles, no nonce plumbing on the static path). COEP left off deliberately: it would block the third-party font/branding assets. 7 tests in `server/apiHardening.test.ts`. |
| RM-87 | API hardening: explicit CORS policy | ✅ | New `server/_core/corsPolicy.ts`. Deny-by-default: with no `CORS_ALLOWED_ORIGINS` no cross-origin browser access is granted at all, which is the correct behaviour for the single-origin deployment the plan describes. `*` is rejected on purpose (cannot combine with credentials; a wildcard on a cookie-authed API is a CSRF primitive), as are malformed entries. Origin matching is exact — `server/apiHardening.test.ts` pins the suffix-confusion case (`app.iosky.nl.evil.com`) and the scheme-downgrade case. Disallowed origins get no `Access-Control-Allow-Origin` header rather than a 500. 8 tests. |
| RM-88 | API hardening: shared-state rate limiting for multi-instance deployment | ✅ | `server/_core/rateLimiter.ts` refactored behind a `RateLimitStore` interface: `memory` (original per-process behaviour, still the default) and `postgres` (shared `rate_limit_hits` table, migration 0016), selected by `RATE_LIMIT_STORE`. Default stays `memory` deliberately — hosting topology is still open (RM-74), and defaulting to a store needing an unapplied migration would turn a missing table into a request-path failure. Prune+insert+count is one SQL statement so concurrent instances cannot interleave and both conclude they were under the limit. Fail-open with a warning if the store is unreachable: a limiter is abuse mitigation, not an authorisation boundary, and failing closed would convert a degraded DB into a full public-site outage. `isRateLimited` is now async — 6 call sites in aiScans/bookings/contact/engineering updated to `await`. Key namespacing preserves the per-endpoint isolation the closure gave for free. 6 tests. |
| RM-89 | Session security: confirm Supabase session expiry/refresh is deliberately configured | ✅ | **Confirmed NOT deliberately configured — it was a defect.** Every login path (local, OAuth, Supabase, MFA-challenge) minted `expiresInMs: ONE_YEAR_MS`; that was simply the SDK default, never a considered choice. Replaced with `getSessionTtlMs()` in `shared/const.ts`: 12h default, `SESSION_TTL_HOURS` override, clamped to [5min, 30d] so a typo cannot silently reintroduce a year-long session. All four login paths and `sdk.signSession`'s own default now use it. 5 tests. |
| RM-90 | Session security: confirm logout actually revokes sessions | ✅ | **Confirmed it did NOT — logout was cosmetic.** Sessions are stateless signed JWTs; logout cleared only the browser's cookie, so a captured token stayed valid until expiry (a year, pre-RM-89). Fixed with a real revocation cutoff: `users.sessionsRevokedAtMs` (migration 0016), stamped by `db.revokeUserSessions{,ByOpenId}()` and enforced in `sdk.authenticateRequest()`. `sdk.signSession` now signs an explicit `iat`; `verifySession` returns `issuedAtMs`. Comparison is `<=` not `<` — JWT `iat` has 1s granularity, so a strict `<` would let a token minted during the revocation second survive a logout-then-replay. Legacy tokens with no `iat` fail closed once a revocation exists, but still work when the user has never revoked, so deploying this does not sign everyone out. 8 tests in `server/sessionRevocation.test.ts`. |
| RM-91 | Review `dangerouslySetInnerHTML` usage | ✅ | Audit found **exactly one** occurrence: `client/src/components/ui/chart.tsx`, unused shadcn scaffold that injected a `<style>` block built from caller-supplied `config` values (a `</style>` in a config value would break out into HTML). Confirmed unreferenced — nothing imports it, and recharts is used directly in `AIScanResult.tsx` — so it was **deleted** rather than hardened, following the RM-04 precedent that removed `ui/form.tsx` the same way. Enforced by a test asserting zero occurrences across `client/src` and `server` (test files excluded, since the assertion names the identifier), so the sink cannot silently return. |
| RM-92 | Review cookie `SameSite`/`Secure` attributes against real hosting | ⏭ | Carries over Milestone 1's blocked RM-38, now unblockable once RM-74 lands. |
| RM-93 | zod validation coverage audit across ported procedures | ✅ | Static audit of all 12 router files: **169 procedures, 0 gaps.** 102 declare a validator; the other 67 genuinely take no input (none of them destructure `input`). All 16 validators that are named constants rather than inline `z.object(...)` were resolved back to their declarations and confirmed zod. Written as a permanent test (`server/inputValidationCoverage.test.ts`) rather than a document: an audit that says "clean" is stale the moment a procedure is added, whereas this fails the CI gate. Includes a parser self-guard (asserts >150 procedures found) so a declaration-style refactor cannot make the coverage checks silently pass by matching nothing. |
| RM-94 | Client decision: audit-log integrity — genuine tamper-evidence vs. corrected UI claim | ⛔ | Client deliverable per the source plan. |
| RM-95 | Implement the RM-94 decision | ⏭ | Depends on RM-94. |

## Workstream 3.4 — Testing & Quality Assurance

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-96 | Port all existing backend test files to run against the Supabase-backed stack in CI | ✅ | `.github/workflows/ci.yml` now passes `DATABASE_URL`/`SUPABASE_*`/`JWT_SECRET` from repository secrets into the test job, so the Supabase-dependent files run against the real stack in CI instead of always skipping. They still skip cleanly when secrets are absent (fork PRs), because those files probe for **reachability**, not just env-var presence — the RM-60 distinction. ⚠️ The GitHub repository secrets themselves must still be added in repo settings; that needs admin access this environment does not have, and until then CI exercises the non-live subset only. |
| RM-97 | Introduce React Testing Library | ✅ | Added `@testing-library/react`, `/jest-dom`, `/user-event` and `jsdom`. `vitest.config.ts` now runs the React plugin and routes `client/src/**/*.test.tsx` to jsdom via `environmentMatchGlobs`, leaving the ~600 server tests on the faster `node` environment (running them under jsdom would also mask accidental DOM deps in server modules). Shared harness in `client/src/test/`: `setup.ts` (jest-dom matchers, auto-cleanup, and stubs for `matchMedia`/`ResizeObserver`/`IntersectionObserver`/`scrollIntoView`, which jsdom lacks and Radix/framer-motion touch on mount) and `renderWithProviders.tsx` (language context + tRPC + react-query in one wrapper). The old config comment said broadening this was "a separate decision" — this is that decision, taken. |
| RM-98 | Frontend coverage: auth forms | ✅ | **12 tests** on `client/src/pages/Login.test.tsx` — the entry point to every portal, previously with zero coverage of any kind. Covers field rendering and autocomplete hints, the submit-gating rules (valid email + ≥8 char password, pinned so a refactor cannot weaken the minimum), the password visibility toggle, Remember-me hydration including the private-mode case where `localStorage` throws rather than returning null, and both anti-automation gates (honeypot, and the 1.5s mount-time gate) asserting that no credentials leave the browser. Behavioural assertions, not snapshots — snapshots of a 1300-line page break on every style change while proving nothing about whether login works. |
| RM-99 | Frontend coverage: Notification Center | ✅ | **14 tests** on `NotificationBell.test.tsx`. This is the component whose original defect — a bell that rendered a real unread badge but had no `onClick` at all — is exactly what the Milestone 2 exit gate ("no UI element claims a capability that isn't real") exists to prevent, so it gets a regression test rather than trust. Covers badge counting (including `readAt: undefined` as well as `null`, which a naive check undercounts), open-on-click, empty state, per-item and bulk mark-read, archive, that archiving does not also mark-read (both handlers `stopPropagation` and sit adjacent), and the unknown-priority fallback so an unrecognised DB value cannot render a classless, invisible dot. |
| RM-100 | Frontend coverage: every converted admin workflow | ✅ | **16 tests** covering the primitives all 19 converted admin surfaces render through, rather than 19 near-identical per-module files: `ModuleStateBoundary` (the loading/error/forbidden/empty/data state machine) and `DataTable`/`StatusPill`. That is where the §2.4 conversion actually landed — the audit finding was not "this table renders wrong" but that modules showed fabricated data or claimed capabilities with nothing behind them. Several tests exist specifically to keep "you have no invoices" and "you are not allowed to see invoices" from looking identical to an admin, and to stop a failed load being indistinguishable from an empty one (that is how a broken module looks healthy on a dashboard). Also pins `data === undefined` vs falsy, so a payload of `0` is treated as loaded, not absent. |
| RM-101 | Introduce Playwright | ✅ | `@playwright/test` + `playwright.config.ts` + `e2e/`, plus an `e2e` CI job (Chromium only — the golden paths are behaviour tests, not a cross-browser matrix). Two projects: Desktop Chrome and Pixel 7, because the Milestone 2 feedback asks specifically for mobile behaviour to be reviewable. `webServer` boots the app locally via `npx tsx server/_core/index.ts` rather than `npm run dev` — that script's `NODE_ENV=development` inline prefix is POSIX-only and fails under cmd.exe on Windows. Setting `E2E_BASE_URL` points the identical specs at staging once it exists, with no code change. |
| RM-102 | E2E golden path: login | ✅ | **10 specs passing against a real browser and a real server** (the unauthenticated half needs no credentials and writes nothing). Covers page load, submit-gating, password reveal, failed-login staying on `/login`, user-enumeration wording, no session cookie issued on failure, and anonymous access to all four portals (`/client-portal`, `/admin`, `/developer-workspace`, `/ops`) being gated. Signs in through the real form rather than injecting a cookie — the page has a 1.5s mount gate and a honeypot, and a test that bypasses them stops covering the part most likely to break. Authenticated specs (session cookie shape, logout re-gating) are written and skip pending staging accounts. |
| RM-103 | E2E golden path: dashboard | 🔶 | Written, skips pending staging accounts. Covers the client portal shell, absence of the error boundary, opening the Notification Center (the Milestone 2 §2.7 regression), horizontal-overflow at 390px, and the admin console accepting either the console **or** its MFA challenge as a correct outcome — Admin/Super Admin/Technical Operator carry a hard blocking MFA gate, so landing on the challenge is not a failure. |
| RM-104 | E2E golden path: document upload | 🔶 | Written, **double-gated**: needs staging accounts *and* `E2E_ALLOW_MUTATIONS=true`. The only database currently configured is the client's live Supabase project, and an upload flow run by a test runner would be a real row in it. Covers the happy path and the >50mb rejection surfacing an error rather than an endless spinner. |
| RM-105 | E2E golden path: messaging | 🔶 | Written, double-gated as RM-104. Covers send-and-appear plus the empty-message guard. |
| RM-106 | E2E golden path: booking (per portal) | ✅ | **4 specs passing for real.** Booking is the one flow with a genuinely public half — `/book-strategy` needs no auth — so unlike RM-103..105 this runs unconditionally. Drives the real 4-step wizard (service → date → time → details), which is itself worth covering: a break in the first two steps makes the whole public funnel unreachable and no unit test spans the transitions. Also asserts the honeypot exists (without filling it), that `listSlots` stays reachable unauthenticated, and no horizontal scroll at 390px. Only the final submit writes a row, so only that is gated behind `E2E_ALLOW_MUTATIONS`. |
| RM-107 | Formalize Milestone 1 negative-test patterns into a permanent CI-run auth/RBAC/tenant suite | ✅ | New `scripts/run-security-suite.mjs` (`pnpm run test:security`) + a dedicated `security-suite` CI job, so the highest-risk files are a distinct PR check rather than lines in a 600-test scroll. 18 files across identity/session, MFA, RBAC, tenant isolation and the new API-hardening layer. The runner closes the gap the plain test files left: it **fails if any listed file is missing** (a rename would otherwise silently shrink coverage) and **fails if the run collects zero passing tests** (a green result that checked nothing is a false assurance). Skips are reported explicitly rather than hidden, with a pointer that tenant isolation is only truly re-verified by RM-84/RM-85 against a deployed environment. **Result: 162 security tests passing locally against live Supabase.** |
| RM-108 | DB suite: FK/RLS/trigger enforcement | ✅ | **8 tests** in `server/dbConstraints.test.ts`, run against the live Supabase project (skips cleanly when unreachable, same probe pattern as RM-60). Complements RM-60, which proves RLS *behaves*, by proving the constraints are actually *declared and enforced*: application code can look correct while a constraint is missing — every write path just happens not to violate it yet. Covers FK count (≥30 of the ~40 from RM-44), explicit ON DELETE semantics, real orphan rejection (transaction, always rolled back), `updatedAt` trigger presence and actual firing, RLS enabled on every `organizationId` table, no RLS-enabled table left with zero policies, and unindexed FK columns. **Found a real defect — see RM-108-a below.** |
| RM-108-a | **Defect found by RM-108:** `updatedAt` trigger missing on 3 tables | ✅ | `platform_settings`, `workflow_definitions` and `webhook_registrations` declare `updatedAt` but were never wired to `set_updated_at()`. Migration 0002 covered the 18 tables that existed then; these were added later by 0011/0013/0014 and missed. The failure was silent — `defaultNow()` populated the column on insert, so it always looked correct; it simply never advanced on UPDATE, meaning "last modified" reported row *creation* time forever. That matters most for `platform_settings` and `webhook_registrations`, which Milestone 2 §2.5 relies on for configuration-change auditing. Migration `0017_missing_updated_at_triggers.sql` (idempotent) closes it. **Applied to the live Supabase project and re-verified: 0 tables now missing a trigger.** |
| RM-102-a | **Defect found by the RM-102 E2E run:** `URIError` on every page load | ✅ | `client/index.html` renders the analytics beacon as `src="%VITE_ANALYTICS_ENDPOINT%/umami"`. With that variable unset, Vite leaves the placeholder literal, the browser requests `/%VITE_ANALYTICS_ENDPOINT%/umami`, and Express's router throws `URIError: Failed to decode param` out of `decodeURIComponent` while matching the path — a stack trace **per page load**. Any client can trigger the same with a stray `%` in a URL, so this is not only about the beacon: an un-decodable path is a malformed request and belongs in the 400 family, not an unhandled exception. Added a guard in `server/_core/index.ts` + 4 tests. Verified gone on a re-run. |
| RM-109 | Workflow-specific suite per converted mockup (Payments, CRM, Role Management, etc.) | ✅ | Milestone 2 already shipped a suite per converted workflow; the plan's requirement is about the **set**, not any one file. `server/workflowCoverage.test.ts` pins that set: 20 converted capabilities mapped to their suites, failing if one is renamed or deleted. That closes a real hole — individual suites fail when the *code* breaks, but nothing previously failed when a *suite* was deleted, so coverage could silently drop while CI stayed green (the same false assurance RM-107's zero-test guard addresses). Also asserts each suite holds real assertions, and that no new `admin.*.test.ts` exists outside the manifest. **This flagged `admin.mfaPosture.test.ts` as the thinnest suite (2 assertions) — strengthened with the full role-rejection matrix, the unauthenticated case, super_admin acceptance, and a percentage-range guard on a value rendered straight into a progress bar.** |

### Defects found by this milestone's own verification work

| ID | Defect | Status |
|---|---|---|
| RM-111-a | **`users.email` had no index at all.** Even with `enable_seqscan=off` the planner produced a Seq Scan at the 1e10 disable penalty — Postgres's way of saying no usable index exists. That is `getUserByEmailWithPassword`, run on **every local login**. RM-45 indexed every FK and every status/tenant column, and `openId`/`authUserId` are covered by UNIQUE constraints — `email` is neither, so it fell through both sweeps. Migration 0018 adds a plain btree (deliberately not UNIQUE: whether two accounts may share an address is a product decision, not a performance one). **Applied to the live project; re-verified.** | ✅ |
| RM-118-a | **Schema/code version skew broke every local login.** `sessionsRevokedAtMs` was added to `drizzle/schema.ts` while migration 0016 was still unapplied, so Drizzle began selecting a column the database did not have and every login failed with `DrizzleQueryError`. Unit tests missed it entirely — they stub the DB layer. The **E2E run caught it**, because it drove a real login against a real database. 0016 applied and verified; the additive-migration rule in the rollback plan exists because of this. | ✅ |

## Workstream 3.5 — Performance & Final Verification

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-110 | Load-test highest-traffic procedures | ⏭ | |
| RM-111 | Confirm Milestone 1's indexes are actually used under realistic queries | ✅ | `server/queryPerformance.test.ts` — 6 read-only `EXPLAIN` tests against the live planner. RM-108 proves indexes *exist*; this proves the planner can *use* them, which is a different question (wrong column order, a type mismatch forcing a cast, or an unusable predicate all leave an index in place and ignored). Uses `SET LOCAL enable_seqscan = off` to reveal whether an index plan is even available, rather than banning seq scans outright — on a small table a seq scan is the *correct* choice, and a test that failed on an empty dev database would just teach the team to ignore the suite. **Found a real gap — see RM-111-a.** |
| RM-112 | Validate notification queue throughput against spec volume/SLA | ⏭ | Depends on RM-64/65 catalog being implemented. |
| RM-113 | Verify booking-slot concurrency under load | ⏭ | |
| RM-114 | Verify large-file upload performance | ⏭ | |
| RM-115 | Comprehensive functional walkthrough: every route, role, button, workflow, API, integration | 🔶 | **Checklist written; walkthrough not performed** — it cannot be, there is no deployed environment (RM-74) and no staging accounts. `docs/PRE_LAUNCH_WALKTHROUGH.md` covers all 45 client routes at three viewports, all 10 locales including Arabic RTL, the full authentication matrix, per-role boundary checks, all four portals, all 12 API routers, every integration, performance, and a post-go-live subset to re-run after DNS cutover. Every box is deliberately unticked, and lines already covered by automation say so — automation proves the mechanism works, not that the result is right. |
| RM-116 | Go-live: public release | ⏭ | Depends on RM-83 DNS cutover. |
| RM-117 | Monitored 48-hour stability window | ⏭ | |
| RM-118 | Documented rollback plan | 🔶 | **Written, never rehearsed** — `docs/RELEASE_ROLLBACK_PLAN.md`. Built around the asymmetry that actually governs rollback: code reverts in minutes, a schema change often cannot revert at all once data is written under it. Hence the additive-migration rule, which is not theoretical — it was violated during this milestone and caught by E2E (see RM-118-a). Covers pre-release gates, release ordering, smoke checks, DNS TTL discipline (TTL is the rollback speed limit and cannot be changed retroactively), explicit rollback triggers, the procedure itself, and a named gaps table. Deliberately not signed off: a rollback plan whose first execution is during a real incident is not a rollback plan. |
| RM-119 | Formal decommissioning of legacy TiDB/Manus infrastructure | ⏭ | Only after the 48-hour window and explicit sign-off — the old TiDB database is the Milestone 1 exit-gate fallback and must stay untouched until this point. |

---

## Milestone 3 Exit Gate (from the source plan — verify all before sign-off)

- [ ] Every item in the original audit's security-risk section is resolved.
- [ ] `grep` for Manus references outside historical docs is clean.
- [ ] CI is green and enforced on every merge.
- [ ] RLS is verified on every tenant-scoped table.
- [ ] MFA cannot be bypassed on any login path.
- [ ] The Notification Event Catalog is implemented and matches its specification.
- [ ] iosky.nl serves production traffic on client-owned infrastructure with valid SSL.
- [ ] The platform is stable for 48 hours post-launch before legacy TiDB/Manus infrastructure is
      formally decommissioned.

## Outstanding client decisions/blockers gating this milestone

- Hosting provider (RM-74) — carried over unresolved from Milestone 1 §1.3.
- Notification specification documents (RM-64) — gates all of §3.1.
- Audit-log integrity approach (RM-94) — genuine tamper-evidence vs. corrected UI claim.
- Staging/test accounts per role — gate RM-103/104/105 and the RM-115 walkthrough. Part of the staging
  environment, which is itself Milestone 1 §1.3 scope still blocked on the hosting decision.
- GitHub repository secrets (`DATABASE_URL`, `SUPABASE_*`, `JWT_SECRET`, `E2E_*`) — the CI jobs read
  them, but they must be added in repo settings by someone with admin access. Until then CI exercises
  the non-live subset only.
- Any Milestone 1/2 decisions still open at the time Milestone 3 starts (Super Admin RM-57 live-migration
  status, CRM/Role-Management scope) should be re-confirmed closed before this milestone's exit gate is
  attempted, since several §3.3/§3.4 items re-verify them under load/production conditions rather than
  introduce new decisions.

---

## Client decisions resolved 2026-08-28 (affects Milestone 2 §2.2/§2.3/§2.4 primarily, verified here)

The client supplied three provider decisions plus new requirements. Dashboard **login** credentials
(not yet real API keys) were saved to the local, gitignored-then-committed `.env` — see that file's
"THIRD-PARTY PROVIDER ACCOUNTS" section for the TODO env vars a future session must populate after
generating real API/secret keys from each dashboard.

- **Payments provider: Stripe.** Resolves Milestone 2 §2.4's "Admin mockup conversion — real payments
  (provider TBD)" item. New requirements on top of basic Stripe integration:
  - VAT identification-number validation and VAT calculation for both EU and international customers.
  - Customer VAT ID and IO SKY's own VAT ID both shown on every invoice.
  - All VAT-related data stored securely and made searchable within the system.
  - Invoice template must reflect full corporate identity (logo, brand colors/fonts, both parties' company
    + VAT details, all legally required invoice fields), be customizable, support manual invoice creation
    (not just system-triggered), and every generated invoice must be stored and searchable in-system.
- **Email provider: Zoho.** Resolves/supersedes Milestone 2 §2.3's Resend-only plan — Resend may still be
  used for transactional/auth email, but Zoho is now the primary provider decision. New requirements:
  - Integration with both Outlook and Gmail for sending/using email through the system.
  - Manual creation, management, and use of custom email templates within the system.
- **AI provider: OpenAI.** Resolves Milestone 2 §2.2's "LLM proxy" item (replaces the Manus/Forge proxy).
  New requirement: intelligent model routing — simple tasks → a cheaper/faster model, medium-complexity
  tasks → a more capable model, complex/high-reasoning tasks → the most capable model — optimized for
  cost and performance, not a single fixed model for every AI Scan/AI-governance call.
- **Open question, not yet answered by the client**: how the professional translation review process
  will work — specifically how the system verifies and records that a given translation (of the existing
  10-locale i18n content, and now of notification content per RM-72) has been professionally reviewed and
  approved. Needs a client answer before it can be scoped into either Milestone 2 (i18n) or Milestone 3
  (RM-72) work.

New tasks these decisions add to the backlog (not yet numbered into the RM- sequence above since they
land primarily in Milestone 2's scope, not Milestone 3's — tracked here for visibility until
`MILESTONE2_PROGRESS.md` is updated to reflect them):

- Stripe integration: checkout/payment-intent flow, webhook handling, VAT validation (e.g. VIES lookup for
  EU VAT numbers), VAT calculation logic, VAT data storage/search.
- Branded, customizable invoice template (PDF generation) wired to Stripe payment data, manual invoice
  creation path, invoice storage/search.
- Zoho Mail integration alongside/replacing Resend; Outlook/Gmail integration; manual email-template
  CRUD UI.
- OpenAI integration replacing the Forge LLM proxy; model-routing logic (task-complexity classifier →
  model tier selection).
- Translation review/approval workflow — pending client clarification.

---

## Summary

**21 of 56 tasks (RM-64..RM-119) complete, 6 partial.**

| Batch | Tasks | Area |
|---|---|---|
| 1 | RM-86, RM-87, RM-88, RM-89, RM-90 | §3.3 API hardening + session security |
| 2 | RM-82, RM-91, RM-93, RM-96, RM-107 | §3.2 artifact scan, §3.3 XSS/validation audit, §3.4 CI test wiring |
| 3 | RM-97, RM-98, RM-99, RM-100, RM-108 | §3.4 React Testing Library + frontend coverage + DB constraint suite |
| 4 | RM-101, RM-102 ✅ · RM-103, RM-104, RM-105 🔶 | §3.4 Playwright + E2E golden paths |
| 5 | RM-106, RM-109, RM-111 ✅ · RM-115, RM-118 🔶 | §3.4 booking E2E + workflow manifest · §3.5 index usage, walkthrough, rollback plan |
| — | RM-80 (🔶) | §3.2 CI/CD — build half done, deploy half blocked on RM-74 |

Four of these were specified as "confirm X" or "audit X" and turned out to be **genuine defects**:

- **RM-89** — sessions were valid for a full year, by accident rather than decision (the SDK default).
- **RM-90** — logout revoked nothing; it cleared the browser cookie while the token stayed valid.
- **RM-91** — the codebase's only `dangerouslySetInnerHTML` sat in dead, unreferenced scaffold code.
- **RM-108** — three tables' `updatedAt` never advanced on UPDATE, so "last modified" reported creation
  time. Silent, because insert-time defaults kept the column looking populated. Fixed in migration 0017
  and applied to the live project.
- **RM-102** — the first E2E run exposed a `URIError` thrown out of Express's router on *every page
  load*, from an unconfigured analytics placeholder reaching the server verbatim. Guarded and tested.

- **RM-111** — `users.email`, the local-login lookup, had no index at all; it fell between RM-45's
  foreign-key sweep and the UNIQUE constraints covering `openId`. Migration 0018, applied.
- **RM-118** — schema/code skew: `sessionsRevokedAtMs` was in the ORM schema before migration 0016 was
  applied, so **every local login failed**. Unit tests stub the DB and saw nothing; the E2E run caught it.

The last two are the argument for E2E and for live-database testing in one line: neither bug exists until
a real browser talks to a real server backed by a real database. Four layers of unit tests never saw them.

Two were clean on inspection and are now enforced rather than merely recorded:

- **RM-93** — 169 procedures, 0 validation gaps; now a CI-failing test instead of a point-in-time audit.
- **RM-82** — 395 artifact files, 0 secrets; now a CI job instead of a manual pass.

Verification for the completed set: `pnpm run check` clean; `pnpm run test` **696 passed / 15 skipped /
0 failed across 63 files** (up from 569 before this work — **+127 new tests**, zero regressions), confirmed
stable over two consecutive full runs; `pnpm run test:security` 162 passing; `pnpm run build` clean;
`pnpm run scan:artifact` PASS.

Two flakes of our own were found and fixed rather than left to intermittently fail CI: a rate-limit
window test using a window narrow enough that a scheduling pause flipped its result, and
`sessionRevocation.test.ts` assigning `process.env.JWT_SECRET` at module top level, which leaked into a
sibling file sharing a worker and broke `viewAs.test.ts` only in the full run, never in isolation.

This document was originally scaffolding only, generated directly from
the Milestone 3 section of `IO_SKY_Three_Milestone_Plan.pdf` so that future sessions have the same
per-task tracking structure Milestone 1 (`PHASE1_CHECKLIST.md`) and Milestone 2
(`MILESTONE2_PROGRESS.md`) already use. Update statuses and add Evidence/Notes as work actually
happens — do not mark anything ✅ without the same live-verification bar (`tsc`, tests, and where
applicable a real running check) used in the other two documents.
