# Milestone 4 — proposed additions beyond Master SRS v1.1

Prepared 13 October 2026. **Proposal only — no additional work is approved by this document.**

## Scope boundary

Master SRS v1.1 remains the functional baseline. This proposal covers defined additions beyond that baseline. It does not approve the client's entire reconciliation message, incorporate every later specification, or reclassify baseline functionality as chargeable work.

An SRS requirement can be binding even where its implementation detail is brief. A later specification may clarify an existing duty or add a new capability; those cases must be separated. Earlier Milestone 4 labels and task counts are not substitutes for that comparison.

No non-SRS addition is accepted for implementation until both parties approve the specific delta, deliverables, acceptance conditions, price, dependencies and schedule in writing. No development or provider purchase for an additional item is authorized by this proposal.

## Proposed workstreams

The IDs below are new proposal references. They do not reuse the earlier 318-task total or claim that those tasks were individually reclassified.

| Ref | Proposed addition | SRS baseline retained | Exact proposed delta | Extension acceptance |
| --- | --- | --- | --- | --- |
| M4-E01 | Adaptive AI Scan assessment | §§9.5, 9.7: resumable questionnaire, required-field validation and AI-generated analysis | Bounded dynamic questions, material follow-ups, persistent assessment memory, explicit depth/stop rules and contradiction-resolution questioning as defined in the later engine specification | Demonstrate that materially different answers produce different relevant follow-ups; save/resume preserves adaptive state; clarification updates the assessment. Baseline questionnaire completion is not this item's deliverable. |
| M4-E02 | Prescribed analysis and evidence methodology | §§9.5, 19.6, 19.7: real AI processing, orchestration and useful recommendations | The later specification's particular multi-pass assessment architecture, six evidence states, qualitative confidence framework, finding relationships and nonnumeric priority method | Demonstrate the specified evidence/finding states and changes after conflicting input is resolved. Only the additional prescribed methodology is quoted; analysis necessary to satisfy the baseline remains baseline work. |
| M4-E03 | New report design system and publication viewer | §§9.5, 9.7, 10.7: usable published reports, downloads, recommendations and version history | Fixed 21-section branded report architecture, approved reference compositions and a book-style portal viewer with contents/chapter navigation and responsive one/two-page reading | Produce an approved sample in the agreed design; verify contents/links and page layouts; demonstrate the viewer and matching PDF. Existing report generation, approval and publication are excluded from the extension charge. |
| M4-E04 | Executive Briefing audiovisual deliverable | §§9.5, 10.7: written executive summary and report delivery | Separate report-derived narrated video/briefing, entitlement handling, review, version binding and secure delivery | Demonstrate one approved briefing derived from a reviewed report; unauthorized users cannot access it; a source-report revision flags the briefing for re-review. Provider assessment belongs to this item if separately approved. |
| M4-E05 | Multi-host scheduling | §14.7: Discovery Call scheduling, rescheduling, cancellation, outcomes, notes and lead/customer linkage | Multiple hosts with individual availability/calendars, eligible appointment types and a shared host-selection/conflict policy | Demonstrate at least two hosts, agreed selection rules and conflict handling across manual and automated bookings. Generic integration administration under §13.13 and baseline booking correctness are not charged again. |
| M4-E06 | Public website and portal visual redesign | §7.8 and §§26.10–26.11: working public pages, usable navigation, responsive and accessible interfaces | New approved visual system across existing public, authentication, Client, Developer, Admin, Super Admin and Technical Operator surfaces; specifically listed new visual assets | Approve the surface/asset inventory before quoting; deliver agreed references and responsive layouts. Baseline defects, missing required workflows and ordinary usability corrections remain baseline. |
| M4-O01 | Generated-report translation — optional | Baseline notification-template localization under §17.8; published report delivery under §10.7 | Dutch/English renderings of generated report content from one canonical analysis, with terminology/equivalence and stale-rendering checks | Demonstrate both agreed report languages and invalidate a dependent rendering after its canonical content changes. Notification localization is excluded from this extension. |
| M4-O02 | Passkey/WebAuthn authentication — optional | BR-014 and Module 2: existing authentication, applicable MFA, recovery and session security | Additional passkey enrollment, supported-device sign-in, removal and agreed recovery flow | Demonstrate registration, sign-in, revocation and lost-device recovery on agreed supported clients. Existing MFA/security corrections are excluded. |

M4-E01 through M4-E06 are the proposed core package. M4-O01 and M4-O02 are optional and require separate selection. Core workstreams can also be approved individually.

## Specification anchors

These references identify the requested additions. They are not acceptance of every requirement in the referenced document.

| Workstream | Later specification/reference |
| --- | --- |
| M4-E01 | AI Scan Engine Master Specification: AI-004, MEM-001 onward, depth/stop rules and CTR-001 onward; checklist RM-350–RM-372 |
| M4-E02 | Engine evidence, confidence, findings, relationships and priority clauses; the exact pass structure must be fixed in the approved scope |
| M4-E03 | Report Design System §4, fixed 21-section architecture; Engine VIEW-003–VIEW-007; checklist RM-391–RM-408 |
| M4-E04 | Engine Executive Briefing requirements EB-003, EB-009–EB-010 and associated entitlement requirements; checklist RM-412–RM-415 |
| M4-E05 | Scheduling Agent Specification §30, multi-host architecture; detailed host-selection rules to be selected before quotation |
| M4-E06 | Website/platform design specifications and the individually approved page, portal and asset inventory |
| M4-O01 | Engine LNG-003–LNG-008; checklist RM-409–RM-411 |
| M4-O02 | Client review item 30, passkey/WebAuthn request; supported devices and recovery rules to be fixed before quotation |

## Existing baseline obligations

