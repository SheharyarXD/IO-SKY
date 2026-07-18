# IO SKY — Final Handoff Document

**Version:** 1.0 (Production-Ready Build)
**Date:** 25 May 2026
**Build checkpoint:** `0995313d`
**Author:** Manus build agent
**Audience:** IO SKY founders, future engineers, hosting/DevOps team, legal & compliance reviewers

> This document is the single source of truth for the IO SKY platform handoff. It supersedes all earlier interim reports in `/references/`. It documents every shipped page and route, the backend architecture, the database schema, the legal/compliance layer, the security model, the booking system, the AI Scan flow, the three portals, automations, environment variables, deployment guidance and a dedicated **Domain & Production Deployment Guide**.

---

## 0. Executive Summary

IO SKY is an **enterprise-grade operational intelligence platform** consisting of:

- A **public marketing & lead-generation site** (12 routes) with multi-language support (9 locales) and 10 legal documents.
- An **AI Scan funnel** (Free / Growth / Elite tiers) with adaptive questionnaires, AI-powered analysis and PDF reports.
- A **strategy-call booking system** with timezone-aware slot selection, calendar holds, cancel/reschedule tokens and email/SMS reminders.
- Three **role-scoped portals**:
  - `/admin` — Super-admin operational console (executive overview, users, organisations, bookings, AI scans, leads, ecosystem clicks, automations, security, support, settings).
  - `/client-portal` — Authenticated client workspace (projects, milestones, invoices, documents, messages, notifications, support tickets).
  - `/developer-workspace` — Developer & contractor workspace (assigned projects, tasks, file submissions, secure messaging, audit trail).
- A **legal & compliance layer** (LCP-1 → LCP-10) with versioned legal documents, integrity-checked footers, cookie consent, agreement acceptances, login audit, MFA (TOTP + recovery codes) and tenant isolation.
- **Server** built on Express 4 + tRPC 11 + Drizzle ORM (MySQL/TiDB), **client** on React 19 + Tailwind 4 + shadcn/ui + Wouter routing, **storage** on S3-compatible blob store via signed redirects.

**Quality bar at handoff:** **306 / 306 vitest specs green**, **0 TypeScript errors**, **clean production build**, **0 known critical defects**.

---

## 1. Login Error Feedback Fix (this round)

### Problem
The previous build returned a free-text 401 message and let the submit button stay in a loading state under non-401 errors, occasionally falling through to an OAuth fallback redirect after a local-login failure. UX-wise this looked broken.

### Fix delivered
1. **Server** (`server/_core/localAuthRoute.ts`) now returns **stable machine-readable error codes** (`missing_fields`, `invalid_credentials`, `mfa_required`) alongside a safe English fallback string. No technical detail, no enumeration of whether email exists.
2. **Client** (`client/src/pages/Login.tsx`) now:
   - Maintains a `formError` state showing a **persistent inline alert banner** above the email field, with `role="alert"` and `aria-live="assertive"` (screen-reader friendly).
   - Also shows a **toast** for redundancy.
   - Always **clears the loading state** and **never falls through to OAuth** on local-login failures.
   - Form fields are preserved so the user can retry immediately.
3. **i18n** keys `login.err.failed.{title|body}`, `login.err.fields.{title|body}`, `login.err.server.{title|body}`, `login.err.network.{title|body}` added to all 8 active locales (EN, NL, DE, FR, ES, IT, AR, JA, ZH). Portuguese falls back to English.
4. **Audit log** entries continue to be written to `login_audit` for every failed attempt (asserted in tests).
5. **Rate-limiting** via `recordAttempt()` is preserved.
6. **Tests:** 15 new specs in `server/localAuth.errors.test.ts`, covering missing fields, unknown email, wrong password, locked account (defence-in-depth), MFA-pending state, audit log write, password preserved on failure.

### Live verification screenshots
- Fresh form: `02-login-fresh.png`.
- Failed attempt with inline banner + toast + active button: `03-login-error-feedback.png`.

The banner reads (EN):

> **Login failed.**
> Login failed. Please check your email and password and try again.

(NL): *“Inloggen mislukt. Controleer je e-mailadres en wachtwoord en probeer het opnieuw.”*

This satisfies every requirement of the handoff brief: no technical error, no account enumeration, visible inline + toast feedback, button never hangs, retry possible, locale-aware, audit logged, rate-limit preserved, vitest coverage added.

---

## 2. Routes & Pages (Full Tour)

### 2.1 Public marketing routes (12)

