
Thank you for the detailed review. Receiving the global correction layer up front is far cheaper than the same corrections arriving page by page, and the review order you propose is the right one.

I have mapped every point in your message against the agreed Three-Milestone Implementation Plan, so we are working from one baseline rather than two. Direct answers to your five closing questions first; then one scope point that needs settling before we sequence the work; then the point-by-point.

---

## A. Direct answers to your five questions

**1. Can we provide the persistent, password-protected staging environment?**
Yes — and I want to be precise about what it is, because it is already in the agreed plan rather than being new work. Milestone 1 §1.3 commits to "isolated dev / staging / production Supabase environments (**not just a password gate**)", and Milestone 3 §3.2 assumes a staging subdomain that production later cuts over from. Your request is the delivery of that agreed item.

Its current status is **partial**, and honestly so: the password gate is built, shipped and test-covered, and the per-environment configuration convention is in place. What is not done is the isolation itself and the hosting, both of which are gated on two client-side decisions that have been open since Milestone 1 — see §C.

**2. What URL will be used?**
`https://staging.iosky.nl`. This is the plan's own model rather than a new proposal: Milestone 1 §1.3 includes staging DNS for `iosky.nl` without cutting over traffic, and Milestone 3 §3.2 is the cutover from that staging subdomain to the production apex. It needs one DNS record on `iosky.nl` pointed at the staging host, once the host is chosen.

If you would rather not touch DNS yet, we will stand up an interim host-provided URL and move it to `staging.iosky.nl` later without downtime, so your review is not held up.

**3. Which staging/test accounts will be provided?**
Five dedicated accounts, one per role implemented under Milestone 1 §1.5 and Milestone 2 §2.5, on an isolated staging database with synthetic data only:

| Role | Reaches | Account |
|---|---|---|
| Client | Client Portal | `client@staging.iosky.nl` |
| Admin | Company/Admin Portal | `admin@staging.iosky.nl` |
| Super Admin | Admin Portal + platform-wide administration | `superadmin@staging.iosky.nl` |
| Developer | Developer Workspace | `developer@staging.iosky.nl` |
| Technical Operator | Operator Console + Security Center | `operator@staging.iosky.nl` |

One practical note. Milestone 1 §1.5 required MFA "enforced uniformly on every login path" with the bypass finding structurally closed, and Milestone 2 §2.5 added MFA enforcement to the Super Admin console. The platform therefore applies a hard, blocking two-factor requirement to the Admin, Super Admin and Technical Operator roles. Your reviewers on those three accounts will be asked to enrol an authenticator app (Google Authenticator, 1Password, Microsoft Authenticator or equivalent) on first login — we will send a short walkthrough with the credentials. Client and Developer are not gated this way.

Credentials will be sent separately from this email. No production credentials and no real client data will be used, per Milestone 1 §1.3's environment-separation requirement.

**4. Are the global design corrections understood?**
Yes — all of them, and we agree with the diagnosis in every case. We have traced each item to the specific place in the codebase that causes it; §1–§15 below give you the actual cause rather than an acknowledgement. Three of them need one input from you before we can build to the approved standard rather than to our own interpretation.

There is one scope question attached to this answer, which is §B.

**5. Can future milestone reporting follow the more detailed verification standard?**
Yes, in full, including the implemented / tested / verified / production-ready distinction. Milestone 3 will use it from the outset, and we will re-issue Milestones 1 and 2 retrospectively in the same format so the three form one consistent record. We will bind "production-ready" to the plan's own Milestone 3 Exit Gate rather than inventing a second definition — see §15.

---

## B. One scope point to settle before we sequence

I want to raise this plainly and early rather than let it surface as a dispute later.

The corrections in your items 2–12 — navigation restructure, global background colour, the typography system, CTA treatment, the glass system, page alignment, orange accents, the Contact form rebuild, the Solutions selector and the global tokenisation pass — are not covered by any of the 18 workstreams in the agreed Three-Milestone Plan. That plan's scope is platform migration, Manus removal, enterprise governance, the notification platform and production readiness. It contains no design or visual workstream, and the Milestone 2 Exit Gate is defined in functional terms only: Manus references gone, no mockup left claiming a capability that is not real, a working Notification Center, and the new enterprise layers live and covered by RLS and audit logging. The new Case Studies page in item 2 is likewise outside it.

To be clear about what this is and is not:

