# Milestone 4 Implementation Checklist

Live tracking document, same convention as `PHASE1_CHECKLIST.md` (Milestone 1), `MILESTONE2_PROGRESS.md`
(Milestone 2) and `MILESTONE3_CHECKLIST.md` (Milestone 3).

**Scope basis:** the five specifications in `Phase 4 pdfs/`, received 17 to 18 September 2026.

| Document | Version | Pages | Sections |
|---|---|---|---|
| AI Receptionist Functional Specification | 1.0 | 13 | 57 |
| AI Receptionist Conversation & Response Playbook | 1.0 | 17 | 71 |
| IVR & Telephony Functional Specification | 1.0 | 14 | 47 |
| Scheduling Agent Functional Specification | 1.0 | 16 | 54 |
| AI Sales Outbound Functional & Technical Specification | 1.0 | 21 | 101 |

The AI Scan Engine specification has been announced but not yet received. Section 4.7 is a placeholder
for it and is deliberately empty rather than guessed at.

Task IDs continue the `RM-` numbering. Milestone 1 ran RM-01..RM-63, Milestone 3 ran RM-64..RM-119, so
this milestone starts at **RM-120**.

Legend: ✅ Done and verified · 🔶 Partial · ⛔ Blocked (external decision, credential or access) ·
⏭ Not started

**Status: not started. 0 of 216 tasks complete.** None of this exists today. What is in the product now
is a design preview screen labelled as sample data, with no telephony, speech, or agent implementation
behind it.

---

## Read this before planning the schedule

These specifications set their own acceptance bar, and they set it explicitly against shipping breadth
over depth. This is not an opinion about how to work; it is what the documents say, repeatedly, in the
sections that define completion.

> "The objective is higher-quality commercial opportunities with substantially less manual work, not
> maximum outreach volume." — AI Sales Outbound, ASO-CORE-003

> "A successful demo of a single happy-path call is not sufficient acceptance evidence." — IVR §44

> "UI existence alone is not completion." — AI Sales Outbound §84

> "A connector is not complete merely because its name appears in the UI." — AI Sales Outbound §95

> "A visible source logo/card is not a completed integration." — AI Sales Outbound, ASO-CON-001

> "The AI Receptionist is not considered complete merely because one successful AI telephone
> conversation can be demonstrated." — AI Receptionist §51

> "A single happy-path demo or statement that 'tests passed' is insufficient." — Scheduling Agent §50

The practical consequence for planning: a feature built to demo standard will not pass acceptance, and
the rework is more expensive than building it once. Every one of the four products requires
demonstrated failure paths, session isolation under concurrent load, permission isolation, audit
coverage and evidence retained for IO SKY to inspect. That evidence requirement is what sets the pace,
not the feature count.

Where volume of visible progress matters, the honest lever is **sequencing**, not lowering the bar.
Section 4.0 below is shared foundation that unlocks all four products at once; completing it produces a
large amount of demonstrable capability early. Building the four products in parallel without it means
building the same telephony, speech, permission and audit groundwork four times.

---

## Prerequisites that block work before it starts

These are not tasks we can complete. Each needs a decision, a credential or an account from IO SKY.
The specifications themselves require these to be raised early rather than absorbed silently
(AI Sales Outbound §98, IVR §45, Scheduling §51).

| ID | Prerequisite | Blocks | Notes |
|---|---|---|---|
| RM-120 | Telephony provider selection and account | All of 4.1, most of 4.2 and 4.3 | Needs to support SIP, concurrent channels, DTMF, call recording control, transfer and programmable call control. Nothing in telephony can start without this. |
| RM-121 | Speech to text and text to speech provider selection | 4.2, 4.3, parts of 4.4 | Must meet the Dutch and English naturalness bar in Receptionist §8 and Playbook §9. Dutch quality is the binding constraint, not English. |
| RM-122 | LLM provider account and key | 4.2 through 4.6, and the existing AI Scan | OpenAI named as intended primary in Sales Outbound §57. Still outstanding from Milestone 2. |
| RM-123 | Concurrency capacity provisioning and limits | RM-201, RM-202 | IVR §25 requires ten simultaneous calls as an acceptance test and explicitly states ten is not the ceiling. Real capacity has to be purchased and documented. |
| RM-124 | IO SKY 020 business number provisioning and porting | 4.1 | Receptionist §30, IVR §30. |
| RM-125 | `iosky.co` outbound domain ownership, DNS, SPF, DKIM, DMARC | 4.5 email execution | Sales Outbound §46 states it becomes production authoritative only after ownership and DNS are verified. |
| RM-126 | Calendar provider decision and OAuth application | 4.4 | Scheduling §29 requires external free/busy and two-way sync. |
| RM-127 | SMS provider for scheduling and OTP | 4.4 | Twilio credentials exist and work for SMS today; confirm whether the same account is used. |
| RM-128 | Source connector access for prospecting | 4.5 discovery | Sales Outbound §21 names Indeed, Werken voor Nederland, a Dutch commercial vacancy source, career pages and a freelance source. Each needs real terms and access confirmed. |
| RM-129 | Supabase API key replacement | Recording, voicemail and transcript storage | Carried over from Milestone 3. The current key was revoked after a credential leak and never replaced, so all file storage is non functional. |
| RM-130 | Payment processor decision | RM-171 account creation rule | Scheduling §14 makes verified AI Scan payment the only public self service account creation path. No payment processor is integrated anywhere today. |
| RM-131 | Provider decisions for the GDPR package | Legal counsel deliverable | IO SKY has confirmed legal counsel finalises GDPR documentation once providers are determined. RM-120 through RM-122 and RM-128 are its inputs. |

---

## Contradictions and clarifications to raise now

The covering email asked us to identify contradictions with the current implementation before making
assumptions. These are the ones found on first review. Each needs an answer before the affected task
starts.

### C-1. The AI Scan product model has changed, and the platform still implements the old one

Receptionist §11 states the three commercial AI Scan products are **Operations Scan, Cyber Scan and
Elite Scan**, that they are **paid** products, and that "any legacy Free / Growth / Elite implementation
must not become the commercial truth of the Receptionist." Scheduling §7 names the same three.

The live platform implements the previous model. `drizzle/schema.ts:1920` defines
`pgEnum("ai_scans_tier", ["free", "growth", "elite"])`, and the 35 question bank in
`shared/aiScanQuestionnaire.ts` is mapped to those three tiers at 7, 18 and 35 questions.

