# IO SKY — Client Portal Implementation Report
*Snapshot date: 23 May 2026 · Project: `io-sky` · Last checkpoint: `95af66c4`*

This report summarises everything that landed in the latest pass of work on the
**Client Portal** (`/client-portal/*`). It covers which routes are now
production-grade, which buttons actually do work end-to-end, what backend
plumbing is in place, the new database/state surface, the active security
checks, and what is intentionally still queued.

---

## 1. Routes completed

Every subroute below now ships the full UX contract requested:
**loading state · empty state · error state · permission-denied state ·
mobile drawer support · org/role-based filtering · no admin or developer
data leaking through.**

| Route | Status | Notes |
|---|---|---|
| `/client-portal` (overview) | Complete | Tenant-scoped dashboard, audited counters, recent activity feed. |
| `/client-portal/reports` | Complete | Signed-PDF download flow (`requestReportSignedUrl`). |
| `/client-portal/ai-scans` | Complete | Detail drawer + signed download for AI Scan reports. |
| `/client-portal/recommendations` | Complete | Detail drawer, Discuss-on-Strategy-Call deep-link, Request Proposal / Start Implementation / Dismiss actions. |
| `/client-portal/strategy-calls` | Complete | Reschedule (deep-link to `/book-strategy?ref=...`), Cancel (with 60-min guard), Join button gated by start-time window. |
| `/client-portal/billing` | Complete | Paid/outstanding totals, signed PDF download, **Pay Now** flow (manual instructions URL until Stripe is enabled). |
| `/client-portal/documents` | Complete | Upload pipeline (file → base64 → S3 via `storagePut`), signed Open, self-service delete only. |
| `/client-portal/messages` | Complete | Threaded inbox with read receipts, auto-`markMessagesRead` on entry, secure compose form. |
| `/client-portal/account` | Complete | Editable display name (audited), locked email/role, org metadata via `SectionStateSwitch`. |
| `/client-portal/security` | Complete | E-mail MFA toggle, Sign-out and Revoke-everywhere flows, audited login timeline. |
| `/client-portal/support` | Complete | Ticket creation with audit + `notifyOwner`, status visible in the list. |

All sections route through the shared `SectionStateSwitch` so the four states
look identical; the mobile sidebar drawer in `DashboardLayout` works on every
breakpoint.

---

## 2. Buttons that are actually wired

| UI control | Backend mutation / link |
|---|---|
| **Reports** → Download PDF | `trpc.clientPortal.requestReportSignedUrl` (signed URL + audit) |
| **AI Scans** → Open detail / Download | `requestReportSignedUrl` (same path; scoped by `scanType`) |
| **Recommendations** → Request Proposal | `recommendationAction({ kind: "proposal" })` |
| **Recommendations** → Discuss on call | Deep-link → `/book-strategy?topic=...` (prefills + skips step 1) |
| **Recommendations** → Start Implementation | `recommendationAction({ kind: "implement" })` (status → `in-progress`) |
| **Recommendations** → Dismiss | `recommendationAction({ kind: "dismiss" })` (status → `dismissed`) |
| **Strategy Calls** → Reschedule | Link → `/book-strategy?ref=<publicRef>` |
| **Strategy Calls** → Join | Visible only inside the `[start-15m, start+30m]` window |
| **Strategy Calls** → Cancel | `cancelStrategyCall` (blocks within 60 min, audited, notifies team) |
| **Billing** → Download invoice PDF | `requestInvoiceSignedUrl` |
| **Billing** → Pay Now | `requestInvoiceCheckout` (audited, `notifyOwner`, manual instructions URL) |
| **Documents** → Upload | `uploadDocument` (extension allowlist, S3 `storagePut`, audit + `notifyOwner`) |
| **Documents** → Open | `requestDocumentSignedUrl` |
| **Documents** → Delete (own uploads only) | `requestDocumentDeletion` (server enforces `uploadedByUserId === ctx.user.id`) |
| **Messages** → Send | `sendMessage` (audit, notification fan-out, `notifyOwner`) |
| **Messages** (on entry) | `markMessagesRead` (flips `readAt` for inbound rows) |
| **Account** → Save display name | `updateDisplayName` (zod-trimmed, audited) |
| **Security** → Enable / Disable e-mail MFA | `setMfaMethod` (audited) |
| **Security** → Sign out (this device) | `revokeSession({ everywhere: false })` |
| **Security** → Revoke everywhere | `revokeSession({ everywhere: true })` (audited, redirects to login) |
| **Support** → Open ticket | `createTicket` (publicRef + audit + `notifyOwner`) |

Every other button on the surface (filter chips, tabs, refresh icons) drives
local UI state only and is labelled as such.

---

## 3. Backend stubs / flows now connected

The `clientPortal` tRPC router (`server/routers/clientPortal.ts`) currently
exposes:

- **Queries**: `dashboard`, `organization`, `reports`, `recommendations`,
  `projects`, `invoices`, `documents`, `messages`, `notifications`,
  `strategyCalls`, `tickets`, `security`.
- **Mutations**:
  - Reports / Billing — `requestReportSignedUrl`, `requestInvoiceSignedUrl`,
    `requestInvoiceCheckout`.
  - Documents — `requestDocumentSignedUrl`, `uploadDocument`,
    `requestDocumentDeletion`.
  - Strategy Calls — `cancelStrategyCall`.
  - Recommendations — `recommendationAction`.
  - Messaging — `sendMessage`, `markMessagesRead`.
  - Account / Security — `updateDisplayName`, `setMfaMethod`, `revokeSession`.
  - Support — `createTicket`.

