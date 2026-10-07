# SRS Checklist: Master SRS v1.1 against the built platform

Tracking document, same convention as `PHASE1_CHECKLIST.md`, `MILESTONE2_PROGRESS.md` and `MILESTONE3_CHECKLIST.md`.

**Unit of count:** the 155 acceptance criteria the SRS states per module (sections 7.13 to 26.18). The SRS has no numbered requirement IDs, so these are the only countable completion statements it contains.

Legend: ✅ Done and verified · 🔶 Partial · ⛔ Blocked (external credential or decision) · ⏭ Not started

**Method:** each status was set by inspecting the code (routers, schema, UI, migrations) and probing for specific capabilities. Nothing here was established by clicking through the running UI, so a Done means *built and reachable in code*, not *signed off by a tester*. A criterion is only Done when the whole sentence is true, which is why several that look nearly finished are Partial.

This replaces the per module counts in `SRS_TRACEABILITY.md`, which were estimates. This file was checked item by item and the totals below are computed.

---

## Status: 79 of 155 criteria complete (51.0%)

| Status | Criteria | Share |
| --- | ---: | ---: |
| ✅ Done | 79 | 51.0% |
| 🔶 Partial | 62 | 40.0% |
| ⏭ Not started | 5 | 3.2% |
| ⛔ Blocked | 9 | 5.8% |
| **Total** | **155** | **100%** |

Counting a Partial as half: **71.0%**.

## Per module

| # | Module | SRS | Criteria | ✅ | 🔶 | ⏭ | ⛔ |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Public Website & Lead Experience | §7.13 | 9 | 6 | 2 | 0 | 1 |
| 2 | Identity & Authentication | §8.16 | 9 | 8 | 1 | 0 | 0 |
| 3 | AI Scan Platform | §9.11 | 9 | 1 | 6 | 0 | 2 |
| 4 | Client Portal | §10.17 | 10 | 6 | 3 | 0 | 1 |
| 5 | Developer Portal | §11.15 | 8 | 5 | 2 | 0 | 1 |
| 6 | Admin Portal | §12.17 | 10 | 6 | 4 | 0 | 0 |
| 7 | Super Admin Portal | §13.18 | 10 | 7 | 3 | 0 | 0 |
| 8 | CRM & Sales Management | §14.15 | 8 | 7 | 1 | 0 | 0 |
| 9 | Project & Delivery Management | §15.18 | 8 | 3 | 4 | 0 | 1 |
| 10 | Commercial Billing & Subscription | §16.15 | 7 | 5 | 0 | 0 | 2 |
| 11 | Notifications & Communication | §17.13 | 7 | 2 | 4 | 1 | 0 |
| 12 | File & Document Management | §18.14 | 7 | 3 | 3 | 0 | 1 |
| 13 | AI Intelligence Layer | §19.14 | 7 | 0 | 7 | 0 | 0 |
| 14 | Audit, Compliance & Security Monitoring | §20.14 | 7 | 4 | 2 | 1 | 0 |
| 15 | Analytics & Business Intelligence | §21.14 | 7 | 2 | 5 | 0 | 0 |
| 16 | Integration & API Management | §22.13 | 7 | 5 | 1 | 1 | 0 |
| 17 | Workflow & Business Process Management | §23.15 | 7 | 3 | 3 | 1 | 0 |
| 18 | Platform Configuration & System Administration | §24.15 | 6 | 3 | 2 | 1 | 0 |
| 19 | Platform Operations & Maintenance | §25.14 | 6 | 2 | 4 | 0 | 0 |
| 20 | Global Non-Functional Requirements | §26.18 | 6 | 1 | 5 | 0 | 0 |
| | **Total** | | **155** | **79** | **62** | **5** | **9** |

---

## Module 1: Public Website & Lead Experience (§7.13)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-01.1 | All public pages are accessible | ✅ | Home, Intelligence, Solutions, AI Scan, Custom Software, About, Contact, Book, Login, Legal all routed |
| SRS-01.2 | Navigation behaves consistently | 🔶 | Client has not yet supplied the navigation specification; redesign pending |
| SRS-01.3 | All forms validate correctly | ✅ | Zod validation server side; phone and industry fixes shipped |
| SRS-01.4 | CRM records are created successfully | ✅ | leads and contactSubmissions written on submit |
| SRS-01.5 | Notifications are generated correctly | ✅ | Every owner alert now also writes an admin in-app notification (admin_notifications, header bell). Needs migration 0023 applied. |
| SRS-01.6 | Login redirects users to the correct portal | ✅ | Role based routing, E2E covered |
| SRS-01.7 | AI Scan purchases initiate the onboarding workflow | ⛔ | No payment processor credential. Fallback in clientPortal.ts:374 |
| SRS-01.8 | The website is fully responsive | 🔶 | Redesign in flight; not verified at every breakpoint |
| SRS-01.9 | Legal pages are accessible | ✅ | legalDocuments, agreementVersions, cookie consent |

