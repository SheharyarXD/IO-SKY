# IO SKY — Technical Overview & Export Notes

**Prepared by:** Manus AI
**Export date:** 27 June 2026
**Source commit:** `1b2ed90332f35f50b84a83bceda43939ead01a6c` (branch `main`, committed 21 June 2026)
**Scope:** Complete platform export — frontend, backend, database schema, integrations, configuration, and migration guidance.

---

## 1. What This Export Contains

This archive is a full copy of the live IO SKY codebase as it exists in the working repository. It is **not** a marketing prototype or a single page; it is the complete operational platform that powers the public website, the AI Scan engine, the booking system, and the three authenticated portals (Admin, Client, Developer).

The export deliberately **excludes** three categories of content so it remains clean, portable, and safe to store:

| Excluded | Reason |
| --- | --- |
| `node_modules/` | Regenerated with `pnpm install`; 641 MB of third-party code adds no value to a backup. |
| `.git/` history | Not required to rebuild or run; reduces archive size and avoids leaking historical secrets. |
| Real secrets (`.env`) | No credentials are included. An `env.example.txt` template lists every variable name with no values. |

Everything required to rebuild and run the platform is present: all source code, the full database schema and migrations, build configuration, package manifests, the dependency lockfile (`pnpm-lock.yaml`), patches, scripts, and documentation.

---

## 2. Architecture at a Glance

IO SKY is a single deployable Node.js application. The Vite-built React single-page app is served as static assets by the same Express server that hosts the tRPC API, so there is one process, one port, and one build artifact in production.

| Layer | Technology |
| --- | --- |
| Framework model | Custom React 19 SPA + Express 4 server (not Next.js) |
| Frontend | React 19, Vite 7, Tailwind CSS 4, shadcn/ui (Radix primitives), Wouter routing, TanStack Query, Framer Motion, Recharts |
| API transport | tRPC 11 over `/api/trpc`, end-to-end typed, Superjson serialization |
| Backend | Node.js 22, Express 4, TypeScript 5.9 (ESM) |
| Database | MySQL 8 / TiDB-compatible, accessed via Drizzle ORM (`mysql2` driver) |
| Object storage | S3-compatible, currently behind a presigned-URL proxy served at `/manus-storage/*` |
| Authentication | In-house email + password (bcrypt) **plus** optional Manus OAuth SSO; JWT session cookie |
| Email | Resend → SMTP → console fallback (auto-selected at runtime via `nodemailer`) |
| SMS (MFA) | Twilio adapter with console fallback |
| AI | OpenAI-compatible chat-completions gateway (deterministic scoring + structured LLM refinement) |
| Internationalisation | Ten locales: `ar, de, en, es, fr, it, ja, nl, pt, zh` (Arabic RTL-aware) |
| Tests | Vitest — 28 server-side test suites |

The codebase is substantial: **75 page components**, **88 reusable components**, **13 feature routers**, **49 database tables**, and **13 applied migrations**.

---

## 3. Application Structure

```
io-sky/
  client/                 React 19 SPA (Vite root)
    src/
      pages/              75 page components (public site, AI Scan, 3 portals)
      components/         88 shared/UI components (shadcn/ui + custom)
      contexts/           Theme + Language providers
      lib/i18n/           10 locale dictionaries
      App.tsx             Wouter route table (all routes wired, no dead-ends)
  server/
    _core/                Framework plumbing (OAuth, context, llm, storage, mfa, env, vite bridge)
    routers/              13 tRPC feature routers (bookings, admin, clientPortal, developer, mfa, aiScans, ...)
    db.ts                 Drizzle query helpers (the operational data layer)
    email.ts              Transactional email + .ics calendar invites
    *.test.ts             28 Vitest suites
  drizzle/
    schema.ts             49 tables (auth, CRM, portals, MFA, booking, legal, AI scans)
    *.sql                 13 migrations
  shared/                 Cross-cutting types + constants (aiScanModel.ts is the AI Scan contract)
  scripts/                Operational scripts
  patches/                pnpm patch for wouter
  docs/, references/      Supporting documentation
```

### Route map (public + authenticated)

The public surface includes Home, About, Solutions (with Growth / Elite / Custom Intelligence sub-pages and proposal request), Infrastructure, Intelligence, Enterprise, Custom Software, Security, Contact, Engineering Access, the AI Scan flow (`/ai-scan`, `/ai-scan/start`, `/ai-scan/result/:token`), the Strategy Call booking flow (`/book-strategy`, plus HMAC-signed `/booking/cancel` and `/booking/reschedule`), and a full set of legal routes. Authenticated areas are the Admin portal (`/admin/*`), Client portal (`/client-portal/*`), and Developer workspace (`/developer-workspace/*`), each protected by role-scoped procedures and an MFA challenge gate.

---

## 4. Stack Answers (Requested Checklist)

