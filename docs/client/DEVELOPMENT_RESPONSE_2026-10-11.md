# IO SKY: development team response to the Product Owner email

Prepared 11 October 2026. This answers section 40 of the Product Owner email. Statements of status
are about the deployed platform. Where something has not been verified live it says so.

## 1. Scope and status matrix

Classes as defined in the email: A Master SRS baseline, B approved Milestone 4 scope,
C Product Owner clarification, D genuine new scope.

| # | Item | Class | Reference | Status | Remaining |
|---|---|---|---|---|---|
| 2 | AI agent framework, shared orchestration | A | SRS 19.5 to 19.12 | Agent registry, versioned prompts, execution gate, append only execution log built. One agent (AI Scan analyst) registered | Further agents as their modules are built |
| 2 | Provider and model routing | A | SRS 19.25 | Model chosen per task complexity from configuration; usage and cost recorded and shown to admins | Provider priority and fallback providers; OpenAI key needed to run |
| 3 | AI configuration and prompts under Super Admin | A | SRS 24.8, 19.9 | Built, audited | None |
| 4 | AI Sales Outbound and campaigns | B | M4 4.5, SRS 14.16 | Not started | Whole workstream; needs sending mailboxes and the specification set |
| 5 | Dedicated outbound domain and mailbox | C | M4 4.5 | Not started | Domain and mailbox access, see section 4 |
| 6 | Executive dashboard and AI monitoring | A | SRS 21.5, 19.24 | Dashboard panels live except Campaigns. AI usage and cost now visible | Campaigns panel depends on 4 |
| 7 | AI Receptionist, IVR, Dutch and English | A and B | SRS 6.9, 17.6; M4 4.1 to 4.3 | Not started | Telephony account and the workstream |
| 8 | Discovery Call scheduling | A | SRS 14.7 | Built: booking, reschedule, cancel, outcomes | Pre call intelligence not started; see class below |
| 9 | Project lifecycle Created to Archived | A | SRS 15.5 | Built 11 October: ten stages, forward moves only, history kept | None |
| 9 | Tasks, deliverables, approvals, archive | A | SRS 15.6 to 15.17 | Built | None |
| 10 | Multiple developers, one primary contact | A and C | SRS 15.6, 15.10 | Built: many developers per project, one lead at a time, reassignment keeps history | None |
| 11 | Reviewer access without implementer rights | C | SRS 15.5, 15.9 | Built as an assignment role: a reviewer sees the project and cannot log time; task assignment to a reviewer is not blocked yet | A test for the time rule |
| 12 | Client uploads to their own project | A | SRS 15.7, 15.13 | Client document upload exists, scoped to the organization | Linking an upload to a specific project or task is not built |
| 13 | Technical Operator scopes with expiry | A and C | SRS 15.4 | Built: seven scopes, expiry, revocation; Security Center needs the security scope | None |
| 14 | Passkeys | C | SRS 8.16 | Not started | Needs the production domain fixed and a recovery path agreed |
| 15 | Profile for internal roles | A and C | SRS 8.16, 11 | Client and developer profile built; internal roles reuse the avatar and password parts only | Shared profile page for admin roles |
| 16 to 18 | AI Scan baseline | A | SRS 9 | Built: questionnaire, analysis, expert review, publication, portal delivery, audit | Needs OpenAI key to run live |
| 17 | Adaptive questioning, contradiction handling, multi pass | B | M4 4.7 | Not started | Specification (the AI Scan Engine specification was announced and not received by development) |
| 18 | Report design system and book viewer | B | M4 4.7 | Not started | As above |
| 19 to 21 | Executive Briefing video | D | M4 4.7 | Not started | Needs your approval and a priced estimate; see section 5 |
| 22 | Stripe, tax, invoices | A and C | SRS 16.7, Module 10 | Built: Checkout, verified webhook, Stripe generated invoice with tax ID collection, optional Stripe Tax | Stripe keys and prices; never run against live Stripe |
| 23 | Zoho sending | A | SRS 17 | SMTP sender exists | SMTP details |
| 24 | AWF-01 to AWF-09 email specification | C | n/a | Not received by development | Please send the document |
| 25 | Notification templates, OPD-001 | A and C | SRS 17.8 | Built for in app delivery: versions per event, channel and language, Dutch and English, English fallback, Super Admin managed | Email delivery from templates |
| 26 | Document governance, OPD-003 | A and C | SRS 18.19 to 18.21 | Matrix built, editable, audited; values are provisional | The OPD-003 ownership and access direction was not received; enforcement on every document endpoint |
| 27 | Environments, backup, recovery | A | SRS 19.3 | See section 6 | Decision on plan |
| 28 | Security and compliance | A | SRS 8, 20 | Explicit SRS security, RBAC and audit built and tested | Legal decisions listed in section 7 |
| 29 | Forecasting | C | SRS 15.16, 21.15 | Accepted ruling: no predictive ML | None |
| 30 to 33 | Redesign, Navbar v2.3, page content, design system | D (M4 4.8) | M4 4.8 | Not started | Specifications not received by development; see section 8 |
| 34 | Case study | n/a | n/a | Not answered | See section 8 |
| 35 | Localization | C | OPD-001 | Notification localization built; website localization depends on the navigation specification | n/a |

## 2. Genuine new scope (D)

Only these are proposed as additional. No work starts without written approval.