The following remain assessed against the SRS. Their inclusion in the client's email does not create a new agreement to every extra detail in that email.

| Existing obligation | SRS reference | Boundary |
| --- | --- | --- |
| Telephony and AI communication support | §§6.9, 17.2–17.6 | Required platform capability remains baseline. This does not automatically incorporate every later call-centre/receptionist specification. |
| Multiple specialized agents, orchestration, provider management and recommendations | §§19.5–19.7, 19.25 | A registry alone is not operational proof. The example names in §19.5 do not individually specify ten complete standalone products. |
| Campaign management, follow-ups and AI-assisted lead evaluation | §14.16 | Baseline functions stay baseline; a complete externally sourced cold-prospecting product is not accepted through this proposal. |
| AI Scan analysis, expert review, approval, publication, reports, versioning and customer delivery | §§9.5–9.7, 10.7 | Live analysis and usable reports remain baseline; the specific adaptive/design/video deltas above are separate. |
| Discovery Call management | §14.7 | Ordinary schedule/reschedule/cancel, linkage, notes and outcomes remain baseline. A requested 60-minute block must be checked against existing configuration; a new setting is not automatically a new development charge. |
| Individual and temporary Technical Operator permissions | §5.7, §13.8, BR-024 | Permission enforcement, expiry and revocation remain baseline. Scope labels do not establish full implementation by themselves. |
| Authorized messages, project documentation and document governance | §10.11, §15.13, §§18.6–18.21, BR-011 | Permissions, associations and the Client/Developer boundary stay baseline. Exact OPD-003 unresolved fields need documentary reconciliation. |
| Quotations, invoices, payments and subscriptions | §§16.5–16.9 | Usable required business documents and customer association stay baseline. No wholesale billing/subscription workstream is priced as new here. |
| Notifications, email templates and provider delivery | §§17.6–17.9 | Baseline production email completion is not Milestone 4 extension work. Additional visual treatments need a specific delta before acceptance. |
| Security, tenant isolation, recovery and performance/capacity evidence | §§19.11, 20.24, 21.12, 25.8, 25.20, 26.4, 26.6–26.7, 26.13, 26.22 | Existing obligations remain baseline. This proposal makes no additional numerical concurrency guarantee. |
| Existing portal operations, profiles, project/team management and CRM | Modules 5–10; §§26.10–26.11 | Existing duties must be compared with the request before any additional layout, field or workflow is accepted or priced. |

A request for proof of an actual SRS workflow is not automatically an extension. A missing baseline requirement is not made chargeable by appearing in this proposal.

## Requests held for a precise delta

These are **not accepted additional deliverables** in this proposal:

- Full cold-outbound prospect research, enrichment and sequencing: separate the proposed engine from §14.16 campaign/lead obligations and §17.6 sales communication first.
- Complete standalone products for every agent named in §19.5: map each intended business function against explicit requirements, especially Module 11 communication capabilities.
- Detailed IVR/receptionist menus, queues, recording, interruption rules and playbooks: establish the required baseline behaviour and each requested addition; not every operating detail is necessarily new scope.
- Universal mandatory MFA: BR-014 specifies different treatment by role. Check the baseline's configurable security policy before treating a policy setting as development work.
- New numerical capacity promises or a separately specified benchmark programme: agree workloads and success thresholds; existing performance and recovery verification stays baseline.
- The complete new navigation, global search behaviour, unified customer/project layouts, Developer Working Method, extra profile fields/social links, bespoke quotation templates, payment-link tooling, safe/demo Role Preview and maintenance presentation: verify each exact delta first. Existing SRS functionality and ordinary configuration cannot be rejected or charged collectively.

This preserves the baseline without approving the client's entire set of additions or promising an implementation method that the SRS does not require.

## Commercial and delivery conditions

| Item | Proposal position |
| --- | --- |
| Development effort | Not yet estimated. Estimate each selected delta after its exact boundaries, surface count, acceptance examples and dependencies are approved. |
| One-time development fee | Not yet quoted. Provide a separate fixed quote or agreed effort basis per selected workstream. No invented fee or assumed approval. |
| External/recurring costs | AI usage, audiovisual services, hosting/storage and any approved calendar service are itemized separately once provider and usage assumptions are selected. Existing provider costs are not development fees. |
| Dependencies | Approved source specifications, design/asset inventory, supported devices, accounts/credentials, test data and owner decisions relevant to the selected item. |
| Schedule | Agreed after selection and dependency confirmation; no delivery date is promised by this proposal. |
| Change control | A new behaviour, language, portal surface, template, provider or acceptance target outside the approved item requires its own written delta and approval. |
| Acceptance | Demonstrate the selected extension's specified behaviours and agreed failure/permission cases; distinguish local automated checks from successful live provider operation. No baseline obligation is waived. |
| Relationship to earlier M4 documents | If both parties approve this proposal, it becomes the agreed extension list in place of earlier proposed extension packages. Approval does not delete or amend SRS baseline duties. |

## Proposed sequence

1. Close and verify outstanding SRS baseline items independently.
2. Select Milestone 4 workstreams and fix their exact deltas and acceptance examples.
3. Issue the itemized development quote, recurring-cost assumptions, dependencies and schedule.
4. Obtain written approval before additional implementation or provider purchase.
5. Build the selected workstreams, demonstrate them and record acceptance separately from baseline completion.

The [verification record](docs/client/SRS_SCOPE_VERIFICATION_2026-10-13.md) supports the classifications. The [client reply](docs/client/CLIENT_REPLY_2026-10-13.md) presents the proposed boundary.

The [previous scope document](docs/client/archive/MILESTONE4_NEW_SCOPE_PREVIOUS_2026-10-13.md) is retained as a historical record. Its 61/115/142 and 257-task commercial suggestions do not govern this proposal.
