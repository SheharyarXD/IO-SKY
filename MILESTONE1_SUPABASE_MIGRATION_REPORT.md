# IO SKY — Milestone 1 Supabase Migration Report

Scope: continuation of Milestone 1 following the RM-49 decision (**Path A — Supabase Auth as
the primary authentication system**: Supabase Auth = source of truth for auth/sessions,
Supabase Postgres = application database, Supabase RLS = tenant/security boundary). Primarily
covers RM-41 through RM-63, plus RM-04's final resolution and a security/consistency re-sweep
added in a follow-up pass (§13/§14). Cross-reference: `PHASE1_CHECKLIST.md` (full RM-01..63
tracking, every session) and `CONTRIBUTING.md` (branching/commit convention).

**Headline: RM-41 through RM-60 are all done and live-verified, plus RM-04 resolved and a full
security/consistency re-sweep completed in a follow-up pass.** The Supabase Postgres database is
live (schema, FKs, indexes, triggers, RLS — §3/§5), Supabase Auth is wired into the real login
flow and verified end-to-end against the actual project (§6), RBAC needed zero code changes and
that's now proven with a dedicated test suite (§7), the three portal route guards are
consolidated into one shared hook (§7a), and an 18-test negative RLS suite runs against the live
database through the real PostgREST API (§5a). A follow-up pass then: resolved RM-04's last file
(§13), re-investigated RM-03/RM-15/RM-25/RM-26/RM-29 with concrete evidence rather than size
estimates (all confirmed to correctly stay deferred — see §13), found and fixed a real
Math.random()-fallback + entropy-truncation bug in the booking system's hold-token generator and
5 more stale `provider: "manus"` audit-log literals (§14), and re-read every multi-hop RLS policy
against actual application query logic with no gaps found (§14). **A later, independent
re-verification pass (§15, 2026-08-12) confirmed all of the above from a clean install in a
different environment — 0 typecheck errors, 385/418 tests passing (33 skipped, all correctly
env-gated), a clean production build, and a fresh security/auth/RLS sweep that found nothing new
— with zero code changes needed.** What's left for Milestone 1: RM-57 (Super Admin) is a genuine
open client decision, and a handful of tasks remain externally blocked (secrets rotation, branch
protection, CI-run verification — none of them database-related).

---

## 1. RM-41 through RM-63 status

| RM | Task | Status |
|---|---|---|
| RM-41 | Provision Supabase project | ✅ Done — project `rhgzcgcqlypuvislwjlf` |
| RM-42 | Record connection strings | ✅ Done — `DATABASE_URL` (pooler) + all API keys recorded in `.env` |
| RM-43 | Schema translation (MySQL → Postgres) | ✅ **Live** — 53/53 tables confirmed on the actual database |
| RM-44 | Foreign keys | ✅ **Live** — 65 foreign keys confirmed on the actual database |
| RM-45 | Indexes | ✅ **Live** — 126 indexes confirmed on the actual database |
| RM-46 | Rewrite MySQL-specific write-path code | ✅ Done — 0 remaining `insertId`/`affectedRows`/`onDuplicateKeyUpdate`/1062 patterns |
| RM-47 | Data migration | ✅ Done — confirmed no production data exists; nothing to migrate |
| RM-48 | RLS policies | ✅ **Live** — 53/53 tables RLS enabled+forced, 102 policies confirmed on the actual database |
| RM-49 | Client decision: Path A vs Path B | ✅ Resolved — Path A |
| RM-50..54 | Login/OAuth/MFA/password-reset migration | ✅ **Wired and live-verified end-to-end** (§6) |
| RM-55 | RBAC rebuild on Supabase session | ✅ Verified — zero code changes needed, proven with a 21-test suite (§7) |
| RM-56 | Fix `solutions.ts` `adminList*` inconsistency | ✅ Done (prior session) |
| RM-57 | Super Admin role decision | ⛔ **STOP — investigated, insufficient repo information, flagged for client** (§12) |
| RM-58/59 | Route guards on Supabase session model | ✅ Shared `useRouteGuard` hook, all 3 portals migrated (§7a) |
| RM-60 | RLS negative test suite | ✅ 18 tests, live against the real database (§5a) |
| RM-61..63 | Environment separation | 🔶 Partial — `.gitignore`/docs done; Supabase project-separation is a client account decision |

RM-01..40 (repository cleanup through bug fixes) were completed in the prior session — see
`PHASE1_CHECKLIST.md` Workstreams 2.1–2.7 for that detail; unchanged by this session.

---

## 2. Exact files changed this session

