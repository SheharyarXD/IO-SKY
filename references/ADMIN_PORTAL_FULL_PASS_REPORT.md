# IO SKY — Admin Portal · Full Pro/Functional Pass

> **Status:** delivered. 192/192 vitest specs green, TypeScript clean,
> 19 admin routes live, View-As impersonation operational, owner account
> promoted to `role = 'admin'`.

---

## 1. Routes shipped (19 total)

| # | Route | Module | Endpoint |
| - | ----- | ------ | -------- |
| 1 | `/admin` | Executive Overview | `admin.summary`, `admin.liveFeed`, `admin.recentLoginAudit` |
| 2 | `/admin/crm` | CRM & Leads | `admin.crm` |
| 3 | `/admin/clients` | Clients directory | `admin.clients` |
| 4 | `/admin/ai-scans` | AI Scans queue | `admin.aiScans` |
| 5 | `/admin/reports` | Reports pipeline | `admin.reports` |
| 6 | `/admin/projects` | Projects & Ecosystems | `admin.projects` |
| 7 | `/admin/strategy-calls` | Strategy Calls (uses bookings router) | `bookings.list` (embedded) |
| 8 | `/admin/billing` | Billing & Payments | `admin.billing` |
| 9 | `/admin/documents` | Documents & Storage | `admin.documents` |
| 10 | `/admin/developers` | Developer Management | `admin.developers` |
| 11 | `/admin/security` | Security Monitoring | `admin.security`, `admin.mfaPosture` |
| 12 | `/admin/campaigns` | Email/SMS Campaigns | `admin.campaigns` |
| 13 | `/admin/agents` | AI Agents & IVR | `admin.agents` |
| 14 | `/admin/automations` | Notifications & Automations | `admin.automations` |
| 15 | `/admin/analytics` | Analytics & Insights | `admin.analytics` |
| 16 | `/admin/users` | Users & Permissions | `admin.users` |
| 17 | `/admin/audit` | Audit Logs | `admin.audit` |
| 18 | `/admin/settings` | System Settings | `admin.settings` |
| 19 | `/admin/support` | Support Desk | `admin.support` |

Every route renders inside the same `AdminLayout` shell (19-item rail
sidebar on `lg+`, Sheet drawer on small viewports, sticky header with
date/time + alert cluster + search + Quick Actions).

---

## 2. Endpoints added (server-side)

All endpoints are gated by `adminProcedure`, write a `login_audit` row
on every successful read, and return safe fallback shapes when the
database is offline. New procedures in `server/routers/admin.ts`:

| Procedure | Audit reason | Notes |
| --------- | ------------ | ----- |
| `admin.crm` | `admin.read.crm` | Lead pipeline KPIs + 10 latest leads |
| `admin.clients` | `admin.read.clients` | Organisation directory + active client count |
| `admin.aiScans` | `admin.read.ai_scans` | Synthetic queue + score board (db-ready) |
| `admin.reports` | `admin.read.reports` | Release pipeline (signed-URL ready) |
| `admin.projects` | `admin.read.projects` | Live project counts grouped by status |
| `admin.billing` | `admin.read.billing` | Invoice list (paid/issued ms) + AR aging |
| `admin.documents` | `admin.read.documents` | Storage manifest stub keyed for s3 swap |
| `admin.developers` | `admin.read.developers` | Pending requests + temp-access matrix |
| `admin.security` | `admin.read.security` | Security event feed + lockouts |
| `admin.mfaPosture` | `admin.read.mfa_posture` | TOTP/SMS coverage % across users |
| `admin.campaigns` | `admin.read.campaigns` | Email/SMS campaign rollups |
| `admin.agents` | `admin.read.agents` | AI agent + IVR live snapshot |
| `admin.automations` | `admin.read.automations` | Workflow stats (running/completed/failed) |
| `admin.analytics` | `admin.read.analytics` | KPI rollups derived from db where present |
| `admin.users` | `admin.read.users` | User directory + role split |
| `admin.audit` | `admin.read.audit` | Last 100 `login_audit` rows |
| `admin.settings` | `admin.read.settings` | System toggles & feature flags |
| `admin.support` | `admin.read.support` | Support ticket queue from `clientSupportTickets` |
| `admin.action` | `admin.action.<module>.<action>` | Audited action stub for every primary button |
| `admin.viewAs` | `admin.view_as.<target>` | Returns redirect path; minting handled by Express route |

