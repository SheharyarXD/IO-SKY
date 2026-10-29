# 10 November 2026 feasibility

## Verdict

**Not achievable.** Not for the minimum viable baseline, not for the full baseline, not for baseline plus extensions, and not with four developers. I am not offering a date that depends on assumptions I cannot defend.

## Assumptions (stated so they can be challenged)

* Start 29 October 2026. Working days Monday to Friday. Window to 10 November = **9 working days**.
* 6 productive hours per developer per day (the rest is review, meetings, defects, deployment).
* Parallel efficiency: 1 developer 100%, 2 developers 88%, 3 developers 78%, 4 developers 68% (coordination, shared runtime and review dependencies).
* Effort = likely engineering hours + QA hours from the register. QA is done by the same pool.
* Plus 6 working days of fixed overhead: client review cycle, deployment, bug-fix buffer, handover.
* Provider waits (DNS, accounts, credits, approvals) are **excluded**, so every date is a floor.

## Capacity in the window

| Developers | Productive hours available to 10 Nov |
|---|---|
| 1 | 54 |
| 2 | 95 |
| 3 | 126 |
| 4 | 147 |

## Demand

| Scenario | Tasks | Eng. hours (likely) | QA hours | Total |
|---|---|---|---|---|
| P0 tasks only | 14 | 212 | 112 | 324 |
| 1 Minimum viable baseline (open S1, S2, S6 tasks at P0 and P1) | 55 | 1,088 | 530 | 1,618 |
| 2 Full agreed baseline (all open S1, S2, S6) | 92 | 1,578 | 734 | 2,312 |
| 3 Baseline plus all extensions and ambiguous items | 184 | 3,857 | 1,584 | 5,441 |

Even the P0 list alone (324 h) exceeds four developers' capacity before 10 November (147 h).

## Schedule by scenario (working days including 6 days overhead, and finish date)

| Scenario | 1 dev | 2 devs | 3 devs | 4 devs |
|---|---|---|---|---|
| 1 Minimum viable baseline | 276 d, Nov 2027 | 159 d, Jun 2027 | 121 d, Apr 2027 | 105 d, Mar 2027 |
| 2 Full baseline | 391 d, Apr 2028 | 225 d, Sep 2027 | 171 d, Jun 2027 | 148 d, May 2027 |
| 3 Baseline plus extensions | 913 d, Apr 2030 | 521 d, Oct 2028 | 394 d, May 2028 | 339 d, Feb 2028 |

Optimistic case (all tasks at their low estimate) is about 62 percent of these figures; pessimistic about 162 percent. Scenario 2 with four developers, optimistic: roughly 90 working days, still about 18 weeks.

These are the numbers a literal reading of the register produces. They are long because the register contains work that is genuinely large (voice, adaptive assessment, video, permissions, ten-language portals). Two things shorten it in practice and neither is a guess: (a) several tasks cannot proceed until the client decides (11 F tasks, 200 h likely) and could be dropped or reduced by a decision; (b) the 60 S5 tasks, 1,557 h likely, shrink or vanish if the client confirms the narrower reading of the M4 workstreams.

## Critical path

1. Voice: R01 adapter, R02 realtime speech, R16 adaptive conversation, R05 transfer, R06 pre-answer handover. About 160 hours of strictly dependent work for the first working call, then verification and recording work. Needs the Twilio account, a number and AI credit first. This chain does not shorten with more people.
2. Shared agent runtime G03 (about 56 h) gates every agent task, the receptionist tools, Support and Sales agents, Advisor and Outbound replies.
3. Adaptive assessment A01, A02, evidence linkage A09, reviewer panel P04, targeted regeneration P05. About 180 hours of dependent work. Gated by OpenAI credit for any real test.
4. Permission model Z06 gates presets, access preview, publish rights and billing-admin scoping.

## External blockers on the critical path

DNS records (N09); OpenAI credit (A10, A11); telephony provider, number and budget (R01 to R06); Stripe live keys and VAT, KvK data (B10, B03); video provider and credits (X01, X10); calendar provider access (S03); client GitHub organisation (Z12); a Supabase plan and an isolated staging project (I01, I05). Document 3 and the rest of Document 2 (X11, X12).

## What could be delivered by 10 November

Realistically only items that need no new accounts, are small, and close real defects. The P0 defect fixes that are code-only: G01 fail-open, J11 document matrix, P08 report ownership, Z09 operator scope mapping, C09 revenue exposure, S01 reschedule. Likely 90 to 130 engineering hours plus QA, which two or three developers could finish in about 8 to 9 working days if started immediately. That is a defensible commitment. Everything else is not.

## Proposed realistic schedule (to be confirmed with the client)

1. By 10 November: the six code-only P0 fixes above, with tests, plus the DNS and OpenAI-credit unblock requests answered by the client.
2. Decision gate, client side (target 6 November): answer the 11 F items (agent list, meeting-duration policy, calendar provider, consent rules, Documents 2 and 3).
3. Written re-baseline within 3 working days of the gate, as a Milestone 4 plan with dated deliverables.
4. Baseline closure (scenario 2) delivered in increments to staging, each unit reviewed as Document 1 section 24 requires.

## Risks

Estimating error of plus or minus 40 percent; provider limits on pre-answer handover (Document 1 itself concedes this may be constrained); telephony and video generation need specialist experience not currently evidenced in the repository; no isolated staging means the skipped database tests (57 in the 15 October run) still cannot run; client feedback cycles are assumed at 6 days in total and routinely take longer.
