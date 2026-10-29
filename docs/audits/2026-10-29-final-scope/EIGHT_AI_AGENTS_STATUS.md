# AI agents: status, 29 October 2026

## The roster question

"Eight AI agents" does not match any document I could read.

* Master SRS 19.5 (pp118-119) names **ten** examples, "including but not limited to": AI Support Agent, AI Sales Agent, AI Receptionist, AI Voice Agent, AI Operations Agent, AI Project Assistant, AI Document Assistant, AI Reporting Agent, AI Compliance Assistant, AI Executive Assistant. Six of the ten appear only in that list.
* M4 Finalised Scope p3 refers to "eight other" agents as baseline but excluded from that milestone (ten minus Receptionist and Sales is one possible reading).
* Document 1 never lists eight. It names the AI Receptionist, AI Scheduling Agent, AI Sales Outbound, AI Scan Analyst, AI Advisor and the Executive Briefing generator, and says in Appendix D the registry must be "confirmed". Ten SRS examples plus Document 1's names give about thirteen distinct candidates, not eight.

Decision needed from the client (task G12, F class): which agents, with what functions. Until then the six assistant agents cannot be estimated beyond placeholders.

## What exists in code (verified)

* Registry, prompt versions, execution log and usage tables (`ai_agents`, `ai_prompt_versions`, `ai_executions`, `ai_usage`; `server/db/srsGovernance.ts`).
* Two executable model paths: AI Scan analyst (`server/_core/aiScanScoring.ts`) and lead qualifier (`server/leadEvaluation.ts`), both through `server/_core/llm.ts`, with complexity-based model routing (`shared/modelRouting.ts`).
* Tested only with a stubbed model: `aiGovernance.test.ts`, `aiScanScoring.test.ts`, `integrations.test.ts`, `llm.test.ts`. **No funded live execution has occurred.** The OpenAI key is accepted by the provider; the account has no credit.
* **Defect:** the scan permission gate returns "allowed" when the registry lookup throws (`server/aiGovernance.ts:21`), and `aiGovernance.test.ts` asserts that behaviour. This contradicts SRS 19.18 (p123). Task G01, P0.
* A registry page exists in the admin portal. A registry entry and an admin page do not make an agent work.

## Per agent

Estimates are likely engineering hours from the register, excluding the shared runtime G03 (56 h) which every agent below needs first.

| Agent | Requirement (source) | Implementation | Integrations working | Missing | Provider | Tests | Hours |
|---|---|---|---|---|---|---|---|
| AI Receptionist | SRS 17.6, 19.5, 19.22; Doc 1 Ch 6, App E, Doc 2 s3 to 5 | None. No inbound handler, speech, IVR, session tables | None | Everything: R01 to R24 | Twilio account and number absent; OpenAI no credit | None | about 585 |
| AI Voice Agent | SRS 17.6, 17.11, 19.5 | None. Shares the receptionist runtime | None | Covered by R01, R02 | As above | None | in R-series |
| AI Support Agent | SRS 17.6, 17.11, 19.5 | None | None | Runtime and tools (G10) | OpenAI | None | 38 |
| AI Sales Agent | SRS 14.16, 19.5 | Partial: inbound lead qualification | Lead evaluation writes recommendation only | Conversation, follow-up actions (G11) | OpenAI | `integrations.test.ts` stubbed | 26 |
| AI Scheduling Agent | SRS 14.7, 19.19; Doc 1 Ch 7 | Engine only, no agent | Booking, reminders | Agent tools (S02), reschedule fix (S01) | none | `bookings.test.ts` | 144 for WS3 |
| AI Sales Outbound | M4 4.5; Doc 1 Ch 9, Doc 2 s13 | Read-only campaign attribution | None for sending | O01 to O13 | iosky.co mailbox, DNS | none | about 300 |
| AI Scan Analyst | SRS 9.5, 19.14; Doc 1 Ch 13, Doc 2 s6 | Scoring and model call; static questionnaire | Stripe webhook, onboarding | Adaptive engine, evidence links, live run | OpenAI credit | stubbed | WS5 about 238 |
| Executive Briefing generator | Doc 1 13.4, Doc 2 s11, Doc 3 | None | None | X01 to X12 | HeyGen or Synthesia absent | None | about 290 |
| AI Advisor | Doc 1 Ch 18; SRS 13.15, 21.23 | Dashboards on live data; no recommendation engine | Dashboards | C07, C08 | OpenAI | none | 54 |
| AI Operations Agent | SRS 19.5 (named only) | None | None | Undefined | n/a | none | placeholder 28 |
| AI Project Assistant | SRS 19.5 (named only) | None | None | Undefined | n/a | none | placeholder 24 |
| AI Document Assistant | SRS 19.5 (named only) | None | None | Undefined | n/a | none | placeholder 24 |
| AI Reporting Agent | SRS 19.5 (named only) | None | None | Undefined | n/a | none | placeholder 24 |
| AI Compliance Assistant | SRS 19.5 (named only) | None | None | Undefined | n/a | none | placeholder 24 |
| AI Executive Assistant | SRS 19.5 (named only) | None | None | Undefined; overlaps Advisor | n/a | none | in C07 |

Permissions: the Technical Operator model has seven scopes and grants with expiry; individual per-agent grants and tool-layer enforcement are not implemented (G09). Business-data scoping for agents does not exist beyond the two scan and lead paths.

## Overlap rule

Receptionist, Voice Agent and IVR share one runtime and one provider adapter. Counting them as three builds would triple-count; the register counts the adapter once (R01) and the conversation layer once (R16).
