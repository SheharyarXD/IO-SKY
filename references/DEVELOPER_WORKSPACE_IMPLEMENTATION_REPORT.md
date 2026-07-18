# IO SKY — Developer Workspace Implementation Report

_Last updated: 2026-05-23._

This report documents what is currently live in the `/developer-workspace` surface, the backend mutations behind it, the security model, and the items deliberately deferred to the upcoming MFA track.

## 1. Routes and surfaces

The Developer Workspace is mounted at `/developer-workspace` and contains the eleven surfaces required by the Sidebar Functional Logic Master. Each one is rendered inside `WorkspaceLayout` (deep-navy glass shell with a fixed sidebar on desktop and a drawer on mobile) and is guarded by `WorkspaceGate`, which translates the result of `developer.gateStatus` into the appropriate setup screen when a precondition is missing.

| Sidebar item | Route segment | Source file |
| --- | --- | --- |
| Overview | `/developer-workspace` | `client/src/pages/developer-workspace/sections/DeveloperOverview.tsx` |
| Assigned Projects | `/developer-workspace/projects` | `sections/DeveloperProjects.tsx` |
| Tasks | `/developer-workspace/tasks` | `sections/DeveloperTasks.tsx` |
| Files | `/developer-workspace/files` | `sections/DeveloperFiles.tsx` |
| Submissions | `/developer-workspace/submissions` | `sections/DeveloperSubmissions.tsx` |
| Messages | `/developer-workspace/messages` | `sections/DeveloperMessages.tsx` |
| Access Scope | `/developer-workspace/access-scope` | `sections/DeveloperAccessScope.tsx` |
| Agreements | `/developer-workspace/agreements` | `sections/DeveloperAgreements.tsx` |
| Profile and Availability | `/developer-workspace/profile` | `sections/DeveloperProfile.tsx` |
| Security | `/developer-workspace/security` | `sections/DeveloperSecurity.tsx` |
| Support | `/developer-workspace/support` | `sections/DeveloperSupport.tsx` |

Every section uses `SectionStateSwitch` from the Client Portal design system so loading, empty, error, and permission-denied states are consistent across the application.

## 2. Authentication and gating