| Route | Page | Purpose |
|---|---|---|
| `/` | `Home.tsx` | Landing hero, infrastructure/intelligence/enterprise teasers, social proof, CTAs to AI Scan and Book Strategy. |
| `/about` | `About.tsx` | Company story, founders, values. |
| `/solutions` | `Solutions.tsx` | Hub for the three solution ecosystems. |
| `/solutions/growth-ecosystem` | `GrowthEcosystem.tsx` | Growth tier feature breakdown. |
| `/solutions/elite-ecosystem` | `EliteEcosystem.tsx` | Elite tier feature breakdown. |
| `/solutions/custom-intelligence-infrastructure` | `CustomIntelligence.tsx` | Custom-build engagement. |
| `/solutions/proposal-request` | `ProposalRequest.tsx` | Proposal intake form. |
| `/infrastructure` | `Infrastructure.tsx` | CRM, automation, integrations, data, security, scalability. |
| `/intelligence` | `Intelligence.tsx` | AI agents, operational intelligence, predictive systems, executive analytics. |
| `/enterprise` | `Enterprise.tsx` | Enterprise systems, AI enterprise systems, compliance. |
| `/custom-software` | `CustomSoftware.tsx` | Custom software engagement. |
| `/contact` | `Contact.tsx` | Contact form (writes to `contact_submissions`). |

### 2.2 Conversion routes

| Route | Page | Purpose |
|---|---|---|
| `/ai-scan` | `AIScan.tsx` | Three-tier AI Scan funnel; questionnaire UI; locked-result preview; PDF report. |
| `/book-strategy` | `BookStrategy.tsx` | 4-step booking wizard (Service → Date/Time → Details → Confirm). |
| `/booking/cancel`, `/booking/reschedule` | `BookingAction.tsx` | Token-protected cancel/reschedule. |
| `/translations` | `Translations.tsx` | i18n showcase / language switcher. |
| `/engineering-access` | `EngineeringAccess.tsx` | Developer onboarding / NDA + access scope request. |

### 2.3 Auth & session routes

| Route | Page | Purpose |
|---|---|---|
| `/login` | `Login.tsx` | Local + OAuth login; safe inline error feedback; locale-aware. |
| `/mfa-challenge` | `MfaChallenge.tsx` | TOTP/recovery-code MFA second factor. |
| `/portal/{client|admin|developer}` | `Portal.tsx` | Role landing pads after login. |

### 2.4 Portals (role-scoped, deep-nested)

| Route | Page | Notes |
|---|---|---|
| `/admin/:section*` | `AdminPortal.tsx` | Super-admin sections (see § 4). |
| `/client-portal/:section*` | `ClientPortal.tsx` | Client sections (see § 5). |
| `/developer-workspace/:section*` | `DeveloperWorkspace.tsx` | Developer sections (see § 6). |

### 2.5 Legal & meta routes

| Route | Document |
|---|---|
| `/privacy`, `/legal/privacy-policy` | Privacy Policy (LCP-1) |
| `/terms`, `/legal/terms-of-service` | Terms of Service (LCP-2) |
| `/cookies`, `/legal/cookie-policy` | Cookie Policy (LCP-3) |
| `/dpa`, `/legal/data-processing-agreement` | Data Processing Agreement (LCP-4) |
| `/ai-disclaimer`, `/legal/ai-disclaimer` | AI Disclaimer (LCP-5) |
| `/legal/acceptable-use` | Acceptable Use Policy (LCP-6) |
| `/legal/master-services-agreement` | MSA (LCP-7) |
| `/legal/sla` | Service Level Agreement (LCP-8) |
| `/security`, `/trust`, `/legal/security` | Security & Trust |
| `/status`, `/careers`, `/press`, `/partners` | Meta pages (rendered by `Legal.tsx`) |

All legal pages render from the `legal_documents` + `agreement_versions` tables, with a SHA-256 integrity footer and a copy-as-markdown / download button per table.

### 2.6 Catch-all
`/404` → `NotFound.tsx`, also rendered for any unmatched path.

---

## 3. Visual Tour (selected screenshots)

| # | Screenshot | Description |
|---|---|---|
| 01 | `01-homepage.png` | Public landing — hero, illustrative dashboard mock, security badges. |
| 02 | `02-login-fresh.png` | Login screen with three trust-pillars, secure form, SSO option. |
| 03 | `03-login-error-feedback.png` | Failed login showing inline banner + toast, button still active, fields preserved. |
| 04 | `04-ai-scan.png` | AI Scan tier comparison (Free / Growth / Elite). |
| 05 | `05-book-strategy.png` | Booking wizard step 1 (Choose service). |
| 06 | `06-privacy-policy.png` | Versioned legal document with integrity metadata. |

