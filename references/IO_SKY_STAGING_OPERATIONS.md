# IO SKY — Staging Operations Manual

**Audience:** IO SKY operators and the engineering owner running the private pre-launch.
**Scope:** How to lock/unlock the staging environment, manage the seeded review accounts, and the launch-cleanup steps that must complete before the site goes public.
**Last updated:** 2026-06-03 (Round 6 hardening pass)

---

## 1. The private staging gate

The platform ships with a built-in pre-launch gate implemented in `server/_core/stagingGate.ts`. It is **off by default** — omitting the environment variable leaves the site fully public.

| Variable | Purpose | Example |
| --- | --- | --- |
| `STAGING_MODE` | Master switch. The gate is active only when this is exactly `on` (case-insensitive). | `on` |
| `STAGING_PASSWORD` | The shared access password reviewers type on the gate screen. | a long, random passphrase |

### Behaviour when `STAGING_MODE=on`

- Every anonymous `text/html` request is intercepted and served the **"Private pre-launch."** gate screen instead of the page.
- Submitting the correct `STAGING_PASSWORD` issues a long-lived signed cookie, after which the visitor browses normally.
- Authenticated users (holding a valid session) and non-HTML assets (API, images) are **not** blocked, so OAuth sign-in and the JSON API keep working for invited accounts.
- Search engines cannot index the site while the gate is active.

### How to lock staging

1. Set `STAGING_MODE=on` and a strong `STAGING_PASSWORD` in the project **Settings → Secrets** panel (or via `webdev_request_secrets`).
2. Restart the server so the env is picked up.
3. Verify: open the site in a private window — you should see the gate screen.

### How to unlock for launch

1. Run the launch-cleanup checklist in section 3 first.
2. Remove `STAGING_MODE` (or set it to any value other than `on`).
3. Restart the server and confirm the site loads publicly with no gate.

> The gate logic is covered by `server/stagingGate.test.ts`, which asserts that with `STAGING_MODE=on` anonymous HTML is blocked and the correct password unlocks access.

---

## 2. Seeded review accounts

To let reviewers exercise every portal during staging, `scripts/seed-users.mjs` creates three convenience accounts with **known passwords**:

| Email | Role | Purpose |
| --- | --- | --- |
| `admin@iosky.local` | admin | Admin Infrastructure portal + Security Center |
| `client@iosky.local` | client | Client Portal |
| `developer@iosky.local` | developer | Developer Workspace |

These accounts also belong to a **demo organisation** (now labelled "IO SKY Demo Organization" — the legal-entity "B.V." suffix was removed in Round 6 so the demo data does not imply a registered company).

> **These accounts are a launch blocker.** They must never reach production with their well-known passwords.

---

## 3. Launch-cleanup checklist (run before going public)

Complete every item below **before** removing `STAGING_MODE`.

- [ ] **Neutralise the seeded test accounts** using the cleanup script (section 4).
- [ ] **Confirm the demo organisation** is either removed or clearly retained as an intentional sample (its label no longer implies a registered entity).
- [ ] **Re-check claims honesty:** the marketing copy uses capability/architecture framing and labelled target outcomes — no fabricated track-record numbers (verified in Round 6).
- [ ] **Confirm sample-data badges** remain on the synthetic admin modules (Security, Campaigns, Agents, Automations, Analytics).
- [ ] **Run the full test suite** (`pnpm test`) and **type check** (`pnpm tsc --noEmit`) — both must be clean.
- [ ] **Set a real owner MFA factor** via Admin → My Security (MFA) so the production admin is protected.
- [ ] **Remove `STAGING_MODE`** and restart.

---

## 4. Cleanup script — `scripts/cleanup-test-accounts.mjs`

The script provides three safe, auditable modes. It is idempotent and prints exactly what it changed.

```bash
# Recommended: make local-password login impossible, keep the rows (reversible)
node scripts/cleanup-test-accounts.mjs --mode=disable

# Keep the accounts but assign fresh random passwords (printed once)
node scripts/cleanup-test-accounts.mjs --mode=rotate

# Hard-delete the rows entirely (and the client's demo-org membership)
node scripts/cleanup-test-accounts.mjs --mode=delete

# Add --yes to skip the confirmation prompt (CI / non-interactive)
node scripts/cleanup-test-accounts.mjs --mode=disable --yes
```

| Mode | Effect | Reversible? |
| --- | --- | --- |
| `disable` (default) | Blanks `passwordHash` and sets `loginMethod='disabled'`. | Yes — re-seed or rotate. |
| `rotate` | Assigns a fresh 24-char random password per account, printed once to stdout. | The old password is gone; copy the new one to your password manager. |
| `delete` | Removes the user rows and the client demo-org membership. | No. |

> **Recommendation:** use `disable` for the first launch. It removes the well-known-password risk while keeping the rows available if you later decide to rotate or re-enable for a controlled demo.

---

## 5. Transactional email & localisation

All three transactional emails — booking confirmation, contact confirmation, and engineering-access acknowledgement — are localised into the nine production locales (EN, NL, DE, FR, ES, IT, AR with RTL, ZH, JA). The active UI language is passed from the frontend on submission and used to pick the email language, date format, and text direction. English is the fallback when a locale string is missing. Coverage is enforced by `server/email-i18n.test.ts`.

---

## 6. AI Scan report PDF

AI Scan reports can be exported as a branded PDF via the token-gated `aiScans.getReportPdf` procedure. The PDF is generated server-side with `pdfkit`, cached against the scan's `reportPdfKey`, and served through a signed storage URL. The "Download report (PDF)" button appears on the result page. Rendering is covered by `server/aiScanReportPdf.test.ts`.

---

## 6a. Payment flow & Stripe activation (REC 11)

**Current state (staging):** there is **no Stripe paywall**. All three AI Scan tiers (free, growth, elite) route to the same questionnaire at `/ai-scan/start?tier=...`. Pricing shown on the site is informational; billing for paid engagements happens **offline** after the scan and strategy call. This is an intentional manual fallback for the pre-launch period and requires no payment integration to operate.

**Activating Stripe (production, optional):** when you want in-app checkout, add the Stripe feature via the web project's `Add feature` tooling (`feature="stripe"`). This scaffolds the server-side payment routes and the required secrets. The recommended sequence:

1. Add the Stripe feature to the project.
2. Provide `STRIPE_SECRET_KEY` and the publishable key via the Secrets panel.
3. Wire the paid-tier CTA to a checkout session instead of the direct questionnaire route.
4. Verify a test-mode payment end-to-end before switching to live keys.

Until Stripe is activated, leave the tiers routing to the questionnaire — the flow is complete and tested without it.

---

## 7. Quick reference

| Task | Command / location |
| --- | --- |
| Lock staging | Set `STAGING_MODE=on` + `STAGING_PASSWORD`, restart |
| Unlock staging | Remove `STAGING_MODE`, restart |
| Seed review accounts | `node scripts/seed-users.mjs` |
| Neutralise review accounts | `node scripts/cleanup-test-accounts.mjs --mode=disable` |
| Owner MFA enrolment | Admin portal → **My Security (MFA)** |
| Run tests | `pnpm test` |
| Type check | `pnpm tsc --noEmit` |