This is a migration of the AI Scan product itself, not a configuration change. It affects the tier enum,
the question bank and its per-tier mapping, scoring profiles, pricing, report templates, the free tier
becoming paid, and every existing `ai_scans` row. **Question: is the AI Scan re-model in Milestone 4
scope, and does the awaited AI Scan Engine specification define it?** Nothing in 4.2 or 4.4 that touches
Scan products can be built correctly until this is settled.

### C-2. The scheduling engine is not multi-host, and the specification says that is not a retrofit

Scheduling §30 is explicit: "The scheduling architecture must be multi-host from the initial
implementation. IO SKY expects multiple employees in the near term; the system must not be hardcoded
around one founder, one calendar or one host."

The current booking engine has no host concept at all. `admin_availability`, `availability_windows` and
`booking_slots` are keyed by `consultationType` with no host, user or resource column. Availability is
global per consultation type.

Re-modelling this touches the live booking system that is currently taking real bookings, so it needs a
migration plan rather than a rewrite in place. **Question: confirm that re-modelling the existing
booking engine to be host scoped is accepted as part of this scope.**

### C-3. Full website redesign

We have been told verbally that a redesign of the complete website is included. It is not in any of the
five specifications received, and the Milestone 2 specification was explicit in the opposite direction:
existing portals were to be carried over as they were, described in the tracker as "port without
redesign".

**Question: please confirm the redesign in writing, with its scope.** It is legitimate work and we are
willing to do it, but it is a separate body of work from these five specifications and it needs to be
scoped, sequenced and priced as such rather than assumed inside them.

### C-4. Payment gates account creation, but there is no payment processor

Scheduling §14 makes a backend verified AI Scan payment the only public self service account creation
path. There is no payment integration in the platform. See RM-130. **Question: is payment integration
in this milestone, or does the account creation rule launch with invitation only until it is?**

### C-5. Recording and transcription storage depends on a blocked credential

Receptionist §33, IVR §21 and §22 require recording and persistent transcription as independently
controlled capabilities with governed storage, access and retention. File storage is currently non
functional platform wide because the Supabase key was revoked after a credential leak and never
replaced. See RM-129.

### C-6. Minor document numbering

Scheduling Agent §20 lists its steps as 8 to 14, §49 lists acceptance scenarios as 15 to 51, and §52
lists principles as 52 to 65. The content is clear and we have interpreted it correctly, but a corrected
v1.1 would remove ambiguity when we cite section numbers back in acceptance evidence.

---

## Workstream 4.0 — Shared foundation

Built once, used by all four products. Every specification insists these are shared rather than
duplicated per agent: Sales Outbound §2 and §53, Scheduling §3 and §44, IVR §31.

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-132 | Telephony abstraction layer over the selected provider | ⏭ | Call control, DTMF, transfer, hold, recording state, SIP identity. Provider neutral per Receptionist §50. |
| RM-133 | Speech pipeline abstraction (STT and TTS) | ⏭ | Separable from telephony so a provider change does not touch call logic. |
| RM-134 | Model router with capability based routing | ⏭ | Sales Outbound §57 to §59. Business task to logical capability to configured model. No hardcoded model identifiers in business logic. |
| RM-135 | Structured relay and handoff contract between model tiers | ⏭ | Sales Outbound §60. Named fields, not a transcript dump. |
| RM-136 | Escalation and technical fallback as distinct paths | ⏭ | Sales Outbound §61. A timeout is not evidence that stronger reasoning is needed. |
| RM-137 | Model loop protection with bounded retry | ⏭ | Sales Outbound §62. |
| RM-138 | Model observability and cost governance | ⏭ | Sales Outbound §63. Per campaign and per task cost, budget alerts, abnormal usage. |
| RM-139 | Backend authorisation layer for all agent actions | ⏭ | Receptionist §36, Sales Outbound §3. The model proposes, the backend decides. Read, Create, Modify, Cancel, Transfer, Notify and Escalate independently controlled. |
| RM-140 | Pre action revalidation | ⏭ | Sales Outbound §7. A previously valid decision never overrides newer state. |
| RM-141 | Idempotency framework for consequential actions | ⏭ | Receptionist §39, IVR §29, Scheduling §40, Sales Outbound §77. Retries and webhook redelivery must not duplicate. |
| RM-142 | Prompt injection and social engineering resistance | ⏭ | Receptionist §37, IVR §33. Caller and prospect input is untrusted. |
| RM-143 | Governed knowledge and instruction layer | ⏭ | Receptionist §11 and §12. Versioned, auditable, editable by Super Admin without code changes. |
| RM-144 | Knowledge versioning with actor, timestamp and diff | ⏭ | Receptionist §12. |
| RM-145 | Extend the permission model to agent resources | ⏭ | Role + Permission + Scope + Assignment + Environment + Resource. Already the platform rule; needs extending to the new resources. |
| RM-146 | Granular Technical Operator scopes | ⏭ | Scheduling §37 names Frontend, Backend, Full Stack, UI/UX, Infrastructure, Security, Database, specific portals and specific AI capability. Granting one must not grant the platform. |
| RM-147 | Agent audit infrastructure | ⏭ | Actor, timestamp, resource, previous value, new value, environment. |
| RM-148 | Notification Center extension for agent events | ⏭ | Lifecycle New, Seen, Acknowledged or In Progress, Resolved. Viewing must not resolve. Duplicate suppression. |
| RM-149 | External and mobile notification channel abstraction | ⏭ | IVR §14. Handoff must not depend on a laptop dashboard being open. Minimise sensitive content, deep link to the record. |
| RM-150 | Permission aware global search across agent entities | ⏭ | Scheduling §16, Sales Outbound §55. Individual and combined filters. Searchability never expands authorisation. |
| RM-151 | Configuration lifecycle: Draft, Test, Authorised Publish, Active, Version History, Rollback | ⏭ | IVR §36, Scheduling §35, Sales Outbound §80. Draft changes must not alter the live path. |
| RM-152 | Durable background job processing | ⏭ | Sales Outbound §78. Progress, controlled concurrency, retry, pause and resume, recovery. No browser session dependency. |
| RM-153 | Concurrency and session isolation primitives | ⏭ | IVR §25, Scheduling §41, Sales Outbound §79. No context, verification state, booking action or summary may cross sessions. |
| RM-154 | Professional Dutch and English localisation framework | ⏭ | Scheduling §25. Approved meaning parity, not machine translation. Applies platform wide including website copy. |

