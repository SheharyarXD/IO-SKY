# Cookie Policy

**Version:** 1.0
**Effective from:** 2026-05-25
**Document kind:** `cookie-policy`
**Controller:** IO SKY B.V., Amsterdam, the Netherlands.

This Cookie Policy explains how IO SKY uses cookies and comparable browser-storage technologies (localStorage, sessionStorage, indexedDB) on the IO SKY platform. It complements our [Privacy Policy](/privacy).

---

## 1. What is a cookie?

A cookie is a small text file placed on your device by the websites you visit. Cookies allow a site to recognise you, remember preferences, secure a session, measure performance, or deliver relevant content. Some technologies that are not strictly "cookies" (localStorage, sessionStorage, pixels, web beacons) serve similar purposes and are covered by this policy.

Under the ePrivacy directive and the Dutch Telecommunicatiewet, cookies that are **not strictly necessary** for the service you have requested may only be set after you have given **freely-given, specific, informed and unambiguous consent**.

---

## 2. Categories of cookies we use

The IO SKY consent banner offers three categories. Functional cookies are always active because the Platform cannot function without them. Analytics and marketing cookies are off by default.

### 2.1 Functional cookies (always active, no consent required)

| Cookie / storage key | Purpose | Lifetime |
|---|---|---|
| `io_sky_session` | Authenticated session JWT | 24 hours rolling |
| `io_sky_mfa_pending` | Short-lived cookie issued during MFA challenge | 10 minutes |
| `io_sky_csrf` | CSRF protection token | Session |
| `io_sky_consent_id` | Anonymous identifier used to record your cookie choices | 24 months |
| `io_sky_consent_state` | Stores your current consent decision in the browser | 24 months |
| `io_sky_lang` | Selected interface language | 12 months |
| `io_sky_tz` | Detected timezone for booking | Session |
| `io_sky_theme` | Light or dark mode preference | 12 months |
| `view_as_token` | Admin impersonation cookie (audited) | 30 minutes |

### 2.2 Analytics cookies (off by default, opt-in)

We use first-party, privacy-preserving analytics to measure platform health (page load times, error rates, route popularity). We do not use Google Analytics. We do not build behavioural advertising profiles.

| Cookie / storage key | Purpose | Lifetime |
|---|---|---|
| `io_sky_analytics_id` | Pseudonymous identifier for aggregated metrics | 12 months |
| `io_sky_perf_session` | Per-session performance bucket | Session |

### 2.3 Marketing cookies (off by default, opt-in)

We do not currently set any marketing cookies on the IO SKY platform itself. If we add a marketing partner in the future, we will update this list and re-prompt you for consent.

---

## 3. How to manage your choices

* Use the **cookie banner** that appears on your first visit. You can accept all, reject all, or open **Manage preferences** to toggle each category individually.
* Click **Manage cookie preferences** in the footer to change your decision at any time.
* Your decision is recorded in the `cookie_consents` table together with a timestamp, IP address, user agent and the version of this Cookie Policy. Each change is audit-logged.
* Most browsers also allow you to refuse or delete cookies via their settings. Be aware that disabling functional cookies will break login and MFA.

---

## 4. Third parties

The IO SKY platform itself does not embed third-party advertising or social-media tracking pixels by default. The following first-party technologies may include subprocessor-managed cookies on our behalf:

* **Stripe Checkout** — payment session cookies, only when you are on a checkout page.
* **Manus OAuth** — temporary state cookies on the OAuth domain during login.

These are functional and required for the corresponding service to work.

---

## 5. Changes

We will publish a new version of this Cookie Policy when we add, remove or materially change cookies. The version history is visible at [`/legal/cookies/history`](/legal/cookies/history).

---

## 6. Contact

* privacy@io.sky for cookie and consent questions.
* legal@io.sky for legal matters.
