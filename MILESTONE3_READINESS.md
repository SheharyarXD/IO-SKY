# Milestone 3 — Readiness Checklist

Status: **Not started — waiting on scope + client inputs below.** No `Milestone 3.md` (or
equivalent scope document) exists in this repo yet. This file is a handoff/kickoff doc, same
convention as `MILESTONE2_PROGRESS.md` and `PHASE1_CHECKLIST.md` — when a future session is asked
to start Milestone 3, read this file first for full context before doing anything else.

---

## 1. What's needed from the client before development can start

| # | Item | Why it's needed | Blocks |
|---|---|---|---|
| 1 | **Milestone 3 scope document** | No spec, brief, or requirements doc for Milestone 3 exists anywhere in this repo. Without it, "starting Milestone 3" has nothing concrete to build against. | Everything |
| 2 | **Stripe account + API keys** | Billing/checkout code paths exist but have never been wired to a real payment provider. | Any billing/payment feature |
| 3 | **Twilio account + credentials** | Only needed if Milestone 3 scope includes SMS or voice/IVR features. | SMS/voice features |
| 4 | **SendGrid (or equivalent) account + verified sending domain** | Current email sends work via Resend/SMTP/console fallback; a production domain with SPF/DKIM is still not configured. | Production-grade transactional email at scale |
| 5 | **LLM provider account (OpenAI, Azure OpenAI, or compatible) + API key** | The AI Scan engine's `LLM_API_URL`/`LLM_API_KEY` are unset — code is provider-neutral and ready, just missing a real key. | AI Scan scoring, any new AI feature |
| 6 | **Decision: professional translation review — yes/no** | All 10 locale files are currently AI-translated, not reviewed by a native speaker. Confirm whether this needs a review pass before Milestone 3 ships anything language-facing. | Nothing blocking, but should be scheduled |
| 7 | **Any new design/copy documents for Milestone 3-scoped pages** | If Milestone 3 touches more pages/flows, the same kind of design-spec document used for the Homepage/Foundation/Intelligence/Solutions/Contact restructure will be needed for those. | Any new UI work |

---

## 2. Carried over from Milestone 2 — candidates to fold into Milestone 3

These were deliberately deferred, not forgotten. Confirm with the client whether each belongs in
Milestone 3 or stays parked:

- [ ] **"Invite user" self-service flow** — needs a real invite/signup path wired into the shared
      Supabase Auth provisioning route; deliberately held back until it can be verified against a
      live browser session (touches how *every* account signs in platform-wide).
- [ ] **Real third-party integrations** — Stripe, Twilio, SendGrid, production Resend, LLM
      provider — all code-ready, blocked purely on credentials (see table above).
- [ ] **Security Monitoring "Run scan"** — no real security-scanning system exists to invoke yet;
      needs a decision on whether to build one or leave this page `sampleData`-disclosed.
- [ ] **Campaigns "New campaign" / AI Agents & IVR "New agent"** — both need a real provider
      (Twilio/SendGrid-class) behind them before these can be anything but disclosed placeholders.
- [ ] **Discovery Call page (`BookStrategy.tsx`) and Login Portal** — reviewed against the new
      design language this milestone and left as-is (no conflicts found). Revisit only if the
      Milestone 3 scope explicitly calls for changes here.
- [ ] **Professional translation review pass** — see item 6 above.
- [ ] **Milestone 2 exit-gate sign-off** — `Milestone 2.md`'s own criteria have never been checked
      against this repo because that file has never been present here. Worth closing out formally
      before Milestone 3 work begins, if the client can supply it.

---

## 3. Once scope arrives — what happens next

When the Milestone 3 scope document (or equivalent instruction) is provided:

1. Read it in full against this checklist — confirm which "carried over" items above are in scope.
2. Cross-check which of the client-input items in §1 are actually required for the *specific*
   features in scope (e.g. no need to chase Twilio credentials if Milestone 3 has no SMS/voice
   work).
3. Break the scope into workstreams the same way `MILESTONE2_PROGRESS.md` did (§2.1, §2.2, etc.),
   sequenced by dependency order.
4. Start a `MILESTONE3_PROGRESS.md` tracking doc, same convention as Milestone 1 and 2's.
5. Proceed workstream by workstream — commit and push incrementally, one logical change per
   commit, under the client's own git identity, verifying with `tsc`/`vitest`/`build` at each step.

**In short: the trigger prompt only needs to say "start Milestone 3" (or paste the scope doc) —
this file has everything else needed to pick it up without re-asking the client the same
questions twice.**