## Workstream 4.1 — Telephony and IVR

Authority: IVR & Telephony Functional Specification v1.0.

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-155 | Inbound call entry on the IO SKY business number | ⏭ | IVR §2. |
| RM-156 | AI first routing with no DTMF menu when AI is available | ⏭ | IVR §2 core principle. The menu must never become the default experience. |
| RM-157 | AI availability state machine and IVR activation | ⏭ | IVR §3. Five distinct states including AI failing mid call and AI recovering while a caller is already in IVR. |
| RM-158 | Traditional IVR fallback with language selection | ⏭ | IVR §4. |
| RM-159 | Three option DTMF menu, canonical Dutch and English wording | ⏭ | IVR §5. Wording frozen for launch, implementation must not be hardcoded. |
| RM-160 | Internal route mapping for the three menu options | ⏭ | IVR §6. |
| RM-161 | Invalid input, no input and loop prevention | ⏭ | IVR §8. Second failure moves to a safe fallback, never an infinite loop. |
| RM-162 | Human availability model, separate from business hours | ⏭ | IVR §9. Available, Busy, Unavailable, plus scheduling occupancy. |
| RM-163 | Holiday closures, exceptional hours and after hours destinations | ⏭ | IVR §9. |
| RM-164 | Routing engine: primary, secondary, queue, fallback | ⏭ | IVR §10. Availability aware, priority configurable, category stays attached to the call. |
| RM-165 | Queue capability with limits and fallback | ⏭ | IVR §11. Required even with one operator. Abandoned queue calls distinguishable from failed transfers. |
| RM-166 | Hold audio and waiting experience | ⏭ | IVR §12. Super Admin uploadable. No promotional interruptions. Receiving side audio must never leak before bridge. |
| RM-167 | Compact handoff summary before the operator answers | ⏭ | IVR §13. Factual, concise, never a transcript dump. |
| RM-168 | Transfer announcement and configurable ring window | ⏭ | IVR §15. A short hardcoded timeout that converts transfers to callbacks is explicitly unacceptable. |
| RM-169 | Transfer outcome states, provider confirmed | ⏭ | IVR §16. Attempted, ringing, answered, no answer, busy, rejected, technical failure, cancelled, caller disconnected. |
| RM-170 | Transfer failure recovery without silent disconnect | ⏭ | IVR §16. AI regains control and explains, or the telephony layer offers the fallback. |
| RM-171 | Callback first fallback, voicemail second | ⏭ | IVR §17. |
| RM-172 | Caller ID aware callback flow | ⏭ | IVR §18. Do not make the caller re enter a number we already have. Caller ID is never identity proof. |
| RM-173 | Voicemail with durable record and accurate success state | ⏭ | IVR §19. |
| RM-174 | Business hours and after hours behaviour | ⏭ | IVR §20. |
| RM-175 | Recording as an operational telephony state, OFF by default | ⏭ | IVR §21. Notice behaviour applied before recording begins, not merely a database flag. |
| RM-176 | Persistent transcription independently governed from real time STT | ⏭ | IVR §22. |
| RM-177 | Call record and auditable lifecycle | ⏭ | IVR §24. Must not default to storing a full transcript. |
| RM-178 | Capacity exhaustion handling and alerting | ⏭ | IVR §27. Must not conceal saturation by falsely reporting availability. |
| RM-179 | Provider and service failure matrix, seven distinct paths | ⏭ | IVR §28. Each failure has a required principle and a prohibited outcome. |
| RM-180 | IO SKY business caller identity for outbound | ⏭ | IVR §30. Employee direct numbers must not be exposed. |
| RM-181 | Authorised manual outbound calling | ⏭ | IVR §31. Shared capability only. Automated campaigns belong to 4.5. |
| RM-182 | Super Admin IVR and Telephony Control Center | ⏭ | IVR §35. Fourteen configurable areas listed. |
| RM-183 | Telephony analytics | ⏭ | IVR §40. Twelve metric groups. No fabricated AI quality score. |

## Workstream 4.2 — AI Receptionist

Authority: AI Receptionist Functional Specification v1.0.

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-184 | Conversation session lifecycle with unique Call ID | ⏭ | Receptionist §41. |
| RM-185 | Greeting, AI disclosure and language detection | ⏭ | Receptionist §6 and §7. Dutch and English, switching mid call. |
| RM-186 | Voice persona: adult female professional, configurable | ⏭ | Receptionist §8. |
| RM-187 | Natural conversation behaviour | ⏭ | Receptionist §9. Interruption, pauses, self correction, topic change, background noise, no repeated questions. |
| RM-188 | Consultative reasoning framework, not a questionnaire | ⏭ | Receptionist §10. |
| RM-189 | Hallucination and uncertainty handling | ⏭ | Receptionist §13. Never fabricate to continue. Confidence values never exposed to callers. |
| RM-190 | Prohibited behaviour enforcement, eleven rules | ⏭ | Receptionist §14. Pricing, quotations, liability, guarantees, credentials, verification bypass. |
| RM-191 | Published pricing boundary | ⏭ | Receptionist §15. Governed knowledge only, no invented estimates. |
| RM-192 | Call categorisation, ten categories, extensible | ⏭ | Receptionist §16. |
| RM-193 | Per category behaviour: prospect, client, support, privacy, billing, complaint | ⏭ | Receptionist §17 and §20 to §24. |
| RM-194 | Discovery Call integration through the Scheduling Engine | ⏭ | Receptionist §18. Never invent availability. Depends on 4.4. |
| RM-195 | Booking verification with server side OTP | ⏭ | Receptionist §19. The model never determines that a caller is verified. |
| RM-196 | Human transfer flow with real availability check | ⏭ | Receptionist §25 and §26. Business hours alone are not evidence of availability. |
| RM-197 | Callback behaviour and notification lifecycle | ⏭ | Receptionist §27. No promised interval without a configured commitment. |
| RM-198 | Urgency model: Normal, High, Potential Critical | ⏭ | Receptionist §28. Anger and the word urgent do not raise urgency. Urgency never bypasses verification. |
| RM-199 | Emergency boundary | ⏭ | Receptionist §29. |
| RM-200 | Communication timeline and relationship continuity | ⏭ | Receptionist §31. Recognition is not authentication. Duplicates must not be blindly merged. |
| RM-201 | Structured Call Summary, eighteen fields | ⏭ | Receptionist §32. Distinguishes fact from inference. The durable record, not a transcript. |
| RM-202 | Recording and transcription as separate configurable capabilities | ⏭ | Receptionist §33. Recording OFF by default. |
| RM-203 | Super Admin Receptionist control, twelve configuration areas | ⏭ | Receptionist §34. |
| RM-204 | Tool and integration failure handling | ⏭ | Receptionist §40. Never pretend success. |
| RM-205 | Disconnect handling and concurrent call support | ⏭ | Receptionist §42. An unexpected disconnect is not a successful completion. |
| RM-206 | Graceful degradation to traditional IVR | ⏭ | Receptionist §43. Failure of the AI layer must not make the number unreachable. |
| RM-207 | Abuse and spam handling without blocking legitimate callers | ⏭ | Receptionist §44. |
| RM-208 | Human takeover of a live AI call | ⏭ | Receptionist §45. Clear control state so both do not commit simultaneously. |
| RM-209 | Receptionist analytics, required from V1 | ⏭ | Receptionist §46. Thirteen metrics. No AI performance score without an approved methodology. |
| RM-210 | Auditability of important actions | ⏭ | Receptionist §47. |

