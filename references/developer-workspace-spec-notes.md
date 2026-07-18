# IO SKY Developer Workspace — Spec Notes

Sources:
- `IO_SKY_DEVELOPER_WORKSPACE_SIDEBAR_FUNCTIONAL_LOGIC_MASTER.pdf` (8 pages)
- `IO_SKY_DEVELOPER_PORTAL_MASTER_SPECIFICATION.pdf`
- `pasted_content_8.txt`
- Reference screenshot `developersworkspace.png`

## Master rule
Every sidebar item is functional. No dead buttons, no decorative panels. Each
click performs: route transition → auth check → role check → assignment +
permission check → expiration check → loading state → render → audit/event
log → admin notification (where relevant) → error/empty/success states.

Developers may ONLY see admin-assigned work. Never client contacts, CRM,
financials, admin notes, security monitoring center, other developers'
workspaces, or direct client communication.

## Unified login
One login portal only. Post-OAuth router:
- `client` → `/client-portal`
- `admin`  → `/admin`
- `developer` → `/developer-workspace`

Developer redirect requires: role=developer, account approved + active,
MFA enrolled, agreements signed, access not expired, at least one
assignment. All redirects + denials must be logged.

## Sidebar (11 items) — exact order
1. Overview
2. Assigned Projects
3. Tasks
4. Files
5. Submissions
6. Messages
7. Access Scope
8. Agreements
9. Profile & Availability
10. Security
11. Support

## Per-route requirements (PDF §4–§13 + pasted §5–§15)

### `/developer-workspace` (Overview)
Loads: profile, active assignment count, pending tasks count, latest admin
messages, access expiration status, agreement status, MFA/security status,
latest submissions. Forbidden: CRM, invoices, admin notes, system-wide
analytics, security monitoring center. States: loading, no-assignments,
agreement-required, access-expired, normal, error.

### `/developer-workspace/projects` (Assigned Projects)
Query `developer_project_assignments` where developer_id = current_user
AND status = active. Each card: title, assignment status, technical scope,
due date, priority, files count, tasks count, admin notes flagged
`developer_visible` only. Buttons: Open Project (route to detail), Request
Clarification (admin-only message), Submit Work (submission flow).
Forbidden: client contact info, financials, client portal, admin-only
notes, other project records, unassigned projects.

### `/developer-workspace/tasks`
Query `developer_task_assignments` by developer_id, filter by active
access scope, group by project + status. Visible: title, description,
priority, due date, project, status, acceptance criteria,
developer-visible comments. Buttons: Open Task, Mark In Progress (notify
admin), Submit For Review (upload/attach + status flip + notify), Ask
Question (admin-only thread).

### `/developer-workspace/files`
Show approved project files only. `project_files` linked to active
assignments AND `developer_visible = true` AND access_scope allows.
Visible: filename, type, project, upload date, version, download button,
preview if allowed. Buttons: Preview (secure viewer), Download (perm
check + signed temporary URL + log download), Upload Related File
(validate + scan + store in cloud + link + notify). Forbidden: raw bucket
paths, client-only files, admin-only files, other developers'
submissions, unrestricted folder browsing. Storage: encrypted, signed
URLs, no public buckets, malware scan where possible, automatic revoke
after unassignment/expiration.

### `/developer-workspace/submissions`
Query `developer_submissions` by developer_id. Statuses: Draft,
Submitted, In Review, Changes Requested, Approved, Rejected. Buttons:
Create Submission (project/task picker + upload + notes + submit), View
Feedback (admin feedback), Resubmit (upload revision + version +
notify). Notify admin on every (re)submission.

### `/developer-workspace/messages`
Strict rule: Developer ↔ IO SKY Admin only. Never expose client identity.
Project/task linked threads. Secure attachments.

### `/developer-workspace/access`
Show: assigned projects, permission level, allowed actions, access
expiration, restricted actions. Buttons: Request Access Extension,
Request Additional Access (each saves DB row + notifies admin + logs).

### `/developer-workspace/agreements`
NDA, confidentiality, client protection, non-solicitation, security
policy ack, liability ack. Cannot access work without all accepted +
MFA enabled. Store: timestamp, version, developer_id, IP/device meta.

### `/developer-workspace/profile`
Full name, timezone, specialties, LinkedIn, GitHub, portfolio,
availability. Visible to admin only.

### `/developer-workspace/security`
MFA / 2FA (authenticator app, email, SMS), trusted devices, active
sessions, password update, login history. Notify admin on: MFA
disabled, suspicious login, unusual country/IP, repeated failed logins,
risky device.

### `/developer-workspace/support`
Developer ↔ Admin only. Buttons: Create Ticket, Reply, Attach File,
Close Ticket. Every action logged + admin notified.

## Database models (per spec §16)
users, roles, permissions, developer_profiles,
developer_project_assignments, developer_task_assignments,
developer_access_scopes, developer_messages, developer_submissions,
project_files, cloud_files, support_tickets, notifications, audit_logs,
security_events, sessions, mfa_methods, agreements.

Every query MUST enforce developer_id, assignment scope, access
expiration, permission checks. Frontend hiding alone is forbidden.

## Design language
Deep navy-black background, premium glass cards, restrained orange
hover, cinematic spacing, executive typography, subtle motion. Minimal,
elite, controlled, secure.

## Validation checklist
Every sidebar item works · every route protected · every query
assignment-filtered · no client communication possible · files use
signed URLs · MFA enforced · admin notifications working · audit logs
created · mobile responsive · no dead routes · no placeholder panels ·
no console errors. Final implementation report PDF at the end.


