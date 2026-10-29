# IO SKY — SRS scope reconciliation

Evidence review prepared 15 October 2026. Working source: commit a1ca0e5. No application changes or production writes.

**The current evidence does not support unconditional SRS-baseline completion, and it also does not make every later specification part of the original paid scope.**

| Review population | Result |
| --- | --- |
| 155 acceptance claims | 111 narrowly supported A; 44 qualified B |
| 128 focused comparison/dependency rows | Voice, ten named agents, scheduling, reports, governance and prerequisites |
| All 539 traceability rows | A 143  /  B 332  /  C 41  /  D 12  /  E 11 |
| Full SRS coverage inventory | 448 numbered clauses plus 26 BR, 8 PP and 4 appendices |
| Current verification | 1,113 tests passed; 57 skipped; zero failed; TypeScript passed |


The 539 rows contain 283 focused rows, 230 further normative-clause evidence exceptions and 26 global rules. They overlap and are not independent contractual requirements or billable jobs. B includes insufficient evidence, not just missing code. A is narrow evidence support, not a current-production certificate.

Telephony/AI communications, general AI memory/context, permissions, basic analysis/reports, scheduling, recovery and performance obligations remain baseline. Adaptive interviewing, a fixed report/viewer product, video and other specified later deliverables have identifiable additional deltas.

Known baseline planning packages total **77–136 person-days**. Illustrative core extensions total **66–114**; all nine proposed packages total **112–191**. These are conditional estimates, not fees or promised dates. They exclude unresolved interpretation and owner/provider waiting time.

**Recommended decision:** agree the baseline closure list, resolve C interpretations, supply exact E inputs, then quote selected D packages separately. Do not re-bill baseline work or assume approval of the client's whole message.

Sources: Master SRS §§17.6, 19.5/19.8/19.18/19.21, 25.8, 26.18/26.22; delivery report PDF pp10,180,794–795; accompanying CSV and method record.


---

# Documentary and commercial evidence

The source register contains 131 PDF/Markdown documents discovered recursively. The 198-page SRS and 864-page report were text-indexed in full. The five specialist Receptionist/Playbook/IVR/Scheduling/Sales documents, Scan engine/addendum/design and notification/audit/security documents were compared at the cited sections. Image-only visual references were not silently treated as text requirements.

| Source | What it establishes / limitation |
| --- | --- |
| Master SRS v1.1 | Working functional baseline. Cover/document control say approval pending owner decisions; this audit does not decide legal status. |
| Original Three-Milestone Plan | Referenced as IO_SKY_Three_Milestone_Plan.pdf, but unavailable. Secondary reports quote or summarize it; no primary commercial comparison can be certified. |
| M4 Finalised Scope, 29 Sep, pp1–4 | Calls telephony/receptionist/sales baseline, Scan/scheduling mixed; calls eight other agents baseline but excludes them from M4. This is documentary evidence, not proof of a signed order. |
| 13 Oct extension proposal | Unapproved proposal in this conversation. Earlier blanket scope labels are qualified by this audit. |
| 864-page report | 155 acceptance sections and historical screenshots/tests. It also explicitly records outstanding live/provider/recovery evidence. |
| Later specialist specs | Functional direction and technical detail. FINAL/APPROVED titles alone do not establish paid scope approval. |


Unavailable: original signed plan/change approvals, complete latest client follow-up, eight individual agent specifications, exact §26.16 Security & Compliance companion, standalone AWF/BWF and authoritative later OPD-003 values, original raw capture/test manifest, current provider consoles and restore/load evidence.

Repository absence does not prove a document was never sent elsewhere. Exact missing files/values should be located before asking the client to resend whole specifications. No contractual liability, fee entitlement or legal compliance conclusion is made.


---

# What the 155 criteria prove

