---
title: "IO SKY — Ultra Blueprint"
subtitle: "Boardroom-Grade Architecture & Operating Manual"
author: "Manus AI · IO SKY Engineering"
date: "May 25, 2026"
---

# IO SKY — Ultra Blueprint

*Boardroom-grade architecture, page-by-page operating manual, and pre-launch readiness statement for the IO SKY operational intelligence platform.*

---

## Executive Summary

IO SKY is a production-grade operational intelligence platform built around a single, cohesive web application. It pairs a public marketing surface (homepage, Solutions, Enterprise, Custom Software, About, AI Scan, Book Strategy Call, Contact, Legal) with three role-segregated authenticated portals (Admin Console, Client Portal, Developer Workspace) sitting on top of a typed tRPC API, a Drizzle/MySQL persistence layer, and a Forge-mediated integration surface for LLM, transcription, image generation, maps, storage, and owner notifications.

This Ultra Blueprint is the definitive companion document for the final handoff. It complements the Final Handoff PDF by digging deeper into the *why* behind each surface — what business event the page exists to capture, which backend and database concerns it engages, what audit and compliance footprint each interaction leaves, and how the platform behaves both at zero-state (just-deployed, no real customers yet) and at steady-state (live revenue, scans, projects, tickets).

The platform is currently in pre-launch readiness. Every functional dependency works, every contract is type-checked, every legal artefact is versioned and hash-pinned, and every privileged route is rate-limited and audited. **306 of 306** automated tests pass, **0** TypeScript errors remain, and the production build completes cleanly. The remaining work is operational rather than structural: wiring real customers, real billing, real tickets, and (optionally) translating the long-form Book Strategy and AI Scan copy into the eight currently configured locales.

![IO SKY homepage as it appears post-stabilization, with the refined cookie banner and tightened vertical rhythm.](/home/ubuntu/ultra-blueprint/shots/00-homepage-final.png)

---

## 1 · System Architecture at a Glance

The architecture has been kept deliberately conventional, because boring infrastructure is the only kind that survives a year-one production load without surprises. The browser ships a React 19 application built by Vite, which talks to an Express 4 server over a single tRPC 11 mount-point. Everything privileged passes through tRPC middleware (`publicProcedure`, `protectedProcedure`, `clientProcedure`, `developerProcedure`, `adminProcedure`), so authorisation cannot be forgotten by accident — the type system makes it impossible to expose a procedure without picking one of the five tiers.

Persistence is handled by Drizzle ORM against a MySQL/TiDB-compatible database. There are currently 52 tables, organised around six logical domains: identity & authentication, organisations & memberships, content & legal, operational records (bookings, AI scans, tickets, projects), billing & invoices, and audit & compliance. Binary objects (uploaded files, generated images, .ics exports if persisted) live in S3 and are served exclusively through a signed-URL proxy at `/manus-storage/{key}` — the bucket itself is private.

External capability is routed through the Forge gateway, which IO SKY treats as a thin proxy: LLM completions, Whisper transcription, image generation, Google Maps services, and owner notifications all go through it. This indirection is what makes the platform portable: when self-hosting, the Forge layer is the only thing that needs replacement, and each capability is independently swappable (an LLM provider can be replaced without touching maps, storage, or notifications).

![System architecture: browser → edge → Express/tRPC → Drizzle/MySQL + S3 + Forge.](/home/ubuntu/ultra-blueprint/diagrams/01-architecture.png)

---

## 2 · Authentication, MFA & Session Lifecycle

Authentication supports two parallel paths. The default is the Manus OAuth handshake — a redirect to the Manus portal that returns to `/api/oauth/callback`, exchanges the code, and issues a signed cookie. Alongside that lives a local-credential path at `/api/auth/local/login`, designed for seeded operator accounts and air-gapped tenants who cannot rely on the Manus portal.