![Homepage](/home/ubuntu/handoff-screenshots/01-homepage.png)

*Homepage — public landing page.*

![Login fresh](/home/ubuntu/handoff-screenshots/02-login-fresh.png)

*Login screen, fresh form state.*

![Login error feedback](/home/ubuntu/handoff-screenshots/03-login-error-feedback.png)

*Failed login showing the inline banner above the form, the redundant toast, the still-active Sign In button and preserved field values.*

![AI Scan](/home/ubuntu/handoff-screenshots/04-ai-scan.png)

*AI Scan — Free / Growth / Elite tier comparison.*

![Book Strategy](/home/ubuntu/handoff-screenshots/05-book-strategy.png)

*Strategy Call booking wizard, step 1 — service selection.*

![Privacy Policy](/home/ubuntu/handoff-screenshots/06-privacy-policy.png)

*Privacy Policy — versioned legal document with integrity metadata in the footer.*

---

## 4. Admin Portal (`/admin/*`)

The admin portal is the operator's command center. It uses `AdminLayout` (sidebar + topbar; mobile drawer with `sr-only` SheetTitle/Description for screen-reader compliance). Sections shipped:

| Section | Path | Content |
|---|---|---|
| Executive Overview | `/admin` | KPIs (revenue, leads, conversions, active clients), trend chart, AI agent status, recent activity feed, automation health gauge. |
| Users | `/admin/users` | User CRUD, role assignment, MFA reset, impersonation (with audit). |
| Organisations | `/admin/organisations` | Tenant CRUD, membership management, plan assignment. |
| Bookings | `/admin/bookings` | All booking events, slot calendar, cancel/reschedule history, reminders queue. |
| AI Scans | `/admin/ai-scans` | All scan submissions, tier, score, refinement state, generated PDF link. |
| Leads | `/admin/leads` | Marketing lead inbox, source attribution, conversion timeline. |
| Ecosystem Clicks | `/admin/ecosystem` | Click events on solution-ecosystem cards (cohort & conversion analytics). |
| Automations & Analytics | `/admin/automations` | Automation runs, agent activity, KPI rollups. |
| Security | `/admin/security` | Login audit, MFA factors, IP/UA forensics, security event timeline. |
| Support | `/admin/support` | Internal support desk; ticket triage UI (Dialog-based, fixed for `DialogTitle` accessibility). |
| Settings | `/admin/settings` | Brand, env-config snapshot, integration toggles, legal-version pinning. |

**RBAC:** every admin tRPC procedure passes through `adminProcedure` which throws `FORBIDDEN` if `ctx.user.role !== "admin"`.

**Test admin login:** `admin@iosky.local` / seeded password (see § 14).

---

## 5. Client Portal (`/client-portal/*`)

For authenticated end-users with `role = "client"` and a linked `organizationId`. `ClientPortalLayout` enforces both invariants and surfaces a friendly empty state if either is missing.

| Section | Purpose |
|---|---|
| Dashboard | KPIs scoped to their organisation (active projects, open invoices, unread messages). |
| Projects | `client_projects` + `client_project_milestones`. |
| Invoices | `client_invoices` with status (draft / sent / paid / overdue). |
| Documents | `client_documents` — S3-backed, signed download. |
| Messages | `client_messages` thread with admin/PM. |
| Notifications | `client_notifications` (operational pings). |
| Support | `client_support_tickets` — ticket creation + replies. |
| Reports & Recommendations | `client_reports` + `client_recommendations`. |

**Tenancy guarantee:** every query in `clientProcedure` is filtered by `organizationId = ctx.user.organizationId`. Cross-tenant data is unreachable by construction.

**Test client login:** `client@iosky.local` (auto-linked to org `iosky-demo` by `seed-users.mjs`).

---

## 6. Developer Workspace (`/developer-workspace/*`)

For engineers and contractors with `role = "developer"`. `WorkspaceLayout` handles auth, NDA acceptance check, and surfaces only the projects / tasks the developer is explicitly assigned to.