## Module 2: Identity & Authentication (§8.16)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-02.1 | Only authorized users can access protected resources | ✅ | Role guards plus Row Level Security, negative cross tenant suite |
| SRS-02.2 | Public registration is disabled | ✅ | Invitation and purchase only |
| SRS-02.3 | Account activation functions correctly | 🔶 | Pieces exist; the full 8.7 sequence is not verified as one path |
| SRS-02.4 | Password recovery operates securely | ✅ | ResetPassword flow |
| SRS-02.5 | MFA functions as specified | ✅ | mfa.ts, 10 procedures, recovery codes, lockout race fixed |
| SRS-02.6 | Session management is operational | ✅ | List, revoke, sign out everywhere (sessionsRevokedAtMs) |
| SRS-02.7 | Users are automatically routed to the correct portal | ✅ | BR-003 |
| SRS-02.8 | Authentication events are recorded in the audit log | ✅ | loginAudit |
| SRS-02.9 | Unauthorized access attempts are denied and logged | ✅ | auditDenials wraps every privileged procedure and logs FORBIDDEN as a blocked row. UNAUTHORIZED is deliberately not logged (expired tabs would flood an append only table). |

## Module 3: AI Scan Platform (§9.11)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-03.1 | Customers can successfully purchase an AI Scan | ⛔ | No payment processor credential |
| SRS-03.2 | Accounts are created and activated correctly | 🔶 | Lead is created; account creation on purchase is not wired |
| SRS-03.3 | Questionnaires can be completed and resumed | 🔶 | Completion works; no draft save and resume |
| SRS-03.4 | AI analysis is generated successfully | ⛔ | Code complete, no LLM key configured |
| SRS-03.5 | Expert review is mandatory before publication | 🔶 | Promote step exists; the 9.6 nine status model is not |
| SRS-03.6 | Reports are published only after approval | 🔶 | As above |
| SRS-03.7 | Published reports are accessible through the Client Portal | ✅ | Client reports section |
| SRS-03.8 | All workflow stages are recorded in the audit log | 🔶 | Some stages only |
| SRS-03.9 | Notifications are delivered at each defined milestone | 🔶 | Not every milestone emits |

## Module 4: Client Portal (§10.17)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-04.1 | Clients are redirected to the portal after authentication | ✅ |  |
| SRS-04.2 | Dashboards display only authorized information | ✅ | RLS plus org scoping |
| SRS-04.3 | Published reports are accessible | ✅ |  |
| SRS-04.4 | AI Scan progress is visible | 🔶 | Section exists; not the 9.6 status model |
| SRS-04.5 | Project information is displayed correctly | ✅ |  |
| SRS-04.6 | Documents can be downloaded securely | ⛔ | Supabase API key revoked, not reissued |
| SRS-04.7 | Invoices are available | ✅ |  |
| SRS-04.8 | Messaging functions correctly | ✅ | Send, read receipts, history; E2E covered |
| SRS-04.9 | Notifications are delivered successfully | 🔶 | Bell works; catalogue routing not built |
| SRS-04.10 | All activities are recorded in the audit log where required | 🔶 |  |

## Module 5: Developer Portal (§11.15)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-05.1 | Developers are redirected to the Developer Portal after authentication | ✅ |  |
| SRS-05.2 | Only assigned projects are visible | ✅ | Read side enforced |
| SRS-05.3 | Task management functions correctly | 🔶 | Status only. No progress notes, comments, or clarification requests |
| SRS-05.4 | Deliverables can be uploaded securely | ⛔ | Storage key |
| SRS-05.5 | Time registration operates correctly | ✅ | Developer Time page, assignment checked in the insert transaction, 31 day backdate limit, admin review with reason on reject. Needs migration 0023 applied. |
| SRS-05.6 | Internal messaging functions as specified | ✅ | Admin Delivery screen sends to a developer; developer is notified. |
| SRS-05.7 | Notifications are delivered successfully | 🔶 |  |
| SRS-05.8 | All business critical actions are recorded in the audit log | ✅ | developerAudit |

