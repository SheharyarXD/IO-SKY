# Milestone 3 Implementation Checklist

Live tracking document, same convention as `PHASE1_CHECKLIST.md` (Milestone 1) and
`MILESTONE2_PROGRESS.md` (Milestone 2). Source of truth for scope: `IO_SKY_Three_Milestone_Plan.pdf`,
Milestone 3 ("Notification Events, Deployment, Security & Production Readiness"), §3.1–3.5 plus the
Milestone 3 Exit Gate. Task IDs continue the `RM-` numbering used by Milestone 1/2 documents, starting
at RM-64 (Milestone 1 ran RM-01..RM-63).

Legend: ✅ Done + locally verified · 🔶 Partial · ⛔ Blocked (external access/decision required) · ⏭ Not started

Nothing in this milestone has been started yet — it depends on Milestone 2 being exit-gated first, and
several workstreams are gated on client-supplied material (notification specification documents, hosting
provider decision) that is not yet in this repo. Every row below is ⏭ until that groundwork lands.

---

## Workstream 3.1 — Notification Event Catalog Implementation

**Blocked as a whole on the client's Notification specification documents** — §3.1 cannot start until
these are supplied (called out explicitly in the source plan as the outstanding blocker gating this
section).

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-64 | Obtain client Notification Event Catalog / specification documents | ⛔ | Client deliverable. Gates every other task in this workstream. |
| RM-65 | Map every catalog event to an existing trigger point (extend) or a new one (build) | ⏭ | Depends on RM-64. Builds on the Milestone 2 §2.7 notification write service/schema. |
| RM-66 | Define recipient resolution, priority, channel, template and CTA per event | ⏭ | Depends on RM-64/65. |
| RM-67 | Implement queue retry / dead-lettering | ⏭ | Depends on Milestone 2's delivery-queue foundation. |
| RM-68 | Implement escalation rules | ⏭ | Depends on RM-64 spec. |
| RM-69 | Implement quiet-hours logic | ⏭ | Depends on RM-64 spec. |
| RM-70 | Implement digest cadence and grouping | ⏭ | Depends on RM-64 spec. |
| RM-71 | Idempotency / duplicate-delivery prevention | ⏭ | A retried or duplicate event must produce exactly one delivered notification. |
| RM-72 | Extend existing 10-locale i18n to notification content | ⏭ | Reuses the platform's existing i18n system (`client/src/lib/i18n/*`). |
| RM-73 | Delivery / read-receipt analytics | ⏭ | New tracking, not present yet. |

## Workstream 3.2 — Deployment

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-74 | Client decision: hosting provider | ⛔ | Client deliverable — must support a long-lived Node process. Carried over as unresolved from Milestone 1 §1.3. |
| RM-75 | Stand up production hosting, bind to explicit port | ⏭ | Depends on RM-74. |
| RM-76 | Wire existing health-check endpoint into the host | ⏭ | `server/routers/ops.ts` / health endpoint already exists; needs host-level wiring. |
| RM-77 | Supabase production configuration: connection pooling | ⏭ | Dev/staging already provisioned per Milestone 1 §1.4; production tier config is new. |
| RM-78 | Supabase production configuration: automated backups | ⏭ | |
| RM-79 | Tested backup restore before go-live | ⏭ | Must be exercised, not just configured. |
| RM-80 | Full CI/CD pipeline: build + staging-deploy + approval-gated production deploy | ⏭ | Extends the Milestone 1 `.github/workflows/ci.yml` test-gate (RM-19). |
| RM-81 | Secrets management: move all production secrets into host/CI secret manager | ⏭ | Depends on RM-74 hosting decision. |
| RM-82 | Confirm no secret files ship in any build/deploy artifact | ⏭ | Repeat the RM-16-style scan against the actual build output, not just source. |
| RM-83 | DNS cutover: iosky.nl staging subdomain → production apex, low-TTL rollback window | ⏭ | Depends on RM-74 and the Milestone 1 §1.3 DNS staging work. |

