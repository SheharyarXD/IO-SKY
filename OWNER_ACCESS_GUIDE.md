# IO SKY — Owner Access Guide

This document is your **personal cheat-sheet** for signing into the platform, exercising every role, and understanding how impersonation works. Hand it to a developer if you ever need help — it is self-contained.

---

## 1. Login URL

> `https://3000-iyq05dyhhpjuiudrbpil4-a105bfee.us2.manus.computer/login`
> (Replace the host with your production domain once deployed.)

The login page exposes two paths:

1. **Email + password** — the Manus-independent path. Recommended for daily use and required after your Manus subscription ends.
2. **SSO / Manus OAuth** — federated login via the IO SKY identity portal (Google, Microsoft, Apple are surfaced inside it).

Both paths converge on the same `app_session_id` cookie. Role-based redirects then route you to your dashboard.

---

## 2. Seeded Accounts

Three accounts have been seeded for you. All passwords are deterministic — please rotate them as soon as you have signed in once.

| Email | Password | Role | Lands on |
|---|---|---|---|
| `admin@iosky.local` | `IOSky-Admin-2026!` | **Super Admin** | `/admin/bookings` |
| `client@iosky.local` | `IOSky-Client-2026!` | Client | `/client-portal` |
| `developer@iosky.local` | `IOSky-Developer-2026!` | Developer | `/developer-workspace` |

To re-seed (idempotent), run from the project root:

```bash
node scripts/seed-users.mjs
```

---

## 3. Role-based Redirects

When you sign in, the server checks `users.role` and dispatches you accordingly:

| Role | Destination |
|---|---|
| `admin` | `/admin/bookings` |
| `client` | `/client-portal` |
| `developer` | `/developer-workspace` |
| `user` (default) | `/` (homepage) |

If MFA is enrolled for your account, the server intercepts the login and routes you through `/mfa-challenge` first, then to the role destination.

---

## 4. View-As (Impersonation) — Admin Only

The Super Admin can preview the platform exactly as a Client or Developer would experience it, **without logging out**. The impersonation cookie is signed (HMAC), expires after 30 minutes, and writes an audit row to `login_audit`.

### How to start a View-As session

1. Sign in as `admin@iosky.local`.
2. Navigate to the **Admin Portal → Users / Roles** section.
3. Choose a target user (Client or Developer) and click **View As**.
4. Confirm the reason in the dialog (this is stored in the audit log).
5. You are now browsing as that role. A persistent banner at the top of every page reminds you.

### How to exit View-As

Click **Exit View-As** in the banner. The impersonation cookie is cleared and an audit row records the exit. Your underlying admin session is untouched.

### What is audited

Every entry into a View-As session and every exit writes a row in `login_audit` with `provider="admin.view_as"`, the reason string, the IP address, and the user agent. You can find these in **Admin Portal → Audit Log**.

---

## 5. What to Test Once You Sign In

| Area | What to verify |
|---|---|
| **Routes** | Every navigation link from each portal resolves to a real page with no 404 |
| **Permissions** | `clientProcedure` denies admin-only data; `adminProcedure` denies developer requests |
| **Automations** | Booking creation triggers admin notification + CRM lead + audit row |
| **Notifications** | Owner inbox receives a row when a booking is created, rescheduled, cancelled, or no-show |
| **Uploads / Downloads** | Documents in Client Portal can be uploaded, downloaded, and re-signed |
| **Dashboards** | Overview, Reports, Recommendations, Strategy Calls populate with seeded data |
| **Premium feel** | Glass surfaces, restrained orange hover, mono eyebrow, dark navy background |
| **Responsive** | DashboardLayout collapses to a drawer ≤ 1024px and pages re-flow gracefully |
| **MFA** | Enroll TOTP from `/security`, sign out, sign back in, complete the challenge |
| **Developer access** | `/developer-workspace` enforces NDA + scope + assignment gates |
| **AI Scan → ecosystem** | `/ai-scan` produces a tier recommendation that links into `/solutions` |
| **Booking system** | `/book-strategy` lists live slots, lock-on-hold prevents double-booking |
| **CRM** | Submitting a contact, booking, or discovery form writes a `leads` row |

---

## 6. How to Sign Out

The header user-menu has **Sign out**. Programmatically you can POST to `/api/auth/local/logout` for the local path, or simply clear the `app_session_id` cookie.