The report contains all 155 acceptance-list headings, and each has been reverse-mapped to code areas, existing test files and its report page. The audit supports 111 narrow acceptance claims and qualifies 44 because of a defect, incomplete function or insufficient verification. Missing one screenshot alone is not grounds for downgrading a claim.

The checklist cannot establish every SRS obligation: §§19.17–19.25 and §26.22 contain substantive registry, knowledge, memory, provider and capacity duties outside the short acceptance summaries. A screenshot of the framework cannot prove those capabilities.

The full inventory preserves 448 numbered clauses: 319 have explicit review-row links, including 230 B evidence-exception clauses with candidate code/tests and no missing-code assumption. The remaining 129 context/exception/index clauses stay visible. **This is not full atomic forward certification.** A candidate module link does not prove each subclause, and no unsupported engineering bill is inferred.

| Evidence layer | Meaning |
| --- | --- |
| UI/schema/configuration | May establish visibility or structure; not workflow success. |
| Current source + offline tests | Shows implemented logic and tested boundaries; mocked provider responses do not prove real provider operation. |
| Historical live evidence | Provided report screenshots/database excerpts, mainly 10–11 October. Accepted within their actual scope; not freshly recaptured. |
| Current read-only live check | Health/readiness/HTTPS only. No authenticated workflow, account creation, payment, call, mail or live model processing. |
| Current production equivalence | Unverified: /health/version says unknown commit/builtAt. |


A/B are not percentages of the full SRS. C does not mean paid extra. E can coexist with missing B code. The 332 B rows include all 230 extra normative-clause evidence exceptions; the remaining B rows also overlap. They are not 332 missing features.

Sources: SRS §26.18, PDF pp189–190; report pp10,180,794–795; IO_SKY_REQUIREMENT_TRACEABILITY.csv and IO_SKY_SRS_CLAUSE_COVERAGE.csv.


---

# The agent-count and functionality dispute

SRS §19.5, PDF pp118–119, says “Examples include, but are not limited to” and lists ten names. No eight individual functional specifications are attached to the supplied SRS. “Eight other” in the M4 PDF can refer to the remaining eight after Receptionist/Sales; it is not a separate SRS enumeration.

| Official SRS name(s) | Requirement and implementation finding |
| --- | --- |
| AI Support Agent | Support communications and workflow triggers expressly required (§§17.6/17.11). No matching operational support-agent runtime located. B. |
| AI Sales Agent | Commercial AI communication and lead qualification baseline. Lead qualifier is partial evidence; not a complete outbound product. B. |
| AI Receptionist | Explicit channel/workflow support. No incoming voice/media integration located. B. |
| AI Voice Agent | Voice interaction support where configured. Existing Twilio Messages sender is not voice integration. B. |
| AI Operations Agent / AI Project Assistant / AI Document Assistant | Each name occurs only in the §19.5 example list. Shared monitoring/project/document AI duties exist elsewhere; no individual contract found. C for complete standalone products. |
| AI Reporting Agent / AI Compliance Assistant / AI Executive Assistant | Each name occurs only in the §19.5 example list. General reporting/compliance/executive duties do not specify individual tools or autonomy. C for standalone products. |


Two model execution paths exist in source: AI Scan analyst and inbound lead qualifier. Registration on use is not proof of successful live execution. Admin Agents/Governance pages expose registry/prompt/history controls.

One shared runtime can implement several specialist capabilities. Each still requires scoped data, tools, outputs, permissions, history and human escalation. Ten independent microservices are not required. Basic permission-aware memory/context and conversation continuity are already explicit (§§19.8/19.20–19.21), and cannot be priced as wholly new.

Evidence: AG-01–AG-10; server/db/srsGovernance.ts; server/leadEvaluation.ts; schema ai_agents/ai_prompt_versions/ai_executions; detailed agent audit.


---

# AI Receptionist comparison

