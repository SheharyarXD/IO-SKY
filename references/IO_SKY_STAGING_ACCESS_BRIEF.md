# IO SKY — Staging Access Brief

_Last updated: 2 June 2026 · Project version (checkpoint): e7f08cfd · Environment: STAGING_

This brief answers the seven operational questions for the private staging period and is the single source of truth for reviewers during pre-launch. Treat every credential in this document as confidential.

---

## 1. Staging URL

**https://3000-i8p7gqdylquere69lc525-9ed8d2f3.us2.manus.computer**

This is the live preview of the current checkpoint. The URL is served by the sandbox dev server; if the sandbox hibernates after a long idle period, the server must be restarted before the URL responds again. For a stable, always-on address you will bind a custom domain later (see the Domain Binding Handbook).

The whole site is behind a private pre-launch gate. The first time an anonymous visitor opens any page they receive a password screen instead of the application.

---

## 2. How to verify the staging gate works

Run this checklist from a clean browser (or a private window with no existing session):

| # | Action | Expected result |
|---|--------|-----------------|
| 1 | Open the staging URL in a fresh private window | A dark **"Private pre-launch"** screen with a single password field appears — not the IO SKY homepage |
| 2 | Open any deep link, e.g. `…/ai-scan` or `…/book-strategy` | The same pre-launch screen appears (the gate covers every page, not just the homepage) |
| 3 | Enter an incorrect password and submit | The page reloads with an **"Incorrect password"** alert and you stay locked out |
| 4 | Enter the correct `STAGING_PASSWORD` and submit | You are redirected to the homepage and can browse normally for ~30 days on that device |
| 5 | Reload the page after unlocking | You stay in — a signed `iosky_staging_pass` cookie remembers your device |
| 6 | View page source on the pre-launch screen | Contains `<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">` and the response carries an `X-Robots-Tag: noindex, nofollow` header |
| 7 | Request `…/robots.txt` | Returns `User-agent: *` / `Disallow: /` (blocks all crawlers while in staging) |

Server-side checks already automated (11 passing specs in `server/stagingGate.test.ts`) confirm: anonymous pages are gated, `/api/*` and static assets are never gated, wrong passwords are rejected (HTTP 401), correct passwords set the cookie (HTTP 302), tampered cookies are rejected, and authenticated sessions bypass the gate.

> **Note on authenticated bypass:** if you are already logged in (admin/client/developer), you will *not* see the pre-launch screen — the gate intentionally lets signed-in sessions through. To see the gate, use a window with no IO SKY session.

---

## 3. Current admin login credentials

Two admin accounts exist:

| Account | Email | Login method | Password | Notes |
|---------|-------|--------------|----------|-------|
| Primary owner | `ioskysolutions@gmail.com` | Google OAuth | _(your Google account)_ | Created via Google sign-in; no local password |
| Local super admin | `admin@iosky.local` | Email + password | `IOSky-Admin-2026!` | Seeded test account — **must be rotated before launch** (see §5) |

To sign in with the local admin: open `…/login`, use the email + password form, and you will be redirected to the admin area after login.

> **Security flag:** `admin@iosky.local` uses a documented, guessable password and a `.local` placeholder address. It is fine for private staging review but is a launch-blocker — it must be rotated or removed before the site goes public (tracked in the QA blocker list).

---

## 4. How to enable MFA on your admin account

**Current limitation (being fixed in this round):** the admin portal does not yet expose an MFA enrollment screen of its own. The MFA engine (TOTP + SMS + recovery codes) is fully implemented and tested, and the enrollment UI currently lives in the Client Security Center and the Developer Security section.

The fix being applied this round adds an **admin Security Center** with the same enrollment dialog so you can:

1. Sign in as admin.
2. Open **Admin → Security → My Account Security**.
3. Click **Enable Authenticator App (TOTP)** — a QR code appears.
4. Scan it with Google Authenticator / 1Password / Authy and enter the 6-digit code to confirm.
5. Store the one-time **recovery codes** shown after enrollment in a safe place.
6. (Optional) Add **SMS** as a backup factor with your phone number.