## Module 6: Admin Portal (§12.17)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-06.1 | Admins are redirected to the Admin Portal after authentication | ✅ |  |
| SRS-06.2 | Customer management functions correctly | ✅ | createOrganization, updateOrganization, clients |
| SRS-06.3 | AI Scans can be reviewed | 🔶 | List and retrigger only. No assign, request info, or return for correction |
| SRS-06.4 | Reports require explicit approval before publication | 🔶 | Approval not a first class state |
| SRS-06.5 | Projects can be managed successfully | ✅ | create, update, milestones |
| SRS-06.6 | Developers can be assigned to projects | ✅ | Delivery screen: create project (privacy safe name), assign, end, tasks, notify, audit. Idempotent, active developers only. |
| SRS-06.7 | Billing information is available | ✅ | billing, createInvoice |
| SRS-06.8 | Operational dashboards display accurate information | 🔶 | Campaigns and Agents are labelled sample data |
| SRS-06.9 | Notifications function correctly | ✅ | Admin bell, unread count, mark read; fed by owner alerts, alert rules, won deals, incidents, customer approvals. Needs migration 0023 applied. |
| SRS-06.10 | All required audit events are recorded | 🔶 |  |

## Module 7: Super Admin Portal (§13.18)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-07.1 | Super Admins can manage organizations | ✅ |  |
| SRS-07.2 | Users and permissions can be managed securely | ✅ | setUserRole, assignUserOrganization |
| SRS-07.3 | Technical Operator permissions are configurable | 🔶 | Role exists; no per operator or temporary permissions |
| SRS-07.4 | AI configuration is versioned and auditable | ✅ | Agent registry, versioned prompts (never edited in place), append only execution history, configuration history. Needs migration 0023 applied. |
| SRS-07.5 | Security monitoring functions correctly | ✅ | AdminSecurityCenter is live |
| SRS-07.6 | Audit logs are searchable | ✅ | Audit search by text, outcome and date, paged, CSV export with formula defusing; the export is itself audited. |
| SRS-07.7 | Platform configuration changes are validated | ✅ | admin.updateSetting validates (ranges, on/off, derived values locked) and records every attempt in config_history. No second approver step. Needs migration 0023 applied. |
| SRS-07.8 | Integration settings can be managed | 🔶 | Webhooks yes; provider management no |
| SRS-07.9 | Executive dashboards display accurate information | 🔶 | Partly seeded |
| SRS-07.10 | All platform wide actions are recorded in the audit log | ✅ | recordAdminEvent |

## Module 8: CRM & Sales Management (§14.15)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-08.1 | Leads can be created and managed | ✅ |  |
| SRS-08.2 | Discovery Calls can be scheduled and tracked | 🔶 | Cancel, no show, reminders. No outcomes, notes, or follow ups |
| SRS-08.3 | Opportunities progress through the defined lifecycle | ✅ | crm_opportunities with forward only stages, won or lost terminal, row locked transitions. Needs migration 0023 applied. |
| SRS-08.4 | Proposals are managed successfully | ✅ | crm_proposals draft to sent to accepted, rejected or expired. Needs migration 0023 applied. |
| SRS-08.5 | Customer timelines display complete histories | ✅ | customerTimeline merges lead, activities, opportunities and proposals. Needs migration 0023 applied. |
| SRS-08.6 | Activities and follow ups function correctly | ✅ | Calls, emails, meetings, notes and follow ups with due dates and completion. Needs migration 0023 applied. |
| SRS-08.7 | Won opportunities create project handovers | ✅ | Winning creates the client project in the same transaction; needs an organization. Needs migration 0023 applied. |
| SRS-08.8 | All commercial activities are recorded in the audit log | ✅ | Every opportunity, proposal, activity, quotation and subscription mutation writes recordAdminEvent. |

## Module 9: Project & Delivery Management (§15.18)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-09.1 | Projects can be created and managed successfully | ✅ |  |
| SRS-09.2 | Tasks, milestones, and deliverables function as specified | 🔶 | Admin task create and assign now built. Deliverable upload blocked by the storage key. |
| SRS-09.3 | Customer approvals operate correctly | ✅ | Admin requests, client approves or sends back from the portal, tenant scoped, notifies admin (BR-019). Needs migration 0023 applied. |
| SRS-09.4 | Project documentation is securely managed | ⛔ | Storage key |
| SRS-09.5 | Automated workflows execute correctly | 🔶 | Engine exists; no project automations wired |
| SRS-09.6 | Notifications are delivered successfully | 🔶 |  |
| SRS-09.7 | Audit events are recorded for all business critical actions | 🔶 |  |
| SRS-09.8 | Completed projects are archived according to platform policies | ✅ | Only completed projects with no pending approvals; archived projects leave active views, never deleted. Needs migration 0023 applied. |

