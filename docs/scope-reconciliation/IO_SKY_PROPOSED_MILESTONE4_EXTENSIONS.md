# IO SKY — proposed Milestone 4 extensions beyond the SRS

Prepared 15 October 2026. **Proposal only. No additional development is approved.** These are technical deltas, not a legal finding that no prior agreement exists. The original agreed plan and written change approvals were not available; any actual accepted commitment must be reconciled before quotation.

Baseline work must remain outside the extension charge. In particular, telephony/IVR/AI communication, working Scan reports/review, ordinary scheduling, general AI memory, configurable permissions, usable invoices/subscriptions, recovery and capacity obligations are not added here.

## Additional packages

| Package | Work | Effort (person-days) | Evidence / dependency |
| --- | --- | --- | --- |
| D01 | Adaptive interview and interactive contradiction/depth engine | 18–30 | SCAN-09; SCAN-11; Baseline questionnaire, analysis and generic context already closed |
| D02 | Fixed 21-section design and book-style report viewer | 12–20 | SCAN-14; SCAN-15; Approved reference layouts, section schema and baseline report payload |
| D03 | Separate Executive Briefing video | 8–14 | SCAN-17; Selected audiovisual provider, approved narrative/voice and secure delivery; subscription cost separate |
| D04 | Multi-host and joint-attendance scheduling allocation | 8–15 | SCH-11; Baseline booking fixed; host policy and selected calendar approach agreed |
| D05 | Whole-site/portal visual redesign | 20–35 | GOV-22; Fixed existing surface and asset inventory; new workflows excluded |
| D06 | Generated-report NL/EN translation and equivalence | 6–10 | SCAN-16; Canonical report and approved terminology; notification localization excluded |
| D07 | Passkey/WebAuthn additional authentication method | 5–8 | GOV-21; Stable relying-party domains and supported devices/recovery flow |
| D08 | External prospect signal discovery and evidence-led research | 30–50 | GOV-24; Approved sources/connectors, data rights and scope limited to discovery/research; baseline campaign/sales functions excluded |
| D09 | Optional durable call audio recording storage/export | 5–9 | REC-13; IVR-11; Baseline voice runtime, provider support and owner-approved recording/retention policy; bilingual voice and transcript scope remain Category C |


**Illustrative core selection D01–D05: 66–114 person-days.** Optional D06–D09 add 46–77 person-days; **all nine total 112–191 person-days (896–1,528 hours)** under current assumptions. Select actual packages before quoting; this is not an order for all nine. Basic review/publication/report delivery, memory, AI permissions and provider operation are excluded from extra charges.

## Exact baseline-versus-addition comparisons


### REC-13 — Permanent audio recording

- Baseline: SRS §17.9, PDF p101; SRS §19.21, PDF p124; “The platform shall maintain a complete history of notifications and communications, including: • Delivery timestamp.”. Communication metadata/history; durable audio is not required.
- Later source: Phase 4 pdfs/IO_SKY_AI_Receptionist_Functional_Specification_v1.0.pdf §33, PDF p8: Recording and Transcription.
- Delta/status: No call recording path located.
- Implementation evidence: server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647. server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D09: 5–9 person-days (shared package, NOT additive per row). Dependencies: Voice provider/number, AI credentials and approved policies.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### IVR-11 — Call recording controls

