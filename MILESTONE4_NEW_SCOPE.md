# Milestone 4 — scope that is genuinely outside the Master SRS

Internal working document. Prepared 7 October 2026.

Reconciles the 318 tasks in `MILESTONE4_CHECKLIST.md` against Master SRS v1.1, on the
basis that Milestones 1 to 3 deliver the SRS baseline. Anything the SRS already requires
is removed from Milestone 4 and returned to the Milestone 1 to 3 backlog.

---

## The finding that matters

The subtraction is not clean, because the SRS does two different things with Phase 4
subject matter and they carry opposite commercial weight.

For some capabilities the SRS gives a **specification**. §9.5 walks the AI Scan through
seven named stages. §14.7 states exactly what Discovery Call management must do. §16.7
defines payment verification. §19.25 requires provider switching without workflow
changes. These are buildable from the SRS alone, so they belong to Milestones 1 to 3.

For others the SRS gives only a **name in a list**. §17.6 lists "IVR and own telephone
system (SIP)" as a Version 1 channel. §19.5 lists "AI Receptionist" and "AI Voice Agent"
among ten example agents. §6.9 lists "IVR / Telephony Services" among seven integrations.
Nothing anywhere in the SRS's 197 pages states what an IVR must do: no menu, no routing,
no queue, no transfer, no recording, no failure behaviour, no concurrency. A developer
handed only the SRS could not build any of it.

**That distinction is the whole argument.** A capability named in a one-line bullet is not
a specified requirement, and the Phase 4 documents are not a restatement of the SRS. They
are the first time these products have been specified at all.

---

## Three buckets

| Bucket | Meaning | Tasks | Share |
| --- | --- | ---: | ---: |
| **A** | Specified in the SRS. Return to Milestones 1 to 3 | **61** | 19% |
| **B** | Named in the SRS, never specified. Judgment call | **115** | 36% |
| **C** | Absent from the SRS entirely. New scope | **142** | 45% |
| | **Total** | **318** | 100% |

---

## Bucket A — remove from Milestone 4, these are SRS work

The SRS specifies these well enough to build from. If Milestones 1 to 3 close the SRS,
they are already covered and should not be re-billed under Milestone 4.

| Item | Tasks | Where the SRS specifies it |
| --- | ---: | --- |
| 4.0 Shared foundation: provider abstraction, model router, configuration | 23 | §19.6 AI Orchestration, §19.25 AI Provider Management, §24.8 AI Configuration |
| 4.7.3 Expert Review workflow | 10 | §9.5 Stage 5, BR-009 Human Approval Required, §12.8 |
| 4.7.4 Publication | 8 | §9.5 Stage 6, BR-016 Report Lifecycle, §9.6 Report Status Model |
| 4.7.1 subset: Stripe purchase, server-side payment verification, account binding | 8 | §9.5 Stages 1 and 2, §16.7 Payment Management, §8.6 Account Creation, BR-023 |
| 4.5 subset: qualification engine, opportunity lifecycle, scheduling handoff | 6 | §14.16 AI-assisted lead evaluation, §14.8 Opportunity Management, §14.7 |
| 4.4 subset: Discovery Call schedule, reschedule, cancel, record outcomes | 6 | §14.7 Discovery Call Management |
| **Total** | **61** | |

Worth noting: SRS Module 13, the AI Intelligence Layer, currently stands at **0 of 7
acceptance criteria complete**. The shared AI foundation in 4.0 is not something Phase 4
introduced. It is SRS work that Milestones 1 to 3 have not yet delivered. It has to be
built either way, and it should be counted against the SRS rather than against Phase 4.

---

## Bucket B — the commercial argument

The SRS names these. It does not specify them. Each row shows every mention the SRS makes,
in full, against the number of tasks the Phase 4 documents define.

| Item | Tasks | Everything the SRS says about it |
| --- | ---: | --- |
| 4.1 Telephony and IVR | 29 | "IVR and own telephone system (SIP)" (§17.6); "IVR / Telephony Services" (§6.9). Two bullets. |
| 4.2 AI Receptionist | 27 | "Support AI Receptionists" (§17.2); "AI Receptionist Communications" (§17.3); "AI Receptionist" in the agent examples (§19.5); NT-029 "AI Receptionist Assigned" (§17.15). Four mentions, no behaviour. |
| 4.4 Scheduling Agent beyond Discovery Calls | 34 | "Scheduling meetings" as one AI tool-execution example (§19.19); "Calendar providers" as a supported integration (§13.13). |
| 4.5 AI Sales Outbound core motion | 25 | "Support AI Sales Agents" (§17.2); "AI Sales Agent" (§19.5); NT-031; "Marketing campaign management" (§14.3); "Support campaign management" (§14.16). |
| **Total** | **115** | |

Two factual points support treating this as new scope.

**The SRS defines lead capture as inbound only.** §14.5 lists the permitted lead sources:
public website contact forms, Discovery Call requests, AI Scan purchases, partnership
inquiries, manual creation by Admins, and "future external integrations." Every one is a
prospect approaching IO SKY. Outbound prospecting to people who have not made contact is a
different commercial motion, and the SRS does not describe it.