The bookings router is unchanged; the existing `AdminBookings` table is
embedded inside `OperationalPage` for `/admin/strategy-calls`.

---

## 3. Tests green (192/192)

```
Test Files  13 passed (13)
     Tests  192 passed (192)
```

Coverage added in this pass:

- **`server/admin.modules.test.ts`** (59 specs) — for each of 18 module
  endpoints and the audited action stub: anonymous → `FORBIDDEN`,
  `role="user"` → `FORBIDDEN`, `role="admin"` → ok + correct
  `admin.read.<module>` audit row.
- **`server/viewAs.test.ts`** (5 specs) — sign/verify round-trip for
  the impersonation JWT, tampered-token rejection, wrong-secret
  rejection, empty-token handling, stable cookie name.
- **`server/admin.summary.test.ts`** updated for the new audit reason
  (`admin.recent_login_audit`) and the new `provider = "admin"` audit
  channel.

The other 11 pre-existing test files (bookings, mfa, mfaTotp,
mfaCrypto, mfaChallenge, oauth.redirect, auth.logout, etc.) all stay
green.

---

## 4. RBAC checks — every admin surface

| Surface | Gate |
| ------- | ---- |
| `/admin/*` UI shell | `useAuth()` redirects non-admins to their role home; loading state shown while `auth.me` resolves |
| Every tRPC procedure under `admin.*` | `adminProcedure` (extends `protectedProcedure` and asserts `ctx.user.role === "admin"`; throws `FORBIDDEN` otherwise) |
| Express POST `/api/admin/view-as` | Re-checks `role === "admin"` server-side and audits both success and rejection |
| Express DELETE `/api/admin/view-as` | Public so impersonated sessions can always exit cleanly; only clears the cookie if it was actually present |

The unified login flow at `/api/oauth/callback` continues to do
role-based redirects (`admin → /admin`, `client/user → /client-portal`,
`developer → /developer-workspace`).

---

## 5. View-As impersonation (Super Admin)

**Server**

- `server/_core/viewAsRoute.ts` — POST mints a 30-min HMAC-SHA-256 JWT
  using `ENV.cookieSecret`, sets it as `io_sky_impersonation`
  (HttpOnly, SameSite=Lax). Reason ≥ 4 chars required. Both enter and
  exit are written to `login_audit` with reason
  `admin.view_as.<target>` and `admin.view_as.exit`.
- `server/_core/context.ts` — verifies the impersonation cookie and
  decorates the tRPC context with `impersonation = { realAdminOpenId,
  target }`. The user's real role stays `admin`; we surface the
  impersonation only as a UI hint, never as an authority elevation.
- `server/routers.ts` — `auth.me` now exposes `impersonation` so the
  client portals know they're being previewed.

**Client**

- `AdminLayout` user pod has two buttons "View as Client" / "View as
  Developer" that prompt for an audit reason.
- `ClientPortal` and `DeveloperWorkspace` role gates accept an
  impersonating admin (no redirect away).
- `<ImpersonationBanner />` is mounted at the top of both
  `ClientPortalLayout` and `WorkspaceLayout` and offers a one-click
  "Exit View-As" that hits the DELETE endpoint and reloads.

Result: a Super Admin can preview the Client Portal and Developer
Workspace UIs from their own session without needing to log out, and
every step of the preview is in the audit trail.

---

## 6. UI states

Every module page is wrapped in `<ModuleStateBoundary>` (in
`client/src/pages/admin/sections/_shared/ModuleState.tsx`) which
renders:

- **Loading** — pulsing skeleton tiles styled to the card shell.
- **Empty** — explicit "No data yet" panel with a contextual hint.
- **Error** — red strip with a retry button that calls
  `trpc.useUtils().admin.<module>.invalidate()`.
- **Permission denied** — recognises `code === "FORBIDDEN"` and shows a
  dedicated panel ("This module is reserved for Admins.") instead of a
  raw error.

Primary buttons across the modules go through the `useAuditedAction()`
hook which calls `admin.action`, writing
`admin.action.<module>.<action>` to the audit log on every click —
so even when the underlying mutation is a stub, security logging is
already production-ready.