## Workstream 4.3 — Conversation and Response Playbook

Authority: AI Receptionist Conversation & Response Playbook v1.0. Jointly authoritative with 4.2 and
cannot grant capability beyond it.

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-211 | Non robotic conversation layer | ⏭ | Playbook §5. Dynamically formulated, never reading a script. |
| RM-212 | Premium language standard per supported language | ⏭ | Playbook §9. Judged from the caller perspective, applies equivalently in every language. |
| RM-213 | Intelligence experienced, not narrated | ⏭ | Playbook §10. No "I can see in the system" phrasing. |
| RM-214 | Three types of understanding failure handled distinctly | ⏭ | Playbook §14. Hearing, meaning and interpretation uncertainty are different. |
| RM-215 | Confirmation discipline | ⏭ | Playbook §15. Do not summarise after every answer. |
| RM-216 | Working hypotheses that remain revisable | ⏭ | Playbook §16. |
| RM-217 | One relevant question at a time | ⏭ | Playbook §18. |
| RM-218 | Scan guidance: Operations, Cyber, Elite | ⏭ | Playbook §20 to §26. Blocked on C-1. Elite must never be an automatic upsell. |
| RM-219 | Discovery Call recommendation, contextual not automatic | ⏭ | Playbook §27 and §28. |
| RM-220 | Booking failure and verification failure dialogue | ⏭ | Playbook §30 to §32. |
| RM-221 | Bespoke pricing and price objection handling | ⏭ | Playbook §33 and §34. |
| RM-222 | Competitor and general question handling | ⏭ | Playbook §35 and §36. |
| RM-223 | Transfer dialogue: preparation, announcement, handoff, failure recovery | ⏭ | Playbook §43 to §47. |
| RM-224 | Callback and out of hours dialogue | ⏭ | Playbook §48 and §49. |
| RM-225 | Conversation management layer and configuration lifecycle | ⏭ | Playbook §57 and §58. |
| RM-226 | No autonomous self rewriting | ⏭ | Playbook §59. |

## Workstream 4.4 — Scheduling Agent

Authority: Scheduling Agent Functional Specification v1.0.

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-227 | One authoritative Scheduling Engine for every channel | ⏭ | Scheduling §3. No channel implements its own booking logic. |
| RM-228 | Atomic booking with zero double booking | ⏭ | Scheduling §4. Server and database enforcement. Frontend conflict checks are insufficient. |
| RM-229 | Temporary holds that expire and are never presented as confirmed | ⏭ | Scheduling §4. |
| RM-230 | Effective availability engine | ⏭ | Scheduling §5. Rules, working hours, host availability, external free/busy, buffers, blocks, exceptions, holidays, resources. |
| RM-231 | Re model the booking schema to be host scoped | ⏭ | Scheduling §30. See C-2. Migration of the live booking system. |
| RM-232 | Multi host architecture from initial implementation | ⏭ | Scheduling §30. Per host availability, calendars, blocks, eligible appointment types. |
| RM-233 | Host selection strategies | ⏭ | Scheduling §30. Specific host, first available, round robin, priority, skill eligibility. |
| RM-234 | Multi participant and multi attendee appointments | ⏭ | Scheduling §30. Joint availability across mandatory resources. |
| RM-235 | Discovery Call launch configuration | ⏭ | Scheduling §6. 30 minute meeting, 30 minute preparation, 0 to 15 minute buffer, 30 day horizon, 2 hour lead time, 24 hour late cancellation. Three separate concepts, three separate values. |
| RM-236 | AI Scan Review Session appointment type | ⏭ | Scheduling §7. Blocked on C-1. Must not give away a paid review. |
| RM-237 | Manual Scheduling Task, launch requirement | ⏭ | Scheduling §8. Super Admin delegates contact and booking for existing and newly encountered prospects. |
| RM-238 | Natural language task instructions | ⏭ | Scheduling §8. |
| RM-239 | Scheduling Task lifecycle and bounded follow up | ⏭ | Scheduling §9. No Answer is never a dead end. No endless autonomous calling loops. |
| RM-240 | Voice, email and SMS as launch scheduling channels | ⏭ | Scheduling §9. Channel switching mid journey where authorised. |
| RM-241 | Natural language scheduling intelligence | ⏭ | Scheduling §11. Understand "next Tuesday afternoon", present two or three real options, search adjacent periods. |
| RM-242 | Boundary on answering outside scheduling expertise | ⏭ | Scheduling §12. |
| RM-243 | Account creation boundary | ⏭ | Scheduling §14. Blocked on C-4 and RM-130. Super Admin never creatable by public registration. |
| RM-244 | Booking confirmation flow with backend confirmed success | ⏭ | Scheduling §15. |
| RM-245 | Unique non predictable booking reference | ⏭ | Scheduling §16. A reference locates, it does not authorise. |
| RM-246 | 360 degree operational lifecycle linkage | ⏭ | Scheduling §17. No disconnected shadow records. |
| RM-247 | Timezone and DST correct handling | ⏭ | Scheduling §18. Never hardcode UTC offsets. |
| RM-248 | Atomic rescheduling | ⏭ | Scheduling §19. Old appointment intact until the new slot is secured. Explicit message when it fails. |
| RM-249 | Telephone OTP verification for sensitive changes | ⏭ | Scheduling §20. Six digits, single use, short lived, rate limited, DTMF preferred so the code is not spoken. |
| RM-250 | Portal verification without redundant OTP | ⏭ | Scheduling §21. |
| RM-251 | Cancellation and late cancellation as distinct states | ⏭ | Scheduling §22. Released slots recalculated against current rules. |
| RM-252 | Appointment lifecycle with business and technical states separated | ⏭ | Scheduling §23. |
| RM-253 | Confirmation and reminder communications | ⏭ | Scheduling §24. 24 hour and 1 hour defaults, idempotent delivery. |
| RM-254 | Preparation time as a real protected block, with briefing trigger | ⏭ | Scheduling §26. Briefing ready before the preparation period begins. |
| RM-255 | Automated post call administration | ⏭ | Scheduling §27. Summary, lifecycle update, extracted actions, follow up state, analytics. |
| RM-256 | Scheduling notifications | ⏭ | Scheduling §28. A reschedule is one lifecycle change, not two active appointments. |
| RM-257 | Calendar sync with IO SKY as source of truth | ⏭ | Scheduling §29. Sync state visible. A provider outage never invalidates the booking. |
| RM-258 | Booking policy, horizon, lead time and waitlist readiness | ⏭ | Scheduling §32. Waitlist may be architecture ready and launch disabled. |
| RM-259 | Duplicate and abuse protection | ⏭ | Scheduling §33. Not a simplistic one appointment per person rule. |
| RM-260 | Super Admin Scheduling Control Center | ⏭ | Scheduling §34. Day, week, month views plus full appointment type configuration. |
| RM-261 | Availability override with warning, confirmation and audit | ⏭ | Scheduling §34. Super Admin still cannot accidentally double book. |
| RM-262 | Nineteen canonical scheduling permissions | ⏭ | Scheduling §36. Separately delegable, never collapsed into one Scheduling Admin permission. |
| RM-263 | Failure handling per step | ⏭ | Scheduling §39. A generic Error state is insufficient. Availability outage must never be reported as no availability. |
| RM-264 | AI Receptionist and IVR integration | ⏭ | Scheduling §42. IVR must not offer a false scheduling path when the agent is down. |
| RM-265 | Discovery Page on the same engine | ⏭ | Scheduling §43. Not a separate Calendly style picker. |
| RM-266 | Scheduling analytics | ⏭ | Scheduling §46. Eleven metric groups including prevented booking conflicts. |