**New files — database/migrations:**
- `drizzle/0000_slim_santa_claus.sql` — baseline Postgres schema (53 tables, ~47 enums)
- `drizzle/0001_futuristic_nekra.sql` — foreign keys + indexes
- `drizzle/0002_updated_at_triggers.sql` — hand-written `set_updated_at()` trigger (Postgres replacement for MySQL's `.onUpdateNow()`), applied to the 18 tables with an `updatedAt` column
- `drizzle/0003_add_auth_user_id.sql` — `users.authUserId` (uuid, links to Supabase `auth.users.id`)
- `drizzle/0004_rls_policies.sql` — RLS helper functions + policies for all 53 tables
- `drizzle/0005_auth_users_fk.sql` — `users.authUserId` FK to Supabase's `auth.users(id)`, `ON DELETE SET NULL`
- `drizzle/meta/0000_snapshot.json` .. `0005_snapshot.json` (+ updated `_journal.json`)
- `drizzle/_archive_mysql_migrations/` — the 13 original MySQL migrations, preserved for history (prior session)

**New files — auth:**
- `server/_core/supabaseAuth.ts` — Supabase admin client + `verifySupabaseAccessToken()`
- `server/_core/supabaseAuthRoute.ts` — `POST /api/auth/supabase/session` bridge endpoint
- `server/supabaseAuth.test.ts` (5 tests), `server/rbac.authOrigin.test.ts` (21 tests), `server/rls.negative.test.ts` (18 tests, live)
- `client/src/lib/supabase.ts` — Supabase browser client (publishable key only)
- `client/src/pages/ResetPassword.tsx` — password-reset completion page
- `client/src/_core/hooks/useRouteGuard.ts` — shared route-guard logic (RM-58/59)
- `client/src/_core/hooks/useRouteGuard.test.ts` (6 tests)
- `server/auth.recordAttempt.test.ts` (3 tests)

**Modified files:**
- `drizzle/schema.ts` — full MySQL→Postgres rewrite (53 tables) + FKs/indexes + `authUserId`
- `drizzle.config.ts` — `dialect: "postgresql"`, `dbCredentials.url` from `DATABASE_URL`
- `server/db/connection.ts` — `drizzle-orm/postgres-js` + `postgres` (was `drizzle-orm/mysql2`)
- `server/db/{aiScans,bookings,clientPortal,crm,developerWorkspace,mfa,solutions,users}.ts` — MySQL write-path rewrite (RM-46) + `users.ts`: `getUserByAuthUserId`/`linkAuthUserId`/`createUserFromSupabase` (RM-50)
- `server/_core/env.ts` — added `supabaseUrl`/`supabasePublishableKey`/`supabaseSecretKey`/`supabaseJwksUrl`
- `server/_core/index.ts` — registered `registerSupabaseAuthRoutes`
- `server/routers.ts` — added `"supabase"` to `auth.recordAttempt`'s provider enum
- `server/{bookingAdmin,bookings,viewAs}.test.ts` — `JWT_SECRET` test-setup fix (see §10)
- `client/src/pages/Login.tsx` — Supabase sign-in tried first (falls back to local-password), real password reset
- `client/src/pages/App.tsx` — registered `/reset-password` route
- `client/src/_core/hooks/useAuth.ts` — logout also calls `supabase.auth.signOut()`
- `client/src/pages/admin/components/AdminLayout.tsx`, `client/src/pages/client-portal/ClientPortal.tsx`, `client/src/pages/developer-workspace/DeveloperWorkspace.tsx` — migrated to the shared `useRouteGuard` hook, fixed hardcoded `provider: "manus"` audit logging
- `vitest.config.ts` — added `client/src/**/*.test.ts` to the test glob (DOM-free logic only)
- `package.json` / `pnpm-lock.yaml` — added `@supabase/supabase-js`, `postgres`; removed unused `mysql2`
- `ENV_TEMPLATE.txt` — Supabase section, corrected stale MySQL/TiDB `DATABASE_URL` comment, environment-separation note
- `.gitignore` — added `.env.development`, `.env.staging(.local)`, `.env.production` variants
- `PHASE1_CHECKLIST.md` — full status update across every workstream touched this session

No files were deleted this session (the MySQL migration archive move happened in the prior
session and is preserved intact — 13 `.sql` files + 14 meta files confirmed present). All of
the above was pushed as a sequence of separate, reviewable commits (one per RM task) to both
`origin` and `org` remotes, per `CONTRIBUTING.md`'s convention.

---

## 3. Supabase migrations created

Five migrations, in order, forming the complete Postgres migration history:

| # | File | Purpose |
|---|---|---|
| 0000 | `0000_slim_santa_claus.sql` | Create all 53 tables + ~47 enum types (no constraints yet) |
| 0001 | `0001_futuristic_nekra.sql` | Add ~65 foreign keys + FK/status indexes |
| 0002 | `0002_updated_at_triggers.sql` | `set_updated_at()` trigger function + 18 `BEFORE UPDATE` triggers |
| 0003 | `0003_add_auth_user_id.sql` | Add `users.authUserId uuid unique` (Supabase Auth link) |
| 0004 | `0004_rls_policies.sql` | RLS helper functions + policies, all 53 tables |

**Applied to the live database via `npx drizzle-kit migrate`, and verified with direct SQL
queries against the actual project** (not just re-running `generate` locally): `select count(*)
from information_schema.tables` → 53, `pg_class.relrowsecurity`/`relforcerowsecurity` → 53/53,
`pg_policies` → 102 rows, `pg_trigger` → 18, `information_schema.table_constraints` (FK) → 65,
`pg_indexes` → 126, `pg_proc` → all 5 RLS helper functions + `set_updated_at`.

Two real problems surfaced and were fixed while getting here, both worth recording:

1. **The `DATABASE_URL` the client provided was corrupted in transit.** Part of the password
   (a URL-percent-encoded `%40` for a literal `@` character, followed by the host) had been
   turned into a Markdown mailto-link (`%[...](mailto:...)`) somewhere between where the value
   was copied and where it landed in `.env`, plus a stray backslash before the first colon —
   consistent with having passed through a Markdown-rendering surface at some point. Diagnosed
   from the exact corruption pattern and reconstructed; the password itself was never echoed
   back in chat.
2. **The reconstructed URL then failed with `CONNECT_TIMEOUT`.** `nslookup` showed Supabase's
   direct-connection host (`db.<ref>.supabase.co`, port 5432) resolves to an IPv6 address only
   — no IPv4 record — and this machine has IPv6 disabled on every network adapter
   (confirmed via `Get-NetAdapterBinding`). This is a known Supabase situation; the fix is
   their **connection pooler** (Supavisor, port 6543, IPv4-reachable) instead of the direct
   host — the client supplied that pooler URL and it connected immediately.
3. **The first `drizzle-kit migrate` run then failed mid-way** with Postgres NOTICE-level
   "identifier will be truncated" messages escalating into a real parse error. Root cause: this
   report's own migration file, `drizzle/0002_updated_at_triggers.sql`, documented drizzle-kit's
   statement-separator convention by quoting it literally in a comment (`"--> statement-
   breakpoint"`) — drizzle-kit's migration-file splitter does a plain substring match for that
   marker, so it split the file at that spurious in-comment occurrence too, corrupting
   everything after it. The run is transactional: it failed cleanly with **zero tables created**
   (verified before touching anything further). Fixed by rephrasing the comment to no longer
   contain the literal marker string, then re-ran successfully.

`authUserId`'s FK to Supabase's own `auth.users(id)` table (documented inline in
`drizzle/schema.ts`'s column comment as needing to be added by hand, since Drizzle's schema DSL
only models the `public` schema) has **not** been added yet — small, safe, and now possible
since the database is live, but deliberately left for the RM-50..54 auth-wiring pass so it
lands alongside the code that actually populates that column, rather than as an isolated
constraint with nothing writing to it yet.

---

## 4. Tables created / modified

All 53 tables in `drizzle/schema.ts` were translated (created, in Postgres terms — this is a
fresh database, not an ALTER of an existing one). One table gained a new column this session:
`users.authUserId` (RM-50 foundation, §6). No tables were dropped, renamed, or had columns
removed — the full 1:1 structural translation is documented in `drizzle/schema.ts`'s top-of-file
comment, including the specific MySQL→Postgres type mapping used for every column.

Two structural gaps were identified and deliberately NOT auto-fixed (flagged instead, per the
"don't silently change business behavior" rule):
- `booking_slots` has no real unique constraint on `(consultationType, slotStartMs)` in either
  the old MySQL schema or the new Postgres one — `server/db/bookings.ts`'s duplicate-hold
  detection code (`23505` catch, formerly `ER_DUP_ENTRY`/1062) is consequently dead code in
  both versions. Pre-existing gap, not introduced by this migration.
- `leads.sourceId` is a polymorphic reference (points at different tables depending on
  `source`) and cannot be expressed as a real foreign key — left unconstrained, documented in
  the schema file.

---

## 5. RLS policies created

`drizzle/0004_rls_policies.sql` — all 53 tables have `ENABLE ROW LEVEL SECURITY` +
`FORCE ROW LEVEL SECURITY` + at least one policy; verified via a direct diff against the
table list in `drizzle/schema.ts` (53/53 match, no gaps, no duplicates). No policy uses
`USING (true)`.

**Helper functions** (SECURITY DEFINER, resolve `auth.uid()` → app identity without recursive
RLS lookups): `app_current_user_id()`, `app_current_role()`, `app_is_admin()`,
`app_current_organization_id()`, `app_current_developer_id()`.

**Policy pattern by domain:**
- **Client Portal** (`organizations`, `client_reports`, `client_recommendations`,
  `client_projects`, `client_invoices`, `client_documents`, `client_messages`,
  `client_notifications`, `client_support_tickets`, `organization_memberships`) — scoped to
  `organizationId = app_current_organization_id()`, admin full access. `client_project_milestones`
  (no `organizationId` column of its own) scoped via an `EXISTS` join through `client_projects`.
- **Developer Workspace** (`developer_profiles`, `developer_access_scopes`,
  `developer_agreements`, `developer_access_requests`, `developer_audit`,
  `developer_security_events`, `developer_support_tickets`, `developer_notifications`,
  `developer_messages`, `developer_task_assignments`, `developer_project_files`,
  `developer_submissions`) — scoped to `developerId = app_current_developer_id()`, admin full
  access. `developer_projects`/`developer_tasks` (no direct `developerId` column) scoped via
  `EXISTS` joins through `developer_project_assignments`.
- **Public-intake tables** (`bookings`, `leads`, `contact_submissions`, `dev_applications`,
  `ai_scans`, and their sub-tables) — admin-only through RLS. These are written by anonymous
  site visitors via the backend's privileged connection (not by an authenticated Supabase
  session), so anon/authenticated access is fully closed off; the backend itself is unaffected
  since it doesn't authenticate as `anon`/`authenticated`.