- **It is not a refusal, and not a reason to delay.** We accept the corrections, we agree with them on the merits, and we will start on the enabling work — the design-token layer — immediately, because everything else in items 3 to 12 depends on it.
- **It is a request to book the work properly.** The plan already anticipates exactly this situation: it states that commercial re-baselining of price and timeline follows the scope-reconciliation exercise agreed separately. We would like this design layer named as its own workstream in that reconciliation, so it does not silently consume Milestone 3 — where notification events, deployment, security hardening, the full testing pyramid and go-live all still sit.
- **One question we genuinely need answered:** are you treating the design corrections as a condition of Milestone 2 acceptance, or as a parallel workstream running alongside Milestone 3? Both are workable and we are not arguing for either. But they sequence very differently, and we would rather agree it now than discover the difference at the Milestone 3 gate.

Everything below assumes you want the work done regardless of how it is booked, so none of it is contingent on this answer.

---

## C. What we need from you

These are the genuine gates. The first four are the plan's own client decisions, several carried over unresolved from Milestone 1.

**1. Hosting provider — gates staging, and has since Milestone 1.**
Milestone 1 §1.3 requires the client to select a hosting provider capable of running a long-lived Node process, and the plan lists it first among the client decisions that gate the whole engagement. It is still open. It is the single thing standing between you and a staging URL, and it also still blocks the cookie `SameSite`/`Secure` verification from Milestone 1, which cannot be tested against infrastructure that does not exist.

If you would prefer not to decide now, say so and we will host an interim staging environment ourselves so your review can begin this week; the production hosting decision then stays where it is, open for Milestone 3.

**2. The Supabase environment decision — gates real isolation.**
Milestone 1 §1.3 requires three genuinely isolated environments. Whether staging and production are two separate Supabase projects, or one project with logical separation, is an account-ownership and billing decision on your side, not a code change. We flagged it during Milestone 1 and it has not been resolved. Until it is, we can give you a staging environment, but not one we would honestly describe as isolated to the standard the plan sets.

**3. The Notification specification documents — gate all of Milestone 3 §3.1.**
The plan singles these out as critical, and they remain outstanding. The spec-independent groundwork from Milestone 2 §2.7 is built and waiting: the central write service, the Notification Center UI, the schema extension, the delivery queue and the email bridge. Nothing further can be implemented until the event catalog arrives, and it gates a full workstream of Milestone 3.

**4. Console access for the credential rotation — an unclosed Milestone 1 deliverable.**
Milestone 1 §1.1 required rotating the DB password, JWT secret, Forge API key and AWS STS credentials, with the deliverable stated as "zero live credentials remain valid from the export". Five of those tasks are still blocked because they need TiDB console, Manus dashboard, AWS console and deployment console access that has not been provided. We would like to close them. Please also read the security note near the end of this email, which is directly related.

**5. The approved IO SKY glass specification.**
You have asked, correctly, that the glass spec be treated as source of truth rather than re-created. We do not hold that specification — we have been working from visual reference only, which is precisely how the current state came about. Please send the real values: surface fill and opacity, border colour and opacity, backdrop-blur radius, highlight and shadow definitions, and the contrast target for content on glass. With it, item 6 becomes one tokenised change.

**6. Three navigation decisions and one brand-colour confirmation.** Detailed in §2.

---

## 1. Dedicated staging environment

Confirmed, and framed against the plan rather than as new work.

**Built and tested already.** The platform contains a persistent, password-protected pre-launch gate that behaves as you described: staging URL → password → full access to the complete implementation, with a signed access cookie so the password is entered once rather than on every page. It sets `noindex, nofollow` and serves a `Disallow: /` robots file, so staging cannot be indexed. It has automated test coverage. Authenticated portal sessions pass through it, so a reviewer can hold both the staging password and a role account at once.

**Not done: hosting and isolation.** The plan is explicit that environment separation means genuinely isolated environments, "not just a password gate" — and it is right. The gate is the access control; the isolation is the separate Supabase environment. The first is finished, the second is gated on §C items 1 and 2.

**What isolation will mean in practice.** A separate database with synthetic data only, outbound email captured rather than delivered to real inboxes, payments in test mode, and external integrations pointed at sandbox endpoints. Nothing in staging will be able to reach a real customer, take a real payment, or send a real communication.

**Scope of what you will be able to review.** All of the following is implemented and will be reachable: the complete public website and all page layouts; navigation and dropdown behaviour; desktop, tablet and mobile responsive behaviour; hover, selected and expanded states; language switching across all ten locales the plan references (EN, NL, DE, FR, ES, IT, PT, AR with right-to-left, ZH, JA); forms and their user journeys; Login including password reset and two-factor; the Client Portal; the Company/Admin Portal; the Developer Workspace; and the Technical Operator console with its Security Center. Where an area depends on a third-party credential we do not yet hold, it will be visible but labelled as such rather than silently mocked — the same principle as the Milestone 2 Exit Gate's requirement that no UI element claim a capability that is not real behind it.

