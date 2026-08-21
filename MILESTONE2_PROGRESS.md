# Milestone 2 — Progress Tracker

Live tracking document, same convention as `PHASE1_CHECKLIST.md`. Source of truth for scope:
`Milestone 2.md`. Sequenced per that document's own dependency order (architecture/DB foundation →
storage → security/RLS → Manus removal → email → workflows → reports/projects → RBAC/Super Admin →
Technical Operator → Security/Audit Center → BI → AI governance → document lifecycle → workflow
engine → integrations → platform ops → notifications → testing → Manus-removal verification → exit
gate). Each workstream gets a status row using the same legend as Milestone 1:

Legend: ✅ Done + locally verified · 🔶 Partial · ⛔ Blocked (external access/decision required) · ⏭ Not started

---

## Handoff summary (as of 2026-08-21, end of latest session)

**Overall: 5 of 7 Milestone 2 workstreams touched (§2.1–2.5), 2 not started (§2.6–2.7). Exit gate NOT passed.**

| Workstream | Status |
|---|---|
| M1 prerequisite (RM-57, Super Admin) | ✅ Code done + locally verified · ⛔ still not applied to any live DB (see below — the previously-connected project is gone) |
| 2.1 Storage Migration | ✅ Done + verified · ⛔ branding assets + live DB application blocked |
| 2.2 Manus Dependency Removal | ✅ Done + verified · ⛔ LLM/owner-alert production activation blocked |
| 2.3 Email Productionisation | ✅ Delivery tracking done · ⛔ Resend domain + Supabase Auth email routing blocked |
| 2.4 Core Workflow Verification & Conversion | ✅ Done this session — every previously-undisclosed fabricated panel on Executive Overview now wired to real data or disclosed; the underlying admin.summary fabrication bug fixed too |
| 2.5 Enterprise Super Admin & Platform Governance | 🔶 Partial — Organization Management, Technical Operator role + Security Center, Business Intelligence dashboards, platform configuration store, and MFA compliance visibility done and tested; AI governance config, real integration/notification-template management, and a hard blocking MFA gate NOT started (the last one deliberately deferred — see detail below) |
| 2.6 Document Lifecycle / Workflow Engine / Integrations | ⏭ Not started |
| 2.7 Notification Infrastructure | ⏭ Not started |

**This session's central finding — the connected Supabase project is gone.** The `.env` credentials from the session that did RM-41..60 (a different session than the one that wrote §2.1–2.4 above, which had no credentials at all) no longer work: `rhgzcgcqlypuvislwjlf.supabase.co` returns `NXDOMAIN` — the project's own subdomain doesn't resolve in DNS at all, not a transient outage. Confirmed via direct `nslookup`, a raw Postgres connection attempt (pooler responds "tenant/user not found"), and a plain `fetch` to the Auth health endpoint (connection refused). This means **migrations `0006` through `0009` are still authored-and-locally-verified only, same as before** — nothing in this session or the previous one has actually reached a live database. A real test-suite bug this surfaced and fixed: `server/rls.negative.test.ts`'s skip condition only checked that env vars were *present*, not that the project was *reachable*, so it hard-failed the whole suite instead of skipping cleanly — now does a real reachability probe first.

