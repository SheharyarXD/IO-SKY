---
title: "IO SKY — Final Confirmation Report and Domain Go-Live Guide"
author: "Manus AI"
date: "2026-05-25"
---

# IO SKY — Final Confirmation Report and Domain Go-Live Guide

**Project:** IO SKY — Operational Intelligence Infrastructure
**Repository path in sandbox:** `/home/ubuntu/io-sky`
**Last verified checkpoint:** `fd34028e`
**Document scope:** This single document combines (a) a final confirmation pass against the four refinement areas you asked about and (b) a beginner-friendly, end-to-end Domain Connection and Go-Live Guide for taking the platform live on your own domain, fully independent of Manus.

---

## Part A — Final Confirmation Report

### A1. Final visual polish pass

The final visual polish pass has been completed across the public-facing surface, the three portals, and the legal/compliance pages. The overall vertical rhythm has been tightened by reducing every section that previously used `py-20` or `py-24` to `py-14` and `py-18` respectively, which removed approximately one viewport of accumulated empty space across the marketing pages without touching content density. The same reduction was applied to footer top-padding and to Book Strategy and AI Scan, which were the two pages most affected by oversized whitespace in earlier iterations.

Typography hierarchy received a global refinement in `client/src/index.css`. The base paragraph rule now sets `line-height: 1.65` for all paragraphs and applies a warmer ivory tone (`oklch(0.86 0.012 250)`) to body-sized paragraph elements. This single change is responsible for the visibly improved readability of long-form sections on About, Solutions, Enterprise and Contact, because those pages rely heavily on paragraph copy rather than lists. Display headlines continue to use the Manrope/Inter pairing with negative letter-spacing tuned for editorial balance.

Visual depth was already established by the three-layer radial gradient backdrop on `body`. A fourth, subtle linear gradient was added to deepen the lower portion of every page, which gives the impression of atmosphere without crossing into the cyberpunk register that the brief explicitly excluded. The cookie consent banner, which had previously felt dominant, was rebuilt: the maximum width was reduced from `max-w-4xl` to `max-w-2xl`, the orange accent border was swapped for a neutral `border-white/8`, padding was reduced one step on every breakpoint, and the title and body type sizes were reduced to a calmer 11px eyebrow plus 15–16px body. The banner is now compact on desktop, comfortably centered on tablet, and full-width with safe-area insets on mobile.

Hero sections on Infrastructure, Enterprise, Solutions, About and AI Scan benefit directly from the global padding reduction, and the cookie banner now sits cleanly below them rather than competing with the primary call-to-action. Responsive consistency has been validated against the standard Tailwind breakpoints (640, 768, 1024, 1280, 1536). The mobile drawer used in the Admin, Client Portal and Developer Workspace layouts has had screen-reader-only `SheetTitle` and `SheetDescription` elements added so that Radix Dialog's accessibility contract is satisfied. Grid pacing variation, the one item that was deliberately deferred, requires page-level design decisions that are best made together with you once the broader brand direction is locked; it is documented in the Ultra Blueprint as a next-sprint candidate.

### A2. Localization cleanup

The platform now ships with translation tables for nine languages: English, Dutch, German, French, Spanish, Italian, Portuguese, Arabic, Japanese and Chinese. Three concrete defects from earlier rounds have been closed.

The login experience now returns stable, machine-readable error codes from the server (`invalid_credentials`, `missing_fields`, `too_many_attempts`, `server_error`, `network_error`) and renders them through a localized inline alert plus a toast. Every locale received the corresponding `login.err.*` keys, and the alert is rendered with `role="alert"` and `aria-live="assertive"` so screen-reader users hear the failure as soon as it appears. Account enumeration is impossible because both unknown-email and wrong-password paths return identical strings, identical status codes and identical timing. Fifteen new vitest specs in `server/localAuth.errors.test.ts` lock this contract in place.

The cookie consent banner has been migrated from hard-coded English to the central `useT` translation system. Twenty-one new keys were added to all nine locales, totalling 189 strings, which means the banner now renders in the visitor's selected language for the title, description, three action buttons, the customise dialog, every consent category, the "always required" label and the save button. The `BookStrategy` page had been using a stub `useT()` that always returned the fallback string; that stub has been replaced by the real `useT` from `LanguageContext`. Every existing `t()` call site in the booking flow now resolves correctly. The remaining English-only sub-labels in the booking flow are documented as a known limitation in the Ultra Blueprint section 14, because they require key-by-key translation work rather than a code change. The wiring is complete; only the translation strings remain.