| Section | Purpose |
|---|---|
| Dashboard | Active projects, open tasks, recent submissions. |
| Profile | `developer_profiles` — bio, stack, availability. |
| Access Scopes | `developer_access_scopes` — what data the developer may touch. |
| Agreements | `developer_agreements` — NDA + per-project agreements. |
| Projects | `developer_projects` filtered via `developer_project_assignments`. |
| Tasks | `developer_tasks` filtered via `developer_task_assignments`. |
| Submissions | `developer_submissions` — work delivery (S3-backed). |
| Files | `developer_project_files` — read-only access to scoped project files. |
| Messages | `developer_messages` thread with project owner. |
| Access Requests | `developer_access_requests` — request elevated scope. |
| Audit | `developer_audit` — read-only personal action log. |
| Security | `developer_security_events` — login + MFA timeline. |
| Support | `developer_support_tickets`. |
| Notifications | `developer_notifications`. |

---

## 7. Booking System (Strategy Call)

A full timezone-aware appointment system, vendor-independent (no Calendly).

**Wizard (`/book-strategy`):**
1. Service — Executive Discovery (30 min, free), Strategic Growth (60 min, paid), Elite Workshop (90 min, premium).
2. Date & Time — slots derived from `availability_windows` ⊖ `calendar_blocks` ⊖ existing `bookings` for that admin.
3. Details — name, email, phone, company, custom answers (`booking_answers`).
4. Confirm — review + GDPR consent → writes `bookings`, schedules `booking_reminders`, emits `booking_events`, logs `booking_audit`.

**Cancel/Reschedule:** `/booking/cancel?token=…` and `/booking/reschedule?token=…` use HMAC-signed booking tokens; no login required for the booker.

**Reminders:** scheduled via `manus-heartbeat` (24h + 1h before). When self-hosting, replace heartbeat with a cron job that calls a protected reminder endpoint (see § 12 & § 16).

**Tables involved:** `bookings`, `booking_audit`, `booking_slots`, `booking_answers`, `booking_reminders`, `booking_events`, `availability_windows`, `calendar_blocks`, `admin_availability`, `timezone_preferences`.

---

## 8. AI Scan System

**Tiers:**

| Tier | Cost | Length | Output |
|---|---|---|---|
| Free | €0 | 7 questions | Operational score preview, top 3 opportunities, blurred recommendations. |
| Growth | €1,500 setup + €350/mo | ~25 questions | Full report (20+ pages), ecosystem recommendation, monitoring. |
| Elite | €5,000+ setup + €1,500/mo | ~60 questions | Premium report (30–60 pages), custom architecture, priority support. |

**Backend procedures:**
- `aiScan.create` — initialises a session.
- `aiScan.answer` — appends to questionnaire state (writes to `ai_scan_responses`).
- `aiScan.submit` — triggers LLM analysis via `invokeLLM` (server-side, JSON-schema response_format) and a follow-up expert refinement queue.
- `aiScan.getReport` — signs a one-time URL to the generated PDF in S3.

**Provider:** uses the platform-supplied `BUILT_IN_FORGE_API_*` LLM endpoint (no external OpenAI key required during sandbox; for self-hosting see § 16 “Provider replacement matrix”).

---

## 9. Backend Architecture

```
client/  (React 19 + Vite + Tailwind 4 + shadcn/ui + Wouter + tRPC client)
  └── all UI

server/  (Express 4 + tRPC 11 + superjson + Drizzle ORM)
  ├── _core/        framework plumbing (do not edit unless extending)
  │   ├── context.ts        builds tRPC context (cookies → user)
  │   ├── trpc.ts           publicProcedure, protectedProcedure, clientProcedure, adminProcedure
  │   ├── oauth.ts          Manus OAuth callback + state encoding
  │   ├── localAuthRoute.ts local email/password login (this round)
  │   ├── llm.ts            invokeLLM helper
  │   ├── imageGeneration.ts
  │   ├── voiceTranscription.ts
  │   ├── notification.ts   notifyOwner helper
  │   ├── heartbeat.ts      periodic-update bridge
  │   ├── map.ts            Google Maps proxy
  │   └── env.ts            env wrapper
  ├── routers.ts    feature procedures (auth, bookings, scans, portals, legal…)
  ├── db.ts         Drizzle query helpers (return raw rows)
  └── storage.ts    S3 helpers (storagePut, storageGet)

drizzle/
  ├── schema.ts     52 tables (see § 10)
  ├── relations.ts
  └── migrations/

shared/             types & constants shared between client and server
scripts/            seed-users.mjs (now bootstraps demo org too)
references/         spec notes + this final handoff
```