## Module 10: Commercial Billing & Subscription (§16.15)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-10.1 | Quotations can be created and managed | ✅ | Integer cent totals, lifecycle, public reference. Needs migration 0023 applied. |
| SRS-10.2 | Invoices are generated correctly | ✅ | createInvoice |
| SRS-10.3 | Payments are processed successfully | ⛔ | No processor credential |
| SRS-10.4 | Payment confirmation activates the appropriate workflows | ⛔ | As above |
| SRS-10.5 | Subscription management functions correctly | ✅ | Create, pause, reactivate, cancel (final); MRR in the financial summary. Needs migration 0023 applied. |
| SRS-10.6 | Financial reports display accurate information | ✅ | Outstanding, overdue, paid 30 and 90 days, MRR, computed from invoices and subscriptions. |
| SRS-10.7 | Audit records are created for all financial events | ✅ | Invoices, quotations, subscriptions all audited. |

## Module 11: Notifications & Communication (§17.13)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-11.1 | Notifications are generated for all defined business events | 🔶 | 84 event catalogue encoded; emitters partial |
| SRS-11.2 | Email and in-app notifications are delivered successfully | 🔶 | Email works; in-app for client and developer only |
| SRS-11.3 | User notification preferences are respected | 🔶 | Per user, per category, per channel; honoured for email and developer in-app. The client in-app feed is shared by the organization, so it is not filtered. Needs migration 0023 applied. |
| SRS-11.4 | Communication history is maintained | 🔶 | emailDeliveryLog only |
| SRS-11.5 | Notification templates function correctly | ⏭ | Held by open decision OPD-001 |
| SRS-11.6 | Delivery failures are recorded | ✅ | emailDeliveryFailures |
| SRS-11.7 | Security notifications are always delivered according to platform policy | ✅ | shouldDeliver ignores any opt out for the security category; the preference screen shows it locked. |

## Module 12: File & Document Management (§18.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-12.1 | Documents can be uploaded and downloaded securely | ⛔ | Storage key |
| SRS-12.2 | Version history operates correctly | ✅ | listDocumentVersions |
| SRS-12.3 | Permissions are enforced correctly | 🔶 | Org isolation yes; role level matrix no |
| SRS-12.4 | Approval workflows function as specified | ✅ | reviewDocument |
| SRS-12.5 | Search returns authorized results only | ✅ | Client search is scoped to the caller's organization by the server; admin search is admin only; wildcards escaped. |
| SRS-12.6 | Automated document workflows execute successfully | 🔶 | Retention only |
| SRS-12.7 | Audit records are created for all business critical document actions | 🔶 |  |

## Module 13: AI Intelligence Layer (§19.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-13.1 | AI Agents operate according to assigned permissions | 🔶 | Registry and permission gate built and tested, refusals recorded. No live agent is routed through it yet. Needs migration 0023 applied. |
| SRS-13.2 | AI workflows execute successfully | 🔶 | Scan analysis only |
| SRS-13.3 | AI recommendations are generated correctly | 🔶 | Scan only |
| SRS-13.4 | AI prompts are centrally managed | 🔶 | Versioned prompt store built. The AI Scan prompts are not yet loaded from it. Needs migration 0023 applied. |
| SRS-13.5 | AI activities are audited | 🔶 | Append only execution history built. The AI Scan engine does not write to it yet. Needs migration 0023 applied. |
| SRS-13.6 | Human approval workflows function correctly | 🔶 | Approve or reject held agent output built; reports still use the older promote step. Needs migration 0023 applied. |
| SRS-13.7 | AI services integrate successfully with platform modules | 🔶 | One module |

