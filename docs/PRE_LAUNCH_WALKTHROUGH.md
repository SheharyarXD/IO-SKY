# Pre-Launch Functional Walkthrough

**Milestone 3 §3.5 (RM-115)** — one consolidated checklist covering every
route, role, workflow, API surface and integration before public go-live.

> **Status: the checklist is complete; the walkthrough has not been performed.**
> It cannot be, yet — there is no deployed environment to walk through (RM-74
> hosting decision is open) and no staging accounts for the role-gated
> sections. Every box below is unticked deliberately. Under the agreed
> vocabulary this document is **implemented, not verified**.
>
> Where a line is already covered by an automated test, that is noted. Those
> lines still need a human pass: automation proves the mechanism works, not
> that the result is right.

**How to use it:** work top to bottom against staging first, then repeat the
§9 subset against production immediately after go-live. Record failures inline
rather than in a separate list — a checklist with an unrecorded failure is
worse than no checklist.

---

## 1. Public website routes

All 45 client routes. Each: loads without console errors, renders complete
content, no horizontal scroll at 390px / 768px / 1280px.

| Route | Desktop | Tablet | Mobile | Notes |
|---|---|---|---|---|
| `/` | ☐ | ☐ | ☐ | |
| `/about` | ☐ | ☐ | ☐ | |
| `/solutions` | ☐ | ☐ | ☐ | ecosystem selector states |
| `/solutions/growth-ecosystem` | ☐ | ☐ | ☐ | |
| `/solutions/elite-ecosystem` | ☐ | ☐ | ☐ | |
| `/solutions/custom-intelligence-infrastructure` | ☐ | ☐ | ☐ | |
| `/solutions/proposal-request` | ☐ | ☐ | ☐ | form submits |
| `/infrastructure` | ☐ | ☐ | ☐ | renamed to `/foundation`? (client decision) |
| `/intelligence` | ☐ | ☐ | ☐ | |
| `/enterprise` | ☐ | ☐ | ☐ | retained or retired? (client decision) |
| `/custom-software` | ☐ | ☐ | ☐ | |
| `/contact` | ☐ | ☐ | ☐ | form submits + rate limit |
| `/ai-scan` | ☐ | ☐ | ☐ | |
| `/ai-scan/start` | ☐ | ☐ | ☐ | questionnaire flow |
| `/ai-scan/result/:token` | ☐ | ☐ | ☐ | valid + invalid token |
| `/book-strategy` | ☐ | ☐ | ☐ | 4-step wizard, covered by RM-106 |
| `/booking/cancel` | ☐ | ☐ | ☐ | valid + expired token |
| `/booking/reschedule` | ☐ | ☐ | ☐ | |
| `/engineering-access` | ☐ | ☐ | ☐ | |
| `/security` | ☐ | ☐ | ☐ | |
| `/translations` | ☐ | ☐ | ☐ | |
| `/login` | ☐ | ☐ | ☐ | covered by RM-98/RM-102 |
| `/reset-password` | ☐ | ☐ | ☐ | full end-to-end reset |
| `/mfa-challenge` | ☐ | ☐ | ☐ | |
| `/404` + unknown path | ☐ | ☐ | ☐ | |
| `/privacy` `/terms` `/cookies` | ☐ | ☐ | ☐ | |
| `/ai-disclaimer` `/dpa` `/trust` | ☐ | ☐ | ☐ | |
| `/status` `/careers` `/press` `/partners` | ☐ | ☐ | ☐ | |
| `/legal/:doc` | ☐ | ☐ | ☐ | each published doc |

### Navigation
- ☐ Every navbar item routes correctly
- ☐ Dropdowns open on hover **and** keyboard focus
- ☐ Mobile drawer opens, closes, traps focus
- ☐ Footer links resolve (no 404s)
- ☐ Logo returns home
- ☐ Language selector, Log in and Book Discovery Call are visually distinct

---

## 2. Localisation

All 10 locales: `en` `nl` `de` `fr` `es` `it` `pt` `ar` `zh` `ja`

- ☐ Switching locale re-renders without a reload
- ☐ Choice persists across navigation and reload
- ☐ No raw translation keys visible in any locale
- ☐ **Arabic renders right-to-left**, including nav, forms and cards
- ☐ No layout break from long German/Dutch strings
- ☐ Dates, times and currency localise correctly
- ☐ Transactional emails arrive in the recipient's locale

---

## 3. Authentication

- ☐ Local email/password login
- ☐ Invalid credentials rejected; message does not reveal whether the account exists
- ☐ Password reset works **end to end** (this was a Milestone 1 audit finding — verify the real email arrives)
- ☐ Session cookie is `HttpOnly`, `Secure`, correct `SameSite` (RM-92)
- ☐ Session expires per `SESSION_TTL_HOURS` (RM-89)
- ☐ **Logout revokes the session server-side** — replay the pre-logout cookie and confirm it is refused (RM-90)
- ☐ MFA enrolment: TOTP
- ☐ MFA challenge on every login path, no bypass
- ☐ MFA is blocking for admin / super_admin / technical_operator
- ☐ Rate limiting on repeated failures
- ☐ Login audit rows written for success **and** failure

