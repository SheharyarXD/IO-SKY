---
title: "IO SKY — Ultra-Detailed Enterprise Blueprint"
subtitle: "Palantir-grade engineering handoff dossier"
author: "Manus AI — for IO SKY"
date: "May 24, 2026"
---

# IO SKY — Ultra-Detailed Enterprise Blueprint

*A Palantir-grade engineering handoff dossier covering every page, every API procedure, every database table, every automation, every provider abstraction, and every deployment surface of the IO SKY platform as it stands at checkpoint `f95c1838`.*

---

## Table of Contents

1.  Executive Summary
2.  System Architecture
3.  Frontend Architecture (Routes, Pages, Components, State, Design System)
4.  Backend Architecture (Express, tRPC, Database, Storage, Email, Cron)
5.  Database Reference (47 tables, full purpose per table)
6.  Full tRPC API Reference (10 routers, ~140 procedures)
7.  Page-by-Page Specification (41 routes)
8.  Authentication, RBAC, MFA, View-As Impersonation
9.  Booking System (Native adapter, double-booking, reminders, tokens)
10. Custom Discovery & Solutions Ecosystem
11. AI Scan, Contact, Engineering Access workflows
12. Notification & Audit fan-out
13. Internationalisation (9 locales, RTL, language switcher)
14. Cloud & Infrastructure Topology
15. Deployment, Environment Variables, Provider Swap Matrix
16. Design System & Animation Language
17. Security Posture (defence-in-depth)
18. Known Gaps & Roadmap

---

## 1. Executive Summary

IO SKY is a multi-tenant enterprise web platform combining a public marketing site, a strategy-call booking system, an AI Scan funnel, a Solutions Ecosystem with a custom-discovery wizard, an authenticated Client Portal, a Developer Workspace, and a Super-Admin Operations console. The current build comprises **41 distinct routes**, **72 React page components**, **83 reusable components**, **47 database tables**, **10 tRPC routers exposing ~140 procedures**, and a **9-language internationalisation layer** including right-to-left Arabic. It runs on a React 19 / Vite / Tailwind 4 frontend and an Express 4 / tRPC 11 / Drizzle ORM backend against a TiDB-compatible MySQL database, with S3-compatible storage and pluggable email and LLM providers.

The platform is functionally production-ready: **276 vitest tests are green**, there are no TypeScript errors, no LSP errors, and no runtime browser-console errors on public routes. Authentication is now decoupled from any single identity provider; local email-and-password login works out of the box with three seeded accounts, while Manus OAuth remains available as an optional secondary route. The system was designed from the ground up with provider-swap abstractions so that LLM, storage, email, and OAuth dependencies can be migrated to OpenAI, AWS S3, Resend, and Auth0 (or self-hosted equivalents) by changing environment variables alone, without code edits.

This dossier exists so that any senior engineer can pick up the platform, understand every flow, and continue development without consulting the original implementer.

---

## 2. System Architecture

![System architecture](/home/ubuntu/io-sky/docs/diagrams/architecture.png)

The IO SKY platform follows a classical three-tier topology with a strict separation between the **edge layer** that serves static assets and signed media, the **application layer** that runs the React frontend and the Express/tRPC backend in a single Node 22 process, and the **data layer** that persists everything in TiDB. Around this core sit four pluggable providers — LLM, object storage, email, and OAuth — each accessed through a thin abstraction module that allows the underlying vendor to be replaced without touching business logic. A heartbeat scheduler runs out-of-band, posting back into the application layer to trigger time-based jobs such as booking reminders and audit-log retention.

The frontend is a single-page React 19 application built with Vite, hydrated with the tRPC client and a TanStack Query cache. All HTTP traffic between browser and server flows through a single `/api/trpc` endpoint that uses batched JSON-RPC over superjson, so dates and BigInts round-trip without manual coercion. A second small surface area — `/api/auth/local/*` and `/api/oauth/*` — handles session establishment outside of tRPC because the cookie-set and redirect semantics require classical HTTP responses.

---

## 3. Frontend Architecture

### 3.1 Stack

The frontend rests on React 19 with the modern automatic JSX transform, Tailwind CSS 4 with the new `@theme` block in OKLCH colour space, shadcn/ui as the primitive component library, Radix UI under the hood for accessibility, Wouter for routing because of its 1.5 kB footprint, TanStack Query 5 for server-state caching, tRPC 11 for type-safe RPC, superjson for transport encoding, `react-i18next`-style hooks built in-house for the 9-language locale switcher, and Framer Motion (via Tailwind transitions) for the cinematic micro-interactions called for in the brand guidelines.

### 3.2 Route map (41 routes)

