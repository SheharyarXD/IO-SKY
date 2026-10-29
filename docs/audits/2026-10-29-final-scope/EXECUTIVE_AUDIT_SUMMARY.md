# IO SKY: executive audit summary, 29 October 2026

Read-only audit. No code, database, deployment or live infrastructure was changed, and nothing was committed. Code state is commit `c5bf579` (the only change since the 15 October reconciliation is documentation). Written for the engagement lead, internal use.

## What was and was not available

| Source | Status |
|---|---|
| Document 1, Consolidated Clarifications v1.3 (37 pp.) | Read in full, including Appendices A to H and the integrated blocks. |
| Document 2, Additional Functional Clarifications | **Only sections 1 to 20 reached me, and the text is cut off mid-sentence in section 20.** Sections after that were not read. It is not in the workspace as a file. |
| Document 3, Executive Briefing Specification | **Not provided and not in the workspace.** Its 16 acceptance requirements are not counted or verified. |
| Master SRS v1.1 (198 pp.) | Present in the repo. **Not re-read in full this session.** SRS clause and page references come from the 15 October reconciliation (`docs/scope-reconciliation/`) and the 21 October reply, which cite pages directly. |
| Milestone 4 Finalised Scope, Extension Proposal, original three-milestone plan | Not re-read. Taken from the prior reconciliation and the engagement lead's brief. The original three-milestone plan file was not located. |

Every figure below is conditional on those gaps. Two of the missing items (Document 2 tail and Document 3) would add tasks, not remove them.

## Headline numbers

| Measure | Value |
|---|---|
| Unique engineering tasks identified | **188** |
| A completed and verified | 4 |
| B implemented, not live-verified | 20 |
| C partially implemented | 52 |
| D not implemented | 82 |
| E blocked by an external account, provider or approval | 19 |
| F needs a specification decision first | 11 |
| Remaining (not A) | **184** |
| Remaining engineering hours (low / likely / high) | **2,408 / 3,857 / 6,234** |
| Remaining QA hours | **1,584** |
| Unique acceptance scenarios in Document 1 | **about 45** (36 numbered ACC + 34 numbered F cases = 70 stated, 25 of the F cases duplicate an ACC case) |

"4 completed of 188" is **not** a project completion percentage. The register covers only what the 29 October documents ask for. The 155 criteria already delivered (billing, Stripe, notifications, project lifecycle, dashboards, security baseline) sit outside it; four anchor tasks stand in for them. The 1,155 passing automated tests (below) cover that delivered work.

## Scope classification (tasks)

| Class | Tasks | Likely hours |
|---|---|---|
| S1 Master SRS baseline | 75 | 1,337 |
| S2 Previously approved clarification | 10 | 161 |
| S3 Separately funded extension with a documented commitment | **0** | 0 |
| S4 Potential new scope (Oct 29 text only) | 32 | 722 |
| S5 Ambiguous | 60 | 1,557 |
| S6 External account or configuration dependency | 11 | 80 |

No S3 task exists because I found no document containing a priced commercial commitment. The brief says the client agreed in principle to fund adaptive AI Scan, Executive Briefing and the report design system. Those tasks are therefore S5, not S3.

## Complexity and priority

Low 38, Medium 79, High 54, Very High 16, Critical 1. Priority P0 14, P1 69, P2 87, P3 18.

## Most complex modules

Voice stack (provider adapter, realtime speech, IVR, transfer, pre-answer handover), adaptive assessment engine, Executive Briefing (video generation, scene regeneration), targeted report regeneration with dependency checks, admin permission model, portal translation, autonomous outbound.

## Launch blockers (P0)

Fail-open AI governance (G01); report access by public token only (P08); document matrix fails open (J11); operator operations checked by role only (Z09); Admin dashboard exposes revenue (C09); guest reschedule defect (S01); identity policy and verification flow for the receptionist (R10, R11); review versus publish permission (P07); no isolated staging backend (I01); no restore rehearsal (I05); first funded live AI run (A10); DNS (N09); Stripe live keys (B10).

## Verified state of the work that was delivered

* Full test suite run locally on 29 October: **91 files passed, 2 skipped; 1,155 tests passed, 15 skipped, 0 failed.** CORRECTED 29 October (later): this run was NOT database-free. The shell had no `DATABASE_URL`, but the repository's `.env` is loaded by the test files (`import "dotenv/config"`), so the live-database suites ran against the project's Supabase database. Those suites (RM-108, RM-110, RM-111, RM-113) are read-only, roll back, or write only marker-tagged probe rows that they delete; leftovers have not been checked (see docs/milestone4/MILESTONE4_TEST_RESULTS.md). With `DATABASE_URL=` blank the result is 1,255 passed, 57 skipped, 0 failed.
* Mailboxes: three shared Zoho mailboxes have folders, 9 filters and aliases (configured 28 October). Public DNS lookup on 29 October shows **no MX, SPF, DKIM or DMARC for iosky.nl** (only the Zoho verification TXT) and **no records at all for iosky.co**. No real mail has been delivered or filed.
* AI: model calls exist for two paths (scan analysis, lead qualifier). Both are tested with a stubbed model. **No funded live run has ever occurred.**

## November 10 verdict

**Not achievable, under any scenario, by a wide margin.** Between 29 October and 10 November there are 9 working days. Four developers deliver about 147 productive hours in that window. The 14 P0 tasks alone need about 324 hours including QA. The minimum viable baseline needs about 1,618 hours. See `NOVEMBER10_FEASIBILITY_REPORT.md`.

## Where this audit disagrees with each side

* The client's framing that all of this is "clarification": Document 1 itself says classification needs source mapping and conflicts need written reconciliation (sections 1.2, G, H.4). It does not prove inclusion in the fixed price. 32 tasks (722 h) have no antecedent I could find (pre-answer handover, passkeys and universal MFA, granular admin permission model, GitHub isolation, manual template sending, guided restore and others).
* The development side's framing that only the 155 criteria count: the SRS names IVR and telephony (6.9, 17.6), AI Receptionist and Voice Agent (17.6, 19.5) and a governed multi-agent framework (19.5 to 19.25). The voice stack is baseline work that was not built, regardless of the checklist. The 155 criteria did not contain it.

## Estimate reliability

Hours are my estimates, three-point, roughly plus or minus 40 percent per task. They are larger than the 15 October envelope (77 to 136 person-days for known baseline) because they add 29 October items to baseline (messaging, teams, permissions, translation) and count QA. Compare the S1+S2+S6 figures (1,578 h likely) with that envelope on a like-for-like basis: 15 October excludes everything first requested after 15 October.