---

## 4. Role & tenant boundaries

For each role — `user`, `client`, `developer`, `admin`, `super_admin`,
`technical_operator`:

- ☐ Lands on the correct destination after login
- ☐ Can reach every surface it should
- ☐ Is refused every surface it should not
- ☐ Sees no other tenant's data anywhere
- ☐ Direct URL entry to a forbidden route is refused (not just hidden in nav)
- ☐ Refusal reads as "not permitted", never as an empty state (RM-100)

Cross-tenant checks (automated as RM-60/RM-108; repeat by hand on the deployed
environment per RM-84/RM-85):

- ☐ Client A cannot read Client B's reports, invoices, documents or messages
- ☐ Direct object references (`/…/:id`) are rejected across tenants
- ☐ Developer sees only assigned projects

---

## 5. Portals

### Client Portal
- ☐ Dashboard renders; no error boundary
- ☐ Reports, invoices, documents, messages, projects list correctly
- ☐ Document upload, download, and oversize rejection
- ☐ Messaging: send, receive, thread ordering
- ☐ Notification bell opens; mark-read; mark-all-read; archive (RM-99)
- ☐ Empty states appear where there is genuinely no data

### Company/Admin Portal
- ☐ Executive overview — every figure traceable to real data, nothing fabricated
- ☐ CRM / leads, Billing / invoices, Support tickets
- ☐ User, role and organization management
- ☐ Security monitoring and MFA posture
- ☐ Analytics / BI dashboards
- ☐ Document lifecycle: versioning, approval, rejection, retention
- ☐ Workflow definitions
- ☐ Integration & webhook registry
- ☐ Platform settings persist and are audited
- ☐ **Every button does something** — no dead controls (Milestone 2 exit gate)

### Developer Workspace
- ☐ Dashboard, assigned projects, submissions, audit events

### Operator Console
- ☐ Health monitoring, queue/storage/log visibility
- ☐ **No customer or financial data reachable** (the role's defining boundary)

---

## 6. API surface

12 routers: `system` `auth` `bookings` `contact` `engineering` `developer`
`mfa` `admin` `ops` `solutions` `legal` `aiScans`

- ☐ Every procedure enforces its intended role gate (RM-55 automated; spot-check live)
- ☐ Input validation rejects malformed payloads (RM-93 automated)
- ☐ Errors carry no stack traces or internal detail in production
- ☐ Rate limits enforced on public endpoints
- ☐ Malformed URLs return 400, not a 500 (RM-102-a)
- ☐ Security headers present on every response (RM-86)
- ☐ CORS refuses unlisted origins (RM-87)

---

## 7. Integrations

- ☐ Email delivery (Zoho primary; Resend transactional) — real send, real inbox
- ☐ Bounce/complaint webhook handling
- ☐ Supabase Storage upload/download + signed URL expiry
- ☐ Supabase Auth session refresh
- ☐ OpenAI: AI Scan completes end to end; model routing selects the intended tier
- ☐ Stripe: payment, webhook, VAT validation, invoice PDF **(pending real API keys)**
- ☐ Analytics beacon reaches the configured endpoint
- ☐ Every integration fails *visibly* when the provider is down — no silent swallow

---

## 8. Performance & resilience

- ☐ Load test on the highest-traffic procedures (RM-110)
- ☐ Indexes used under realistic queries (RM-111 automated)
- ☐ Booking-slot concurrency: two users, one slot — exactly one wins (RM-113)
- ☐ Large-file upload performance (RM-114)
- ☐ Notification queue throughput (RM-112)
- ☐ App recovers from a database restart without a manual bounce

---

## 9. Post-go-live subset

Re-run immediately after the DNS cutover, then hourly for the first six hours.

- ☐ Homepage loads over HTTPS with a valid certificate
- ☐ Login works for one account per role
- ☐ One booking completes end to end
- ☐ One email actually arrives
- ☐ Error rate and p95 latency within baseline
- ☐ No secrets in any client bundle (RM-82 automated)
- ☐ `robots.txt` and `noindex` correct for the environment

---

## 10. Sign-off

| Section | Walked by | Date | Result |
|---|---|---|---|
| 1. Public routes | | | ☐ |
| 2. Localisation | | | ☐ |
| 3. Authentication | | | ☐ |
| 4. Roles & tenants | | | ☐ |
| 5. Portals | | | ☐ |
| 6. API surface | | | ☐ |
| 7. Integrations | | | ☐ |
| 8. Performance | | | ☐ |
| 9. Post-go-live | | | ☐ |

**Go-live requires every section signed off, or an explicit written client
acceptance of each exception.** A partially-walked checklist presented as
complete is precisely the reporting failure the Milestone 2 feedback objected
to.