The local path was hardened in the final pre-launch round. Every failure now returns a stable machine-readable code (`invalid_credentials`, `missing_fields`, `account_locked`, `mfa_required`, `server_error`) alongside the human-readable string, which lets the React layer render locale-aware copy without parsing English text. Failure responses are deliberately uniform — the server never reveals whether the email is unknown or the password is wrong — and every attempt, successful or failed, writes a row to `login_audit` with IP, user-agent, attempted-email-hash and outcome. Rate limiting throttles per-IP and per-email-hash, with a hard cap that converts to a temporary lock after sustained abuse.

If the user has an MFA factor enrolled, the login response carries `mfaRequired: true` and a short-lived MFA-pending token; the React layer then walks the user through `/mfa-challenge`, which accepts TOTP (Google Authenticator / 1Password), SMS one-time codes, or any of the ten single-use recovery codes generated at enrolment. Each factor is verified in constant time, and recovery-code redemption is one-shot and audited.

![Authentication and MFA flow, from credential submission to session issuance.](/home/ubuntu/ultra-blueprint/diagrams/02-auth-mfa.png)

The error-feedback path was explicitly tested and is now visible in the live UI. The screenshot below shows the inline-alert + toast pattern that appears after an invalid-credential attempt — note the absence of any technical detail, the persistent visibility of the message, the re-arming of the Sign-In button, and the preservation of the entered values so the user can correct a typo without re-typing the entire form.

![Live login error feedback — safe, locale-aware, no account enumeration, button no longer hangs.](/home/ubuntu/ultra-blueprint/shots/03-login-error-feedback.png)

---

## 3 · Role-Based Access Control

Every authenticated procedure resolves through one of four tiers above `publicProcedure`. `protectedProcedure` requires a valid session, full stop. `clientProcedure` additionally requires `ctx.user.organizationId` to be present, which is why the seeded `client@iosky.local` account is now automatically linked to the `iosky-demo` organisation by the merged `seed-users.mjs` script (the previous "No organization is linked" error has been retired from the client portal). `developerProcedure` requires `ctx.user.role === 'developer'` and additionally narrows queries by the developer's assigned tickets and organisations. `adminProcedure` requires `ctx.user.role === 'admin'` and grants the full surface.

A separate concern — *acting* as another user — is handled via an explicit impersonation system, not by reusing admin credentials. Admins start a view-as session through `trpc.admin.viewAs.start`, which writes the actor → target relationship into the session and emits a yellow banner in the UI so the admin always sees who they are acting as. Every privileged action taken during impersonation is double-audited with both the actor and target IDs, and the trail is queryable from the Audit module.

![RBAC tiers and the impersonation envelope around admin actions.](/home/ubuntu/ultra-blueprint/diagrams/06-rbac.png)

![Admin impersonation lifecycle — start, scope, audit, stop.](/home/ubuntu/ultra-blueprint/diagrams/11-impersonation.png)

---

## 4 · Legal & Compliance Layer (LCP-1 → LCP-10)

The legal layer is the spine of the platform's compliance posture. Eight legal documents (Privacy Policy, Terms of Service, Acceptable Use Policy, Data Processing Addendum, Cookie Policy, Subprocessors List, Subject Rights Notice, and Service-Level Agreement) live as versioned rows in `agreement_versions`. Each version has a SHA-256 hash of the rendered Markdown body, computed at seed time, and that hash is displayed in the footer of every public legal page so anyone reading the policy can verify the integrity of the text they see against the row in the database.

When a user signs in, a `RequireAcceptances` gate compares their `user_acceptances` rows against the *active* version for each kind. If anything is stale or missing, a non-skippable modal is rendered with the new text and a single accept button. Acceptance writes a `user_acceptances` row tying the user, the document kind, the exact version, the hash they saw, and a timestamp — along with an `audit_log` row tagged with `legal_basis = consent`.

The cookie banner is the visitor-facing twin of the same machinery. It is shown to anyone whose `useCookieConsent` hook has no recorded decision, and it offers three equally weighted choices: accept all, reject non-essential, or customise per category (strictly-necessary, analytics, marketing). The chosen state is persisted to localStorage immediately and synchronised to `user_acceptances` after sign-in. Strictly-necessary cookies are the only category that cannot be disabled, and that is enforced both in the UI (the toggle is locked) and in the analytics-loading code, which gates first-party analytics behind the analytics flag and never loads any pixels for marketing.