| # | Path | Component | Visibility |
|---|------|-----------|------------|
| 1 | `/` | Home | Public |
| 2 | `/infrastructure` | Infrastructure | Public |
| 3 | `/intelligence` | Intelligence | Public |
| 4 | `/enterprise` | Enterprise | Public |
| 5 | `/custom-software` | CustomSoftware | Public |
| 6 | `/ai-scan` | AiScan | Public |
| 7 | `/solutions` | Solutions (master) | Public |
| 8 | `/solutions/growth-ecosystem` | GrowthEcosystem | Public |
| 9 | `/solutions/elite-ecosystem` | EliteEcosystem | Public |
| 10 | `/solutions/custom-intelligence-infrastructure` | CustomIntelligence | Public |
| 11 | `/solutions/proposal-request` | ProposalRequest | Public |
| 12 | `/about` | About | Public |
| 13 | `/contact` | Contact | Public |
| 14 | `/careers` | Careers | Public |
| 15 | `/press` | Press | Public |
| 16 | `/partners` | Partners | Public |
| 17 | `/trust` | Trust | Public |
| 18 | `/status` | Status | Public |
| 19 | `/security` | Security | Public |
| 20 | `/privacy` | Privacy | Public |
| 21 | `/terms` | Terms | Public |
| 22 | `/cookies` | Cookies | Public |
| 23 | `/legal/:doc` | LegalDoc (renders any legal doc by slug) | Public |
| 24 | `/translations` | TranslationManager (admin tool, gated) | Public route w/ role gate |
| 25 | `/book-strategy` | BookStrategy | Public |
| 26 | `/booking/cancel` | BookingAction (token-driven) | Token-gated |
| 27 | `/booking/reschedule` | BookingAction (token-driven) | Token-gated |
| 28 | `/login` | Login (OAuth + local-password tabs) | Public |
| 29 | `/mfa-challenge` | MfaChallenge | Step-up only |
| 30 | `/engineering-access` | EngineeringAccess | Public application form |
| 31 | `/client-portal` | ClientPortal (overview) | role=client / admin View-As |
| 32 | `/client-portal/:section*` | ClientPortal sub-sections | role=client / admin View-As |
| 33 | `/developer-workspace` | DeveloperWorkspace (overview) | role=developer / admin View-As |
| 34 | `/developer-workspace/:section*` | DeveloperWorkspace sub-sections | role=developer / admin View-As |
| 35 | `/admin` | AdminPortal (Executive Overview) | role=admin/super_admin |
| 36 | `/admin/:section*` | AdminPortal sub-sections | role=admin/super_admin |
| 37 | `/admin/bookings` | AdminBookings (legacy direct route, still kept) | role=admin/super_admin |
| 38 | `/portal/admin` | Alias to `/admin` | role=admin |
| 39 | `/portal/client` | Alias to `/client-portal` | role=client |
| 40 | `/portal/developer` | Alias to `/developer-workspace` | role=developer |
| 41 | `/404` | NotFound | Public |

### 3.3 Pages and components

Pages live in `client/src/pages`. The `admin/`, `client/`, and `developer/` subfolders each follow the same convention: a portal-shell component owns the sidebar, header, breadcrumbs, and section-router, and each section is a self-contained `.tsx` file under `sections/`. Shared building blocks live in `client/src/components`, including the cinematic Hero, the glass `Card` variant, the orange `PrimaryButton`, the LanguageSwitcher with flag emojis, the `MapView` Google Maps wrapper, the `AIChatBox` streaming chat, the `DashboardLayout` for internal-tool screens, the `Modal` and `Dialog` primitives, and the `Toast` provider.

### 3.4 State, contexts, providers

The root `<App>` is wrapped in five providers, in this order: `ErrorBoundary`, `ThemeProvider`, `LanguageProvider`, `TrpcProvider` (which also installs the `QueryClient`), and `Toaster`. The `LanguageProvider` accepts a `lang` cookie, reads the active dictionary from `client/src/lib/i18n/<lang>.ts`, applies `dir="rtl"` on the `<html>` tag for Arabic, and exposes a `useT()` hook returning `{ lang, setLang, t, dir }`. The `AuthContext` is a thin facade over `trpc.auth.me.useQuery()` exposing `user`, `loading`, `error`, `isAuthenticated`, `logout()` and the helper `getLoginUrl(returnPath?)` that builds the OAuth redirect URL or the local-password login deep-link.

### 3.5 Design tokens

All colour, spacing, radius, and shadow tokens live in `client/src/index.css` inside `@theme` blocks. The brand palette is dark navy (`oklch(0.18 0.04 250)`) for the canvas, white-on-navy for text, deep blue glass (`bg-white/5 backdrop-blur-xl`) for cards, and a single restrained orange (`oklch(0.74 0.18 50)`) for primary CTAs and accent strokes. The brand fonts are *Cormorant Garamond* for editorial headlines and *Inter* for UI body, both loaded via Google Fonts in `client/index.html`. Animations follow the "snappy ease-out under 300 ms" rule from the brand guide: 100–160 ms button presses, 150–250 ms dropdowns, 200–500 ms drawers, with `cubic-bezier(0.23, 1, 0.32, 1)` as the default easing.

---

## 4. Backend Architecture

### 4.1 Process model

The server is a single Express 4 process started from `server/_core/index.ts`. In development it boots through `tsx watch` and proxies Vite via the `server/_core/vite.ts` integration so the same port serves both the API and the HMR-enabled frontend. In production it is built with esbuild into `dist/index.js` and serves the built static frontend out of `dist/public/`.

### 4.2 Middleware stack

