# IO SKY — Milestone 1 Supabase Migration Report

Scope: continuation of Milestone 1 following the RM-49 decision (**Path A — Supabase Auth as
the primary authentication system**: Supabase Auth = source of truth for auth/sessions,
Supabase Postgres = application database, Supabase RLS = tenant/security boundary). Covers
RM-41 through RM-63. Cross-reference: `PHASE1_CHECKLIST.md` (full RM-01..63 tracking, both
sessions) and `CONTRIBUTING.md` (branching/commit convention).

**Headline: Milestone 1 is NOT complete.** The database schema, its constraints, its RLS
policies, and the write-path code are fully authored and internally verified (typecheck +
test suite), but none of it has been applied to the live Supabase project, and the auth/RBAC/
route-guard/RLS-test layers that depend on a live database are correspondingly unbuilt or
partial. The single blocker behind nearly everything unfinished here is the same one:
**the Supabase Postgres `DATABASE_URL` (the database password) was never provided** — only
the Auth/REST API keys were.

---

## 1. RM-41 through RM-63 status

| RM | Task | Status |
|---|---|---|
| RM-41 | Provision Supabase project | ✅ Done — project `rhgzcgcqlypuvislwjlf` |
| RM-42 | Record connection strings | 🔶 Partial — API keys recorded in `.env`; Postgres `DATABASE_URL` still missing |
| RM-43 | Schema translation (MySQL → Postgres) | ✅ Done — 53/53 tables, `drizzle/schema.ts` |
| RM-44 | Foreign keys | ✅ Done — ~65 relationships, explicit ON DELETE policy per table |
| RM-45 | Indexes | ✅ Done — one per FK column + status-column indexes |
| RM-46 | Rewrite MySQL-specific write-path code | ✅ Done — 0 remaining `insertId`/`affectedRows`/`onDuplicateKeyUpdate`/1062 patterns |
| RM-47 | Data migration | ✅ Done — confirmed no production data exists; nothing to migrate |
| RM-48 | RLS policies | ✅ Authored & internally verified (53/53 tables) — **not yet applied to a live DB** |
| RM-49 | Client decision: Path A vs Path B | ✅ Resolved — Path A |
| RM-50..54 | Login/OAuth/MFA/password-reset migration | 🔶 Foundation built (Supabase clients + JWT verification, unit-tested) — live wiring blocked on `DATABASE_URL` |
| RM-55 | RBAC rebuild on Supabase session | ⏭ Blocked on RM-50..54 completing |
| RM-56 | Fix `solutions.ts` `adminList*` inconsistency | ✅ Done (prior session) |
| RM-57 | Super Admin role decision | ⛔ **STOP — investigated, insufficient repo information, flagged for client** (§12) |
| RM-58/59 | Route guards on Supabase session model | ⏭ Blocked on RM-50..55 |
| RM-60 | RLS negative test suite | ⏭ Blocked on RM-48 being live (needs a real DB to test against) |
| RM-61..63 | Environment separation | 🔶 Partial — `.gitignore`/docs done; Supabase project-separation is a client account decision |

RM-01..40 (repository cleanup through bug fixes) were completed in the prior session — see
`PHASE1_CHECKLIST.md` Workstreams 2.1–2.7 for that detail; unchanged by this session.

---

## 2. Exact files changed this session

