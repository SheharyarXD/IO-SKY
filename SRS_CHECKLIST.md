# SRS Checklist: Master SRS v1.1 against the built platform

Tracking document, same convention as `PHASE1_CHECKLIST.md`, `MILESTONE2_PROGRESS.md` and `MILESTONE3_CHECKLIST.md`.

**Unit of count:** the 155 acceptance criteria the SRS states per module (sections 7.13 to 26.18). The SRS has no numbered requirement IDs, so these are the only countable completion statements it contains.

Legend: ✅ Done and verified · 🔶 Partial · ⛔ Blocked (external credential or decision) · ⏭ Not started

**Method:** each status was set by inspecting the code (routers, schema, UI, migrations) and probing for specific capabilities. Nothing here was established by clicking through the running UI, so a Done means *built and reachable in code*, not *signed off by a tester*. A criterion is only Done when the whole sentence is true, which is why several that look nearly finished are Partial.

This replaces the per module counts in `SRS_TRACEABILITY.md`, which were estimates. This file was checked item by item and the totals below are computed.

---

## Status: 45 of 155 criteria complete (29.0%)

| Status | Criteria | Share |
| --- | ---: | ---: |
| ✅ Done | 45 | 29.0% |
| 🔶 Partial | 69 | 44.5% |
| ⏭ Not started | 32 | 20.6% |
| ⛔ Blocked | 9 | 5.8% |
| **Total** | **155** | **100%** |

Counting a Partial as half: **51.3%**.

## Per module

| # | Module | SRS | Criteria | ✅ | 🔶 | ⏭ | ⛔ |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Public Website & Lead Experience | §7.13 | 9 | 5 | 3 | 0 | 1 |
| 2 | Identity & Authentication | §8.16 | 9 | 7 | 2 | 0 | 0 |
| 3 | AI Scan Platform | §9.11 | 9 | 1 | 6 | 0 | 2 |
| 4 | Client Portal | §10.17 | 10 | 6 | 3 | 0 | 1 |
| 5 | Developer Portal | §11.15 | 8 | 3 | 3 | 1 | 1 |
| 6 | Admin Portal | §12.17 | 10 | 4 | 5 | 1 | 0 |
| 7 | Super Admin Portal | §13.18 | 10 | 4 | 4 | 2 | 0 |
| 8 | CRM & Sales Management | §14.15 | 8 | 1 | 2 | 5 | 0 |
| 9 | Project & Delivery Management | §15.18 | 8 | 1 | 4 | 2 | 1 |
| 10 | Commercial Billing & Subscription | §16.15 | 7 | 1 | 2 | 2 | 2 |
| 11 | Notifications & Communication | §17.13 | 7 | 1 | 3 | 3 | 0 |
| 12 | File & Document Management | §18.14 | 7 | 2 | 3 | 1 | 1 |
| 13 | AI Intelligence Layer | §19.14 | 7 | 0 | 4 | 3 | 0 |
| 14 | Audit, Compliance & Security Monitoring | §20.14 | 7 | 0 | 4 | 3 | 0 |
| 15 | Analytics & Business Intelligence | §21.14 | 7 | 1 | 5 | 1 | 0 |
| 16 | Integration & API Management | §22.13 | 7 | 3 | 2 | 2 | 0 |
| 17 | Workflow & Business Process Management | §23.15 | 7 | 3 | 3 | 1 | 0 |
| 18 | Platform Configuration & System Administration | §24.15 | 6 | 1 | 3 | 2 | 0 |
| 19 | Platform Operations & Maintenance | §25.14 | 6 | 0 | 3 | 3 | 0 |
| 20 | Global Non-Functional Requirements | §26.18 | 6 | 1 | 5 | 0 | 0 |
| | **Total** | | **155** | **45** | **69** | **32** | **9** |

---

## Module 1: Public Website & Lead Experience (§7.13)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-01.1 | All public pages are accessible | ✅ | Home, Intelligence, Solutions, AI Scan, Custom Software, About, Contact, Book, Login, Legal all routed |
| SRS-01.2 | Navigation behaves consistently | 🔶 | Client has not yet supplied the navigation specification; redesign pending |
| SRS-01.3 | All forms validate correctly | ✅ | Zod validation server side; phone and industry fixes shipped |
| SRS-01.4 | CRM records are created successfully | ✅ | leads and contactSubmissions written on submit |
| SRS-01.5 | Notifications are generated correctly | 🔶 | Owner email only. No admin in-app notification exists |
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
| SRS-02.9 | Unauthorized access attempts are denied and logged | 🔶 | Denial enforced and tested; logging of every denial path not confirmed |

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
| SRS-05.5 | Time registration operates correctly | ⏭ | No table, no procedure, no UI |
| SRS-05.6 | Internal messaging functions as specified | 🔶 | Admin reply API built. No admin UI to send it yet |
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
| SRS-06.6 | Developers can be assigned to projects | 🔶 | Admin API built and tested (assign, end, task, reply). No admin UI control yet |
| SRS-06.7 | Billing information is available | ✅ | billing, createInvoice |
| SRS-06.8 | Operational dashboards display accurate information | 🔶 | Campaigns and Agents are labelled sample data |
| SRS-06.9 | Notifications function correctly | ⏭ | No admin notification source exists |
| SRS-06.10 | All required audit events are recorded | 🔶 |  |