After enrollment, every future admin login triggers an MFA challenge (`/mfa-challenge`) before the session is granted. Until this admin Security Center ships in this round, MFA can be enrolled through the same engine via the client/developer security surfaces; the final answer in the Developer Handoff will reflect the shipped admin path.

---

## 5. Test accounts that still need to be changed before launch

All three are seeded by `scripts/seed-users.mjs` with known passwords and `.local` addresses:

| Email | Role | Seeded password | Required action before launch |
|-------|------|-----------------|-------------------------------|
| `admin@iosky.local` | admin | `IOSky-Admin-2026!` | Rotate password **or** delete and rely on the Google owner account |
| `client@iosky.local` | client | `IOSky-Client-2026!` | Delete, or convert to a real pilot client with a strong password |
| `developer@iosky.local` | developer | `IOSky-Developer-2026!` | Delete, or convert to a real engineer with a strong password |

In addition, the demo organization is named **"IO SKY Demo B.V."** in the seed data. Because "B.V." implies a registered Dutch legal entity, this label must be changed to a neutral demo name before any external party sees the client portal (tracked as a claims blocker in this round).

Recommendation: keep these accounts during private staging for convenient role testing, then run a single cleanup step (rotate admin, delete the two test accounts, rename the demo org) immediately before flipping `STAGING_MODE` off.

---

## 6. DNS records you will need for your custom domain

When you are ready to move from the sandbox URL to your own domain, you will bind it through the Manus management UI (Settings → Domains). Manus issues the exact values, but the records are of these types:

| Record | Host / Name | Points to | Purpose |
|--------|-------------|-----------|---------|
| `CNAME` | `www` (or your chosen subdomain) | the Manus-provided target hostname | Routes your subdomain to the IO SKY app |
| `A` / `ALIAS` / `ANAME` | `@` (root/apex) | the Manus-provided IP or alias target | Routes the bare domain (`io-sky.io`) — apex handling depends on your DNS provider |
| `TXT` | `@` or a `_manus`-style verification host | a verification token | Proves you own the domain before issuance |
| `CAA` (optional but recommended) | `@` | `letsencrypt.org` | Authorizes the certificate authority that issues your TLS certificate |

TLS/HTTPS certificates are provisioned and renewed automatically once the records resolve — you do not upload certificates manually. Full step-by-step instructions are in the **Domain Binding Handbook**. You requested **no production deploy yet**, so these records are for later reference only.

---

## 7. Confirmation that Google cannot index the staging site

Yes — indexing is blocked at three independent layers while `STAGING_MODE=on`:

1. **No crawlable content.** Every anonymous page request (including search-engine crawlers, which arrive without a session) is intercepted and served the pre-launch HTML, never the real application content. Crawlers literally cannot see the site behind the gate.
2. **`robots.txt` disallow-all.** While staging is on, `…/robots.txt` returns `User-agent: * / Disallow: /`, which instructs compliant crawlers (including Googlebot) not to crawl anything.
3. **`noindex` directives.** The pre-launch page includes `<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">` and the HTTP response carries an `X-Robots-Tag: noindex, nofollow` header, so even if a crawler reached the page it is told not to index it.

These protections are automatically lifted only when `STAGING_MODE` is set to `off` (after public launch), at which point `robots.txt` switches to an allow rule that still blocks `/api/`, `/admin`, `/client-portal`, and `/developer-workspace`.

---

## Operational reminders

- The gate is controlled by two secrets: `STAGING_MODE` (`on`/`off`) and `STAGING_PASSWORD`. Both are managed through the Manus secrets panel, never committed to code.
- To rotate the staging password, update `STAGING_PASSWORD` and existing unlock cookies remain valid (they are signed against `STAGING_SECRET`/`JWT_SECRET`, not the password). To force everyone out, rotate `STAGING_SECRET` as well.
- To open the site to the public, set `STAGING_MODE=off` and restart the server.