- **MFA** (`mfa_factors`, `mfa_recovery_codes`, `mfa_challenges`) — strictly self-only, **no
  admin bypass** — an admin should never be able to read another user's MFA secret via RLS.
- **Legal/compliance** (`legal_documents`, `agreement_versions`) — published/active rows
  readable by anyone (including logged-out visitors, for public ToS/Privacy pages); everything
  else admin-only. Acceptance/consent records (`agreement_acceptances`, `cookie_consents`,
  `legal_acknowledgements`) are self-insert/self-read, immutable (no UPDATE/DELETE policy for
  anyone).

**Why this matters even though the Express backend already does its own tenant scoping**:
Supabase auto-exposes every `public` table over PostgREST using the `anon`/`authenticated`
Postgres roles, driven by the publishable key — which is designed to be client-exposed. Without
RLS, anyone holding that key could query any table directly, bypassing the backend entirely.
This migration closes that off as defense-in-depth; it does not require rewriting the
backend's own privileged-connection queries (table owners bypass RLS by default).

**Live and verified** (§3): 53/53 tables RLS-enabled and forced, 102 policies, all 5 helper
functions present. The backend's own `postgres-js` connection (`server/db/connection.ts`) uses
the same `postgres` role that owns these tables (it ran the migrations), so it bypasses RLS by
design and needs no changes — only `anon`/`authenticated` PostgREST access is now restricted.

---

## 5a. RLS negative test suite (RM-60)

`server/rls.negative.test.ts` — 18 tests, run against the **live** Supabase project through the
real PostgREST API (the `anon`/`authenticated` Postgres roles), not the backend's own privileged
connection and not mocked. `beforeAll` creates real fixtures via the service-role client (2
organizations, 2 client users, 2 developer users, an admin user, a `client_reports` row, a
`client_invoices` row, a `leads` row, a `legal_documents` row with one published and one draft
`agreement_versions` row), then signs in as each test user through the actual Supabase Auth
client SDK — the same code path a real browser would use. `afterAll` deletes every fixture row
and every test Supabase Auth user; verified via direct query after each run (`users`/
`organizations` back to 0 rows both times).

What's proven, concretely:
- **Cross-tenant reads denied**: client B cannot see client A's org, `client_reports`,
  `client_invoices`, or the `organizations` row itself.
- **Cross-tenant writes denied**: client B's `UPDATE`/`DELETE` against client A's invoice/report
  affects 0 rows — reconfirmed unchanged via a direct SQL read afterward, not just trusting the
  API response.
- **Admin-only tables denied** to both client and developer roles (`leads`).
- **Unauthenticated (anon) denied** on every private table tested (`leads`, `client_reports`,
  `organizations`).
- **Developer-to-developer boundary denied**: developer Y cannot read developer X's
  `developer_profiles` row; developer X can read their own; a client (non-developer) can read
  neither.
- **MFA tables return empty, not an error** — `mfa_factors` queried cross-tenant returns `[]`
  rather than throwing, so the policy doesn't leak row existence through error behavior either.
- **The one deliberate anon-readable carve-out is real and narrowly scoped**: an anonymous
  request CAN read a `published` `agreement_versions` row and its parent `active`
  `legal_documents` row (public ToS/Privacy pages need this), but CANNOT read a `draft` version
  of the exact same document — proving the carve-out isn't accidentally `USING (true)`.

