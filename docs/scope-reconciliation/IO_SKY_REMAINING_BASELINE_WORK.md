# IO SKY — remaining baseline work and closure plan

Prepared 15 October 2026. Category B is technical incompleteness or insufficient verification, not an automatic finding of chargeable liability. All figures are planning person-days, not promised dates or a quote. See the method/source limits and CSV for exact evidence.

## Confirmed engineering defects

1. **AI fail-open authorization/audit:** `server/aiGovernance.ts` catches registry failures and returns allowed:true; helper returns null without DB. `aiGovernance.test.ts` expressly expects that outcome. Conflicts with §19.18, PDF p123. GOV-01 / SRS-13.1 and 13.5.
2. **Report ownership:** public token-based report/PDF APIs do not authenticate the customer or validate organization ownership. §9.10, PDF p47, expressly requires ownership validation. SCAN-18 / GOV-31.
3. **Document matrix fail-open:** matrix lookup failures become an empty deny set at client listing/download routes. §§18.8/18.21 require authorization/governance. GOV-08.
4. **Guest reschedule consistency:** new slot is confirmed then all booking-ID slots cancelled; booking time/reminders are not moved by that route. §14.7 and §26.12. SCH-03 / SRS-08.2.
5. **Operator authorization:** seven grants/expiry/revocation are represented and Security Center checks security scope, but other ops routes rely on role alone. Individual backend authorization still needs a complete operation-to-scope mapping. §§5.7/13.8. GOV-06.

## Confirmed missing or partial baseline capabilities

- Functioning provider-backed IVR, telephony, AI receptionist, support/sales/voice communication; generic event/registry definitions do not implement them (§§17.6/17.11/19.22). Voice provider account availability does not explain away absent code.
- Full registry/tool/source/authority fields, permission-aware knowledge/context and conversation continuity, and configurable multiple-provider priority/fallback/limits (§§19.17–19.25). Numeric model routing/usage logs are partial evidence.
- Complete project-document association and controlled customer/admin/developer handoff (§§15.13, 18.6, 18.20).
- Real required email delivery, complete event producers and retry/escalation evidence (§§17.11/17.15). Preference locks do not guarantee a security notification reaches a recipient.
- Recovery verification, object-storage restoration procedure, environment isolation evidence and full performance/capacity metrics (§§25.8/25.20/26.13/26.22).

## Verification or decision gaps, not proven absent implementations

The first successful funded AI Scan/lead evaluation; actual generated invoice field validation; complete immutable published-version history; tenant/assignment API negative tests covering public token exceptions; retention-safe cascade policy; current deployment identity; current account plans, production billing and sender credentials; OPD-003 and the exact §26.16 companion. A missing screenshot alone is not the reason these remain open. Refer to their actual code/report/source gaps in the matrix.

## Work packages and estimate

| Package | Work | Effort (person-days) | Evidence / dependency |
| --- | --- | --- | --- |
| B01 | Close AI/document fail-open paths and authenticated report ownership | 4–7 | GOV-01; GOV-08; SCAN-18; Security review, capability-link policy and isolated tenant fixtures |
| B02 | Repair atomic reschedule, booking time and reminder consistency | 2–4 | SCH-03; Isolated booking database and conflict/failure cases |
| B03 | Complete individually configurable operator backend authorization | 2–4 | GOV-06; Approved operation-to-scope mapping |
| B04 | Minimum provider-backed IVR voice receptionist and escalation | 20–35 | REC/IVR B rows; Selected provider/number, single agreed launch language, basic routing and human destinations |
| B05 | Minimum governed Support/Sales AI communication capabilities | 12–20 | AG-01; AG-02; Shared runtime, approved knowledge and bounded business actions; no research-led prospecting engine |
| B06 | AI registry/context/knowledge/provider governance closure | 8–14 | GOV-02/03/04; SCAN-10; Permission-aware sources and multiple-provider rules; excludes adaptive interview methodology |
| B07 | Project-document association and controlled handoff | 5–9 | GOV-09; Approved document/entity model and handoff policy |
| B08 | Email provider verification event producers and retry/escalation | 6–10 | GOV-10/11; DNS/SMTP and exact content; external channel credentials; basic reliability, not cold campaign product |
| B09 | Isolated recovery target backup/storage procedure and restore rehearsal | 5–9 | GOV-12; Approved Supabase plan, staging project, backup export/object recovery and RTO/RPO |
| B10 | Generated invoice field/provider verification | 2–4 | GOV-16; Verified issuer/customer configuration and finance-owner tax decisions |
| B11 | Integrated QA, capacity metrics/workload tests and release evidence | 8–14 | GOV-13/14/29; cross-cutting B acceptance rows; Isolated representative environment, funded AI project, agreed expected workloads |
| B12 | Governance retention policy enforcement and acceptance evidence | 3–6 | GOV-26; OPDs; broad compliance rows; Actual companion/OPD decisions; technical enforcement only, not authoring legal advice |


**Known scoped baseline envelope: 77–136 person-days (616–1,088 hours).** These are shared packages. The 230 FWD evidence exceptions share an additional 8–16 day traceability/evidence review allowance; any actual engineering later found is unestimated. Combined currently identified work/review allowance: 85–152 person-days, not a full-SRS guarantee. B rows are not independent additional development jobs. No paid change is inferred for Category B.

## Baseline closure schedule

| Phase | Planned work | Parallel work / gates |
| --- | --- | --- |
| 0: interpretation/resources, approximately 2–5 engineering days within B12/B11 | Obtain actual plan/approvals/OPDs; define minimum voice/agent behaviours, expected workloads, language/buffer policy and RTO/RPO | Owner/provider waiting time is not estimable; start source-level fixes independently |
| 1: security and consistency, approximately 1–2 elapsed weeks with two suitable engineers | B01–B03, plus targeted regression cases and isolation fixtures | Parallel to DNS, funded AI setup and isolated environment provisioning |
| 2: missing shared AI/communication and routing, approximately 4–7 elapsed weeks under stated staffing assumptions | B04–B08, with shared runtime before voice/support/sales integration | Voice depends on provider/number; source isolation and document work can proceed separately |
| 3: operations and integration validation, approximately 2–3 elapsed weeks | B09–B12, representative workload metrics, restore rehearsal, live provider runs and revised evidence | Staging/backup/credits must be ready; failures feed fixes back into prior phases |

**Indicative baseline delivery window with two experienced engineers plus shared QA: roughly 9–16 working weeks after necessary dependencies are available**, subject to confirmed minimum scope and workload. This is derived from the planning envelope and integration risk, not a guarantee. With one engineer the 77–136 days alone represent about 15–27 engineering weeks before waits. Parallel work cannot eliminate common runtime/provider/review dependencies.

## All B rows and required closure evidence


### AG-01 — AI Support Agent

No end-to-end runtime for this named product located; shared registry exists; lead_qualifier is a partial sales-related implementation

- Source: SRS §17.6, PDF p99; SRS §17.11, PDF p101; SRS §19.5, PDF p118; SRS §19.8, PDF p119; SRS §19.18, PDF p123; server/db/srsGovernance.ts:647; server/leadEvaluation.ts:66; client/src/pages/admin/sections/DevSecCampAgents.tsx; drizzle/schema.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Deliver and demonstrate minimum communication capability within common governance.
- Dependency: Selected AI/voice provider and representative approved data.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B05: 12–20 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row).

### AG-02 — AI Sales Agent

No end-to-end runtime for this named product located; shared registry exists; lead_qualifier is a partial sales-related implementation

- Source: SRS §17.6, PDF p99; SRS §17.11, PDF p101; SRS §19.5, PDF p118; SRS §19.8, PDF p119; SRS §19.18, PDF p123; server/db/srsGovernance.ts:647; server/leadEvaluation.ts:66; client/src/pages/admin/sections/DevSecCampAgents.tsx; drizzle/schema.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Deliver and demonstrate minimum communication capability within common governance.
- Dependency: Selected AI/voice provider and representative approved data.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B05: 12–20 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row).

### AG-03 — AI Receptionist

No end-to-end runtime for this named product located; shared registry exists; lead_qualifier is a partial sales-related implementation

- Source: SRS §17.6, PDF p99; SRS §17.11, PDF p101; SRS §19.5, PDF p118; SRS §19.8, PDF p119; SRS §19.18, PDF p123; server/db/srsGovernance.ts:647; server/leadEvaluation.ts:66; client/src/pages/admin/sections/DevSecCampAgents.tsx; drizzle/schema.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Deliver and demonstrate minimum communication capability within common governance.
- Dependency: Selected AI/voice provider and representative approved data.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B05: 12–20 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row).

### AG-04 — AI Voice Agent

No end-to-end runtime for this named product located; shared registry exists; lead_qualifier is a partial sales-related implementation

- Source: SRS §17.6, PDF p99; SRS §17.11, PDF p101; SRS §19.5, PDF p118; SRS §19.8, PDF p119; SRS §19.18, PDF p123; server/db/srsGovernance.ts:647; server/leadEvaluation.ts:66; client/src/pages/admin/sections/DevSecCampAgents.tsx; drizzle/schema.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Deliver and demonstrate minimum communication capability within common governance.
- Dependency: Selected AI/voice provider and representative approved data.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B05: 12–20 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row).

