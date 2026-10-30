# Milestone 4 blockers and open decisions

Each entry names the exact missing item, who owes it, why it blocks, and what can continue. A missing credential is not a missing piece of code, and the entries say which it is. Task IDs refer to `MILESTONE4_TASK_REGISTER.csv`. Source: `docs/audits/2026-10-29-final-scope/CLIENT_DEPENDENCIES_CHECKLIST.md`, re-checked against the register on 2026-10-29.

## A. External accounts, credentials and configuration (not code)

| # | Exact missing item | Owner | Blocks (tasks) | Why | Can continue without it |
|---|---|---|---|---|---|
| 1 | MX, SPF, DKIM, DMARC records for iosky.nl at Hostinger (values in `docs/client/ZOHO_MAIL_SETUP_RUNBOOK.md` section 7). A public lookup on 29 Oct showed only the Zoho verification TXT. | Client | N09, N08, N10, S08, T05 | No mail can be received or authenticated; booking confirmations cannot be proved to arrive | Template rendering, event routing, dedupe, retry logic and delivery logging can be built and unit tested |
| 2 | iosky.co: Zoho verification TXT, then MX, SPF, DKIM, DMARC; sender mailbox 5 address | Client | O12, O05 | Outbound sending identity does not exist | Outbound domain-free parts (state machines, suppression lists) only if the Outbound scope is authorized |
| 3 | OpenAI credit on the supplied key (the key is accepted, the account has no credit) | Client | A10, A11 | No funded live AI call has ever run | Everything against the stub model: gating, prompt versions, logging, scoring parsers |
| 4 | Telephony provider decision, account, number, voice budget | Client | R01, R02, R03, R05, R06, T05 | There is no voice code and no account; the existing Twilio code is SMS only | Typed provider-adapter interface, webhook signature verification, call-session state machine, only once the baseline voice scope is confirmed |
| 5 | Stripe live keys, Stripe Tax registration, VAT number, KvK number | Client | B10 (and B05, B08) | Live-mode verification and invoice footer data | Webhook idempotency, reconciliation and invoice access tests in test mode |
| 6 | Isolated staging database / Supabase plan decision | Client and Supabase plan | I01, I05, M4-03 | There is only one database. The live-database suites (RM-108, RM-110, RM-111, RM-113) currently run against it, via `.env`, whenever `npx vitest run` runs (locally and in CI). They are read-only or marker-scoped, but an isolated database is the proper place for them, and the SQL-level behaviour of the six fixes cannot be verified in isolation until one exists | All logic tests with fakes; run locally with `DATABASE_URL=` blank to stay off the live database |
| 7 | Video provider account (HeyGen or Synthesia) and budget | Client | X01, X10 | No provider to integrate | Nothing, and Executive Briefing is a disputed scope in any case |
| 8 | Client-owned GitHub organisation | Client | Z12 | GitHub isolation lives in client-owned repositories | Nothing in the product |

## B. Decisions and documents the client owes

| # | Decision or document | Tasks | Why it matters |
|---|---|---|---|
| 9 | Agent roster: the SRS lists ten examples, the clarifications imply a different set, nothing lists "eight" | G12 to G17 | Six agents cannot be specified, so none is built |
| 10 | Pre-answer handover, recording consent rules, passkeys and universal MFA (conflicts with BR-014), meeting duration (75 or 60 minutes), calendar provider | R13, Z01 to Z03, S03, S05 | Behaviour not defined in the SRS; do not assume |
| 11 | Remainder of Document 2 after its section 20, and Document 3 (Executive Briefing) | X11, X12 | Not received; nothing counted or built from them |
| 12 | Written commercial approval for the extensions the 29 Oct documents describe (adaptive scan, Executive Briefing, report design system, redesign, outbound autonomy, and others) | all PAID_M4_PROPOSED and SCOPE_DISPUTED tasks | None of these is started without it |
| 13 | M4-02: delivery of free guest scan reports without a bare public link | M4-02, P08 | The free tier still uses the emailed link |
| 14 | M4-04: confirm the operator operation-to-scope mapping | M4-04, Z09 | Operators without a relevant grant now lose those console panels |
| 15 | Whether untyped client documents stay visible | J11 | Hiding them would hide every legacy document |

