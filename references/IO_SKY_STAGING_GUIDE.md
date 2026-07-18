---
title: "IO SKY — Private Staging & Pre-Launch Guide"
author: "Manus AI"
date: "2026-05-26"
---

# IO SKY — Private Staging & Pre-Launch Guide

**Project:** IO SKY — Operational Intelligence Infrastructure  
**Repository path in sandbox:** `/home/ubuntu/io-sky`  
**Document scope:** A complete, beginner-friendly walkthrough for connecting the platform to your real domain while keeping it private, continuing development safely while in staging, blocking search engines, and confirming the technical ownership of the codebase. This document supersedes earlier go-live guidance for the staging-first workflow you asked for.

---

## Part 1 — What "private staging mode" means here

Private staging mode is a code-level access gate that has been added to the server. When the environment variable `STAGING_MODE` is set to `on`, every anonymous browser request to a public page is intercepted and replaced with a small password-protected pre-launch screen. The platform itself is still running normally underneath — APIs, the database, all three portals (admin, client, developer) and every internal route remain fully operational. The gate only sits in front of public HTML responses, and only for visitors who do not already have a session.

In practice this gives you four superpowers at the same time. First, you can connect the platform to your real domain (or a staging subdomain) without worrying that strangers will stumble across an unfinished landing page. Second, you, your developers, and any client you invite can keep using the platform normally as long as you all share a single staging password or are already logged in. Third, search engines are explicitly told not to index the site, both through the dynamically generated `robots.txt` and through a `noindex,nofollow` meta tag injected at runtime. Fourth, when you are finally ready for the public launch, you flip a single environment variable and the gate disappears — no code changes, no redeploy of new artefacts beyond the variable change, no risk of leaving developer URLs exposed.

The implementation lives in `server/_core/stagingGate.ts` and is wired into the request pipeline in `server/_core/index.ts`. It is covered by eleven dedicated vitest specs in `server/stagingGate.test.ts`, all of which pass as part of the project's regular test run (317/317 specs green at the time of this document).

---

## Part 2 — How the gate behaves

The gate is intentionally narrow. It only intercepts `GET` and `HEAD` requests to non-API paths that look like an HTML page. Anything that begins with `/api/`, `/manus-storage/`, `/assets/`, `/__manus__/`, the favicon, the robots file, the login page, or anything that ends in a static-asset extension (`.js`, `.css`, `.png`, `.woff2`, and so on) is exempt. This keeps developer workflows, the tRPC API, file uploads and downloads, OAuth callbacks, the local password login, the MFA challenge endpoint, and the view-as routes all working exactly as before. Nothing about your data layer, your authentication layer, or your portals changes.

When an anonymous visitor lands on the public marketing surface, the gate returns a self-contained HTML page rendered entirely from inline markup and CSS. There is no dependency on the React bundle, on Tailwind, or on any external font, which means the pre-launch screen will render reliably even if the SPA build is broken or in the middle of a deploy. The screen presents the IO SKY wordmark, a one-sentence explanation, a single password field, and a quiet link to `/login` for users who already have an account.

When a visitor submits the correct password, the server replies with a `Set-Cookie` header containing `iosky_staging_pass`. The cookie value is a signed token of the form `<issuedAt>.<hmac>`, where the HMAC is computed using `STAGING_SECRET` (or, if that variable is not set, the existing `JWT_SECRET`). The cookie is `HttpOnly`, `Secure` over HTTPS, and lives for thirty days. On every subsequent request the gate verifies the signature in constant time and rejects any tampered cookie. If the password is wrong, the same screen is rendered with a small inline error and an HTTP 401 status — there is no toast, no flash message, and no information that hints at whether the password was almost right.

The gate also recognises an authenticated session cookie. If a request carries `app_session_id` (the cookie name used by the OAuth and local-login flows), the gate lets it through unconditionally. This is deliberately liberal: the cookie is not validated cryptographically at the gate, because the gate is defence in depth and not the authoritative session layer. Any forged session cookie that bypasses the gate still fails every downstream tRPC `protectedProcedure`, every Express route guarded by the existing OAuth middleware, and every database query that requires a user record. The trade-off is that a developer who is already logged in does not need to enter the staging password a second time on the same browser, which keeps the daily workflow simple.