| Item | Delta against the baseline | Why it is not in the SRS | Effort, cost, timeline |
|---|---|---|---|
| Executive Briefing video | Narrated video generated from an approved report through a third party provider, with review before publication and a provider adapter | The SRS has no video deliverable | To be priced after the provider assessment |
| Website and platform redesign | Visual redesign of the public site and all portals to the new design language | M4 4.8 already records it as new scope | To be priced from the specifications |
| Pre call intelligence for Discovery Calls | AI generated company context and qualification questions before a call | SRS 14.7 covers scheduling and records, not generated research | To be priced if wanted |
| Prospect enrichment beyond the prospecting requirement | Public source research per prospect | To be separated from 4.5 once the specification is read | To be priced if wanted |

Costs are not stated here because they are a commercial decision for the engagement owner.

## 3. Telephony and AI Receptionist provisioning

| Question | Answer |
|---|---|
| Provider | Twilio, which the platform already integrates for messaging |
| Who creates the account | IO SKY, so the number and billing belong to the business. Give development a subaccount or API key, not the main login |
| Number | A Dutch number. A geographic number needs address verification on Twilio before it can be used |
| Capabilities | Programmable Voice with webhooks. SIP is only needed to forward to an existing phone system |
| Recording | Optional. If used, a spoken notice before recording and a configured retention period are required. The legal basis and period are IO SKY decisions |
| Credentials | Account SID, API key and secret, the phone number, and the webhook URLs which development configures |
| Environments | A separate number or subaccount for testing |
| Dutch and English | Speech recognition and voice output exist for both. Quality is judged on real calls during the build, not promised here |
| Direct costs | Number rental, per minute voice, speech and model usage. Current price list should be checked at purchase |
| Editable by Super Admin | Greeting, script, business information, opening hours, routing, escalation, language behaviour, voice |

## 4. External dependency checklist

| Dependency | IO SKY creates or buys | Development needs | Development configures | Blocks |
|---|---|---|---|---|
| Stripe | Account in test mode first | Restricted API key, webhook signing secret, tier prices and currency | Webhook endpoint `https://io-sky-production.up.railway.app/api/webhooks/stripe`, events checkout.session.completed, async_payment_succeeded, async_payment_failed, expired | Live payments only |
| Stripe Tax and invoices | Enable Stripe Tax, set company details, VAT number and logo in Stripe invoice settings | Confirmation | `STRIPE_AUTOMATIC_TAX=on` | Tax on invoices |
| OpenAI | Project with a spend limit | Project API key, model names per class, optional price table | `OPENAI_API_KEY`, `LLM_MODEL_SIMPLE`, `LLM_MODEL_MEDIUM`, `LLM_MODEL_COMPLEX`, `LLM_PRICES_JSON` | Live AI Scan analysis |
| Zoho, iosky.nl | Mailboxes, including a no reply identity | SMTP host, port, address, app password | Sender configuration | Production email |
| Domain iosky.nl | Nothing new | Access to add records | SPF, DKIM, DMARC values supplied by Zoho | Email deliverability |
| Zoho, iosky.co | Domain on Hostinger is bought. Add it to Zoho and create the fifth mailbox | SMTP details for that mailbox | Outbound sender, limits, suppression | Outbound campaigns |
| DNS for iosky.co at Hostinger | Add the Zoho verification TXT, MX, SPF and DKIM records exactly as Zoho shows them, plus a DMARC record | Confirmation, or DNS access | Nothing | Outbound campaigns |
| Supabase | Separate projects for staging and production | New keys through a secure channel, project URLs | Environment variables | Environment isolation |
| Telephony | Twilio account and number | See section 3 | Webhooks | IVR and receptionist |
| HeyGen or Synthesia | Test accounts | API key, an anonymised sample report | Proof of concept | Only the D item |

A new sending domain has no reputation. Cold outbound from iosky.co needs a gradual warm up and low
daily limits at first, or mail will be filtered. The campaign engine will enforce configurable sending
limits for this reason.

## 5. HeyGen and Synthesia assessment

Not done. It needs provider accounts and a test report, and it is the D item that awaits your
approval. Proposed plan: ten working days of assessment against the criteria in your section 19
using an anonymised report, with a short written comparison and one sample video from each provider
where terms allow.

## 6. Environments, backup and recovery

- Today there is one Supabase project. Local development and production use the same database. That is
  not acceptable isolation and is the first thing to correct: separate staging and production projects.
- Backups are provider managed. Which backups exist, how long they are kept and whether point in time
  recovery is available depend on the Supabase plan, so the plan must be checked against the current
  Supabase terms before a decision. A paid plan is likely needed for production. No upgrade will be
  chosen without your approval.
- A restore test, and a written recovery procedure, are not yet done.

## 7. Legal and compliance decisions needed

Final retention periods, lawful basis and consent wording, data subject request handling, breach
notification process, and the final Terms and Privacy/DPA text. Development implements the SRS
security, RBAC and audit requirements without waiting for these.

## 8. Specifications, case study and redesign questions

Development has not received these documents and cannot confirm them as implementation inputs until
they arrive: Navbar v2.3, the design language and Signature High Glass direction, the page by page
content and design specifications, the AWF-01 to AWF-09 email specification, the OPD-003 direction,
the AI Scan Engine specification, and the Discovery Call specification. Please send them, or tell us
where they are in the repository.

The case study questions were not found in the project. Please resend them.

The five redesign scoping questions as recorded in the Milestone 4 checklist (the original wording
is not in the final scope document):
1. Is there a design direction, or do we create one?
2. Is a designer involved on the IO SKY side, or is the design ours to produce?
3. Does redesign mean restyling existing surfaces, or rethinking the flows?
4. Which surfaces are in scope?
5. Does it apply to surfaces being rebuilt anyway, such as the AI Scan?
