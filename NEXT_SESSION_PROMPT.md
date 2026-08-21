# Continuation Prompt — IO SKY Milestone 2

Copy-paste this whole file as your prompt to start the next session.

---

Continue the IO SKY implementation from the current repository state. Do not redo completed work.
First inspect the current implementation and verify the stated status below yourself rather than
trusting it blindly — then continue only the incomplete work.

## Source of truth

- `Milestone 2.md` — the requirements spec (still not present in this repo as of this writing — work
  from `MILESTONE2_PROGRESS.md`'s own description of each workstream's scope instead).
- `MILESTONE2_PROGRESS.md` — live tracking doc, updated after every workstream. Read its "Handoff
  summary" section first, then §2.5's "Not started" section and the `admin.action` dead-button sweep
  section for exact evidence of what's genuinely left.
- `PHASE1_CHECKLIST.md` / `MILESTONE1_SUPABASE_MIGRATION_REPORT.md` — Milestone 1 status.

## What's already done (verify, don't redo)

**All of Milestone 2 §2.1–2.4, §2.6, §2.7 are done. §2.5 is done except two deliberately-deferred
items. The `admin.action` dead-button sweep closed six real stubs; the rest are documented as needing
either new subsystems or third-party integrations.**

- §2.1 Storage Migration, §2.2 Manus Dependency Removal, §2.3 Email Productionisation, §2.4 Core
  Workflow Verification & Conversion — all done, see `MILESTONE2_PROGRESS.md` for detail.
- §2.5 Enterprise Super Admin & Platform Governance — done: Organization Management, Technical
  Operator role (`opsProcedure`, `/ops` console) + Security Center, Business Intelligence dashboards
  (real funnel/top-scans on Analytics & Insights), the platform configuration store (`platform_settings`
  table, real `SystemSettings` editor), MFA compliance visibility (per-role breakdown on Security
  Monitoring), AI governance config (three real settings rows: LLM provider status, AI Scan tiers,
  retention policy record). **Not built** (deliberately, with reasoning recorded in
  `MILESTONE2_PROGRESS.md`): a hard blocking per-role/org MFA gate, real third-party integration
  wiring (Stripe/Twilio/SendGrid credentials) and real notification-template *content* management.
- §2.6 Document Lifecycle, Workflow Engine & Integration Layer — fully done: document
  versioning/approval/rejection/retention on `client_documents`, a bounded workflow-definition engine
  (`workflow_definitions`/`workflow_runs`, closed trigger/action enums), an integration/webhook
  registry (`webhook_registrations`/`webhook_deliveries`, HMAC-signed outbound dispatch).
- §2.7 Notification Infrastructure — fully done: central typed notification write service
  (`server/notifications.ts`), schema extension (priority/channel/templateKey/status on both
  notification tables), mark-as-read/archive mutations, a real Notification Center UI (bell dropdown)
  on both the Client Portal and Developer Workspace headers (previously decorative — real unread
  badge, no click handler at all).
- `admin.action` dead-button sweep — six real fixes (Audit Logs CSV export, Billing "New invoice",
  Clients "Onboard client", CRM "New lead" + "View AI Scan pipeline" navigation, Support Desk "New
  ticket"). The rest (AI Scans "Trigger scan", Users "Invite user", Developer Management "Grant
  access", Security "Run scan", Campaigns "New campaign", Agents "New agent") are documented in
  `MILESTONE2_PROGRESS.md` as needing either a new subsystem or a real third-party integration.

**Verification baseline**: `npx tsc --noEmit` → 0 errors. `npx vitest run` → 525/525 passing, 33
correctly skipped, 0 regressions. `pnpm run build` → succeeds. Run `pnpm install` first if
`node_modules` looks stale after a pull.

## Central blocker — the connected Supabase project is gone

`rhgzcgcqlypuvislwjlf.supabase.co` no longer resolves in DNS at all (`NXDOMAIN`) — confirmed via
`nslookup`, a raw Postgres connection attempt, and a plain `fetch` to the Auth health endpoint, all
failing the same way. This is not a transient outage. **Migrations `0006` through `0015` remain
authored-and-locally-verified only** — nothing has reached a live database since RM-60. If a working
Supabase project connection becomes available: apply all migrations in order, then live-verify RLS
the same way `MILESTONE1_SUPABASE_MIGRATION_REPORT.md` §5a did for the original set.
`server/rls.negative.test.ts` does a real reachability probe before running (not just an env-var
presence check) — if credentials are restored, it will pick this up and run for real automatically;
no code change needed there.

## Exact remaining work, in order

1. **A hard, blocking per-role/org MFA gate** — needs live-session verification before shipping
   (would modify `requireUser`/`protectedProcedure`, the middleware nearly every authenticated
   endpoint is built on). Blocked on the Supabase project being reachable again, not on more design
   work — the visibility half (MFA compliance panel) is already real.
2. **Real third-party integration wiring** — actual Stripe/Twilio/SendGrid/etc. credentials and
   provider-specific code behind the platform configuration store's "Integrations" setting. Needs
   real provider accounts from the client, not buildable speculatively.
3. **Remaining `admin.action` dead buttons** — see `MILESTONE2_PROGRESS.md`'s sweep section for the
   full list and why each was deferred (new subsystem needed: user invite/signup flow, developer
   access-grant flow, AI-scan-trigger entry point; or third-party integration needed: campaigns,
   agents/IVR).
4. Once 1–3 (or whichever the client prioritizes) land: re-run the full exit-gate checklist in
   `Milestone 2.md`'s final section — that file still isn't in this repo as of this writing, get it
   from wherever the spec actually lives, or ask the client for it, before treating "exit gate
   passed" as achievable.

## Blockers — need from the user, not resolvable in code

- **A working Supabase project connection** — see "Central blocker" above. This is now the single
  highest-leverage unblock: it gates live-verifying every migration since `0006`, not just new work,
  and is a prerequisite for safely building the hard MFA gate.
- **LLM provider choice + API key** (`LLM_API_URL`/`LLM_API_KEY` in `ENV_TEMPLATE.txt`) — blocks
  §2.2's AI Scan production activation. Note: the AI governance config's "LLM Provider" setting
  already reads these env vars and will flip to "Configured" automatically once set.
- **Resend production domain + key**, **`OWNER_NOTIFY_EMAIL`** — blocks §2.3/§2.2 production activation.
- **Original branding image files** (logo/mark/favicon) or Forge credentials to retrieve them — blocks
  re-uploading them to the new Supabase `branding` bucket; `/manus-storage/*` is correctly still
  serving them via Forge in the meantime, do not remove that path until this is resolved.
- **Supabase dashboard access** — needed to configure Custom SMTP and real OAuth providers if desired.
- **Real third-party provider accounts** (Stripe/Twilio/SendGrid/etc.) — see "Remaining work" item 2.

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
