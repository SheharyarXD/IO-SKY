# SRS and client-response verification — 13 October 2026

This record continues the scope review in this folder. It supports the accompanying [client reply](CLIENT_REPLY_2026-10-13.md) and [revised extension proposal](../../MILESTONE4_NEW_SCOPE.md). It is a documentary and targeted source-code review, with current public DNS checks and six existing test files run locally. It is not a new live acceptance audit of every platform feature.

The user's subsequent instruction is explicit: no additional requirement from the client's message is accepted through this response. The revised draft acknowledges existing SRS obligations only. The new Milestone 4 document proposes six core extensions and two optional additions, subject to an itemized quotation and written approval; it holds mixed/uncertain requests for an exact delta. This is a proposal, not a new commercial agreement. The older scope document has been preserved in the archive.

The defensible position is to reject automatic incorporation of every later specification into the baseline, while acknowledging functionality the Master SRS expressly requires. The previous reply’s blanket exclusion of telephony, all AI agents, subscription billing and capacity verification is not supported by the documents.

## Documents checked

| Source | Relevant evidence |
| --- | --- |
| `Master_SRS_v1.1_RELEASE_CANDIDATE_DEVELOPER_BASELINE (1) (1).pdf` | 198 PDF pages. Section references below use physical PDF page numbers, including the cover, rather than the printed page numbering. |
| `docs/client/IO_SKY_SRS_Completed_Criteria_Delivery_Report.pdf` | 864 PDF pages. Page 10 claims all 155 criteria are complete and live-verified; page 180 records that the OpenAI account had no credit and the first live analysis remained pending. Page 795 lists provider/configuration dependencies. |
| `docs/client/IO_SKY_Milestone_4_Finalised_Scope.pdf` | Four pages, dated 29 September 2026. Pages 1–2 explicitly classify telephony, receptionist and sales outbound as baseline, scheduling/Scan as mixed, and redesign as new. Page 3 also calls other named agents baseline. |
| `MILESTONE4_NEW_SCOPE.md` and archived previous version | The current document is the 13 October extension proposal. The archived 7 October working analysis used a 61/115/142 task split; that is an earlier commercial interpretation, not evidence of client approval or current implementation status. |
| `MILESTONE4_CHECKLIST.md` | Later detailed specifications and proposed work, including adaptive assessment and report redesign. |
| `docs/client/DEVELOPMENT_RESPONSE_2026-10-11.md` | Earlier status matrix; some statements are historical and cannot establish today’s live state. |
| `docs/client/ZOHO_MAIL_SETUP_RUNBOOK.md` | Recorded mailbox creation and remaining configuration tasks; sections 7 and 10. |
| User attachment and additional chat supplied in this conversation | Full earlier client review, previous assistant response, and a truncated 13 October follow-up. The original client message rejecting the proposal was not supplied. |

## Scope findings

These classifications are based on the requirement text. They do not determine the legal effect of documents or resolve an undocumented commercial agreement.