- Baseline: SRS §17.9, PDF p101; “The platform shall maintain a complete history of notifications and communications, including: • Delivery timestamp.”. Communication history, not permanent call audio storage.
- Later source: Phase 4 pdfs/IO_SKY_IVR_Telephony_Functional_Specification_v1.0.pdf §21, PDF p7: Call recording state.
- Delta/status: No recording capability found.
- Implementation evidence: server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647. server/integrations.test.ts (11 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D09: 5–9 person-days (shared package, NOT additive per row). Dependencies: Provider account/number, approved routing and capacity assumptions.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### SCH-11 — Multi-host allocation and joint attendance

- Baseline: SRS §14.7, PDF p78; SRS §13.13, PDF p73; “The module shall enable Admins to: • Schedule Discovery Calls.”. Baseline admin call management does not prescribe host-assignment algorithms.
- Later source: Phase 4 pdfs/IO_SKY_Scheduling_Agent_Functional_Specification_v1.0.pdf §30, PDF p9: Multi-host architecture - launch foundation.
- Delta/status: No host resource model or round-robin/joint attendance found.
- Implementation evidence: server/routers/bookings.ts:450; server/db/bookings.ts:412; server/_core/booking/index.ts; server/routers/bookingAdmin.ts. server/bookingAdmin.test.ts (12 passed, 0 skipped); server/bookingReminders.test.ts (7 passed, 0 skipped); server/bookings.test.ts (12 passed, 0 skipped); server/concurrency.test.ts (0 passed, 9 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D04: 8–15 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### SCAN-09 — Adaptive interview and depth/stop engine

- Baseline: SRS §9.5, PDF p44; SRS §9.7, PDF p46; “Every AI Scan shall follow the same mandatory lifecycle.”. AI Scan Lifecycle.
- Later source: 10591/IO_SKY_AI_Scan_Engine_Master_Specification_v10_Fr_260920_030158.pdf, AI-004, PDF p8.
- Delta/status: Fixed question bank is implemented; bounded adaptive interviewing is not.
- Implementation evidence: shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts. server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D01: 18–30 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### SCAN-11 — Adaptive contradiction clarification

- Baseline: SRS §9.5, PDF p44; “Every AI Scan shall follow the same mandatory lifecycle.”. AI Scan Lifecycle.
- Later source: 10591/IO_SKY_AI_Scan_Engine_Master_Specification_v10_Fr_260920_030158.pdf, CTR-001, PDF p9.
- Delta/status: Later interactive contradiction categories and re-questioning are absent.
- Implementation evidence: shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts. server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D01: 18–30 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### SCAN-14 — Fixed 21-section report architecture

- Baseline: SRS §9.7, PDF p46; “The AI Scan Platform shall: • Support multiple scan packages. • Process secure payments. • Create customer accounts when required. • Support resumable questionnaires. • Validate required responses. • Generate …”. Functional Requirements.
- Later source: 10591/IO_SKY_AI_Scan_Report_Design_System_Template_Architecture_Specification_v1.0.pdf, Fixed 21-Section, PDF p2.
- Delta/status: Later fixed section architecture is not prescribed by SRS.
- Implementation evidence: shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts. server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D02: 12–20 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### SCAN-15 — Book-style portal viewer

- Baseline: SRS §10.7, PDF p51; “Clients shall be able to: • View published reports.”. Reports.
- Later source: 10591/IO_SKY_AI_Scan_Engine_Master_Specification_v10_Fr_260920_030158.pdf, VIEW-003, PDF p16.
- Delta/status: Baseline opening/download is not the later responsive publication viewer.
- Implementation evidence: shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts. server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D02: 12–20 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### SCAN-16 — Generated-report NL/EN translation pipeline

- Baseline: SRS §10.7, PDF p51; SRS §17.8, PDF p100; “Clients shall be able to: • View published reports.”. Reports.
- Later source: 10591/IO_SKY_AI_Scan_Engine_Master_Specification_v10_Fr_260920_030158.pdf, LNG-003, PDF p14.
- Delta/status: Notification localization exists; generated report equivalence/translation is different.
- Implementation evidence: shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts. server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D06: 6–10 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### SCAN-17 — Executive Briefing video generation

- Baseline: SRS §9.5, PDF p44; “Every AI Scan shall follow the same mandatory lifecycle.”. AI Scan Lifecycle.
- Later source: 10591/IO_SKY_AI_Scan_Engine_Master_Specification_v10_Fr_260920_030158.pdf, EB-003, PDF p18.
- Delta/status: Written executive summary is baseline; separate narrated audiovisual output is not.
- Implementation evidence: shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts. server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D03: 8–14 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### GOV-21 — Passkey/WebAuthn authentication

- Baseline: SRS §8.16, PDF p41; “The module shall be considered complete when: • Only authorized users can access protected resources.”. Acceptance Criteria.
- Later source: Supplied client review item 30 (earlier attachment; message itself has no page numbering).
- Delta/status: No passkey/WebAuthn implementation found; additional authentication method requested in client item 30.
- Implementation evidence: server/routers/mfa.ts; server/_core/localAuthRoute.ts. server/localAuth.mfa.test.ts (4 passed, 0 skipped); server/mfa.test.ts (14 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D07: 5–8 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### GOV-22 — Whole-site and portal visual redesign

- Baseline: SRS §7.8, PDF p33; SRS §26.10, PDF p187; “The website shall: • Present company positioning. • Display service information. • Display operational ecosystems. • Present AI Scan offerings. • Display custom architecture examples. • Provide contact forms. • …”. Functional Requirements.
- Later source: 10591/IO_SKY_Website_Platform_Layout_Design_Language_v1.0_Developer_Specification.pdf, PDF p1; client items 27/31.
- Delta/status: New deterministic design compositions and asset inventory are beyond baseline usable responsive UI; original acceptance of paid redesign unavailable.
- Implementation evidence: client/src/index.css; client/src/components/Navbar.tsx. server/designLanguage.test.ts (30 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D05: 20–35 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

### GOV-24 — External signal discovery research and prospect enrichment

- Baseline: SRS §14.16, PDF p80; SRS §17.14, PDF p102; “The CRM & Sales Management module shall maximize automation across the commercial lifecycle while ensuring that business-critical decisions remain under human control where required.”. Automation Requirements.
- Later source: Phase 4 pdfs/IO_SKY_AI_Sales_Outbound_Functional_Technical_Specification_v1.0.pdf §21, PDF p6: Discovery & Source Architecture; Phase 4 pdfs/IO_SKY_AI_Sales_Outbound_Functional_Technical_Specification_v1.0.pdf §31, PDF p8: Research Brief.
- Delta/status: ASO adds multi-source discovery, evidence research, bulk import and outreach dossiers beyond generic campaign/lead management.
- Implementation evidence: server/db/campaigns.ts; server/leadEvaluation.ts. server/integrations.test.ts (11 passed, 0 skipped). No adequate matching live extension demonstration located.
- Acceptance: demonstrate the selected additional behaviour and its permission/failure cases; detailed examples are fixed before quote.
- Engineering: D08: 30–50 person-days (shared package, NOT additive per row). Dependencies: None specifically established.
- Commercial approval: unverified. No baseline obligation is waived or re-billed.

## Items deliberately held as C

Transcript retention also remains C because §§17.9/19.21 already require conversation history; durable audio recording alone is the optional D09 package.

The previous 13 October proposal described the exact advanced analysis/evidence methodology as an extension. This audit qualifies that claim: architecture/method choices alone are not proven additional business functionality under §26.19. Basic context, memory, conversation continuity, human escalation, provider fallback, permission enforcement and output quality are already SRS duties. Only adaptive interactive behaviour is assigned to D01.

Likewise, calendar integration is mentioned in §13.13, so it is C pending the actual integration commitment; D04 covers the additional host/resource allocation product. Spoken Dutch/English expectations, exact persona/playbook, barge-in, queues, launch-hour policies, autonomous delegated scheduling, all ten standalone-agent products, universal MFA and new numerical capacity guarantees are not priced collectively. Clarification may be configuration or ordinary baseline engineering. C is not a synonym for paid extra.

## Pricing, dependencies and implementation sequence

- Each selected package needs fixed deliverables, acceptance examples, effort assumptions, one-time fee, recurring/provider costs, dependencies and written Product Owner approval before chargeable work starts. No fee or guaranteed date is invented here.
- AI usage, external research sources/connectors, audiovisual production, calendar services, storage and bandwidth are separate operating costs. Exact prices depend on approved providers/volume and are not estimated from old price lists in this audit.
- Close the required baseline shared services first. Adaptive interviewing and report/viewer work can then proceed in parallel. Video and translation depend on a stable approved canonical report. Multi-host work depends on corrected baseline booking. Redesign can proceed alongside functional work once the surface/asset inventory is frozen. External prospecting needs approved sources and baseline sales/notification governance.
- With two experienced implementation engineers and shared QA, a selected D01–D05 package is roughly **8–14 working weeks after baseline foundations, assets and decisions are available**. Selecting all nine is approximately **13–23 working weeks** under the same assumptions, with integration/parallelism constraints. These are conditional planning windows, not guaranteed dates; staging and external account waits are additional.
- Approval of a new extension list must state how earlier Milestone 4 documents are superseded commercially while preserving original SRS duties. No unilateral rewrite of an accepted contract is assumed.