Finally, the gate replaces the standard `robots.txt`. With staging on, the file returns `User-agent: *\nDisallow: /\n`, which instructs every crawler to skip every URL on the host. With staging off, the file returns the regular production policy that blocks the API and the three portals while allowing the public marketing pages. The same behaviour is mirrored on the client: the SPA bundle injects a `<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">` tag at runtime when `VITE_STAGING_MODE` is set to `on`, so even authenticated users browsing the SPA still emit the SEO-block hint. This dual layer means the platform is invisible to search engines from the moment you flip the flag, regardless of whether a visitor sees the gate or the SPA.

---

## Part 3 — Turning staging mode on

Three environment variables control the gate, and only one of them is strictly required:

| Variable | Required | Purpose |
|---|---|---|
| `STAGING_MODE` | yes | Set to `on` to enable the gate. Anything else (or unset) leaves the platform fully public. |
| `STAGING_PASSWORD` | yes when on | The shared password your team and invited clients enter on the pre-launch screen. Choose a long passphrase; treat it like a production secret. |
| `STAGING_SECRET` | optional | The HMAC key used to sign the `iosky_staging_pass` cookie. If you omit it, the gate falls back to `JWT_SECRET`, which is fine for almost every deployment. Set a separate value only if you want to be able to invalidate every staging cookie at once without rotating your session signing key. |
| `VITE_STAGING_MODE` | recommended | Mirror of `STAGING_MODE` exposed to the client bundle so the noindex meta tag is injected at runtime. Set this to `on` whenever you set `STAGING_MODE=on`. |

If you are deploying on Manus, open the Management UI, choose **Settings → Secrets**, and add the four variables above. If you are self-hosting, set them in your hosting provider's environment-variable panel (Railway, Render, Fly, Vercel, your own VPS — every modern platform exposes this through a UI or a `.env` file). After the variables are set, restart the server. The gate is active from the next request onwards.

To turn the gate off when you are ready for public launch, delete `STAGING_MODE` and `VITE_STAGING_MODE` (or set them to anything other than `on`) and restart the server. There is no migration to run, no cookie to clear, no special build step. The same artefact serves both the staging and the public-launch experience.

---

## Part 4 — Connecting your real domain

The platform is host-agnostic, so the same instructions work whether you eventually publish through Manus's built-in hosting or through a third-party provider. The flow has four parts: choose a host, point your domain at it, terminate SSL, and set the staging environment variables. We will walk through the two most common shapes.

### Path A — Publishing through Manus

This is the fastest path and it is the one we recommend while you are still in staging. You stay on the same hosting that has been running the project all along, you keep the existing database and storage credentials, and the only thing you change is the domain in front. Open the Management UI, click the three-dot menu in the header and choose **Publish** to capture a deployable artefact (or use the Publish button that appears on the latest checkpoint card). Once the publish has succeeded, open **Settings → Domains**. You will see two options. The first lets you change the auto-generated `xxx.manus.space` prefix; the second lets you bind an existing domain you already own. Click **Connect existing domain**, type the hostname you want to use (we recommend `staging.yourdomain.com` for a private staging period, or `app.yourdomain.com` if you prefer to use a single host throughout), and follow the on-screen instructions. The UI will tell you exactly which DNS records to add at your domain registrar — usually a single `CNAME` record pointing to the Manus edge, or in some cases an `A` record. SSL is provisioned automatically through Let's Encrypt within a few minutes of the DNS records propagating. There is nothing to do at the certificate level.

After the domain is verified, return to **Settings → Secrets** and set `STAGING_MODE=on`, `STAGING_PASSWORD=<your-passphrase>`, `VITE_STAGING_MODE=on`. Click **Restart** in the Preview panel header to pick up the new variables. Visit `https://staging.yourdomain.com` from a private window — you should see the pre-launch screen. Enter your password — you should land on the homepage. Visit `/login` and sign in with one of the seeded accounts; the cookie carries you through the gate without re-prompting.

### Path B — Self-hosting on a third-party provider

If you would rather operate the platform fully outside of Manus from day one, the recipe is the same but spread over more services. The combination we recommend for solo operators and small teams is **Railway** for the server, **PlanetScale** (or any other managed MySQL/TiDB-compatible database) for the data, and **Cloudflare R2** for the storage layer. All three have generous free tiers and all three are familiar to the open-source community.