| # | Question | Answer |
| --- | --- | --- |
| 1 | Framework | Custom React 19 SPA + Express 4 server (TypeScript ESM). **Not** Next.js. |
| 2 | Frontend stack | React 19, Vite 7, Tailwind 4, shadcn/ui (Radix), Wouter, TanStack Query, tRPC client, Framer Motion, Recharts |
| 3 | Backend stack | Node.js 22, Express 4, tRPC 11, Drizzle ORM, Zod validation |
| 4 | Database | MySQL 8 / TiDB (via `mysql2` + Drizzle). Connection from `DATABASE_URL`. |
| 5 | Storage provider | S3-compatible object storage, currently fronted by a presigned-URL proxy at `/manus-storage/*` |
| 6 | Authentication provider | In-house bcrypt email+password (primary) + optional Manus OAuth SSO; sessions via signed JWT cookie |
| 7 | SMTP / email provider | Resend (preferred) or any SMTP server via `SMTP_URL`; console fallback in dev |
| 8 | File upload provider | Same S3-compatible storage; client POSTs to server, server calls `storagePut` |
| 9 | Hosting assumptions | Single Node process serving SPA + API on one port; MySQL/TiDB + S3 as external services |
| 10 | Environment variables | See `env.example.txt` and Section 6 (names only, never secrets) |
| 11 | Build command | `pnpm build` |
| 12 | Development command | `pnpm dev` |
| 13 | Production command | `pnpm start` (after `pnpm build`) |

### Build / run scripts (from `package.json`)

```jsonc
"dev":    "NODE_ENV=development tsx watch server/_core/index.ts",
"build":  "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
"start":  "NODE_ENV=production node dist/index.js",
"check":  "tsc --noEmit",
"test":   "vitest run",
"db:push":"drizzle-kit generate && drizzle-kit migrate"
```

Production output: Vite emits the SPA to `dist/public`, and esbuild bundles the server to `dist/index.js`. The server serves the static SPA when `NODE_ENV=production`.

---

## 5. Rebuild & Run Procedure

```bash
# 1. Install dependencies (pnpm is the required package manager)
pnpm install

# 2. Provide configuration
cp env.example.txt .env        # then edit .env with real values
#   minimum to boot: DATABASE_URL + JWT_SECRET

# 3. Apply the database schema
pnpm db:push

# 4. Verify the build and tests
pnpm check
pnpm test

# 5a. Develop
pnpm dev

# 5b. Or build + run production
pnpm build
pnpm start
```

The data layer is intentionally tolerant: the Drizzle client is created lazily, so tooling and the build can run without a live database. Local email/password login works as soon as `DATABASE_URL` and `JWT_SECRET` are set — no third-party account is required to authenticate.

---

## 6. Environment Variables (names only)

The complete annotated list lives in `env.example.txt`. Summary by group:

| Group | Variables |
| --- | --- |
| Core | `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT`, `PUBLIC_BASE_URL`, `VITE_PUBLIC_BASE_URL` |
| AI gateway | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` |
| Auth / SSO | `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID`, `OWNER_NAME` |
| Email | `RESEND_API_KEY`, `SMTP_URL`, `BOOKING_FROM_EMAIL`, `SMTP_FROM` |
| SMS / MFA | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Storage (standalone) | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` |
| Staging gate | `STAGING_MODE`, `STAGING_PASSWORD`, `STAGING_SECRET` |
| Analytics | `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` |
| Branding | `VITE_APP_TITLE`, `VITE_APP_LOGO` |

Only variables prefixed `VITE_` are exposed to the browser. Do not place secrets behind `VITE_`.

---

## 7. Database Schema (49 tables)

The schema in `drizzle/schema.ts` groups into clear domains:

- **Identity & auth:** `users` (roles: user / client / developer / admin), `login_audit`, `mfa_factors`, `mfa_recovery_codes`, `mfa_challenges`.
- **CRM & inbound:** `leads`, `contact_submissions`, `dev_applications`, `custom_discovery_sessions`, `ecosystem_click_events`.
- **Booking engine:** `bookings`, `booking_audit`, `booking_slots`, `booking_answers`, `booking_reminders`, `booking_events`, `availability_windows`, `admin_availability`, `calendar_blocks`, `timezone_preferences`.
- **Client portal (multi-tenant):** `organizations`, `organization_memberships`, `client_reports`, `client_recommendations`, `client_projects`, `client_project_milestones`, `client_invoices`, `client_documents`, `client_messages`, `client_notifications`, `client_support_tickets`.
- **Developer workspace:** `developer_profiles`, `developer_access_scopes`, `developer_agreements`, `developer_projects`, `developer_tasks`, `developer_task_assignments`, `developer_project_files`, `developer_submissions`, `developer_messages`, `developer_access_requests`, `developer_audit`, `developer_security_events`, `developer_support_tickets`, `developer_notifications`.
- **AI Scan:** `ai_scans` (questionnaire responses + JSON report payload, lifecycle pending → scoring → ready → failed).
- **Legal & compliance:** `legal_documents`, `agreement_versions`, `agreement_acceptances`, `cookie_consents`, `legal_acknowledgements`.

Multi-tenancy is enforced server-side: client-portal records carry an `organizationId`, and a `clientProcedure` middleware filters by the authenticated user's organisation before any row is returned.