## Module 7: Super Admin Portal (§13.18)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-07.1 | Super Admins can manage organizations | ✅ |  |
| SRS-07.2 | Users and permissions can be managed securely | ✅ | setUserRole, assignUserOrganization |
| SRS-07.3 | Technical Operator permissions are configurable | 🔶 | Role exists; no per operator or temporary permissions |
| SRS-07.4 | AI configuration is versioned and auditable | ⏭ | Governance rows are editable text, no versions |
| SRS-07.5 | Security monitoring functions correctly | ✅ | AdminSecurityCenter is live |
| SRS-07.6 | Audit logs are searchable | 🔶 | List exists; search, filter, export unconfirmed |
| SRS-07.7 | Platform configuration changes are validated | ⏭ | No validation or approval before activation |
| SRS-07.8 | Integration settings can be managed | 🔶 | Webhooks yes; provider management no |
| SRS-07.9 | Executive dashboards display accurate information | 🔶 | Partly seeded |
| SRS-07.10 | All platform wide actions are recorded in the audit log | ✅ | recordAdminEvent |

## Module 8: CRM & Sales Management (§14.15)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-08.1 | Leads can be created and managed | ✅ |  |
| SRS-08.2 | Discovery Calls can be scheduled and tracked | 🔶 | Cancel, no show, reminders. No outcomes, notes, or follow ups |
| SRS-08.3 | Opportunities progress through the defined lifecycle | ⏭ | No table |
| SRS-08.4 | Proposals are managed successfully | ⏭ | Only a public request log exists |
| SRS-08.5 | Customer timelines display complete histories | ⏭ |  |
| SRS-08.6 | Activities and follow ups function correctly | ⏭ |  |
| SRS-08.7 | Won opportunities create project handovers | ⏭ |  |
| SRS-08.8 | All commercial activities are recorded in the audit log | 🔶 | Leads and bookings only |

## Module 9: Project & Delivery Management (§15.18)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-09.1 | Projects can be created and managed successfully | ✅ |  |
| SRS-09.2 | Tasks, milestones, and deliverables function as specified | 🔶 | Milestones yes. No admin task create or assign |
| SRS-09.3 | Customer approvals operate correctly | ⏭ | No approval gate on phases or milestones (BR-019) |
| SRS-09.4 | Project documentation is securely managed | ⛔ | Storage key |
| SRS-09.5 | Automated workflows execute correctly | 🔶 | Engine exists; no project automations wired |
| SRS-09.6 | Notifications are delivered successfully | 🔶 |  |
| SRS-09.7 | Audit events are recorded for all business critical actions | 🔶 |  |
| SRS-09.8 | Completed projects are archived according to platform policies | ⏭ |  |

## Module 10: Commercial Billing & Subscription (§16.15)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-10.1 | Quotations can be created and managed | ⏭ | No table |
| SRS-10.2 | Invoices are generated correctly | ✅ | createInvoice |
| SRS-10.3 | Payments are processed successfully | ⛔ | No processor credential |
| SRS-10.4 | Payment confirmation activates the appropriate workflows | ⛔ | As above |
| SRS-10.5 | Subscription management functions correctly | ⏭ | No table |
| SRS-10.6 | Financial reports display accurate information | 🔶 | No revenue summaries |
| SRS-10.7 | Audit records are created for all financial events | 🔶 |  |

## Module 11: Notifications & Communication (§17.13)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-11.1 | Notifications are generated for all defined business events | 🔶 | 84 event catalogue encoded; emitters partial |
| SRS-11.2 | Email and in-app notifications are delivered successfully | 🔶 | Email works; in-app for client and developer only |
| SRS-11.3 | User notification preferences are respected | ⏭ | No preference store |
| SRS-11.4 | Communication history is maintained | 🔶 | emailDeliveryLog only |
| SRS-11.5 | Notification templates function correctly | ⏭ | Held by open decision OPD-001 |
| SRS-11.6 | Delivery failures are recorded | ✅ | emailDeliveryFailures |
| SRS-11.7 | Security notifications are always delivered according to platform policy | ⏭ |  |