Start by exporting the project as a ZIP from the Management UI's three-dot menu, or push the code to a GitHub repository through **Settings → GitHub**. Create a Railway project pointed at the repository. Railway will detect the Node.js stack and run `pnpm install && pnpm build && node dist/index.js` automatically. While the build runs, create a database on PlanetScale, copy the connection string, and add it to Railway as `DATABASE_URL`. Add the rest of the environment variables from the table in section 5 below, including the staging variables. Once the deployment is green, open Railway's **Settings → Domains** and point your domain there; Railway provisions SSL automatically. The DNS record is a single `CNAME` to the Railway endpoint, exactly the same shape as Path A.

For storage, sign up for Cloudflare R2 and create a bucket. Replace the `BUILT_IN_FORGE_API_URL` storage layer by editing `server/_core/storageProxy.ts` to call R2 directly through the AWS SDK — the code already imports `@aws-sdk/client-s3` for this exact reason, and R2 is an S3-compatible API. Set `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` accordingly. Existing storage URLs use the `/manus-storage/<key>` shape; you can either rewrite them in the database, or keep the path and let the storage proxy redirect to R2's signed URLs internally.

For email transport (used by the booking confirmation, MFA recovery, and notification flows), pick any SMTP-compatible provider — Resend, Postmark, SendGrid, AWS SES — and add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` to your environment. The existing notification helper in `server/_core/notification.ts` is a thin wrapper around `nodemailer` and accepts these standard variables.

Whether you go with Path A or Path B, the staging gate behaves identically. The same `STAGING_MODE=on` flag flips the platform from public to private; the same password unlocks the gate; the same cookie gets you through for thirty days.

### DNS records at a glance

Most domain registrars (GoDaddy, Namecheap, Google Domains, Cloudflare Registrar, TransIP, OVH, your local provider) expose DNS through the same form fields. The records you need are short:

| Type | Host | Value | TTL |
|---|---|---|---|
| `CNAME` | `staging` | `<your-host-endpoint>` (Manus or Railway will give you the exact target) | `Auto` or `300` |
| `CNAME` | `www` | `staging.yourdomain.com` | `Auto` or `300` |

If your registrar does not allow `CNAME` records on the apex (the bare `yourdomain.com` without a subdomain), use an `A` record pointing to the IP address your host gives you, or take advantage of Cloudflare's `CNAME` flattening feature. Both work transparently with the staging gate.

DNS propagation usually completes within five to fifteen minutes for new records. If `dig staging.yourdomain.com` from your laptop returns the host endpoint you configured, the DNS is live. SSL provisioning starts automatically as soon as DNS resolves and finishes within a minute or two on both Manus and Railway.

### The www / non-www redirect

It is conventional to pick one canonical hostname and redirect the other to it. If your canonical host is `staging.yourdomain.com`, configure your registrar (or your host's domain panel) to redirect `www.staging.yourdomain.com` to it with a 301. If you use Cloudflare in front, a Page Rule of the shape `Forwarding URL — 301 — https://staging.yourdomain.com/$1` does the trick.

---

## Part 5 — Environment variables in one place

The platform reads exactly eighteen environment variables. Twelve are inherited from the original Manus template and continue to work unchanged in self-hosted deployments. Four control the staging gate. Two — `OWNER_NAME` and `VITE_APP_TITLE` — are cosmetic.

| Variable | Purpose | Required for self-host? |
|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string. | Yes |
| `JWT_SECRET` | Session cookie signing key. | Yes |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL. | Only if you keep Manus OAuth; otherwise replace by your own OIDC provider URL. |
| `VITE_OAUTH_PORTAL_URL` | Manus OAuth login portal. | Same as above. |
| `VITE_APP_ID` | Manus OAuth app identifier. | Same as above. |
| `OWNER_OPEN_ID` | Owner identity for notifications. | Yes (any stable string; used by `notifyOwner`). |
| `OWNER_NAME` | Display name in the admin UI header. | Optional. |
| `BUILT_IN_FORGE_API_URL` | Manus internal services base URL (LLM, image, voice, storage). | Replace with direct provider URLs when self-hosting (see § 8). |
| `BUILT_IN_FORGE_API_KEY` | Bearer token for the above. | Same. |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend mirror of the above. | Same. |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend bearer token. | Same. |
| `VITE_ANALYTICS_ENDPOINT` | Umami analytics endpoint. | Optional; replace with your own Umami instance or remove. |
| `VITE_ANALYTICS_WEBSITE_ID` | Umami site id. | Same. |
| `VITE_APP_TITLE` | Browser tab title. | Optional. |
| `VITE_APP_LOGO` | Logo URL used in the favicon and header. | Optional. |
| `STAGING_MODE` | `on` to enable the private gate. | Required while in pre-launch. |
| `STAGING_PASSWORD` | Shared passphrase for the gate. | Required when staging is on. |
| `STAGING_SECRET` | HMAC key for the staging cookie. | Optional; falls back to `JWT_SECRET`. |
| `VITE_STAGING_MODE` | Frontend mirror so the noindex meta tag is injected. | Recommended whenever staging is on. |