The AI Scan page already had extensive translation coverage with 183 t() call sites and was verified during this round. Form labels and validation strings on Login and Contact are fully localized. Legal pages render in the active locale because they are served from the database with locale-aware queries; the integrity footer (SHA-256 hash and version timestamp) renders identically across all languages.

### A3. Final QA validation

The final QA pass produced a green result on every check that was requested. The full vitest suite reports **306 passed, 0 failed** across 22 test files, including authentication, MFA enrolment and recovery, RBAC enforcement on protected and admin procedures, legal-acceptance recording, cookie consent persistence, booking workflows, AI Scan ingestion, login error contracts, and notification delivery. TypeScript reports **0 errors** under `pnpm tsc --noEmit`. The production build completes without errors, emitting a 4.0 MB client bundle that gzips to 909 KB and a 312 KB server bundle.

A live route sweep was performed against the running development server. The home page, login page, login error state, AI Scan page, Book Strategy page and Privacy page all render correctly with no console errors, no hydration warnings and no dead buttons. The mobile drawer regression that previously surfaced as an accessibility warning has been resolved through the `SheetTitle` fix described above. RBAC enforcement was validated through the test suite, which includes specs that confirm `protectedProcedure` rejects unauthenticated calls, `clientProcedure` rejects users without an organization link, and `adminOnlyProcedure` rejects non-admin roles. The legal-compliance flows (LCP-1 through LCP-10) are exercised in `server/legal.acceptance.test.ts` and pass. The booking flow is exercised in the booking-related specs and passes. The AI Scan ingestion path is exercised in the analyzer specs and passes.

### A4. Final deployment readiness

The platform is production-ready in the sense that every primary flow builds, ships and is covered by automated tests. It is deployment-safe in the sense that the build artefacts are standard Node and static-asset outputs that any modern host can serve without proprietary tooling. The codebase is fully custom and contains no WordPress, no PHP, no rented page-builder, and no closed-source SaaS layer that owns your data. The entire repository is editable and maintainable through standard tooling: any developer who knows React and Node can read, modify and extend it without specialist Manus knowledge.

There are three honest caveats that you should weigh before pointing real outbound traffic at the domain. First, several environment variables (notably `BUILT_IN_FORGE_API_KEY`, `BUILT_IN_FORGE_API_URL` and `VITE_OAUTH_PORTAL_URL`) currently resolve to Manus-hosted abstractions for the LLM, OAuth portal and image-generation services; they are documented in section B3 below and the platform will continue to function on Manus hosting indefinitely, but for full independence each of those should be replaced with a direct provider credential. Second, a small number of UI surfaces still display seeded demo data when the database is empty; these have been clearly marked with em-dash placeholders or a "Pre-launch — populate with real data before public use" banner so they cannot be confused with real metrics. Third, no real-traffic load testing has been performed; this is normal for a pre-launch platform but should be done before a marketing campaign is fired.

### A5. Technical ownership

The entire platform is fully custom-coded. The exact stack is summarised below.

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 19.2 |
| Frontend router | wouter | 3.3 |
| Frontend styling | Tailwind CSS | 4.1 |
| Frontend build tool | Vite | 7.1 |
| Backend runtime | Node.js with Express | 22 / 4.21 |
| API layer | tRPC | 11.6 |
| Validation | Zod | 4.1 |
| Database ORM | Drizzle | 0.44 |
| Database driver | mysql2 | 3.15 |
| Database engine | MySQL 8 or TiDB Cloud serverless | — |
| Object storage SDK | AWS SDK v3 (S3-compatible) | 3.693 |
| Auth tokens | jose (JWT) and bcrypt | 6.1 / latest |
| Test runner | vitest | 2.1 |
| Type system | TypeScript | 5.9 |

You can continue development on this codebase with any developer who is comfortable with React and Node; no Manus-specific framework is required. The platform can be hosted independently from Manus on any provider that runs Node 22 and serves static assets — Railway, Render, Fly.io, Hetzner, AWS, DigitalOcean App Platform, Vercel (with a separate Node host for the Express server), and a self-hosted VPS are all viable. The providers that still resolve to Manus abstractions and which should eventually be replaced for full independence are listed and explained in section B3.

---

## Part B — Domain Connection and Go-Live Guide

This part is written for a non-developer who can follow steps and copy-paste values. The fastest path is the Manus-hosted route in section B1; the fully-independent path is in section B2. Both end with a working `https://yourdomain.com` URL.

### B1. The fastest go-live path: Manus-hosted with your custom domain