## Module 12: File & Document Management (§18.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-12.1 | Documents can be uploaded and downloaded securely | ⛔ | Storage key |
| SRS-12.2 | Version history operates correctly | ✅ | listDocumentVersions |
| SRS-12.3 | Permissions are enforced correctly | 🔶 | Org isolation yes; role level matrix no |
| SRS-12.4 | Approval workflows function as specified | ✅ | reviewDocument |
| SRS-12.5 | Search returns authorized results only | ⏭ | No document search |
| SRS-12.6 | Automated document workflows execute successfully | 🔶 | Retention only |
| SRS-12.7 | Audit records are created for all business critical document actions | 🔶 |  |

## Module 13: AI Intelligence Layer (§19.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-13.1 | AI Agents operate according to assigned permissions | ⏭ | No agent registry |
| SRS-13.2 | AI workflows execute successfully | 🔶 | Scan analysis only |
| SRS-13.3 | AI recommendations are generated correctly | 🔶 | Scan only |
| SRS-13.4 | AI prompts are centrally managed | ⏭ |  |
| SRS-13.5 | AI activities are audited | ⏭ | No AI execution history |
| SRS-13.6 | Human approval workflows function correctly | 🔶 | Reports only |
| SRS-13.7 | AI services integrate successfully with platform modules | 🔶 | One module |

## Module 14: Audit, Compliance & Security Monitoring (§20.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-14.1 | Audit records are generated for all business critical activities | 🔶 |  |
| SRS-14.2 | Security monitoring operates continuously | 🔶 | Security Center is live; no continuous detection |
| SRS-14.3 | Compliance monitoring functions correctly | ⏭ |  |
| SRS-14.4 | Security incidents are managed successfully | 🔶 | Events logged; no register, classify, assign, close |
| SRS-14.5 | Alerts are generated according to platform rules | ⏭ | No threshold engine |
| SRS-14.6 | Audit history remains immutable | ⏭ | No append only enforcement on any audit table |
| SRS-14.7 | Security reports are available to authorized users | 🔶 |  |

## Module 15: Analytics & Business Intelligence (§21.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-15.1 | Dashboards display accurate information | 🔶 |  |
| SRS-15.2 | KPIs are calculated correctly | 🔶 | readBusinessIntelligence |
| SRS-15.3 | Reports are generated successfully | 🔶 | Limited export |
| SRS-15.4 | Historical analytics function correctly | 🔶 |  |
| SRS-15.5 | Dashboard permissions are enforced | ✅ |  |
| SRS-15.6 | Scheduled reporting operates correctly | ⏭ |  |
| SRS-15.7 | Analytics data remains consistent across the platform | 🔶 |  |

## Module 16: Integration & API Management (§22.13)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-16.1 | APIs operate securely | ✅ | helmet, CORS, shared state rate limiting, zod |
| SRS-16.2 | Integrations function correctly | 🔶 | Resend, Twilio, webhooks |
| SRS-16.3 | Synchronization completes successfully | ⏭ |  |
| SRS-16.4 | Integration monitoring is operational | 🔶 | webhookDeliveries recorded; no health view |
| SRS-16.5 | Security controls are enforced | ✅ |  |
| SRS-16.6 | Integration logs are maintained | ✅ | webhookDeliveries, emailDeliveryLog |
| SRS-16.7 | Alerts are generated where required | ⏭ |  |

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
| SRS-18.1 | Configuration changes are applied correctly | 🔶 | No validation step |
| SRS-18.2 | Administrative permissions are enforced | ✅ |  |
| SRS-18.3 | Configuration history is maintained | ⏭ |  |
| SRS-18.4 | Platform settings remain consistent | 🔶 |  |
| SRS-18.5 | Security policies are configurable | ⏭ | Settings are labels, not enforced policy |
| SRS-18.6 | AI configuration functions correctly | 🔶 | Read only provider state |

## Module 19: Platform Operations & Maintenance (§25.14)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-19.1 | Platform monitoring operates continuously | 🔶 | Health endpoints; no monitoring service |
| SRS-19.2 | Maintenance procedures function correctly | ⏭ | No maintenance mode |
| SRS-19.3 | Backup and recovery processes are available | 🔶 | Provider managed; undocumented |
| SRS-19.4 | Operational incidents are managed successfully | ⏭ |  |
| SRS-19.5 | Release management is operational | 🔶 | Railway and CI; no deployment tracking |
| SRS-19.6 | Capacity monitoring functions correctly | ⏭ |  |

## Module 20: Global Non-Functional Requirements (§26.18)

| ID | Criterion | Status | Evidence or gap |
| --- | --- | :---: | --- |
| SRS-20.1 | All platform modules comply with these requirements | 🔶 |  |
| SRS-20.2 | Non functional requirements are consistently enforced | 🔶 |  |
| SRS-20.3 | Platform quality standards are maintained | ✅ | 801 tests, typecheck, CI, secret scan |
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