## Module 14: Audit, Compliance & Security Monitoring (§20.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-14.1 | Audit records are generated for all business critical activities | 🔶 |  |
| SRS-14.2 | Security monitoring operates continuously | 🔶 | Security Center is live; no continuous detection |
| SRS-14.3 | Compliance monitoring functions correctly | ⏭ |  |
| SRS-14.4 | Security incidents are managed successfully | ✅ | Incident register: register, classify severity, assign, investigate, resolve and close (resolution required). Needs migration 0023 applied. |
| SRS-14.5 | Alerts are generated according to platform rules | ✅ | Threshold rules (failed sign ins, webhook and email failures, critical incidents) evaluated every 5 minutes with a cooldown; raises admin notification and a security incident. Needs migration 0023 applied. |
| SRS-14.6 | Audit history remains immutable | ✅ | BEFORE UPDATE OR DELETE triggers refuse changes on 6 audit tables; cascade deletes still work. Needs migration 0023 applied. |
| SRS-14.7 | Security reports are available to authorized users | ✅ | Incident register plus scheduled security report. |

## Module 15: Analytics & Business Intelligence (§21.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-15.1 | Dashboards display accurate information | 🔶 |  |
| SRS-15.2 | KPIs are calculated correctly | 🔶 | readBusinessIntelligence |
| SRS-15.3 | Reports are generated successfully | 🔶 | Limited export |
| SRS-15.4 | Historical analytics function correctly | 🔶 |  |
| SRS-15.5 | Dashboard permissions are enforced | ✅ |  |
| SRS-15.6 | Scheduled reporting operates correctly | ✅ | Daily, weekly or monthly pipeline, billing, delivery and security reports by email; rows claimed before sending so instances cannot double send. Needs migration 0023 applied. |
| SRS-15.7 | Analytics data remains consistent across the platform | 🔶 |  |

## Module 16: Integration & API Management (§22.13)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-16.1 | APIs operate securely | ✅ | helmet, CORS, shared state rate limiting, zod |
| SRS-16.2 | Integrations function correctly | 🔶 | Resend, Twilio, webhooks |
| SRS-16.3 | Synchronization completes successfully | ⏭ |  |
| SRS-16.4 | Integration monitoring is operational | ✅ | Platform health: provider configuration, 24h email result, per webhook attempts, failures and last success. |
| SRS-16.5 | Security controls are enforced | ✅ |  |
| SRS-16.6 | Integration logs are maintained | ✅ | webhookDeliveries, emailDeliveryLog |
| SRS-16.7 | Alerts are generated where required | ✅ | Webhook and email failure thresholds raise alerts. Needs migration 0023 applied. |

## Module 17: Workflow & Business Process Management (§23.15)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-17.1 | Workflows execute correctly | ✅ | workflowDefinitions, workflowRuns |
| SRS-17.2 | Workflow history is maintained | ✅ |  |
| SRS-17.3 | Approval workflows function correctly | 🔶 | Document approval yes; workflow approval gates no |
| SRS-17.4 | Event driven workflows trigger successfully | 🔶 | Trigger types exist; few events emit |
| SRS-17.5 | Scheduled workflows execute as configured | ⏭ |  |
| SRS-17.6 | Workflow security is enforced | ✅ |  |
| SRS-17.7 | Workflow monitoring operates successfully | 🔶 | Run list; no metrics |

## Module 18: Platform Configuration & System Administration (§24.15)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-18.1 | Configuration changes are applied correctly | ✅ | Validated before applying; refused changes recorded. |
| SRS-18.2 | Administrative permissions are enforced | ✅ |  |
| SRS-18.3 | Configuration history is maintained | ✅ | config_history is append only; screen shows from, to, result, reason. Needs migration 0023 applied. |
| SRS-18.4 | Platform settings remain consistent | 🔶 |  |
| SRS-18.5 | Security policies are configurable | ⏭ | Settings are labels, not enforced policy |
| SRS-18.6 | AI configuration functions correctly | 🔶 | Read only provider state |

## Module 19: Platform Operations & Maintenance (§25.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-19.1 | Platform monitoring operates continuously | 🔶 | Health endpoints; no monitoring service |
| SRS-19.2 | Maintenance procedures function correctly | ✅ | Maintenance mode setting returns 503 to everyone except sign in, admin and health, so it can always be switched off. |
| SRS-19.3 | Backup and recovery processes are available | 🔶 | Provider managed; undocumented |
| SRS-19.4 | Operational incidents are managed successfully | ✅ | Same incident register, operational category, available to technical operators. Needs migration 0023 applied. |
| SRS-19.5 | Release management is operational | 🔶 | Commit and process start shown when the host provides them. No deployment history. |
| SRS-19.6 | Capacity monitoring functions correctly | 🔶 | Memory, uptime, database size and row counts shown. No capacity thresholds or trend history yet. |