## Workstream 3.3 — Security Hardening & Verification

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-84 | RBAC & tenant-isolation sweep vs. original audit baseline | ⏭ | Re-run/extend `server/rbac.authOrigin.test.ts` and `server/rls.negative.test.ts` against the deployed environment. |
| RM-85 | Negative cross-tenant tests on the deployed environment | ⏭ | The Milestone 1 suite (RM-60) ran against dev/staging; needs re-verification against production config. |
| RM-86 | API hardening: helmet security headers | ⏭ | Not yet present in `server/`. |
| RM-87 | API hardening: explicit CORS policy | ⏭ | |
| RM-88 | API hardening: shared-state rate limiting for multi-instance deployment | ⏭ | Milestone 1's `server/_core/rateLimiter.ts` (RM-21) is in-memory/per-instance; needs a shared backing store if hosting is multi-instance. |
| RM-89 | Session security: confirm Supabase session expiry/refresh is deliberately configured | ⏭ | |
| RM-90 | Session security: confirm logout actually revokes sessions | ⏭ | |
| RM-91 | Review `dangerouslySetInnerHTML` usage | ⏭ | |
| RM-92 | Review cookie `SameSite`/`Secure` attributes against real hosting | ⏭ | Carries over Milestone 1's blocked RM-38, now unblockable once RM-74 lands. |
| RM-93 | zod validation coverage audit across ported procedures | ⏭ | |
| RM-94 | Client decision: audit-log integrity — genuine tamper-evidence vs. corrected UI claim | ⛔ | Client deliverable per the source plan. |
| RM-95 | Implement the RM-94 decision | ⏭ | Depends on RM-94. |

## Workstream 3.4 — Testing & Quality Assurance

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-96 | Port all existing backend test files to run against the Supabase-backed stack in CI | ⏭ | Most already run against Supabase locally per Milestone 1/2; this is about permanent CI wiring. |
| RM-97 | Introduce React Testing Library | ⏭ | Not present in the repo yet. |
| RM-98 | Frontend coverage: auth forms | ⏭ | Depends on RM-97. |
| RM-99 | Frontend coverage: Notification Center | ⏭ | Depends on RM-97 and Milestone 2 §2.7's Notification Center UI. |
| RM-100 | Frontend coverage: every converted admin workflow | ⏭ | Depends on RM-97 and Milestone 2 §2.4's mockup-conversion decisions. |
| RM-101 | Introduce Playwright | ⏭ | Not present in the repo yet. |
| RM-102 | E2E golden path: login | ⏭ | |
| RM-103 | E2E golden path: dashboard | ⏭ | |
| RM-104 | E2E golden path: document upload | ⏭ | |
| RM-105 | E2E golden path: messaging | ⏭ | |
| RM-106 | E2E golden path: booking (per portal) | ⏭ | |
| RM-107 | Formalize Milestone 1 negative-test patterns into a permanent CI-run auth/RBAC/tenant suite | ⏭ | Builds on `rbac.authOrigin.test.ts` / `rls.negative.test.ts`. |
| RM-108 | DB suite: FK/RLS/trigger enforcement | ⏭ | |
| RM-109 | Workflow-specific suite per converted mockup (Payments, CRM, Role Management, etc.) | ⏭ | Depends on which mockups Milestone 2 §2.4 actually converted. |

## Workstream 3.5 — Performance & Final Verification

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-110 | Load-test highest-traffic procedures | ⏭ | |
| RM-111 | Confirm Milestone 1's indexes are actually used under realistic queries | ⏭ | `EXPLAIN ANALYZE` against the 126 indexes from RM-45. |
| RM-112 | Validate notification queue throughput against spec volume/SLA | ⏭ | Depends on RM-64/65 catalog being implemented. |
| RM-113 | Verify booking-slot concurrency under load | ⏭ | |
| RM-114 | Verify large-file upload performance | ⏭ | |
| RM-115 | Comprehensive functional walkthrough: every route, role, button, workflow, API, integration | ⏭ | Single consolidated pre-launch checklist. |
| RM-116 | Go-live: public release | ⏭ | Depends on RM-83 DNS cutover. |
| RM-117 | Monitored 48-hour stability window | ⏭ | |
| RM-118 | Documented rollback plan | ⏭ | |
| RM-119 | Formal decommissioning of legacy TiDB/Manus infrastructure | ⏭ | Only after the 48-hour window and explicit sign-off — the old TiDB database is the Milestone 1 exit-gate fallback and must stay untouched until this point. |

---

## Milestone 3 Exit Gate (from the source plan — verify all before sign-off)

- [ ] Every item in the original audit's security-risk section is resolved.
- [ ] `grep` for Manus references outside historical docs is clean.
- [ ] CI is green and enforced on every merge.
- [ ] RLS is verified on every tenant-scoped table.
- [ ] MFA cannot be bypassed on any login path.
- [ ] The Notification Event Catalog is implemented and matches its specification.
- [ ] iosky.nl serves production traffic on client-owned infrastructure with valid SSL.
- [ ] The platform is stable for 48 hours post-launch before legacy TiDB/Manus infrastructure is
      formally decommissioned.