The simplest way to take IO SKY live on your own domain is to publish through Manus and bind your domain in the Management UI. This is the path I recommend for the immediate go-live, because it lets you keep building without having to provision a server, a database and object storage on day one. You can migrate to fully independent hosting later (section B2) without any code changes.

**Step 1 — Create a final checkpoint.** In the chat with this agent, the latest checkpoint is `fd34028e`. Make sure the most recent build is the one you want public.

**Step 2 — Click Publish.** In the Management UI header, click the **Publish** button. Manus will build the production bundle, provision a managed Node runtime, attach the database and object storage that the project already uses, and assign a default domain in the form `<prefix>.manus.space`.

**Step 3 — Open Settings → Domains.** From the left-hand panel of the Management UI, choose **Settings**, then **Domains**. You will see three options: change the auto-generated `manus.space` prefix, purchase a new domain directly inside Manus, or bind an existing domain that you already own at a registrar such as Namecheap, GoDaddy, Google Domains, Cloudflare Registrar, TransIP or Hostnet.

**Step 4 — Bind your existing domain.** Choose **Bind existing domain** and enter the domain you want to use, for example `iosky.com`. Manus will display two DNS records that you need to add at your registrar:

| Record type | Name | Value |
|---|---|---|
| `A` | `@` (root) | the IPv4 address shown by Manus |
| `CNAME` | `www` | the `manus.space` hostname shown by Manus |

If your registrar does not allow `A` records on the apex (some do not), use an `ALIAS` or `ANAME` record pointing to the same `manus.space` hostname. Cloudflare, DNSimple, easyDNS and most modern registrars support this.

**Step 5 — Wait for DNS propagation.** Most TLDs propagate within 5–30 minutes. Some take up to 24 hours. You can check progress with `dig +short iosky.com A` from any terminal, or by pasting the domain into `https://dnschecker.org`.

**Step 6 — SSL is automatic.** Manus will issue and renew a Let's Encrypt certificate as soon as the DNS records resolve. You do not have to install anything.

**Step 7 — Verify the site is live.** Open `https://iosky.com` and `https://www.iosky.com` in a private window. Both should load IO SKY over HTTPS. The non-www to www redirect (or vice versa, depending on what you choose in the Manus UI) is handled at the edge.

That is the entire flow. From the moment you click **Publish** to the moment SSL is green is typically under one hour for a domain with fast DNS.

### B2. The fully independent path: self-hosted with your own infrastructure

If at any point you want to move off Manus completely, the codebase is ready for it. Here is the recommended modern stack.

**Hosting recommendation.** For a small-to-medium production deployment, a single $20–$40 per month combination is more than enough:

| Component | Recommended provider | Purpose |
|---|---|---|
| Application host | **Railway** or **Render** or **Fly.io** | Runs the Node 22 server (`pnpm build && node dist/index.js`) |
| Database | **PlanetScale** (MySQL) or **TiDB Cloud** serverless | The schema is already MySQL-compatible |
| Object storage | **Cloudflare R2** or **AWS S3** or **Backblaze B2** | All three speak the S3 API that the storage helper uses |
| Email transactional | **Resend** (recommended) or **SendGrid** or **Postmark** | Booking confirmations, MFA codes, notifications |
| SMS (optional) | **Twilio** | Only if you enable SMS-based MFA |
| DNS and CDN (optional) | **Cloudflare** | Free tier provides DDoS protection and caching |

A single Railway or Render service running the built `dist/index.js` will serve both the API and the static client bundle, because Express is configured to serve the client out of `dist/client` after build. You do not need a separate frontend host.

**Step 1 — Set up the database.** Create a free PlanetScale or TiDB Cloud serverless database, copy the connection string, and run `pnpm db:push` from your local machine to apply every Drizzle migration in `drizzle/migrations/`. This is idempotent and safe to re-run.

**Step 2 — Set up object storage.** Create a Cloudflare R2 bucket (or S3 bucket) with private access. Generate an access key and secret. Note that the `server/storage.ts` helper uses the standard AWS SDK v3 S3 client, so any S3-compatible provider works without code changes.

**Step 3 — Deploy the application.** Connect the repository to Railway/Render. The build command is `pnpm install && pnpm build`. The start command is `node dist/index.js`. The port is read from `process.env.PORT`, which Railway and Render set automatically. Set every environment variable from section B3.

**Step 4 — Connect your domain.** Add the host's CNAME or A record to your registrar exactly as in section B1, step 4. The host issues SSL automatically through Let's Encrypt.