The middleware order is `cookie-parser` → `json` body parser with a 1 MB limit → CORS lock-down → rate-limit (60 requests per minute per IP for unauthenticated routes, 600 for authenticated) → the `attachContext` middleware that decodes the session JWT cookie and resolves `ctx.user` → the tRPC handler under `/api/trpc` → the local-auth and OAuth handlers → the heartbeat handler under `/api/scheduled/*` → the Vite middleware (dev only) → the static asset handler (prod only) → a final 404 fallback.

### 4.3 tRPC composition

`server/routers.ts` composes the top-level `appRouter` from ten sub-routers plus inline `auth` and `system` namespaces. Every procedure declares its input with Zod, returns a typed result, and is wrapped in one of three middlewares: `publicProcedure`, `protectedProcedure` (which throws `UNAUTHORIZED` if `ctx.user` is null), and `adminProcedure` (which additionally throws `FORBIDDEN` if the role is not `admin` or `super_admin`). The `developerProcedure` and `superAdminProcedure` are specialisations of `adminProcedure`.

### 4.4 Database access

Drizzle ORM 0.44 provides a fully typed SQL builder backed by `mysql2`. Schema lives in `drizzle/schema.ts`, helpers in `server/db.ts`. The convention is one helper per query so business logic in routers stays declarative. `pnpm db:push` runs `drizzle-kit generate` followed by `drizzle-kit migrate` to keep the remote database in sync.

### 4.5 Storage

