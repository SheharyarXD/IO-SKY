# Milestone 2 — Progress Tracker

Live tracking document, same convention as `PHASE1_CHECKLIST.md`. Source of truth for scope:
`Milestone 2.md`. Sequenced per that document's own dependency order (architecture/DB foundation →
storage → security/RLS → Manus removal → email → workflows → reports/projects → RBAC/Super Admin →
Technical Operator → Security/Audit Center → BI → AI governance → document lifecycle → workflow
engine → integrations → platform ops → notifications → testing → Manus-removal verification → exit
gate). Each workstream gets a status row using the same legend as Milestone 1:

Legend: ✅ Done + locally verified · 🔶 Partial · ⛔ Blocked (external access/decision required) · ⏭ Not started

---

## Handoff summary (as of 2026-08-15, end of session)

**Overall: 4 of 7 Milestone 2 workstreams touched (§2.1–2.4), 3 not started (§2.5–2.7). Exit gate NOT passed.**

| Workstream | Status |
|---|---|
| M1 prerequisite (RM-57, Super Admin) | ✅ Code done + locally verified · ⛔ not applied to live DB |
| 2.1 Storage Migration | ✅ Done + verified · ⛔ branding assets + live DB application blocked |
| 2.2 Manus Dependency Removal | ✅ Done + verified · ⛔ LLM/owner-alert production activation blocked |
| 2.3 Email Productionisation | ✅ Delivery tracking done · ⛔ Resend domain + Supabase Auth email routing blocked |
| 2.4 Core Workflow Verification & Conversion | 🔶 Partial — highest-severity mocks fixed, some remain |
| 2.5 Enterprise Super Admin & Platform Governance | ⏭ Not started |
| 2.6 Document Lifecycle / Workflow Engine / Integrations | ⏭ Not started |
| 2.7 Notification Infrastructure | ⏭ Not started |

**Verification baseline this session**: `npx tsc --noEmit` → 0 errors · `npx vitest run` → 424/457 passing, 33 correctly skipped, 0 regressions (one pre-existing flaky test, `viewAs.test.ts`'s tampered-payload case, reproduces intermittently — confirmed unrelated to any change made this session) · `pnpm run build` → succeeds. Toolchain (Node 24.19 LTS + pnpm 10.4.1) was installed fresh this session via winget/corepack — this environment had none at the start.

**Everything blocked this session needs either**: a Supabase project connection (`.env` with `DATABASE_URL`/`SUPABASE_*`) to apply migrations `0006`–`0008` and live-verify RLS, or a client decision/credential (LLM provider, Resend domain, owner-alert email, branding image files, Supabase dashboard access for Custom SMTP). None of it is a code gap — see each workstream's ⛔ notes below for exact detail.

**Uncommitted work**: everything from §2.2 onward (LLM/notification rewrite, email delivery tracking, admin mockup conversion, Reports/Projects mutations) is sitting in the working tree, not yet committed. RM-57 + §2.1 storage work was committed separately (commit `477c962`).

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

## Remaining Milestone 2 workstreams

Not yet started (sequenced next, per the agreed one-workstream-at-a-time approach):
2.5 Enterprise Super Admin & Platform Governance, 2.6 Document Lifecycle/Workflow Engine/Integration
Layer, 2.7 Notification Infrastructure. Also carried forward from §2.4: `ExecutiveOverview.tsx`'s
undisclosed fabricated panels, and the remaining `admin.action`-only buttons across the console.