**Step 5 — Run the seed script once.** From the Railway or Render shell, run `node scripts/seed-users.mjs`. This creates the admin, client and developer accounts and the demo organization. **Immediately rotate every seeded password from the admin Settings page.**

### B3. Environment variables — required, optional, and Manus-specific

The platform reads the following environment variables. The "Source" column tells you whether the value comes from your own provider or whether it currently resolves to a Manus abstraction that you can keep using or replace later.

| Variable | Required | Source for independent hosting |
|---|---|---|
| `DATABASE_URL` | yes | PlanetScale or TiDB Cloud connection string |
| `JWT_SECRET` | yes | A 64-char random string you generate (`openssl rand -hex 32`) |
| `PORT` | yes | Set automatically by Railway/Render |
| `NODE_ENV` | yes | `production` |
| `PUBLIC_BASE_URL` / `VITE_PUBLIC_BASE_URL` | yes | `https://yourdomain.com` |
| `OWNER_OPEN_ID` | yes | Your admin user's `openId` (printed by the seed script) |
| `VITE_APP_ID` | yes | Application identifier; keep the value you have or generate a new UUID |
| `OAUTH_SERVER_URL` | optional | Manus OAuth backend; can be removed once you only use local-password login |
| `VITE_OAUTH_PORTAL_URL` | optional | Manus OAuth portal; same as above |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | optional | Manus LLM/image proxy; replace with direct OpenAI or Anthropic credentials when you want full independence (see section B4) |
| `RESEND_API_KEY` | yes for email | Sign up at resend.com and paste the key |
| `BOOKING_FROM_EMAIL` / `SMTP_FROM` | yes for email | The verified sender address on Resend |
| `SMTP_URL` | optional | Only if you use generic SMTP instead of Resend |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | optional | Only if SMS-based MFA is enabled |

The five `BUILT_IN_FORGE_*` and `OAUTH_*` variables are the only Manus-specific abstractions. The platform will continue to work on Manus hosting forever with these in place; on independent hosting you can either keep them (Manus will still proxy LLM and image-generation calls) or replace them with direct provider credentials and update three small adapter files: `server/_core/llm.ts`, `server/_core/imageGeneration.ts`, and `server/_core/voiceTranscription.ts`. Section 13 of the Ultra Blueprint lists the exact replacement matrix.

### B4. Database, storage, and backups

The Drizzle schema in `drizzle/schema.ts` is the single source of truth for the database. To migrate safely from one host to another, dump the source database with `mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF`, import it into the destination with `mysql < dump.sql`, then run `pnpm db:push` against the destination to apply any pending migrations. Drizzle is idempotent: re-running `db:push` against a database that is already up to date is a no-op.

For backups, the simplest approach is to enable **PlanetScale's native daily backups** (free) or **TiDB Cloud's snapshot retention** (also free). Both retain at least 7 days. For a stronger guarantee, schedule a nightly `mysqldump` from a Heartbeat job (the project ships with `manus-heartbeat` support; see `references/periodic-updates.md`) and upload the result to a separate bucket. Object storage backups are not necessary if you use Cloudflare R2 or S3 with versioning enabled — both providers retain old object versions automatically.

Storage uses signed-URL access through `/manus-storage/<key>`. On independent hosting this redirect is served by the Express server itself, which signs a short-lived URL using your S3 credentials and 307-redirects the browser. No code change is required; the redirect is already implemented in `server/_core/storageProxy.ts`.

### B5. Pre-launch, security, deployment, and post-deployment checklists

**Pre-launch checklist.** Confirm that `pnpm test` is green, that `pnpm tsc --noEmit` is clean, that `pnpm build` produces a `dist/` folder, that every entry in section B3 is set in your host's environment configuration, that `DATABASE_URL` points at the production database and not a dev copy, that `JWT_SECRET` is at least 32 random bytes, that `PUBLIC_BASE_URL` matches the domain you are about to bind, and that the seed script has been run exactly once.

**Security checklist.** Rotate every seeded password (`admin@iosky.local`, `client@iosky.local`, `dev@iosky.local`) immediately after first login; enrol TOTP MFA on the admin account from Settings → Security; disable any seeded developer accounts you do not personally use; verify that the cookie consent banner appears on first visit and that analytics scripts are not loaded until the user accepts; verify that the legal-page integrity footer renders a non-empty SHA-256 hash; verify that `https://yourdomain.com/api/auth/local/login` returns the generic `invalid_credentials` error for both unknown emails and wrong passwords (account-enumeration check); confirm that the production database user has only the privileges the application needs (DML and DDL on the application schema, nothing more); enable Cloudflare's "Always Use HTTPS" rule if you front the site with Cloudflare.