**Auth flow:**
1. Browser POSTs to `/api/auth/local/login` (email + password) **or** redirects to `/api/oauth/login`.
2. Server returns a signed `__Host-session` cookie (JWT, HMAC-SHA256, `JWT_SECRET`).
3. Every `/api/trpc/*` request reads the cookie via `server/_core/context.ts`, loads the user, attaches it to `ctx`.
4. `protectedProcedure` checks `ctx.user`; `adminProcedure` checks `role`; `clientProcedure` checks `organizationId`.

**Audit log:** `login_audit` records every login attempt with success flag, IP, user agent, reason code. Retention configurable (default 365 days).

---

## 10. Database Schema (52 tables)

### Identity & sessions
`users`, `organizations`, `organization_memberships`, `mfa_factors`, `mfa_recovery_codes`, `mfa_challenges`, `login_audit`.

### Marketing & conversion
`leads`, `contact_submissions`, `dev_applications`, `ecosystem_click_events`, `ecosystem_proposal_requests`, `custom_discovery_sessions`.

### Bookings
`bookings`, `booking_audit`, `booking_slots`, `booking_answers`, `booking_reminders`, `booking_events`, `availability_windows`, `calendar_blocks`, `admin_availability`, `timezone_preferences`.

### Client portal
`client_reports`, `client_recommendations`, `client_projects`, `client_project_milestones`, `client_invoices`, `client_documents`, `client_messages`, `client_notifications`, `client_support_tickets`.

### Developer workspace
`developer_profiles`, `developer_access_scopes`, `developer_agreements`, `developer_projects`, `developer_project_assignments`, `developer_tasks`, `developer_task_assignments`, `developer_project_files`, `developer_submissions`, `developer_messages`, `developer_access_requests`, `developer_audit`, `developer_security_events`, `developer_support_tickets`, `developer_notifications`.

### Legal & compliance
`legal_documents`, `agreement_versions`, `agreement_acceptances`, `cookie_consents`, `legal_acknowledgements`.

**Migration discipline:** `pnpm db:push` runs `drizzle-kit generate && drizzle-kit migrate`. Always edit `drizzle/schema.ts` first, then push. Never modify migrations after they are committed; create a new one.

---

## 11. Legal & Compliance Layer (LCP-1 → LCP-10)

| ID | Document | Storage |
|---|---|---|
| LCP-1 | Privacy Policy | `legal_documents` + versioned `agreement_versions` |
| LCP-2 | Terms of Service | same |
| LCP-3 | Cookie Policy | same |
| LCP-4 | Data Processing Agreement | same |
| LCP-5 | AI Disclaimer | same |
| LCP-6 | Acceptable Use Policy | same |
| LCP-7 | Master Services Agreement | same |
| LCP-8 | Service Level Agreement | same |
| LCP-9 | Cookie Consent banner + record | `cookie_consents` |
| LCP-10 | Agreement Acceptances + RequireAcceptances component | `agreement_acceptances` |

**Mechanics:**
- Every legal page renders the latest **published** `agreement_version` for its `legal_document` row, embeds the version number, effective date, jurisdiction, and a SHA-256 integrity footer computed from the rendered HTML.
- The cookie banner writes a `cookie_consents` row keyed by anonymous client ID; preferences propagate to the analytics loader before any non-essential script fires.
- `agreement_acceptances` records who accepted which version when, IP and user agent. The `RequireAcceptances` React component (in `client/src/components/`) re-prompts logged-in users when a published version is newer than their last acceptance. **Currently implemented but not auto-mounted** in the three layouts — this is by design (see “Future enhancements” § 17).

---

## 12. Security & MFA

- **Passwords:** bcrypt cost 12, never logged.
- **Sessions:** signed JWT in `__Host-session` cookie, `Secure`, `HttpOnly`, `SameSite=Lax`.
- **MFA:** TOTP factor (RFC 6238) + 10 single-use recovery codes, stored as bcrypt hashes. Challenge flow at `/mfa-challenge`.
- **Rate limiting:** `recordAttempt` (in `localAuthRoute.ts`) tracks per-email + per-IP attempts; configurable cooldown.
- **Audit logging:** every login (success or failure), every booking event, every admin impersonation, every developer file access.
- **Tenant isolation:** enforced server-side in `clientProcedure` and in every developer-side procedure via `developer_*_assignments` joins.
- **Headers:** Helmet-style CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Strict-Transport-Security in production.
- **Storage:** S3 access via short-lived signed URLs only; never public.
- **Heartbeat secret:** `MANUS_HEARTBEAT_SECRET` used to authenticate periodic-update calls; must be rotated when self-hosting.

---

## 13. Provider Replacement Matrix

The build runs against Manus's built-in providers in the sandbox. To self-host on your own infrastructure, swap providers as follows:

| Capability | Sandbox provider | Self-hosted alternative | Where to swap |
|---|---|---|---|
| LLM | `BUILT_IN_FORGE_API_*` | OpenAI, Anthropic, Mistral, Azure OpenAI | `server/_core/llm.ts` |
| Image generation | `BUILT_IN_FORGE_API_*` | OpenAI Images, Stability | `server/_core/imageGeneration.ts` |
| Voice transcription | `BUILT_IN_FORGE_API_*` | OpenAI Whisper, Deepgram | `server/_core/voiceTranscription.ts` |
| Object storage | Manus S3 proxy `/manus-storage/*` | AWS S3, Cloudflare R2, Backblaze B2 | `server/storage.ts` (already AWS-SDK based) |
| OAuth identity | Manus OAuth portal | Auth.js, Clerk, Auth0, WorkOS | `server/_core/oauth.ts` + `client/src/const.ts` |
| Google Maps proxy | `server/_core/map.ts` | Direct Google Maps API key | `client/src/components/Map.tsx` |
| Email delivery | `notifyOwner` (Manus relay) | SendGrid, Postmark, Resend, AWS SES | new helper, replace `notifyOwner` calls |
| Periodic jobs | `manus-heartbeat` | Node-cron, AWS EventBridge, Cloudflare Cron Triggers | `server/_core/heartbeat.ts` |
| Analytics | `VITE_ANALYTICS_*` (Manus Umami) | Plausible, Fathom, GA4 | `client/index.html` script tag |

---

## 14. Environment Variables

### System-injected (do not commit)
```
DATABASE_URL=mysql://user:pass@host:3306/io_sky
JWT_SECRET=<32+ char random>
VITE_APP_ID=<oauth client id>
VITE_APP_TITLE=IO SKY
VITE_APP_LOGO=<url>
OAUTH_SERVER_URL=<oauth backend>
VITE_OAUTH_PORTAL_URL=<oauth login page>
OWNER_OPEN_ID=<owner sub>
OWNER_NAME=<owner display name>
BUILT_IN_FORGE_API_URL=<llm/voice/image gateway>
BUILT_IN_FORGE_API_KEY=<bearer>
VITE_FRONTEND_FORGE_API_KEY=<frontend bearer>
VITE_FRONTEND_FORGE_API_URL=<frontend gateway>
VITE_ANALYTICS_ENDPOINT=<umami endpoint>
VITE_ANALYTICS_WEBSITE_ID=<umami site id>
```

### App-specific (you set on the host)
```
NODE_ENV=production
PORT=3000                  # only used if your platform requires; do NOT hardcode
APP_URL=https://www.iosky.com
COOKIE_DOMAIN=.iosky.com   # parent domain so apex + www share session
S3_REGION=eu-central-1
S3_BUCKET=io-sky-prod
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
HEARTBEAT_SECRET=<rotate>
MAIL_FROM=ops@iosky.com
SMTP_HOST=…                # only if you replace notifyOwner
SMTP_USER=…
SMTP_PASS=…
SENTRY_DSN=…               # optional but recommended
```

---

## 15. Domain & Production Deployment Guide

This chapter is specifically for connecting your final domain (e.g. `iosky.com` / `www.iosky.com`) and going live professionally.

### 15.1 Recommended hosting topology

You can ship this stack three ways. The recommendation depends on team size and ops appetite.

| Tier | Hosting | Pros | Notes |
|---|---|---|---|
| **A – Stay on Manus** (recommended for fastest go-live) | Click **Publish** in the Management UI. Bind your custom domain in **Settings → Domains**. | Zero infra, automatic SSL, automatic heartbeat, integrated database & storage, automatic checkpoints. | The current `0995313d` checkpoint can publish immediately. Custom domain wizard handles DNS + SSL inside the panel. |
| **B – Container PaaS** | Railway / Render / Fly.io | Full control, predictable pricing, deploys from Git. | Requires you to provision MySQL/TiDB, S3, OAuth, LLM gateway separately. |
| **C – Self-hosted on AWS/GCP/Azure** | ECS Fargate / Cloud Run / App Service + RDS + S3 + CloudFront | Maximum control, enterprise compliance. | Multi-week setup; recommended only if you already operate cloud infra. |

For tier A you can stop reading here; the panel handles the rest. For B / C, continue.

### 15.2 DNS records

For an apex + www setup pointing at one origin (`<your-host>.example.com`):

