# Milestone 2 — Progress Tracker

Live tracking document, same convention as `PHASE1_CHECKLIST.md`. Source of truth for scope:
`Milestone 2.md`. Sequenced per that document's own dependency order (architecture/DB foundation →
storage → security/RLS → Manus removal → email → workflows → reports/projects → RBAC/Super Admin →
Technical Operator → Security/Audit Center → BI → AI governance → document lifecycle → workflow
engine → integrations → platform ops → notifications → testing → Manus-removal verification → exit
gate). Each workstream gets a status row using the same legend as Milestone 1:

Legend: ✅ Done + locally verified · 🔶 Partial · ⛔ Blocked (external access/decision required) · ⏭ Not started

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

## Remaining Milestone 2 workstreams

Not yet started (sequenced next, per the agreed one-workstream-at-a-time approach):
2.2 Manus Dependency Removal, 2.3 Email Productionisation, 2.4 Core Workflow Verification &
Conversion, 2.5 Enterprise Super Admin & Platform Governance, 2.6 Document Lifecycle/Workflow
Engine/Integration Layer, 2.7 Notification Infrastructure.
