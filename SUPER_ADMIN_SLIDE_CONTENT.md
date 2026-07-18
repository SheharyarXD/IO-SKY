# IO SKY — Super Admin Capabilities Presentation

**Visual direction:** IO SKY brand language — dark navy background (#0a0f1e), glass-morphism panels, orange accent (#f97316), cinematic transitions. Heading font: bold sans-serif (executive). Body: light grey on dark. Avoid bullet-soup; use compact tables and short evidence-style copy. Each heading is an insight, not a label.

**Target audience:** IO SKY platform owner + operations team who need to understand and operate the Super Admin role end-to-end.

**Tone:** Operational, confident, evidence-backed. No marketing fluff.

---

## Slide 1 — Cover

Title: **Super Admin Operating Console**
Subtitle: Total command of the IO SKY operational intelligence platform
Footer line: Internal handoff dossier · IO SKY v1.0 · 2026

---

## Slide 2 — One Console, Eighteen Domains of Control

**Heading:** A single role that governs every operational surface of IO SKY

The Super Admin is not just a user with extra checkboxes. It is the only role that can read, write and audit across all 18 platform domains, impersonate any user, override booking conflicts, rotate secrets, suspend tenants and view every line of the audit log.

Key facts to display:
- 18 admin modules in one console
- 4 user roles managed: user · client · developer · admin
- Every privileged action audit-logged with reason, IP, user-agent
- Sessions signed with JWT, 30-day TTL, instant revocation
- Independent of Manus OAuth — works with local email+password fallback

---

## Slide 3 — Logging In as Super Admin

**Heading:** Two independent paths into the console, both audit-logged

Layout: two columns side-by-side.

Left column — **Local email+password (Manus-independent):**
- URL: `/login`
- Credentials: `admin@iosky.local` / `IOSky-Admin-2026!`
- Backed by bcrypt, JWT cookie, role-based redirect
- Continues to work even if Manus OAuth is unreachable

Right column — **Manus OAuth (SSO):**
- URL: `/login` → "Continue with Manus"
- Returns to `/api/oauth/callback`, signs the same JWT cookie format
- Used when owner is logged into Manus ecosystem

Bottom note: After successful login the Super Admin is redirected to `/admin/bookings` by default. The role check happens server-side via `adminProcedure`; every protected tRPC call validates `ctx.user.role === 'admin'`.

---

## Slide 4 — The 18 Admin Modules at a Glance

**Heading:** Every operational lever lives behind one sidebar

Render as a 3×6 grid table with module name + one-line responsibility:

| Module | Purpose |
|---|---|
| Bookings | Slot management, no-show, cancellation override |
| Availability | Recurring rules, exceptions, calendar blocks |
| CRM | Leads, lifecycle stages, lead-source attribution |
| Clients | Account directory, contract status, lifecycle |
| Projects | Project pipeline + assigned developers |
| Billing | Invoices, plans, payment state |
| Documents | Contracts, NDAs, proposals, signed PDFs |
| Reports | Scheduled exports + ad-hoc analytics |
| AI Scans | Submitted scans + AI-generated diagnostics |
| Developers | Roster, invites, temp-access tokens |
| Security | Sessions, login attempts, IP blocks |
| MFA Posture | Per-role MFA enrolment + enforcement |
| Campaigns | Outbound campaigns + performance |
| Agents | Configured AI agents and their runs |
| Automations | Recurring jobs, triggers, status |
| Analytics | Cross-module KPIs, funnels |
| Users | Account directory, role assignment |
| Audit + Settings + Support | Compliance log, platform settings, support inbox |

---

## Slide 5 — Bookings: Authoritative Slot Control

**Heading:** The Super Admin is the only role that can override the booking engine

Operational capabilities:
- View every booking across all services and time windows
- Filter by status: `hold` · `confirmed` · `cancelled` · `no_show` · `completed`
- Force-cancel a confirmed booking with mandatory reason (logged + customer email sent)
- Mark booking as no-show — triggers CRM lifecycle update + win-back automation
- Reschedule on behalf of customer (writes a `booking_event` audit row)
- Drill into the `booking_slots` table to see hold-locks and detect stuck holds

Evidence panel:
- Backed by `bookingAdmin` tRPC router with 11 procedures
- Unique constraint on `(slotId, status)` prevents double-booking at DB level
- Every action emits a `booking_event` audit entry + notification

---

## Slide 6 — Availability: Designing the Calendar

**Heading:** Recurring rules, exceptions and blocks compose the bookable surface

Three-layer model that the admin controls:

1. **Recurring availability rules** — e.g. Mon-Fri 09:00-17:00 Europe/Amsterdam, generated per service
2. **Exceptions** — open or closed overrides for specific dates (holidays, special openings)
3. **Calendar blocks** — manually inserted unavailable windows (deep work, travel, off-site)

Operational evidence:
- Slot generation respects user timezone preferences (`timezone_preferences` table)
- Live preview shows the next 14 days of computed slots before saving rules
- Changes are versioned — admin can revert a rule set within 24h
- All availability operations write to `audit_logs` with a structured diff

---

## Slide 7 — CRM: Lead Lifecycle Ownership

**Heading:** Every lead, every touchpoint, attributable end-to-end

Super Admin capabilities in CRM module:
- See leads from all sources: Custom Discovery, Proposal Request, AI Scan, Book Strategy, contact form
- Update lifecycle stage: `new → qualified → engaged → won / lost`
- Assign leads to developers or account managers
- Trigger or pause CRM automations (welcome series, nurture sequences, win-back)
- Export CSV with full lead history for compliance / handover

Quantitative anchors:
- 9 lead-source types tracked with first-touch + last-touch attribution
- Average lead enters CRM within 1.2s of submission (synchronous tRPC write)
- All field edits write to `audit_logs.entity = 'crm_lead'` for compliance

---

## Slide 8 — AI Scans: Operational Diagnostic Engine

**Heading:** Admin reviews every AI Scan and the diagnostic the LLM produced

The AI Scan is the platform's primary lead-generation engine. Super Admin can:
- Browse all submitted scans with filter by industry, score, status
- View the full intake form + LLM-generated diagnostic
- Re-run analysis with a different prompt template (writes a new `ai_scan_run`)
- Convert a scan into a CRM lead with one click
- Send the diagnostic PDF to the prospect via the notification engine

Evidence panel:
- LLM calls go through the abstracted Forge LLM provider — swappable to OpenAI / Anthropic
- Each scan stores the prompt version used (`prompt_version_id`) for reproducibility
- Average diagnostic generation: 8-15 seconds

---

## Slide 9 — Developers Module: Roster and Temp Access

**Heading:** Controlled access for external engineers without permanent accounts

Capabilities:
- Invite developers via signed-token email (24-72h expiry, configurable)
- Issue temp-access tokens scoped to a specific project (write to `developer_temp_access`)
- See per-developer audit feed: what they viewed, edited, downloaded
- Revoke access instantly — token is invalidated server-side, JWT blacklisted
- Promote a developer to permanent account if the engagement extends

Security note:
- Developers can only see projects they are explicitly assigned to (row-level filter in `projectsRouter`)
- Their dashboard is a separate portal (`/developer-workspace`) — never sees CRM, billing, or other clients

---

## Slide 10 — Security and MFA Posture

**Heading:** Live visibility into who is signed in and how strongly they're authenticated

Three operational views in this module:

1. **Active sessions** — table of every signed-in user, IP, user-agent, last activity. Force-logout button per session.
2. **Login attempts feed** — successes and failures in real time. Failed attempts auto-trigger IP rate-limit after 5 in 10 min.
3. **MFA posture** — per-role enrolment percentage. Super Admin can enforce MFA for a role (e.g. `admin` must be `totp` or `sms`).

Audit evidence:
- Every login writes to `auth_events` with method (`local`, `oauth`, `view-as`)
- Every privileged action writes to `audit_logs` with reason, IP, UA, before/after
- JWT secret rotation supported with grace period (old + new cookie accepted for 24h)

---

## Slide 11 — View-As Impersonation

**Heading:** Walk a mile in any user's session without knowing their password

Flow shown as a 5-step horizontal timeline:

1. Admin opens sidebar → clicks "View as Client" or "View as Developer"
2. Modal asks for **reason** (required — written to audit log)
3. Server mints a signed 30-min JWT with `impersonator_id` + `impersonated_id` claims
4. Admin browses the portal as the target user — orange impersonation banner stays visible
5. One-click exit returns to the admin session and closes the audit entry

Guardrails:
- Cannot impersonate another admin (server rejects)
- All actions taken during impersonation are tagged with `acting_as` in audit log
- Impersonation token expires hard at 30 min, no extension
- Audit log shows reason + duration + every mutation performed

---

## Slide 12 — Audit Log: The Compliance Spine

**Heading:** Every privileged action is recorded with structured context

The `audit_logs` table is append-only and queryable by Super Admin. Schema highlights:

| Column | Meaning |
|---|---|
| `actor_id` | The user who performed the action |
| `acting_as` | If impersonating, the target user |
| `entity` + `entity_id` | What was touched (e.g. `booking_slot:482`) |
| `action` | Verb (`update`, `cancel`, `view`, `export`) |
| `reason` | Mandatory text the admin typed |
| `before` / `after` | JSON snapshot for diff |
| `ip` · `user_agent` | Source context |
| `created_at` | UTC timestamp |

Filters supported in the UI: actor, entity type, date range, action verb. Export to CSV with one click for SOC2 / GDPR evidence.

---

## Slide 13 — Users and Role Management

**Heading:** Promote, demote, suspend — with traceability

The Users module gives Super Admin full lifecycle control:
- Change role between `user · client · developer · admin`
- Reset password — triggers email with signed reset token (1h expiry)
- Suspend account — blocks login but preserves history for legal hold
- Force MFA enrolment per user
- Merge duplicate accounts (combines CRM history + bookings)

Critical guard: An admin cannot demote themselves to non-admin while being the only admin — the system requires at least one active admin at all times.

---

## Slide 14 — Notifications and Automation Surface

**Heading:** Admin sees every system message before it goes out

Capabilities:
- Browse the notification queue: pending, sent, failed, retried
- Re-send a failed notification with one click
- Override the template for a specific send (rare — for VIP handling)
- Configure automation triggers: which events fan out to which channels (email, SMS, in-app, owner-alert)
- Pause an automation immediately if a bug is observed

Architectural anchor:
- `notifyOwner()` helper plus generic notification engine
- All sends recorded in `notifications` table with provider response + retry count

---

## Slide 15 — Reports, Analytics and Exports

**Heading:** Operational visibility without leaving the console

Built-in admin analytics:
- **Bookings funnel** — visits to /book-strategy → slot select → confirmation → showed up
- **AI Scan funnel** — started → completed → diagnostic generated → converted to lead
- **CRM funnel** — lead → qualified → won, with cycle-time and source breakdown
- **Revenue snapshot** — invoiced, collected, outstanding, projected
- **Platform health** — error rate, p95 latency, active sessions

Export capabilities:
- Every table supports CSV export
- Scheduled reports can be configured (weekly digest to owner email)

---

## Slide 16 — Settings: Platform-Level Configuration

**Heading:** The control panel for the platform itself

What lives here:
- **General** — brand name, support email, default timezone, supported languages (currently 9)
- **Auth** — Manus OAuth toggle, local-password toggle, password policy
- **Booking** — default service catalogue, hold duration, reminder cadence
- **Email** — SMTP provider (Manus Forge or external), sender identity, signature
- **Storage** — S3 bucket selection (Manus or external)
- **Feature flags** — gradual rollout switches per feature

Change-control note: Every settings change writes a diff to the audit log and triggers an owner notification.

---

## Slide 17 — Support Inbox

**Heading:** Customer threads, internal notes, and SLA tracking in one view

Capabilities:
- Inbox of every support thread (from client portal + email-in)
- Reply directly from the admin console (composer attaches admin identity)
- Add internal notes invisible to the customer
- Assign to a developer or escalate to owner
- Track first-response time and resolution time against SLA targets

Status: backend ready, reply-composer UI ships in next release.

---

## Slide 18 — Provider Independence Matrix

**Heading:** Every external dependency is swappable — the platform is Manus-optional

Render as a compact table:

| Concern | Default provider | Replacement path | Admin control |
|---|---|---|---|
| Auth | Manus OAuth + local | Auth0 / Cognito / Keycloak | Settings → Auth |
| LLM | Manus Forge | OpenAI / Anthropic / Azure | Settings → AI |
| Storage | Manus S3 proxy | Any S3-compatible bucket | Settings → Storage |
| Email | Manus Forge | SendGrid / SES / Postmark | Settings → Email |
| SMS (MFA) | Manus Forge | Twilio / MessageBird | Settings → MFA |
| Booking | Native | Google Cal / MS / Cal.com via adapter | Settings → Booking |

Bottom line: Super Admin is the role that performs each of these swaps in production.

---

## Slide 19 — Daily Operating Rhythm

**Heading:** A recommended Super Admin checklist for healthy operations

Three time horizons:

**Daily (5 minutes):**
- Check active sessions count — anomalies
- Scan audit log for `cancel`, `delete`, `impersonate` actions
- Review failed notifications, re-send if transient

**Weekly (20 minutes):**
- Review CRM funnel and lead-source mix
- Approve / clean up developer temp-access tokens nearing expiry
- Export bookings + revenue snapshot

**Monthly (1 hour):**
- Rotate JWT secret (with 24h grace period)
- Review MFA posture, enforce on any drift
- Reconcile billing vs invoiced
- Run security scan / dependency audit

---

## Slide 20 — Three Things to Never Do

**Heading:** Hard rules — even Super Admin should respect these

1. **Never share the Super Admin password.** Create individual admin accounts and assign the role; the audit log is only useful when actors are distinct.
2. **Never delete from the audit log.** It is append-only at the schema level; any attempt to bypass that breaks SOC2 / GDPR posture.
3. **Never impersonate without a reason.** The reason field is mandatory by design — write a real, specific one. Audit reviewers will read it.

---

## Slide 21 — Quick Reference

**Heading:** Everything you need in one screen

Two-column reference card:

Left — **Credentials & URLs:**
- Login: `/login`
- Email: `admin@iosky.local`
- Password: `IOSky-Admin-2026!`
- Default redirect: `/admin/bookings`
- Logout: `/api/auth/local/logout`

Right — **Key admin routes:**
- `/admin/bookings` — slot management
- `/admin/users` — account directory
- `/admin/audit` — compliance log
- `/admin/security` — sessions + MFA
- `/admin/settings` — platform configuration
- `/admin/support` — customer threads

Footer line: For full architectural reference, see `IO_SKY_ULTRA_DETAILED_ENTERPRISE_BLUEPRINT.pdf`.

---

## Slide 22 — Closing

**Heading:** The Super Admin role is the operating system of IO SKY

Closing message (one paragraph): The console you have just walked through represents every lever required to operate IO SKY as a stand-alone enterprise platform. From day-one onboarding (AI Scan → CRM → booking → project) through long-term governance (audit, MFA, secret rotation, provider swaps), one role and one console handle it end-to-end. Use it with care — the audit log is watching.

Footer: IO SKY · Operational Intelligence Infrastructure · 2026