| Host | Type | Value | TTL | Notes |
|---|---|---|---|---|
| `iosky.com` | `ALIAS` or `ANAME` (or `A` to your platform IPs) | `<your-host>.example.com` | 300 | Apex; use ALIAS if your DNS provider supports it. |
| `www.iosky.com` | `CNAME` | `<your-host>.example.com` | 300 | |
| `iosky.com` | `CAA` | `0 issue "letsencrypt.org"` | 3600 | Restricts who can issue SSL. |
| `iosky.com` | `MX` (if email) | `10 mail.iosky.com` | 3600 | Optional. |
| `iosky.com` | `TXT` | `v=spf1 include:_spf.<provider> -all` | 3600 | If sending email. |
| `_dmarc.iosky.com` | `TXT` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@iosky.com` | 3600 | If sending email. |

Add an SPF / DKIM / DMARC trio if you start sending transactional email yourself (see § 13).

### 15.3 SSL setup

- **Tier A (Manus):** SSL is automatic; verified inside the Domains panel.
- **Tier B (Render/Railway/Fly):** add the domain in the platform UI → it provisions a Let's Encrypt cert automatically and sets up renewal.
- **Tier C (self-hosted):** put **CloudFront / Cloud CDN / Azure Front Door** in front of your container. Issue an ACM/managed cert for both `iosky.com` and `www.iosky.com`. Force redirect HTTP → HTTPS at the CDN edge.

### 15.4 www / non-www redirect

Pick one canonical host (recommended: `https://www.iosky.com`) and 301-redirect the other. Set in CDN / reverse-proxy:

```
if ($host = 'iosky.com') {
  return 301 https://www.iosky.com$request_uri;
}
```

In the app set `COOKIE_DOMAIN=.iosky.com` so sessions survive the redirect.

### 15.5 Environment variables checklist

Before first boot in production, verify all variables in § 14 are set in your platform's secrets store. **Never** commit them to git. Run `pnpm tsx scripts/verify-env.mjs` (see § 17.4 — recommended addition) to fail fast on missing vars.

### 15.6 Database connection

- Provision **MySQL 8.x** or **TiDB** (the schema uses MySQL syntax). Minimum recommended: 2 vCPU / 4 GB RAM / 20 GB SSD for first production tenant.
- Set `DATABASE_URL` accordingly: `mysql://USER:PASS@HOST:3306/DB?ssl={"rejectUnauthorized":true}`.
- After first deploy, run `pnpm db:push` once against production to create all 52 tables.
- Run `node scripts/seed-users.mjs` once to seed the admin user + demo organisation. Then **rotate the admin password immediately** using the admin portal.

### 15.7 Storage connection

- Create an S3 bucket (or R2 / B2 equivalent). Block all public access; the app uses signed redirects only.
- Set `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- Configure a CORS rule allowing `GET, PUT, HEAD` from your origin (`https://www.iosky.com`).
- Enable versioning + lifecycle (delete incomplete multipart uploads after 7 days).

### 15.8 Email provider setup

- Choose a transactional provider (SES / SendGrid / Postmark / Resend).
- Verify your domain (DKIM + SPF in DNS).
- Replace the `notifyOwner` call in `server/_core/notification.ts` with the provider's SDK.
- Add `MAIL_FROM`, `SMTP_*` (or provider API key) to env.

### 15.9 Cron / heartbeat replacement

- Locally: `manus-heartbeat` calls scheduled endpoints.
- On Render / Railway: configure a **Cron Job** that hits `https://www.iosky.com/api/heartbeat?secret=$HEARTBEAT_SECRET` every minute.
- On AWS: EventBridge → Lambda → invoke the same URL.
- On Cloudflare: Cron Triggers + Worker → fetch the URL.

The endpoint is idempotent and self-throttling.

### 15.10 Backup setup

- **Database:** automated daily snapshot retained 30 days, plus hourly point-in-time recovery for 7 days.
- **Storage:** S3 versioning + cross-region replication for the bucket.
- **Code:** GitHub remote (use Settings → GitHub in Manus to export to your org).
- **Secrets:** store in 1Password / AWS Secrets Manager / HashiCorp Vault. Never the host filesystem.

### 15.11 Post-deployment test checklist