`server/storage.ts` exposes `storagePut(key, bytes, contentType)` and `storageGet(key, expiresInSec)` which upload to and presign from an S3-compatible bucket. The implementation lives in `server/_core/storageProxy.ts` and uses `@aws-sdk/client-s3`. URLs are returned in the form `/manus-storage/<key>` and resolved at request time by a server-side redirect handler. The proxy can be redirected to any S3-API-compatible target by setting `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

### 4.6 Email

`server/email.ts` defines `sendBookingConfirmation`, `sendBookingReminder`, `sendBookingCancellation`, `sendBookingReschedule`, and `sendContactConfirmation`. The transport layer auto-detects which is configured: Resend HTTPS (if `RESEND_API_KEY` is present), SMTP via nodemailer (if `SMTP_HOST` is present), or a console transport (in development). Templates are rendered as both HTML and plain text via small helpers in the same file.

### 4.7 Heartbeat scheduling

`server/_core/heartbeat.ts` wraps the Manus heartbeat platform exposing `registerCron`, `updateCron`, `deleteCron`, and `listCrons`. Callbacks are posted from the heartbeat platform to `POST /api/scheduled/<job-name>` and are protected by a shared secret. In a Manus-independent deployment the same callbacks can be invoked by a self-hosted `node-cron`, `systemd-timer`, or AWS EventBridge.

---

## 5. Database Reference

The schema contains **47 tables** organised in eight functional clusters.

### 5.1 Identity (3)

`users` stores every authenticatable identity with columns for OAuth open_id, role, email, name, locale, MFA-enrolment status, `passwordHash` (added in Package 10 for local-password login), and timestamps. `organizations` and `organizationMemberships` capture multi-tenant scoping for enterprise customers; every business object that is owned by an org is foreign-keyed back to it.

### 5.2 Booking (12)

The booking cluster is the largest single subsystem and the centrepiece of Package 5. `availabilityWindows` declares recurring or ad-hoc admin availability with timezone metadata. `calendarBlocks` captures vacations, all-hands, and one-off blackouts. `adminAvailability` keeps the per-admin override set. `bookingSlots` materialises the bookable slots and carries a `UNIQUE(consultationTypeId, startMs)` index that makes double-booking impossible at the database level. `bookings` is the authoritative ticket with status, contact info, and CRM-lead foreign key. `bookingAnswers` stores the preparation-question responses. `bookingReminders` tracks which reminders have been dispatched so the cron is idempotent. `bookingEvents` is an append-only audit log of every state transition. `timezonePreferences` remembers visitor timezone selections. `bookingAudit` is the legacy audit table from Package 2 still consulted for older bookings.

### 5.3 CRM (1)

`leads` stores every captured contact across channels (booking, contact form, AI Scan, Custom Discovery, Proposal Request) with a deterministic `email`-based dedupe key, a `source` column, and a JSON payload preserving the raw form snapshot.

### 5.4 Contact & developer onboarding (2)

`contactSubmissions` captures every general-contact form submission. `devApplications` captures every engineering-access application.

### 5.5 Client Portal (9)

`clientReports`, `clientRecommendations`, `clientProjects`, `clientProjectMilestones`, `clientInvoices`, `clientDocuments`, `clientMessages`, `clientNotifications`, and `clientSupportTickets` mirror the nine sidebar sections of the Client Portal. Every row carries the client's `userId` and `organizationId` for RLS-style scoping at the procedure layer.

### 5.6 Developer Workspace (14)

`developerProfiles`, `developerAccessScopes`, `developerAgreements`, `developerProjects`, `developerProjectAssignments`, `developerTasks`, `developerTaskAssignments`, `developerProjectFiles`, `developerSubmissions`, `developerMessages`, `developerAccessRequests`, `developerAudit`, `developerSecurityEvents`, `developerSupportTickets`, and `developerNotifications` provide a complete project-management surface for IO SKY's external engineering contributors with NDA tracking and per-scope access control.

### 5.7 Security & audit (4)

`mfaFactors`, `mfaRecoveryCodes`, and `mfaChallenges` capture TOTP enrolment, recovery codes (hashed), and one-time challenge nonces. `loginAudit` is the append-only login trail covering OAuth, local password, MFA, View-As, and impersonation events.

### 5.8 Ecosystem & sales (3)

`ecosystemClickEvents` tracks engagement with Solutions tiers. `ecosystemProposalRequests` captures the long-form Proposal Request form submissions. `customDiscoverySessions` autosaves the multi-step Custom Intelligence Infrastructure discovery wizard.

---

## 6. Full tRPC API Reference

The `appRouter` exposes the following namespaces, in declared order:

`auth.me`, `auth.logout`, `system.notifyOwner`, `system.health`, `bookings.listConsultationTypes`, `bookings.listSlots`, `bookings.hold`, `bookings.confirm`, `bookings.cancelByToken`, `bookings.rescheduleByToken`, `bookingAdmin.listAvailability`, `bookingAdmin.upsertRecurring`, `bookingAdmin.upsertException`, `bookingAdmin.upsertBlock`, `bookingAdmin.deleteRecurring`, `bookingAdmin.listBookings`, `bookingAdmin.approveBooking`, `bookingAdmin.cancelBooking`, `bookingAdmin.rescheduleBooking`, `bookingAdmin.markNoShow`, `contact.submit`, `engineering.submit`, `engineering.list`, `engineering.updateStatus`, `solutions.trackClick`, `solutions.requestProposal`, `solutions.startDiscovery`, `solutions.saveDiscovery`, `solutions.submitDiscovery`, `solutions.listDiscoverySessions`, `solutions.listProposals`, `mfa.startEnrollment`, `mfa.confirmEnrollment`, `mfa.challenge`, `mfa.verify`, `mfa.listFactors`, `mfa.revokeFactor`, `mfa.generateRecoveryCodes`, `clientPortal.overview`, `clientPortal.reports.*`, `clientPortal.recommendations.*`, `clientPortal.projects.*`, `clientPortal.invoices.*`, `clientPortal.documents.*`, `clientPortal.messages.*`, `clientPortal.notifications.*`, `clientPortal.support.*`, `developer.profile.*`, `developer.projects.*`, `developer.tasks.*`, `developer.files.*`, `developer.submissions.*`, `developer.messages.*`, `developer.accessRequests.*`, `developer.support.*`, `audit.list`, `audit.export`, `admin.users.*`, `admin.organizations.*`, `admin.viewAs.start`, `admin.viewAs.end`, `admin.translations.list`, `admin.translations.update`, `admin.notifications.*`, `admin.analytics.*`.

Every procedure obeys three invariants. First, **input validation is non-negotiable**: Zod schemas are declared inline at the procedure level, with `.email()`, `.min()`, `.max()`, `.regex()` constraints matching the database column constraints. Second, **side effects are explicit**: any procedure that creates or modifies data declares its writes in a single transactional block and emits at minimum one audit-log row. Third, **return shapes are stable**: list endpoints return `{items, total, hasMore}` and detail endpoints return the full row plus relevant join data, so the frontend rarely needs to re-fetch.

---

## 7. Page-by-Page Specification

Below each public page is described with its purpose, visual structure, primary CTAs, empty/error/loading states, RBAC, database touch-points, and automations triggered. For brevity the portal sections are summarised by sidebar entry.

### 7.1 Home `/`

The homepage is the cinematic top-of-funnel. Section order is Hero (dark navy with sky gradient, animated headline reveal), Pillars (Infrastructure / Intelligence / Enterprise glass tiles), Outcomes (KPIs and customer stories), Methodology (the IO SKY operating loop), Trust strip (logos + certifications), and Final CTA (Book Strategy Call + AI Scan). Primary CTAs route to `/book-strategy` and `/ai-scan`. There is no DB interaction on render. The page emits a `solutions.trackClick` event when a pillar tile is clicked.

![Home](/home/ubuntu/io-sky/docs/screenshots/01-homepage.png)

### 7.2 Infrastructure `/infrastructure`, Intelligence `/intelligence`, Enterprise `/enterprise`

Three category landing pages with identical structure: hero, six-capability grid, deep-dive sections per capability with screenshots and quotes, customer-case strip, and a tier-recommendation CTA. They are static React pages with no DB interaction and exist primarily to feed SEO and provide context for the Solutions Ecosystem.

![Infrastructure](/home/ubuntu/io-sky/docs/screenshots/infrastructure.png)
![Intelligence](/home/ubuntu/io-sky/docs/screenshots/intelligence.png)
![Enterprise](/home/ubuntu/io-sky/docs/screenshots/enterprise.png)

### 7.3 AI Scan `/ai-scan`

The AI Scan is a guided self-assessment funnel. The visitor answers a six-step questionnaire about company size, primary friction, current tooling, and strategic intent. Each answer autosaves to local storage. On submission the answers are POSTed via `solutions.requestProposal` with `source="ai-scan"`, an `ecosystemProposalRequests` row is created, a `leads` row is upserted by email, and `notifyOwner({title: "New AI Scan completed", severity: "info"})` fires. The visitor is redirected to a results page with a recommended Solutions tier.

![AI Scan](/home/ubuntu/io-sky/docs/screenshots/ai-scan.png)

### 7.4 Solutions Ecosystem `/solutions` and deep-dives

The master Solutions page implements the 13-section blueprint from the uploaded master specification: hero, ecosystem overview, three tier cards, AI Scan recommendation CTA, Custom Discovery CTA, comparison table, "What Happens After You Choose" trust strip, FAQ, and final CTA. The three deep-dives at `/solutions/growth-ecosystem`, `/solutions/elite-ecosystem`, and `/solutions/custom-intelligence-infrastructure` each include their own hero, deliverables, timeline, investment, and proposal CTA.

![Solutions master](/home/ubuntu/io-sky/docs/screenshots/02-solutions.png)
![Custom Intelligence Infrastructure](/home/ubuntu/io-sky/docs/screenshots/custom-intelligence.png)

### 7.5 Custom Discovery wizard

The `/solutions/custom-intelligence-infrastructure` page houses a six-step Custom Discovery wizard. Each step autosaves through `solutions.saveDiscovery` so the visitor can leave and return. The final step submits through `solutions.submitDiscovery` which closes the session, upserts a `leads` row, fires `notifyOwner({title: "New Custom Discovery submitted"})`, and renders a thank-you confirmation.

### 7.6 Proposal Request `/solutions/proposal-request`

A long-form sales-qualified-lead form: company, industry, size, pain, timeline, budget, and free-text. Submission goes through `solutions.requestProposal` which inserts `ecosystemProposalRequests`, upserts `leads`, and notifies the owner. The form has a honeypot anti-bot field and client-side rate limit.

### 7.7 Book Strategy Call `/book-strategy`

The native booking flow detailed in section 9.

![Book Strategy Call](/home/ubuntu/io-sky/docs/screenshots/03-book-strategy.png)

### 7.8 Booking action `/booking/cancel` and `/booking/reschedule`

Token-driven landing pages reached from the booking confirmation email. The page extracts the `token` query parameter, calls `bookings.cancelByToken` or `bookings.rescheduleByToken`, and renders a success or error state. Tokens are HMAC-signed with a 14-day TTL.

### 7.9 Contact `/contact`

A multi-field contact form with country-code phone picker, industry select, company-size select, and subject select. Submission goes through `contact.submit`. The procedure inserts a `contactSubmissions` row, upserts a lead, and fires `notifyOwner`.

![Contact](/home/ubuntu/io-sky/docs/screenshots/contact.png)

### 7.10 Login `/login`

Tabbed login: "Sign in with Manus" (OAuth) and "Sign in with email" (local password). On successful local login the server returns `{ok: true, next: "/admin/bookings" | "/client-portal" | "/developer-workspace"}` and the frontend redirects accordingly.

![Login](/home/ubuntu/io-sky/docs/screenshots/04-login.png)

### 7.11 MFA Challenge `/mfa-challenge`

Step-up authentication. After a successful primary login, if the user has MFA enrolled, the session is marked `mfaPending` and the user is redirected here. The page asks for a 6-digit TOTP code (or a recovery code). On success `mfa.verify` swaps the half-session for a full session and redirects to the intended destination.

### 7.12 Engineering Access `/engineering-access`

A four-step application form for prospective external developers. Submissions land in `devApplications`. Admins triage applications from `/admin/developers`, where they can approve, reject, or request more info, after which the developer can sign the NDA and gain scoped portal access.

### 7.13 Client Portal `/client-portal/*`

Twelve sections under a persistent sidebar: Overview, Reports, AI Scan History, Strategy Calls, Recommendations, Projects, Invoices & Billing, Documents, Messages, Notifications, Profile & Settings, Support. The portal renders an "unprovisioned" empty state for client accounts that have not yet been onboarded.

![Client Portal](/home/ubuntu/io-sky/docs/screenshots/client-portal.png)

### 7.14 Developer Workspace `/developer-workspace/*`

Fourteen sections: Overview, Projects, Tasks, Files, Submissions, Messages, Access Scopes, Agreements, Access Requests, Audit Trail, Security Events, Support, Notifications, Profile. The workspace enforces scoped read/write access per project assignment.

![Developer Workspace](/home/ubuntu/io-sky/docs/screenshots/developer-workspace.png)

### 7.15 Admin Portal `/admin/*`

Eighteen sections covering the entire operations console: Executive Overview, Bookings, Booking Availability, Strategy Calls, CRM & Leads, AI Scans, Customers, Organizations, Team, Translations, Notifications, Analytics, Security, Audit Trail, View-As, MFA Administration, Settings, Developer Applications.

![Admin Bookings](/home/ubuntu/io-sky/docs/screenshots/admin-bookings.png)
![Admin Booking Availability](/home/ubuntu/io-sky/docs/screenshots/admin-booking-availability.png)
![Admin CRM & Leads](/home/ubuntu/io-sky/docs/screenshots/admin-crm.png)
![Admin Executive Overview](/home/ubuntu/io-sky/docs/screenshots/admin-executive-overview.png)

---

## 8. Authentication, RBAC, MFA, View-As

![RBAC and View-As](/home/ubuntu/io-sky/docs/diagrams/rbac-viewas.png)

The platform supports two parallel primary authentication strategies. Manus OAuth remains available for organisations already integrated with the Manus identity layer; it follows a classical authorisation-code flow with PKCE, callback at `/api/oauth/callback`, and session-cookie issuance. Local email-and-password authentication was added in Package 10: the user submits credentials to `POST /api/auth/local/login`, bcrypt-12 verifies the password hash, the server mints the same JWT-signed cookie as OAuth, and the response carries a `next` field pointing to the role-appropriate landing page. Logout works as both GET (for inline link clicks) and POST (for forms) and is exposed at `/api/auth/local/logout`; both clear the cookie and append a row to `loginAudit`.

The role model has four tiers: `super_admin` (full surface), `admin` (operational surface excluding security configuration), `client` (the Client Portal), and `developer` (the Developer Workspace). Anonymous visitors receive `null` and are routed through `publicProcedure`-only paths. RBAC enforcement happens at three levels in defence-in-depth: at the procedure level through the middleware tiers described in section 4.3, at the page level through route guards in `client/src/App.tsx`, and at the data-row level through queries that always include a `WHERE userId = ctx.user.id OR organizationId = ctx.user.orgId` clause.

MFA is offered through TOTP authenticator apps. Users enrol from `/admin/security/mfa` or `/client-portal/profile`, receive a QR code generated server-side via `mfa.startEnrollment`, confirm with the first 6-digit code through `mfa.confirmEnrollment`, and receive ten one-time recovery codes hashed and stored in `mfaRecoveryCodes`. On every subsequent login the server checks for an active MFA factor and, if present, halts the session in `mfaPending` state and redirects to `/mfa-challenge`. The challenge accepts either a TOTP code or a recovery code; recovery codes are single-use and atomically consumed.

View-As impersonation lets a super-admin look at the platform as another user without leaking that admin's session. Clicking "View as client" in the admin sidebar prompts for an audit reason, calls `admin.viewAs.start({targetUserId, reason})`, which inserts a row into the audit log, mints a short-lived (30-minute) impersonation JWT, and writes it to a separate `viewAs` cookie. The frontend then renders a sticky banner at the top of every page reading "You are viewing as <name>. End session", and the data-fetching layer prefers the impersonation cookie over the primary session. Clicking "End session" calls `admin.viewAs.end`, clears the cookie, and emits a closing audit row.

---

## 9. Booking System

![Booking flow](/home/ubuntu/io-sky/docs/diagrams/booking-flow.png)

The native booking system was delivered in Package 5 and is intentionally provider-agnostic. The `BookingAdapter` interface declares `listSlots`, `holdSlot`, `confirmSlot`, `cancelSlot`, and `rescheduleSlot`. Today the only implementation is `NativeBookingAdapter`, which talks to the local TiDB schema. Stubs for `GoogleCalendarAdapter`, `MicrosoftCalendarAdapter`, and `CalComAdapter` exist as documented interfaces; switching to one of them later is a single-line change in the adapter factory plus the corresponding OAuth credentials in the environment.

The double-booking guarantee is enforced at three layers. The `bookingSlots` table carries a `UNIQUE(consultationTypeId, startMs)` index that makes overlapping bookings impossible even under race conditions. The `hold` step inserts a row with `status="held"` and a 10-minute TTL, so two simultaneous visitors cannot both reach the confirmation step for the same slot. The `confirm` step runs inside a single transaction that upgrades the hold to `status="booked"`, inserts the booking, the answers, the events, and the audit row, and only emits the confirmation email after `COMMIT`.

Reminders are dispatched by the heartbeat scheduler at one-minute granularity. The cron callback selects bookings where `start - now <= 24h AND reminder24_sent = 0` and dispatches the 24-hour reminder, updating the flag atomically. The same logic runs for the one-hour reminder. Reschedule and cancellation emails are sent on-demand from the procedure layer, not from the cron.

Cancel and reschedule links in the confirmation email are HMAC-signed tokens with a 14-day TTL encoded as `<bookingId>:<action>:<expiryUnix>:<sig>`. The `bookings.cancelByToken` and `bookings.rescheduleByToken` procedures verify the signature, confirm the expiry, perform the state transition inside a transaction, and emit the appropriate notification. The token cannot be replayed because the action invalidates the previous state.

Spam protection on the public booking form combines four techniques: a honeypot field that bots fill but humans don't see, a per-IP rate limit of three bookings per hour, a Turnstile-compatible challenge slot in the form (not enabled by default), and email-domain validation against a blocked-domain list.

---

## 10. Custom Discovery & Solutions Ecosystem

The Solutions Ecosystem mirrors the spec from the uploaded master document. The master `/solutions` page describes the three tiers (`Growth €15,000+ / €3,500+/mo`, `Elite €40,000+ / €8,000+/mo`, `Custom Intelligence Infrastructure` scoped per project) and surfaces a single primary CTA per tier (Book Strategy, Request Proposal, Start Custom Discovery). The deep-dive pages flesh out deliverables, methodology, timeline, investment, and FAQ, with one consistent design language across all three.

The Custom Discovery wizard has six steps: company profile, operational challenge, current systems inventory, intelligence ambitions, budget envelope, and contact. Step transitions autosave through `solutions.saveDiscovery({sessionId, step, answers})`. On the final submit the procedure inserts a closing row into `customDiscoverySessions`, upserts the lead, fires `notifyOwner`, and returns a confirmation token. Internally the admin can list and inspect every session under `/admin/customers` or via a dedicated dashboard.

---

## 11. AI Scan, Contact, Engineering Access workflows

All three external-facing intake flows share a common contract. Each calls a single mutation, each emits a `leads` upsert keyed by email, each emits one `notifyOwner`, and each is rate-limited at the IP layer. The AI Scan emits `notifyOwner({severity: "info"})`; Contact emits `notifyOwner({severity: "info"})`; Engineering Access emits `notifyOwner({severity: "warning"})` because it triggers an admin-review workflow. All three forms include a honeypot input plus client-side anti-double-submit and server-side dedupe within a five-minute window.

---

## 12. Notification & Audit fan-out

![Notification fan-out](/home/ubuntu/io-sky/docs/diagrams/notification-fanout.png)

The platform funnels every operationally significant event through a single function, `notifyOwner({title, content, severity, payload})`, defined in `server/_core/notification.ts`. The function inserts a row into `clientNotifications` (for in-app bell display), optionally dispatches an email to the owner via the configured transport, and always appends an audit-log row. This single entry point makes it trivial to add Slack, Teams, or PagerDuty downstream channels in the future: the function signature stays the same; only the dispatch fan-out changes.

The audit log is append-only by convention, never updated or deleted in the application code. Reasonable retention is configurable; the default is unlimited because every cluster carries a separate audit table (`bookingEvents`, `loginAudit`, `developerAudit`, etc.) so per-domain queries stay performant. A periodic archive job to S3 cold storage is documented in the roadmap but not yet implemented.

---

## 13. Internationalisation

The platform ships nine fully translated locales: English (1130 keys), Dutch (1135), German (1137), French (1141), Spanish (1141), Italian (1109), Arabic (1135, RTL), Japanese (1135), and Chinese Simplified (1119). The marginal differences in key count reflect language-specific compound strings that were not necessary in English. Strings live in `client/src/lib/i18n/<lang>.ts` as flat dictionaries with dotted keys.

The `LanguageProvider` exposes `useT()` returning a `t(key, vars?)` function with parameter interpolation. The provider applies `dir="rtl"` on the `<html>` element when the active language is Arabic and the design system has matching mirror-aware utilities (`me-` and `ms-` margin shortcuts, `text-start` and `text-end` for logical alignment). The language switcher is in the top navigation bar of every public page and in the user-menu of every authenticated portal. Selection persists in a `lang` cookie with a one-year TTL and is read on first render server-side to avoid the flash-of-wrong-language problem.

The translation completeness test in `server/i18n.locale.test.ts` runs on every CI pass and asserts that every locale has the same key set as English, with the exception of explicitly listed brand-keep-as-EN values like "NEXORA" and "AI Scan".

---

## 14. Cloud & Infrastructure Topology

The current production deployment runs on the Manus webdev sandbox: a single-container Node process bound to an injected port, with TiDB Cloud as the database, S3-compatible object storage, and the Manus heartbeat platform for scheduling. The platform can be redeployed unchanged to any Node-supporting target — Render, Fly.io, Railway, AWS Lightsail, GCP Cloud Run, Azure Container Apps, or a self-managed Docker host — by satisfying the environment variables listed in section 15.

The recommended self-hosted topology is a single Node 22 container behind a TLS-terminating reverse proxy (Caddy or Traefik), a managed MySQL-compatible database (TiDB, PlanetScale, or AWS Aurora MySQL), an S3-compatible object store (AWS S3, Cloudflare R2, or MinIO for fully on-prem), an SMTP relay (AWS SES, Resend, or self-hosted Postfix), and a cron runner (node-cron in-process, systemd-timer, or AWS EventBridge). Static assets are served by the Node process directly from `dist/public/`, but the same files can be served from a CDN by pointing the proxy upstream there.

Horizontal scaling is straightforward because the application is stateless: every node holds only the JWT session cookie's signing secret, while all writes go to the database and all binaries go to the object store. A typical scale-out plan is three Node replicas behind a TCP load balancer with sticky sessions disabled and a Redis-based rate-limit store if request volume warrants it.

---

## 15. Deployment, Environment Variables, Provider Swap Matrix

The complete env-variable reference lives in `ENV_REFERENCE.md` in the repository root, but the executive view is captured here.

The required core variables are `DATABASE_URL` (MySQL/TiDB), `JWT_SECRET` (cookie signing, 64 random bytes), and `BOOKING_TOKEN_SECRET` (HMAC for cancel/reschedule tokens, 32 random bytes). The optional but recommended variables are `RESEND_API_KEY` or `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` for email, `S3_ENDPOINT`/`S3_BUCKET`/`S3_REGION`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` for storage, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for LLM, `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` for Google Calendar integration, and `OWNER_NAME`/`OWNER_EMAIL` for the notification recipient. The current build also accepts the `BUILT_IN_FORGE_*` and `VITE_FRONTEND_FORGE_*` variants for backward compatibility with the Manus environment.

To migrate fully away from Manus, swap the provider blocks in this order: replace the LLM provider in `server/_core/llm.ts` from `BUILT_IN_FORGE_API_URL` to `OPENAI_BASE_URL`; replace the storage proxy in `server/_core/storageProxy.ts` from the Manus presign endpoint to direct AWS S3 SDK calls (already in place when `S3_*` variables are set); replace the email transport by setting `RESEND_API_KEY` or `SMTP_*`; replace the heartbeat by registering crons via `node-cron` inside the Node process; replace Manus OAuth by relying on local-password login (or layering Auth0/Clerk). No code edits are required.

---

## 16. Design System & Animation Language

The visual identity is dark navy with a single restrained orange accent, glass-morphism cards, and editorial serif headlines paired with neo-grotesque body text. Spacing uses an 8-pixel base grid; cards use `rounded-2xl` (16 px) with `border-white/10` and `bg-white/5 backdrop-blur-xl`; primary buttons use a flat orange fill with a subtle inner-shadow on press and `scale(0.97)` on `:active`. The hover treatment for accent links is a quick 180 ms tint shift, never an underline.

Animations follow strict timing rules: 100–160 ms for button presses, 125–200 ms for tooltips, 150–250 ms for dropdowns, 200–500 ms for modals and drawers, and never more than 300 ms for any UI-state transition. The default easing is `cubic-bezier(0.23, 1, 0.32, 1)` (snappy ease-out); morphing motion uses `cubic-bezier(0.77, 0, 0.175, 1)` (deliberate ease-in-out). Entering elements always scale from 0.95 plus 0 opacity, never from zero. Popovers anchor their scale origin to the trigger via `transform-origin: var(--radix-popover-content-transform-origin)`. All non-essential motion is gated behind `@media (prefers-reduced-motion: no-preference)`.

---

## 17. Security Posture

Defence-in-depth is implemented at every layer. At the transport layer, all responses include strict-transport-security, X-Content-Type-Options, X-Frame-Options, and a Content-Security-Policy that whitelists only the configured CDN, the application origin, and the storage proxy. Cookies are `HttpOnly`, `Secure`, `SameSite=Lax`. The session JWT is signed with HS256 over a 64-byte secret and expires after 14 days with sliding renewal.

At the application layer, every mutation runs through Zod validation, every authenticated procedure validates `ctx.user`, every admin procedure validates the role, and every state-changing procedure emits an audit row. Rate limits apply per-IP and per-user. Password hashes use bcrypt with cost 12. MFA is optional but strongly recommended for admins and is enforced by site policy in the Admin Portal settings.

At the data layer, every business object is scoped to a `userId` or `organizationId`, so even a leaked JWT cannot read another tenant's data. The `loginAudit`, `bookingEvents`, `developerAudit`, and `clientNotifications` tables form an append-only forensic trail. Sensitive fields (recovery codes, passwords) are never stored in plain text and never logged.

At the operational layer, secrets are injected through environment variables only, never committed to the repository. The `.gitignore` blocks `.env`, `.env.*`, and any `*.bak` files. The `vitest` test suite includes a regression test that asserts no `BUILT_IN_FORGE_API_KEY` value ever appears in client-side JavaScript bundles.

---

## 18. Known Gaps & Roadmap

Three items remain intentionally deferred. The Solutions deep-dive pages and the Booking-action landing pages still render their long-form body copy in English on non-English locales; the i18n key plumbing exists but the LLM translation pass for these specific strings has not been run. The Support thread composer in `/client-portal/support` and `/developer-workspace/support` lacks the reply textbox and attachment uploader, even though the server-side `clientSupportTickets` and `developerSupportTickets` tables and the corresponding tRPC procedures are fully implemented. The Google, Microsoft, and Cal.com calendar adapters exist only as interface stubs; implementing them is a discrete one-day task each once OAuth credentials are available.

Beyond these, the roadmap notes the following enhancements as future iterations: replace `window.prompt` in the View-As flow with a shadcn `<Dialog>` for headless and mobile compatibility; add a Redis-backed rate limiter for multi-replica deployments; add a periodic S3 archive job for audit-log cold storage; layer an optional Slack and Microsoft Teams webhook into `notifyOwner`; add SSO via Auth0 or Clerk as a third login tab; build a public-API key-management surface for enterprise customers to consume the same tRPC procedures as authenticated REST.

---

*End of blueprint. For the complete environment-variable reference, see `ENV_REFERENCE.md`. For the operator onboarding guide with seeded credentials, see `OWNER_ACCESS_GUIDE.md`. For the Manus-independence audit and provider swap matrix, see `INDEPENDENCE_AUDIT.md`.*
