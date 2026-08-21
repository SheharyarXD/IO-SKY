# Continuation Prompt — IO SKY Milestone 2

Copy-paste this whole file as your prompt to start the next session.

---

Continue the IO SKY implementation from the current repository state. Do not redo completed work.
First inspect the current implementation and verify the stated status below yourself rather than
trusting it blindly — then continue only the incomplete work.

## Source of truth

- `Milestone 2.md` — the requirements spec (not present in this repo as of this writing — work from
  `MILESTONE2_PROGRESS.md`'s own description of each workstream's scope instead).
- `MILESTONE2_PROGRESS.md` — live tracking doc, updated after every workstream. Read its "Handoff
  summary" section first, then §2.1–2.5 for exact evidence.
- `PHASE1_CHECKLIST.md` / `MILESTONE1_SUPABASE_MIGRATION_REPORT.md` — Milestone 1 status.

## What's already done (verify, don't redo)

- **RM-57 (Super Admin role)** — schema, RLS, RBAC all written and locally verified.
- **Milestone 2 §2.1 Storage Migration** — `server/storage.ts` rewritten against Supabase Storage.
- **Milestone 2 §2.2 Manus Dependency Removal** — LLM proxy replaced, owner notifications replaced,
  build-tool plugin removed and verified gone.
- **Milestone 2 §2.3 Email Productionisation** — delivery-log table + webhook, every send path
  instrumented.
- **Milestone 2 §2.4 Core Workflow Verification & Conversion — fully done.** Every previously-
  undisclosed fabricated panel on `ExecutiveOverview.tsx` is now wired to real data or disclosed with
  the `sampleData` badge. The underlying `admin.summary`/`buildSummary()` fabrication bug (real 0s
  silently becoming fake positive numbers, feeding the KPI strip) is fixed too.
- **Milestone 2 §2.5 (partial) — Organization Management + role/tenant assignment.** Real
  `admin.createOrganization`/`updateOrganization`/`listOrganizations`/`setUserRole`/
  `assignUserOrganization` endpoints (super_admin-exclusive except the read), RLS tightened to match
  (`drizzle/0009_super_admin_org_management.sql`), real UI on the Users & Permissions page.

**Verification baseline**: `npx tsc --noEmit` → 0 errors. `npx vitest run` → 441/441 passing, 33
correctly skipped, 0 regressions. `pnpm run build` → succeeds. Run `pnpm install` first if
`node_modules` looks stale after a pull — a real gap was found this session where `svix` was
declared in `package.json`/lockfile but not actually installed.

## Central blocker — the connected Supabase project is gone

`rhgzcgcqlypuvislwjlf.supabase.co` no longer resolves in DNS at all (`NXDOMAIN`) — confirmed via
`nslookup`, a raw Postgres connection attempt, and a plain `fetch` to the Auth health endpoint, all
failing the same way. This is not a transient outage. **Migrations `0006` through `0009` remain
authored-and-locally-verified only** — nothing has reached a live database since RM-60. If a working
Supabase project connection becomes available: apply all migrations in order, then live-verify RLS
(including the two new super_admin-related policies) the same way `MILESTONE1_SUPABASE_MIGRATION_REPORT.md`
§5a did for the original set. `server/rls.negative.test.ts` now does a real reachability probe before
running (not just an env-var presence check) — if credentials are restored, it will pick this up and
run for real automatically; no code change needed there.

## Exact remaining work, in order

1. **Finish §2.5**: Technical Operator role (new RBAC tier, infra visibility only, walled off from
   customer/financial data — needs its own permission-boundary design against this schema before it's
   buildable, not just a new enum value), Security Center (dedicated page aggregating
   `developer_security_events`/`login_audit`/MFA posture with real investigation actions — `admin.security`
   already surfaces some raw data, no dedicated UI/workflow exists), Business Intelligence dashboards
   (no analytics aggregation layer exists at all beyond the KPIs already on Executive Overview),
   AI governance config (no concrete spec exists anywhere in this repo for what this means
   operationally — get a real decision before building, don't guess), platform/integration/
   notification-template configuration (`SystemSettings` is an honestly-labeled static reference view,
   not a live editor — building one is separate, substantial work), broader MFA-enforcement surfacing
   (a "require MFA for this role/org" admin control doesn't exist yet).
2. **Milestone 2 §2.6 — Document Lifecycle, Workflow Engine & Integration Layer**: document
   versioning/approval/rejection/retention (`client_documents` is flat upload/download only today —
   none of this schema exists yet), a reusable workflow-definition engine, an integration/webhook
   registry. All new subsystems.
3. **Milestone 2 §2.7 — Notification Infrastructure**: central typed notification write service, real
   Notification Center UI (bell/list/mark-as-read — currently non-functional), schema extension
   (`client_notifications`/`developer_notifications` exist today but have no priority/channel/template/
   action-URL/lifecycle-status concept — this needs a real migration, not just wiring), delivery
   queue, bridge to the Resend transport §2.3 already built.
4. Also still open from §2.4: an exhaustive sweep of every remaining `admin.action`-only button
   across the whole admin console (invoice creation, document upload, others) — only the one found on
   Executive Overview was fixed this pass, the wider sweep wasn't attempted.
5. Re-run the full exit-gate checklist in `Milestone 2.md`'s final section once 2.5–2.7 land (that
   file isn't in this repo as of this writing — get it from wherever the spec actually lives, or ask
   the client for it, before treating "exit gate passed" as achievable).

## Blockers — need from the user, not resolvable in code

- **A working Supabase project connection** — see "Central blocker" above. This is now the single
  highest-leverage unblock: it gates live-verifying every migration since `0006`, not just new work.
- **LLM provider choice + API key** (`LLM_API_URL`/`LLM_API_KEY` in `ENV_TEMPLATE.txt`) — blocks
  §2.2's AI Scan production activation.
- **Resend production domain + key**, **`OWNER_NOTIFY_EMAIL`** — blocks §2.3/§2.2 production activation.
- **Original branding image files** (logo/mark/favicon) or Forge credentials to retrieve them — blocks
  re-uploading them to the new Supabase `branding` bucket; `/manus-storage/*` is correctly still
  serving them via Forge in the meantime, do not remove that path until this is resolved.
- **Supabase dashboard access** — needed to configure Custom SMTP and real OAuth providers if desired.
- **A concrete spec for "AI governance config"** and **the Technical Operator role's exact permission
  boundary** — both named in the Milestone 2 scope but not concretely specified anywhere available to
  this repo; don't invent either.

## Rules to follow (carried over)

- Verify before trusting any status in these docs — re-run typecheck/tests/build yourself first, and
  re-check live-infrastructure reachability specifically (don't assume a working `.env` still points
  at a live project).
- Never fabricate data, test results, or "done" status. Use ✅/🔶/⛔/⏭ honestly.
- Don't remove a working dependency (e.g. the Forge branding proxy, the Manus OAuth path) before its
  replacement is verified working.
- Update `MILESTONE2_PROGRESS.md` after each workstream, same format as the existing sections.
- Report evidence (test counts, exact commands run), not just "it works."
- Commit and push incrementally, one logical change per commit — this session's commits are a good
  reference for granularity.