**Verification baseline this session** (re-established from scratch per the standing rule to verify, not trust, the doc): `npx tsc --noEmit` → 0 errors (after running `pnpm install` to sync `node_modules` — `svix` was declared in `package.json`/lockfile but not actually installed, a real gap the previous session's own verification missed) · `npx vitest run` → 441/441 passing, 33 correctly skipped, 0 regressions · `pnpm run build` → succeeds.

**What this session actually did, beyond re-verifying**:
1. Fixed the RLS-suite skip-condition bug above.
2. **§2.4 completion**: `ExecutiveOverview.tsx` had ~9 panels rendering fabricated numbers with zero disclosure (same severity class as the already-fixed Billing chart) — each wired to real data where a real source existed (Revenue Intelligence's headline + a genuinely new day-by-day real revenue chart; Recent Activity, which the backend already computed but the UI never bound) or given the established `sampleData` disclosure badge where no real backing exists. Found and fixed the same underlying bug in `admin.summary`'s `buildSummary()` that fed the KPI strip itself: every KPI silently substituted a fabricated positive number whenever the real count was 0, plus several hardcoded-constant "deltas" and an entirely invented `systemHealthPct`. See §2.4 detail below.
3. **§2.5 first deliverable**: Organization Management + role/tenant assignment, built on the existing (previously unused) `superAdminProcedure`. Before this, there was no way anywhere in the app to create an organization or link a user to one. New `admin.createOrganization`/`updateOrganization`/`listOrganizations`/`setUserRole`/`assignUserOrganization` endpoints (super_admin-exclusive except the read), a matching RLS policy tightening (`organizations` writes: admin → super_admin only, matching RM-57's own decision record), and a real UI (Users & Permissions page: role/org actions per user, an Organizations panel with real member counts and creation). 17 new tests.
4. Found and fixed a real migration-tooling bug while touching the migration chain: the `0008` snapshot had a stray `isRLSEnabled: true` flag on `email_delivery_log` (schema.ts doesn't declare it, no other table has this flag) that made `drizzle-kit generate` start auto-proposing a migration to *disable* RLS on that table. Fixed before it could ever be applied.

**Still uncommitted work from before this session**: none — everything through the previous session's §2.1-2.4 work was already committed (`477c962`, `7cb3bc6`) before this session started. This session's own work is committed incrementally, one logical change per commit, all pushed.

**Continuation pass (same day, 2026-08-21)**: per an explicit "complete all remaining features" instruction, continued straight into §2.5's remainder. Landed Technical Operator role + Security Center and Business Intelligence dashboards (both detailed above, both committed/pushed separately). Continuing through the rest of §2.5, then §2.6, then §2.7, then the admin.action dead-button sweep, updating this file after each workstream.

---

## Prerequisite: Milestone 1 dependency audit (2026-08-15)

Full audit performed cross-referencing `PHASE1_CHECKLIST.md`'s 20 non-✅ RM items against every
Milestone 2 workstream. **Conclusion: Milestone 1's foundation (Supabase Postgres, RLS pattern,
Supabase Auth bridge, RBAC gates, route guards) is sufficient to start Milestone 2.** Exactly one
genuine blocker was found: **RM-57 (Super Admin role)**, required by §2.5. Resolved by client
decision and implemented same session — see `PHASE1_CHECKLIST.md` Workstream 2.11 and
`MILESTONE1_SUPABASE_MIGRATION_REPORT.md` §16 for full detail. Every other incomplete RM item
(secrets rotation, branch protection, CI verification, cookie config, env separation, deferred UI
consolidations) was confirmed to have no code-level coupling to any Milestone 2 workstream and was
left untouched, per the explicit instruction to complete only Milestone 1 work that Milestone 2
actually depends on.

**Toolchain note**: this environment had no Node/pnpm at all at the start of this work. Installed
Node.js 24.19.0 LTS (winget) + the project's pinned `pnpm@10.4.1` (corepack) so all work in this
document could be genuinely typechecked/tested/built rather than just written. No admin rights to
add a `pnpm` PATH shim, so all commands use `corepack pnpm <args>`.

---

## 2.1 Storage Migration

**Status: ✅ Core migration done + locally verified. 🔶 Branding-asset re-upload BLOCKED (see below). ⛔ Live bucket/RLS creation not yet applied (no Supabase credentials this session).**

### Bucket/path architecture (the "reviewed bucket/path layout" deliverable)

Four buckets, designed to mirror the exact same tenant-scoping predicates already proven in
`drizzle/0004_rls_policies.sql` rather than inventing a new identity model:

| Bucket | Public? | Path convention | RLS mirrors |
|---|---|---|---|
| `branding` | Yes | `{filename}` (flat, 3 known assets) | n/a — public read, admin-only write |
| `client-portal` | No | `{organizationId}/{category}/{filename}` (category: documents/reports/invoices) | `client_documents`/`client_reports`/`client_invoices`' own `organizationId = app_current_organization_id()` predicate |
| `developer-workspace` | No | `projects/{projectId}/files/{filename}` or `submissions/{developerId}/{filename}` | `developer_project_files`' EXISTS-join-through-assignments predicate; `developer_submissions`' self-only predicate |
| `ai-scan-reports` | No | `{reportToken}.pdf` | Same as `ai_scans` table: admin-only through RLS, real end-user access via the backend's own token-gated signed-URL issuance, not a Supabase session |

Migration: `drizzle/0007_storage_buckets.sql` — creates the 4 buckets, enables RLS on
`storage.objects` (defensive; Supabase enables this by default), adds SELECT/write policies per
bucket reusing `app_is_admin()`/`app_current_organization_id()`/`app_current_developer_id()` from
0004/0006. **Two independent layers**, per the Milestone 2 deliverable: (1) application
authorization — every storage call still runs through `clientProcedure`/`developerProcedure`/
`adminProcedure`'s existing ownership checks before reaching `server/storage.ts`; (2) this
migration's RLS policies, closing off direct-client access via the publishable key the same way
0004 did for Postgres tables.

### Code migration

`server/storage.ts` fully rewritten against Supabase Storage (via `getSupabaseAdmin()`,
`server/_core/supabaseAuth.ts` — the service-role client already built for RM-50's auth bridge,
reused rather than duplicated). Old Forge-presign implementation removed. New API:
`storagePut(bucket, key, data, contentType)`, `storageGetSignedUrl(bucket, key, expiresInSec?)`,
`storageGetPublicUrl("branding", key)`, `storageDelete(bucket, key)` (new — see finding below).
Dead `storageGet()` (returned an unsigned, permanently-valid path — already noted as a stale API
in RM-37's prior work) removed entirely.

**Consumers updated** to pass the correct bucket:
- `server/routers/clientPortal.ts` — `uploadDocument` (writes to `client-portal`, new path
  `{orgId}/documents/{timestamp}-{name}`), `requestReportSignedUrl`/`requestInvoiceSignedUrl`/
  `requestDocumentSignedUrl` (all read from `client-portal`). The `/manus-storage/{key}` fallback
  on signed-URL failure was removed — it pointed at a Forge-backed route serving Forge-shaped
  keys, meaningless once the key format is Supabase's; now surfaces a clear `INTERNAL_SERVER_ERROR`
  instead of a broken link.
- `server/routers/developer.ts` — `requestFileSignedUrl` reads from `developer-workspace`.
- `server/routers/aiScans.ts` — report PDF generation writes to and reads from `ai-scan-reports`.

**Real bug found and fixed while here**: `requestDocumentDeletion` (clientPortal.ts) deleted only
the `client_documents` DB row, never the underlying storage object — every client-deleted document
was actually orphaned in storage forever, pre-existing regardless of backend (Forge or Supabase).
Fixed: now calls the new `storageDelete()`, best-effort (logged on failure, not thrown — the DB
row the user asked to remove is already gone by that point, so a storage-side hiccup shouldn't
turn into a confusing partial-failure error). 2 new tests in `clientPortal.test.ts` cover this
(normal case + storage-delete-fails-but-DB-still-succeeds case).

### 🔶 BLOCKED — branding asset re-upload

The 3 branding assets (`iosky-logo-transparent_6a55c203.png`, `iosky-mark-transparent_9aba89cd.png`,
`iosky-favicon-transparent_403fabca.png`) exist **only** as remote objects in the old Forge
storage — confirmed no copy exists anywhere in the repo (`client/public/` has no image assets at
all). Migrating them requires two things this session doesn't have: (1) `BUILT_IN_FORGE_API_URL`/
`BUILT_IN_FORGE_API_KEY` credentials to retrieve the original bytes, and (2) Supabase credentials
to upload them into the new `branding` bucket. **Deliberately not faked or reconstructed** — per
the explicit rule against inventing missing assets.

**Correct, conservative decision made as a result**: `server/_core/storageProxy.ts` (the
`/manus-storage/*` Express route, still calling Forge directly — verified it does NOT import from
the rewritten `server/storage.ts`, fully independent) and the 3 client-side branding references
(`IOSkyLogo.tsx`, `LogoLoader.tsx`, `EcosystemOverview.tsx`) were **left untouched**. Cutting them
over to a Supabase public URL with nothing uploaded there yet would have broken the site's visible
logo/favicon — a regression, not a migration. This follows the same "never remove a dependency
before its replacement is verified" rule Milestone 2 §2.2 states explicitly, applied here a
workstream early because the asset-retrieval blocker forces it. `storageGetPublicUrl("branding", key)`
is implemented and ready in `server/storage.ts` for whenever the assets are actually available.

### ⛔ Live verification gap

Same shape as RM-57's: no `.env`/Supabase credentials in this session, so `0007_storage_buckets.sql`
has not been applied to the live project — the 4 buckets and their RLS policies exist only as
migration SQL, not live infrastructure. **What IS verified**: `npx tsc --noEmit` → 0 errors;
`npx vitest run` → 390/423 passing (33 correctly skipped), including all storage-consumer tests
updated for the new `(bucket, key)` signature and the 2 new deletion-cleanup tests; `pnpm run build`
→ succeeds. **Required before this reaches Milestone 1's evidence bar**: a session with Supabase
credentials must run `npx drizzle-kit migrate`, then confirm via direct SQL
(`SELECT id, public FROM storage.buckets WHERE id IN ('branding','client-portal','developer-workspace','ai-scan-reports')`
→ 4 rows; `SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'`
→ 8 rows) and perform an authenticated-vs-unauthenticated upload/download smoke test per bucket,
matching the rigor `MILESTONE1_SUPABASE_MIGRATION_REPORT.md` §5a used for the Postgres RLS suite.

### Files changed this workstream

`drizzle/0007_storage_buckets.sql` (new), `drizzle/meta/0007_snapshot.json` (new),
`drizzle/meta/_journal.json` (+1 entry), `server/storage.ts` (rewritten), `server/routers/clientPortal.ts`,
`server/routers/developer.ts`, `server/routers/aiScans.ts`, `server/clientPortal.test.ts`,
`server/developer.test.ts`.

---

## 2.2 Full Manus Dependency Removal

**Status: ✅ Done for everything code-reachable in this environment. ⛔ Production activation of the LLM provider and owner-alert email is BLOCKED (client decisions + credentials). 🔶 Branding proxy correctly still Forge-backed (see §2.1's blocker — same root cause).**

### LLM proxy → direct provider (server/_core/llm.ts)

Rewrote `invokeLLM()` to call a directly-configured endpoint instead of the Forge gateway
(`https://forge.manus.im/...` hardcoded fallback removed entirely — no fallback now, a clear
config error instead). **Provider-neutral by design**, not tied to one vendor: the module speaks
OpenAI's Chat Completions wire format (`messages[]`, `response_format` json_schema,
`choices[].message.content`), which `server/_core/aiScanScoring.ts` (the only caller) already
expects back — and which OpenAI itself, Azure OpenAI, Google's Gemini OpenAI-compatibility
endpoint, OpenRouter, Groq, etc. all accept directly at that same shape. Switching providers within
that set needs only `LLM_API_URL`/`LLM_API_KEY`/`LLM_MODEL` env config, no code change. Added along
the way: a real request timeout (`AbortSignal.timeout`, default 60s, was previously unbounded —
availability risk), explicit 429 rate-limit error surfacing, and a real bug fix (the `maxTokens`/
`max_tokens` fields `InvokeParams` already declared were silently discarded in favor of a hardcoded
32768 — now actually respected). Removed a Forge/Gemini-specific `thinking.budget_tokens` payload
field that doesn't belong in a provider-neutral client. 7 new tests in `server/llm.test.ts`
(previously had zero direct test coverage).

**⛔ BLOCKED — production activation**: no provider has been selected and no credentials exist in
this environment. `LLM_API_URL`/`LLM_API_KEY`/`LLM_MODEL` documented in `ENV_TEMPLATE.txt`.
Everything code-side is done; this is a client decision + credential, not a code gap.

### Owner notifications → email/Slack (server/_core/notification.ts)

Replaced the Manus `WebDevService/SendNotification` call (confirmed a genuine external API call,
not just an internal name) with real delivery through the **same Resend/SMTP/console transport**
every other transactional email already uses (`server/email.ts`'s `dispatchSimpleEmail`, exported
for reuse rather than duplicated). Slack added as an optional, additive second channel
(`OWNER_NOTIFY_SLACK_WEBHOOK_URL`) — fire-and-forget, never blocks or fails the email path. The
`notifyOwner(payload): Promise<boolean>` signature is unchanged, so all ~12 existing call sites
(bookings, contact, engineering, AI Scan, client portal, developer workspace) needed zero changes.
6 new tests in `server/notification.test.ts` (previously had zero direct test coverage — every
consumer test file mocked this module away wholesale) cover config-missing, validation, success,
failure, HTML-escaping (a hostile form submission can't inject markup into the alert email), and
the Slack fire-and-forget behavior.

**⛔ BLOCKED — production activation**: needs `OWNER_NOTIFY_EMAIL` (whose inbox receives
operational alerts — a real business decision, not inventable) configured. `OWNER_NOTIFY_SLACK_WEBHOOK_URL`
is genuinely optional.

### Analytics beacon

**Already compliant, no code change needed.** `client/index.html`'s beacon
(`%VITE_ANALYTICS_ENDPOINT%/umami` + `%VITE_ANALYTICS_WEBSITE_ID%`) was already provider-agnostic
before this session — confirmed via repo-wide grep, no hardcoded Manus analytics endpoint exists
anywhere. Only needs the client to supply real env values in production; the current unset-var
build warnings are expected in this credential-less environment, not a defect.

### Build-tool plugin removal (`vite-plugin-manus-runtime` + debug collector)

Removed last, after an actual smoke test (per the spec's explicit ordering) — not a full
browser-based QA pass (no browser tool / no live DB in this environment), but a real one: started
the dev server, hit `/`, `/login`, `/admin`, and a live tRPC endpoint before and after removal,
confirmed identical 200s and a correctly-titled homepage both times, then confirmed via the built
`dist/public` output that the plugin's injected runtime code (`manusImportantProperties`, present
in the JS bundle before removal) is gone afterward and no new build/runtime errors appeared.
Removed: the `vite-plugin-manus-runtime` package (`package.json` + lockfile), the local
`vitePluginManusDebugCollector` Vite plugin and its `.manus-logs/` output, the checked-in
`client/public/__manus__/debug-collector.js` (25KB, git-tracked), and `stagingGate.ts`'s now-dead
`/__manus__/` path exemption. `server.allowedHosts`' Manus-domain entries in `vite.config.ts` were
deliberately left alone — that's a dev-server host allowlist tied to which environment currently
hosts this app for preview, a deployment question, not build-tooling coupling.

**What a human should still do before calling this fully verified**: an actual browser-based
click-through (this environment has no browser tool) — the automated smoke test proves the server
and routing layer are intact, not that every interactive UI surface renders/behaves identically.

### Dead code / cosmetic sweep

Repo-wide `manus|Manus` grep across `*.ts,*.tsx,*.json,*.js`, every hit classified:
- **Renamed** (cosmetic, purely internal, one writer + one reader, no external contract):
  `localStorage`'s `"manus-runtime-user-info"` key → `"iosky-current-user-cache"`
  (`useAuth.ts`/`ExecutiveOverview.tsx`).
- **Removed**: the orphaned `auth.continueWithManus` i18n key (zero consumers, confirmed again)
  across all 10 locale files.
- **Confirmed still-legitimate, left untouched** (matches Milestone 1's existing classification,
  re-verified rather than re-decided from scratch): `server/_core/sdk.ts`/`oauth.ts`/`localAuthRoute.ts`/
  `mfaChallenge.ts` (the real, still-live Manus OAuth backbone — cutover to Supabase Auth is a
  separate, not-yet-made decision per RM-50), `oauth.ts:109`'s `provider: "manus"` literal (the
  genuine OAuth callback), `client/src/pages/Login.tsx`'s Manus sign-in option, `ClientSecurity.tsx`/
  `ClientAccount.tsx`'s "Managed by Manus OAuth" copy (still accurate today), the `/manus-storage/`
  paths (§2.1's branding blocker), and every test file's `"manus"`/`"manus-oauth"` fixture strings
  (exercising that same still-live path).
- **New finding, not fixed here (belongs to §2.4, not §2.2)**: `AutomationsAnalyticsRest.tsx:322`'s
  hardcoded "Integrations" list claims "Stripe, Twilio, SendGrid, Postmark, OpenAI, Google Maps,
  Manus auth" are all `state: "Connected"` — this is inside the same hardcoded mock table Milestone 1
  already flagged (the "Super Admin" role-option table), not real integration-status data. Flagged
  for §2.4's "Admin mockup conversion" pass rather than fixed here, to avoid scope-creeping this
  workstream into that one.

### Files changed this workstream

`server/_core/llm.ts`, `server/_core/notification.ts`, `server/_core/env.ts`, `server/email.ts`
(exported `dispatchSimpleEmail`/`escapeHtml`), `server/llm.test.ts` (new), `server/notification.test.ts`
(new), `vite.config.ts`, `package.json`/`pnpm-lock.yaml`, `server/_core/stagingGate.ts`,
`client/src/_core/hooks/useAuth.ts`, `client/src/pages/admin/sections/ExecutiveOverview.tsx`,
`client/src/lib/i18n/{ar,de,en,es,fr,it,ja,nl,pt,zh}.ts`, `ENV_TEMPLATE.txt`. Deleted:
`client/public/__manus__/debug-collector.js`.

### Verification

`npx tsc --noEmit` → 0 errors. `npx vitest run` → 404/437 passing (33 correctly skipped), +13 new
tests (7 `llm.test.ts` + 6 `notification.test.ts`), 0 regressions. `pnpm run build` → succeeds,
confirmed the Manus runtime injection is actually gone from the output bundle. Dev-server smoke
test performed before and after the plugin removal (see above).

---

## 2.3 Email Productionisation

**Status: ✅ Delivery tracking (schema, logging, webhook, admin visibility) done and locally verified. ⛔ Production Resend config and Supabase Auth email routing are BLOCKED — both are external dashboard/account actions with no code path in this repo.**

### 8.1 Production Resend setup

**No code change needed or possible** — `server/email.ts` already reads `RESEND_API_KEY` correctly
and has since before this milestone (confirmed, not re-implemented). What's actually required is
external: a verified sending domain in the Resend dashboard (SPF/DKIM DNS records) and a production
API key. **⛔ BLOCKED**, documented in `ENV_TEMPLATE.txt` with the exact 3 steps needed — this
environment has no Resend account to verify a domain against.

### 8.2 Auth transactional emails (Supabase password-reset/verification)

**⛔ BLOCKED — genuinely no code path exists for this in the repo.** `client/src/pages/Login.tsx`
already calls `supabase.auth.resetPasswordForEmail()` (RM-50) — that email is sent BY Supabase's
own servers using Supabase's built-in mailer (a few emails/hour, unbranded), not by this
application's backend. The only way to route it through Resend is Supabase Dashboard → Authentication
→ Emails → SMTP Settings → Custom SMTP, pointed at `smtp.resend.com` with the Resend API key —
external dashboard configuration this environment has no access to, and no amount of code in this
repo can substitute for it. Documented step-by-step in `ENV_TEMPLATE.txt`'s SUPABASE section,
including that Supabase's email *templates* (separate from SMTP transport) would also need
manual editing in that same dashboard to match this app's branding.

### 8.3 Delivery tracking

**Done and locally verified.** New `email_delivery_log` table (`drizzle/0008_email_delivery_log.sql`
— admin-only RLS, same pattern as `login_audit`) tracks every send attempt across all 4 email
types (booking confirmation, contact confirmation, dev-app ack, owner alert). `server/email.ts`'s
`sendBookingConfirmation` and `dispatchSimpleEmail` (the two dispatch choke points every email
path already funneled through) now log a row per attempt — `messageType`, `transport`,
`providerMessageId`, `recipient`, `relatedRef`, `status`, `errorMessage` — via new
`server/db/emailDelivery.ts` helpers. New `server/_core/resendWebhookRoute.ts` (`POST
/api/webhooks/resend`) verifies Resend's Svix-signed bounce/complaint/delivery webhooks (real
signature verification via the `svix` package, not stubbed — fails closed with 401 on a bad/missing
signature, 500 if `RESEND_WEBHOOK_SECRET` isn't configured) and updates the matching log row by
`providerMessageId`. **"Make failures visible"**: new `admin.emailDeliveryLog` and
`admin.emailDeliveryFailures` tRPC queries (admin-only, audited) surface the full log and a
failures-only view — no UI page wired to them yet (that's a natural companion to §2.4's admin
console work, not built here to avoid scope-creeping this workstream).

**⛔ Live verification gap** (same shape as 0006/0007): no Supabase credentials this session, so
`0008_email_delivery_log.sql` hasn't been applied to the live database, and the webhook has never
received a real Resend event. **What IS verified**: 0 typecheck errors; 9 new tests (6
`resendWebhook.test.ts` — including a genuinely valid Svix signature generated with the same
`Webhook.sign()` the test also uses to verify, plus tampered/wrong-secret/missing-config/ignored-event
cases; 3 `emailDeliveryLogging.test.ts` — proves `sendBookingConfirmation`/`sendContactConfirmation`/
`sendDevApplicationAck` each log the right `messageType`/`relatedRef`/`status`), 0 regressions
(413/446 total, 33 correctly skipped); clean build.

### Files changed this workstream

`drizzle/schema.ts`, `drizzle/0008_email_delivery_log.sql` (new), `drizzle/meta/0008_snapshot.json`
(new), `drizzle/meta/_journal.json`, `server/db/emailDelivery.ts` (new), `server/db/index.ts`,
`server/email.ts`, `server/_core/notification.ts`, `server/_core/resendWebhookRoute.ts` (new),
`server/_core/index.ts` (raw-body capture + route registration), `server/routers/admin.ts`,
`server/resendWebhook.test.ts` (new), `server/emailDeliveryLogging.test.ts` (new), `package.json`/
`pnpm-lock.yaml` (added `svix`), `ENV_TEMPLATE.txt`.

---

## 2.4 Core Workflow Verification & Conversion

**Status: 🔶 Partial. Real workflows verified via existing test coverage (no regressions). Highest-severity admin mocks converted to real data or honestly disclosed. Reports/Projects/Milestones mutations + AI Scan bridge built. Campaigns/Agents/Automations/Analytics-funnel deliberately deferred — genuinely new subsystems, out of bounded scope.**

### Real workflows — ported as-is

Client Portal, Developer Portal, Booking engine, Messaging, and Documents/Uploads were not
redesigned this pass (per the spec's explicit "port without redesign"). Verification consisted of:
the full existing test suite for these routers continuing to pass unchanged (424/457, 0
regressions) after this session's storage-migration and RBAC changes touched their underlying
code paths; and a dev-server smoke test (§2.2) confirming the app boots and core routes render.
**Not done**: an interactive browser click-through — this environment has no browser tool. That
gap is the same one flagged for §2.2's build-plugin removal and applies here too.

### Admin mockup conversion

A full repo survey (`client/src/pages/admin/`) found the mock surface much larger than Milestone
1's headline items — summarized here, full detail in the audit that drove these fixes:

**Fixed — components that fetched real backend data via tRPC and then discarded it in favor of a
hardcoded array** (the most severely misleading class: real data was one line away):
- `Developers`, `Security` (`DevSecCampAgents.tsx`) — now render `admin.developers`/`admin.security`'s
  real rows (developer profiles + access scopes; developer security events + failed-login count).
  `Security`'s pre-existing `sampleData` badge removed since it's genuinely real now.
- `UsersPermissions`, `AuditLogs`, `SupportDesk` (`AutomationsAnalyticsRest.tsx`) — now render
  `admin.users`/`admin.audit`/`admin.support`'s real rows. The fake "Super Admin … Alex Admin" row
  that Milestone 1 originally flagged is gone — replaced by actual `users` table rows. `admin.audit`
  turned out to already capture rich data (every `recordAdminEvent` call, not just logins — it
  reuses `login_audit` with a `provider: "admin"` discriminator), so `AuditLogs` is now a real,
  complete audit view, not a placeholder. `readSupport()` gained an org-name join so the ticket
  list can show which client filed each ticket.

**Fixed — fabricated numbers presented as real** (a different, more serious class than "sample
data with a badge": these had no disclosure at all):
- Every KPI tile across `Reports`/`Projects`/`Billing` (`ReportsProjectsBillingDocs.tsx`) used a
  `realCount || fakeNumber` pattern — meaning a genuinely accurate zero silently rendered a
  fabricated positive number instead. Removed the `|| fake` fallback everywhere; a real 0 now
  renders as 0. Removed KPIs with no real data source at all ("Downloads (24h)", "Avg. size",
  "Avg. velocity", "Deploys (7d)", "Failed payments" — none of these have a backing query or
  ever will without new tracking tables).
- **The exact "Billing fake payment-method chart" Milestone 2's spec names**: a "Method mix (30d)"
  chart hardcoding Stripe 58% / iDEAL 22% / SEPA 12% / PayPal 8% — while no payment processor is
  integrated anywhere in this app (confirmed: `client_invoices` has no payment-method column,
  and `clientPortal.ts`'s `requestInvoiceCheckout` already honestly returns `mode: "manual"`).
  Replaced with a real invoice-status-mix breakdown (draft/open/paid/overdue/void, computed from
  the actual rows) and corrected the tagline, which claimed live "Stripe, iDEAL, PayPal and SEPA
  flows."
- `Reports`' fake "Storage health" aside (100% encrypted-at-rest, "12 min ago" backup, fixed
  region, 0 anomalies — none backed by anything) removed; `Projects`' fake "Upcoming milestones"
  aside (fabricated project names) replaced with a real query — `readProjects()` (admin.ts) now
  also returns the 5 nearest non-completed milestones across all projects, sorted by due date.
- `SystemSettings`/`admin.settings` was mislabeled `source: "db"` despite being a static literal
  with no backing table (there is no configurable-settings system in this schema — building one
  is a genuinely separate feature, not a wiring fix). Corrected to `source: "static"`, added the
  `sampleData` disclosure badge already used elsewhere in this app for exactly this situation, and
  its "Manage" button (previously had no `onClick` at all) now fires the audited stub.

**Left alone, already honest — no code change needed**: `Automations`, `Campaigns`, `Agents`,
`Analytics`'s funnel/top-scans already carry the `sampleData` disclosure badge and their backend
(`synthesisedCampaigns`/`synthesisedAgents`/`synthesisedAutomations`) is honestly synthesized, not
silently fabricated. Building real versions is out of bounded scope for this workstream — campaign
execution, AI voice-agent orchestration, and a workflow-automation engine are new product
subsystems with no existing schema, not "wire up existing data" fixes. Flagged for a dedicated
future scope, not attempted here. `Automations`' previously-dead "New workflow" button now at
least fires the audited stub for consistency with every other still-sample-data page.

**Not reached this pass** (found, not fixed — noted for the next session): `ExecutiveOverview.tsx`'s
non-KPI panels (AI Operations insight chips, Revenue Intelligence chart, Automation Center donut,
System Health, Temp Access Control, Email/SMS Campaigns, Critical Alerts) render fabricated
numbers with **no disclosure at all** — the same severity class as the Billing chart, just not yet
addressed given the scope already covered this session. Several buttons across the admin console
still call only the generic `admin.action` audit stub with no real mutation behind them (invoice
creation, document upload, several others) — each needs a per-button decision (build the real
mutation vs. honestly label as unavailable) that wasn't reached here.

### Reports & Projects — the explicit spec deliverable

Previously **zero** create/update path existed for `client_reports`/`client_projects`/
`client_project_milestones` anywhere in the app (confirmed: only `list*`/`get*By*` helpers existed
in `server/db/clientPortal.ts`; `admin.ts` only ever read these tables). New:
- `admin.createReport`/`admin.updateReport`, `admin.createProject`/`admin.updateProject`,
  `admin.createMilestone`/`admin.updateMilestone` — all admin-only, tenant-scoped (milestone
  mutations verify the parent project belongs to the given organization first, mirroring exactly
  what `client_project_milestones`' own RLS policy checks at the database layer, since that table
  carries no `organizationId` of its own), and audited.
- **The AI Scan → Reports bridge**: `admin.promoteAiScanToClientReport` — takes a completed AI
  Scan (public-intake, anonymous — `ai_scans` has no `organizationId`) and an admin-chosen
  organization, and creates a real `client_reports` row carrying the scan's actual score and
  executive summary (parsed from `reportPayload`, with a safe fallback if that JSON is corrupted —
  doesn't fabricate a summary, just omits it). Does not copy the PDF (different bucket/tenancy
  shape — see §2.1); a formal client-portal report PDF is a separate step.
- `Reports`/`Projects` admin pages now have a working "Generate"/"New project" flow (a lightweight
  `window.prompt()`-based flow, matching the existing pattern already used for View-As's reason
  prompt — not a full modal form, but genuinely functional rather than an audit-only stub) that
  calls these real mutations and invalidates the query on success.

### Verification

`npx tsc --noEmit` → 0 errors. `npx vitest run` → 424/457 passing (33 correctly skipped), +11 new
tests (`admin.reportsProjects.test.ts` — RBAC gating, tenant isolation on milestone creation,
the AI Scan bridge's happy path/precondition-failure/corrupted-payload cases), 0 regressions.
`pnpm run build` → succeeds. One pre-existing flaky test (`viewAs.test.ts`'s tampered-payload
case, same one flagged in §2.2) reproduced again, confirmed unrelated to this session's changes,
passes clean on re-run — worth a dedicated look in a future session (the test's tamper technique
may have an edge case), not investigated further here since it's orthogonal to this workstream.

### Files changed this workstream

`client/src/pages/admin/sections/DevSecCampAgents.tsx`, `client/src/pages/admin/sections/AutomationsAnalyticsRest.tsx`,
`client/src/pages/admin/sections/ReportsProjectsBillingDocs.tsx`, `server/routers/admin.ts`,
`server/db/clientPortal.ts` (6 new mutations + 1 new helper), `server/admin.reportsProjects.test.ts` (new).

---

## 2.4 completion (later session)

**Status: ✅ Done.** The one item carried forward from the section above —
`ExecutiveOverview.tsx`'s undisclosed fabricated panels — is now resolved.

**Root-cause fix, not just a UI patch**: `server/routers/admin.ts`'s `buildSummary()`
(the function feeding the KPI strip at the top of the page) had the exact same
"real 0 silently becomes a fabricated positive number" bug this workstream already
fixed in `ReportsProjectsBillingDocs.tsx` — just missed here, in a different file
feeding a different page. `activeClients`/`aiScans`/`openProjects`/`openTickets`/
`revenueMTD` all used a `real > 0 ? real : hardcodedSeed` pattern; fixed so real
values (including real zeros) flow through directly. Three of the KPI "deltas"
(`activeClientsDelta`, `openProjectsDelta`, `openTicketsDelta`) were hardcoded
constants never computed from anything; `activeClientsDelta` now has a real
month-over-month computation (new organizations this period vs last, mirroring
the pattern already used correctly for `aiScansDelta`), the other two honestly
report 0 since this schema has no historical snapshot to compute a real trend
from (no fabricated proxy invented). `systemHealthPct` (99.99%, always) removed
entirely — no real infra health-check system exists anywhere in this app,
matching this workstream's own established precedent of removing KPIs with no
real backing query. The all-database-unavailable fallback branch also returned
this same fake-numbers shape as a normal success; fixed to report honest
zeros/empty arrays while still succeeding (not throwing), preserving the
graceful-degradation pattern every other read in this file already uses.

**Panel-by-panel**, on the Executive Overview page itself:
- **Wired to real data**: Revenue Intelligence (headline number/delta now the
  real `kpis.revenueMTD`/`revenueDelta` — was a hardcoded €127,430 sitting
  right next to the real, different number in the KPI tile above it, actively
  contradictory, not just fake; the trend chart was a hand-drawn SVG with
  hardcoded points and a fabricated "May 20, 2026" annotation, replaced with a
  real day-by-day cumulative paid-revenue series backed by a new
  `AdminSummary.revenueByDay` field and query). Recent Activity (was a
  hardcoded fake feed; now renders `AdminSummary.recentActivity`, which
  `buildSummary()` already computed from real bookings/leads but the UI never
  bound).
- **Disclosed with the sample-data badge** (no real backing system exists for
  any of these — alerting, workflow automation, AI voice/IVR, infra
  health-check, campaign management, a temp-access-grant workflow, or a
  contracts/e-signature system): AI Operations Agent's insight chips (also
  removed a contradictory pulsing "Live" badge sitting right next to it),
  Operational Command Center, Critical Alerts (the most sensitive one — fake
  specific security incidents with fake client names presented as real),
  Automation Center, AI Agents & IVR (also dropped the false "Real-time" label
  and per-row "LIVE" chips), Temporary Access Control, Email & SMS Campaigns,
  System Health Overview, Upcoming & Pending.
- The one dead button found here (Temporary Access Control's "Grant New
  Access", no `onClick` at all) now fires the audited stub, matching the
  established per-button convention. The wider "several buttons still call
  only `admin.action`" item from earlier in this doc was not exhaustively
  swept across the whole console this pass — that remains open, see below.

Files: `client/src/pages/admin/sections/ExecutiveOverview.tsx`,
`server/routers/admin.ts`, `server/admin.summary.test.ts` (rewrote the test
that had asserted the fake seed numbers were *correct* behavior — it was
encoding the bug as a passing test).

---

## 2.5 Enterprise Super Admin & Platform Governance

**Status: 🔶 Partial. Organization Management + role/tenant assignment,
Technical Operator role + Security Center, and Business Intelligence
dashboards are done, tested, and (where applicable) RLS-hardened. Still
not started: AI governance config, platform configuration, integration
management, notification-template management, broader MFA-enforcement
surfacing — each is a separately-specified, substantial feature area.**

### Technical Operator role + Security Center

A new, deliberately *lateral* RBAC tier (not a superset/subset of admin,
unlike super_admin) scoped to infrastructure/operational visibility only.

- `drizzle/schema.ts` + `drizzle/0010_technical_operator_role.sql`: new
  `users_role` enum value + `app_is_technical_operator()` RLS helper.
  Same apply/verify caveat as every migration since `0006` — authored and
  locally verified only, the connected Supabase project is still
  unreachable.
- `server/_core/trpc.ts`: new `opsProcedure` gate (`isOpsRole` = 
  `technical_operator` OR `isAdminRole`) — deliberately a *separate* gate
  from `adminProcedure`, not a subset of it, so this tier never inherits
  leads/billing/documents/client access no matter how `adminProcedure`
  evolves.
- `server/routers/ops.ts` (new): `systemHealth` (email delivery health,
  failed-login volume, security-event volume by severity, MFA enrollment
  posture — all real queries against `email_delivery_log`/`login_audit`/
  `developer_security_events`/`mfa_factors`, honest zeros when the DB is
  offline, no customer/financial figures anywhere in the shape),
  `emailDeliveryLog`, and the Security Center workflow: `securityEvents`
  (recent platform-wide events) + `acknowledgeSecurityEvent` (a real
  investigation/acknowledgment action against
  `developer_security_events.acknowledgedAt/acknowledgedByUserId` — those
  columns already existed but nothing ever wrote to them before this).
- `client/src/pages/ops/OpsConsole.tsx` (new) at `/ops`: a standalone shell,
  deliberately *not* `AdminLayout` — that sidebar links to 21 sections
  almost all gated by `adminProcedure`, none of which this role can reach;
  reusing it would either show a wall of FORBIDDEN links or require
  silently widening the role's access, both wrong. Admin/super_admin can
  also open `/ops` (the server gate accepts them too) for a fast
  infra-only view.
- `useRouteGuard.ts` (client) / `oauth.ts` (server): role→home routing
  recognizes `technical_operator` (→ `/ops`), kept in sync both sides.
- Users & Permissions role picker (`AutomationsAnalyticsRest.tsx`) can now
  actually assign `technical_operator`.
- `server/ops.test.ts` (new, 16 tests): RBAC gating across all five roles
  (technical_operator/admin/super_admin allowed, client/developer/
  unauthenticated rejected), explicit proof technical_operator is walled
  off from `admin.billing`/`documents`/`crm`/`reports`, the offline-DB
  fallback shape, and the acknowledge workflow (including NOT_FOUND for an
  unknown event id).

### Business Intelligence dashboards

Interpreted narrowly and defensibly: rather than inventing a new page, wired
the *existing* "Analytics & Insights" admin surface (already named in the
master nav spec) to real computed data — it had been rendering entirely
hardcoded literals (a fake 412/367/318/187/134 funnel, "top scans by
converted revenue" with invented EUR figures) since before this session,
disclosed only via a page-level `sampleData` badge.

- `server/routers/admin.ts`'s new `readBusinessIntelligence()`: a real
  rolling-30-day funnel (bookings created → completed → AI Scans triggered
  → qualified leads → won deals, computed from `bookings`/`aiScans`/`leads`),
  a real "top scoring scans" list (ranked by actual AI Scan `overallScore` —
  there is no per-scan revenue attribution anywhere in this schema, so the
  old "by converted revenue" framing was never honestly fixable; ranking by
  the score the engine actually produced is the real equivalent), and real
  KPI inputs (leads/bookings/AI-Scans/won-deals over 30 days, with a real
  month-over-month leads delta using the same pattern as `buildSummary()`'s
  `aiScansDelta`). Honest empty shape (not fake seed numbers) when the
  database is unreachable.
- `client/src/pages/admin/sections/AutomationsAnalyticsRest.tsx`'s
  `Analytics` component: KPI tiles, funnel bars, and the top-scans list are
  now all driven by `trpc.admin.analytics`'s real response; the page-level
  `sampleData` badge is removed (nothing left on this page is fabricated).
- `server/admin.analytics.test.ts` (new, 3 tests): honest offline-fallback
  shape, admin-only gating, super_admin passthrough.

Verified (both features above): `npx tsc --noEmit` → 0 errors. `npx vitest
run` → 460/460 passing, 33 correctly skipped, 0 regressions. `pnpm run
build` → succeeds. `drizzle-kit generate` → "No schema changes, nothing to
migrate" (schema.ts matches the new snapshot).

### Organization Management + role/tenant assignment

Built on `superAdminProcedure` (existed since RM-57, unused by any endpoint
until now). Closed a real, total gap: there was no way anywhere in this app
to create an organization or link a user to one — every existing endpoint
took an `organizationId` as *input*, assuming the row already existed.

- `server/db/clientPortal.ts`: `listOrganizations` (with a real per-org
  member count via a join, not a second round-trip), `createOrganization`
  (slug-uniqueness checked by the caller before insert), `updateOrganization`,
  `getOrganizationBySlug`.
- `server/db/users.ts`: `setUserRole`, `assignUserOrganization`, `getUserById`.
- `server/routers/admin.ts`: `admin.listOrganizations` (readable by any admin
  — reading is not the restricted part), `admin.createOrganization`/
  `updateOrganization`/`setUserRole`/`assignUserOrganization` (all
  `superAdminProcedure`-gated — plain admin gets FORBIDDEN). `setUserRole`
  refuses to let a caller change their own role: only super_admin can call
  it at all, so a self-demotion could strand every super_admin with no way
  to undo it.
- `drizzle/0009_super_admin_org_management.sql`: tightens the `organizations`
  RLS write policy from admin-level to super_admin-only, matching RM-57's own
  decision record (`0006_super_admin_role.sql`'s header comment names
  "organization management" as a super_admin-exclusive capability). Defense
  in depth alongside the tRPC gate, same reasoning as every other RLS policy
  in this codebase.
- UI: `client/src/pages/admin/sections/AutomationsAnalyticsRest.tsx`'s Users
  & Permissions page — a new "Organization" column (was invisible before),
  a new "Actions" column (Role / Org buttons, `window.prompt()`-based
  matching the established lightweight-flow convention, rendered only for
  actual super_admin callers), a new "Organizations" side panel (real list +
  member counts + a "New organization" action), a new KPI tile.

**Real bug found and fixed while touching the migration chain** (unrelated to
this feature, discovered because it required regenerating a migration): the
`0008` snapshot had a stray `isRLSEnabled: true` flag on `email_delivery_log`
— the only table with it set, and `schema.ts` doesn't declare it via
Drizzle's `.enableRLS()` builder (no table in this codebase does; RLS is
managed entirely via raw SQL migrations here) — so `drizzle-kit generate`
had started auto-proposing a migration to *disable* RLS on that table to
"reconcile" the mismatch. Fixed the snapshot, deleted the wrong
auto-generated migration before it was ever applied anywhere.

**⛔ Live verification gap** — same shape as every migration since `0006`:
this session's connected Supabase project turned out to be unreachable (see
the handoff summary above), so `0009` has not been applied to any live
database. `npx tsc --noEmit` → 0 errors. `npx vitest run` → 441/441 passing
(+17 new, `server/admin.superAdmin.test.ts`): plain-admin rejection on every
super_admin-exclusive endpoint, unauthenticated rejection, the self-role-
change guard, slug-uniqueness/NOT_FOUND/audit-logging paths. `pnpm run
build` → succeeds.

### Platform configuration store

Turned `SystemSettings` from a hardcoded literal list (`source: "static"`,
disclosed via `sampleData`) into a real, persisted, super_admin-editable
config surface. Deliberately narrow: this stores a label/description/state
string per named setting, not live third-party provider wiring — no
Stripe/Twilio/SendGrid credentials are read from or written to it. Building
real provider integration is separate, substantial work with real provider
accounts behind it, not something to fabricate.

- `drizzle/schema.ts` + `drizzle/0011_platform_settings.sql`: new
  `platform_settings` table (section/key/title/description/value/
  updatedByUserId), RLS-hardened same pattern as every table in this repo
  (`ENABLE`/`FORCE ROW LEVEL SECURITY`, admin-only read via `app_is_admin()`,
  super_admin-only write via `app_is_super_admin()`). Same apply/verify
  caveat as every migration since `0006` — authored and locally verified
  only.
- `server/db/platformSettings.ts` (new): `listPlatformSettings()`
  auto-seeds the six original section rows (branding/storage/security/
  i18n/integrations/observability) with their original copy on first read,
  so the page renders identically until a super_admin actually edits
  something — at which point it's real persisted state, not a literal.
  `updatePlatformSetting(key, updates, updatedByUserId)`.
- `server/routers/admin.ts`: `admin.settings` now reads the real table;
  new `admin.updateSetting` (super_admin-exclusive, matching RM-57's
  decision record naming "platform & integration configuration" as a
  super_admin-only capability) with NOT_FOUND for an unknown key.
- `client/.../AutomationsAnalyticsRest.tsx`'s `SystemSettings`: now
  actually queries `trpc.admin.settings` (it never did before — the
  section cards were a second, independently-hardcoded local array,
  disconnected from the query hook entirely). super_admin sees a real
  "Edit" action (`window.prompt`, matching the established lightweight-flow
  convention); other admins see the same read-only "Manage" audited stub
  as before. `sampleData` badge removed.
- `server/admin.platformSettings.test.ts` (new, 6 tests): real data flowing
  through, honest offline/empty shape, super_admin-exclusive write gating,
  NOT_FOUND for an unknown key.

Verified: `npx tsc --noEmit` → 0 errors. `npx vitest run` → 466/466 passing,
33 correctly skipped, 0 regressions. `pnpm run build` → succeeds.
`drizzle-kit generate` → "No schema changes, nothing to migrate".

### MFA compliance visibility (the honestly-buildable half of "MFA-enforcement surfacing")

`admin.mfaPosture` existed (aggregate enrollment %) but was never consumed
by any client component — a dead endpoint. Extended it with a real
per-role breakdown and wired it into the Security Monitoring page, plus
gave that page's security-event table a real acknowledge action (reusing
`ops.acknowledgeSecurityEvent` — `opsProcedure` already accepts admin/
super_admin, so this needed no new endpoint).

- `server/routers/admin.ts`'s `readMfa()`: new `byRole` array — one grouped
  query (`LEFT JOIN mfa_factors ... GROUP BY role`) returning
  `{role, total, enrolled}` per role. Honest `byRole: []` in the offline
  fallback (also relabeled that fallback's `source` from `"seed"` to
  `"unavailable"`, matching this session's established honesty convention
  — it was the one remaining `"seed"` label of this shape left in the
  file).
- `client/.../DevSecCampAgents.tsx`'s `Security` component: new "MFA
  compliance by role" side panel (real enrolled/total per role); security
  events table gets a real "Acknowledge" action per unacknowledged row.
- `server/admin.mfaPosture.test.ts` (new, 2 tests): honest offline shape
  including `byRole: []`, admin-only gating.

**Deliberately NOT built**: a hard, blocking "require MFA for this role/org"
login-time gate. Unlike `developer` (which already has one via
`resolveDeveloperContext`/`evaluateDeveloperGate`), adding this for
admin/client/super_admin/technical_operator would mean modifying
`requireUser`/`protectedProcedure` — the middleware nearly every
authenticated endpoint in this app is built on — which needs to be
verified against a live session/login flow before shipping. The connected
Supabase project is unreachable this session (see the handoff summary), so
that verification isn't safely possible right now; building it unverified
risks locking real users out of the entire app. Visibility (above) is the
real, safe, honestly-scoped deliverable for this pass.

Verified: `npx tsc --noEmit` → 0 errors. `npx vitest run` → 468/468 passing,
33 correctly skipped, 0 regressions. `pnpm run build` → succeeds.

### Not started (real scope, not small)

- **AI governance config** — no concrete spec exists in this repo for what
  this means operationally (model allow-list? prompt/response logging
  retention? per-org AI feature toggles?) — needs a decision, not a guess,
  before it's buildable.
- **Real third-party integration management / notification-template
  content management** — the platform configuration *store* is now real
  (see above), but it does not wire real Stripe/Twilio/SendGrid provider
  credentials, and notification templates need §2.7's notification schema
  to exist first (a template is meaningless without the typed notification
  system it renders for) — tracked there, not duplicated here.
- **A hard, blocking per-role/org MFA gate** — deliberately not built this
  pass. See "MFA compliance visibility" below for what *is* real now.

---

## Remaining Milestone 2 workstreams

Not yet started:
- **2.5** (remainder) — see the not-started list immediately above.
- **2.6 Document Lifecycle, Workflow Engine & Integration Layer** — document
  versioning/approval/rejection/retention (`client_documents` currently has
  none of this, it's flat upload/download only), a reusable
  workflow-definition engine, an integration/webhook registry. All new
  subsystems; none of the schema for this exists yet.
- **2.7 Notification Infrastructure** — a central typed notification write
  service, a real Notification Center UI (bell/list/mark-as-read — currently
  non-functional per the original Milestone 1 audit), a schema extension
  (priority/channel/template/action-URL/lifecycle-status), a delivery queue,
  a bridge to the Resend transport §2.3 already built. `client_notifications`/
  `developer_notifications` tables exist today but are minimal (no priority,
  channel, or template concept) — this is a real schema migration plus a
  UI build, not just wiring.
- Also still open from §2.4: an exhaustive sweep of every remaining
  `admin.action`-only button across the whole admin console (invoice
  creation, document upload, others) was not attempted this pass — only the
  one found on Executive Overview was fixed.