Every mutation that touches business state writes a row to `login_audit`
(reusing the existing audit table) so the Security Center and the admin
side can reconstruct exactly who did what and when. Every mutation that
matters operationally also fans out through `notifyOwner` so the IO SKY
operating team sees activity in near-real time.

`requestInvoiceCheckout` is the only mutation that returns a deliberately
non-functional URL — it points at a manual instructions page until the
Stripe feature flag flips on; the response shape (`mode: "manual"`) is the
extension point for the production flow.

---

## 4. Database surface — added or prepared

No destructive schema changes were needed; everything lives in tables that
were already present. The new helpers in `server/db.ts` are:

- `markIoSkyMessagesRead(orgId)` → tenant-scoped `UPDATE` on
  `client_messages` flipping `readAt` for IO-SKY-authored rows.
- `updateUserMfaMethod(userId, method)` → updates `users.mfaMethod`.
- `updateUserDisplayName(userId, name)` → updates `users.name`.
- `insertClientDocument`, `deleteClientDocumentById`,
  `getClientDocumentById` (added earlier) — round-trip for the upload
  pipeline (the `client_documents` table already had the required
  `uploadedByUserId`, `fileKey`, `mimeType`, `sizeBytes` columns).
- `appendClientNotification` continues to be the single fan-out path for the
  bell, recent-activity, and dashboard counters.

No DDL migration was required this pass. Future work (Stripe checkout,
TOTP MFA, server-side session registry) will introduce `payments`,
`mfa_secrets`, and `sessions` tables — they are intentionally **not**
created yet so we don't ship empty migrations.

---

## 5. Security checks that are active today

- **Tenancy isolation** — every query / mutation flows through
  `clientProcedure` which enforces `role === "client"` *and*
  `organizationId !== null`. Helpers (`getClientReportById`,
  `getClientInvoiceById`, `getClientDocumentById`, `getBookingForOrg`,
  `getClientRecommendationById`) all filter by `organizationId`, so a
  client cannot fetch another tenant's row even with a guessed numeric ID.
- **Role gates** — admin- and developer-only data never reach the portal:
  the dashboard query collapses to client-safe counters, and the bookings
  list filters by the client's e-mail on `bookings.email`.
- **Audit trail** — `appendLoginAudit` is invoked by every meaningful
  mutation (`document-upload:`, `document-delete`, `report-download`,
  `invoice-pay-init`, `recommendation:proposal`, `booking-cancel`,
  `mfa-enabled:email`, `session-revoke:everywhere`,
  `profile-update:name:...`).
- **Self-service safety** —
  - Document deletion only succeeds when
    `uploadedByUserId === ctx.user.id`; IO-SKY-issued contracts are
    immutable from the portal.
  - Booking cancellation refuses if `now > slotStart - 60 min`.
  - Invoice Pay Now refuses if status is already `paid` or `void`.
  - File uploads reject extensions outside the explicit allowlist
    (`pdf`, `png`, `jpg`, `jpeg`, `webp`, `csv`, `xlsx`, `docx`, `pptx`,
    `txt`, `md`).
- **Cookie / session hygiene** — `revokeSession` clears the session cookie
  with the same `getSessionCookieOptions` used by `auth.logout`, and
  forces a redirect through `getLoginUrl()` so no stale state can linger.
- **Outbound notifications** — every operationally relevant mutation calls
  `notifyOwner` inside a try/catch so the IO SKY team is alerted but a
  flaky notification path can never block the user action.

---

## 6. Test status

`pnpm test` — **52 / 52 specs passing** across 4 suites:

- `server/auth.logout.test.ts` (1)
- `server/bookings.test.ts` (9)
- `server/contact-engineering-auth.test.ts` (10)
- `server/clientPortal.test.ts` (32)

The Client Portal suite covers the unauth/role/tenant rejections plus the
happy paths and edge cases for `requestReportSignedUrl`,
`recommendationAction`, `cancelStrategyCall`, `requestInvoiceCheckout`,
`uploadDocument`, `requestDocumentDeletion`, `markMessagesRead`,
`updateDisplayName`, `setMfaMethod`, and `revokeSession`. TypeScript is
clean and the dev server runs without errors after every change.

---

## 7. Still open / queued (intentional)

These items remain on `todo.md` and are deliberate carry-overs because
they require either external services or schema additions that we do not
want to ship empty:

- **Stripe checkout** — wire `requestInvoiceCheckout` to a real Stripe
  Session once `webdev_add_feature stripe` is enabled.
- **TOTP / SMS MFA** — challenge endpoint + `mfa_secrets` table.
- **Server-side session registry** — needed for a true
  "revoke everywhere" that invalidates other browsers immediately
  instead of relying on the JWT TTL.
- **Audit log viewer for admins** — the data is already captured; admin
  UI is the missing piece.
- **Document download streaming for files larger than ~8 MB** — current
  upload path is base64; a multipart upload flow will replace it.
- **Notification preferences** — the API surface exists (`notifyOwner`),
  but the per-user preference UI is not yet built.
- **Localisation** — copy is currently English-only; the design tokens
  already support i18n once we add the translation layer.

These are tracked, not forgotten.

---

## 8. Visual & motion compliance

The IO SKY design language is preserved across every section:

- **Dark navy** background, **premium glass** card surface (`GlassCard`
  ring + blur), restrained **orange (#F97316)** as the only accent.
- Cinematic spacing (`mb-7 md:mb-9` section headers, generous card
  padding, no dense rows).
- Button hover/active timing follows the project's
  `cubic-bezier(0.23, 1, 0.32, 1)` ease-out under 200 ms.
- `prefers-reduced-motion` is honoured by the underlying primitives.
- No emoji, no exclamation marks, no over-decorated badges.
