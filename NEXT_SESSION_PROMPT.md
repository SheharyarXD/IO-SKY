# Continuation Prompt — IO SKY Milestone 2

Copy-paste this whole file as your prompt to start the next session.

---

Continue the IO SKY implementation from the current repository state. Do not redo completed work.
First inspect the current implementation and verify the stated status below yourself rather than
trusting it blindly — then continue only the incomplete work.

## Source of truth

- `Milestone 2.md` — the requirements spec.
- `MILESTONE2_PROGRESS.md` — live tracking doc, updated after every workstream this session. Read
  its "Handoff summary" section first, then the detailed §2.1–2.4 sections for exact evidence.
- `PHASE1_CHECKLIST.md` / `MILESTONE1_SUPABASE_MIGRATION_REPORT.md` — Milestone 1 status (43+1
  done, RM-57 resolved this session — see MILESTONE1_SUPABASE_MIGRATION_REPORT.md §16).

## What's already done (verify, don't redo)

- **RM-57 (Super Admin role)** — schema, RLS, RBAC all written and locally verified. `super_admin`
  is a strict superset of `admin`.
- **Milestone 2 §2.1 Storage Migration** — `server/storage.ts` rewritten against Supabase Storage,
  4 buckets + RLS designed (`drizzle/0007_storage_buckets.sql`), all consumers updated.
- **Milestone 2 §2.2 Manus Dependency Removal** — LLM proxy replaced (`server/_core/llm.ts`,
  provider-neutral), owner notifications replaced with real email/Slack
  (`server/_core/notification.ts`), `vite-plugin-manus-runtime` + debug collector removed and
  verified gone from the build output, dead-code sweep done.
- **Milestone 2 §2.3 Email Productionisation** — delivery-log table + webhook
  (`server/_core/resendWebhookRoute.ts`, real Svix signature verification), every email send path
  instrumented.
- **Milestone 2 §2.4 Core Workflow Verification & Conversion (partial)** — `Developers`,
  `Security`, `UsersPermissions`, `AuditLogs`, `SupportDesk` rewired to real backend data; the
  Billing fake payment-method chart removed; Reports/Projects/Milestones create+update mutations
  built (didn't exist before); AI Scan → Client Portal Reports bridge built.

**Verification baseline**: `npx tsc --noEmit` → 0 errors. `npx vitest run` → 424/457 passing, 33
correctly skipped, 0 regressions. `pnpm run build` → succeeds. Toolchain (Node 24.19 LTS + pnpm
10.4.1) had to be installed fresh via winget/corepack — check whether your environment already has
it before reinstalling. No admin rights to add a `pnpm` PATH shim was found last time — commands
used `corepack pnpm <args>` instead of a bare `pnpm`; check whether that's still necessary.

## Exact remaining work, in order

1. **Finish §2.4**: `client/src/pages/admin/sections/ExecutiveOverview.tsx` has multiple panels
   (AI Operations insight chips, Revenue Intelligence chart, Automation Center donut, System
   Health, Temp Access Control, Email/SMS Campaigns, Critical Alerts) rendering fabricated numbers
   with **no "sample data" disclosure at all** — same severity class as the billing chart already
   fixed. For each: either wire to real data (check if `admin.summary`'s `buildSummary()` already
   computes something usable — `recentActivity` does but isn't bound) or add the `sampleData`
   badge pattern already used elsewhere in this codebase. Also: several buttons still call only
   the generic `admin.action` audit stub (invoice creation, document upload, others) — decide
   per-button whether to build the real mutation or honestly relabel as unavailable.
2. **Milestone 2 §2.5 — Enterprise Super Admin & Platform Governance**: build on RM-57's
   foundation (`superAdminProcedure` exists, unused by any real endpoint yet). Needs: organization
   management, full user/role/permission management UI+endpoints, platform configuration,
   integration management, notification-template management, MFA enforcement surfacing, the
   Technical Operator role (new RBAC tier, scoped to infra visibility, walled off from
   customer/financial data), Security Center, Business Intelligence dashboards, AI governance
   config.
3. **Milestone 2 §2.6 — Document Lifecycle, Workflow Engine & Integration Layer**: document
   versioning/approval/rejection/retention (client_documents currently has none of this — it's
   flat upload/download only), a reusable workflow-definition engine, integration/webhook registry.
4. **Milestone 2 §2.7 — Notification Infrastructure**: central typed notification write service,
   real Notification Center UI (bell/list/mark-as-read — currently non-functional per the original
   Milestone 1 audit), schema extension (priority/channel/template/action-URL/lifecycle-status),
   delivery queue, bridge to the Resend transport §2.3 already built.
5. Re-run the full exit-gate checklist in `Milestone 2.md`'s final section once 2.5–2.7 land.

## Blockers — need from the user, not resolvable in code

- **LLM provider choice + API key** (`LLM_API_URL`/`LLM_API_KEY` in `ENV_TEMPLATE.txt`) — blocks
  §2.2's AI Scan production activation.
- **Resend production domain + key**, **`OWNER_NOTIFY_EMAIL`** — blocks §2.3/§2.2 production
  activation.
- **Original branding image files** (logo/mark/favicon) or Forge credentials to retrieve them —
  blocks re-uploading them to the new Supabase `branding` bucket; `/manus-storage/*` is correctly
  still serving them via Forge in the meantime, do not remove that path until this is resolved.
- **Supabase project credentials** (`.env` with `DATABASE_URL`/`SUPABASE_URL`/`SUPABASE_SECRET_KEY`/
  etc) — blocks applying migrations `0006`, `0007`, `0008` to the live database and live-verifying
  RLS. Everything is written and locally verified but not live-applied.
- **Supabase dashboard access** — needed to configure Custom SMTP (routing Supabase Auth's
  password-reset emails through Resend) and to configure real OAuth providers if desired. No code
  path in this repo can do this even in principle.

## Rules to follow (carried over from this session)

- Verify before trusting any status in these docs — re-run typecheck/tests/build yourself first.
- Never fabricate data, test results, or "done" status. Use ✅/🔶/⛔/⏭ honestly.
- Don't remove a working dependency (e.g. the Forge branding proxy) before its replacement is
  verified working.
- Update `MILESTONE2_PROGRESS.md` after each workstream, same format as the existing sections.
- Report evidence (test counts, exact commands run), not just "it works."
