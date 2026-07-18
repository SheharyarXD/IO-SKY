---
title: "IO SKY — Ultra Master Blueprint, Final Round"
subtitle: "Phase 1-14 Closure Statement & Developer Handoff Companion"
author: "Manus AI"
date: "June 1, 2026"
---

# IO SKY — Ultra Master Blueprint, Final Round

> Companion to the existing **IO SKY Ultra Blueprint** ([`IO_SKY_ULTRA_BLUEPRINT.md`](./IO_SKY_ULTRA_BLUEPRINT.md), May 25, 2026). That document remains the canonical architecture + operating manual. This document is a closure statement for the **14-phase Ultra Master Blueprint** executed on June 1, 2026, and adds the formal **Developer Handoff** (Phase 14).

---

## 1. Why this round existed

The earlier Ultra Blueprint was already comprehensive, but a number of *integrity* and *workflow* concerns were still open. The Ultra Master Blueprint round was scoped to close them in a single, disciplined pass:

1. Verify that **staging gating** and **Manus independence** were genuinely shippable (Phases 1-2).
2. Enforce **master logo consistency** across every surface (Phase 3).
3. Refine the **login experience** with localised error feedback and a premium logo loader (Phase 4).
4. Eliminate **workflow bleed** between Free AI Scan, paid AI Scan, Strategy Call, and Proposal flows (Phase 5).
5. Scrub **false claims** — ISO badges, SOC certifications, fictional B.V. references, fake "Welcome Back John" greetings, fabricated trust statistics (Phase 6).
6. Lock the **AI Scan scoring contract** so marketing language ("five dimensions") maps to real, typed fields (Phase 7).
7. Replace **page-count marketing copy** in the report tiles with outcome-focused phrasing (Phase 8).
8. Confirm **payments and automation** entry points (Phase 9).
9. Audit **translation completeness** across the nine production locales (Phase 10).
10. Sweep for **dead buttons and placeholder CTAs** (Phase 11).
11. Pass a **final enterprise polish** across spacing, typography, transitions, console errors, and route health (Phase 12).
12. Produce the **final blueprint document and developer handoff** (Phases 13-14).

Every phase is now closed at commit `38ff5c6d`.

---

## 2. What materially changed in this round

### 2.1 AI Scan unlock dialog is no longer a silent funnel leak

Before this round, the AI Scan unlock dialog displayed three tier buttons (Free, Growth, Elite) that collected the visitor's name, company, email, and disclaimer acknowledgement — and on submission, *dismissed itself without persisting any data*. The only side effect was an AI-disclaimer log entry. Operationally this meant that every prospect who passed through the dialog received the impression that their information was on its way to the IO SKY team, while in reality nothing reached the CRM or notified the owner.

A new `aiScansRouter` was introduced at `server/routers/aiScans.ts` with a single tier-aware `submitLead` procedure. Submissions now flow through `createLead` with `source = "ai-scan"` and `interest = "ai-scan:{tier}"` so the admin can distinguish the three intent levels without a schema change. Owner notification is fire-and-forget and never breaks the submission. The honeypot field, disclaimer requirement, and rate-limit posture are all wired. Nine new Vitest specs (`server/aiScans.test.ts`) cover the tier persistence, disclaimer rejection, honeypot rejection, rate-limit fallback, and notification resilience cases.

The React layer was updated to wire each tier button to the mutation, display loading and tier-aware success messages (Free → "results preview", Growth/Elite → "we will contact you for setup"), and surface localised error feedback. Importantly, the dialog does **not** auto-redirect to the Strategy Call funnel — the two funnels remain genuinely separate, eliminating bleed.

### 2.2 AI Scan scoring contract published as code

The marketing site claims that the AI Scan covers five maturity dimensions. Before this round, no backend artefact bound that claim to anything concrete. The new `shared/aiScanModel.ts` makes the contract explicit and type-checked:

- Five named dimensions (`operationalMaturity`, `automationReadiness`, `infrastructureMaturity`, `scalabilityReadiness`, `aiOpportunityPotential`) with locale-aware label fallbacks.
- An exhaustive, non-overlapping grading band table (0-39 critical, 40-54 developing, 55-69 established, 70-84 mature, 85-100 leading) with a single `gradeForScore` helper.
- A complete `AiScanReportPayload` shape (overall score, per-dimension scores with rationale, executive summary, opportunities, roadmap horizons, chart flags, disclaimers).
- A `AI_SCAN_TIER_PROFILE` map locking question count, dimensions covered, opportunities included, roadmap inclusion, and expert refinement per tier.