| Item | Exact source and PDF page | Finding | Position supported by the evidence |
| --- | --- | --- | --- |
| Telephony/IVR | SRS §6.9, p29; §17.6, pp99–100; M4 §4.1, pp1–2 | Version 1 communication channel support is expressly required. The SRS does not spell out every later menu, queue, recording or interruption behaviour. | A blanket “outside SRS” rejection is incorrect. Separate required channel support from each additional behaviour. Do not charge baseline functionality again merely because it was scheduled later. |
| Receptionist, Support, Sales and Voice communication | SRS §§17.2–17.3, pp97–98; §17.6, pp99–100; §19.5, pp118–119 | The communication module expressly includes these capabilities. They are not only examples in §19.5. | A registry/framework alone cannot prove operational communication capability. Detailed later products still require a requirement-by-requirement comparison. |
| All ten named standalone agents | SRS §19.5, pp118–119; M4 p3 | §19.5 requires multiple specialized agents and extensibility, but its names are examples. The M4 PDF makes a broader baseline statement about additional agents. | §19.5 alone does not specify ten complete products. The client’s claim that the M4 PDF calls them baseline is accurately quoted. Approval/supersession evidence is needed to resolve the documentary conflict. |
| Sales campaigns and lead qualification | SRS §14.16, pp80–81; §17.6, pp99–100 | Campaign management, automated follow-up and AI-assisted lead evaluation are baseline. Cold outbound prospecting and its detailed implementation are not expressly described by those clauses. | Separate baseline campaign/qualification functionality from the proposed prospecting and sequencing delta. Manual lead creation in §14.5 does not prove that the platform is restricted to inbound leads. BR-022 does not by itself prohibit campaigns. |
| AI Scan lifecycle and reports | SRS §9.5, pp44–46; §9.7, p46; §10.7, p51 | Analysis, review, approval, publication, versioning, report viewing and downloading are baseline. | Treat missing usable reports or live verification as baseline acceptance issues. Do not describe the whole Scan/report system as new. |
| Adaptive Scan, specified multi-pass method, book viewer and video briefing | SRS §§9.5–9.7; M4 §4.7, p2; later Scan specifications | The later methods, specific viewer/design architecture and video deliverable are not prescribed by the cited SRS clauses. | Strong candidates for separately agreed extensions. An implementation technique necessary to satisfy baseline analysis is not automatically chargeable merely because it uses multiple calls. |
| Discovery Call scheduling | SRS §14.7, p78; M4 §4.4, p2 | Scheduling, rescheduling, cancellation, outcomes, notes, follow-up and linkage are baseline. | Multi-host scheduling is a distinct delta. Do not classify all scheduling as new. Provider integration elsewhere in the SRS still needs checking before rejecting all calendar support. |
| Technical Operator permissions | SRS §5.7, pp22–23; §13.8, pp71–72; BR-024 | Individual configuration, temporary grants and revocation are explicit baseline requirements. | Seven UI scope labels may clarify the configuration. Merely belonging to the role cannot prove granular authorization. Source defines seven labels in `shared/platformRules.ts`; endpoint enforcement was not comprehensively re-audited in this review. |
| Admin/executive financial visibility | SRS §12.5, p63; §13.5, p70; §21.12, p141 | Operational Admin metrics and Super Admin revenue overview are distinguished; analytics must respect assigned permissions. The client also asks for an explicit company-wide financial restriction. | Current `admin.summary` returns `revenueMTD` through `adminProcedure`. The requested restriction is not currently enforced on this endpoint. Do not claim it is fixed. The SRS does not exhaustively spell out every finance permission requested. |
| Project documents and messages | SRS §10.11, p52; §15.13, p87; §§18.6, 18.20, pp109,113–114; BR-011 | Authorized customer communication, project/organization document relationships and the controlled Client/Developer boundary are baseline. | Treat complete workflow/permission evidence as a baseline check. A UI screenshot alone does not establish full routing or tenant isolation. No full workflow demonstration was performed here. |
| Quotes, invoices and subscriptions | SRS §§16.5–16.9, pp91–94 | Quotes, downloadable invoices and recurring commercial services are already in the SRS. | Specific templates or provider mechanisms can have a delta; the complete billing/subscription capability cannot be categorically rejected as new. Tax/legal treatment was not assessed in this review. |
| Email templates and delivery | SRS §§17.6–17.9; runbook; source `server/email.ts` | Email communication is baseline. Source supports SMTP, a separate provider path, and a console fallback. | Console “success” and unit tests are not inbox delivery evidence. Do not assert AWF/BWF were never supplied: no separately identifiable AWF/BWF files were found in this folder, which says nothing conclusive about other delivery channels. Request a location or exact unresolved value. |
| Document governance OPD-003 | SRS §18.21, pp114–116; Appendix D | The original SRS leaves specific matrix fields pending owner approval. The client says later clarifications were supplied. | Reconcile the actual clarifications before claiming the entire decision remains unanswered. No later OPD-003 decision document was conclusively identified in this review. |
| Backup and restore | SRS §20.24, pp136–137; §25.8, p177; §25.20, p181; §26.13, p188 | Backup procedures, verification, recovery validation and documentation are explicit baseline obligations. | Recovery verification cannot be categorically dismissed as additional scope. Current subscription, separate environments and restore readiness were not independently inspected here. |
| Performance and capacity | SRS §§26.4, 26.6–26.7, pp185–186; §26.22, pp190–191 | Performance, expected workloads, response time, throughput, resource utilization and capacity trends are baseline. No numerical concurrency guarantee was established by this review. | Separate baseline verification from newly requested numerical targets or an additional benchmark programme. Rejecting all capacity evidence as new is unsupported. No load tests were run here. |
| MFA and passkeys | BR-014, pp14–15; SRS §8.16, pp41–42 | MFA is mandatory for Super Admin, Admin and Technical Operator; Developers are encouraged and Clients can be required by policy. No passkey requirement was found in the SRS text. | Passkeys are an additional authentication method. Universal MFA goes beyond BR-014’s unconditional rule, subject to policy and subsequent agreement. |
| Visual redesign and navigation | SRS §7.8, pp33–34; §26.10, p187; M4 §4.8, p2 | Responsive/accessible navigation is baseline; a later wholesale visual redesign is separately classified as new in the M4 document. | Do not automatically label every small navigation correction new. Compare the new design/navigation specification with the existing baseline. |

