# IO SKY — audit method, source limits and commercial evidence

Prepared 15 October 2026. Repository HEAD `a1ca0e535775134104dd8527c3d06494e5a3a6e0`. The pre-existing working tree contained documentation changes; no application source was changed by this audit.

## What was actually reviewed

The source register covers 131 extracted PDF/Markdown documents found recursively outside dependency/build/git folders. The full 198-page Master SRS text was indexed, including its 448 numbered clauses and four appendices. The 864-page report was extracted and all 155 acceptance headings located. The five specialist voice/scheduling/sales documents were segmented and their cited sections inspected, including 101 body sections in Sales Outbound after excluding its contents page. AI Scan engine, operations addendum, report-design and relevant notification/audit/security documents were compared at the cited requirements. The source register distinguishes text indexing from individual clause comparison and identifies image-only pages rather than claiming their text was reviewed.

Source code inspection covered routers, the 93-table schema, database helpers, platform rules, LLM calls, notification dispatch, booking holds/transitions, authorization, agent registry, public report access, operations and test evidence. Reverse traceability includes all 155 claims. The matrix has 539 review rows: 155 acceptance claims, 128 focused comparisons/dependencies, 230 additional normative-section evidence exceptions and 26 global Business Rules. These overlap and are not independent contractual requirements or payable tasks.

## Full coverage limitation

`IO_SKY_SRS_CLAUSE_COVERAGE.csv` preserves all 448 numbered clauses, 26 global Business Rules, eight Product Principles and the four appendices. 319 numbered clauses have explicit review-row links, including 230 B evidence exceptions; the 129 remaining context/exception/index clauses retain candidate module links. FWD rows are not passes and not claims that code is absent. Their text, candidate evidence and exact verification limitation are recorded individually. This is a complete section-level inventory, not full atomic forward acceptance certification. It establishes that the existing 155-item evidence does not prove complete SRS coverage.

## Classes and evidence

A: narrowly supported delivered baseline, using actual implementation/tests plus supplied historical evidence where available. B: confirmed defect, incomplete capability or insufficient verification; the precise reason is stated. C: ambiguous boundary/clarification requiring an agreed interpretation. D: technically demonstrable later capability/deliverable beyond SRS; whether it was accepted commercially remains a separate unanswered question. E: external dependency/operational decision.

Historical screenshots/database excerpts are evidence from the delivery report, primarily 10–11 October; they are not a fresh authenticated production demonstration. Mocked tests do not establish provider operation. A source-level defect is not represented as a reproduced production incident. Missing a particular screenshot is not itself evidence of incomplete implementation.

## Current checks and restrictions

TypeScript `tsc --noEmit` passed. The isolated Vitest run passed 1,113 of 1,170 tests, with 57 skipped and zero failed, across 93 file results. Child-process service credentials were removed and dotenv directed to a nonexistent file. Live RLS, concurrency, database constraint/query-plan, legal database and acceptance tests skipped rather than writing production fixtures. No seeding, migration, restore, payment, call, account creation, live model run, mail send, deployment, commit or push was performed. The sanitised test-name/status evidence is retained; credentials and raw configuration are not.

Read-only current checks: Railway HTTPS `/health` and `/health/ready` returned 200, HSTS was present and HTTP redirected to HTTPS. `/health/version` reported `commit: unknown`, `builtAt: unknown`, `environment: production`; current source/deployment equality is therefore unverified. The custom `iosky.nl` HTTPS root returned 404; `iosky.co` returned 200. This does not demonstrate portal/authentication flows, staging, or absence of mixed content. Health timings are single network-inclusive observations, not load-test capacity or server latency benchmarks.

DNS checks on 15 October 2026: neither domain returned MX or SPF records; both DMARC names were NXDOMAIN. DKIM was absent at documented selector `zmail`, which does not rule out another selector. Mailbox existence and SMTP access were not rechecked in Zoho. The earlier runbook records created mailboxes and unfinished configuration; account plan, current credentials and provider balances were not inspected.

## Unavailable primary evidence

- `IO_SKY_Three_Milestone_Plan.pdf`: referenced by repository checklists and older reports, but the original file is absent. Retrospective milestone reports and a quoted paragraph in another report are secondary evidence, not the agreed plan itself.
- Original signed acceptance/commercial change orders, original approval or rejection of Milestone 4, and the full latest client follow-up: not supplied. The available chat is partial. File labels such as FINAL, APPROVED or Finalised do not establish commercial agreement.
- Eight individual agent specifications: no such set located. The actual SRS has ten illustrative names; it does not contain eight attached individual agent input/output contracts.
- The exact authoritative Security & Compliance Specification referenced by §26.16: not located. The production-readiness/access/security-decision and audit-governance PDFs are real available documents; equivalence to that companion is not assumed.
- Standalone AWF/BWF specifications and authoritative later OPD-003 per-type values: not identified. The client's statement that these were delivered elsewhere cannot be disproved by repository absence.
- Raw delivery evidence bundle (`manifest.json`, `done.json`, `evidence-data.json`, original capture/test manifests): not in the repository. The PDF and report-generation content/scripts are available.
- Current provider consoles, subscription tiers, private authenticated demonstrations, isolated staging fixtures, a restore transcript and a representative production-equivalent load-test report: not available to this audit.

The SRS cover and document-control pages themselves say approval is pending open Product Owner decisions. Both parties' use of it as the working baseline is accepted for this technical comparison; final legal status and contractual liability are not decided here.

## Commercial lists

1. Delivered baseline: the 111 Category A acceptance claims, plus narrower A capability rows, subject to each row's evidence limits.
2. Outstanding baseline: 44 qualified acceptance claims and their B capability findings; known defects are separated from missing live evidence.
3. Later requirements already accepted through written agreement: none can be independently established from an original signed plan/change approval in this corpus. Some documents self-describe as approved, and earlier replies describe intended work; these are recorded, not converted into an assumed order.
4. Proposed extensions: nine D packages in `IO_SKY_PROPOSED_MILESTONE4_EXTENSIONS.md`. Their technical delta is established; commercial approval is unverified.
5. Further requests/change control: C rows, including extra standalone agents, exact voice playbooks/queues, spoken launch languages, universal MFA, provider/calendar interpretation, advanced analysis method, buffer policy and new numerical guarantees. They must not be priced as new or accepted as baseline wholesale.
6. External setup/decisions: DEP-01–DEP-10 and IVR-03, separately recorded as E.

## Estimation rules

One person-day is eight productive engineering hours. Estimates include ordinary implementation/package tests, assume existing code is reused, and exclude provider waiting, unknown legal/content decisions and promised calendar dates. They are planning ranges, not quotes. Unresolved interpretations and evidence exceptions can change engineering scope. Row estimates reference shared packages and must not be summed. FWD rows share an additional 8–16 person-day traceability/evidence review allowance; further engineering is unestimated, not assumed missing. Extensions assume baseline services are closed; no baseline function is billed twice.