## Workstream 4.5 — AI Sales Outbound

Authority: AI Sales Outbound Functional & Technical Specification v1.0.

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-267 | Core data model as separate first class objects | ⏭ | Sales Outbound §8. Organisation, Person, Signal, Evidence, Opportunity, Campaign, Membership, Interaction, Approval, Human Attention. Never collapsed into one Lead. |
| RM-268 | Organisation identity resolution | ⏭ | Sales Outbound §10. Ambiguous identity routes to review, never blind merge. |
| RM-269 | Signal and Evidence model with provenance and freshness | ⏭ | Sales Outbound §12 and §13. Verified Fact, Evidence, Inference and Unknown never silently collapsed. |
| RM-270 | Opportunity lifecycle | ⏭ | Sales Outbound §15. Materially different business states may not be collapsed. |
| RM-271 | Relationship state and existing client protection | ⏭ | Sales Outbound §16 and §17. Existing clients never enter cold prospecting. |
| RM-272 | Campaign collision protection | ⏭ | Sales Outbound §19. |
| RM-273 | Contact frequency guard independent of model judgment | ⏭ | Sales Outbound §20. |
| RM-274 | Campaign Mandate and authority chain | ⏭ | Sales Outbound §3 and §5. Every action resolves to Automatic, Approval Required or Prohibited. |
| RM-275 | Operating modes: Research Only, Approval, Autonomous | ⏭ | Sales Outbound §4. |
| RM-276 | Campaign lifecycle with Pause, Stop and Kill Switch | ⏭ | Sales Outbound §6. Resume never executes stale queued actions. |
| RM-277 | Source connector architecture, at least ten configurable | ⏭ | Sales Outbound §21. Five useful sources at launch. |
| RM-278 | Source Orchestrator with intelligent selection | ⏭ | Sales Outbound §22. Not a mechanical query of every source. |
| RM-279 | Connector Capability Matrix per production connector | ⏭ | Sales Outbound §23. Eleven capabilities documented per connector. |
| RM-280 | Integration priority ladder | ⏭ | Sales Outbound §24. API first. Never circumvent access controls or misrepresent IO SKY as an applicant. |
| RM-281 | Vacancy and employment type intelligence | ⏭ | Sales Outbound §25 and §26. Permanent and freelance must not get the same template. |
| RM-282 | Manual research by authorised user | ⏭ | Sales Outbound §28. |
| RM-283 | Bulk import, CSV and XLSX, no artificial ceiling | ⏭ | Sales Outbound §29 and §30. Hundreds of records through durable background workflows. |
| RM-284 | Research Brief generation | ⏭ | Sales Outbound §31. Includes Unknowns, Inferences and "Why this message?". |
| RM-285 | Research integrity rules | ⏭ | Sales Outbound §32. Six explicit requirement IDs. Research failure is not disqualification. |
| RM-286 | Qualification engine, not keyword matching | ⏭ | Sales Outbound §33. |
| RM-287 | Multiple configurable ICPs without code changes | ⏭ | Sales Outbound §34. |
| RM-288 | Explainable qualification | ⏭ | Sales Outbound §35. A black box 87 out of 100 is insufficient. Overrides preserve the original assessment. |
| RM-289 | Contact discovery with source and confidence | ⏭ | Sales Outbound §37. Guessed data never presented as verified. |
| RM-290 | Central suppression and Do Not Contact layer | ⏭ | Sales Outbound §38. Rechecked immediately before execution. Learning can never bypass it. |
| RM-291 | IO SKY Sales Communication Profile | ⏭ | Sales Outbound §39. Centrally governed. |
| RM-292 | Personalisation standard with "Why this message?" | ⏭ | Sales Outbound §40. Not first name plus company plus template. |
| RM-293 | Subject line intelligence | ⏭ | Sales Outbound §41. Fake Re:, fake Fwd: and fabricated urgency prohibited. |
| RM-294 | Approval object and lifecycle | ⏭ | Sales Outbound §42. |
| RM-295 | Approval invalidation on material change | ⏭ | Sales Outbound §43. |
| RM-296 | Approval and execution as distinct stages | ⏭ | Sales Outbound §44. |
| RM-297 | Autonomous decision trace | ⏭ | Sales Outbound §45. Operational reasoning summaries and decision metadata. |
| RM-298 | Outbound email infrastructure | ⏭ | Sales Outbound §46. Blocked on RM-125. SPF, DKIM, DMARC, bounce, suppression, unsubscribe, reputation. No domain rotation to evade controls. |
| RM-299 | Sending identity governance | ⏭ | Sales Outbound §47. The AI never invents a sender. |
| RM-300 | Channel execution with Human Action Required fallback | ⏭ | Sales Outbound §48. |
| RM-301 | Follow up engine with configurable cadence | ⏭ | Sales Outbound §49. A genuine reply interrupts the sequence. |
| RM-302 | Reply intelligence, twelve classifications plus next action | ⏭ | Sales Outbound §50. Classification alone is insufficient. |
| RM-303 | Reply authority boundary | ⏭ | Sales Outbound §51. Pricing, contracts, legal and guarantees escalate. |
| RM-304 | Scheduling handoff to the authoritative engine | ⏭ | Sales Outbound §52. No second booking engine. Depends on 4.4. |
| RM-305 | Commercial lifecycle administration | ⏭ | Sales Outbound §54. |
| RM-306 | International and language architecture | ⏭ | Sales Outbound §56. |
| RM-307 | Controlled Learning engine | ⏭ | Sales Outbound §65 to §69. |
| RM-308 | Learning hierarchy and boundaries | ⏭ | Sales Outbound §66 and §67. Learning never rewrites suppression, permissions, mandates or policy. |
| RM-309 | Learning explainability and rollback | ⏭ | Sales Outbound §68. |
| RM-310 | Human Attention queue as a first class operational queue | ⏭ | Sales Outbound §70. |
| RM-311 | Twenty four canonical outbound permissions | ⏭ | Sales Outbound §72. Granularity may not be removed. |
| RM-312 | Compliance policy layer enforced in the backend | ⏭ | Sales Outbound §74. Not reliant on model judgment. |
| RM-313 | Security and data minimisation for models and connectors | ⏭ | Sales Outbound §75. Credentials never in prompts or client code. |
| RM-314 | Truthful failure semantics | ⏭ | Sales Outbound §76. Research failure is not Disqualified. Connector failure is not Sent. |
| RM-315 | Super Admin Sales Outbound Control Center | ⏭ | Sales Outbound §81. Twenty five operational areas. Operational control, not a chat window. |
| RM-316 | Outbound analytics and commercial funnel | ⏭ | Sales Outbound §82. |
| RM-317 | Learning analytics | ⏭ | Sales Outbound §83. |