**BR-022 constrains notifications to business events.** "Notifications shall only be
generated in response to defined business events. Each notification must be linked to its
originating event and recipient." A cold outbound campaign has no originating business
event and no pre-existing recipient relationship. It does not fit the model the SRS sets
out.

Recommendation: treat Bucket B as Milestone 4 scope. A named channel is not a
specification, and no reasonable reading of §17.6's six words produces 29 telephony
behaviours. It is the bucket most likely to be challenged, so it needs the evidence above
rather than an assertion.

---

## Bucket C — genuinely new, no SRS basis at all

Nothing in the SRS corresponds to any of this.

| Item | Tasks | Why it is new |
| --- | ---: | --- |
| 4.7.2 Adaptive assessment engine | 23 | The SRS requires "resumable questionnaires" (§9.7) and says nothing about adaptive questioning. The Phase 4 Master Specification grades a fixed sequence as an explicit FAIL (TST-004) and prohibits numeric scoring outright (PRD-006). The SRS addresses neither. |
| 4.6 Acceptance, evidence and demonstration standard | 18 | §26.18 gives six general statements. Phase 4 requires demonstrated failure paths, session isolation under concurrent load, permission isolation, and evidence retained for inspection. A materially higher bar. |
| 4.7.5 Report system, 21-section architecture | 18 | The SRS requires a report with version history (§9.7, BR-017) and specifies no structure. Phase 4 defines 21 canonical sections. |
| 4.3 Conversation and Response Playbook | 16 | The SRS contains no conversational design content anywhere. §17.8 covers notification templates, which are transactional, not dialogue. Tone, phrasing, objection handling and response structure appear nowhere in 197 pages. |
| 4.8 Website and platform redesign | 16 | §7 specifies the Public Website's pages, navigation and behaviour, never its visual design. The Milestone 2 specification pointed the other way and required existing portals to be ported without redesign. Already conceded by the client in writing. |
| 4.5 subset: Do Not Contact, suppression layer, compliance policy, controlled learning, 24 canonical permissions | 20 | None of this exists in the SRS. The platform permission model (§5.8) has 15 capabilities across 5 roles and no outbound concepts at all. |
| Prerequisites and blockers | 12 | Credential and account provisioning for providers the SRS never names. |
| 4.7.1 subset: VAT validation, account collision protection, billing and tax snapshot | 6 | §16 covers invoices and payments. Country-aware VAT validation and tax snapshotting are not mentioned. |
| 4.7.8 Scan platform, security and operations | 6 | Specific to the replacement engine. |
| 4.7.7 Executive Briefing | 4 | A separate commercial deliverable and a paid add-on. Not in the SRS. |
| 4.7.6 Translation and language | 3 | §24.5 offers "Localization settings" as a configuration item. Per-report translation of generated content is a different thing. |
| **Total** | **142** | |

---

## Recommended Milestone 4 scope

**Milestone 4 = Buckets B + C = 257 tasks.**

**Return 61 tasks to the Milestone 1 to 3 backlog**, where they belong against SRS Modules
3, 8, 10, 13 and 16. Most of that 61 is the AI Intelligence Layer, which is the largest
unbuilt part of the SRS regardless of what happens with Phase 4.

If Bucket B is disputed, the floor position is **Milestone 4 = 142 tasks**. The 115
disputed tasks still have to be specified, built and paid for by someone. Moving them into
Milestones 1 to 3 does not make them smaller. It makes the SRS baseline 115 tasks larger
than it was when that baseline was priced.

---

## One thing to settle before quoting either number

The AI Scan workstream is a **replacement**, not an extension, and that is the client's own
specification saying so rather than our interpretation. Two Phase 4 acceptance tests are
written as FAIL conditions that the shipped product meets exactly:

> **TST-001 Form Test.** "If experience is effectively customer fills long form, AI
> generates PDF" — **FAIL**
>
> **TST-004 Fixed Sequence Test.** "Hidden fixed 35-question sequence with cosmetic
> variation" — **FAIL**

`shared/aiScanQuestionnaire.ts` holds exactly 35 questions, and `aiScanReportPdf.ts`
produces a PDF. Both tests grade FAIL rather than "needs improvement", so the engine cannot
be evolved into compliance. Three further direct conflicts with live code, each verified:

- COM-001 states "There is no free AI Scan product", while `drizzle/schema.ts:1920`
  defines `pgEnum("ai_scans_tier", ["free","growth","elite"])` with a live unpaid tier.
- PRD-006 prohibits scores and readiness percentages, while `aiScanScoring.ts` computes
  per-dimension scores constrained 0 to 100 and the table carries an `overallScore` column.
- CNF-001 requires qualitative confidence (High, Moderate, Low, Insufficient), while the
  model response schema returns it numerically.

The AI Scan that Milestones 1 to 3 built against SRS Module 3 is being discarded. That is a
legitimate client decision, but it is a decision with a cost, and it should be priced rather
than absorbed quietly.