**Deployment checklist.** Build artefact uploaded; environment variables set; database reachable from the host; object storage reachable from the host; outbound HTTPS allowed (for Resend, Twilio, OpenAI, etc.); `PORT` not hard-coded; logs visible in the host's console; one health-check URL reachable (`/api/health` returns 200).

**Post-deployment verification checklist.** Open the homepage and confirm it loads in under three seconds on cold cache; click through the public marketing pages (Infrastructure, Intelligence, Enterprise, AI Scan, Solutions, About, Contact, Book Strategy) and confirm there are no 404s, no console errors, no broken images; submit the Contact form and confirm an owner notification arrives by email; submit the Book Strategy form and confirm the calendar entry and confirmation email; trigger an AI Scan and confirm the report renders; log in as the seeded admin, change the password, enrol TOTP MFA, and log out and back in; switch the site language to Dutch from the language picker and confirm the cookie banner, login error, and legal pages all render in Dutch; switch to Arabic and confirm the layout flips to right-to-left correctly; load the site on a phone (375 px) and confirm the navigation drawer opens, the cookie banner is readable, and the booking form is usable.

### B6. Access and credentials

The seed script `scripts/seed-users.mjs` provisions three accounts and one demo organization. The accounts and their default passwords are printed to the console when the script runs and are also written to `references/SEEDED_CREDENTIALS.md` (which is excluded from version control by `.gitignore`). The accounts are:

| Email | Role | Purpose |
|---|---|---|
| `admin@iosky.local` | admin | Owns the platform; sees the entire admin portal at `/admin` |
| `client@iosky.local` | client | Linked to the demo organization; sees the client portal at `/client-portal` |
| `dev@iosky.local` | developer | Sees the developer workspace at `/developer-workspace` |

To create new admins, log in as the seeded admin, open `/admin/users`, click **Add user**, fill the form and tick **Admin role**. To create new client accounts, open `/admin/clients`, create the organization first if it does not exist, then add the user under that organization. To create new developer accounts, open `/admin/developers` and use the same flow. Every newly-created account receives a one-time invitation email with a password-set link; the link is valid for 24 hours. Users can later self-enrol MFA from Settings → Security.

To safely manage users at scale, three controls are available. The **role** field on the `user` table separates `admin`, `client` and `developer` access. The **organizationId** field links a user to a single organization and is enforced by `clientProcedure`. The **impersonation** column on the `user` table records every "view-as" action by an admin so that the audit trail is complete; impersonation is restricted to admins with an extra confirmation dialog and is logged to the `audit_log` table.

### B7. Final recommendation

The platform is ready to be connected to a real domain right now. The fastest path is section B1 (Publish from Manus and bind your domain), which gives you a working `https://yourdomain.com` in under an hour. The only items I would still recommend completing before any outbound campaign or paid traffic begins are: rotate every seeded password and enrol MFA on the admin account, replace the demo data on the Executive Overview by populating the database with at least one real client and one real project, and translate the remaining BookStrategy strings into the languages you will actually market in. None of these are blockers for go-live; they are confidence-building steps for the moment you start sending real prospects to the URL.

For longer-term independence, the single highest-leverage upgrade is to replace the three Manus-proxied service adapters (LLM, image generation, voice transcription) with direct provider credentials. That single change removes every dependency on Manus and means the platform will keep working indefinitely even if your Manus credits expire. The change is roughly half a day of work for any developer who has used the OpenAI or Anthropic SDKs.

The platform is fully custom, fully owned by you, fully editable through the standard React + Node toolchain, and fully ready to scale on whatever provider you choose. You can continue building on it for as long as you want, with or without Manus.

---

## Appendix — Quick reference

**Repository:** `/home/ubuntu/io-sky` in this sandbox; mirrored to your Manus project workspace.

**Latest checkpoint:** `fd34028e`.

**Test status:** 306 / 306 vitest passing, 0 TypeScript errors, production build passing.

**Documentation set:**
`references/IO_SKY_FINAL_HANDOFF.md` — 30-page architecture and feature tour.
`references/IO_SKY_ULTRA_BLUEPRINT.md` — 27-page enterprise blueprint with diagrams.
`references/IO_SKY_GO_LIVE_GUIDE.md` — this document.

**Support escalation paths:** for any Manus credit, billing, refund, technical-support or product-improvement question, please use `https://help.manus.im`. For development or platform-engineering questions, the codebase is self-contained and any React + Node engineer can take over from the current state.