## Workstream 4.6 — Acceptance, evidence and demonstration

Every specification makes this a delivery obligation rather than a testing afterthought. These are not
optional and they cannot be produced retrospectively.

| ID | Task | Status | Notes |
|---|---|---|---|
| RM-318 | Receptionist acceptance scenarios, 27 listed | ⏭ | Receptionist §52. |
| RM-319 | Receptionist production equivalent end to end demonstration | ⏭ | Receptionist §53. Real inbound call through to audit trail, plus AI unavailable to IVR fallback. |
| RM-320 | Playbook speech and conversational intelligence acceptance tests | ⏭ | Playbook §60 to §70. Representative speech, caller correction, long and short answers, interruption, repetition failure. |
| RM-321 | IVR acceptance test matrix, 37 items | ⏭ | IVR §43. |
| RM-322 | IVR developer implementation evidence, 11 items | ⏭ | IVR §44. Architecture diagram, concurrency limits, isolation evidence, failure demonstrations. |
| RM-323 | Ten simultaneous differentiated call acceptance test | ⏭ | IVR §26. Representative mix of ten different journeys, all isolated. |
| RM-324 | Load and capacity testing above ten | ⏭ | IVR §26. Must scale to 50 or 100 plus without redesigning the session model. |
| RM-325 | Scheduling acceptance scenarios, 37 listed | ⏭ | Scheduling §49. |
| RM-326 | Scheduling developer evidence, 12 items | ⏭ | Scheduling §50. Including atomic conflict prevention evidence. |
| RM-327 | Ten simultaneous differentiated scheduling journeys | ⏭ | Scheduling §41. Including competing requests for the same slot. |
| RM-328 | Sales Outbound requirement traceability matrix | ⏭ | Sales Outbound §84 and Appendix B. Requirement ID, component, environment, evidence, result, known limitation. |
| RM-329 | Sales Outbound end to end acceptance scenario | ⏭ | Sales Outbound §86. Real Signal through to confirmed result and lifecycle update. |
| RM-330 | Source, bulk, commercial context, autonomy, reply, model routing and learning acceptance | ⏭ | Sales Outbound §87 to §93. |
| RM-331 | Negative path acceptance, 12 cases | ⏭ | Sales Outbound §94. |
| RM-332 | Connector Definition of Done per launch connector | ⏭ | Sales Outbound §95. |
| RM-333 | Permission isolation demonstration across all four products | ⏭ | Technical Operator with one scope cannot reach unrelated data. |
| RM-334 | Audit demonstration across all four products | ⏭ | |
| RM-335 | Multilingual meaning parity evidence | ⏭ | Scheduling §50. Dutch and English approved meaning, not machine translation. |

## Workstream 4.7 — AI Scan Engine

⛔ **Specification not yet received.** Announced as following. Intentionally left empty rather than
guessed at, per the covering email's instruction not to reinterpret or assume a requirement while
another specification is still being finalised.

Expected to resolve C-1, since the Receptionist and Scheduling specifications both reference Operations,
Cyber and Elite Scans as paid products while the platform implements free, growth and elite.

---

## Suggested sequencing

Not a schedule, a dependency order. Each stage unlocks the next, and the shared foundation is what makes
the four products buildable rather than four parallel rebuilds of the same groundwork.

1. **Unblock the prerequisites.** RM-120 through RM-131. Nothing substantial starts without the
   telephony, speech and model provider decisions. The two credential items, RM-122 and RM-129, are
   already outstanding from Milestone 3 and are cheap to resolve.
2. **Answer the contradictions.** C-1 through C-4 change what gets built, not just when. C-1 in
   particular affects the Receptionist, the Playbook and the Scheduling Agent simultaneously.