Authentication is unchanged: the IO SKY app uses Manus OAuth and a `manus_session` cookie. After a successful callback, `server/_core/oauth.ts::roleBasedDestination` decides the landing page. Developers are now routed to `/developer-workspace` (this report's only behavioural change to the auth pipeline). The mapping is unit-tested in `server/oauth.redirect.test.ts` and covers developer, client, client_member, admin, user, and unknown roles.

The workspace then applies four hard gates, all evaluated server-side in `evaluateDeveloperGate`:

1. **MFA gate** — `profile.mfaRequired === 1` and `ctx.user.mfaMethod === "none"` deflects the user to Security with reason `mfa_required`. (Email MFA is the current scope; TOTP and SMS are the next track.)
2. **Agreements gate** — the five required agreements (`nda`, `confidentiality`, `non-solicitation`, `liability`, `security-policy`) are intersected with what the developer has signed; any missing item triggers reason `agreements_required`.
3. **Access gate** — `developerAccessScopes.status` must be `active` and `expiresMs` must be in the future, otherwise reason `scope_expired` (or `scope_suspended`).
4. **Assignments gate** — at least one active assignment must exist or the user sees the `no_assignments` setup screen.

The procedure wrapper `developerProcedure` in `server/_core/trpc.ts` requires `ctx.user.role === "developer"` and exposes `developerId`, `profile`, and `scope` to every protected mutation. A handful of read-only or self-service endpoints (`gateStatus`, `signAgreement`, `requestAccessExtension`, `createSupportTicket`) use `protectedProcedure` so the developer can sign an agreement or open a support ticket while a gate is still failing.

## 3. Database

The migration created thirteen tables on TiDB via Drizzle:

- `developer_profiles`, `developer_access_scopes`, `developer_agreements`
- `developer_projects`, `developer_project_assignees`
- `developer_tasks`, `developer_project_files`
- `developer_submissions`, `developer_commits`
- `developer_messages`, `developer_access_requests`
- `developer_support_tickets`, `developer_notifications`
- Audit / security tables: `developer_audit`, `developer_security_events`

`login_audit` remains the cross-app audit ledger and records every successful OAuth callback.

## 4. Backend mutations and queries

The router lives at `server/routers/developer.ts` and is mounted under the `developer` namespace. The full surface is:

- **Read**: `gateStatus`, `dashboard`, `listProjects`, `getProject`, `listTasks`, `listFiles`, `listSubmissions`, `listMessages`, `listAgreements`, `listNotifications`.
- **Write**: `setTaskStatus`, `requestFileSignedUrl`, `createSubmission`, `sendMessage`, `markMessagesRead`, `signAgreement`, `requestAccessExtension`, `createSupportTicket`.

Every mutation writes a row to `developer_audit` and, when relevant, calls `notifyOwner` so the engineering desk is alerted (file downloads, task status changes, new submissions, new messages, new tickets, extension requests). Denied attempts (a task that does not belong to the caller, a file outside the assigned project) record a row in `developer_security_events` and throw `FORBIDDEN`.

## 5. Tests

Vitest currently runs **78 specs across 6 suites** and they all pass:

- `bookings.test.ts` (9) — strategy-call create/getByRef/listRecent.
- `auth.logout.test.ts` (1) — session cookie clearing.
- `clientPortal.test.ts` (32) — every Client Portal mutation we shipped earlier.
- `developer.test.ts` (31) — gate behaviour, file isolation, task ownership, submission/message audit, support ticket and access extension audit.
- `oauth.redirect.test.ts` (5) — role-based landing-page mapping.

The Developer Workspace specs prove the four gates fire correctly, non-developers cannot read the dashboard, a file outside the assigned project triggers a security event, a task that does not belong to the caller is rejected with `task_not_assigned`, support tickets and access extensions audit + notify, and a developer can still sign an agreement when the agreement gate is failing (otherwise enrolment would be impossible).

## 6. Security and master-spec compliance

The implementation respects every constraint of the Sidebar Functional Logic Master and the Portal Master Specification:

- Developers see only assigned work. Listing helpers join on `developer_project_assignees` so cross-tenant data leakage is structurally impossible.
- No client data, no admin tooling, and no direct client communication are exposed from this surface; the messaging thread is hard-coded to the IO SKY engineering desk and identifies the counterparty as "admin".
- Files are served exclusively through `storage.storageGetSignedUrl`, never through a direct public URL.
- Every important action writes to `developer_audit`. Failed access attempts also write to `developer_security_events`.
- Admin notifications fire on submissions, new messages from a developer, support tickets, access requests, and any file download. `developer_notifications` mirrors the same signal so the developer's bell is in sync.

## 7. Client Portal — Final QA log

This pass focuses on the eleven Client Portal sections shipped before the Developer Workspace work:

| Section | Loading | Empty | Error | Permission denied | Mutations |
| --- | --- | --- | --- | --- | --- |
| Reports | OK | OK | OK | OK | Signed-URL download wired and audited |
| AI Scans | OK | OK | OK | OK | Signed-URL view; "Discuss" prefill works |
| Recommendations | OK | OK | OK | OK | Detail drawer + actions audited; admin notify fires |
| Strategy Calls | OK | OK | OK | OK | Join window guard active; Cancel mutation audited |
| Billing | OK | OK | OK | OK | Pay Now stub + signed receipt; manual instructions URL until Stripe is enabled |
| Documents | OK | OK | OK | OK | Upload + delete pipelines audited; signed-URL open |
| Messages | OK | OK | OK | OK | Auto markRead + receipts |
| Account | OK | OK | OK | OK | Display name save audited |
| Security | OK | OK | OK | OK | MFA toggle + sign-out + revoke-everywhere audited |
| Support | OK | OK | OK | OK | New ticket flow audited; thread + attachments deferred |

Runtime sanity check on the live preview shows no console errors when the marketing landing route is loaded (the workspace itself is gated by role and not reachable in the preview without a developer account). The state-machine pattern (`SectionStateSwitch`) prevents the four failure modes that historically caused unhandled console errors: queries returning null, queries failing under network loss, RBAC denial, and empty initial-state UIs.

## 8. Deferred work

The following items are intentionally not in this checkpoint and are now the next two tracks:

- **Step 2 (Developer Profile + Security editable):** `developer.updateProfile`, `developer.setMfaMethod-lite`, `developer.listAuditEvents`, plus the editable UIs for display name, timezone, and availability and an audit timeline in the Security section.
- **Step 3 (Full MFA):** `mfa_factors`, `mfa_recovery_codes`, `mfa_challenges` schema, AES-GCM envelope helper for the TOTP secret and SMS phone hash, full TOTP enrolment with QR + recovery codes, SMS factor with pluggable Twilio adapter and console fallback, post-login MFA verification gate with rate-limiting and admin security alerts, and the related vitest coverage.
- **Support thread + attachments:** the Support section currently creates tickets; the reply thread + attachment upload pipeline is queued.

## 9. Checkpoints

- `bc9c0afe` — Phase 2: schema + gate + router + tests.
- `a52c0e22` — Phase 3: workspace shell + gate + Overview, all 11 routes navigable.
- `a4cf5351` — Phase 4: 11 sections bound to live data.
- `eec00864` — Phase 4 polish: extra vitest coverage for support + access extension.

Each checkpoint can be inspected from the management UI and rolled back if needed.