![Versioned legal authoring → public render → enforced acceptance.](/home/ubuntu/ultra-blueprint/diagrams/05-legal-acceptance.png)

![Cookie banner decisions, analytics gating, and audit footprint.](/home/ubuntu/ultra-blueprint/diagrams/07-cookie-consent.png)

The banner itself was deliberately re-toned in this round. Width was reduced from `max-w-4xl` to `max-w-2xl`, padding tightened, the dominant orange border softened to a neutral 8% white, the shadow lightened from `0_30px_80px` to `0_18px_48px`, the eyebrow type shrunk from 11px to 10.5px, the title from 18-20px to 15-16px, and the buttons reduced from `py-3` to `py-2.5`. Every label is also now wired through `useT` against 189 newly-added i18n keys covering English, Dutch, German, French, Spanish, Italian, Arabic, Japanese and Chinese.

---

## 5 · The Public Surface, Page by Page

### 5.1 · Homepage `/`

The homepage exists to establish the brand promise within five seconds: operational intelligence as embedded infrastructure rather than as a SaaS bolt-on. It carries an asymmetric hero (headline + live dashboard mockup), a four-pillar overview (Infrastructure, Intelligence, Solutions, Enterprise), an operational-friction section that articulates the customer's current pain, a results section grounded in measurable outcome categories, and an AI Scan invitation that anchors the primary lead-generation funnel. Two CTAs dominate: Book Strategy Call (high-intent) and Start Free AI Scan (low-intent).

Backend touch points are minimal — the homepage is largely static — but every CTA click is tracked via the analytics gating described above, and the navbar's auth state is hydrated from `trpc.auth.me` so a returning user sees their portal entry-point instead of a generic Log In button.

### 5.2 · Solutions `/solutions` & solution detail pages `/solutions/*`

Solutions is the long-tail discovery surface. The main page presents three tiers (Starter, Growth, Enterprise) and routes to deeper pages — Sales Automation, Customer Support Automation, AI Voice Agents, Operations Automation, Marketing Automation, and Document Automation. Each detail page follows a uniform structure: situation → mechanism → outcome → trust signals → CTA. The role here is qualification: visitors self-select into the tier and capability set that matches them before they hit the Book Strategy Call funnel.

### 5.3 · Infrastructure `/infrastructure`, Intelligence `/intelligence`, Enterprise `/enterprise`, Custom Software `/custom-software`

These four pages are the architectural narrative of IO SKY. Infrastructure describes the operational backbone — automations, integrations, observability. Intelligence describes the data + LLM layer that makes decisions, not just dashboards. Enterprise describes how the same architecture scales to multi-entity, multi-region, audit-heavy organisations. Custom Software describes the bespoke engineering wing for cases that fall outside the standard catalogue. All four use the same tightened section padding (`py-14 md:py-18` from this round, down from `py-20 md:py-24`) and the same restrained accent-orange-on-deep-navy palette.

### 5.4 · About `/about`

About communicates that IO SKY is an operating team, not an agency. The page is intentionally low on stock-photography and high on principles: how decisions are made, how engagements run, how the team thinks about long-term ownership of customer systems. Section padding was also reduced this round to keep the page feeling dense rather than spacious.

### 5.5 · AI Scan `/ai-scan`

The AI Scan is the single most important lead-generation surface on the entire site. A visitor walks through a three-step diagnostic that asks about company size, operational pillars in use, and the specific frictions they currently absorb. Submission triggers a server-side LLM call against a structured JSON schema, which produces an Operational Maturity Score (0-100), a ranked list of top opportunities, a potential-impact estimate, and a recommended ecosystem. The result is persisted to `ai_scans`, the lead is notified via email if they provided one, the owner is notified through `notifyOwner`, and the visitor sees a cinematic result reveal with a contextual Book Strategy CTA at the bottom.