3. **Shared foundation, Workstream 4.0.** Twenty three tasks that all four products depend on.
4. **Telephony and IVR, Workstream 4.1.** The Receptionist cannot be demonstrated without a call path,
   and the IVR is its required fallback.
5. **Scheduling Agent, Workstream 4.4.** The Receptionist needs it for Discovery Calls and Sales
   Outbound needs it for meeting intent. Building it third avoids two products waiting on it later.
6. **AI Receptionist and Playbook, Workstreams 4.2 and 4.3.** Built together, since they are jointly
   authoritative and neither is complete alone.
7. **AI Sales Outbound, Workstream 4.5.** The largest single workstream at 51 tasks, and the one that
   depends on the most finished foundation.
8. **Acceptance and evidence, Workstream 4.6.** Runs alongside from stage 4 onward rather than at the
   end. Concurrency and failure path evidence cannot be produced retrospectively.

---

## Counts

| Workstream | Tasks |
|---|---|
| Prerequisites and blockers | 12 |
| 4.0 Shared foundation | 23 |
| 4.1 Telephony and IVR | 29 |
| 4.2 AI Receptionist | 27 |
| 4.3 Conversation Playbook | 16 |
| 4.4 Scheduling Agent | 40 |
| 4.5 AI Sales Outbound | 51 |
| 4.6 Acceptance and evidence | 18 |
| 4.7 AI Scan Engine | awaiting specification |
| **Total** | **216** |

Nothing in this document is marked complete, because nothing in it has been built. The same
verification bar used in Milestones 1, 2 and 3 applies: no task is marked ✅ without a typecheck, tests
covering the specific behaviour claimed, and where applicable a demonstration against a real running
system.

---

# Appendix A — APIs and credentials required

Every provider below has to satisfy three constraints the specifications impose, not just do the job:

1. **EEA processing.** The application container was moved to Amsterdam and the database is in Ireland.
   A provider that processes call audio, transcripts or prospect data outside the EEA reintroduces the
   transfer problem we just removed, and it becomes an input to the GDPR package legal counsel is
   waiting on.
2. **Provider neutrality.** Receptionist §50 and Sales Outbound §57 and §64 require that no LLM, speech,
   voice or telephony vendor is baked into business logic. Every credential below sits behind an
   abstraction (RM-132, RM-133, RM-134), not scattered through the code.
3. **Configurable, not hardcoded.** Receptionist §49 and IVR §35 require Super Admin to change routine
   operational settings without a code change.

## Already in the project, reuse rather than buy

| Capability | Provider | State |
|---|---|---|
| Database and storage | Supabase | Working, except the API key was revoked after a credential leak and never replaced (RM-129) |
| SMS | Twilio | Working today, used only for MFA codes. The same account extends to voice |
| Transactional email | Resend, with generic SMTP fallback | Working |
| LLM | Slot exists, no key | `OPENAI_API_KEY` alone now activates it |

## Decision 1 — telephony

The single largest decision. It determines the call path, the fallback IVR, queues, transfers, recording
control and the concurrency ceiling.

**Recommended: Twilio.** Reasons specific to these specifications rather than general preference:

- Programmable Voice plus Media Streams gives bidirectional audio over WebSocket, which is what a
  realtime conversational agent needs.
- TwiML gives a genuine traditional IVR for the fallback path. IVR §2 requires a real DTMF menu, not a
  degraded AI. Building that from scratch on a thinner provider is real work.
- TaskRouter covers queues and operator availability, which IVR §11 requires even with one operator.
- Elastic SIP Trunking covers the SIP identity requirement in IVR §30.
- Dutch +31 20 numbers and porting for RM-124.
- An EU region exists for voice processing.
- The account already exists for SMS, so one vendor relationship also covers RM-127.

**Alternatives worth pricing:** Telnyx, which owns its network and is usually cheaper, with EU points of
presence. Vonage. Both are credible. Twilio wins mainly on the IVR and queue primitives being ready made.

**Not recommended for this build:** the managed voice-agent platforms such as Vapi, Retell or Bland.
They would get a demo working faster, and they fight three hard requirements: Super Admin configuring
behaviour without code, provider neutrality, and a separately controlled traditional IVR fallback with
its own queue and routing.

| Credential | Notes |
|---|---|
| `TWILIO_ACCOUNT_SID` | Already set |
| `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET` | Use API keys rather than the master auth token for voice. Revocable per environment |
| `TWILIO_VOICE_APP_SID` | TwiML application for call control |
| `TWILIO_PHONE_NUMBER_SID` | The 020 business number once provisioned |
| `TWILIO_SIP_DOMAIN` | For operator SIP endpoints |
| `TWILIO_WEBHOOK_SIGNING_KEY` | Inbound webhooks must be signature verified. Telephony input is untrusted (IVR §33) |

## Decision 2 — the conversational voice layer

Two viable architectures. This choice decides whether the Receptionist actually sounds natural.

**Option A, speech to speech.** A realtime model handles audio in and audio out directly. Fewer moving
parts, materially lower latency, and native handling of interruption and barge-in, which Receptionist §9
and Playbook §65 explicitly require.

**Option B, composable.** Separate speech to text, language model and text to speech. More control,
easier to swap one piece, more latency engineering. Needed anyway for IVR prompt audio and voicemail
transcription.

**Recommendation: both, behind one abstraction.** Speech to speech for the live Receptionist
conversation, composable components for IVR prompts, voicemail transcription and batch work. RM-133
already exists for this. Provider neutrality then lives at the abstraction boundary, which is what §50
actually asks for.

| Capability | Recommended | Why | Alternatives |
|---|---|---|---|
| Realtime conversation | OpenAI Realtime API | Named intended primary in ASO §57. Handles interruption natively. Dutch supported | Google Gemini Live |
| Text to speech | ElevenLabs | Strongest Dutch naturalness, and a configurable adult female professional voice is the launch requirement (Receptionist §8) | Azure Speech (stronger EEA compliance story), Cartesia (lowest latency) |
| Speech to text | Deepgram | Strong streaming Dutch, low latency | Azure Speech, AssemblyAI |

Dutch quality is the binding constraint, not English. Any shortlist should be judged on a real Dutch
call before the contract, not on a demo reel.

| Credential |
|---|
| `OPENAI_API_KEY` and `OPENAI_REALTIME_MODEL` |
| `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` |
| `DEEPGRAM_API_KEY` |

## Decision 3 — language models and the model router