**Persistence.** The environment stays up for the remainder of development and acceptance, and becomes the environment Milestone 3 §3.2's CI/CD pipeline deploys to. Every change lands there and is reviewed before it is considered approved for production.

We agree on the principle: screenshots are a delivery artefact, not an acceptance mechanism.

---

## 2. Navbar structure

Understood and accepted. Target structure:

`Foundation | Intelligence | Solutions | AI Scan | Case Studies | About | Contact`

with `Language · Log in · Book Discovery Call` grouped at the far right, visibly separated rather than reading as one segmented control. The current gap between the three is 6px, which is exactly what makes them read as attached. We will introduce a deliberate spacing step and treat them as three distinct controls at three distinct levels of emphasis.

Three decisions before we implement, because the answers change more than the navbar:

- **Case Studies** does not exist — there is no such page or route in the build, and no case-study workstream in the agreed plan. Adding it to the navigation means building the page, its layout and its content model. Please confirm it is intended scope, and whether you will supply the content or want the page built with placeholder entries you fill in later.
- **Enterprise** is currently a top-level item with its own full page and its own six-item dropdown. Your proposed structure drops it. Retire it, fold it into Solutions, or keep it as a page that is simply no longer in the primary navigation? We will keep the URL alive and redirect rather than break existing links, unless you want it removed outright.
- **Foundation** — we read this as a rename of the current Infrastructure section. Please confirm, and we will move `/infrastructure` to `/foundation` with a permanent redirect and rename the label across all ten locales.

**Language selector.** Agreed, and close to correct already — it is a transparent glass control with an off-white border and label. We will raise the border and text contrast, increase internal padding, and remove the orange hover tint so it reads unambiguously as a utility control.

**Log in.** Agreed. It is already outlined-transparent rather than filled and stays that way, with more contrast and clear separation from the CTA so the hierarchy is obvious.

**Book Discovery Call.** Agreed, and we can tell you exactly what causes the yellow/amber appearance you identified. The button is not a flat colour — it is a vertical gradient from `#FFB347` at the top to `#FF7A00` at the bottom, and the `#FFB347` top stop is the amber you are seeing. It becomes a flat `#F58A1F` fill with an off-white label, applied to every primary orange CTA including Send Message.

**One discrepancy worth resolving now.** Our current `#FF7A00` was not an approximation — it was derived by pixel-sampling the official logo file you supplied, which averages to roughly `rgb(251, 121, 2)`. The approved `#F58A1F` is a visibly softer, more amber-leaning colour. We will implement it as instructed and treat it as source of truth. But the logo artwork will then no longer match the brand orange used everywhere else, and the mismatch sits a few centimetres from the CTA in the navbar. Either supply a revised logo asset in `#F58A1F`, or confirm the logo deliberately keeps its own orange. We would rather settle it now than have it returned as a finding on page one of the detailed review.

---

## 3. Global background colour

Accepted without reservation, and unambiguous in the code: the global background token is `#0B1020`, a navy-black. It becomes the approved Warm Deep Teal, `#0D2D2E` / `rgb(13, 45, 46)`.

It is more than a one-line change and we would rather say so. The value is centralised as a token, but `#0B1020` is additionally hardcoded in **53 places**, and the surrounding surface, glass and glow layers are all defined in a navy-blue colour space that will not simply reproject onto teal — a teal base under blue-navy glass looks wrong. The correct fix is to re-derive the whole dark-surface ramp from `#0D2D2E` and drive every surface from it, which is what we will do.

Your instruction that this be implemented consistently rather than page by page with slightly different darks is exactly right, and is the approach in §12.

---

## 4. Typography and body readability

Accepted, and your diagnosis matches the code precisely: body copy sits at 13.5–16px against headlines of 44–60px, rendered in a mid-grey rather than off-white. Under a 60px headline, 15px grey body copy reads as a caption. That is the effect you are describing.

We will rebuild the type scale around a materially larger body size with a proper responsive ramp across desktop, tablet and mobile; move normal body copy to high-contrast off-white and reserve grey strictly for intentionally secondary information; establish one hierarchy across headings, body, labels and supporting text; set line-height and measure for comfortable reading rather than for filling space; and specifically address the desktop case where generous surrounding space makes normal copy look smaller than it is.

Thank you for explicitly not fixing a pixel value per breakpoint. We will propose the scale, apply it, and you judge it on staging.