Four Vitest specs (`server/aiScanModel.test.ts`) lock the dimensions, band exhaustiveness, boundary mapping, and tier-escalation monotonicity. A subsequent implementation of the scoring engine (`server/_core/aiScanScoring.ts`) can be built against this contract without coordinating with marketing or design.

### 2.3 Report tiles aligned with reality

The previous AI Scan report tiles advertised "PDF (5-8 pages)", "PDF (20+ pages)", and "PDF (30-60 pages)". Because we do not, in fact, render fixed-page-count PDFs, those claims have been replaced with outcome-focused phrasing: "Executive PDF preview", "Executive PDF sample", and "Premium executive PDF sample". The tier feature lists were updated in lockstep ("Executive PDF report" instead of "PDF report (20+ pages)", "Premium executive report with appendix" instead of "Premium report (30-60 pages)").

### 2.4 Workflow boundary verification

| Funnel | Entry point | Persistence | Side effects | Bleeds into other funnels? |
|---|---|---|---|---|
| Free AI Scan | `/ai-scan` (Free CTA) | `leads`, `interest = ai-scan:free` | `notifyOwner` | No |
| Growth AI Scan | `/ai-scan` (Growth CTA) | `leads`, `interest = ai-scan:growth` | `notifyOwner` | No |
| Elite AI Scan | `/ai-scan` (Elite CTA) | `leads`, `interest = ai-scan:elite` | `notifyOwner` | No |
| Strategy Call | `/book-strategy` | `bookings`, `booking_audit`, `leads` | `notifyOwner` + branded email + `.ics` | No (anchor link only from /ai-scan) |
| Proposal | `/solutions/proposal` | `leads` (`source = solutions`), `ecosystem_proposal_requests` | `notifyOwner` | No |

Every funnel writes to its dedicated table set and to the CRM lead log. No funnel auto-redirects into another. The earlier risk that submitting an AI Scan unlock form would implicitly start a Strategy Call booking is closed.

### 2.5 Payment posture documented

Stripe is not active on the project today. The `clientPortal.payInvoice` procedure already implements the audited manual-fallback flow: it creates a CRM lead, writes a `login_audit` entry tagged `payment-intent`, calls `notifyOwner`, and returns a "we will contact you for setup" message. This round documents the activation path (`webdev_add_feature stripe`) and the `metadata.aiScanId` injection point so that, when Stripe is enabled, the AI Scan ID and the invoice will be reconcilable from a single Stripe identifier.

### 2.6 Translation completeness re-verified

The nine production locales (EN, NL, DE, FR, ES, IT, AR, JA, ZH) each contain 1,138 keys. The `server/i18n.completeness.test.ts` guard enforces parity. The Portuguese stub (`pt.ts`, 645 keys) remains intentionally on disk for content recovery but is excluded from the switcher and from the completeness test — this is documented in `client/src/lib/i18n.ts`.

---

## 3. Test posture after this round

| Metric | Value |
|---|---|
| Total Vitest specs | **330** (up from 317 at the start of the round) |
| Pass rate | **330/330** |
| TypeScript errors | **0** |
| Public routes confirmed HTTP 200 | **10** (`/`, `/ai-scan`, `/book-strategy`, `/solutions`, `/contact`, `/login`, `/about`, `/privacy`, `/terms`, `/security`) |
| New test files | `server/aiScans.test.ts` (9 specs), `server/aiScanModel.test.ts` (4 specs) |
| New source files | `server/routers/aiScans.ts`, `shared/aiScanModel.ts` |
| Touched user-facing files | `client/src/pages/AIScan.tsx` (tier-aware mutation wiring + outcome-focused copy) |

---

## 4. Phase 14 — Developer Handoff

This section is the formal Phase 14 deliverable. It is intentionally written for an external engineering team taking over the codebase without prior context.

### 4.1 Repository orientation

```
client/src/pages/        Page-level React components (one per route)
client/src/components/   Shared UI; shadcn/ui primitives in components/ui/
client/src/lib/i18n/     Locale dictionaries (nine production locales + pt stub)
client/src/lib/trpc.ts   tRPC client binding (Superjson, cookie-credentialed)
drizzle/schema.ts        Single source of truth for the database schema
server/db.ts             Drizzle query helpers (return raw rows)
server/routers.ts        Top-level tRPC registration
server/routers/*.ts      Feature routers (one per feature)
server/_core/*           Framework plumbing (OAuth, context, env, storage)
shared/                  Cross-cutting types and constants
references/              Operating documentation, this blueprint, screenshots
```