| Capability | SRS / later source | Class and engineering boundary |
| --- | --- | --- |
| Incoming AI conversation / intent | SRS §§17.6/17.11/19.8; Receptionist §§3/4/16, pp2/5 | B: functioning voice communication and routing absent. Registry/SMS do not satisfy it. |
| Caller/context authorization | SRS §§19.11/19.21; Rec §20 p6 | B: caller recognition must not become authority; actual identity/action path missing. |
| Human escalation | SRS §19.22 p124; Rec §25 p6 | B: actual handoff/decision history required where policy applies. |
| Basic memory / recovery | SRS §§19.8/19.21 pp119/124; Rec §31 p8 | B: shared context/continuity already required; scan drafts are not conversational recovery. |
| Booking / CRM connection | SRS §§14.7/19.19/19.20; Rec §§18/31 pp5/8 | C: baseline platforms exist; exact conversational tool/relationship workflow needs interpretation. |
| Opening hours / presence / exact persona / barge-in | SRS §§17.6/26.10; Rec §§5/8/9/26 pp3/4/6; Playbook §65 p15 | C: safe usable behaviour and configuration may clarify baseline. Not automatically chargeable. |
| Dutch/English switching | Rec §7 p3; SRS §17.8 localization context | C: launch voice-language commitment not fixed; no automatic extra fee. |
| Permanent audio / verbatim transcript | Rec §33 p8; SRS §§17.9/19.21 | D for durable audio recording; C for transcript retention because conversation history is already baseline. Recording is off by default in later spec. |
| Monitoring / follow-ups / truthful failure | SRS §§19.24/17.11/26.7; Rec §§27/40/46 pp7/10 | B: underlying baseline duties; exact full analytics layout can have clarification detail. |


No real receptionist call-session tables, call/media handler or end-to-end voice demonstration were located. External phone service may exist independently; that is not an application implementation proof. The detailed matrix separately records 21 Receptionist comparisons with source/test/code references.


---

# IVR: three different engineering layers

**Layer 1 — integrate a provider:** required platform-side telephony/SIP integration (§§6.9/17.6). Provider account, number and billing are external prerequisites. **Layer 2 — IO SKY application logic:** usable call/session handling, IVR/routing, AI voice, permissions/history and applicable escalation. This is baseline functionality, with later detailed deltas separated. **Layer 3 — carrier/PSTN network:** excluded by M4 PDF p3; no network-construction package is proposed.

| Later telephony behaviour | Reference / finding |
| --- | --- |
| Call routing / transfer / session lifecycle | IVR §§10/16/24, pp4/6/7; SRS §§17.6/17.9/19.22. B for minimum working channel and escalation. |
| Exact menu, queue/wait/hold, presence policy | IVR §§5/9/11, pp3–5. C: exact operating model not specified by SRS; minimum routing cannot be charged again. |
| Outbound manual softphone product | IVR §31 p10. C: scope of required phone/voice support versus new manual calling interface needs interpretation. |
| Recording / durable transcripts | IVR §§21/22 p7. D for persistent audio recording; C for transcript storage/retention versus existing history duties. Transient speech processing needed for baseline voice remains baseline. |
| Number/configuration administration | IVR §§30/35 pp9–10; SRS §§17.6/13.13. B for configurable required provider capability. |
| Concurrent sessions / overload isolation | IVR §§25/26 pp8; SRS §§19.11/26.6–26.7. B for baseline isolation/reliability; new numerical guarantees remain C. |
| AI outage to exact traditional-IVR failover topology | IVR §28 p9; Receptionist §43 p10. C for exact topology; generic controlled recovery is baseline. |


Source finding: server/_core/smsSender.ts calls Twilio Messages.json. That does not implement calls, SIP, speech/media streaming or transfer. Router/schema search located no working voice/DTMF orchestration. No real phone call or production fault was triggered by the audit.

The 17 IVR rows in the CSV avoid equating a provider subscription, an application-level IVR and a carrier network. A credential dependency cannot erase missing application engineering.


---

# Scheduling comparison and confirmed defect