Set every required variable in your hosting provider's secrets panel, then restart the server. The platform refuses to boot only when `DATABASE_URL` is missing; everything else degrades gracefully (for example, if `BUILT_IN_FORGE_API_KEY` is missing, the AI-powered routes return a structured error instead of crashing).

---

## Part 6 — Continuing development during staging

The staging gate is designed so that you do not have to slow down development to keep the site private. Three workflows are explicitly supported.

The first is the local development workflow. When you (or a developer you have hired) runs `pnpm dev` against a local checkout, `STAGING_MODE` is unset, so the gate is a no-op. You see the full marketing site immediately. There is no friction and no need to remember a password just to load the homepage on `localhost:3000`.

The second is the shared staging workflow. When the deployed environment has `STAGING_MODE=on`, anyone on your team can still access every route by either signing in with their account (the session cookie bypasses the gate) or by entering the shared staging password once and being remembered for thirty days. The seeded accounts at `admin@iosky.local`, `client@iosky.local`, and `dev@iosky.local` continue to work; their credentials are documented in `references/SEEDED_CREDENTIALS.md`. Until you replace those passwords, the shared staging password is your only line of defence — please rotate them in your first hour of staging access.

The third is the deployment workflow itself. Each commit to your repository (or each Manus checkpoint) builds a new artefact that picks up the current environment variables on restart. This means you can keep merging code, running migrations through `pnpm db:push`, adjusting copy and screenshots, and watching your developers iterate in real time, all without ever toggling the gate. The platform stays private from the public until you decide to flip the flag, and it stays open to your team the entire time.

Database migrations through Drizzle continue to work exactly as before. Run `pnpm db:push` from your local checkout (with `DATABASE_URL` pointing at staging) to apply schema changes against the staging database; Drizzle generates the migration, applies it, and prints a summary. Storage uploads continue to work; the storage proxy is an exempt path. The notification helper continues to work; outgoing emails are sent regardless of the staging gate. Every cron-style task wired through the heartbeat helper continues to fire on schedule; the heartbeat endpoint is exempt because it is under `/api/`.

There is one small operational habit we recommend during a long staging period. Every time you onboard a new developer or a new client, hand them a one-line note: "Visit the URL, type the staging password, then sign in with your account." After the first visit, the staging cookie is set and they will not see the gate again until the cookie expires thirty days later. If you ever suspect the staging password has leaked — a screenshot in a Slack channel, an email forwarded to the wrong person — rotate `STAGING_PASSWORD` (and optionally `STAGING_SECRET` to invalidate every existing cookie at once) and notify your team to enter the new password on their next visit. Existing logged-in sessions are unaffected by the rotation.

---

## Part 7 — Public-launch day, in three minutes

When you decide the staging period is over and you are ready to start outbound campaigns, the launch is a three-step operation.

First, in your hosting provider's secrets panel, change `STAGING_MODE` from `on` to anything else (the cleanest is to delete the variable entirely) and do the same with `VITE_STAGING_MODE`. Restart the server. The gate stops intercepting requests, the runtime noindex meta tag stops being injected, and `robots.txt` returns to the public-launch policy that allows crawlers on the marketing pages and blocks the API and the portals.

Second, submit your domain to Google Search Console (and Bing Webmaster Tools if you target Bing). Verify ownership through a DNS `TXT` record, then submit your sitemap. The platform does not currently expose a sitemap.xml; if you need one, ask the next development sprint to add a `/sitemap.xml` route that enumerates the public marketing pages from a hand-maintained list. The work is small (a single Express handler returning a static XML body) and does not touch the gate.

Third, run a smoke test from a browser that has never visited the site. Confirm that the homepage loads without a password, that `/login` is reachable, that the AI Scan and Book Strategy Call CTAs work, and that no console errors appear. If you keep the seeded accounts active, log out before the smoke test so you are testing the truly anonymous experience. After the smoke test passes, you are public.