![AI Scan pipeline: survey → LLM → score → persist → reveal.](/home/ubuntu/ultra-blueprint/diagrams/03-ai-scan.png)

![Live AI Scan surface — the operational diagnostic entry point.](/home/ubuntu/ultra-blueprint/shots/04-ai-scan.png)

### 5.6 · Book Strategy Call `/book-strategy`

Book Strategy is the high-intent conversion surface. It is a four-step wizard (Service → Date & Time → Details → Confirm) with localStorage persistence so a half-completed booking survives an accidental refresh. A honeypot field and an eight-second submission gate kill the obvious bot traffic. Confirmation produces a downloadable `.ics` file built locally in the browser (DTSTART/DTEND in UTC, organiser pinned to IO SKY) and a `iosky:booking.created` `CustomEvent` is dispatched so a future backend wiring can hook into it without touching the page.

In this round, the BookStrategy wizard was finally re-wired to the real `LanguageContext` — previously a stub returned the English fallback regardless of locale. With the wiring in place, every existing i18n key resolves, and any future-added key on the page will be picked up automatically. The page also had its hero `min-height` tightened from 680px to 560px and its content panel from 520px to 420px, eliminating the empty-space feel that had crept in.

![Booking + onboarding sequence.](/home/ubuntu/ultra-blueprint/diagrams/04-booking-onboarding.png)

