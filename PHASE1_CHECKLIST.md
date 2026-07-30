# Phase 1 (Milestone 1) Implementation Checklist

Live tracking document. Source of truth for task scope: `IO_SKY_Milestone1_Forensic_Audit.md` §10
(Roadmap, RM-01..RM-63). This session executed every task that was achievable as a pure code
change, without external provider access or a pending client decision. Nothing was committed —
all changes sit in the working tree for review.

**Environment note:** the E: drive had 0 bytes free (`pnpm install` failed with `ENOSPC`). Every
change below was verified by careful manual/static review against existing code patterns and
exact TypeScript types — **not** by running `tsc --noEmit` or `vitest run` live (both were
unavailable). The one live signal available was an IDE diagnostics hook that fired after each
edit; it only ever reported pre-existing Tailwind class-naming suggestions unrelated to these
changes, never a type error on anything touched here — a positive but not conclusive signal.
**Run `pnpm run check` and `pnpm run test` once disk space is freed, before merging anything.**

Legend: ✅ Done this session · ⛔ Blocked (external access/decision required) · 🔶 Partially done / deliberately descoped (see note) · ⏭ Not started

---

## Workstream 2.1 — Repository cleanup

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-01 | Confirm GitHub org is the intended client-owned production org | ⛔ | Client-input question, not code. Remote is `github.com/SheharyarXD/IO-SKY.git` — confirm this is the intended long-term org before more work is pushed. |
| RM-02 | Delete 8 checked-in JSON audit-output artifacts + `pt_batches/` (19 files) | ✅ | Deleted `scripts/{identical_audit,locale_audit,locale_audit2,mixed_audit,mixed_final,mixed_strong,pt_fallback_keys,pt_missing}.json` + `scripts/pt_batches/` (11 files). Verified each was a pure generated artifact before deleting. |
| RM-03 | Consolidate numbered/versioned script variants | 🔶 | Deleted the clear-cut superseded pairs: `fix_shared_terms.mjs`+`fix_shared_terms2.mjs` (kept `3`), `debug_forge.mjs` (kept `2`), `retranslate_fallbacks.mjs` (kept `v2`), `locale_audit.mjs` (kept `2`), `build_leftovers.mts` (kept `2`). **Deliberately left alone**: `mixed_audit.mts`/`mixed_audit2.mts`/`mixed_final.mts`/`mixed_strong.mts`/`identical_audit.mts` and the `pt_dump`/`pt_missing`/`pt_rebuild`/`pt_split` chain — supersession order between these is genuinely ambiguous without deeper investigation than is safe to guess at; recommend a human confirm which was last run before deleting further. |
| RM-04 | Delete 13 confirmed dead code files | 🔶 (12/13) | Deleted 12: `server/_core/{imageGeneration,voiceTranscription,map,dataApi,heartbeat}.ts`, `client/src/pages/developer-workspace/sections/DeveloperPlaceholder.tsx`, `client/src/components/{Map,AIChatBox,CTABand,Reveal}.tsx`, `client/src/pages/admin/sections/ModuleStub.tsx`, `client/src/components/ui/form.tsx`. Each independently re-verified for zero real importers (not just a basename grep — see session notes) before deletion. `server/routers/audit.ts` (the 13th, "orphaned not dead") was **intentionally left in place** — it's still mounted in `appRouter` and reachable, so deleting it is a live-route-removal decision, not a pure dead-code cleanup; flag for a product decision, not a Phase 1 hygiene task. |
| RM-05 | Remove unused packages | ✅ | Removed from `package.json`: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@hookform/resolvers`, `date-fns`, `react-hook-form` (became unused after `ui/form.tsx` deletion — verified 0 usages), `tailwindcss-animate`, devDependency `add`, devDependency `@types/google.maps` (unused after `Map.tsx`/`map.ts` deletion). Also moved misplaced `@types/nodemailer` from `dependencies` to `devDependencies`. |
| RM-06 | Delete empty decoy folders | ✅ | Deleted `drizzle/migrations/` (only contained `.gitkeep`) and `.manus/checkpoint_zip` (confirmed empty). |

## Workstream 2.2 — Secrets rotation

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-07 | Rotate `DATABASE_URL` password at TiDB | ⛔ | Requires TiDB console access. |
| RM-08 | Regenerate `JWT_SECRET` | ⛔ | Requires deployment/secret-store access. |
| RM-09 | Rotate/revoke Forge API key | ⛔ | Requires Manus dashboard access. |
| RM-10 | Rotate staging password | ⛔ | Requires deployment access. |
| RM-11 | Confirm AWS STS token dead | ⛔ | Requires AWS console access. |
| RM-12 | Remove hardcoded fallback secrets, add fail-fast validation | ✅ | Added `requireSecret()`/`getCookieSecretBytes()` to `server/_core/env.ts`. Removed `"iosky-dev-fallback-secret"` from `server/_core/booking/tokens.ts` and `"iosky-staging-fallback-secret-change-me"` from `server/_core/stagingGate.ts` (still legitimately falls back `STAGING_SECRET → JWT_SECRET`, just no longer to a hardcoded string). Rewired `sdk.ts`, `mfaChallenge.ts`, `viewAsRoute.ts` off the old `ENV.cookieSecret ?? ""` empty-string-fallback pattern onto the new fail-fast helper. |

## Workstream 2.3 — Environment cleanup

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-13 | Reconcile `ENV_TEMPLATE.txt`/`ENV_REFERENCE.md` | ✅ | `ENV_TEMPLATE.txt` is now the single authoritative source. `ENV_REFERENCE.md` rewritten as a short deprecation notice explaining exactly what disagreed and why, pointing to the template (kept rather than deleted so old links don't 404). |
| RM-14 | Remove/flag 19 dead documented env vars | ✅ | In `ENV_TEMPLATE.txt`: `S3_*` (5 vars) and `VITE_APP_TITLE`/`VITE_APP_LOGO` commented out with an explanation of why (re-verified zero code references for all 7 before touching). The other 12 (TRUST_PROXY, BOOKING_ADAPTER+4 calendar vars, OWNER_NOTIFY_WEBHOOK, HEARTBEAT_MODE, 4 wrong-shape SMTP_* vars) never existed in `ENV_TEMPLATE.txt` to begin with (they were only ever in the now-deprecated `ENV_REFERENCE.md`) — documented as removed in that file's rewrite. |
| RM-15 | Centralize `process.env` reads through `env.ts` | ⏭ | Not attempted — larger optional refactor (~15 files), lower priority than the security/bug fixes actually completed. Left for a follow-up pass. |

## Workstream 2.4 — GitHub migration

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-16 | Secret-scan commit history | ⛔ | No scanning tool available in this environment. Spot-verified `.project-config.json` was never committed (`git ls-files \| grep project-config` → empty, confirmed gitignored). |
| RM-17 | Enable branch protection on `main` | ⛔ | Requires GitHub repo settings access. |
| RM-18 | Document branching/commit convention | ✅ | New `CONTRIBUTING.md` at repo root. |

## Workstream 2.5 — CI foundation

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-19 | Add minimal CI workflow | ✅ | New `.github/workflows/ci.yml` — checkout, corepack enable, setup-node w/ pnpm cache, `pnpm install --frozen-lockfile`, `pnpm run check`, `pnpm run test`. Runs on push/PR to `main`. Could not be verified by an actual CI run (no push performed); YAML structure manually reviewed (no tabs, consistent indentation, standard action versions). |
| RM-20 | Verify clean install in CI | ⛔ | Needs an actual CI run once pushed. `pnpm-lock.yaml` was independently confirmed structurally intact in the prior audit (320,267 bytes, valid head/tail, matches `package.json`'s `overrides`/`patchedDependencies`). |

## Workstream 2.6 — Code hygiene

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-21 | Extract shared rate-limiter module | ✅ | New `server/_core/rateLimiter.ts` (`createRateLimiter(limit, windowMs?)` factory, one independent counter per call site — preserves original per-router isolation). Replaced all 4 duplicated implementations in `aiScans.ts`, `bookings.ts` (2 limiters: holds + submissions), `engineering.ts`, `contact.ts`. |
| RM-22 | Extract shared IP/UA extraction module | ✅ | New `server/_core/requestMeta.ts` (`getRequestIp`/`getRequestUserAgent`/`getRequestMeta`, works for both tRPC `ctx.req` and raw Express `req`). Replaced **all 15 sites found** (12 originally flagged + 3 more found during the sweep: `localAuthRoute.ts` ×2, `oauth.ts` ×1) across `routers.ts`, `solutions.ts`, `bookings.ts`, `contact.ts`, `engineering.ts`, `mfa.ts`, `legal.ts`, `admin.ts`, `developer.ts`, `mfaChallengeRoute.ts`, `localAuthRoute.ts`, `oauth.ts`, `aiScans.ts`. Files with many call sites (`mfa.ts`, `developer.ts`, `mfaChallengeRoute.ts`) kept their local function names as thin aliases onto the shared implementation, to minimize diff risk; files with few call sites were updated directly. Exhaustively re-grepped afterward — zero raw `x-forwarded-for`/`remoteAddress` parsing remains anywhere outside the shared module and test fixtures. |
| RM-23 | Extract shared public-ref generator | ✅ | New `server/_core/publicRef.ts` (`generatePublicRef(prefix?)`). Replaced all 4: `bookings.ts` (no prefix), `contact.ts` ("MSG"), `engineering.ts` ("DEV"), `clientPortal.ts`'s `randomRef` ("T"). Standardized on the safer variant (ambiguous-character 0/O/I/L/1 → X substitution) that 3 of 4 originals had — `clientPortal.ts`'s was missing it; this is a small, deliberate behavior normalization, not just a dedup. |
| RM-24 | Deduplicate `evaluateDeveloperGate` block in `trpc.ts` | ✅ | Extracted `resolveDeveloperContext(user)` shared helper; `developerProcedure` and `developerSelfProcedure` now each do only their own distinct role check, then call the shared helper. Net -11 lines, zero duplicated gate logic remaining. |
| RM-25 | Consolidate 3 `StatusPill` components | ⏭ | **Deliberately not attempted.** Three different prop shapes/visual treatments across `AdminBookings.tsx`, `OperationalPage.tsx`, `PortalUI.tsx` — reconciling them safely needs visual verification (no dev server available in this environment). Scoped and ready for a follow-up pass with a working local environment. |
| RM-26 | Consolidate 2 query-boundary components | ⏭ | Same reasoning as RM-25 — `ModuleStateBoundary` (admin) vs `SectionStateSwitch` (client-portal/developer-workspace, reused across ~13 files) have different prop shapes and different visual sub-components (skeleton styles, empty states). Highest-value remaining hygiene item per the audit, but also the highest-regression-risk one to do blind. Deferred. |
| RM-27 | Remove dead `Reveal.tsx`, resolve `CTABand` collision | ✅ | Resolved as a side effect of RM-04 — deleting the dead standalone `components/{Reveal,CTABand}.tsx` files leaves exactly one definition of each concept (`RevealOnScroll.tsx` live; `About.tsx`'s local `CTABand()` live). Verified via grep: no remaining references to the deleted files. |
| RM-28 | Shared date-format helper, 11 call sites | ✅ | New `formatDate()` in `client/src/lib/utils.ts`. Replaced all 11 originally-flagged call sites across `ReportsProjectsBillingDocs.tsx`, `DeveloperFiles.tsx`, `DeveloperAgreements.tsx`, `DeveloperTasks.tsx`, `DeveloperProjects.tsx` (×2), `ClientProjects.tsx`, `ClientInvoices.tsx` (×2), `ClientDashboard.tsx` (×3, including the local `timeAgo()` wrapper's fallback line). **Scope note:** kept behavior identical (still browser-default locale) rather than wiring in the app's real locale-aware `formatDate()` from `lib/i18n.ts` — discovered mid-task that none of these 8 files currently use the `useT()`/i18n system at all, so doing that properly is a separate, larger, behavior-changing task (adding a new hook dependency to 8 previously-non-i18n components), not a pure dedup. The underlying "dates don't respect the active app language" gap is still open — flagged for a follow-up task, not silently fixed. |
| RM-29 | Split `admin.ts` into sub-routers | ⏭ | Not attempted — large structural refactor (1,120 lines → ~5 files), meaningfully higher regression risk than anything else in this batch, better done as its own reviewed PR with tests passing first. |
| RM-30 | Relocate `PortalUI.tsx` primitives | ⏭ | Depends on RM-25/RM-26 landing first (would be relocating the consolidated components, not the current divergent ones). |

## Workstream 2.7 — Bug fixes

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-31 | Fix booking slot-release bug | ✅ | Added `cancelBookingSlotById(slotId)` to `server/db/bookings.ts` (the original `cancelBookingSlot(bookingId)` filters by the slot's `bookingId` column, which is still null at the point of failure — confirmed during implementation that a literal-`0`-to-`slotId` swap alone would **not** have worked; a new helper filtering by the slot's own `id` was required). `server/routers/bookings.ts`'s `create` failure-cleanup path now calls it with the real `slotId`. |
| RM-32 | Fix `rescheduleByToken` 5,000-row scan | ✅ | Added `getBookingById(id)` to `server/db/bookings.ts`. `rescheduleByToken` now calls it directly instead of `listRecentBookings(5000)` + in-memory `.find()`. |
| RM-33 | Fix MFA lockout race condition | ✅ | `bumpMfaFactorFailure` in `server/db/mfa.ts` rewritten: counter increment is now an atomic SQL `failedAttempts + 1` update (can't lose an update to a concurrent request), and the lock decision is read back immediately after rather than computed from a caller-supplied, possibly-request-old value. Updated all 3 call sites (`mfaChallengeRoute.ts`, `mfa.ts` ×2) to the new `{maxFailedAttempts, lockWindowMs}` signature. Updated the 2 test mocks (`mfa.test.ts`, `mfaChallenge.test.ts`) to match the new contract so the existing lockout tests keep testing real behavior instead of silently no-op'ing. Also fixed the adjacent `listUnusedRecoveryCodesForUser` finding (filters `usedAt IS NULL` in SQL now, not just via caller-side filtering). |
| RM-34 | Fix `client_member` redirect drift | ✅ | `localAuthRoute.ts` no longer has its own duplicated `roleBasedDestination` (which was missing the `client_member` case) — now imports and reuses `oauth.ts`'s complete version. Fixes the actual bug (both login paths now redirect identically) and removes a duplication at the same time. |
| RM-35 | Fix admin "AI Scans" KPI | ✅ | `buildSummary()` in `server/routers/admin.ts` now runs real `ai_scans`-table count queries (this-month / last-month) instead of the placeholder `bookings + leads` sum. Removed the now-unused `bookingsThisMonth`/`bookingsLastMonth`/`leadsThisMonth`/`leadsLastMonth` queries and the now-unused `bookings` table import (they existed only to feed the old placeholder calc). |
| RM-36 | Add alerting on admin/security audit-write failure | ✅ | Replaced silent `catch {}`/`catch { /* best-effort */ }` blocks with `console.error`-logged failures (loud instead of silent) in: `admin.ts`'s `recordAdminEvent` (the audit write used by ~20 admin procedures), `viewAsRoute.ts`'s impersonation-enter and impersonation-exit audit writes, and `localAuthRoute.ts`'s failed-login and successful-login audit writes. Each error message includes enough context (reason, user/admin id, target) to be useful once real log aggregation exists. Explicitly does **not** fabricate a call to a nonexistent alerting service (no Sentry/PagerDuty configured yet, confirmed in the underlying audit) — that would just be a new mock pretending to be real monitoring. |
| RM-37 | Fix `/manus-storage/*` unauthenticated access (IDOR) | ✅ | `storageProxy.ts` now requires a valid authenticated session (`sdk.authenticateRequest`) before proxying any key **except** the site's 3 known public branding assets (exact-match allowlist — confirmed via exhaustive grep of every `/manus-storage/` reference in `client/`, not a guessed prefix convention, since the real keys are flat filenames with no distinguishing folder). Separately, `developer.ts`'s `requestFileSignedUrl` now calls the already-real `storageGetSignedUrl()` instead of `storageGet()`, which never actually signed anything — this makes the endpoint's own "approved files only, via signed URLs" doc comment true for the first time. Updated `developer.test.ts`'s mock and assertion to match. **Explicitly scoped as a partial mitigation, documented in code**: this closes the "any anonymous internet caller" exposure (the most severe part of the finding) but does not yet add full per-tenant ownership checks between two different authenticated users — that's real Supabase Storage RLS work, tracked as Milestone 2. |
| RM-38 | Verify/fix `SameSite`/`Secure` cookie config | ⛔ | Depends on the hosting/reverse-proxy decision, which hasn't been made yet — cannot be verified against infrastructure that doesn't exist. |
| RM-39 | Replace `Math.random()` with `crypto.randomBytes` | ✅ | `solutions.ts`'s `newToken()` (the Custom Discovery session bearer token — the sole access control for PII captured in that flow) now uses `crypto.randomBytes(24).toString("hex")`, matching the convention already used for AI Scan report tokens. |
| RM-40 | Scrub PII from console logs | ✅ | `localAuthRoute.ts` no longer logs the raw email address on login attempts (the real audit trail is the access-controlled `login_audit` DB row, unaffected). |

## Workstream 2.8 — Supabase project setup

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-41 | Client provisions Supabase project(s) | ⛔ | Client action. |
| RM-42 | Record connection strings | ⛔ | Depends on RM-41. |

## Workstream 2.9 — Database migration

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-43..47 | Schema translation, FKs, indexes, write-path rewrite, data migration | ⛔ | Blocked on RM-41 — no Supabase Postgres to migrate to yet. Full scope already documented in the forensic audit §4/§9. |
| RM-48 | RLS policies | ⛔ | Blocked on RM-43 + the auth decision (RM-49). |

## Workstream 2.10 — Authentication migration

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-49 | **Client decision: Path A vs Path B** | ⛔ | **Still blocks RM-50 through RM-63.** Not something this session could resolve — it's a client sign-off, not a code task. |
| RM-50..54 | Profiles design, login/OAuth/MFA/password-reset migration | ⛔ | Blocked on RM-49. |

## Workstream 2.11 — RBAC rebuild

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-55 | Full RBAC port onto Supabase session | ⛔ | Blocked on RM-49. |
| RM-56 | Fix `solutions.ts` `adminList*` inconsistency | ✅ | `adminListClicks`/`adminListProposals`/`adminListDiscoveries` now use the shared `adminProcedure` builder instead of `protectedProcedure` + a manually inlined role check — closes the "any authenticated user, not just admins" gap immediately, independent of the larger Supabase Auth migration. |
| RM-57 | Super Admin role decision | ⛔ | Client decision. |

## Workstream 2.12 — Route Guards

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-58, RM-59 | Shared route guard component | ⛔ | Blocked on RM-49/RM-55 — needs the new session model to guard against; building this against the current custom-auth session would be throwaway work if Path A is chosen. |

## Workstream 2.13 — Row-Level Security

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-60 | Negative cross-tenant RLS test suite | ⛔ | Blocked on RM-48. |

## Workstream 2.14 — Dev/Staging/Prod environments

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| RM-61..63 | Environment separation | ⛔ | Blocked on RM-41. |

---

## Summary

- **Completed this session: 25 of 63 tasks** (RM-02, 04*, 05, 06, 12, 13, 14, 18, 19, 21, 22, 23, 24, 27, 28, 31, 32, 33, 34, 35, 36, 37, 39, 40, 56), plus RM-03 partially.
- **Blocked on external provider/account access:** RM-01, 07–11, 16, 17, 20, 41, 42 — 12 tasks.
- **Blocked on the RM-49 client decision (Path A vs Path B):** RM-43 through RM-63 except RM-56 — ~27 tasks.
- **Deliberately deferred pending a working local dev environment for visual QA:** RM-25, RM-26, RM-29, RM-30, RM-15 — 5 tasks, all UI-consolidation or larger structural refactors where the regression risk of proceeding blind outweighed the hygiene benefit.

### What this means for Milestone 1 completion
Every P0/P1 security finding from the forensic audit that was fixable without external access is now fixed: the storage-proxy IDOR, the hardcoded/empty-string fallback secrets, the MFA lockout race condition, the silent audit-log swallowing, and the `solutions.ts` RBAC inconsistency. The repository is meaningfully cleaner (37 dead/stale files removed, 8 packages removed, ~150 lines of duplicated logic consolidated into 3 new shared modules). CI now exists. What remains blocked is either genuinely outside code-change scope (secrets rotation is an operational action, not a diff) or gated behind the one architectural decision (RM-49) that was always going to need a human call — per the original forensic audit, that decision alone gates roughly half of the full Milestone 1 task list.

**Recommended immediate next steps, in order:**
1. Free up disk space on E: and run `pnpm install && pnpm run check && pnpm run test` to verify everything in this session compiles and passes before merging.
2. Make the RM-49 (Path A/B) decision — it's the single highest-leverage unblock remaining.
3. Provision Supabase (RM-41) in parallel with #2.
4. Review and merge this session's changes as a set of scoped PRs per `CONTRIBUTING.md`'s convention (they're already organized by task ID for exactly this purpose).
