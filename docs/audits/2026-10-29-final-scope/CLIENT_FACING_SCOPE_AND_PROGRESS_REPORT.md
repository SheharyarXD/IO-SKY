# IO SKY platform: scope and progress report

Draft for review by the engagement lead before release. 29 October 2026.

## 1. Purpose

We have read the consolidated clarification document (version 1.3, 29 October) and the additional clarification text you sent. We compared both with the Master SRS, the delivered work and the code. This report says what is delivered, what remains, what depends on you, and how we propose to proceed. It does not argue about price. It separates what we can confirm from what needs a written decision.

Two items were incomplete on our side of the exchange. The additional clarification text stopped in the middle of section 20, and we did not receive the Executive Briefing specification. We have not counted what we have not read. Please resend both.

## 2. Delivered and verified

* The 155 acceptance criteria of the SRS checklist, with a delivery report of 864 pages. 1,155 automated tests pass.
* Stripe Checkout, signed webhooks, reconciliation and invoice reminders, verified in test mode with real payments.
* Client, Admin, Developer and Super Admin portals with roles, multi-factor authentication for Admin, Super Admin and Technical Operator, audit trail, notifications (43 of 84 catalogued events connected), documents, project lifecycle, dashboards on live data, campaign attribution.
* Three shared mailboxes configured with folders, filters and aliases (support, projects, security).

## 3. Remaining obligations under the SRS that we confirm

These are in the SRS and are not finished. We are not treating the 155-item checklist as the limit of the SRS.

* A working minimum voice receptionist: telephony provider integration, IVR routing, speech, human escalation. Not built.
* The shared AI agent runtime, and the support and sales communication agents.
* Closing four security defects found in our own review: the AI permission check failing open, report access by public link, the document matrix failing open, and operator operations checked by role only. Also the Admin dashboard showing revenue, and the guest reschedule defect.
* Messaging between roles and project teams; document handoff between client and developer.
* Restore rehearsal and an isolated staging environment.
* The first live AI analysis, which needs credit on the OpenAI account.

Scale: about 92 tasks and roughly 2,300 working hours including testing.

## 4. Items that need a written decision before we can classify or price them

Your document says these are clarifications. We want to treat them fairly. We could not find an earlier source for them in what we hold, so we ask you to point us to the clause or message, or confirm them as Milestone 4 work:

pre-answer live call handover; recording and transcription controls; mandatory multi-factor authentication for Developers and Clients (the SRS says strongly encouraged and may be required); passkeys; the configurable Admin permission model with ten presets; GitHub repository isolation; manual sending from email templates; guided in-product restore; an AI improvement lifecycle; autonomous outbound prospecting; the Executive Briefing; the adaptive AI Scan engine; the book-style report viewer with targeted regeneration; international VAT and registration intake with VIES; translation of all portals into ten languages; AI Advisor.

You told us earlier that you would fund adaptive AI Scan, the Executive Briefing and the new report design. We need that in a priced document so both sides are protected. Document 1 itself says conflicts require written reconciliation; we agree and propose to do it item by item.

## 5. Current blockers on your side

| Needed | Blocks |
|---|---|
| DNS records at Hostinger for iosky.nl and iosky.co (we will resend the values) | Every email test, bookings confirmations, outbound |
| OpenAI credit | Live AI Scan, adaptive assessment testing |
| Telephony provider, number and budget | Voice and IVR |
| Stripe live keys, Stripe Tax registration, VAT number, KvK number | Live payments and invoices |
| Video provider account and budget | Executive Briefing |
| Calendar provider access | Real availability |
| Your GitHub organisation | Repository isolation |
| Supabase plan and a separate staging project | Restore rehearsal, staging |
| Answers to the open questions (agent list, meeting length, recording consent, passkeys) | Several tasks that cannot be sized |

## 6. Timing

10 November is not achievable for the platform as described in the new documents. There are 9 working days to that date. We can commit to the code-level fixes in section 3 and a written re-baseline. We will return a dated plan within three working days of receiving the decisions in section 4, delivered in increments to the protected staging environment with a release note each time, as your section 24 asks.

## 7. Acceptance method we propose

Each unit is deployed to staging with its scope, test scenarios and known limits. You review. Defects within the agreed scope are corrected and re-tested without charge. Acceptance is recorded in writing per unit against the scenario list in Document 1 (ACC-01 to ACC-36 and F-01 to F-34), with provider-dependent scenarios run only when the provider accounts exist.

## 8. Decisions we need from you

1. Confirm the list of AI agents (the SRS names ten examples; your documents imply a different set).
2. Confirm which items in section 4 are baseline in your view, with the clause, or approve them as Milestone 4 with a priced scope.
3. Add the DNS records and fund the OpenAI account.
4. Decide on telephony provider and budget.
5. Resolve the version labelling of the clarification document (cover says 1.3, footers say 1.0).
6. Send the rest of the additional clarification text and the Executive Briefing specification.
