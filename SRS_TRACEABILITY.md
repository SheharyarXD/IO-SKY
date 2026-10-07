> **SUPERSEDED. Do not use or share the figures below.** The per module counts in this file were estimates made by probing the code. `SRS_CHECKLIST.md` replaces it and was checked criterion by criterion: **45 of 155 complete (29.0%)**, not the 75 (48.4%) stated here. The structural findings in this file (fabricated data, the two SRS contradictions, the three external blockers) still stand.

# SRS Traceability Matrix — Master SRS v1.1 against the built platform

Assessed 7 October 2026 against commit `0a4ec56`.

## What is being counted

The SRS does not number its requirements, so there is no requirement ID to count.
What it *does* give, per module, is an **Acceptance Criteria** section that states
when that module "shall be considered complete". Those criteria are the countable
unit used here: **155 criteria across the 20 modules**.

Each criterion is assessed against code that exists in this repository, not against
intent. A criterion is only Complete when the behaviour is built, reachable from the
UI, and covered by the test suite.

| Status | Meaning |
| --- | --- |
| Complete | Built, reachable, and verified |
| Partial | Substantially built but missing a stated part of the criterion |
| Not started | No implementation exists |
| Blocked | Code written or writable, but held by an external dependency |

---

## Headline numbers

| Status | Criteria | Share |
| --- | ---: | ---: |
| **Complete** | **75** | **48.4%** |
| Partial | 41 | 26.5% |
| Not started | 31 | 20.0% |
| Blocked (external) | 8 | 5.2% |
| **Total** | **155** | **100%** |

Counting a Partial as half, the platform sits at roughly **62% of the SRS**.

The 8 Blocked criteria are not engineering work. They are:

- **5** waiting on the Supabase project API key, revoked after the credential leak
  and not reissued. Everything touching file storage, document upload and avatars
  is written but cannot run in production.
- **3** waiting on a payment processor credential, which exists in no environment.
  `server/routers/clientPortal.ts:374` already carries the manual-payment fallback
  and the comment explaining why.

---

## Per-module breakdown

| # | Module | Criteria | Complete | Partial | Not started | Blocked |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Public Website & Lead Experience | 9 | 8 | 0 | 0 | 1 |
| 2 | Identity & Authentication | 9 | 9 | 0 | 0 | 0 |
| 3 | AI Scan Platform | 9 | 3 | 3 | 2 | 1 |
| 4 | Client Portal | 10 | 8 | 1 | 0 | 1 |
| 5 | Developer Portal | 8 | 5 | 1 | 1 | 1 |
| 6 | Admin Portal | 10 | 5 | 3 | 2 | 0 |
| 7 | Super Admin Portal | 10 | 6 | 3 | 1 | 0 |
| 8 | CRM & Sales Management | 8 | 3 | 1 | 4 | 0 |
| 9 | Project & Delivery Management | 8 | 3 | 2 | 2 | 1 |
| 10 | Commercial Billing & Subscription | 7 | 2 | 1 | 2 | 2 |
| 11 | Notifications & Communication | 7 | 1 | 2 | 4 | 0 |
| 12 | File & Document Management | 7 | 4 | 2 | 0 | 1 |
| 13 | AI Intelligence Layer | 7 | 0 | 2 | 5 | 0 |
| 14 | Audit, Compliance & Security | 7 | 4 | 3 | 0 | 0 |
| 15 | Analytics & Business Intelligence | 7 | 2 | 4 | 1 | 0 |
| 16 | Integration & API Management | 7 | 3 | 3 | 1 | 0 |
| 17 | Workflow & Business Process | 7 | 4 | 2 | 1 | 0 |
| 18 | Platform Configuration | 6 | 1 | 2 | 3 | 0 |
| 19 | Platform Operations & Maintenance | 6 | 2 | 2 | 2 | 0 |
| 20 | Global Non-Functional Requirements | 6 | 2 | 4 | 0 | 0 |
| | **Total** | **155** | **75** | **41** | **31** | **8** |

---

## Modules that are effectively finished

**Module 2, Identity & Authentication — 9 of 9.** The only module with no gap.
Authentication, RBAC, MFA (`server/routers/mfa.ts`, 10 procedures), session expiry
and revocation, automatic portal routing, and the full authentication audit trail
are built and tested. The negative cross-tenant Row Level Security suite proves one
organisation cannot read another's rows.

**Module 1, Public Website — 8 of 9.** Every page, form, CRM write and legal
document works. The single gap is AI Scan purchase, blocked on payments.

**Module 4, Client Portal — 8 of 10.** Twelve working sections. Document download is
blocked on the storage key; notification delivery is partial.

**Module 12, File & Document Management — 4 of 7.** Versioning, approval workflow and
permission enforcement are built. Upload and download are blocked on the same key.

---

## Modules with the furthest to go

**Module 13, AI Intelligence Layer — 0 of 7 complete.** The provider-neutral language
model integration is wired, so AI calls work, but the governed layer the SRS specifies
does not exist: no agent registry, no capability and permission matrix, no centralised
prompt management, no AI audit history, no human-escalation workflow. This is the
single largest body of unbuilt work and most of it is Phase 4 scope.

**Module 11, Notifications & Communication — 1 of 7 complete.** All 84 events are now
encoded and tested in `shared/notificationCatalogue.ts`, but that is data. There is no
routing engine, no template system (held by OPD-001), no preference handling, and no
guaranteed-delivery path for security notifications.

**Module 8, CRM & Sales Management — 3 of 8 complete.** Leads and Discovery Calls are
real and working. Opportunities, proposals, follow-up activities and the Won-to-project
handover have no tables and no code.

**Module 10, Billing — 2 of 7 complete.** Invoices exist and are visible to clients.
Quotations and subscriptions are unbuilt; payment processing is blocked.

---

## Things the SRS requires that are currently faked

Worth fixing before anyone demonstrates the Admin Portal:

- `server/routers/admin.ts:1157` returns a hardcoded AI agent roster, including an
  "Inbound IVR" agent with invented figures (7 active calls, 4.7 CSAT, 1 escalation).
  No IVR exists. These numbers are fabricated and will be read as live operations.
- `server/db/platformSettings.ts:30` reports integrations with Stripe, Twilio,
  SendGrid, Postmark, OpenAI, Google Maps and Manus as "Connected". Most are not.
- Roughly 22 controls across the admin and client dashboards still have no click
  handler, concentrated in `ExecutiveOverview.tsx` and `ClientDashboard.tsx`.

---

## Two contradictions inside the SRS itself

These need a Product Owner decision, not a developer guess:

1. **§15.16 requires "Predictive project forecasting using AI"** as an automation
   requirement, while **§21.15 excludes "Predictive analytics using machine learning"**
   from Version 1. The same capability is both required and out of scope.

2. **§26.16 defers the lawful basis, consent management, data subject request handling,
   retention schedules and breach notification procedures to a "Security & Compliance
   Specification"** which it names as authoritative. That document has never been
   supplied. Module 20 cannot be closed without it.

Appendix D also still lists **OPD-001** (notification template structure) and
**OPD-003** (document governance matrix) as open, and the SRS's own Approval Status
remains PENDING.

---

## Verification standard behind these numbers

As at this assessment:

- `tsc --noEmit` clean
- 801 tests passing, 0 failures, 73 passing test files
- Production build compiles, client and server
- Artifact secret scan passes across 395 files
- Deployed on Railway, container in Amsterdam, database in Ireland

One test file cannot run: the live Supabase negative suite needs the revoked project
API key. That is the same blocker as the 5 storage criteria above.