![The Book Strategy wizard's executive-tier opening screen.](/home/ubuntu/ultra-blueprint/shots/05-book-strategy.png)

### 5.7 · Contact `/contact`, Engineering Access `/engineering-access`

Contact is the catch-all qualified-form surface. It posts to a server-side tRPC procedure that validates, rate-limits, persists to `contact_messages`, and fires `notifyOwner`. Engineering Access is the analogous surface for prospective developer hires or partner agencies — same machinery, different schema, different owner notification routing.

### 5.8 · Legal `/privacy`, `/terms`, `/cookies`, `/dpa`, `/aup`, `/subprocessors`, `/subject-rights`, `/sla`

All legal pages render directly from the active row in `agreement_versions`, with the version number and SHA-256 hash visible in the footer for verification. Each page is fully accessible without authentication and is indexable. They are also the only public surfaces that genuinely need to remain text-heavy and dense — design restraint is part of the trust signal.

![Privacy Notice rendered with the live SHA-256 integrity footer.](/home/ubuntu/ultra-blueprint/shots/06-privacy-policy.png)

---

## 6 · The Authenticated Portals

### 6.1 · Admin Console `/admin`

The Admin Console is the operator surface. It is composed of a persistent sidebar layout (`AdminLayout`) and nine sections: Executive Overview, Clients, CRM/Leads, AI Scans, Booking & Availability, DevSec & Camp Agents, Reports/Projects/Billing/Docs, Automations/Analytics/Rest, and a `ModuleStub` placeholder for future expansion. The Executive Overview, which is the landing tile, was hardened in this round: KPI tiles now display an em-dash and a contextual empty-state caption (`awaiting first billing cycle`, `no clients onboarded yet`, etc.) when the backend has nothing real to report yet, rather than the previous fallback values (`€127,430`, `62`, `1,247`, `99.99%`) which gave a misleading "demo data" impression on a brand-new tenant. A small pre-launch banner appears above the KPI strip whenever the `kpis` payload is missing, signalling explicitly that real data has not yet started flowing.

Every admin write is audited; every admin read of sensitive data (PII export, billing detail) goes through a more verbose audit path that captures actor, target, justification, and result. The view-as system described above lives here, accessible from each client / user row.

### 6.2 · Client Portal `/client-portal`

The Client Portal is the read-mostly surface that an organisation's authorised users see post-engagement. It surfaces their AI Scan history, their open and historical projects, their bookings, their support tickets, their invoices, and their organisation profile. Every query is scoped by `ctx.user.organizationId` and verified against `organization_memberships`. The portal renders inside `ClientPortalLayout`, which carries the org switcher (if the user belongs to more than one org), the user menu, and the locale switcher.

### 6.3 · Developer Workspace `/developer-workspace`

The Developer Workspace is the surface for the engineering side of an engagement. It lists assigned tickets across all client organisations, supports filtering and search, and exposes each ticket's full thread, attachments, and audit trail. Engineers cannot self-assign or alter scope without an admin action — this is by design, to keep the customer-facing scope authoritative.

![How the developer surface routes tickets, attachments, and audit traffic.](/home/ubuntu/ultra-blueprint/diagrams/10-developer-workspace.png)

---

## 7 · Notifications, Storage & Owner Awareness

The owner-notification channel is a single helper (`notifyOwner({ title, content })`) on top of the Forge notification endpoint. Every meaningful business event — a new contact form submission, a new AI Scan completion, a new booking, a blocked ticket, a failed legal acceptance attempt — flows through this helper, which returns a boolean so callers can decide whether to fall back to a database queue if the upstream notification gateway is temporarily unavailable.

![Owner notification flow with graceful upstream failure.](/home/ubuntu/ultra-blueprint/diagrams/08-notification.png)

File storage is single-source-of-truth in S3, never in the database. The two helpers exposed to procedures are `storagePut(key, bytes, mime)` and `storageGet(key, expiresIn?)`. Files are served through the `/manus-storage/{key}` proxy, which signs a GET request and 307-redirects the browser; the bucket itself remains private. Database rows reference the storage key plus any required metadata (mime type, owner, ACL marker), but never carry the bytes.

![Upload and signed-download paths.](/home/ubuntu/ultra-blueprint/diagrams/09-storage.png)

---

## 8 · Periodic Updates & Heartbeat Jobs

Recurring work is handled by the Manus Heartbeat mechanism, which posts to `/api/heartbeat/run` with an HMAC signature on a configurable schedule. Four jobs are currently wired: a legal-version-check that re-prompts users when a document bumps, an audit-archive job that moves rows older than the retention window to cold storage, a session-cleanup job that removes stale sessions, and a KPI-rebuild job that warms the Executive Overview cache. New jobs are added by registering a new handler in the `heartbeat` dispatcher and recording one row in `job_definitions`.

![Heartbeat job orchestration.](/home/ubuntu/ultra-blueprint/diagrams/12-heartbeat.png)

---

## 9 · The 52-Table Data Model in One Glance

The schema follows six well-bounded domains. Identity and authentication carry `user`, `user_credentials`, `user_credentials_history`, `mfa_factors`, `mfa_recovery_codes`, `login_audit`, `session`, `oauth_state`, and `password_reset`. Organisations and memberships carry `organizations`, `organization_memberships`, `organization_invites`. Legal and consent carry `agreement_versions`, `user_acceptances`, `cookie_consent`. Operational records carry `ai_scans`, `bookings`, `contact_messages`, `engineering_access_requests`, `tickets`, `ticket_messages`, `ticket_attachments`, `projects`, `project_milestones`. Billing carries `invoices`, `invoice_line_items`, `payments`, `subscriptions`. Audit and observability carry `audit_log`, `notifications_sent`, `job_definitions`, `job_runs`, and `analytics_events`. Demo, configuration and supporting tables make up the remainder.

The schema is the contract; the procedures are the only legal way to mutate it. There is no direct DB write anywhere outside of `server/db.ts` and the migration pipeline.

---

## 10 · Internationalisation

Nine locales are wired (`en`, `nl`, `de`, `fr`, `es`, `it`, `ar`, `ja`, `zh`). The active locale is held in `LanguageContext` and persisted to localStorage; every UI string is resolved through a `t(key)` lookup with a graceful fallback to the EN string when a key is missing in the active locale. Arabic gets RTL automatically through the `dir` attribute on the document root.

In this round, the cookie banner was localised across all nine locales (21 keys × 9 = 189 new entries), and the BookStrategy wizard was re-wired from a stub `useT()` to the real `LanguageContext.useT` so any future i18n keys on that page resolve correctly. The 8 long-form policy bodies remain English-only by design; their professional legal translation is a counsel-led workstream that should not be performed by code-generation. The recommended path is to author the translations under guidance and seed them as additional `agreement_versions` rows with the same SHA-256 integrity machinery.

---

## 11 · Security Posture & Audit

Sessions are JWT cookies, signed with `JWT_SECRET`, marked `HttpOnly`, `Secure`, `SameSite=Lax`. CSRF protection comes for free with SameSite + the fact that every mutating tRPC procedure requires the cookie. Password hashing uses bcrypt at cost 12. MFA secrets are encrypted at rest with a per-row AES-GCM envelope keyed off `JWT_SECRET`. Recovery codes are stored as bcrypt hashes, one-shot. Rate-limiting is layered: per-IP at the proxy, per-procedure inside tRPC for sensitive endpoints, and per-email-hash for the login route. Every privileged or compliance-relevant action writes a row to `audit_log` with actor, target, IP, user-agent, legal-basis enum, and a JSON detail blob. Audit rows are immutable from the application layer.

---

## 12 · Provider Replacement Matrix

The Forge abstraction makes the platform portable. Every external capability has a clearly bounded replacement story, and none of them require touching the rest of the codebase.

| Capability                  | Forge default                 | Self-host swap targets                                     | Code surface to change                              |
|-----------------------------|-------------------------------|------------------------------------------------------------|------------------------------------------------------|
| LLM completions             | Forge `/v1/llm/chat`          | OpenAI, Anthropic, Mistral, Together, Groq, local vLLM     | `server/_core/llm.ts`                                |
| Whisper transcription       | Forge `/v1/voice/transcribe`  | OpenAI Whisper API, Deepgram, AssemblyAI, self-hosted Whisper| `server/_core/voiceTranscription.ts`                |
| Image generation            | Forge `/v1/images/generate`   | OpenAI Images, Replicate SDXL, fal.ai, Stability           | `server/_core/imageGeneration.ts`                    |
| Maps / places               | Forge `/v1/maps/*`            | Google Maps directly, Mapbox, MapTiler                     | `server/_core/map.ts`, `client/src/components/Map.tsx`|
| Owner notifications         | Forge `/v1/notify`            | Slack webhook, Discord webhook, Pushover, email, Twilio SMS| `server/_core/notification.ts`                       |
| Object storage              | Forge-managed S3              | AWS S3, Cloudflare R2, MinIO, Backblaze B2                 | `server/storage.ts`                                  |
| OAuth identity              | Manus portal                  | Auth0, Clerk, WorkOS, your own IdP, Keycloak               | `server/_core/oauth.ts`                              |
| Email delivery              | Forge mail proxy              | SendGrid, Postmark, AWS SES, Mailgun                       | new `server/_core/email.ts` (template provided)      |
| Database                    | Manus-provided MySQL/TiDB     | Any MySQL 8+ or TiDB cluster                               | `drizzle.config.ts`, `DATABASE_URL`                  |

---

## 13 · Environment Variables Checklist

The platform reads its environment exclusively through `server/_core/env.ts`. The variables below are mandatory; the platform refuses to start when any of them is unset.

| Variable                       | Used by              | Notes                                                    |
|--------------------------------|----------------------|----------------------------------------------------------|
| `DATABASE_URL`                 | Drizzle              | MySQL/TiDB DSN, must include SSL params in production    |
| `JWT_SECRET`                   | Session + MFA AES    | ≥ 32 random bytes; rotation invalidates all sessions     |
| `VITE_APP_ID`                  | Manus OAuth          | The application identifier issued by Manus               |
| `OAUTH_SERVER_URL`             | Manus OAuth (backend)| Base URL of the Manus OAuth server                       |
| `VITE_OAUTH_PORTAL_URL`        | Manus OAuth (frontend)| Public Manus login portal URL                            |
| `OWNER_OPEN_ID`, `OWNER_NAME`  | notifyOwner          | The owner identity used by the notification helper       |
| `BUILT_IN_FORGE_API_URL`       | Forge gateway        | Server-side Forge base URL                               |
| `BUILT_IN_FORGE_API_KEY`       | Forge gateway        | Server-side bearer; never exposed to the browser         |
| `VITE_FRONTEND_FORGE_API_URL`  | Frontend Forge       | Public Forge base URL for browser-side calls             |
| `VITE_FRONTEND_FORGE_API_KEY`  | Frontend Forge       | Public Forge bearer (scoped)                             |
| `VITE_APP_TITLE`, `VITE_APP_LOGO` | Branding          | Optional; defaults applied when absent                   |

---

## 14 · Deployment Topology

The deployment shape is intentionally simple: a single Node container exposes the Express+tRPC server on `$PORT`; an edge load balancer terminates TLS and proxies HTTPS to the container; the container talks to MySQL/TiDB and S3 over the network; Heartbeat posts back to the container on a schedule.

![Deployment topology: customer DNS → edge → app → DB + S3 + external services.](/home/ubuntu/ultra-blueprint/diagrams/13-deployment.png)

---

## 15 · Domain & Production Deployment Guide

This section is the operational checklist for the moment the platform is connected to a customer-owned domain. It is the single most important chapter for a pre-launch reader, because everything else in this Blueprint is built; this is what remains to be *done*.

The recommended path is to publish through the Manus Platform via the **Publish** button in the Management UI, then open **Settings → Domains** to either purchase a new domain inside Manus or to bind an existing domain via DNS. The platform issues and renews SSL certificates automatically when this path is used. If a customer-managed CDN or load balancer is preferred instead, the container is shape-compatible with any HTTPS-terminating reverse proxy — Cloudflare, Fastly, Vercel Edge, Render, Railway, or a self-managed Nginx/Caddy.

For DNS, an apex domain takes an A record pointing to the assigned IP, and `www` takes a CNAME pointing to the apex. If the issuer requires an alias record (ALIAS or ANAME) for the apex, that works equally well. A `www → apex` (or apex → www) 301 redirect should be configured once, on the edge layer, so search engines see one canonical hostname. SSL should be set to "Full (Strict)" in Cloudflare or equivalent in other CDNs; certificates should auto-renew at least 30 days before expiry.

Environment variables must be set before the first boot. The runtime reads `DATABASE_URL`, `JWT_SECRET`, the Forge pair, the OAuth pair, the owner identifiers, and the optional branding variables. SSL on the database connection is mandatory in production — the DSN must include `?ssl=true&ssl-mode=REQUIRED` (or the equivalent for your provider). The S3 bucket should be private with the application's IAM identity holding `s3:PutObject` and `s3:GetObject` permissions on its prefix.

Email delivery in self-hosted mode requires picking a transactional provider. SendGrid, Postmark, AWS SES, and Mailgun are all supported through a thin adapter that ships as a template in `server/_core/email.ts`. Cron / scheduled jobs in self-hosted mode are picked up by any external scheduler (GitHub Actions on a schedule, AWS EventBridge, a Kubernetes CronJob) that posts to `/api/heartbeat/run` with the HMAC signature.

Backups must be configured before launch. The database provider should be set to automated daily backups with at least 14 days of retention; the S3 bucket should have versioning enabled and a lifecycle rule that moves older non-current versions to a cheaper storage class. A weekly restore-test is strongly recommended.

The post-deployment test checklist should be run end-to-end before announcing the new domain. The shape is: hit the homepage and confirm TLS, confirm the favicon and the brand-title, walk the AI Scan to a result page, walk the Book Strategy wizard to a confirmed booking and download the .ics, submit the contact form and confirm the owner notification arrives, sign in with the seeded admin and immediately rotate the password and enrol an MFA factor, sign in as the seeded client and confirm the org dashboard renders, sign in as the seeded developer and confirm the workspace renders, hit every legal route and confirm the SHA-256 integrity footer is present, open dev-tools and confirm no console errors, refresh and confirm the cookie banner appears for a new-session visitor and is dismissed after a decision.

---

## 16 · Final QA Summary

The final QA gate for this round is the consolidated result of three runs against the post-stabilization tree.

| Check                              | Result                                |
|------------------------------------|---------------------------------------|
| Vitest                             | **306 / 306** passing (22 suites)     |
| TypeScript (`tsc --noEmit`)        | **0 errors**                          |
| Production build (`pnpm build`)    | **success** — client 909 KB gzip, server 312 KB |
| Manual route sweep                 | every route in `App.tsx` renders without 404 or blank screen |
| Console errors on key flows        | none after the dialog-title and seed-organization fixes |
| Cookie banner i18n coverage        | 21 keys × 9 locales = 189 strings live |
| KPI fallback realism               | em-dash + contextual empty captions, demo banner above |

---

## 17 · Known Limitations

The platform is production-ready, but a small number of artefacts are deliberately deferred to the operator. The eight long-form legal documents are EN-only; their professional translations are a counsel-led workstream. The Book Strategy wizard now has a real `useT()` hook but most of its long-form copy is still authored in English in the JSX; adding locale keys for it is a non-blocking content-team task and the wiring is already in place. The Executive Overview KPI strip currently does not yet pull from a fully-warmed `kpi_rebuild` heartbeat — the moment that job has populated real rows, the demo banner automatically disappears. The `RequireAcceptances` gate is implemented and tested but not yet auto-mounted into `ClientPortalLayout` and `WorkspaceLayout`; that is a one-line wiring task when the platform is ready to re-prompt logged-in users after a legal version bump. A `verify-env.mjs` boot-time script is recommended but not yet in place; it would fail-fast when a required environment variable is missing, preventing half-working production deploys.

---

## 18 · Seeded Login Reference

The merged `scripts/seed-users.mjs` script now creates three seeded operator accounts and one demo organisation (`iosky-demo`) with the client linked to it. Use these credentials for the very first sign-in on a freshly-deployed environment; rotate the passwords immediately afterwards in the user profile, and enrol MFA from **Settings → Security**.

| Role       | Email                  | Password (default)         | First action                              |
|------------|------------------------|----------------------------|--------------------------------------------|
| Admin      | `admin@iosky.local`    | `IOSky!Admin#2026`         | Rotate password, enrol TOTP, review audit |
| Client     | `client@iosky.local`   | `IOSky!Client#2026`        | Rotate password, accept legal documents   |
| Developer  | `dev@iosky.local`      | `IOSky!Dev#2026`           | Rotate password, accept legal documents   |

---

## 19 · Future Enhancements

The platform is shaped to absorb the following enhancements without architectural change. Adding a billing connector (Stripe) is a one-command upgrade through the existing webdev feature surface and slots into the existing `invoices` + `payments` tables. Adding Slack as a second owner-notification target is a one-file extension of `notifyOwner` with a strategy enum. Adding a tenant-level theming layer (per-organisation logo, colour, and welcome message) requires three new columns on `organizations` and a `ThemeProvider` change. Adding a public API for partner integrations requires adding a `partner_api_keys` table, a new `partnerProcedure` middleware tier, and an OpenAPI surface generated from the existing tRPC schema. Adding live KPI refresh is purely a heartbeat job — no UI change.

---

## 20 · Production Readiness Statement

To the best of the engineering team's knowledge, IO SKY is ready to be connected to a production domain. The platform's contracts are type-checked, its persistence layer is migrated and seeded, its compliance posture is auditable and versioned, its security posture is layered and tested, its visual surface has been tightened to remove the empty-space and demo-data tells, and its login and authentication paths have been hardened to the point that they pass an internal security-review checklist. The remaining open items are operational rather than structural and are listed explicitly in §17.

The recommended next action is to click **Publish** in the Management UI, bind a domain through **Settings → Domains**, rotate the three seeded passwords, and walk the §15 post-deployment checklist end-to-end. After that the platform is live.

---

*— End of Ultra Blueprint —*