---

## 8. What Is Hardcoded vs. Easily Replaceable

### Hardcoded / intentional defaults

- **Owner auto-promotion.** In `server/db.ts`, `upsertUser` promotes the OpenID matching `OWNER_OPEN_ID` to `role=admin` when no explicit role is supplied. This is the only identity rule baked into code; change it by editing that branch or managing roles via SQL.
- **MFA key derivation.** `server/_core/mfaCrypto.ts` derives the AES-256-GCM envelope key from `JWT_SECRET` via HKDF. Rotating `JWT_SECRET` therefore re-keys MFA secrets as well as invalidating sessions.
- **Public URL fallback.** Email link builders fall back to `https://iosky.com` if `PUBLIC_BASE_URL`/`VITE_PUBLIC_BASE_URL` are unset. Set these explicitly in production.
- **Manus preview hosts.** `vite.config.ts` allow-lists Manus preview domains for the dev server only; this has no effect on production hosting.

### Easily replaceable (provider seams)

Every external dependency is isolated behind a single helper module, so swapping providers is a localised change. The original `INDEPENDENCE_AUDIT.md` (included in the export) documents each diff; the table below summarises.

| Capability | Today | Replace with | How |
| --- | --- | --- | --- |
| LLM / AI | Forge `/v1/chat/completions` | OpenAI / Azure / OpenRouter / Together | Point `BUILT_IN_FORGE_API_URL` + `_KEY` at the OpenAI-compatible endpoint. No code change. |
| Image generation | Forge ImageService | OpenAI Images / Replicate / Stability | Adapt request body in `server/_core/imageGeneration.ts`; signature is provider-agnostic. |
| Storage | Forge presign proxy | Any S3-compatible store | Set `S3_*`; switch `server/storage.ts` + `storageProxy.ts` to the AWS SDK (already installed). `/manus-storage/*` URL shape stays. |
| Maps | Forge maps proxy | Google Maps direct | Set `GOOGLE_MAPS_API_KEY`; load the JS API with the key in `client/src/components/Map.tsx`. |
| Owner notifications | Forge notify endpoint | Email or Slack/Teams webhook | Replace body of `server/_core/notification.ts`; call-sites unchanged. |
| Voice transcription | Forge Whisper | OpenAI Whisper direct | Same endpoint/key swap as LLM. |
| Scheduled jobs | Manus Heartbeat | Linux cron / GitHub Actions / any cron | POST to the `/api/scheduled/*` routes on a schedule. |

### Replacing the five services you asked about

1. **SMTP / email.** Set `RESEND_API_KEY` (preferred) or `SMTP_URL` plus `BOOKING_FROM_EMAIL`. The transport in `server/email.ts` auto-selects Resend, then SMTP, then a console fallback — no code change needed.
2. **Storage.** Set the `S3_*` group and point `storagePut`/`storageGet` (in `server/storage.ts`) and the download proxy (`server/_core/storageProxy.ts`) at the AWS SDK. The frontend keeps using `/manus-storage/*` unchanged.
3. **Database.** Repoint `DATABASE_URL` at any MySQL 8 / TiDB / PlanetScale instance and run `pnpm db:push`. Drizzle is the only data access layer; there is no second ORM to reconcile.
4. **Authentication.** The in-house bcrypt path (`/api/auth/local/login`) is already provider-independent. To replace the optional Manus SSO with Auth0/Clerk/Supabase, leave the `OAUTH_*` vars empty and re-implement `/api/oauth/callback` in `server/_core/oauth.ts`; the session-cookie contract downstream stays the same.
5. **AI provider.** Point `BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY` at any OpenAI-compatible endpoint. The AI Scan engine combines deterministic scoring with a structured LLM call and tolerates transport errors gracefully.

**Estimated total decoupling effort:** roughly one to two developer-days to move entirely off Manus-managed services, after which the platform runs as a standard Node + MySQL + S3 application on any Linux host, Fly.io, Render, Railway, AWS, or a Vercel + managed-database setup.

---

## 9. Deployment Targets

Because production is a single Node process plus two external services (database and object storage), the platform deploys cleanly to:

- Any Linux VM under PM2 or systemd
- Fly.io, Render, Railway, or AWS ECS
- Vercel or similar, paired with a managed MySQL/TiDB and S3-compatible storage

Behind a reverse proxy, trust the forwarding headers so secure-cookie flags are set correctly.

---

## 10. Included Reference Documents

The export retains the project's own engineering documentation, most relevant here:

- `INDEPENDENCE_AUDIT.md` — provider-by-provider migration diffs.
- `ENV_REFERENCE.md` — the canonical environment-variable reference.
- `DEVELOPER_HANDOFF_COMPLETE.md`, `TECHNICAL_INVENTORY.md` — deeper architecture and inventory notes.
- `README.md` — the template/build-loop guide the codebase was scaffolded against.

This `TECHNICAL_OVERVIEW.md` is the single entry point; start here, then follow the links above for depth.