## Module 20: Global Non-Functional Requirements (§26.18)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-20.1 | All platform modules comply with these requirements | 🔶 |  |
| SRS-20.2 | Non functional requirements are consistently enforced | 🔶 |  |
| SRS-20.3 | Platform quality standards are maintained | ✅ | Typecheck, about 900 tests, production build, secret scan, CI. |
| SRS-20.4 | Operational standards are satisfied | 🔶 |  |
| SRS-20.5 | Security standards are satisfied | 🔶 | Security and Compliance Specification never supplied |
| SRS-20.6 | Reliability objectives are achieved | 🔶 |  |

---

## Blocked items (9 criteria, 3 external causes)

1. **Supabase API key revoked after the credential leak, not reissued.** Blocks storage, document upload and download, deliverable upload, project documentation.
2. **No payment processor credential in any environment.** Blocks AI Scan purchase, payments, payment driven activation.
3. **No LLM key configured.** Blocks live AI analysis. `OPENAI_API_KEY` alone activates it.

## Open decisions that cap completion

- **OPD-001** Notification template structure: caps Module 11.
- **OPD-003** Document governance matrix: caps Module 12.
- **§26.16** defers lawful basis, consent, data subject requests, retention and breach notification to a Security & Compliance Specification that has never been supplied: caps Module 20.
- **§15.16 vs §21.15** require predictive AI forecasting and exclude predictive ML in the same document. Needs a Product Owner ruling.

## Before any of the new work is live

1. **Apply `drizzle/0023_srs_completion.sql` to Supabase.** It creates the new tables, adds `client_projects.archivedAt` and installs the append only audit triggers. Until it is applied, the new screens will show empty or error states. The file is idempotent.
2. Nothing here was clicked through in a browser. Each Done means built, reachable from a screen, covered by tests where the logic is pure or the permission boundary matters, and typechecked.

## What remains, and what each item needs

**Buildable now, partial or not started (no outside input needed)**

| Criterion | What to build |
| --- | --- |
| SRS-03.5, 03.6, 04.4, 06.3, 06.4 | AI Scan report lifecycle: the nine status model (Draft to Archived), assign reviewer, request revision, approve, publish, with the public report hidden until Published (BR-016). Backfill existing ready scans as Published. Deliberately not started: it changes what customers see, and the scan is slated for replacement in Milestone 4, so confirm first. |
| SRS-03.3 | Resumable questionnaire: save a draft per step and resume by link. |
| SRS-03.8, 03.9, 09.6, 11.1, 11.2 | Route the 84 event catalogue through one dispatcher so every event emits to its recipients and channels. Largest remaining item. |
| SRS-08.2 | Discovery Call outcomes, notes and follow ups on bookings. |
| SRS-05.3 | Developer task progress notes, comments and clarification requests. |
| SRS-17.4, 17.5, 09.5, 17.7 | Scheduled workflow trigger, more emitting events, project automations, run metrics. Needs a workflow trigger enum change. |
| SRS-13.2, 13.3, 13.7 | Route the AI Scan engine and further modules through the agent gate and prompt store. |
| SRS-06.8, 07.9, 15.1 to 15.4, 15.7 | Replace the sample data on Campaigns and Agents and the seeded executive figures with real queries. |
| SRS-07.3, 12.6, 14.1, 14.2, 14.3, 18.5 | Per operator and temporary permissions, document automations, audit coverage sweep, continuous detection, compliance monitoring, enforcing security policy values such as session length. |
| SRS-01.2, 01.8, 20.1, 20.2, 20.4, 20.6 | Navigation, responsive and non functional sweep once the redesign inputs arrive. |

**Needs something from outside**

| Criteria | Needs |
| --- | --- |
| SRS-04.6, 05.4, 09.4, 12.1 | Reissued Supabase API key (storage). |
| SRS-01.7, 03.1, 03.2, 10.3, 10.4 | A payment processor account and credential. |
| SRS-03.4 | `OPENAI_API_KEY` (or the LLM pair) set in Railway. |
| SRS-11.5 | Decision OPD-001, notification template structure. |
| SRS-12.3 | Decision OPD-003, document governance matrix. |
| SRS-20.5 and the rest of module 20 | The Security and Compliance Specification referenced in §26.16. |
| SRS-15.x forecasting | Product Owner ruling on §15.16 against §21.15. |
| SRS-02.3, 16.2, 16.3 | Confirmation of the activation sequence, and which external systems must synchronise. |