# IO SKY — Domain Binding Handbook

**Audience:** The IO SKY owner connecting a production domain to the deployed site.
**Goal:** Take the site from its auto-generated `*.manus.space` address to a custom domain (e.g. `iosky.com`) safely, with working OAuth and HTTPS.
**Last updated:** 2026-06-03

---

## 1. Before you start

| Prerequisite | Why |
| --- | --- |
| A saved checkpoint | Publishing requires a checkpoint; it is also your rollback point. |
| The site published at least once | Domain binding operates on a published deployment. |
| Access to your domain registrar's DNS | You will add or update DNS records. |
| Launch-cleanup complete | See `IO_SKY_STAGING_OPERATIONS.md` — neutralise seeded accounts and disable staging before pointing a public domain at the site. |

> **Architecture note:** the app never hardcodes its domain. The frontend derives every absolute URL (including the OAuth redirect) from `window.location.origin`, and the backend reconstructs the origin from the OAuth `state`. This means a new domain works immediately after binding — there is no code change and no redeploy required for auth to keep functioning.

---

## 2. Three ways to set the domain (Manus Settings → Domains)

All domain operations happen in the project's **Settings → Domains** panel.

### Option A — Change the free subdomain prefix
Fastest option. Change `your-prefix.manus.space` to a cleaner prefix. No registrar work, HTTPS is automatic. Good for a soft launch.

### Option B — Buy a new domain inside Manus
Purchase a domain directly in the Domains panel. Registration, assignment, DNS, and certificate issuance are handled end-to-end inside the platform. This is the lowest-friction path to a fully custom domain.

### Option C — Bind a domain you already own
Connect an existing domain from any registrar:

1. In **Settings → Domains**, choose **Add / bind existing domain** and enter your domain (apex `iosky.com` and/or `www.iosky.com`).
2. The panel shows the exact DNS records to create. Typically:
   - An **apex** record (an `A`/`ALIAS`/`ANAME` per the panel's instructions) for `iosky.com`.
   - A **`CNAME`** for `www` pointing to the target shown in the panel.
   - Any **verification** record (e.g. a `TXT`) the panel requests.
3. Add those records at your registrar's DNS manager exactly as shown.
4. Return to the panel and wait for verification. DNS propagation can take minutes to a few hours.
5. HTTPS certificates are provisioned automatically once verification succeeds.

---

## 3. Recommended DNS layout

| Host | Type | Value | Notes |
| --- | --- | --- | --- |
| `iosky.com` (apex) | as instructed by panel | platform target | Apex/root domain |
| `www` | CNAME | platform target | Redirects/serves the same app |
| verification host | TXT | token from panel | Only if requested |

> Choose **one** canonical host (apex or `www`) and redirect the other to it for consistent links and analytics. The Domains panel will indicate the canonical option.

---

## 4. Post-binding verification checklist

- [ ] `https://iosky.com` loads the site with a valid certificate (padlock, no warnings).
- [ ] `https://www.iosky.com` resolves and redirects to the canonical host.
- [ ] **OAuth login works on the new domain** — sign in and confirm you land back on `https://iosky.com/...` (not the old `*.manus.space`). Because the redirect is derived from `window.location.origin`, this should work without any change.
- [ ] **Booking / contact / engineering forms** submit and the confirmation email arrives.
- [ ] **AI Scan** completes and the result page + PDF download work.
- [ ] Open in a private window to confirm the **staging gate is off** (if you intend the site to be public).
- [ ] Update any external references (email signatures, social links once added) to the new domain.

---

## 5. Common pitfalls

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Certificate warning | DNS not fully propagated or verification pending | Wait, then re-check the Domains panel status. |
| OAuth returns to old domain | You are testing from a bookmarked `*.manus.space` URL | Start the login from the new domain so `origin` is correct. |
| `www` works but apex doesn't (or vice-versa) | Missing one of the records | Add the missing apex/`www` record per the panel. |
| Site still shows the pre-launch gate | `STAGING_MODE` still `on` | Remove it and restart (see Staging Operations §1). |

---

## 6. Rollback

Domain binding does not alter application code, so there is nothing to roll back in the repo. If a binding is misconfigured, remove or re-enter the records in **Settings → Domains**; the free `*.manus.space` address always remains available as a fallback.