Skips cleanly (`describe.skipIf`) when `DATABASE_URL`/`SUPABASE_*` aren't configured, which is
the case in CI today — a live-infrastructure test suite has nothing to assert without real
credentials, so it skips rather than failing or hanging. One real bug was found and fixed while
building this: the first draft's `describe.skipIf` didn't actually prevent live Supabase clients
from being constructed, because `describe.skipIf` only skips the `it()`/`beforeAll()` callbacks
— the describe body itself still runs synchronously during test collection. Fixed by moving all
client/connection construction into `beforeAll`; both the skip path (env vars cleared) and the
live path (env vars present) were re-verified after the fix.

---

## 6. Auth migration details (RM-50..54)

**Wired into the live login flow and verified end-to-end — not just built and left disconnected.**

- `server/_core/supabaseAuthRoute.ts` (new) — `POST /api/auth/supabase/session`. Verifies a
  Supabase Auth access token (`verifySupabaseAccessToken`, §previous), resolves the caller to a
  `users` row (by `authUserId` if already linked, else by email match against a pre-existing
  Manus-era account, else creates a brand-new row via `createUserFromSupabase`), mints the
  **existing** `app_session_id` session cookie exactly the way `server/_core/oauth.ts`'s Manus
  callback does, and runs the identical post-login MFA gate. Because it produces the same cookie
  the rest of the app already understands, `context.ts`, every `*Procedure` in `trpc.ts`, MFA,
  and admin impersonation all work correctly for Supabase-authenticated sessions **with zero
  changes to any of them** — this was a deliberate "bridge" design over building a second,
  competing session-verification path, documented in the file's header comment.
- `server/db/users.ts`: `getUserByAuthUserId`, `linkAuthUserId`, `createUserFromSupabase`.
- `client/src/pages/Login.tsx`: the email/password form now tries
  `supabase.auth.signInWithPassword()` first; on failure (which is every existing account today,
  since none have been migrated — see RM-47) it falls through unchanged to the existing
  local-password endpoint. Real password reset via `supabase.auth.resetPasswordForEmail()` —
  previously "Forgot password" only wrote an entry to `localStorage` and showed a fake "sent"
  confirmation; no email was ever dispatched.
- `client/src/pages/ResetPassword.tsx` (new) + an `App.tsx` route — completes the reset flow
  (Supabase establishes a recovery session from the email link; the page collects a new password
  via `supabase.auth.updateUser()`).
- `client/src/_core/hooks/useAuth.ts`: logout also calls `supabase.auth.signOut()` (best-effort
  — the app's own session cookie, cleared separately, is what actually gates access).
- `drizzle/0005_auth_users_fk.sql`: `users.authUserId` FK to Supabase's own `auth.users(id)`,
  `ON DELETE SET NULL` — deferred from the original RLS migration specifically until there was
  real code populating the column; applied live and confirmed via `pg_constraint`.

**Live end-to-end verification performed** (not mocked, not just unit tests): created a real
Supabase Auth user via the admin API, signed in through the actual `@supabase/supabase-js`
client (the same SDK the browser uses), verified the resulting access token through
`verifySupabaseAccessToken()`, exercised the bridge's new-user-creation path (confirmed no
duplicate row on a second lookup), exercised the existing-Manus-account email-linking path
(created a legacy-shaped `users` row first, then signed in via Supabase with the same email —
confirmed it linked to the existing row and preserved its `role`, didn't create a duplicate),
and confirmed the `auth.users` foreign key genuinely rejects a fabricated, non-existent id. All
8 checks passed. Every test row and test Supabase Auth user was deleted afterward — confirmed
`select count(*) from users` = 0 post-cleanup.

**`server/_core/sdk.ts` (the Manus-OAuth session system) is completely untouched** and remains
the live path for every existing account — nothing about login/logout/session handling changed
for a current user in this session, per the explicit rule not to remove working auth before its
replacement is verified. This pass proves the replacement works; it does not cut over any real
accounts to it.

**Existing custom MFA system** (TOTP + SMS + recovery codes, `server/db/mfa.ts` +
`server/_core/mfaChallenge.ts`) required no re-keying work: it was already keyed on `users.id`,
not on `openId`, so it works unchanged for any user regardless of which auth path produced their
`ctx.user` — verified as part of the bridge's MFA-gate logic reusing the identical
`listVerifiedMfaFactorsForUser`/`signMfaPending` calls `oauth.ts` uses.

**Known scope limit, documented rather than silently decided**: session validity for the rest of
a session's lifetime is governed by the app's own `JWT_SECRET`-signed cookie, not continuously
re-checked against live Supabase session state — revoking a user in the Supabase dashboard does
not immediately invalidate an already-issued app cookie. Full continuous revalidation would need
a token-refresh mechanism this stateless-cookie model doesn't support today; that's a follow-up,
not something decided silently.

---

## 7. RBAC changes (RM-55)

**Verified, zero code changes required.** Every `*Procedure` middleware in `server/_core/trpc.ts`
(`clientProcedure`, `developerProcedure`, `developerSelfProcedure`, `adminProcedure`) checks only
`ctx.user.role`, `ctx.user.organizationId`, and `ctx.user.id` — never `openId` or anything else
Manus-specific. Since RM-50's bridge resolves `ctx.user` to a real `users` row regardless of auth
origin, RBAC was already correct for Supabase-authenticated sessions before this pass started;
what this pass adds is proof, not code: `server/rbac.authOrigin.test.ts` (21 tests) exercises
every procedure's rejection path with both a Manus-shaped `ctx.user` (real `openId`, no
`authUserId`) and a Supabase-shaped one (synthetic `supabase:<uuid>` openId, `authUserId` set),
asserting identical reject/accept behavior — proving role gating never branches on auth origin.
The existing role model (`user`/`client`/`developer`/`admin`) is unchanged.
`server/routers/solutions.ts`'s RBAC inconsistency (RM-56) was fixed in the prior session and
remains fixed; not touched again here.

---

## 7a. Route guards (RM-58/59)

Before this pass, `AdminLayout.tsx`, `ClientPortal.tsx`, and `DeveloperWorkspace.tsx` each
independently reimplemented the same conceptual guard: a role→home-portal redirect mapping and
an "is an admin impersonating this role" check, with `(user as any)` unsafe casts in two of the
three. New `client/src/_core/hooks/useRouteGuard.ts` centralizes the two pieces that were
genuinely identical across all three (`roleHome()`, mirroring the server's
`roleBasedDestination()`; `isImpersonatingTarget()`, properly typed) and all three portal shells
now import it. **Deliberately not unified**: each portal's choice of hard-redirect (Admin) vs.
in-place "access denied" card (Client/Developer) for a wrong-role visitor — that's a real,
pre-existing UX difference, not accidental duplication, and this environment still can't
visually QA a forced unification (same reasoning the prior session applied when deferring
RM-25/RM-26). Built on `useAuth()`/`trpc.auth.me`, which was already auth-source-agnostic per
RM-55 — not a throwaway guard tied to the old session system.