### REC-01 — Inbound intelligent call handling

Not implemented

- Source: SRS §17.6, PDF p99; SRS §17.11, PDF p101; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### REC-02 — Conversational voice understanding and speech processing

Not implemented

- Source: SRS §17.6, PDF p99; SRS §19.8, PDF p119; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### REC-03 — Caller identification and confidential-action authorization

No voice identity/authorization flow located

- Source: SRS §19.11, PDF p120; SRS §19.21, PDF p124; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### REC-05 — Intent recognition and action selection

No receptionist intent/action integration located

- Source: SRS §17.11, PDF p101; SRS §19.19, PDF p123; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### REC-08 — Human escalation

No voice handoff path located

- Source: SRS §19.22, PDF p124; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### REC-09 — Basic conversation memory and recovery

Execution log and questionnaire drafts are not a conversation memory service

- Source: SRS §19.8, PDF p119; SRS §19.21, PDF p124; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row).

### REC-15 — AI call analytics and execution monitoring

Usage totals exist; no call analytics can be derived without call runtime

- Source: SRS §19.24, PDF p125; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row).

### REC-16 — Business-event follow-up communications

Generic dispatcher exists; receptionist call events not connected

- Source: SRS §17.11, PDF p101; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### REC-17 — External voice provider adapter

Twilio adapter sends SMS only; no call/media/webhook adapter located

- Source: SRS §6.9, PDF p29; SRS §17.6, PDF p99; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### REC-19 — Integration failure must not claim success

No voice tool-result contract located

- Source: SRS §26.7, PDF p186; SRS §26.12, PDF p187; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Voice provider/number, AI credentials and approved policies.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### REC-21 — Safety and truthful-operation rules in conversation playbook

No voice playbook execution; shared output validation is partial

- Source: SRS §19.11, PDF p120; SRS §19.12, PDF p121; SRS §19.23, PDF p125; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row).

### IVR-01 — Provider-backed SIP/telephony integration

No voice provider adapter found

- Source: SRS §6.9, PDF p29; SRS §17.6, PDF p99; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Provider account/number, approved routing and capacity assumptions.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### IVR-02 — Application-level IVR orchestration

No DTMF gather/menu/router found

- Source: SRS §17.6, PDF p99; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Provider account/number, approved routing and capacity assumptions.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### IVR-04 — Minimum incoming call routing

No incoming call webhook found

- Source: SRS §17.6, PDF p99; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Provider account/number, approved routing and capacity assumptions.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### IVR-07 — Human call transfer

No transfer result/session API found

- Source: SRS §19.22, PDF p124; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Provider account/number, approved routing and capacity assumptions.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### IVR-12 — Speech recognition for voice interaction

No speech path found

- Source: SRS §17.6, PDF p99; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Provider account/number, approved routing and capacity assumptions.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### IVR-14 — Telephony administration and number configuration

Provider status panel is not a telephone administration system

- Source: SRS §17.6, PDF p99; SRS §13.13, PDF p73; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Provider account/number, approved routing and capacity assumptions.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### IVR-15 — Call session lifecycle and monitoring

No call/session tables or monitoring events found

- Source: SRS §17.9, PDF p101; SRS §19.24, PDF p125; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Provider account/number, approved routing and capacity assumptions.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row).

### IVR-17 — Concurrent-call isolation and graceful overload

No voice runtime or representative concurrent call evidence

- Source: SRS §19.11, PDF p120; SRS §26.6, PDF p185; SRS §26.7, PDF p186; server/_core/smsSender.ts:68; server/routers.ts; server/db/srsGovernance.ts:647.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: Provider account/number, approved routing and capacity assumptions.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### SCH-03 — Correct guest rescheduling

New slot confirmed then all slots for same booking cancelled; no booking time/reminder update in route

- Source: SRS §14.7, PDF p78; SRS §26.12, PDF p187; server/routers/bookings.ts:450; server/db/bookings.ts:412; server/_core/booking/index.ts; server/routers/bookingAdmin.ts.
- Evidence: server/bookingAdmin.test.ts (12 passed, 0 skipped); server/bookingReminders.test.ts (7 passed, 0 skipped); server/bookings.test.ts (12 passed, 0 skipped); server/concurrency.test.ts (0 passed, 9 skipped); No adequate live proof of the disputed behaviour located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B02: 2–4 person-days (shared package, NOT additive per row).

### SCH-06 — Booking confirmation delivery

Templates and dispatch exist; real IO SKY email delivery unverified

- Source: SRS §17.11, PDF p101; SRS §14.7, PDF p78; server/routers/bookings.ts:450; server/db/bookings.ts:412; server/_core/booking/index.ts; server/routers/bookingAdmin.ts.
- Evidence: server/bookingAdmin.test.ts (12 passed, 0 skipped); server/bookingReminders.test.ts (7 passed, 0 skipped); server/bookings.test.ts (12 passed, 0 skipped); server/concurrency.test.ts (0 passed, 9 skipped); No adequate live proof of the disputed behaviour located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SCAN-02 — Live AI analysis of submitted facts

Code and mocked model tests exist; report p180 says first live analysis unperformed

- Source: SRS §9.5, PDF p44; SRS §19.14, PDF p121; shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped); No adequate matching live verification located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### SCAN-06 — Report versions and immutable publication

Basic version fields/history exist; complete historical published payload immutability needs an end-to-end proof

- Source: SRS §9.7, PDF p46; shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped); No adequate matching live verification located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B11: 8–14 person-days (shared package, NOT additive per row).

### SCAN-10 — Generic context and multi-session conversation persistence

Draft answers persist, but shared permission-aware interaction memory is not demonstrated

- Source: SRS §19.8, PDF p119; SRS §19.21, PDF p124; shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped); No adequate matching live verification located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row).

### SCAN-18 — Authenticated owner-only report retrieval

getReport/getReportPdf use public token only, without ctx user/organization ownership validation

- Source: SRS §9.10, PDF p47; shared/aiScanQuestionnaire.ts; server/_core/aiScanScoring.ts:294; server/routers/aiScans.ts:538; server/aiScanReportPdf.ts; server/db/srsDelivery.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiScanModel.test.ts (4 passed, 0 skipped); server/aiScanReportPdf.test.ts (3 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/aiScans.test.ts (24 passed, 0 skipped); No adequate matching live verification located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### GOV-01 — Fail-closed AI permission checks

Scan guard catches registry errors and returns allowed:true; missing db yields null verdict

- Source: SRS §19.18, PDF p123; server/aiGovernance.ts:21; server/db/srsGovernance.ts:242.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### GOV-02 — Registry business function tools sources modules and authority

ai_agents stores key/name/purpose/status/permissions/approval flag; no complete registry fields/tool/source/module/organization authority mapping

- Source: SRS §19.17, PDF p122; SRS §19.18, PDF p123; drizzle/schema.ts; server/db/srsGovernance.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiGovernance.test.ts (6 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row).

### GOV-03 — Multiple provider priority fallback and limits

Complexity model routing and usage logging exist; a configurable multiple-provider priority/fallback and budget enforcement system is not demonstrated

- Source: SRS §19.25, PDF p126; shared/modelRouting.ts; server/_core/llm.ts; server/_core/llmUsage.ts.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/llm.test.ts (10 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row).

### GOV-04 — Permission-aware knowledge and context retrieval

Two model paths receive supplied facts; no general authorized knowledge retrieval/conversation recovery implementation located

- Source: SRS §19.8, PDF p119; SRS §19.20, PDF p123; SRS §19.21, PDF p124; server/leadEvaluation.ts; server/_core/aiScanScoring.ts; drizzle/schema.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row).

### GOV-06 — All technical scopes enforced on backend operations

Security Center checks security grant, while summary/emailDeliveryLog rely on role-level opsProcedure without per-scope check

