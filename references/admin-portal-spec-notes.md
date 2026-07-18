# IO SKY — Admin Portal master spec notes (working file)

Captured from `IO_SKY_ADMIN_PORTAL_MASTER_SPECIFICATION.pdf`, `IO_SKY_ADMIN_PORTAL_SIDEBAR_FUNCTIONAL_LOGIC_MASTER.pdf`, `pasted_content_9.txt`, `pasted_content_10.txt`, plus the master screenshot
`/home/ubuntu/upload/ioskyadminportalpagecrm.png`.

## Master purpose

Operational command center for the entire IO SKY ecosystem. Manages CRM, lead qualification, client management, AI Scans, report generation, billing, projects, ecosystems, developers, permissions, cloud storage, notifications, automations, analytics, security monitoring, audit logs.

## Unified login rule

ONE login gateway. After auth, redirect by role:
- admin → `/admin`
- client / client_member → `/client-portal`
- developer → `/developer-workspace`
- user → `/account` (or `/`)

Admin accounts: invite/seed only, MFA required, audit-logged, RBAC-protected. No public portal selector cards anywhere.

## Sidebar (exactly 19 items)

1. Executive Overview                 → `/admin`
2. CRM & Leads                        → `/admin/crm`
3. Clients                            → `/admin/clients`
4. AI Scans                           → `/admin/ai-scans`
5. Reports                            → `/admin/reports`
6. Projects & Ecosystems              → `/admin/projects`
7. Strategy Calls                     → `/admin/strategy-calls` (replaces existing /admin/bookings)
8. Billing & Payments                 → `/admin/billing`
9. Documents & Storage                → `/admin/documents`
10. Developer Management              → `/admin/developers`
11. Security Monitoring               → `/admin/security`
12. Email/SMS Campaigns               → `/admin/campaigns`
13. AI Agents & IVR                   → `/admin/agents`
14. Notifications & Automations       → `/admin/automations`
15. Analytics & Insights              → `/admin/analytics`
16. Users & Permissions               → `/admin/users`
17. Audit Logs                        → `/admin/audit`
18. System Settings                   → `/admin/settings`
19. Support Desk                      → `/admin/support`

Every sidebar item must:
- open a real wouter route under `/admin/...`
- connect to backend logic (tRPC `admin.*` or existing routers)
- support loading + empty + error + permission-denied states
- create audit logs where applicable
- be mobile-responsive

## Executive Overview (the master screenshot)

Layout (12-col grid, deep navy bg):

- **Top bar**
  - Welcome strip (avatar pod) + "Welcome back, **Alex Admin**" with `Super Administrator` orange chip + tagline `"Operational intelligence transforms data into dominance."`
  - Center search ⌘K
  - Right cluster: notification icons (shield 7, mail 23, bell 12), `System Status / All Systems Operational` glass pill, date/time pill, IO mark avatar.

- **Action ribbon**: `View as ▾` (View as Client / View as Developer) + orange `+ Quick Actions` button.

- **6 KPI tiles** (single horizontal row): Total Revenue (MTD), Active Clients, AI Scans (Total), Open Projects, Open Tickets, System Health (with mini sparkline + delta chip). System Health shows 99.99% Excellent.

- **Row 2**: AI Operations Agent (left, ~33%) + Operational Command Center (center, ~42%) + Critical Alerts (right, ~25%).
  - **AI Operations Agent**: orange "LIVE" pulse, **(REPLACE the black robot art with the IO SKY symbol mark — keep all other styling)**, greeting "Good morning, Alex. I've analyzed all systems and prepared your operational brief.", 5 numbered insight chips (high priority alerts, automations failed, failed payments, reports awaiting approval, critical security event), buttons: `Ask Agent` (orange) / `Operational Brief` / `Run Diagnostics`.
  - **Operational Command Center**: glowing globe + 7 service rows (AI Scan Engine Operational, Report Pipeline Healthy, Automations Running, Email Service Healthy, SMS Service Healthy, AI Agents Operational, Cloud Infrastructure Healthy, Database Healthy, Backup & DR Protected). `Open Infrastructure Monitor` button.
  - **Critical Alerts**: 4 alert rows with severity chips (High / High / Medium / Medium) + `Open Security Center` and `3 Unread Alerts` link.

- **Row 3**: Revenue Intelligence chart (left ~33%) + Automation Center donut (center ~22%) + AI Agents & IVR Real-time table (~26%) + Recent Activity (right ~19%).

- **Row 4**: Temporary Access Control table (left ~33%) + Email & SMS Campaigns mini panel + System Health Overview matrix + Upcoming & Pending list with red counters.

- **Bottom strip**: Live feed bar (5 rolling events) + copyright line `© 2025 IO SKY. All rights reserved. Operational Intelligence Infrastructure.`

## AI Operations Agent — IO mark replacement

- Replace the black robot illustration at top-left of the AI Operations Agent card.
- Use the official IO SKY symbol mark (`<IOSkyLogo variant="mark" />` or `/manus-storage/iosymbol_*.svg`), at ~88px square, with subtle orange glow halo, matching the rest of the card's glass surface.
- Keep "LIVE" chip, greeting, insight list, and three buttons exactly as in the screenshot.

## Permissions / RBAC

- `adminProcedure` already exists (used in /admin/bookings) — extend, don't replace.
- Add `superAdminProcedure` if it doesn't exist; gate destructive operations.
- Every mutation must call `appendLoginAudit` (or a dedicated `audit_log` table) with `actor`, `action`, `targetId`, `outcome`, `reason`.

## Database additions (new for Admin Portal)

If not already present, add:
- `temporary_access_grants` (developer maintenance access window)
- `automation_runs` (queue + status + retries)
- `security_events` (suspicious login, brute force, etc.)
- `system_health_samples` (rolling status pings)
- `crm_leads` (separate from bookings)
- `campaigns` (email + sms)
- `agent_calls` (outbound + inbound)

(Several of these already exist — confirm before re-creating.)

## Design language

- Deep navy-black bg (`#0B1020`-ish), panel glass `rgba(26, 35, 51, 0.65)` with ~12px backdrop blur.
- Restrained orange accents `#FF6A00` only for live chips, primary CTAs, KPI deltas.
- Manrope display + Inter body + mono for eyebrows.
- Soft shadow over borders, glass surfaces, subtle radial glow.

## Today's task scope (this turn)

1. Replace ad-hoc `/admin/bookings` page with the canonical `/admin` Executive Overview that mirrors the master screenshot pixel-by-pixel — but with the IO mark in place of the robot.
2. Build the AdminLayout with the 19-item sidebar and welcome strip.
3. Wire role-based redirect: admin → `/admin` (already wired through `roleBasedDestination`).
4. Add backend: a small `admin.summary` tRPC endpoint that aggregates the KPI numbers, alerts, command center, automations, recent activity and feed events. Stub mock-but-shaped data for sections we haven't built yet, but pull live numbers from existing tables (clients, bookings, projects, leads, audit) where possible.
5. Add unit tests for `admin.summary` (admin gate + shape).
6. Save checkpoint.

Subsequent turns will populate the remaining 18 sidebar routes one or two at a time, each with a real backend procedure and tests. Sidebar items that don't yet have a dedicated page must show a tasteful "Operational module — coming online" empty-state card (NOT a generic "coming soon" stub).