---

## 7. Login instructions for testing

1. The owner account (`OWNER_OPEN_ID = fuKAtoFz74U8KYNX2mVXYo`,
   "Io Sky") has been promoted: `users.role = 'admin'`.
2. Open the live preview:
   `https://3000-iyq05dyhhpjuiudrbpil4-a105bfee.us2.manus.computer/admin`
3. The page bounces to the unified Manus OAuth login.
4. Sign in with the same Manus account that owns this project — this
   is the account behind `OWNER_OPEN_ID`. After the callback you land
   directly on the Executive Overview at `/admin`.
5. To exercise View-As: in the bottom-left user pod click "View as
   Client" or "View as Developer", type any reason ≥ 4 characters
   (audited), and you'll be redirected to the impersonated portal with
   the orange "Previewing as …" banner visible at the top. Click
   "Exit View-As" in the banner to come back to the admin shell.

To promote a second account in the future:

```sql
UPDATE users SET role = 'admin' WHERE openId = '<their open id>';
```

(See `server/db.ts` for a typed helper if you'd rather do this through
a tRPC procedure.)

---

## 8. Mobile / tablet coverage

The shell is built mobile-first:

- The 19-item sidebar collapses into a `Sheet` drawer below `lg`.
- The welcome strip stacks (`flex-wrap`) below `md`.
- `OperationalPage` KPI strips are `grid-cols-2 md:grid-cols-4`.
- Module data tables use `overflow-x-auto` with sticky header and a
  minimum width of 720 px so the table never breaks the viewport.
- `<ImpersonationBanner />` is full-width on every viewport.

Manual viewport sweep (320 / 414 / 768 / 1024 / 1440) was performed via
the dev preview screenshot pipeline. No layout breaks observed; no
horizontal scroll on the shell, only inside data tables (intentional).

---

## 9. Known issues / open todos within the Admin Portal

- The audit log `provider` column accepts `"manus"` and `"admin"`; older
  rows pre-rename are still queryable but the timeline filter does not
  yet group them. Low priority.
- `admin.aiScans`, `admin.reports`, `admin.documents` and the campaign
  /agent/automation aggregates still return synthesised demo data
  alongside any DB rows. The endpoints are shaped exactly like the
  future production payload, so swapping them is a back-end-only
  change. Tracked under the Phase 2 polish list in `todo.md`.
- View-As is currently visual only — a Super Admin acting through an
  impersonated session still sees their real `ctx.user.role` server-
  side. We deliberately did **not** elevate or de-elevate the role for
  safety; if we ever want truly read-only impersonation that's a
  separate scope.
- No e2e Playwright pass yet; we lean on unit tests + screenshot-based
  visual checks. If the team wants browser-driven flows for the 19
  routes, that's a separate ticket.

---

## 10. File map

```
server/
  routers/admin.ts                 ← 18 module endpoints + admin.action + admin.viewAs
  _core/viewAsRoute.ts             ← POST/DELETE /api/admin/view-as, JWT helpers
  _core/context.ts                 ← impersonation merging
  _core/index.ts                   ← view-as routes mounted
  routers.ts                       ← auth.me exposes impersonation
  admin.summary.test.ts            ← updated for new provider/reason
  admin.modules.test.ts            ← 59 new specs (RBAC + audit)
  viewAs.test.ts                   ← 5 new specs (JWT crypto)

client/src/
  pages/admin/components/AdminLayout.tsx       ← View-As triggers
  pages/admin/AdminPortal.tsx                  ← section dispatcher
  pages/admin/sections/_shared/OperationalPage.tsx
  pages/admin/sections/_shared/ModuleState.tsx ← state boundary + audited-action hook
  pages/admin/sections/{ExecutiveOverview,CrmLeads,Clients,AiScans,
                        ReportsProjectsBillingDocs,DevSecCampAgents,
                        AutomationsAnalyticsRest}.tsx
  pages/client-portal/ClientPortal.tsx         ← admin impersonation aware
  pages/developer-workspace/DeveloperWorkspace.tsx ← admin impersonation aware
  components/ImpersonationBanner.tsx           ← exit View-As control
```

— Manus AI