## Outstanding client decisions/blockers gating this milestone

- Hosting provider (RM-74) — carried over unresolved from Milestone 1 §1.3.
- Notification specification documents (RM-64) — gates all of §3.1.
- Audit-log integrity approach (RM-94) — genuine tamper-evidence vs. corrected UI claim.
- Any Milestone 1/2 decisions still open at the time Milestone 3 starts (Super Admin RM-57 live-migration
  status, CRM/Role-Management scope) should be re-confirmed closed before this milestone's exit gate is
  attempted, since several §3.3/§3.4 items re-verify them under load/production conditions rather than
  introduce new decisions.

---

## Client decisions resolved 2026-08-28 (affects Milestone 2 §2.2/§2.3/§2.4 primarily, verified here)

The client supplied three provider decisions plus new requirements. Dashboard **login** credentials
(not yet real API keys) were saved to the local, gitignored-then-committed `.env` — see that file's
"THIRD-PARTY PROVIDER ACCOUNTS" section for the TODO env vars a future session must populate after
generating real API/secret keys from each dashboard.

- **Payments provider: Stripe.** Resolves Milestone 2 §2.4's "Admin mockup conversion — real payments
  (provider TBD)" item. New requirements on top of basic Stripe integration:
  - VAT identification-number validation and VAT calculation for both EU and international customers.
  - Customer VAT ID and IO SKY's own VAT ID both shown on every invoice.
  - All VAT-related data stored securely and made searchable within the system.
  - Invoice template must reflect full corporate identity (logo, brand colors/fonts, both parties' company
    + VAT details, all legally required invoice fields), be customizable, support manual invoice creation
    (not just system-triggered), and every generated invoice must be stored and searchable in-system.
- **Email provider: Zoho.** Resolves/supersedes Milestone 2 §2.3's Resend-only plan — Resend may still be
  used for transactional/auth email, but Zoho is now the primary provider decision. New requirements:
  - Integration with both Outlook and Gmail for sending/using email through the system.
  - Manual creation, management, and use of custom email templates within the system.
- **AI provider: OpenAI.** Resolves Milestone 2 §2.2's "LLM proxy" item (replaces the Manus/Forge proxy).
  New requirement: intelligent model routing — simple tasks → a cheaper/faster model, medium-complexity
  tasks → a more capable model, complex/high-reasoning tasks → the most capable model — optimized for
  cost and performance, not a single fixed model for every AI Scan/AI-governance call.
- **Open question, not yet answered by the client**: how the professional translation review process
  will work — specifically how the system verifies and records that a given translation (of the existing
  10-locale i18n content, and now of notification content per RM-72) has been professionally reviewed and
  approved. Needs a client answer before it can be scoped into either Milestone 2 (i18n) or Milestone 3
  (RM-72) work.

New tasks these decisions add to the backlog (not yet numbered into the RM- sequence above since they
land primarily in Milestone 2's scope, not Milestone 3's — tracked here for visibility until
`MILESTONE2_PROGRESS.md` is updated to reflect them):

- Stripe integration: checkout/payment-intent flow, webhook handling, VAT validation (e.g. VIES lookup for
  EU VAT numbers), VAT calculation logic, VAT data storage/search.
- Branded, customizable invoice template (PDF generation) wired to Stripe payment data, manual invoice
  creation path, invoice storage/search.
- Zoho Mail integration alongside/replacing Resend; Outlook/Gmail integration; manual email-template
  CRUD UI.
- OpenAI integration replacing the Forge LLM proxy; model-routing logic (task-complexity classifier →
  model tier selection).
- Translation review/approval workflow — pending client clarification.

---

## Summary

**0 of 56 tasks (RM-64..RM-119) started.** This document is scaffolding only, generated directly from
the Milestone 3 section of `IO_SKY_Three_Milestone_Plan.pdf` so that future sessions have the same
per-task tracking structure Milestone 1 (`PHASE1_CHECKLIST.md`) and Milestone 2
(`MILESTONE2_PROGRESS.md`) already use. Update statuses and add Evidence/Notes as work actually
happens — do not mark anything ✅ without the same live-verification bar (`tsc`, tests, and where
applicable a real running check) used in the other two documents.