Scope note: there are currently **933 hardcoded font-size values across 154 component files**. Replacing them with a real scale is the largest single piece of work in this correction round — a systematic refactor, not a quick pass. It is also what makes §12 achievable, and it is a substantial part of what §B asks to have booked properly.

---

## 5. Primary CTA text colour

Accepted, and confirmed as a real defect. The primary-button foreground token is set to the dark navy background colour, so orange CTAs render dark-on-orange. It becomes high-contrast off-white, set once at token level so it cannot drift.

---

## 6. Glass surfaces

Accepted. Your description is accurate: the surfaces are dark navy gradient fills at 50–70% opacity over a dark ground, so there is very little behind them for the blur to reveal and the transparency does no work.

Once we have the approved specification (§C item 5) we will implement it as a single token set — transparency, background separation, backdrop blur, border definition, highlights, depth and interior contrast — across all **78 current glass surfaces**, including the larger interface panels, capability panels and forms. Recreating a visually similar effect independently is what produced the current state, and we will not repeat it. If the specification is genuinely not available, we will propose a candidate system on the `#0D2D2E` base for your approval before applying it site-wide.

---

## 7. Page alignment and content structure

Accepted. Predominantly left-aligned as the editorial default, with variation where it serves the content, and long-form copy left-aligned as a rule. We will bring the pages onto one intentional grid rather than alternating arbitrarily between centred and left-aligned sections. Contact and Solutions are the clearest current offenders and we start there, then hold for your page-specific direction on finer composition.

---

## 8. Orange text accents

Understood — we will not make these decisions independently. Noted as a known item pending your page-by-page direction.

For the record your observation is correct: the Homepage hero headline currently carries no orange emphasis at all. An earlier iteration highlighted one word; the recent homepage restructure removed it. We will leave it until you specify rather than reinstating our own guess.

---

## 9. Existing website visuals

Understood. No further effort on the legacy visuals; treated as temporary layout placeholders only.

We will also take the implementation note seriously — fixed aspect-ratio containers, no layout depending on a specific image's intrinsic dimensions, and asset references centralised, so a replacement is a swap rather than a rebuild.

---

## 10. Contact page and form

Accepted, and measurably so: labels at 12.5px, inputs at 14px in 44px-tall fields, the whole form constrained to a 440px centred column with 24px of padding. It reads as a utility form because it is built as one.

The rebuild gets a substantially larger surface, generous internal padding, larger and taller inputs, more vertical space between fields, a properly sized message area, larger high-contrast labels and body text, the approved glass treatment, and real balance between the content and form sides of the page. Send Message follows the global primary CTA rules from §5.

---

## 11. Solutions ecosystem selector

Understood on all counts. The three cards get greater visual presence, more generous internal spacing, stronger typographic hierarchy and the approved glass treatment.

On the selected state your instinct is right: it is currently a 2px orange ring at 55% opacity plus an orange glow, which is precisely the aggressive border and excessive glow you are asking us to avoid. It becomes a restrained orange tint with a clear but quiet indicator, so the active ecosystem is immediately legible without shouting.

Ecosystem terminology will be aligned to the approved content specification; we will confirm the names with you during the content review rather than assuming the current ones are final.

---

## 12. Global consistency pass

Agreed, and the item we would have raised ourselves. Treating these as isolated screenshot fixes would guarantee they drift apart again.

The current state is **280 hardcoded orange values across 33 files**, **53 hardcoded background values**, **132 hardcoded text-colour values**, **82 hardcoded grey body-text values** and **933 hardcoded font sizes**. The tokens exist; too much of the interface bypasses them. That is the actual root cause behind items 3, 4, 5, 6 and 12 — one problem, not five.

So this is one systematic pass rather than page patches: establish `#0D2D2E` and `#F58A1F` as source-of-truth token values, add proper tokens for the surface ramp, type scale, text colours, spacing, glass, borders and interaction states, then migrate every hardcoded value onto them. Afterwards every one of those values comes from one place.

The platform already runs an automated design-token regression test that fails the build when a design primitive is silently dropped. We will extend it to pin `#0D2D2E` and `#F58A1F` and to fail on new hardcoded colour and font-size literals, so this cannot regress once fixed. That test then runs inside the Milestone 1 CI gate that already blocks every merge, which is what makes the fix durable rather than a one-time cleanup.

---

## 13. Page-by-page review

Understood, and we do not treat your message as complete design feedback. Your review order works well for us.

One suggestion. Let us complete the global correction layer and deploy it to staging **before** the page-by-page review begins. Reviewing pages against the current backgrounds, typography and glass would generate a large volume of findings the global pass resolves anyway; reviewing afterwards means your page-specific feedback is about genuine page-level composition rather than global values you have already corrected once. If you would rather have staging up immediately for visibility, we deploy the current state first and land the corrections onto it as they complete — your call.