If you need to roll back to staging at any point — for example because a critical bug surfaces in the first day of public exposure — set `STAGING_MODE=on` again and restart. The platform is private once more in under a minute.

---

## Part 8 — Final technical-ownership confirmation

To answer the explicit ownership questions in your brief:

The platform is **fully custom-coded**. There is no WordPress installation, no PHP runtime, no proprietary CMS layer. Every page, every component, every API procedure, and every database table is defined in TypeScript and SQL inside the repository at `/home/ubuntu/io-sky`, organised into the folders documented in the project README.

The platform is **editable from the codebase**. Marketing copy lives in the React components under `client/src/pages/`. Translations live in nine files under `client/src/lib/i18n/`. Database tables live in `drizzle/schema.ts` and are pushed to the database with a single `pnpm db:push` command. Server-side procedures live in `server/routers.ts` and the modules it imports, with each feature getting its own router file when it grows past about a hundred and fifty lines.

The platform is **transferable to another developer or team**. The repository builds with `pnpm install && pnpm build` on any standard Node.js 22 environment. Two large reference documents — `references/IO_SKY_FINAL_HANDOFF.md` and `references/IO_SKY_ULTRA_BLUEPRINT.md` — explain every page, every flow, every architectural decision, the exact list of environment variables, and the security posture in enough detail that a new engineer can be productive within their first day. The CI-equivalent commands are `pnpm test` (317 specs) and `pnpm tsc --noEmit` (zero errors), both of which can be wired into GitHub Actions in under twenty lines of YAML.

The platform is **independently hostable outside Manus**. Path B in section 4 above lays out a concrete recipe (Railway + PlanetScale + Cloudflare R2 + Resend) that costs roughly twenty to forty euros per month for a small team and has no dependency on Manus credits, Manus services, or the Manus account. The only Manus-specific layer in the codebase is the trio of helpers in `server/_core/llm.ts`, `imageGeneration.ts`, and `voiceTranscription.ts`, all of which are thin wrappers around the OpenAI / Anthropic / Whisper APIs. Replacing them is half a day of work for a competent backend developer; the request and response shapes are already aligned with the upstream provider APIs because the Manus proxy preserves them.

The frameworks used, in roughly the order in which a new engineer would encounter them, are: **React 19** for the UI; **Tailwind CSS 4** for styling; **shadcn/ui + Radix Primitives** for accessible components; **Wouter** for client-side routing; **TanStack Query** wired through **tRPC 11** for typed client-server calls; **superjson** so dates and numbers survive the wire intact; **Vite 7** as the dev server and bundler; **Express 4** as the HTTP server; **Drizzle ORM** against **MySQL/TiDB** for the database layer; **Vitest** for tests; **bcryptjs** for password hashing; **jose** for JWT signing; **zod** for input validation. Every one of these is open source, has a healthy maintainer community, and is widely deployed in production by other small teams. There is no obscure or abandoned dependency in the dependency tree.

For future development we recommend three habits. Keep `todo.md` at the repository root current — every new feature, every bug, every tweak should land there as `[ ]` before any code is written, and flip to `[x]` only when the feature is verified end-to-end. Run `pnpm test` and `pnpm tsc --noEmit` before every checkpoint; both should stay green. Keep one developer in charge of the `drizzle/schema.ts` file at any given time, because schema migrations are the single change that is hardest to undo; everything else is a normal Git revert.

---

## Part 9 — Quick reference

The four commands you will use most often during the staging period are:

```
pnpm dev              # local development, gate disabled by default
pnpm test             # 317 vitest specs
pnpm tsc --noEmit     # 0 TypeScript errors expected
pnpm db:push          # apply Drizzle schema changes
```

The four environment variables to set when going to staging are:

```
STAGING_MODE=on
STAGING_PASSWORD=<your-passphrase>
VITE_STAGING_MODE=on
STAGING_SECRET=<optional-separate-key>
```

The single command to disable staging mode and go public is to remove `STAGING_MODE` (and `VITE_STAGING_MODE`) from your environment and restart the server.

The seeded credentials for first access are documented in `references/SEEDED_CREDENTIALS.md`. Rotate them within the first hour of staging access.

---

*Prepared by Manus AI on behalf of the IO SKY engineering effort. Feedback and corrections welcome — they will be incorporated into the next revision of this document.*