Sales Outbound §58 names four internal tiers: Luna, Terra, Sol and Astra. Those are IO SKY's names for
capability tiers, not vendor products. The router (RM-134) maps a business task to a tier, and the tier
maps to a configured model. §64 requires that mapping to be central so a model can be replaced without
rewriting workflows.

| Tier | Used for | Map to |
|---|---|---|
| Luna | Extraction, normalisation, classification, tagging | A small fast model |
| Terra | Research synthesis, qualification, standard drafts | A standard model |
| Sol | Difficult research, conflicting evidence, high value accounts | A strong model |
| Astra | Exceptional multi step complexity | A frontier model |

Configure at least one secondary provider. An abstraction with a single provider behind it has not been
tested and will not hold the first time it is needed.

| Credential |
|---|
| `OPENAI_API_KEY` |
| A second provider key, Anthropic or Google, so the abstraction is real |
| `LLM_TIER_MAP` as configuration rather than code |

## Decision 4 — cold outbound email, separate from transactional

**This is the one place where reusing an existing provider would be a mistake.**

Cold outbound and transactional email must not share a domain, and preferably not a provider or sending
IP. Booking confirmations and password resets currently go through Resend on `iosky.nl`. If cold
prospecting runs through the same reputation and recipients mark it as spam, booking confirmations stop
arriving. That is exactly why Sales Outbound §46 specifies a separate `iosky.co` domain.

**Recommended: Amazon SES with a dedicated IP in an EU region**, or a second Resend account on a
separate dedicated domain. SES is cheaper at volume and gives direct control of the sending IP and its
warmup.

**Do not use Postmark for this.** Their terms prohibit cold outreach and the account would be closed.

| Credential |
|---|
| `OUTBOUND_EMAIL_PROVIDER_KEY` |
| `OUTBOUND_DOMAIN` set to `iosky.co`, configurable and never hardcoded (§46) |
| SPF, DKIM and DMARC records on `iosky.co` |
| Bounce and complaint webhook endpoints with signature verification |

Domain warmup takes weeks. Start it early, in parallel with the build, not at launch.

## Decision 5 — calendars

Scheduling §29 requires external free/busy and two way sync. Both providers are needed, since the team
uses Gmail and Outlook.

| Provider | Credential |
|---|---|
| Google Calendar API | OAuth client ID and secret, with a verified consent screen |
| Microsoft Graph | Azure app registration, client ID and secret, admin consent |

Only free/busy is required for availability. §5 says external calendar detail is not needed and §47 says
event titles must never be exposed to callers, so request the narrowest scopes that work.

## Decision 6 — payments

Required by Scheduling §14, where a verified AI Scan payment is the only public self service account
creation path.

**For a Dutch market, Mollie is the stronger default.** iDEAL dominates Dutch payment and Mollie is
native to it. **Stripe** is the alternative if a single global processor matters more, and it supports
iDEAL. The project already has empty Stripe slots, which is convenience rather than a reason.

| Credential |
|---|
| Provider secret key, publishable key and webhook signing secret |

## Decision 7 — push and handoff notifications

IVR §14 is explicit that transfer context must not depend on the operator having a dashboard open.

| Capability | Recommended | Credential |
|---|---|---|
| Mobile push | Firebase Cloud Messaging | Service account JSON |
| Team alert | Slack or Microsoft Teams incoming webhook | Webhook URL. One is already configured for owner alerts |

External notifications must carry minimal content plus a deep link to the authorised record (§14).

## Decision 8 — model observability and cost governance

Sales Outbound §63 requires per task and per campaign token usage, cost, latency, escalation reason,
budget controls and abnormal usage visibility. That is a requirement, not tooling preference, and
building it from scratch duplicates a solved problem.

**Recommended: Langfuse**, which is open source and self hostable, so model traces containing prospect
data stay inside the EEA on infrastructure already running. Helicone is the managed alternative.

| Credential |
|---|
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` |

## Decision 9 — prospecting source connectors

The least certain area, and the one most likely to need the escalation route in §98.

| Source | Reality check |
|---|---|
| Indeed | Public job search API access has been heavily restricted. Assume partner approval is needed and may not be granted. A genuine risk to §21, not a formality |
| Werken voor Nederland | Government vacancy environment. Check for an open data feed before assuming anything else |
| Dutch commercial vacancy source | Terms need reading per site. Several prohibit automated collection |
| Company career pages | §24 prohibits circumventing anti automation safeguards, which limits what is permissible |
| Freelance and contract source | Same terms question |

§23 requires a documented capability matrix per connector and §48 requires a Human Action Required path
where direct execution is unavailable. **Plan for at least two of the five launch sources to be partly
manual.** A connector that cannot legally automate is still a valid connector under the spec, provided
it says so honestly.

## Complete credential checklist

### IO SKY provides

- Twilio voice API key and secret, on the existing account
- IO SKY 020 number, provisioned or ported
- `iosky.co` domain ownership plus DNS access for SPF, DKIM and DMARC
- Replacement Supabase secret key, outstanding since the credential leak
- Payment provider account, Mollie or Stripe
- Google Workspace admin consent for the Calendar OAuth app
- Microsoft tenant admin consent for the Graph app
- Source connector accounts and written confirmation of terms
- A written decision on what each AI provider may do with the data, which is what legal counsel needs

### New accounts to open

- OpenAI, with realtime access and a spend limit
- A second LLM provider, so the abstraction is genuinely exercised
- ElevenLabs, or Azure Speech
- Deepgram, or Azure Speech
- Amazon SES, or a second Resend account for cold outbound
- Firebase, for push
- Langfuse, self hosted or cloud

### Capacity to provision, not merely credentials

IVR §25 requires ten simultaneous calls as an acceptance test and states plainly that ten is not the
ceiling. Concurrency has to be purchased and documented on three services at once: telephony channels,
realtime model sessions, and speech processing. §26 requires each limit documented along with how IO SKY
raises it. Each has its own per account cap and each needs raising before the acceptance test, not
during it.

## One cost note worth raising early

Realtime voice AI bills per minute of conversation across three meters simultaneously: telephony, the
realtime model, and speech synthesis. A caller who talks for eight minutes costs materially more than a
chat message, and the AI Receptionist is specified to be available 24 hours a day.

Sales Outbound §63 already requires budget controls and abnormal usage alerts. Set those before the
first production call rather than after the first invoice, and agree an expected monthly call volume
with IO SKY so capacity and budget are provisioned against a real number.