---

## 14. Milestone delivery reporting

Accepted in full, and the criticism is fair. "Full automated test suite passed" tells you that code compiled and assertions held; it says nothing about what was actually verified, and it is not evidence of production readiness. That was a reporting failure on our side rather than a testing failure — but the distinction was only visible to us, which is exactly the problem.

From Milestone 3 onward, every report will include, per module: the exact feature delivered; implementation status; what changed against the previous version; affected system areas; database, schema and migration changes; security and permission changes; integrations involved; the test cases or categories actually performed; expected result; actual result; bugs found during testing; how each was resolved; confirmation of retesting after fixes; known limitations; remaining dependencies; items awaiting IO SKY input or credentials; items deliberately deferred; production-readiness status per area; and supporting evidence.

We will also produce the retrospective Milestone 1 summary you asked for, and re-issue Milestone 2 in the same format at the same time. As a preview of what that Milestone 1 record shows: of 63 tracked tasks, 44 are complete and live-verified, 5 are partial, 5 were deliberately deferred with reasons recorded, and **9 are blocked on client-side access or decisions** — the GitHub organisation confirmation, the five credential rotations, branch protection on `main`, CI run verification, and the cookie security configuration that depends on the undecided hosting. That is the level of detail you are asking for, and it is the level we should have been reporting at from the start.

---

## 15. Delivered vs verified vs production-ready

Accepted and adopted as our reporting vocabulary:

- **Implemented** — the development work exists.
- **Tested** — the specified tests have actually been run.
- **Verified** — expected behaviour confirmed against the relevant environment.
- **Production-ready** — the complete real-world flow and every dependency are ready for actual customers and production operation.

For the fourth state we will use the plan's own Milestone 3 Exit Gate as the definition, rather than introducing a competing one: every audited security finding resolved; no Manus references outside historical documentation; CI green and enforced on every merge; RLS verified on every tenant-scoped table; MFA unbypassable on every login path; the Notification Event Catalog implemented and matching its specification; `iosky.nl` serving production traffic on client-owned infrastructure with valid SSL; and 48 hours of post-launch stability before the legacy TiDB/Manus infrastructure is decommissioned. One definition, already agreed by both sides.

Anything waiting on credentials, third-party configuration, live verification or another dependency will be stated as such explicitly, and no flow will be described as production-ready while any part of it is outstanding. Where a dependency sits on your side we will name it rather than leaving it as a generic blocker — as in §C above.

---

## A related security matter you should know about

This belongs with §C item 4 and should not wait for a milestone report.

An environment file containing live Supabase credentials was committed to the repository by our team, contrary to our own convention and contrary to the Milestone 1 §1.1 requirement that zero live credentials remain valid. It sits in the repository history now. We are treating this as a defect on our side, not a footnote.

What we propose, immediately and at our cost: rotate the affected Supabase keys and database password, purge the file from the repository history, add automated secret scanning to the existing CI gate so a commit like this fails rather than merges, and confirm the result with a clean scan of both the repository and the built artifact — which is the Milestone 3 §3.2 secrets-management deliverable, pulled forward.

This also raises the priority of §C item 4: the five Milestone 1 credential rotations still blocked on TiDB, Manus, AWS and deployment console access. We would like that access so the whole set can be closed together rather than piecemeal.

---

## Proposed sequence

1. You confirm the hosting decision, or ask us to host the interim environment, and answer the §C items.
2. We rotate the exposed credentials and clean the repository history, and close the remaining Milestone 1 rotations if console access arrives with it.
3. We stand up staging — the password gate, the isolated Supabase environment and the five role accounts — and send you the URL, password and credentials separately.
4. We complete the global correction layer: token system, `#0D2D2E` base, `#F58A1F` orange, CTA text, type scale, glass, alignment, navbar and Contact form, deployed to staging.
5. We deliver the retrospective Milestone 1 and Milestone 2 reports in the new format.
6. You begin the page-by-page review on staging in your order, and we work through the pages with you sequentially.

Steps 1 to 3 and step 5 sit inside the agreed plan. Step 4 is the design layer discussed in §B, and we will give you an effort estimate for it once the glass specification arrives — it is the one item whose size depends on material we do not yet hold.

We would also like to keep Milestone 3's own gate in view while this runs: the Notification specification documents remain outstanding and block an entire workstream, independently of everything discussed here.

Thank you again for the clarity of this feedback. Setting the global layer before the page-by-page review is the right call and will save both sides a considerable amount of rework.