## C. Internal blockers (ours)

| # | Item | Notes |
|---|---|---|
| 16 | M4-01 report download logging needs a new audit table and a migration | A migration file can be written, but it is not applied to production without authorization |
| 17 | M4-03 run the real-database suites on an isolated database | Depends on item 6 |

## Migration order (written, NONE applied by this repository)

| File | Task | Must be applied BEFORE deploying the code? | If the code runs without it |
|---|---|---|---|
| `drizzle/0037_email_outbox.sql` | N03 | No | The email retry queue and worker are quiet no-ops and log once. Failed emails are still logged as before. |
| `drizzle/0038_ai_agent_registry_fields.sql` | G02 | **Yes** | The registry page errors, and because the AI permission gate fails closed, AI Scans and the lead qualifier are refused (Drizzle reads and inserts every `ai_agents` column). |
| `drizzle/0039_operator_scope_length.sql` | G09 | No | Granting an agent scope whose key makes it longer than 32 characters fails with a database error. Nothing else changes. |
| `drizzle/0040_report_download_audit.sql` | M4-01 | No | Report downloads are not audited (logged once). Downloads and refusals work as before. |
| `drizzle/0041_document_handoff.sql` | J09, J10 | No (fails closed) | No document can be released and developers see none. Client uploads and every existing feature are unaffected. |
| `drizzle/0042_faq_store.sql` | R17 | No (fails closed) | The FAQ source returns nothing, so an agent says it does not have the information. The admin FAQ endpoints error. No other feature depends on it. |
| `drizzle/0043_developer_assignment_events.sql` | J04 | No (fails closed) | Task moves and developer replacements are refused (they will not run without a record). Existing assign and unassign carry on and skip the history (best effort in a savepoint). Nothing else depends on it. |
| `drizzle/0044_developer_teams.sql` | J03 | No (fails closed) | The team endpoints return an error and the developer's My teams view is empty. Nothing else depends on it. |
| `drizzle/0045_lead_owners.sql` | C01 (owner) | No (fails closed) | Every lead shows as unowned, the Owner filter finds nothing owned, and assigning an owner returns an error. The leads table is not altered. |
| `drizzle/0046_ai_scan_report_versions.sql` | P06 | No (fails closed) | Report versions are not kept (logged once per report) and the version list is empty. Reports still reach review, approval and publication exactly as before. |
| `drizzle/0047_message_mediation_log.sql` | J07 | No (fails closed) | Relays and broadcasts to developers are refused (nothing is sent without its record). Existing messaging is unaffected. |
| `drizzle/0048_callback_tasks.sql` | R21 | No (fails closed) | Callbacks cannot be created (staff screens and the receptionist tool say so; the tool tells the assistant not to promise a callback) and the escalation sweep does nothing. Nothing else depends on it. |

Independent except 0038. Apply each to a non-production database first, verify, then production, then deploy. The tests do not need any of them (they are database-free). The SQL of 0037, 0040, 0041, 0042, 0043, 0044, 0045, 0046, 0047 and 0048 (claim query, append-only triggers, partial unique index, the developer access joins) has never run against PostgreSQL: that verification is task M4-03 and needs the isolated database.

## Dependency of the seven items marked BLOCKED_EXTERNAL that are code-heavy

R01, R02, R03, R05 are marked blocked because they need the telephony account, but the voice scope is baseline according to the 15 October reconciliation and the 29 October audit. The adapter interface, signature verification and session state machine can be built and tested without the account once the voice scope is confirmed and the next unit of work is chosen. They are not started in this session because the first priority was the six defects.