A real staleness bug was found and fixed while touching these files: `ClientPortal.tsx` and
`DeveloperWorkspace.tsx` both hardcoded `provider: "manus"` in their portal-access audit calls
regardless of how the user actually authenticated — harmless before RM-50 (everyone really was
Manus-authenticated), actively wrong after it. Now uses the user's real `loginMethod` via a new
`recordAttemptProvider()` helper.

6 new unit tests (`useRouteGuard.test.ts`) cover the three exported pure functions.
`vitest.config.ts` was extended to collect `client/src/**/*.test.ts` (previously server-only) —
scoped deliberately to DOM-free logic, since there's no jsdom/React Testing Library setup in
this project yet; that remains a separate decision. `npx vite build` was run to confirm the
client bundles cleanly with the refactored imports (not just `tsc`).

---

## 8. Manus dependencies — classification

Full detail researched via a dedicated codebase sweep this session. Summary:

**REMOVE** (safe outright deletions, pending confirmation nothing still builds through Manus's
hosted IDE): `vite-plugin-manus-runtime` dev-server plugin + `/__manus__/logs` debug collector
(`vite.config.ts`, `package.json`); the orphaned `"auth.continueWithManus"` i18n key (zero
consumers — no Manus login button exists in the current UI); the matching `/__manus__/`
staging-gate exemption line.

**REPLACE** (actively used, real external Manus/Forge API calls, need Supabase equivalents):
`server/storage.ts` + `server/_core/storageProxy.ts` (Forge presigned-URL storage → needs
Supabase Storage), `server/_core/sdk.ts` + `server/_core/types/manusTypes.ts` (Manus OAuth +
session verification — the actual auth backbone being replaced by §6 above),
`server/_core/oauth.ts` (Manus OAuth callback route), `server/_core/llm.ts` (Forge LLM gateway,
used by AI Scan scoring), `server/_core/notification.ts` (a genuine external call to Manus's
`WebDevService/SendNotification` — not just an internal name, despite how it reads), plus the
`provider: "manus"`/`"manus-oauth"` audit-log string literals scattered across
`routers.ts`/`viewAsRoute.ts`/`routers/clientPortal.ts`/client-side login code, and the
`"Managed by Manus OAuth"` UI copy in the client portal security pages (currently accurate,
will need updating once Supabase Auth is live).

**RETAIN TEMPORARILY** (waiting on the REPLACE items above, not independently blocking):
`server/_core/mfaChallenge.ts` (JWT payload shape coupled to the current session shape, not a
direct Manus API call); `users.openId` (the column every query joins on today — highest-risk
item in the whole codebase, must not be dropped until Supabase user IDs are wired and verified
end-to-end); a couple of admin-settings UI labels correctly describing the current (still-live)
Manus integration.

**RETAIN** (investigated and found to be either already Manus-independent or pure leftover
naming with zero real coupling): `server/_core/localAuthRoute.ts` (verified genuinely
decoupled — local JWT signing only, no OAuth HTTP calls, despite living in a
Manus-adjacent-sounding area of the codebase); `server/_core/stagingGate.ts`'s core mechanism
(its own HMAC cookie system); the `localStorage["manus-runtime-user-info"]` cache key (an
internal name, no external call); most i18n strings and several "fire-and-**forget**" comment
false-positives from the initial broad grep.

**Nothing was deleted this session** — the classification is a research deliverable for the
next implementation pass, consistent with "don't delete Manus code just because the name
appears — verify usage first."

---

## 9. Environment variables required

**Now fully configured** (in the local, gitignored `.env` — never committed, never echoed):
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `DATABASE_URL` (the connection
**pooler** URL — `postgresql://postgres.<ref>:[password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`
— not the direct-connection host, which is IPv6-only and unreachable from this environment;
see §3 for the full diagnosis).

**Documented, pre-existing, unchanged this session:** `JWT_SECRET`, `NODE_ENV`, `PORT`, and the
full set in `ENV_TEMPLATE.txt`.

`ENV_TEMPLATE.txt` was updated to stop describing `DATABASE_URL` as a MySQL/TiDB string, and
now documents the environment-separation convention for RM-61..63 (§1). No new environment
variables were introduced in the RM-50..60 work — the Supabase Auth bridge and RLS test suite
reuse exactly the six variables already listed above.

---

## 10. Tests / checks executed and results

| Check | Result |
|---|---|
| `pnpm install` | ✅ Clean (this session added `@supabase/supabase-js`+`postgres`, removed unused `mysql2`) |
| `npx tsc --noEmit` (`pnpm run check`) | ✅ **0 errors**, re-checked after every meaningful change |
| `npx vitest run` (`pnpm run test`) | ✅ **403/403 passing, 15 skipped** (up from 350 at the start of this session — 53 new tests: 5 `supabaseAuth`, 3 `auth.recordAttempt`, 21 `rbac.authOrigin`, 6 `useRouteGuard`, 18 `rls.negative`) |
| `npx vite build` | ✅ Client bundles cleanly with the route-guard refactor's new imports |
| `drizzle-kit generate` | ✅ Ran repeatedly through the session; final run reports "No schema changes, nothing to migrate" — confirms `drizzle/schema.ts` and the latest snapshot are in sync |
| `drizzle-kit migrate` against the live Supabase project | ✅ **All 6 migrations applied** (0000–0005). First attempt at 0000-0004 failed cleanly (transactional, 0 tables created) on a bug in `0002`'s own comment (see §3); fixed and re-ran successfully. 0005 (the `auth.users` FK) applied cleanly on the first attempt. Verified via direct SQL: 53 tables, 65 FKs, 126 indexes, 18 triggers, 53/53 RLS-enabled+forced, 102 policies, 6 functions, `auth.users` FK present |
| RLS negative test suite against the live database | ✅ 18/18 passing — see §5a for what's actually proven |
| Live Supabase Auth end-to-end verification | ✅ 8/8 checks passing — see §6 |
| Manus/TiDB/custom-auth dependency search | ✅ Done — full classification in §8 |
| Hardcoded-secret search | ✅ Clean — no `sb_secret_`/`sb_publishable_` literals in tracked files (only a fake placeholder in a test file), no secret values in any new/modified file |
| Full git-history secret scan | ✅ Pattern-grepped the **entire** `git log -p` for AWS keys, Supabase secret keys, OpenAI-style keys, PEM private key blocks, embedded-password Postgres URLs, and JWT headers — zero real matches (only documentation placeholders) |
| RLS policy review | ✅ Done — 53/53 tables, verified programmatically against the schema's table list, no `USING (true)`, and now also proven behaviorally by the live negative-test suite |
| Service-role-key client exposure check | ✅ Clean — `SUPABASE_SECRET_KEY` referenced nowhere under `client/`; only `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` are `VITE_`-prefixed among the Supabase vars |
| `.env`/secret-file gitignore verification | ✅ `git check-ignore -v .env` confirms coverage; `.gitignore` extended to cover every per-environment filename variant |
| Final diff review | ✅ `git status`/`git diff --stat` reviewed — every change traceable to a specific RM task, no unexpected/stray files, no destructive changes to files outside this session's scope |