SRS §14.7, PDF p78, requires schedule/reschedule/cancel, outcomes, notes, follow-ups and lead/customer linkage. Native booking, availability rules/blocks, signed action tokens and timezone handling exist. Historical booking evidence is supplied; live concurrency fixtures were not rerun.

| Capability | Conclusion |
| --- | --- |
| Booking / native availability / cancellation / reminders / timezone | A within cited narrow source/test/historical evidence. In-app/reminder scheduling is separate from real SMTP delivery. |
| Calendar synchronization | C: §13.13 expressly mentions calendar providers. Native adapter only; original specific integration commitment unavailable. Cannot reject every calendar adapter as outside SRS. |
| Multi-host / joint attendance allocation | D for later Scheduling §30 p9: host eligibility, strategies and joint availability beyond basic call management. Baseline booking/provider capability excluded from extra charge. |
| 60-minute versus 75-minute block | C: client item 38 requests 15+30+15=60; later Scheduling §6 p3 defaults 30+30+15=75. SRS fixes neither. Owner policy needed; ordinary settings are not automatically new paid features. |
| Natural-language AI scheduling / delegated contact tasks / voice OTP | C: SRS §19.19 already lists scheduling as an AI tool example. Precise standalone proactive-agent obligations need interpretation. |


**Concrete guest rescheduling defect:** the route confirms the new slot with the same booking ID, then calls a helper that cancels every slot with that ID. The new slot is cancelled too. The route does not update the booking time or reminders. Existing router tests stub these persistence helpers; a passing stub does not prove the transition is correct.

This is source-level evidence of an integrity defect, not a claim that a production customer suffered it. Fix the move atomically, preserve old booking on failure, update canonical time/reminders and test realistic competing/retry cases in isolation.

References: SCH-01–SCH-18; server/routers/bookings.ts rescheduleByToken; server/db/bookings.ts confirmBookingSlot/cancelBookingSlot; §26.12; later Scheduling §§4/19, pp2–3/7. B02 estimate: 2–4 person-days.


---

# AI Scan: required product versus later expansion

| Capability | Classification / source |
| --- | --- |
| Questionnaire / AI analysis / review / approval / publication / versions / portal / audit | Baseline §§9.5–9.10, pp44–47; §10.7 p51. Existing implementation covers much of lifecycle; model/live/version/ownership evidence still has specific gaps. |
| First successful funded AI analysis | B. Report p180 marks COMPLETE while saying account had no credit and first live analysis remained pending. Mocked model response tests are not the missing live run. |
| Generic memory/context and conversation recovery | B where not established: §§19.8/19.21. It cannot be put wholesale into an extension package. |
| Adaptive interactive questioning / depth / contradiction clarification | D. Engine AI-004, CTR-001, memory/depth sections; fixed question bank is materially different from the later interactive assessment. |
| Exact multi-pass / evidence-state / qualitative priority method | C. Baseline reasoning/output quality remains required; §26.19 leaves architecture choices to developers. No automatic paid delta merely for extra model calls. |
| Numeric score prohibition | C. SRS does not mandate numeric scoring. Later PRD-006 changes current implementation, but business scope versus method choice needs agreement. |
| Fixed 21-section report / book viewer | D. Design System §4 p2; Engine VIEW-003 p16. Baseline usable reports/downloads remain baseline. |
| Generated-report translations / separate video briefing | D. Engine LNG-003 p14 and EB-003 p18. Notification template localization and written executive summary remain baseline. |


**Ownership gap:** published report and PDF APIs are public procedures gated by an unguessable report token, not authenticated user/organization ownership. SRS §9.10 explicitly says “Validate customer ownership before granting report access.” Publication status checks do not satisfy that separate ownership duty. No private report was accessed during the audit.

References: SCAN-01–SCAN-18; server/routers/aiScans.ts getReport/getReportPdf; scoring/question bank; aiScanReportPdf.ts; shared rules; report pp180/794–795.


---