- Source: SRS §5.7, PDF p22; SRS §13.8, PDF p71; server/routers/ops.ts; server/_core/trpc.ts.
- Evidence: server/ops.test.ts (22 passed, 0 skipped); server/platformRules.test.ts (15 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B03: 2–4 person-days (shared package, NOT additive per row).

### GOV-08 — Document governance fails closed on matrix lookup errors

Client document list/download catches matrix lookup failure as an empty hidden-type set

- Source: SRS §18.8, PDF p109; SRS §18.21, PDF p114; server/routers/clientPortal.ts; server/db/platformGovernance.ts.
- Evidence: server/admin.documentLifecycle.test.ts (7 passed, 0 skipped); server/clientPortal.test.ts (37 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### GOV-09 — Project association and controlled document handoff

Client upload accepts organization/category but no project/task or documentType; distinct developer documents do not establish full controlled routing

- Source: SRS §15.13, PDF p87; SRS §18.6, PDF p109; SRS §18.20, PDF p113; server/routers/clientPortal.ts; server/routers/developer.ts; drizzle/schema.ts.
- Evidence: server/admin.documentLifecycle.test.ts (7 passed, 0 skipped); server/clientPortal.test.ts (37 passed, 0 skipped); server/developer.test.ts (33 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B07: 5–9 person-days (shared package, NOT additive per row).

### GOV-10 — Notification delivery and retries

Dispatcher and emission log exist; no persistent retry/escalation worker matching tier policy found; console success is not mailbox delivery

- Source: SRS §17.11, PDF p101; server/notificationDispatcher.ts; server/email.ts; server/notifications.ts.
- Evidence: server/emailDeliveryLogging.test.ts (3 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### GOV-11 — All defined event producers wired

Catalogue entries for AI voice/session events are definitions, not call/session emitters; report p795 acknowledges untriggered events

- Source: SRS §17.11, PDF p101; SRS §17.15, PDF p102; shared/notificationCatalogue.ts; server/notificationDispatcher.ts.
- Evidence: server/notificationCatalogue.test.ts (14 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### GOV-12 — Recovery validation and storage-object restoration

Backup runbook expressly says restore not rehearsed; object recovery separate; plan and isolated target unverified

- Source: SRS §25.8, PDF p177; SRS §25.20, PDF p181; SRS §26.13, PDF p188; docs/BACKUP_AND_RECOVERY.md; server/db/srsOps.ts.
- Evidence: server/healthRoute.test.ts (14 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B09: 5–9 person-days (shared package, NOT additive per row).

### GOV-13 — Performance throughput and capacity monitoring coverage

Memory/database size and some usage metrics exist, not a demonstrated continuous response-time/throughput/capacity-trend implementation

- Source: SRS §26.22, PDF p190; server/db/srsOps.ts; server/_core/healthRoute.ts.
- Evidence: server/concurrency.test.ts (0 passed, 9 skipped); server/queryPerformance.test.ts (0 passed, 6 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B11: 8–14 person-days (shared package, NOT additive per row).

### GOV-14 — Representative end-to-end capacity proof

Concurrency tests address narrow booking writes; no measured eight-workload capacity envelope located

- Source: SRS §26.4, PDF p185; SRS §26.6, PDF p185; SRS §26.7, PDF p186; server/concurrency.test.ts; server/queryPerformance.test.ts; server/db/connection.ts.
- Evidence: server/concurrency.test.ts (0 passed, 9 skipped); server/queryPerformance.test.ts (0 passed, 6 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B11: 8–14 person-days (shared package, NOT additive per row).

### GOV-16 — Usable generated invoice field verification

Stripe invoice links/checkout code exist; actual generated invoice containing verified issuer/customer fields is not supplied as independent evidence

- Source: SRS §16.6, PDF p91; server/_core/stripe.ts; server/routers/clientPortal.ts; server/routers/admin.ts.
- Evidence: server/admin.createInvoice.test.ts (4 passed, 0 skipped); server/stripe.test.ts (11 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B10: 2–4 person-days (shared package, NOT additive per row).

### GOV-26 — Audit retention and cascade deletion exception

Database trigger blocks direct edits/deletes but permits cascade deletes; retention-approved policy and deletion-survival proof missing

- Source: SRS §20.5, PDF p128; SRS §20.22, PDF p135; drizzle/0023_srs_completion.sql; server/_core/trpc.ts.
- Evidence: server/auditCoverage.test.ts (14 passed, 0 skipped); server/dbConstraints.test.ts (0 passed, 9 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B12: 3–6 person-days (shared package, NOT additive per row).

### GOV-29 — Release identity can be tied to deployed source

Current /health/version returns unknown commit and builtAt; historical source/deployment equality cannot be established

- Source: SRS §25.7, PDF p177; SRS §25.19, PDF p180; server/_core/healthRoute.ts; server/db/srsOps.ts.
- Evidence: server/healthRoute.test.ts (14 passed, 0 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B11: 8–14 person-days (shared package, NOT additive per row).

### GOV-31 — Cross-account isolation of application APIs

Source includes tenant and assignment guards, but report public-token access is an exception; historical PostgREST RLS tests do not prove all privileged-server APIs

- Source: SRS §19.11, PDF p120; SRS §21.12, PDF p141; server/routers/clientPortal.ts; server/routers/aiScans.ts; server/rls.negative.test.ts.
- Evidence: server/clientPortal.test.ts (37 passed, 0 skipped); server/rls.negative.test.ts (0 passed, 18 skipped); No matching live business demonstration located.
- Close with: Resolve the stated evidence or interpretation gap.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### SRS-02.1 — Only authorized users can access protected resources

Public report endpoints do not validate authenticated ownership; scope of global protection claim is overstated

- Source: SRS §8.16, PDF p41; server/_core/trpc.ts; server/_core/localAuthRoute.ts; server/routers/accounts.ts; server/routers/mfa.ts.
- Evidence: server/admin.modules.test.ts (65 passed, 0 skipped); server/developer.test.ts (33 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); server/rbac.authOrigin.test.ts (23 passed, 0 skipped); server/rls.negative.test.ts (0 passed, 18 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p99; historic screenshots: auth-anon-admin, auth-anon-client, auth-anon-dev, cl-forbidden-admin, dv-forbidden-admin.
- Close with: Public report endpoints do not validate authenticated ownership; scope of global protection claim is overstated.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### SRS-02.9 — Unauthorized access attempts are denied and logged

FORBIDDEN denials logged, UNAUTHORIZED deliberately excluded; complete unauthorized-resource attempt policy/evidence not established

- Source: SRS §8.16, PDF p41; server/_core/trpc.ts; server/_core/localAuthRoute.ts; server/routers/accounts.ts; server/routers/mfa.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/auditCoverage.test.ts (14 passed, 0 skipped); server/rbac.authOrigin.test.ts (23 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p155; historic screenshots: ad-gov-audit-blocked, cl-forbidden-admin, dv-forbidden-admin, auth-wrong-password.
- Close with: FORBIDDEN denials logged, UNAUTHORIZED deliberately excluded; complete unauthorized-resource attempt policy/evidence not established.
- Dependency: None specifically established.
- Estimate: B12: 3–6 person-days (shared package, NOT additive per row).

### SRS-03.4 — AI analysis is generated successfully

First successful live model analysis explicitly absent in report p180; guard fails open on registry error

- Source: SRS §9.11, PDF p47; server/routers/aiScans.ts; server/db/srsDelivery.ts; server/_core/stripeWebhookRoute.ts; server/_core/aiScanScoring.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/llm.test.ts (10 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p180; historic screenshots: ad-gov-ai, ad-plat-integrations, scan-result-published.
- Close with: First successful live model analysis explicitly absent in report p180; guard fails open on registry error.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### SRS-03.8 — All workflow stages are recorded in the audit log

Report state history exists, but complete audit claim has AI registry failure and token-download exception paths

- Source: SRS §9.11, PDF p47; server/routers/aiScans.ts; server/db/srsDelivery.ts; server/_core/stripeWebhookRoute.ts; server/_core/aiScanScoring.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/srsRules.test.ts (61 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p207; historic screenshots: ad-gov-scanreview-history, ad-gov-scanreview-all.
- Close with: Report state history exists, but complete audit claim has AI registry failure and token-download exception paths.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### SRS-03.9 — Notifications are delivered at each defined milestone

Email delivery and all defined provider milestone events not fully demonstrated

- Source: SRS §9.11, PDF p47; server/routers/aiScans.ts; server/db/srsDelivery.ts; server/_core/stripeWebhookRoute.ts; server/_core/aiScanScoring.ts.
- Evidence: server/clientNotifications.test.ts (3 passed, 0 skipped); server/notificationCatalogue.test.ts (14 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p214; historic screenshots: cl-ai-scans, cl-bell, ad-bell.
- Close with: Email delivery and all defined provider milestone events not fully demonstrated.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-04.6 — Documents can be downloaded securely

Organization ownership checked, but document governance lookup fails open on error

- Source: SRS §10.17, PDF p54; server/routers/clientPortal.ts; server/db/clientPortal.ts.
- Evidence: server/admin.documentLifecycle.test.ts (7 passed, 0 skipped); server/clientPortal.test.ts (37 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p241; historic screenshots: cl-documents, cl-documents-search.
- Close with: Organization ownership checked, but document governance lookup fails open on error.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### SRS-04.9 — Notifications are delivered successfully

In-app notifications implemented; required email/provider delivery not fully demonstrated

- Source: SRS §10.17, PDF p54; server/routers/clientPortal.ts; server/db/clientPortal.ts.
- Evidence: client/src/components/NotificationBell.test.tsx (14 passed, 0 skipped); server/clientNotifications.test.ts (3 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p256; historic screenshots: cl-bell, cl-account-prefs, cl-account-prefs-off.
- Close with: In-app notifications implemented; required email/provider delivery not fully demonstrated.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-05.7 — Notifications are delivered successfully

Notification paths exist; full real-provider delivery evidence is missing

- Source: SRS §11.15, PDF p60; server/routers/developer.ts; server/db/developerWorkspace.ts.
- Evidence: client/src/components/NotificationBell.test.tsx (14 passed, 0 skipped); server/developer.test.ts (33 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p302; historic screenshots: dv-bell, dv-profile-prefs.
- Close with: Notification paths exist; full real-provider delivery evidence is missing.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-06.9 — Notifications function correctly

Admin in-app bell exists; all defined events rely on still-missing producer workflows

- Source: SRS §12.17, PDF p67; server/routers/admin.ts; server/routers/adminOps.ts.
- Evidence: server/admin.summary.test.ts (6 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p362; historic screenshots: ad-bell, ad-automations.
- Close with: Admin in-app bell exists; all defined events rely on still-missing producer workflows.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-07.2 — Users and permissions can be managed securely

Role administration exists; complete individually scoped Technical Operator enforcement not substantiated

- Source: SRS §13.18, PDF p74; server/routers/admin.ts; server/routers/adminOps.ts; server/db/platformGovernance.ts.
- Evidence: server/accounts.test.ts (17 passed, 0 skipped); server/admin.modules.test.ts (65 passed, 0 skipped); server/admin.superAdmin.test.ts (17 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p374; historic screenshots: ad-users, ad-gov-invites.
- Close with: Role administration exists; complete individually scoped Technical Operator enforcement not substantiated.
- Dependency: None specifically established.
- Estimate: B03: 2–4 person-days (shared package, NOT additive per row).

### SRS-07.3 — Technical Operator permissions are configurable

Grant/expiry/revocation and Security Center scope check exist; other ops endpoints remain role-gated

- Source: SRS §13.18, PDF p74; server/routers/admin.ts; server/routers/adminOps.ts; server/db/platformGovernance.ts.
- Evidence: server/ops.test.ts (22 passed, 0 skipped); server/platformRules.test.ts (15 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p378; historic screenshots: ad-plat-scopes, ad-users.
- Close with: Grant/expiry/revocation and Security Center scope check exist; other ops endpoints remain role-gated.
- Dependency: None specifically established.
- Estimate: B03: 2–4 person-days (shared package, NOT additive per row).

### SRS-07.4 — AI configuration is versioned and auditable

Prompt/version/audit tables exist; complete AI configuration claim includes missing registry/provider governance

- Source: SRS §13.18, PDF p74; server/routers/admin.ts; server/routers/adminOps.ts; server/db/platformGovernance.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/aiGovernance.test.ts (6 passed, 0 skipped); server/srsRules.test.ts (61 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p382; historic screenshots: ad-agents, ad-gov-ai, ad-gov-ai-2.
- Close with: Prompt/version/audit tables exist; complete AI configuration claim includes missing registry/provider governance.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row).

### SRS-07.8 — Integration settings can be managed

Environment/provider status and webhook controls exist; required provider priority/fallback not demonstrated

- Source: SRS §13.18, PDF p74; server/routers/admin.ts; server/routers/adminOps.ts; server/db/platformGovernance.ts.
- Evidence: server/admin.webhooks.test.ts (8 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p410; historic screenshots: ad-plat-integrations, ad-plat-integrations-test, ad-automations.
- Close with: Environment/provider status and webhook controls exist; required provider priority/fallback not demonstrated.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row).

### SRS-08.2 — Discovery Calls can be scheduled and tracked

Guest reschedule confirms new slot then cancels all booking slots, and does not update booking time/reminders

- Source: SRS §14.15, PDF p80; server/routers/bookings.ts; server/db/srsSales.ts; server/routers/adminOps.ts.
- Evidence: server/bookingAdmin.test.ts (12 passed, 0 skipped); server/bookingReminders.test.ts (7 passed, 0 skipped); server/bookings.test.ts (12 passed, 0 skipped); server/concurrency.test.ts (0 passed, 9 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p430; historic screenshots: ad-strategy-calls, ad-availability, ad-sales-activities.
- Close with: Guest reschedule confirms new slot then cancels all booking slots, and does not update booking time/reminders.
- Dependency: None specifically established.
- Estimate: B02: 2–4 person-days (shared package, NOT additive per row).

### SRS-09.4 — Project documentation is securely managed

Organization uploads exist; project association and controlled client/developer routing not substantiated

- Source: SRS §15.18, PDF p89; server/routers/admin.ts; server/db/srsSales.ts; server/db/developerWorkspace.ts.
- Evidence: server/admin.documentLifecycle.test.ts (7 passed, 0 skipped); server/clientPortal.test.ts (37 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p475; historic screenshots: ad-documents, cl-documents, dv-files.
- Close with: Organization uploads exist; project association and controlled client/developer routing not substantiated.
- Dependency: None specifically established.
- Estimate: B07: 5–9 person-days (shared package, NOT additive per row).

### SRS-09.6 — Notifications are delivered successfully

Dispatcher exists; all real provider/event delivery not demonstrated

- Source: SRS §15.18, PDF p89; server/routers/admin.ts; server/db/srsSales.ts; server/db/developerWorkspace.ts.
- Evidence: server/notificationDispatcher.test.ts (14 passed, 0 skipped); server/notifications.test.ts (6 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p484; historic screenshots: cl-bell, dv-bell, ad-bell.
- Close with: Dispatcher exists; all real provider/event delivery not demonstrated.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-10.2 — Invoices are generated correctly

Invoice records/links exist; independent usable generated invoice field evidence unavailable

- Source: SRS §16.15, PDF p95; server/db/srsSales.ts; server/routers/clientPortal.ts; server/_core/stripe.ts.
- Evidence: server/admin.createInvoice.test.ts (4 passed, 0 skipped); server/clientPortal.test.ts (37 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p500; historic screenshots: ad-billing, cl-billing.
- Close with: Invoice records/links exist; independent usable generated invoice field evidence unavailable.
- Dependency: None specifically established.
- Estimate: B10: 2–4 person-days (shared package, NOT additive per row).

### SRS-11.1 — Notifications are generated for all defined business events

Catalogue entries are not producers; report p795 acknowledges untriggered telephony/integration events

- Source: SRS §17.13, PDF p102; server/notificationDispatcher.ts; server/notifications.ts; server/email.ts.
- Evidence: server/bookingReminders.test.ts (7 passed, 0 skipped); server/notificationCatalogue.test.ts (14 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); server/paymentSync.test.ts (5 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p524; historic screenshots: ad-bell, cl-bell, ad-gov-comms.
- Close with: Catalogue entries are not producers; report p795 acknowledges untriggered telephony/integration events.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-11.2 — Email and in-app notifications are delivered successfully

Real IO SKY mailbox delivery missing; console fallback reports success without delivery

- Source: SRS §17.13, PDF p102; server/notificationDispatcher.ts; server/notifications.ts; server/email.ts.
- Evidence: server/email-i18n.test.ts (9 passed, 0 skipped); server/emailBranding.test.ts (3 passed, 0 skipped); server/emailDeliveryLogging.test.ts (3 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); server/resendWebhook.test.ts (6 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p529; historic screenshots: cl-bell, ad-bell, ad-gov-comms.
- Close with: Real IO SKY mailbox delivery missing; console fallback reports success without delivery.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-11.4 — Communication history is maintained

Notification history exists; complete required voice/AI communication histories do not

- Source: SRS §17.13, PDF p102; server/notificationDispatcher.ts; server/notifications.ts; server/email.ts.
- Evidence: server/emailDeliveryLogging.test.ts (3 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p538; historic screenshots: ad-gov-comms.
- Close with: Notification history exists; complete required voice/AI communication histories do not.
- Dependency: None specifically established.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-11.5 — Notification templates function correctly

Versioned templates exist; exact approved copy and live delivery remain unverified

- Source: SRS §17.13, PDF p102; server/notificationDispatcher.ts; server/notifications.ts; server/email.ts.
- Evidence: server/paymentSync.test.ts (5 passed, 0 skipped); server/platformRules.test.ts (15 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p543; historic screenshots: ad-plat-templates, ad-gov-comms.
- Close with: Versioned templates exist; exact approved copy and live delivery remain unverified.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-11.7 — Security notifications are always delivered according to platform policy

Security preferences cannot opt out; guaranteed retry/escalation/delivery policy is not fully evidenced

- Source: SRS §17.13, PDF p102; server/notificationDispatcher.ts; server/notifications.ts; server/email.ts.
- Evidence: server/notificationCatalogue.test.ts (14 passed, 0 skipped); server/notificationDispatcher.test.ts (14 passed, 0 skipped); server/srsRules.test.ts (61 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p551; historic screenshots: cl-account-prefs, dv-profile-prefs.
- Close with: Security preferences cannot opt out; guaranteed retry/escalation/delivery policy is not fully evidenced.
- Dependency: None specifically established.
- Estimate: B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-12.1 — Documents can be uploaded and downloaded securely

Storage paths and historical evidence exist; governance lookup fail-open weakens secure access claim

- Source: SRS §18.14, PDF p111; server/routers/clientPortal.ts; server/db/platformGovernance.ts; server/db/clientPortal.ts.
- Evidence: server/admin.documentLifecycle.test.ts (7 passed, 0 skipped); server/clientPortal.test.ts (37 passed, 0 skipped); server/developer.test.ts (33 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p556; historic screenshots: cl-documents, ad-documents, dv-files.
- Close with: Storage paths and historical evidence exist; governance lookup fail-open weakens secure access claim.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### SRS-12.3 — Permissions are enforced correctly

Document matrix is provisional and failures permit an empty deny set

- Source: SRS §18.14, PDF p111; server/routers/clientPortal.ts; server/db/platformGovernance.ts; server/db/clientPortal.ts.
- Evidence: server/admin.documentLifecycle.test.ts (7 passed, 0 skipped); server/platformRules.test.ts (15 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p563; historic screenshots: ad-plat-matrix, cl-documents.
- Close with: Document matrix is provisional and failures permit an empty deny set.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B12: 3–6 person-days (shared package, NOT additive per row).

### SRS-12.6 — Automated document workflows execute successfully

Some scheduled/document triggers exist; full retention/archive behaviour depends on missing approved policy values

- Source: SRS §18.14, PDF p111; server/routers/clientPortal.ts; server/db/platformGovernance.ts; server/db/clientPortal.ts.
- Evidence: server/admin.workflows.test.ts (11 passed, 0 skipped); server/workflowEngine.test.ts (5 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p574; historic screenshots: ad-automations.
- Close with: Some scheduled/document triggers exist; full retention/archive behaviour depends on missing approved policy values.
- Dependency: None specifically established.
- Estimate: B12: 3–6 person-days (shared package, NOT additive per row).

### SRS-13.1 — AI Agents operate according to assigned permissions

AI guard deliberately returns allowed:true when registry fails; missing database returns null verdict

- Source: SRS §19.14, PDF p121; server/aiGovernance.ts; server/db/srsGovernance.ts; server/leadEvaluation.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/srsRules.test.ts (61 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p582; historic screenshots: ad-agents, ad-gov-ai.
- Close with: AI guard deliberately returns allowed:true when registry fails; missing database returns null verdict.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### SRS-13.2 — AI workflows execute successfully

Only two model workflows found; report identifies missing first successful live analysis

- Source: SRS §19.14, PDF p121; server/aiGovernance.ts; server/db/srsGovernance.ts; server/leadEvaluation.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/aiScanScoring.test.ts (7 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p585; historic screenshots: ad-plat-aiusage, ad-gov-ai.
- Close with: Only two model workflows found; report identifies missing first successful live analysis.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### SRS-13.3 — AI recommendations are generated correctly

Mocked recommendation tests do not establish first successful live output or full required AI workflow coverage

- Source: SRS §19.14, PDF p121; server/aiGovernance.ts; server/db/srsGovernance.ts; server/leadEvaluation.ts.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p589; historic screenshots: ad-plat-aiusage.
- Close with: Mocked recommendation tests do not establish first successful live output or full required AI workflow coverage.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### SRS-13.5 — AI activities are audited

Registry-failure path allows execution without execution/audit record

- Source: SRS §19.14, PDF p121; server/aiGovernance.ts; server/db/srsGovernance.ts; server/leadEvaluation.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p595; historic screenshots: ad-gov-ai.
- Close with: Registry-failure path allows execution without execution/audit record.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### SRS-13.7 — AI services integrate successfully with platform modules

Two modules integrate structurally; required communication/context/provider functionality remains incomplete

- Source: SRS §19.14, PDF p121; server/aiGovernance.ts; server/db/srsGovernance.ts; server/leadEvaluation.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/integrations.test.ts (11 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p603; historic screenshots: ad-gov-ai, ad-plat-aiusage.
- Close with: Two modules integrate structurally; required communication/context/provider functionality remains incomplete.
- Dependency: None specifically established.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B05: 12–20 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row).

### SRS-14.1 — Audit records are generated for all business critical activities

Central audit exists but mandatory AI and public-report paths have identified evidence gaps

- Source: SRS §20.14, PDF p131; server/db/srsGovernance.ts; server/_core/trpc.ts; server/routers/ops.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/auditCoverage.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p607; historic screenshots: ad-audit, ad-gov-audit.
- Close with: Central audit exists but mandatory AI and public-report paths have identified evidence gaps.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B12: 3–6 person-days (shared package, NOT additive per row).

### SRS-14.3 — Compliance monitoring functions correctly

Operational checks exist; missing authoritative companion and governance rules prevent broad compliance conclusion

- Source: SRS §20.14, PDF p131; server/db/srsGovernance.ts; server/_core/trpc.ts; server/routers/ops.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/srsRules.test.ts (61 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p615; historic screenshots: ad-gov-compliance.
- Close with: Operational checks exist; missing authoritative companion and governance rules prevent broad compliance conclusion.
- Dependency: None specifically established.
- Estimate: B12: 3–6 person-days (shared package, NOT additive per row).

### SRS-14.6 — Audit history remains immutable

Direct mutation triggers exist; cascade deletion exception requires retention-safe policy/proof

- Source: SRS §20.14, PDF p131; server/db/srsGovernance.ts; server/_core/trpc.ts; server/routers/ops.ts.
- Evidence: server/auditCoverage.test.ts (14 passed, 0 skipped); server/dbConstraints.test.ts (0 passed, 9 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p627; historic screenshots: ad-gov-scanreview-history.
- Close with: Direct mutation triggers exist; cascade deletion exception requires retention-safe policy/proof.
- Dependency: None specifically established.
- Estimate: B12: 3–6 person-days (shared package, NOT additive per row).

### SRS-15.5 — Dashboard permissions are enforced

Analytics is role-gated; precise requested Admin finance restrictions not established across APIs/exports

- Source: SRS §21.14, PDF p141; server/db/srsOps.ts; server/routers/admin.ts.
- Evidence: server/admin.modules.test.ts (65 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p651; historic screenshots: ad-overview, cl-forbidden-admin.
- Close with: Analytics is role-gated; precise requested Admin finance restrictions not established across APIs/exports.
- Dependency: None specifically established.
- Estimate: B03: 2–4 person-days (shared package, NOT additive per row); B12: 3–6 person-days (shared package, NOT additive per row).

### SRS-16.2 — Integrations function correctly

Historical Stripe test mode exists; required telephony/AI/email integrations not all functional

- Source: SRS §22.13, PDF p151; server/integrations.ts; server/webhookDispatcher.ts; server/paymentSync.ts.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); server/resendWebhook.test.ts (6 passed, 0 skipped); server/stripe.test.ts (11 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p665; historic screenshots: ad-plat-integrations-test, ad-plat-integrations.
- Close with: Historical Stripe test mode exists; required telephony/AI/email integrations not all functional.
- Dependency: None specifically established.
- Estimate: B04: 20–35 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row); B08: 6–10 person-days (shared package, NOT additive per row).

### SRS-18.6 — AI configuration functions correctly

Class-based model selection exists; full SRS provider priority/fallback/usage-limit configuration not demonstrated

- Source: SRS §24.15, PDF p170; server/db/platformGovernance.ts; server/_core/policy.ts.
- Evidence: server/aiGovernance.test.ts (6 passed, 0 skipped); server/llm.test.ts (10 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p731; historic screenshots: ad-gov-ai, ad-agents.
- Close with: Class-based model selection exists; full SRS provider priority/fallback/usage-limit configuration not demonstrated.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row).

### SRS-19.3 — Backup and recovery processes are available

Runbook expressly records unconfirmed backup plan, no restore rehearsal and separate storage recovery gap

- Source: SRS §25.14, PDF p179; server/_core/operations.ts; server/db/srsOps.ts; server/_core/healthRoute.ts.
- Evidence: server/healthRoute.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p748; historic screenshots: ad-gov-health.
- Close with: Runbook expressly records unconfirmed backup plan, no restore rehearsal and separate storage recovery gap.
- Dependency: None specifically established.
- Estimate: B09: 5–9 person-days (shared package, NOT additive per row).

### SRS-19.5 — Release management is operational

Startup/history code exists, but current public deployment identity is unknown; reliable release attestation not established

- Source: SRS §25.14, PDF p179; server/_core/operations.ts; server/db/srsOps.ts; server/_core/healthRoute.ts.
- Evidence: server/healthRoute.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p754; historic screenshots: ad-gov-health.
- Close with: Startup/history code exists, but current public deployment identity is unknown; reliable release attestation not established.
- Dependency: None specifically established.
- Estimate: B11: 8–14 person-days (shared package, NOT additive per row).

### SRS-19.6 — Capacity monitoring functions correctly

Memory/database size monitored; continuous full capacity metrics/trends not established

- Source: SRS §25.14, PDF p179; server/_core/operations.ts; server/db/srsOps.ts; server/_core/healthRoute.ts.
- Evidence: server/concurrency.test.ts (0 passed, 9 skipped); server/queryPerformance.test.ts (0 passed, 6 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p758; historic screenshots: ad-gov-health.
- Close with: Memory/database size monitored; continuous full capacity metrics/trends not established.
- Dependency: None specifically established.
- Estimate: B11: 8–14 person-days (shared package, NOT additive per row).

### SRS-20.1 — All platform modules comply with these requirements

Confirmed baseline gaps prevent all-modules-compliant conclusion

- Source: SRS §26.18, PDF p189; server/_core/trpc.ts; server/_core/securityHeaders.ts; server/db/srsOps.ts.
- Evidence: server/dbConstraints.test.ts (0 passed, 9 skipped); server/designLanguage.test.ts (30 passed, 0 skipped); server/i18n.completeness.test.ts (10 passed, 0 skipped); server/inputValidationCoverage.test.ts (5 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p762; historic screenshots: ad-overview, pub-home.
- Close with: Confirmed baseline gaps prevent all-modules-compliant conclusion.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B04: 20–35 person-days (shared package, NOT additive per row); B06: 8–14 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### SRS-20.2 — Non functional requirements are consistently enforced

Fail-open governance and ownership paths contradict consistently enforced global requirements

- Source: SRS §26.18, PDF p189; server/_core/trpc.ts; server/_core/securityHeaders.ts; server/db/srsOps.ts.
- Evidence: server/apiHardening.test.ts (29 passed, 0 skipped); server/auditCoverage.test.ts (14 passed, 0 skipped); server/inputValidationCoverage.test.ts (5 passed, 0 skipped); server/localAuth.errors.test.ts (17 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p768; historic screenshots: ad-gov-audit, ad-gov-audit-blocked.
- Close with: Fail-open governance and ownership paths contradict consistently enforced global requirements.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### SRS-20.4 — Operational standards are satisfied

Recovery validation, isolated environments and full observability remain unverified

- Source: SRS §26.18, PDF p189; server/_core/trpc.ts; server/_core/securityHeaders.ts; server/db/srsOps.ts.
- Evidence: server/healthRoute.test.ts (14 passed, 0 skipped); server/stagingGate.test.ts (11 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p776; historic screenshots: ad-gov-health, ad-plat-integrations, ad-maint-form.
- Close with: Recovery validation, isolated environments and full observability remain unverified.
- Dependency: None specifically established.
- Estimate: B09: 5–9 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### SRS-20.5 — Security standards are satisfied

Public report owner checks, AI guard and document matrix exception paths prevent full security conformance

- Source: SRS §26.18, PDF p189; server/_core/trpc.ts; server/_core/securityHeaders.ts; server/db/srsOps.ts.
- Evidence: server/apiHardening.test.ts (29 passed, 0 skipped); server/cookieSecurity.test.ts (20 passed, 0 skipped); server/localAuth.errors.test.ts (17 passed, 0 skipped); server/localAuth.mfa.test.ts (4 passed, 0 skipped); server/mfa.test.ts (14 passed, 0 skipped); server/rls.negative.test.ts (0 passed, 18 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p782; historic screenshots: ad-security, ad-gov-audit-blocked, ad-my-security.
- Close with: Public report owner checks, AI guard and document matrix exception paths prevent full security conformance.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B03: 2–4 person-days (shared package, NOT additive per row).

### SRS-20.6 — Reliability objectives are achieved

Reschedule defect, unrehearsed restore and absent representative capacity tests prevent broad reliability conclusion

- Source: SRS §26.18, PDF p189; server/_core/trpc.ts; server/_core/securityHeaders.ts; server/db/srsOps.ts.
- Evidence: server/concurrency.test.ts (0 passed, 9 skipped); server/healthRoute.test.ts (14 passed, 0 skipped); server/queryPerformance.test.ts (0 passed, 6 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p789; historic screenshots: ad-gov-health.
- Close with: Reschedule defect, unrehearsed restore and absent representative capacity tests prevent broad reliability conclusion.
- Dependency: None specifically established.
- Estimate: B02: 2–4 person-days (shared package, NOT additive per row); B09: 5–9 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### BR-001 — BR-001   Authentication Required Only authenticated users may access protected platform resources. Public users may only access pu

Global rule needs qualification or more precise proof; see SRS-02.1 and cross-cutting capability findings

- Source: BR-001, PDF p12; Appendix B, PDF pp195–196; server/_core/trpc.ts; server/_core/localAuthRoute.ts; server/routers/accounts.ts; server/routers/mfa.ts.
- Evidence: server/admin.modules.test.ts (65 passed, 0 skipped); server/developer.test.ts (33 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); server/rbac.authOrigin.test.ts (23 passed, 0 skipped); server/rls.negative.test.ts (0 passed, 18 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p99; historic screenshots: auth-anon-admin, auth-anon-client, auth-anon-dev, cl-forbidden-admin, dv-forbidden-admin.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### BR-002 — BR-002   Single Identity Each user

Global rule needs qualification or more precise proof; see SRS-02.2 and cross-cutting capability findings

- Source: BR-002, PDF p12; Appendix B, PDF pp195–196; server/_core/trpc.ts; server/_core/localAuthRoute.ts; server/routers/accounts.ts; server/routers/mfa.ts.
- Evidence: server/accounts.test.ts (17 passed, 0 skipped); server/supabaseAuth.test.ts (5 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p110; historic screenshots: auth-no-signup, pub-login.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: Shared baseline packages / traceability review; no additive per-rule estimate.

### BR-005 — BR-005   Organization Ownership Every user must belong to at least one Organization. No user may exist without an associated Organ

Global rule needs qualification or more precise proof; see SRS-09.4 and cross-cutting capability findings

- Source: BR-005, PDF p13; Appendix B, PDF pp195–196; server/routers/admin.ts; server/db/srsSales.ts; server/db/developerWorkspace.ts.
- Evidence: server/admin.documentLifecycle.test.ts (7 passed, 0 skipped); server/clientPortal.test.ts (37 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p475; historic screenshots: ad-documents, cl-documents, dv-files.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B07: 5–9 person-days (shared package, NOT additive per row).

### BR-006 — BR-006   Organization Isolation Organizations must remain completely isolated. Users

Global rule needs qualification or more precise proof; see SRS-02.1 and cross-cutting capability findings

- Source: BR-006, PDF p13; Appendix B, PDF pp195–196; server/_core/trpc.ts; server/_core/localAuthRoute.ts; server/routers/accounts.ts; server/routers/mfa.ts.
- Evidence: server/admin.modules.test.ts (65 passed, 0 skipped); server/developer.test.ts (33 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); server/rbac.authOrigin.test.ts (23 passed, 0 skipped); server/rls.negative.test.ts (0 passed, 18 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p99; historic screenshots: auth-anon-admin, auth-anon-client, auth-anon-dev, cl-forbidden-admin, dv-forbidden-admin.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### BR-007 — BR-007   Data Ownership All business records

Global rule needs qualification or more precise proof; see SRS-02.1 and cross-cutting capability findings

- Source: BR-007, PDF p13; Appendix B, PDF pp195–196; server/_core/trpc.ts; server/_core/localAuthRoute.ts; server/routers/accounts.ts; server/routers/mfa.ts.
- Evidence: server/admin.modules.test.ts (65 passed, 0 skipped); server/developer.test.ts (33 passed, 0 skipped); server/ops.test.ts (22 passed, 0 skipped); server/rbac.authOrigin.test.ts (23 passed, 0 skipped); server/rls.negative.test.ts (0 passed, 18 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p99; historic screenshots: auth-anon-admin, auth-anon-client, auth-anon-dev, cl-forbidden-admin, dv-forbidden-admin.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row).

### BR-010 — BR-010   AI Transparency Whenever content has been generated or substantially modified by AI, the platform

Global rule needs qualification or more precise proof; see SRS-13.3 and cross-cutting capability findings

- Source: BR-010, PDF p14; Appendix B, PDF pp195–196; server/aiGovernance.ts; server/db/srsGovernance.ts; server/leadEvaluation.ts.
- Evidence: server/integrations.test.ts (11 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p589; historic screenshots: ad-plat-aiusage.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B06: 8–14 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### BR-013 — BR-013   Least Privilege Every user

Global rule needs qualification or more precise proof; see SRS-07.3 and cross-cutting capability findings

- Source: BR-013, PDF p14; Appendix B, PDF pp195–196; server/routers/admin.ts; server/routers/adminOps.ts; server/db/platformGovernance.ts.
- Evidence: server/ops.test.ts (22 passed, 0 skipped); server/platformRules.test.ts (15 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p378; historic screenshots: ad-plat-scopes, ad-users.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B03: 2–4 person-days (shared package, NOT additive per row).

### BR-016 — BR-016   Report Lifecycle Every report

Global rule needs qualification or more precise proof; see SRS-03.6 and cross-cutting capability findings

- Source: BR-016, PDF p15; Appendix B, PDF pp195–196; server/routers/aiScans.ts; server/db/srsDelivery.ts; server/_core/stripeWebhookRoute.ts; server/_core/aiScanScoring.ts.
- Evidence: server/admin.reportsProjects.test.ts (11 passed, 0 skipped); server/admin.srsOps.test.ts (38 passed, 0 skipped); server/srsRules.test.ts (61 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p192; historic screenshots: scan-result-review, scan-result-revision, scan-result-published.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: Shared baseline packages / traceability review; no additive per-rule estimate.

### BR-017 — BR-017   Version Control Every published report

Global rule needs qualification or more precise proof; see SRS-03.8 and cross-cutting capability findings

- Source: BR-017, PDF p15; Appendix B, PDF pp195–196; server/routers/aiScans.ts; server/db/srsDelivery.ts; server/_core/stripeWebhookRoute.ts; server/_core/aiScanScoring.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/srsRules.test.ts (61 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p207; historic screenshots: ad-gov-scanreview-history, ad-gov-scanreview-all.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B11: 8–14 person-days (shared package, NOT additive per row).

### BR-018 — BR-018   Project Ownership Every project must have: • One owning Organization • One responsible Admin • One current status • Devel

Global rule needs qualification or more precise proof; see SRS-09.4 and cross-cutting capability findings

- Source: BR-018, PDF p15; Appendix B, PDF pp195–196; server/routers/admin.ts; server/db/srsSales.ts; server/db/developerWorkspace.ts.
- Evidence: server/admin.documentLifecycle.test.ts (7 passed, 0 skipped); server/clientPortal.test.ts (37 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p475; historic screenshots: ad-documents, cl-documents, dv-files.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B07: 5–9 person-days (shared package, NOT additive per row).

### BR-020 — BR-020   Audit Logging All security-sensitive and business-critical actions

Global rule needs qualification or more precise proof; see SRS-14.1 and cross-cutting capability findings

- Source: BR-020, PDF p15; Appendix B, PDF pp195–196; server/db/srsGovernance.ts; server/_core/trpc.ts; server/routers/ops.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/auditCoverage.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p607; historic screenshots: ad-audit, ad-gov-audit.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B12: 3–6 person-days (shared package, NOT additive per row).

### BR-024 — BR-024   Technical Operator Access Technical Operators

Global rule needs qualification or more precise proof; see SRS-07.3 and cross-cutting capability findings

- Source: BR-024, PDF p16; Appendix B, PDF pp195–196; server/routers/admin.ts; server/routers/adminOps.ts; server/db/platformGovernance.ts.
- Evidence: server/ops.test.ts (22 passed, 0 skipped); server/platformRules.test.ts (15 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p378; historic screenshots: ad-plat-scopes, ad-users.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B03: 2–4 person-days (shared package, NOT additive per row).

### BR-025 — BR-025   Technical Operator Accountability Every action performed by a Technical Operator

Global rule needs qualification or more precise proof; see SRS-14.1 and cross-cutting capability findings

- Source: BR-025, PDF p16; Appendix B, PDF pp195–196; server/db/srsGovernance.ts; server/_core/trpc.ts; server/routers/ops.ts.
- Evidence: server/admin.srsOps.test.ts (38 passed, 0 skipped); server/auditCoverage.test.ts (14 passed, 0 skipped); docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf, PDF p607; historic screenshots: ad-audit, ad-gov-audit.
- Close with: Validate the global rule across applicable resources, including reported exception paths; do not infer all code is absent.
- Dependency: None specifically established.
- Estimate: B01: 4–7 person-days (shared package, NOT additive per row); B12: 3–6 person-days (shared package, NOT additive per row).

## Forward verification exceptions — no missing-code assumption

These 230 normative sections have candidate module code/test links but insufficient individual proof of every duty. Review those functions/assertions before deciding whether a defect exists. All share the 8–16 day evidence-review allowance; development is not automatically inferred. Full details are in the CSV.

| ID | Clause/title | Required closure |
| --- | --- | --- |
| FWD-1.3 | SRS §1.3, PDF p7 — Primary Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-1.5 | SRS §1.5, PDF p8 — Guiding Principle | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-2.3 | SRS §2.3, PDF p9 — Product Philosophy | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-5.3 | SRS §5.3, PDF p18 — Client | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-5.4 | SRS §5.4, PDF p19 — Developer | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-5.5 | SRS §5.5, PDF p20 — Admin | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-5.6 | SRS §5.6, PDF p21 — Super Admin | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-5.9 | SRS §5.9, PDF p23 — Authorization Model | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-5.10 | SRS §5.10, PDF p24 — Future Extensibility | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-6.2 | SRS §6.2, PDF p25 — Platform Architecture Overview | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-6.4 | SRS §6.4, PDF p26 — Core Platform Services | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-6.5 | SRS §6.5, PDF p27 — Module Communication | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-6.6 | SRS §6.6, PDF p28 — Data Ownership | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-6.7 | SRS §6.7, PDF p28 — Event-Driven Platform | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-6.8 | SRS §6.8, PDF p29 — Human Approval Workflow | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-6.10 | SRS §6.10, PDF p29 — Scalability Principles | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-6.11 | SRS §6.11, PDF p30 — Platform Design Principles | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-7.2 | SRS §7.2, PDF p31 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-7.5 | SRS §7.5, PDF p32 — Website Navigation | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-7.7 | SRS §7.7, PDF p33 — Primary Conversion Paths | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-7.11 | SRS §7.11, PDF p34 — Notifications | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-7.12 | SRS §7.12, PDF p35 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.2 | SRS §8.2, PDF p37 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.5 | SRS §8.5, PDF p38 — Authentication Principles | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.6 | SRS §8.6, PDF p38 — Account Creation | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.7 | SRS §8.7, PDF p39 — Account Activation | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.8 | SRS §8.8, PDF p39 — Authentication Workflow | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.9 | SRS §8.9, PDF p39 — Password Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.10 | SRS §8.10, PDF p40 — Multi-Factor Authentication | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.11 | SRS §8.11, PDF p40 — Session Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.12 | SRS §8.12, PDF p40 — Portal Routing | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.13 | SRS §8.13, PDF p40 — Authorization | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-8.14 | SRS §8.14, PDF p41 — Audit Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-9.2 | SRS §9.2, PDF p43 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-9.9 | SRS §9.9, PDF p47 — Notifications | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.2 | SRS §10.2, PDF p49 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.5 | SRS §10.5, PDF p50 — Dashboard | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.6 | SRS §10.6, PDF p50 — AI Scan Center | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.8 | SRS §10.8, PDF p51 — Project Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.9 | SRS §10.9, PDF p51 — Document Center | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.10 | SRS §10.10, PDF p52 — Billing | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.11 | SRS §10.11, PDF p52 — Messages | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.12 | SRS §10.12, PDF p52 — Notifications | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.13 | SRS §10.13, PDF p53 — Profile & Security | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.14 | SRS §10.14, PDF p53 — Service Requests | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-10.16 | SRS §10.16, PDF p53 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.2 | SRS §11.2, PDF p56 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.5 | SRS §11.5, PDF p57 — Developer Dashboard | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.6 | SRS §11.6, PDF p57 — Project Workspace | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.7 | SRS §11.7, PDF p58 — Task Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.8 | SRS §11.8, PDF p58 — Deliverable Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.9 | SRS §11.9, PDF p58 — Time Registration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.10 | SRS §11.10, PDF p59 — Internal Communication | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.11 | SRS §11.11, PDF p59 — Notifications | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.12 | SRS §11.12, PDF p59 — Profile & Security | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-11.14 | SRS §11.14, PDF p60 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.2 | SRS §12.2, PDF p62 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.6 | SRS §12.6, PDF p63 — Customer Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.7 | SRS §12.7, PDF p64 — AI Scan Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.8 | SRS §12.8, PDF p64 — Report Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.9 | SRS §12.9, PDF p64 — Project Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.10 | SRS §12.10, PDF p65 — Developer Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.11 | SRS §12.11, PDF p65 — Communication Center | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.12 | SRS §12.12, PDF p65 — Billing Overview | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.13 | SRS §12.13, PDF p66 — Notifications | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.14 | SRS §12.14, PDF p66 — Operational Analytics | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-12.16 | SRS §12.16, PDF p67 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-13.2 | SRS §13.2, PDF p69 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-13.7 | SRS §13.7, PDF p71 — User & Role Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-13.9 | SRS §13.9, PDF p72 — AI Configuration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-13.10 | SRS §13.10, PDF p72 — Security Center | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-13.11 | SRS §13.11, PDF p72 — Audit Center | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-13.12 | SRS §13.12, PDF p72 — Platform Configuration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-13.14 | SRS §13.14, PDF p73 — Notification Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-13.15 | SRS §13.15, PDF p73 — Business Intelligence | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-13.17 | SRS §13.17, PDF p74 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-14.2 | SRS §14.2, PDF p76 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-14.5 | SRS §14.5, PDF p77 — Lead Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-14.6 | SRS §14.6, PDF p77 — Lead Lifecycle | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-14.8 | SRS §14.8, PDF p78 — Opportunity Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-14.9 | SRS §14.9, PDF p78 — Proposal Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-14.10 | SRS §14.10, PDF p79 — Customer Timeline | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-14.11 | SRS §14.11, PDF p79 — Activity Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-14.12 | SRS §14.12, PDF p79 — Project Handover | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-14.14 | SRS §14.14, PDF p80 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.2 | SRS §15.2, PDF p83 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.5 | SRS §15.5, PDF p84 — Project Lifecycle | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.6 | SRS §15.6, PDF p85 — Project Planning | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.7 | SRS §15.7, PDF p85 — Task Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.8 | SRS §15.8, PDF p85 — Milestone Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.9 | SRS §15.9, PDF p86 — Deliverable Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.10 | SRS §15.10, PDF p86 — Resource Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.11 | SRS §15.11, PDF p86 — Risk & Issue Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.12 | SRS §15.12, PDF p87 — Customer Approval | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.14 | SRS §15.14, PDF p87 — Project Completion | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-15.17 | SRS §15.17, PDF p88 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.2 | SRS §16.2, PDF p90 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.5 | SRS §16.5, PDF p91 — Quote Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.9.1 | SRS §16.9.1, PDF p92 — One-Time Products | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.9.2 | SRS §16.9.2, PDF p93 — Subscription Products | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.9.3 | SRS §16.9.3, PDF p93 — Commercial Lifecycle | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.9.4 | SRS §16.9.4, PDF p93 — Future Product Expansion | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.10 | SRS §16.10, PDF p94 — Financial History | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.11 | SRS §16.11, PDF p94 — Financial Reporting | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.13 | SRS §16.13, PDF p95 — Automation Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-16.14 | SRS §16.14, PDF p95 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-17.2 | SRS §17.2, PDF p97 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-17.5 | SRS §17.5, PDF p98 — Notification Categories | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-17.7 | SRS §17.7, PDF p100 — Notification Preferences | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-17.12 | SRS §17.12, PDF p101 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.2 | SRS §18.2, PDF p107 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.5 | SRS §18.5, PDF p108 — Supported Documents | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.7 | SRS §18.7, PDF p109 — Version Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.9 | SRS §18.9, PDF p110 — Document Approval Workflow | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.10 | SRS §18.10, PDF p110 — Search & Retrieval | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.11 | SRS §18.11, PDF p110 — Automation Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.12 | SRS §18.12, PDF p111 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.16 | SRS §18.16, PDF p112 — Document Lifecycle | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.17 | SRS §18.17, PDF p112 — Document Classification | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.18 | SRS §18.18, PDF p113 — File Validation | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.19 | SRS §18.19, PDF p113 — Storage & Retention Policies | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-18.22 | SRS §18.22, PDF p116 — Business Continuity & Disaster Recovery | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-19.2 | SRS §19.2, PDF p117 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-19.6 | SRS §19.6, PDF p119 — AI Orchestration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-19.9 | SRS §19.9, PDF p120 — AI Prompt Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.2 | SRS §20.2, PDF p127 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.6 | SRS §20.6, PDF p129 — Security Monitoring | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.7 | SRS §20.7, PDF p129 — Compliance Monitoring | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.8 | SRS §20.8, PDF p129 — Security Incident | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.9 | SRS §20.9, PDF p130 — Event History | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.10 | SRS §20.10, PDF p130 — Monitoring & Alerting | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.11 | SRS §20.11, PDF p130 — Automation Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.12 | SRS §20.12, PDF p131 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.17 | SRS §20.17, PDF p132 — Audit Event Matrix | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.18 | SRS §20.18, PDF p133 — Incident Severity Matrix | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.19 | SRS §20.19, PDF p134 — Compliance Control Matrix | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.20 | SRS §20.20, PDF p135 — Security Policy Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.21 | SRS §20.21, PDF p135 — Threat Detection & Response | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.23 | SRS §20.23, PDF p136 — Security Dashboard | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-20.24 | SRS §20.24, PDF p136 — Business Continuity & Disaster Recovery | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.2 | SRS §21.2, PDF p137 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.5 | SRS §21.5, PDF p138 — Executive Dashboards | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.6 | SRS §21.6, PDF p138 — Operational Dashboards | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.7 | SRS §21.7, PDF p139 — Key Performance Indicators | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.8 | SRS §21.8, PDF p139 — Analytics Categories | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.9 | SRS §21.9, PDF p140 — Reporting | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.10 | SRS §21.10, PDF p140 — Historical Analysis | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.11 | SRS §21.11, PDF p140 — Automation Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.17 | SRS §21.17, PDF p142 — KPI Matrix | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.18 | SRS §21.18, PDF p143 — Dashboard Matrix | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.19 | SRS §21.19, PDF p143 — Report Catalog | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.20 | SRS §21.20, PDF p144 — Alert Threshold Matrix | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.21 | SRS §21.21, PDF p144 — Business Intelligence Data | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.22 | SRS §21.22, PDF p145 — Data Visualization Standards | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-21.24 | SRS §21.24, PDF p146 — Analytics Data Lifecycle | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.2 | SRS §22.2, PDF p147 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.5 | SRS §22.5, PDF p148 — API Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.6 | SRS §22.6, PDF p148 — Integration Registry | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.7 | SRS §22.7, PDF p149 — Webhook Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.8 | SRS §22.8, PDF p149 — Data Synchronization | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.9 | SRS §22.9, PDF p149 — Integration Monitoring | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.10 | SRS §22.10, PDF p150 — Automation Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.11 | SRS §22.11, PDF p150 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.16 | SRS §22.16, PDF p151 — Integration Catalog | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.17 | SRS §22.17, PDF p152 — API Lifecycle Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.18 | SRS §22.18, PDF p152 — API Security Policies | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.19 | SRS §22.19, PDF p153 — Integration Failure & Recovery | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.20 | SRS §22.20, PDF p153 — Data Mapping & Transformation | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.21 | SRS §22.21, PDF p153 — API Usage Governance | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.22 | SRS §22.22, PDF p154 — Integration Version Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.23 | SRS §22.23, PDF p154 — Supported Integration Matrix | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-22.24 | SRS §22.24, PDF p155 — Integration Dashboard & Monitoring | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.2 | SRS §23.2, PDF p156 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.6 | SRS §23.6, PDF p158 — Workflow Templates | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.7 | SRS §23.7, PDF p158 — Workflow Execution | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.8 | SRS §23.8, PDF p158 — Approval Workflows | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.9 | SRS §23.9, PDF p159 — Task Orchestration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.10 | SRS §23.10, PDF p159 — Event-Driven Workflows | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.12 | SRS §23.12, PDF p160 — Automation Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.13 | SRS §23.13, PDF p160 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.18 | SRS §23.18, PDF p161 — Workflow Lifecycle | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.19 | SRS §23.19, PDF p162 — Workflow State | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.20 | SRS §23.20, PDF p162 — Workflow Exception & Recovery | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.21 | SRS §23.21, PDF p163 — Workflow Template Catalog | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.22 | SRS §23.22, PDF p163 — Workflow Metrics & Performance | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.23 | SRS §23.23, PDF p164 — Workflow Version Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.24 | SRS §23.24, PDF p164 — Workflow Dependency Matrix | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-23.25 | SRS §23.25, PDF p164 — Workflow Governance & Compliance | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.2 | SRS §24.2, PDF p166 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.5 | SRS §24.5, PDF p167 — Global Platform Configuration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.6 | SRS §24.6, PDF p168 — Organization Configuration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.7 | SRS §24.7, PDF p168 — Feature Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.8 | SRS §24.8, PDF p168 — AI Configuration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.9 | SRS §24.9, PDF p169 — Workflow Configuration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.10 | SRS §24.10, PDF p169 — Notification Configuration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.11 | SRS §24.11, PDF p169 — Security Configuration | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.12 | SRS §24.12, PDF p169 — Automation Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.13 | SRS §24.13, PDF p170 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.18 | SRS §24.18, PDF p171 — Configuration Lifecycle | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.19 | SRS §24.19, PDF p171 — Configuration Version | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.20 | SRS §24.20, PDF p172 — Configuration Templates | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.21 | SRS §24.21, PDF p172 — Configuration Validation | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.22 | SRS §24.22, PDF p173 — Feature Flag Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.23 | SRS §24.23, PDF p173 — Configuration Backup & Restore | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.24 | SRS §24.24, PDF p173 — Configuration Dashboard | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-24.25 | SRS §24.25, PDF p174 — Configuration Governance & Compliance | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.2 | SRS §25.2, PDF p175 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.5 | SRS §25.5, PDF p176 — Platform Monitoring | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.6 | SRS §25.6, PDF p176 — Maintenance Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.9 | SRS §25.9, PDF p177 — Capacity Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.10 | SRS §25.10, PDF p178 — Incident Response | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.11 | SRS §25.11, PDF p178 — Automation Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.12 | SRS §25.12, PDF p178 — Security Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.17 | SRS §25.17, PDF p179 — Operations Lifecycle | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.18 | SRS §25.18, PDF p180 — Maintenance Policy | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.21 | SRS §25.21, PDF p181 — Operational Dashboard | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.22 | SRS §25.22, PDF p181 — Service Level Management | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.23 | SRS §25.23, PDF p182 — Operational Metrics & Reporting | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-25.24 | SRS §25.24, PDF p182 — Operations Governance & Compliance | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.2 | SRS §26.2, PDF p184 — Objectives | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.9 | SRS §26.9, PDF p186 — Maintainability Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.11 | SRS §26.11, PDF p187 — Accessibility Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.14 | SRS §26.14, PDF p188 — Logging & Monitoring | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.15 | SRS §26.15, PDF p188 — Compliance Requirements | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.21 | SRS §26.21, PDF p190 — Quality Attribute Governance | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.24 | SRS §26.24, PDF p191 — Scalability Governance | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.25 | SRS §26.25, PDF p192 — Security Assurance | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.26 | SRS §26.26, PDF p192 — Maintainability & Support | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.27 | SRS §26.27, PDF p192 — Continuous Improvement | Specific function/assertion/workflow proof; fix only a gap actually established |
| FWD-26.28 | SRS §26.28, PDF p193 — Global Governance & Compliance | Specific function/assertion/workflow proof; fix only a gap actually established |