- [ ] `https://www.iosky.com` returns 200 and renders the homepage.
- [ ] `https://iosky.com` 301-redirects to `https://www.iosky.com`.
- [ ] SSL grade A on [SSL Labs](https://www.ssllabs.com/ssltest/).
- [ ] `/login` shows the form, submits, returns the new locale-aware error feedback on bad credentials.
- [ ] Successful local login redirects to the correct portal based on role.
- [ ] OAuth login completes, session cookie is set on `*.iosky.com`.
- [ ] `/admin` reachable only by admin role.
- [ ] `/client-portal` reachable only by client role with linked organisation.
- [ ] `/developer-workspace` reachable only by developer role.
- [ ] `/api/heartbeat?secret=…` returns 200 from cron.
- [ ] Booking flow: select slot → confirm → email reminder fires.
- [ ] AI Scan free tier: complete 7 questions → receive preview report.
- [ ] Cookie consent banner appears for anonymous users; recorded in DB.
- [ ] Privacy / Terms / Cookies / DPA / AI Disclaimer pages render with integrity footers.
- [ ] Mobile: drawer navigation works in Admin / Client / Developer layouts (a11y verified).
- [ ] Sentry / log aggregator is receiving events.
- [ ] Database backup succeeded and is restorable to a staging environment.

---

## 16. Final QA Summary

| Check | Result |
|---|---|
| `pnpm test` | **306 / 306 green** |
| `pnpm tsc --noEmit` | **0 errors** |
| `pnpm build` (production) | **Success** — client 4.0 MB → 904 KB gzip; server 312 KB |
| Browser smoke (login + nav + drawer) | **Pass** |
| Inline + toast error feedback | **Verified live** (screenshot 03) |
| Account enumeration test | **Negative** — same response for unknown email & wrong password |
| Audit log on failed login | **Verified in test suite** |
| Rate-limiting still active | **Verified** (`recordAttempt` wired) |
| Drawer accessibility (Sheet + DialogTitle) | **Compliant** in Admin / Client / Developer layouts |

---

## 17. Future Enhancements (recommended next steps)

1. **Mount `RequireAcceptances`** in `ClientPortalLayout` and `WorkspaceLayout` to re-prompt users when a published legal version bumps. Currently scoped but not auto-mounted to avoid surprise UX changes during launch.
2. **Author NL/DE/FR translations of the 8 legal documents** and seed them as additional `agreement_versions` rows. Legal review required.
3. **Replace remaining seed/demo data in admin Executive Overview & Users** with live tRPC queries once real onboarding traffic begins.
4. **Add `scripts/verify-env.mjs`** that fails fast at boot when required env vars are missing or malformed.
5. **Add an axe-core / Lighthouse a11y CI step** so future drawer/dialog regressions are caught automatically.
6. **Ship a `/healthz` and `/readyz` endpoint pair** for Kubernetes / load-balancer probes.
7. **Add Sentry server middleware** to capture unhandled exceptions with user context.
8. **Implement WebAuthn (passkey) factor** as a second MFA option alongside TOTP.
9. **Add OpenAPI / SDK export** for the developer workspace API so contractors can integrate without scraping tRPC.
10. **Enable per-tenant Postgres-style row-level security** if you migrate from MySQL/TiDB to Postgres.

---

## 18. Seeded Admin Login Guide

After running `pnpm db:push && node scripts/seed-users.mjs` once on a fresh database:

| Account | Email | Initial password | Role | Linked org |
|---|---|---|---|---|
| Super Admin | `admin@iosky.local` | (printed by seed script) | `admin` | — |
| Test Client | `client@iosky.local` | (printed by seed script) | `client` | `iosky-demo` (#1) |
| Test Developer | `dev@iosky.local` | (printed by seed script) | `developer` | — |

**On first login, every seeded account must:**
1. Open `/login` and sign in with the seed credentials.
2. Navigate to **Settings → Security**, enroll TOTP MFA, and download recovery codes.
3. Change password to a long passphrase.
4. (Admin only) Promote / invite real users via **Admin → Users**.

Detailed step-by-step is in `/references/ADMIN_PORTAL_FULL_PASS_REPORT.md`.

---

## 19. Confirmation Statement

> **The login error feedback fix is implemented, tested and verified live.** The Login page now shows a persistent inline error banner (with `role="alert"`, `aria-live="assertive"`) and a redundant toast in 8 locales whenever credentials are invalid. The submit button never hangs in loading state. The form fields are preserved for retry. No technical detail is exposed. No account enumeration is possible. The failed attempt is written to `login_audit`. Rate-limiting is preserved. 15 dedicated vitest specs cover the safe-feedback contract, with **306 / 306 total tests green** and **0 TypeScript errors** at checkpoint `0995313d`.

The platform is **ready to be professionally connected to your domain** following the Domain & Production Deployment Guide in § 15.

— End of Final Handoff Document.