# Baseline gaps beyond feature labels

| Finding | Evidence / classification |
| --- | --- |
| AI permission guard allows registry-error execution | SRS §19.18 p123 requires checks before every action. guardAiScanRun catches error and returns allowed:true; existing test expects it. B; GOV-01. |
| Document governance fails open on lookup errors | Client list/download catches matrix error as empty hidden set. §§18.8/18.21. B; GOV-08. |
| Operator scopes only partly enforced | Grant/expiry/revoke and security-scope check implemented; other ops APIs role-gated. §§5.7/13.8. B; GOV-06. |
| Incomplete registry / knowledge / provider fallback | §§19.17–19.25 contain substantive duties. Basic registry, two model calls and class routing are partial. B; GOV-02–04. |
| Project document route not fully evidenced | Client upload has organization/category but no project/task/documentType field. §§15.13/18.20. B; GOV-09. |
| Audit retention / finance policy | Cascade-delete exception needs retention-safe policy (B). Requested Admin/Super Admin finance exclusivity is C; admin.summary exposes revenueMTD. Neither is silently marked resolved. |
| Recovery and observability | Runbook expressly says no restore rehearsal; storage objects separate. Full performance/throughput/capacity trends not demonstrated. B; GOV-12–14. |


Report contradictions: p10 says all 155 are complete/live-verified; p180 records the missing first AI run. Page 794 excludes all IVR/Receptionist as outside SRS, contrary to §17.6. Page 795 says open items do not block completed criteria while listing missing AI credit, untriggered events and restore rehearsal. Checklist headline is 155 but its total row retains 127/21/2/5, and old blocker/backlog sections remain. Those stale counts are a documentation defect, not proof that every old backlog item is still unbuilt.

The report's historical RLS test evidence does not by itself prove tenant checks across privileged server APIs. Current isolated runs skip live RLS; source-level ownership exception is separately identified.


---

# Current checks and external inputs

Typecheck passed. Offline unit/component tests: 1,113 passed, 57 skipped, zero failed in 93 file results. The six skipped files cover live concurrency, constraints, query plans, RLS and database-dependent legal/acceptance flows. No production-writing fixture ran. Test evidence is provided by file and test name.

Railway health/readiness returned 200 over validated HTTPS; HSTS present, HTTP redirected to HTTPS. The deployed commit/build are unknown. Custom iosky.nl root returned 404; iosky.co returned 200. These observations do not certify all role workflows, authentication origin, staging or mixed-content absence, and are not capacity benchmarks.

| Input / decision | Exact need and evidence limit |
| --- | --- |
| OpenAI / voice accounts | Current funding/selected voice number and destinations, spend/test limits. Report says first live AI output missing; balance not rechecked. |
| Zoho / DNS / email specifications | No MX/SPF on either domain and DMARC NXDOMAIN on 15 Oct; DKIM absent at zmail only. SMTP real send/receive plus exact content location, not a blanket claim the client never supplied specs. |
| OPD-003 / companion security spec | Actual per-type owner/roles/classification/retention/archive decisions and exact §26.16 companion. Related security-direction PDFs exist but equivalence is unverified. |
| Supabase / recovery / staging | Confirm plan/backups/object restore, isolated target and RTO/RPO. Do not run restore in shared production. |
| Invoices / production billing | Verify issuer/customer configuration and actual invoice output; finance owner confirms tax configuration. No legal/tax determination or real charge made. |
| Original agreement / policy conflicts | Original plan/changes; §15.16 forecasting versus §21.15 exclusion; voice language, 60/75-minute buffer and expected workloads. |


E inputs enable verification but do not excuse missing B code. External waiting time, current subscription prices and any purchased plan are not inferred. Full endpoint/DNS observations are in the evidence JSON files.


---

# Baseline closure plan

Known scoped engineering/verification packages, not a new paid milestone:

| Package | Work | Person-days |
| --- | --- | --- |
| B01 | Close AI/document fail-open paths and authenticated report ownership | 4–7 |
| B02 | Repair atomic reschedule, booking time and reminder consistency | 2–4 |
| B03 | Complete individually configurable operator backend authorization | 2–4 |
| B04 | Minimum provider-backed IVR voice receptionist and escalation | 20–35 |
| B05 | Minimum governed Support/Sales AI communication capabilities | 12–20 |
| B06 | AI registry/context/knowledge/provider governance closure | 8–14 |
| B07 | Project-document association and controlled handoff | 5–9 |
| B08 | Email provider verification event producers and retry/escalation | 6–10 |
| B09 | Isolated recovery target backup/storage procedure and restore rehearsal | 5–9 |
| B10 | Generated invoice field/provider verification | 2–4 |
| B11 | Integrated QA, capacity metrics/workload tests and release evidence | 8–14 |
| B12 | Governance retention policy enforcement and acceptance evidence | 3–6 |


**Known scoped packages: 77–136 person-days.** The 230 FWD clauses share another 8–16 days of evidence/traceability review; further engineering is unestimated. Combined identified work/review allowance: 85–152 days. Do not sum row estimates. This excludes unresolved additional duties, owner/provider waits and legal/content authoring and can change after original agreements and interpretations are supplied.

Sequence: confirm decisions/resources in parallel with security/booking fixes; close shared AI/context before voice/support/sales; complete document/notification work in parallel; then isolated restore, representative load tests, live funded analysis/invoice/email demonstrations and revised acceptance evidence.

Conditional staffing scenario: two experienced engineers plus shared QA, about 9–16 working weeks after required inputs, with integration gates. One engineer's effort alone is approximately 15–27 weeks before waits. No fixed delivery date is promised. Each accepted SRS duty must close with actual workflow and negative authorization evidence; missing screenshots alone are not a defect.


---

# Proposed additional scope and next agreement

Only the stated deltas are proposed; existing baseline functions are excluded from additional charges.

| Package | Additional deliverable | Person-days |
| --- | --- | --- |
| D01 | Adaptive interview and interactive contradiction/depth engine | 18–30 |
| D02 | Fixed 21-section design and book-style report viewer | 12–20 |
| D03 | Separate Executive Briefing video | 8–14 |
| D04 | Multi-host and joint-attendance scheduling allocation | 8–15 |
| D05 | Whole-site/portal visual redesign | 20–35 |
| D06 | Generated-report NL/EN translation and equivalence | 6–10 |
| D07 | Passkey/WebAuthn additional authentication method | 5–8 |
| D08 | External prospect signal discovery and evidence-led research | 30–50 |
| D09 | Optional durable call audio recording storage/export | 5–9 |


Core D01–D05: **66–114 person-days**. Optional D06–D09: **46–77**. All nine: **112–191**. Two-engineer/shared-QA planning windows are roughly 8–14 weeks for core or 13–23 for all, after baseline services and inputs; these are conditional estimates, not a quote or guaranteed dates.

C items remain for interpretation: complete standalone-agent products, exact voice menu/queues/persona/barge-in/language policies, calendar integration commitment, analysis methodology, universal MFA, buffer defaults and new numerical guarantees. They are not priced or accepted collectively.

Before any additional work: identify the approved package, exact baseline-versus-added behaviour, acceptance examples, effort, one-time fee, external recurring costs, dependencies and schedule; obtain written approval. Reconcile actual prior approvals before replacing an earlier agreement. File titles alone establish neither acceptance nor rejection.

Deliverables: this report; requirement CSV; full clause coverage CSV; detailed agent/IVR/scheduling audit; remaining baseline work; proposed extensions; client response draft; source register, summary and sanitized current evidence.

The recommended reply acknowledges SRS obligations, corrects the overbroad completion/exclusion statements, and proposes selected extras without accepting the client's entire request. It does not decide legal liability or certify full SRS completion.