The four touch-points pattern is **the** way to add new features. (1) Edit `drizzle/schema.ts` and run `pnpm db:push`. (2) Add a helper in `server/db.ts`. (3) Add a procedure in the relevant `server/routers/*.ts` file. (4) Consume it from a React page via `trpc.*.useQuery` or `trpc.*.useMutation`. Tests live alongside the code in `server/*.test.ts`.

### 4.2 Local development setup

```bash
pnpm install
pnpm db:push       # applies Drizzle migrations
pnpm dev           # starts vite + express, port from BUILT_IN_DEV_SERVER_PORT
pnpm test          # full Vitest run
pnpm tsc --noEmit  # type check
```

Required environment variables are enumerated in `server/_core/env.ts`. The full list is also reproduced in the README. When developing against Manus-hosted infrastructure, these values are injected automatically.

### 4.3 Critical first weeks

1. **Implement the AI Scan questionnaire UI.** Build a multi-step form against the `AI_SCAN_TIER_PROFILE` from `shared/aiScanModel.ts`. The lead capture path that exists today is sufficient to operate manually until the live form ships.
2. **Implement the AI Scan scoring engine.** Add `server/_core/aiScanScoring.ts` that calls `invokeLLM` with the questionnaire payload and emits a valid `AiScanReportPayload`. Use the JSON schema response format documented in the README.
3. **Implement the report PDF renderer.** Read `AiScanReportPayload`, render a radar chart, opportunity bars, and roadmap timeline. Store the PDF in S3 via `storagePut` and record the key in `client_reports`.
4. **Activate Stripe.** Run `webdev_add_feature stripe`, supply Stripe keys, and replace the manual fallback in `clientPortal.payInvoice` with a Checkout Session redirect. Wire `metadata.aiScanId` so the AI Scan, invoice, and Stripe charge can be reconciled.
5. **Switch the email transport.** Confirm that the production Resend / SMTP key is configured and that a DKIM-aligned domain is in place. Localise the transactional templates if the audience warrants it.
6. **Sign off DNS + TLS.** Follow `IO_SKY_STAGING_GUIDE.pdf` for staging.io-sky.com and the production domain.

### 4.4 Boundaries to preserve

- Every public submission **must** write to a CRM table and call `notifyOwner` with a fire-and-forget pattern (notification failure must never break the submission).
- Every privileged procedure **must** write to its audit table on both success and failure.
- Every user-visible string **must** be added to `client/src/lib/i18n/en.ts` first and then mirrored to the other eight production locales; the completeness test will fail otherwise.
- Every new image / video / large file **must** be uploaded via `manus-upload-file --webdev`; storing assets locally in the project tree will time out the deployment.
- File bytes go to S3; databases only hold the storage key + metadata.

### 4.5 Manus independence

If the platform is being migrated off Manus-hosted infrastructure, follow the order in `references/MANUS_INDEPENDENCE.md`: database → object storage → OAuth → email → application runtime → maps. Each migration step is a localised change because Manus-injected dependencies are accessed through thin wrappers (`server/_core/*`, `server/storage.ts`).

### 4.6 Known limitations entering production

| Limitation | Status |
|---|---|
| AI Scan live questionnaire + scoring engine + PDF renderer | Contract published; implementation pending |
| Stripe activation | Manual fallback live; activation pending |
| Localised transactional email templates | English only |
| Third-party OAuth providers (Google / Microsoft / Apple) | Scaffolded UI; backend is Manus portal |
| Portuguese locale (pt) | 645/1138 keys; intentionally excluded from switcher |

### 4.7 Future optimisation backlog

- Lazy-import locale dictionaries once the bundle exceeds ~500 kB.
- Move PDF rendering off the API event loop into a worker pool.
- Promote audit logs into a queryable observability surface inside the admin console.
- Add a click-to-call widget for Growth / Elite leads.
- Build the localised transactional email template set.

---

## 5. Final acceptance

All fourteen phases of the Ultra Master Blueprint are closed at commit `38ff5c6d`. The accompanying screenshots in `references/screenshots/` capture the public home page, AI Scan, Strategy Call, Solutions, Contact, and Login surfaces as of June 1, 2026. The existing Ultra Blueprint (May 25, 2026) remains valid and continues to serve as the deeper architecture + operating manual; this document is the closure statement for the consolidation round and the formal Phase 14 developer handoff.