## Additional details (PDF pages 5–8)

### Messages — button logic
- Open Thread → load messages.
- Send Message → save message, notify admin, audit log.
- Attach File → validate, scan, upload to cloud, link to thread, notify admin.
- Forbidden: direct client communication, client email/phone, client chat, other developer messages, admin internal threads.

### Access Scope (`/developer-workspace/access`)
Visible: current role, permission level, assigned projects, allowed actions, file access summary, expiration date, restricted actions, access status.
Buttons: Request Access Extension (admin approval request + notify), Request Additional Access (with reason + notify), View Access History (own only).
DB: developer_access_scopes, developer_project_assignments, permission_events, access_extension_requests, notifications, audit_logs.
Automation: access expiration auto-hides assignments and revokes signed file access.

### Agreements (`/developer-workspace/agreements`)
Buttons: Review Agreement → open viewer; Accept/Sign → capture acceptance, timestamp, version, IP/device meta, save record; Download Copy → signed URL to PDF, audit log.
Critical rule: developer cannot access assigned work until ALL required agreements are accepted AND MFA is enabled.
DB: developer_agreements, agreement_versions, cloud_files, audit_logs.

### Profile & Availability (`/developer-workspace/profile`)
Visible (admin-only): full name, country, timezone, LinkedIn, GitHub, portfolio, specialties, preferred technologies, AI experience, enterprise experience, availability, working hours.
Buttons: Save Profile (validate, update, notify admin if key fields change), Update Availability, Upload Portfolio File (cloud upload + validate + scan + store + audit).
DB: developer_profiles, developer_availability, profile_events, cloud_files, audit_logs.

### Security (`/developer-workspace/security`)
Buttons:
- Enable MFA → choose authenticator/email/SMS, verify 6-digit code, save method.
- Change Password → require current password, enforce strong password, audit log.
- Logout Device → revoke session, audit log.
- Download Own Security Activity → export own account activity only.
Forbidden: global security monitoring, other users' sessions, admin security dashboard, platform-wide incidents.
Admin notifications: MFA disabled, suspicious login, repeated failed attempts, new risky device, unusual country/IP.

### Support (`/developer-workspace/support`)
Visible: create support request, ticket history, status, admin replies.
Buttons: Create Ticket (save + notify), Open Ticket (load detail), Reply (save + notify), Attach File (validate + scan + upload + audit).
Forbidden: client support tickets, other developer tickets, admin internal notes.
DB: developer_support_tickets, support_messages, cloud_files, notifications, audit_logs.

### Permission filtering (every query)
Must enforce: authenticated user_id, active developer role, approved status, MFA completed, agreements signed, access scope active, assignment exists, access not expired.

### Cloud storage rules
No public buckets, no direct bucket paths, signed temporary URLs only, permission check before URL generation, upload validation, malware scanning where possible, file access audit logs, automatic revocation after unassignment/expiration, separate storage paths for approved files vs developer submissions.

### Global states for every page
Loading (premium skeleton), empty (calm with next-best-action), error (secure with retry/support), permission-denied (do NOT expose technical details), access-expired (explain + show extension CTA), agreement-required (CTA), MFA-required (route to security setup), success (polished confirmation), mobile (sidebar collapses to drawer).

### Final rule
Restricted engineering workspace: every click is meaningful, every dataset assignment-specific, every important action logged. No loose buttons, no fake panels, no static dashboards, no direct developer-client communication.


## Master Spec PDF — additional cross-references

- Routing architecture additions: `/developer-workspace/commits` listed in the Master Spec PDF (technical update submissions or linked repository activity). Reconciled with sidebar logic master: implement `commits` as a sub-area under Submissions (reuse the table) rather than a separate sidebar item, since the sidebar logic master defines exactly 11 items.
- Onboarding flow: developer applies via `/engineering-access`, submits profile, accepts NDA / confidentiality / non-solicitation / liability, application stored with `pending` status, admin approves/rejects, account created with default zero project access, MFA must be enabled before seeing assigned projects.
- Non-solicitation: developers may not directly or indirectly contact IO SKY clients outside approved IO SKY operational workflows for 10 years after engagement termination.
- Database: users, roles, permissions, developer_profiles, developer_applications, developer_agreements, developer_access_scopes, developer_project_assignments, developer_task_assignments, projects, project_tasks, project_files, developer_messages, developer_submissions, access_extension_requests, audit_logs, security_events, login_attempts, mfa_methods, sessions, cloud_files, notifications.
- Cloud storage separation: client files / admin files / developer-accessible approved files / developer submissions / agreements / logs+exports — must remain isolated paths.
- Temporary access + expiration: when access expires, developer loses project visibility, file signed URLs are invalidated, active sessions may be restricted/terminated, admin gets event notification, audit log row created.
- Security monitoring: 24/7 detection of repeated failed logins, unusual country/IP, download spikes, access attempts to unauthorized routes, expired access attempts, role escalation attempts, suspicious file uploads, abnormal API usage, attempts to access client/admin routes, attempts to enumerate files/records.
- Admin notifications required for: developer applies, signs agreements, uploads work, asks question, requests extension, triggers security event, access expires, suspicious activity.
- Developer dashboard layout (top): welcome message, current access status, access expiration date, assigned project count, pending tasks count.
- Primary cards: Assigned Projects, Active Tasks, Latest Admin Messages, Required Agreements, Security Status, Access Scope.
- Secondary area: recent activity, submitted work, technical notices, support requests.
- Forbidden on dashboard: CRM, client panels, invoices, sales metrics, admin controls.