**New files:**
- `drizzle/0000_slim_santa_claus.sql` — baseline Postgres schema (53 tables, ~47 enums)
- `drizzle/0001_futuristic_nekra.sql` — foreign keys + indexes
- `drizzle/0002_updated_at_triggers.sql` — hand-written `set_updated_at()` trigger (Postgres replacement for MySQL's `.onUpdateNow()`), applied to the 18 tables with an `updatedAt` column
- `drizzle/0003_add_auth_user_id.sql` — `users.authUserId` (uuid, links to Supabase `auth.users.id`)
- `drizzle/0004_rls_policies.sql` — RLS helper functions + policies for all 53 tables
- `drizzle/meta/0000_snapshot.json` .. `0004_snapshot.json` (+ updated `_journal.json`)
- `drizzle/_archive_mysql_migrations/` — the 13 original MySQL migrations, preserved for history (prior session)
- `server/_core/supabaseAuth.ts` — Supabase admin client + `verifySupabaseAccessToken()`
- `server/supabaseAuth.test.ts` — 5 unit tests for the above
- `client/src/lib/supabase.ts` — Supabase browser client (publishable key only)

**Modified files:**
- `drizzle/schema.ts` — full MySQL→Postgres rewrite (53 tables) + FKs/indexes + `authUserId`
- `drizzle.config.ts` — `dialect: "postgresql"`, `dbCredentials.url` from `DATABASE_URL`
- `server/db/connection.ts` — `drizzle-orm/postgres-js` + `postgres` (was `drizzle-orm/mysql2`)
- `server/db/{aiScans,bookings,clientPortal,crm,developerWorkspace,mfa,solutions,users}.ts` — MySQL write-path rewrite (RM-46)
- `server/_core/env.ts` — added `supabaseUrl`/`supabasePublishableKey`/`supabaseSecretKey`/`supabaseJwksUrl`
- `server/{bookingAdmin,bookings,viewAs}.test.ts` — `JWT_SECRET` test-setup fix (see §10)
- `package.json` / `pnpm-lock.yaml` — added `@supabase/supabase-js`, `postgres`; removed unused `mysql2`
- `ENV_TEMPLATE.txt` — Supabase section, corrected stale MySQL/TiDB `DATABASE_URL` comment, environment-separation note
- `.gitignore` — added `.env.development`, `.env.staging(.local)`, `.env.production` variants
- `PHASE1_CHECKLIST.md` — full status update across every workstream touched this session

No files were deleted this session (the MySQL migration archive move happened in the prior
session and is preserved intact — 13 `.sql` files + 14 meta files confirmed present).

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

**Not yet applied to the live database.** Applying requires `DATABASE_URL` and, for 0004
specifically, running as (or granting) a role with permission to create policies — a normal
Supabase project owner/service connection has this by default.

`0004` additionally requires the `authUserId` FK to Supabase's own `auth.users(id)` table to
be added by hand once live (Drizzle's schema DSL only models the `public` schema) —
documented inline in `drizzle/schema.ts`'s `authUserId` column comment; not yet added as SQL
anywhere since it can't be tested without a live `auth` schema to reference.

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

**Not yet done:** applying this to the live database, and therefore RM-60 (the negative
cross-tenant test suite this policy set is supposed to defend) — both blocked on `DATABASE_URL`.

---

## 6. Auth migration details

**Built and unit-tested (5 passing tests, `server/supabaseAuth.test.ts`):**
- `server/_core/supabaseAuth.ts` — `getSupabaseAdmin()` (service-role client) and
  `verifySupabaseAccessToken()` (verifies a Supabase Auth JWT against `SUPABASE_JWKS_URL` — no
  DB round-trip needed, so this piece is genuinely testable without a live Postgres connection).
  Reads `process.env` fresh at call time (not a frozen snapshot), matching the pattern fixed in
  `env.ts` (§10) — avoids reintroducing the same staleness bug in new code.
- `client/src/lib/supabase.ts` — browser client using only the publishable key (safe to expose
  by design; access control is enforced by RLS, not key secrecy).

**Deliberately NOT done yet, and why:** wiring this into `server/_core/context.ts` (so a
Supabase session becomes `ctx.user` for tRPC procedures), building the actual Supabase
login/signup/OAuth routes, linking `users.authUserId` on first Supabase login, and re-keying
MFA/password-reset to the new identity. All of this reads and writes the live `users` table —
attempting it without a working `DATABASE_URL` to test against would mean shipping unverified
auth code, which the explicit working rule for this migration prohibits ("do not delete old
auth implementation until replacement is actually wired and verified"). `server/_core/sdk.ts`
(the current Manus-OAuth session system) is completely untouched and remains the live,
working auth path — nothing about login/logout/session handling changed for end users this
session.

**Existing custom MFA system** (TOTP + SMS + recovery codes, `server/db/mfa.ts` +
`server/_core/mfaChallenge.ts`) is preserved as-is. Per the RM-49 resolution's "preserve
existing... rebuild enforcement around Supabase identity" language, the plan is to re-key it to
`users.id` via the new `authUserId` link rather than replace it with Supabase's own built-in
MFA feature — it's already built, tested, and race-condition-hardened (see prior session's
RM-33 fix). This re-keying is part of the still-blocked RM-50..54 wiring work.

---

## 7. RBAC changes

No RBAC changes this session — RM-55 is blocked on RM-50..54 completing (RBAC needs a live
Supabase session to attach role checks to). The existing role model
(`user`/`client`/`developer`/`admin`, `usersRoleEnum` in `drizzle/schema.ts`) is preserved
unchanged in the new schema. `server/routers/solutions.ts`'s RBAC inconsistency (RM-56) was
fixed in the prior session and remains fixed; not touched again here.

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

**Already configured** (in the local, gitignored `.env` — never committed, never echoed):
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

**Still required from the client — this is the primary blocker:**
- `DATABASE_URL` — the Supabase project's direct Postgres connection string, **with the
  database password** (Project Settings → Database → Connection string). This is a different
  credential from the four API keys above; none of them substitute for it.

**Documented but unrelated to this session's blocker** (pre-existing, unchanged):
`JWT_SECRET`, `NODE_ENV`, `PORT`, and the full set in `ENV_TEMPLATE.txt`.

`ENV_TEMPLATE.txt` was updated to stop describing `DATABASE_URL` as a MySQL/TiDB string, and
now documents the environment-separation convention for RM-61..63 (§1).

---

## 10. Tests / checks executed and results

| Check | Result |
|---|---|
| `pnpm install` | ✅ Clean (this session added `@supabase/supabase-js`+`postgres`, removed unused `mysql2`) |
| `npx tsc --noEmit` (`pnpm run check`) | ✅ **0 errors** |
| `npx vitest run` (`pnpm run test`) | ✅ **355/355 passing, 15 skipped** (up from 350 — 5 new tests for `supabaseAuth.ts`) |
| `drizzle-kit generate` | ✅ Ran repeatedly through the session; final run reports "No schema changes, nothing to migrate" — confirms `drizzle/schema.ts` and the 0004 snapshot are in sync |
| Manus/TiDB/custom-auth dependency search | ✅ Done — full classification in §8 |
| Hardcoded-secret search | ✅ Clean — no `sb_secret_`/`sb_publishable_` literals in tracked files, no secret values in any new/modified file |
| RLS policy review | ✅ Done — 53/53 tables, verified programmatically against the schema's table list, no `USING (true)` |
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

1. **`DATABASE_URL` (Supabase Postgres connection string + password) — the central blocker.**
   Without it: no migration can be applied to the live database; RLS policies can't be
   activated; the Supabase Auth foundation can't be wired into the real login flow (needs to
   read/write `users.authUserId`); RM-55 (RBAC), RM-58/59 (route guards), and RM-60 (RLS
   negative tests) all cascade from this.
2. Everything already listed as externally blocked in the prior session
   (`PHASE1_CHECKLIST.md` §"Blocked on external provider/account access") — secrets rotation,
   GitHub org/branch-protection settings, etc. — unchanged by this session.
3. Supabase project-separation for staging vs. production (RM-61..63) depends on the client's
   Supabase account/billing decisions, not code.

---

## 12. Client decisions still required

1. **Provide `DATABASE_URL`** (§9, §11) — unblocks the largest remaining chunk of work.
2. **RM-57 — Super Admin role.** Investigated thoroughly; the repository has no super-admin
   tier anywhere (schema, enforcement code, or design intent beyond a comment reading "leave
   room for a future distinction"). Specific decisions needed: (a) new enum value vs. flag vs.
   other representation; (b) what a Super Admin can do that a regular Admin cannot — never
   defined anywhere in the codebase; (c) who gets it — single hardcoded owner (extending the
   existing `OWNER_OPEN_ID` pattern) vs. an assignable role. See `PHASE1_CHECKLIST.md`
   Workstream 2.11 for the full evidence trail. **Nothing was invented in place of this
   decision**, per explicit instruction.
3. Whether staging and production should be separate Supabase projects or one project with
   logical separation (RM-61..63) — an account/billing decision, not a code one.
4. Whether Manus OAuth (Google/Microsoft/Apple sign-in currently routed through Manus's
   gateway, per §8's REPLACE list) should be preserved as a login option once Supabase Auth is
   live, or dropped — affects the scope of the RM-50..54 wiring work once `DATABASE_URL`
   unblocks it.