**Two real regressions found and fixed during this work** (both pre-existing bugs from the
prior session's RM-12 fix, surfaced once `pnpm test` became runnable again): `getCookieSecretBytes()`
was reading a module-load-time-frozen `JWT_SECRET` snapshot instead of `process.env` fresh,
so tests that set it in `beforeAll()` never actually saw it; and 3 test files
(`bookingAdmin.test.ts`, `bookings.test.ts`, `viewAs.test.ts`) were never setting `JWT_SECRET`
at all. Both fixed; the new `supabaseAuth.ts` deliberately uses the same "read fresh, not
frozen" pattern from the start to avoid reintroducing the same bug class.

---

## 11. Remaining blockers

RM-41 through RM-60 are done. What's left:

1. **RM-57 — Super Admin role.** Genuine open decision, not a blocker this session can resolve
   in code — see §12.
2. **Externally blocked, unrelated to the database or auth work**: RM-01 (confirm GitHub org),
   RM-07..11 (secrets rotation — needs TiDB/Manus/AWS/deployment console access), RM-17 (branch
   protection — also a deliberate decision, since it would immediately block the direct-push
   workflow used to ship this session's work), RM-20 (CI-run verification — no `gh` CLI or
   authenticated GitHub API access available here to check whether `.github/workflows/ci.yml`
   actually ran on this session's pushes), RM-38 (cookie `SameSite`/`Secure` config — depends on
   an undecided hosting/reverse-proxy setup).
3. **Deliberately not attempted, per explicit instruction to only do so if safely testable**:
   RM-15 (centralizing `process.env` reads — a ~15-file mechanical refactor, lower priority than
   the security-critical work in this pass), RM-25/26/29/30 (UI/structural consolidations that
   need visual QA this environment still can't perform).
4. Supabase project-separation for staging vs. production (RM-61..63) depends on the client's
   Supabase account/billing decisions, not code.

---

## 12. Client decisions still required

1. **RM-57 — Super Admin role.** Investigated thoroughly; the repository has no super-admin
   tier anywhere (schema, enforcement code, or design intent beyond a comment reading "leave
   room for a future distinction"). Specific decisions needed: (a) new enum value vs. flag vs.
   other representation; (b) what a Super Admin can do that a regular Admin cannot — never
   defined anywhere in the codebase; (c) who gets it — single hardcoded owner (extending the
   existing `OWNER_OPEN_ID` pattern) vs. an assignable role. See `PHASE1_CHECKLIST.md`
   Workstream 2.11 for the full evidence trail. **Nothing was invented in place of this
   decision**, per explicit instruction.
2. Whether staging and production should be separate Supabase projects or one project with
   logical separation (RM-61..63) — an account/billing decision, not a code one.
3. Whether Manus OAuth (Google/Microsoft/Apple sign-in currently routed through Manus's
   gateway, per §8's REPLACE list) should be preserved as a login option once Supabase Auth is
   live, or dropped — the login bridge itself (§6) is provider-agnostic and doesn't force this
   decision either way, but real OAuth-via-Supabase would need providers configured in the
   Supabase dashboard (external setup this session can't do or verify).
4. Whether/when to actually migrate real user accounts onto Supabase Auth and retire the Manus
   OAuth path — this session proves the replacement works end-to-end; it deliberately does not
   cut over any real accounts, per the explicit rule not to remove working auth before its
   replacement is verified. That cutover is a separate decision with its own rollout plan.
5. Enable branch protection on `main` (RM-17) once ready to move off the direct-push workflow
   this session used.

---

## 13. Follow-up pass: RM-04 resolution + re-investigation of deferred hygiene tasks

**RM-04 fully resolved.** The 13th dead-code file left in place last pass (`server/routers/audit.ts`,
then classified "orphaned not dead, needs a product decision") was traced to a conclusive answer:
`audit.listLogins`/`audit.listLeads` have zero client-side consumers anywhere in `client/src`
(grep for `trpc.audit.` returns nothing), and both are already duplicated — with strictly more
functionality — by `admin.ts`'s own `recentLoginAudit` (same `loginAudit` table query, plus it
records its own admin-audit-event via `recordAdminEvent`, which `audit.listLogins` never did) and
`crm` (same `leads` table, richer shape) endpoints, which the Executive Overview page actually
uses. No other file references `auditRouter` beyond its own definition and mount point. Removed
`server/routers/audit.ts`, its import and mount in `routers.ts` — no live route or product
behavior changed, since nothing reachable through the real UI called it.

**RM-03, RM-15, RM-25, RM-26, RM-29 re-investigated with concrete file-level evidence** (not
just re-stated as size/priority estimates) — all confirmed to correctly stay deferred:
- **RM-03**: git history is uninformative (repo squashed to one `Init` commit; every ambiguous
  script shows exactly one history entry) and every file shares an identical bulk-export
  timestamp — neither gives real supersession evidence. Tracing actual file I/O shows
  `pt_missing.mjs` → `pt_split.mjs` → (external translation step) → `pt_rebuild.mjs` is a real
  sequential pipeline, not competing duplicates, with `pt_dump.mjs` a separate diagnostic tool;
  two of the four are currently non-functional because their input JSON files were deleted as
  generated artifacts in RM-02, but they're regenerable, not dead. The `mixed_*`/`identical_audit`
  scripts are self-contained but `mixed_final.mts` audits only 6 locales vs. the other three's 9
  — "final" is narrower in scope, not a strict improvement, so naming can't establish a safe
  deletion order.
- **RM-15**: full inventory of all 9 files/every direct `process.env.X` read outside `env.ts`.
  The safe-to-centralize subset is empty once excluding secrets that must stay fresh-read for
  test-correctness (confirmed `STAGING_MODE`, not just `JWT_SECRET`-family values, is toggled in
  `stagingGate.test.ts`'s `beforeEach()` — centralizing it would reproduce the exact staleness
  bug class already fixed) and values with real behavior-change risk (`NODE_ENV` is compared
  against different literals in different files) or negligible single-call-site value (`PORT`).
- **RM-25/RM-26**: full side-by-side reads of all `StatusPill`/state-boundary implementations
  confirm they're genuinely divergent (different prop APIs, a dot indicator present in only one
  of three `StatusPill`s, different border-radius, different colors for matching semantic names;
  `ModuleStateBoundary` auto-detects permission-denied from error shape while `SectionStateSwitch`
  requires an explicit caller-supplied boolean) — not just differently styled, real visual/API
  risk confirmed with evidence rather than assumed.
- **RM-29**: `admin.ts` is 1,104 lines, ~16 helper functions feeding ~25 procedures, all sharing
  `getDb()`/`safe()`/`recordAdminEvent()`. A safe split must preserve the flat `admin.*`
  client-facing namespace and not silently drop an audit-log call while moving code across ~5 new
  files — real risk for a change with zero functional benefit. Confirmed as the "large structural
  rewrite" the task says to defer, not a mechanical extraction.

---

## 14. Follow-up pass: security sweep + re-verification

**Real fix**: `server/_core/booking/index.ts`'s `randomToken()` — used for the native booking
system's slot **hold token** (a capability token gating who can claim/confirm a held slot, not
just a display label) — had a `Math.random()` fallback for environments lacking
`globalThis.crypto`. Removed in favor of Node's `crypto.randomBytes` directly (guaranteed
available in this app's only runtime), and fixed a real entropy-truncation bug found in the same
function: hex-encoding N bytes then slicing to N characters only used half the intended entropy
(2 hex characters per byte) — now requests `ceil(len/2)` bytes so every output character is
backed by real randomness. Verified `holdToken` is treated as an opaque string everywhere
(compared via `===`, no character-set-specific validation) before changing its output alphabet.

**Real fix, same bug class as the prior pass's `ClientPortal.tsx`/`DeveloperWorkspace.tsx` catch**:
5 more hardcoded `provider: "manus"`/`"manus-oauth"` audit-log literals found via a full
`grep -rn 'provider: "manus'` sweep — `viewAsRoute.ts`'s View-As impersonation enter/exit audit
rows, and `clientPortal.ts`'s profile-update/MFA-method-change/session-revoke audit rows. All were
correct when every admin/client was necessarily Manus-authenticated; wrong now that an admin or
client can authenticate via the Supabase bridge (RM-50) or local-password login and still reach
these code paths (RBAC being auth-agnostic means they genuinely can). Fixed to use the account's
actual `loginMethod`. The one remaining `provider: "manus"` literal (`oauth.ts:109`) was verified
correct — it's the real Manus OAuth callback, genuinely always "manus". Distinguished from a
separate, pre-existing, intentional convention: `clientPortal.ts`'s `provider: "client-portal"`
literals (8 sites) tag the *application surface* that generated an in-portal action audit event,
not an auth provider — correctly left untouched, not the same bug.

**Verified, not a bug**: the Supabase-bridge email-linking path (`supabaseAuthRoute.ts`) calls
`getUserByEmailWithPassword()`, whose name and doc comment suggest it filters to accounts that
have a local password set — read its actual implementation directly and confirmed the real SQL
query is a plain `WHERE email = ?` with no such filter, so the linking path correctly matches
OAuth-origin (no-password) Manus-era accounts by email too. Left a comment at the call site
explaining this reliance, since a future "fix" to make that function match its name would
silently break linking for exactly that account type.

**RLS re-verified against real application behavior, not re-authored**: read all 5 EXISTS-based
(multi-hop join) policies in `0004_rls_policies.sql` side-by-side against the actual DB-layer
query functions they're meant to mirror. Confirmed, for example, that `developer_tasks`'s policy
(visible to any developer assigned to the *project*) exactly matches `listDeveloperTasks()`'s
real filtering (project-level assignment grants visibility to every task in that project;
`developer_task_assignments` only drives a "mine" UI badge, not a stricter visibility rule) — no
gap found; the original design was already correct. Re-confirmed 53/53 tables covered, zero
`USING (true)` policies, and re-ran the live 18-test negative suite after all other changes in
this pass — still 18/18 passing, database confirmed empty in every touched table afterward.

**Other items checked and found already clean, no changes needed**: no hardcoded fallback
secrets remain; no raw `x-forwarded-for`/`remoteAddress` parsing outside the shared
`requestMeta.ts` helper; no PII (email addresses) written to `console.log`/`console.warn`; no
remaining MySQL-specific write-path code (`onDuplicateKeyUpdate`/`insertId`/`affectedRows`/errno
1062 — only explanatory comments referencing the old codes); `SUPABASE_SECRET_KEY` referenced
nowhere under `client/`; `organizationId` is consistently left null-by-default across all three
account-creation paths (Manus OAuth, local-password, Supabase bridge) — no inconsistency found;
logout is unified through one tRPC mutation that clears the session cookie regardless of auth
origin, with the Supabase sign-out call added alongside it. One minor, low-priority, **not**
fixed item noted for completeness: `server/routers/developer.ts`'s `makePublicRef()` duplicates
the intent (not the exact algorithm) of the shared `server/_core/publicRef.ts` generator for
support-ticket reference codes — left alone because consolidating would visibly change the
ticket-ID format shown to submitters (`ENG-XXXXXXXX` → `IOSKY-ENG-XXXX-XXXX`) without explicit
sign-off, and it is not security-sensitive (a display reference, not an access token).

**Verification for this follow-up pass**: `npx tsc --noEmit`: 0 errors after every change.
`npx vitest run`: 403/403 passing throughout (no test count change — this pass fixed bugs and
removed dead code, it didn't add new test files). `npx vite build`: succeeds. Live RLS suite
re-run: 18/18 passing. Database confirmed clean (0 rows in every previously-test-touched table)
both before and after this pass's changes.

---

## 15. Independent re-verification pass (2026-08-12) — no code changes, tree confirmed unchanged

A fresh session picked this milestone back up from a clean working tree (`git status` clean,
`HEAD` at `8337bdb`, matching exactly what §13/§14 documented) with instructions to continue
Phase 1. **Conclusion: everything safely actionable through code was already done in the prior
pass.** This pass's job was to independently re-verify that claim rather than take it on faith,
and to re-run the security/auth/RLS sweep against the actual current tree in case anything had
drifted. Nothing had. No files were changed this session.

**Environment note, worth recording**: this session's shell had no `node`/`npm`/`pnpm` on `PATH`
at all (a different machine/session state than whatever produced §10's live results) and no local
`.env` file — meaning zero Supabase credentials were available. A bundled Node 22 distribution was
located under the local qwen-code tool install and used to run `corepack prepare pnpm@10.4.1
--activate` (matching `package.json`'s pinned `packageManager`), then `pnpm install
--frozen-lockfile`. This got a fully working toolchain without touching the pinned dependency
versions. **No `.env` was available or created**, so the live-Supabase-only tests (the 18
`rls.negative.test.ts` tests) correctly skipped via their existing `describe.skipIf` guard rather
than failing — this is the suite behaving exactly as designed for a credential-less environment,
not a regression. Live Supabase re-verification (RLS suite, auth end-to-end check) was **not**
re-run this session for that reason; §5a/§6's prior live results stand as the last live evidence
and have not been contradicted by anything found this session.

**Baseline re-confirmed independently, from a clean install**:

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ Clean, no lockfile drift |
| `npx tsc --noEmit` | ✅ **0 errors** |
| `npx vitest run` | ✅ **385/418 passing, 33 skipped** (18 more skipped than §10's 403/15 — exactly the live RLS suite, correctly skipping with no `.env` present; the other 385 non-live tests all pass, no regressions) |
| `npx vite build` | ✅ Succeeds (pre-existing chunk-size warnings only, not errors) |

**RM-04 re-confirmed**: `server/routers/audit.ts` does not exist on disk; `routers.ts` has no
`audit` import, mount, or reference anywhere in the codebase (`grep -rn "auditRouter"` returns
nothing). §13's removal is final and stable.

**RM-03/RM-15/RM-25/RM-26/RM-29/RM-30 evidence spot-checked against the live tree, not re-derived
from memory**: `admin.ts` is still exactly 1,104 lines; the same 9 files still contain the only
direct `process.env.X` reads outside `env.ts`; all `StatusPill`-named components in §13's list
still exist unmerged; nothing about any of this has changed since §13's investigation, so its
conclusions (stay deferred, with evidence) still hold without re-running the full investigation.

**Fresh security/correctness sweep, targeted grep-based, found nothing new**:
`Math.random()` call sites re-enumerated — the two real security-sensitive ones already fixed
(`solutions.ts`'s discovery-session token, `booking/index.ts`'s hold-token generator) remain fixed;
every other site (`developer.ts`'s support-ticket ref suffix, `publicRef.ts`'s reference-code
generator, `sidebar.tsx`'s skeleton-width jitter, `useCookieConsent.tsx`'s consent-record id,
`Solutions.tsx`'s anonymous analytics-funnel session id in `localStorage`) is a non-authenticating
label/analytics value, not a capability token — confirmed by reading each call site's actual use,
not just the function name. No hardcoded fallback secrets found (only comments describing the
fail-fast pattern). No remaining MySQL-specific write-path code — the only `insertId`/`1062`-shaped
hits are the two explanatory comments in `bookings.ts`/`users.ts` already noted in §14. `provider:
"manus"` now appears exactly once in the whole server tree (`oauth.ts:109`, the genuine Manus OAuth
callback) — the 7 staleness bugs from §14 stay fixed. `x-forwarded-for` parsing exists only inside
`requestMeta.ts`. No `SUPABASE_SECRET_KEY`/service-role reference anywhere under `client/`. RLS
migration file re-counted directly: 53 `ENABLE ROW LEVEL SECURITY` + 53 `FORCE ROW LEVEL SECURITY`
statements (an initial grep hit 54 for the FORCE count because of a doc-comment false match — the
real statement count is 53/53, matching `schema.ts`'s 53 `pgTable` definitions exactly, no gap).

**Auth-consistency spot check**: re-read `server/db/users.ts`'s `createUserFromSupabase` — Supabase-
native users get a synthetic `openId` of the form `` `supabase:${authUserId}` `` (satisfies the
column's pre-existing `NOT NULL UNIQUE` constraint) but authorization never keys off it (RM-55's
21-test suite already proves every `*Procedure` gate checks only `role`/`organizationId`/`id`); the
few remaining `ctx.user.openId` reads (`bookingAdmin.ts`'s audit-log actor label,
`mfa.ts`'s TOTP-issuer display-name fallback when no email is set) are display/labeling uses, not
access-control decisions — re-confirmed by reading each call site, not assumed from the RM-55
report. Re-read `supabaseAuthRoute.ts` in full: its design (mint the same `app_session_id` cookie
Manus's callback mints, reuse the same MFA gate, leave `sdk.ts`/`oauth.ts`/`localAuthRoute.ts`
completely untouched) matches exactly what §6 describes — no drift.

**Net result of this pass: zero RM statuses changed.** Every task that could be safely completed
through code was already completed in the prior pass; this pass's contribution is independent
confirmation (fresh install, fresh toolchain resolution, fresh grep sweep, fresh manual reads of
the auth bridge and RLS coverage) that nothing has regressed and nothing new was missed — not a
rubber stamp, but a genuine second look that happened to agree with the first. The Phase 1 count
stays **43 done / 5 partial / 10 blocked / 5 deferred, out of 63** (see `PHASE1_CHECKLIST.md`'s
summary, also updated with this pass's date). RM-57 (Super Admin) and the externally-blocked items
in §11/§12 remain the only things standing between this milestone and 100%, and none of them are
resolvable without client input or infrastructure access this environment doesn't have.