## Implementation evidence inspected

- `server/db/srsGovernance.ts` registers the AI Scan analyst and provides agent configuration, prompts and action history.
- `server/leadEvaluation.ts` registers the `lead_qualifier`, uses lead facts to request AI recommendations, records the outcome, and does not automatically change the lead. This is an implemented code path, not proof of a successful live model call.
- `server/routers/admin.ts` exposes `summary` through `adminProcedure` and returns the revenue field produced by `buildSummary()`. `server/_core/trpc.ts` accepts Admin and Super Admin at that gate. This review did not change it.
- `shared/modelRouting.ts` defaults simple/medium tasks to `gpt-4o-mini` and complex tasks to `gpt-4o`, with environment overrides. These defaults do not establish the current production model or measured scan cost. The earlier cost/token estimates were not verified and were omitted from the reply.
- `server/email.ts` can report `ok: true` for a console fallback. The existing email-log test expressly records that fallback as “sent”; that result cannot substantiate real Zoho delivery.

## Current DNS observations

Public DNS was queried during this review using Windows DNS and Google Public DNS over HTTPS. Both returned consistent results. These are current public observations, not a login to the Zoho or Hostinger account.

| Query | Google DNS status | Answer |
| --- | --- | --- |
| `iosky.nl MX` | 0 / NOERROR | No answer records |
| `iosky.nl TXT` | 0 / NOERROR | Zoho ownership verification TXT only; no SPF record |
| `iosky.co MX` | 0 / NOERROR | No answer records |
| `iosky.co TXT` | 0 / NOERROR | No answer records; no SPF record |
| `_dmarc.iosky.nl TXT` | 3 / NXDOMAIN | No record |
| `_dmarc.iosky.co TXT` | 3 / NXDOMAIN | No record |
| `zmail._domainkey.iosky.nl TXT` | 3 / NXDOMAIN | No record at the documented selector |
| `zmail._domainkey.iosky.co TXT` | 3 / NXDOMAIN | No record at the documented selector |

Query endpoints: [iosky.nl MX](https://dns.google/resolve?name=iosky.nl&type=MX), [iosky.nl TXT](https://dns.google/resolve?name=iosky.nl&type=TXT), [iosky.co MX](https://dns.google/resolve?name=iosky.co&type=MX), [iosky.co TXT](https://dns.google/resolve?name=iosky.co&type=TXT). Absence at `zmail` does not exclude another DKIM selector. The browser tool could not open these JSON endpoints; direct read-only HTTPS queries succeeded.

The runbook records creation of `support@`, `projects@`, `security@` and aliases, together with existing personal users occupying the remaining licences. It does not record completion of the final `.co` sender mailbox, all folders/filters, SMTP verification or real delivery tests. Mailbox creation was not rechecked in the account. No external configuration was changed and no email was sent.

## Checks run

Command: `pnpm.cmd exec vitest run server/aiGovernance.test.ts server/aiScanScoring.test.ts server/emailDeliveryLogging.test.ts server/emailBranding.test.ts server/integrations.test.ts server/platformRules.test.ts`

Result: **45 tests passed in 6 files**, exit code 0. These are local automated checks with mocked/provider-independent paths. They do not prove live OpenAI, Stripe or Zoho operation and do not establish capacity. The `.cmd` entry point was used after PowerShell blocked the `.ps1` shim; system execution policy was not changed.

## Corrections to the previous response

1. Do not repeat “all 155 are live-verified, therefore every SRS obligation is complete.” The report itself records a pending first live AI analysis, and §26.18 requires module compliance beyond a checklist count.
2. Do not say telephony or AI communication is absent from the SRS. §17.6 expressly requires it.
3. Do not treat every illustrative agent name in §19.5 as a fully specified standalone product, or ignore the additional explicit communication requirements in Module 11.
4. Do not claim subscriptions, invoice downloads, granular Technical Operator access, recovery validation or all capacity verification are new scope.
5. Do not rely on “nothing has been built” in the September M4 PDF as evidence that its requirements are outside the SRS. That is a historical implementation statement.
6. Do not claim the client rejected or accepted the M4 proposal as a verified fact without the relevant message. The additional chat contains the team’s claim and the client’s assertion of agreement, but not the original approval/rejection.
7. Do not describe email configuration as complete. Current DNS evidence contradicts that statement.

The suggested reply is deliberately firm about authorization of additional work and precise about baseline obligations. It does not invent approval, chargeable prices, a live demonstration, or the wider team’s current schedule.
