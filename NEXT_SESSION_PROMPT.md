# Continuation Prompt — IO SKY Milestone 2

Copy-paste this whole file as your prompt to start the next session.

---

Continue the IO SKY implementation from the current repository state. Do not redo completed work.
First inspect the current implementation and verify the stated status below yourself rather than
trusting it blindly — then continue only the incomplete work.

## Source of truth

- `Milestone 2.md` — the requirements spec (still not present in this repo as of this writing — work
  from `MILESTONE2_PROGRESS.md`'s own description of each workstream's scope instead).
- `MILESTONE2_PROGRESS.md` — live tracking doc, updated after every workstream. Read its top "Handoff
  summary" section first (dated 2026-08-23, supersedes earlier entries), then the `admin.action`
  dead-button sweep section for exact evidence of what's genuinely left.
- `PHASE1_CHECKLIST.md` / `MILESTONE1_SUPABASE_MIGRATION_REPORT.md` — Milestone 1 status.

## What's already done (verify, don't redo)

**All of Milestone 2 §2.1–2.7 are done, including the hard MFA gate that was previously deferred.
The central Supabase-project blocker is resolved and every migration through `0015` is live-verified.
The `admin.action` dead-button sweep has closed eight real stubs; one (Invite user) needs new schema
+ a live browser-tested auth-provisioning change and is tracked separately; the rest need third-party
provider accounts the client doesn't have yet.**

- §2.1 Storage Migration, §2.2 Manus Dependency Removal, §2.3 Email Productionisation, §2.4 Core
  Workflow Verification & Conversion — all done, see `MILESTONE2_PROGRESS.md` for detail.
- §2.5 Enterprise Super Admin & Platform Governance — **fully done as of 2026-08-23**: Organization
  Management, Technical Operator role (`opsProcedure`, `/ops` console) + Security Center, Business
  Intelligence dashboards, the platform configuration store, MFA compliance visibility, AI governance
  config, **and the hard, blocking per-role MFA gate** (admin/super_admin/technical_operator now
  require a verified `mfa_factors` row via `adminProcedure`/`superAdminProcedure`/`opsProcedure`,
  live-verified end-to-end against the real Supabase project). Only real third-party
  integration/notification-template *content* management remains open — needs actual provider
  accounts, not buildable speculatively.
- §2.6 Document Lifecycle, Workflow Engine & Integration Layer — fully done.
- §2.7 Notification Infrastructure — fully done.
- `admin.action` dead-button sweep — **eight real fixes**: Audit Logs CSV export, Billing "New
  invoice", Clients "Onboard client", CRM "New lead" + "View AI Scan pipeline" navigation, Support
  Desk "New ticket", Developer Management "Grant access" (`admin.grantDeveloperAccess`, reuses the
  existing `developer_access_scopes` table), AI Scans "Trigger scan" (reframed as
  `admin.retriggerAiScan` — a real retry of a scan's own stored questionnaire answers, not a
  fabricated fresh scan with no answers). Only Users & Permissions "Invite user" remains genuinely
  deferred (see below); Security "Run scan" / Campaigns "New campaign" / Agents "New agent" need
  third-party provider accounts the client confirmed they don't have yet.

**Verification baseline**: `npx tsc --noEmit` → 0 errors. `npx vitest run` → 569/584 passing, 15
correctly skipped, 0 regressions. `pnpm run build` → succeeds. Run `pnpm install` first if
`node_modules` looks stale after a pull.

## Central blocker — RESOLVED 2026-08-23

The Supabase project (`rhgzcgcqlypuvislwjlf.supabase.co`) is reachable again and the client provided
working credentials. **All migrations through `0015` are applied and live-verified** — see
`MILESTONE2_PROGRESS.md`'s 2026-08-23 handoff summary for the full story, including a real
migration-tracking-table bookkeeping bug that was found and fixed along the way (3 phantom rows
claiming `0006`-`0008` were applied when they hadn't actually run — corrected by matching
`created_at` against the migration journal, not by row id). `server/rls.negative.test.ts`'s 18 tests
now run for real on every test invocation and pass. **Do not assume this connection is still live in
a future session** — re-verify with `nslookup`/a raw Postgres connection/an Auth-health fetch before
trusting it, per the standing rule below; Supabase projects on free tiers can pause after inactivity.

## Exact remaining work, in order

1. **Users & Permissions "Invite user"** — needs a new `user_invites`-shaped table, a signed-token
   email flow, an acceptance page, and — the genuinely sensitive part — wiring into the shared
   Supabase Auth user-provisioning path (`server/_core/oauth.ts`/`supabaseAuthRoute.ts`) so a
   freshly-signed-up account picks up the invited role/org. That provisioning path is shared by every
   login on the platform; verify with a real browser-based signup click-through before shipping (no
   browser tool in this environment as of this writing) — same caution class that gated the MFA gate
   until live-session verification was possible.
2. **Real third-party integration wiring** — actual Stripe/Twilio/SendGrid/etc. credentials and
   provider-specific code behind the platform configuration store's "Integrations" setting, plus
   Security Monitoring "Run scan" / Campaigns "New campaign" / Agents "New agent". Needs real
   provider accounts from the client — confirmed 2026-08-23 they don't have any yet.
3. **LLM provider + Resend production domain** — still needed for §2.2/§2.3 production activation
   (AI Scan scoring, transactional email). See "Blockers" below.
4. Once the above (or whichever the client prioritizes) land: re-run the full exit-gate checklist in
   `Milestone 2.md`'s final section — that file still isn't in this repo as of this writing, get it
   from wherever the spec actually lives, or ask the client for it, before treating "exit gate
   passed" as achievable.

## Blockers — need from the user, not resolvable in code

- **LLM provider choice + API key** (`LLM_API_URL`/`LLM_API_KEY` in `ENV_TEMPLATE.txt`) — blocks
  §2.2's AI Scan production activation. Note: the AI governance config's "LLM Provider" setting
  already reads these env vars and will flip to "Configured" automatically once set.
- **Resend production domain + key**, **`OWNER_NOTIFY_EMAIL`** — blocks §2.3/§2.2 production activation.
- **Original branding image files** (logo/mark/favicon) or Forge credentials to retrieve them — blocks
  re-uploading them to the new Supabase `branding` bucket (which now exists live); `/manus-storage/*`
  is correctly still serving them via Forge in the meantime, do not remove that path until this is
  resolved.
- **Supabase dashboard access** — needed to configure Custom SMTP and real OAuth providers if desired.
- **Real third-party provider accounts** (Stripe/Twilio/SendGrid/etc.) — see "Remaining work" item 2.

## Rules to follow (carried over)

- Verify before trusting any status in these docs — re-run typecheck/tests/build yourself first, and
  re-check live-infrastructure reachability specifically (don't assume a working `.env` still points
  at a live project — it stopped resolving once already this milestone).
- Never fabricate data, test results, or "done" status. Use ✅/🔶/⛔/⏭ honestly.
- Don't remove a working dependency (e.g. the Forge branding proxy, the Manus OAuth path) before its
  replacement is verified working.
- Before touching any live-database bookkeeping table (migration tracking, etc.), verify your
  assumption about row-to-migration mapping against actual timestamps/content — don't assume row id
  order matches migration order (it doesn't, due to this table's own history).
- Update `MILESTONE2_PROGRESS.md` after each workstream, same format as the existing sections.
- Report evidence (test counts, exact commands run), not just "it works."
- Commit and push incrementally, one logical change per commit — this session's commits are a good
  reference for granularity. Match the repo's existing commit-author conventions.
