# IO SKY — Client Portal Sidebar Functional Logic (master spec)

> This file is a verbatim distillation of the user's
> `IO_SKY_CLIENT_PORTAL_SIDEBAR_FUNCTIONAL_LOGIC_MASTER.pdf` so we never need to
> re-view the PDF. It is the contract for `/client-portal/*`.

## 1. Master rule
Every sidebar item must perform a real route transition, permission check,
organization_id-scoped load, loading state, render, audit log where relevant,
error/empty/success states, and mobile-responsive behaviour.

Clients only see their own organization's data. Never expose admin/developer
controls, other clients, internal CRM notes, internal AI scoring logic, API
keys, raw database records, security monitoring centre or backend infra.

## 2. Unified login
Login goes through one portal only. After successful auth, detect role and
redirect: client / client_member → `/client-portal`. Required gates: user
exists, role is client/client_member, organization_id exists, account active,
MFA completed if required, session valid. Then load only records where
`organization_id = current_user.organization_id`.

## 3. Required sidebar items
1. Dashboard — `/client-portal`
2. Reports — `/client-portal/reports`
3. AI Scan History — `/client-portal/ai-scans`
4. Recommendations — `/client-portal/recommendations`
5. Strategy Calls — `/client-portal/strategy-calls`
6. Invoices & Billing — `/client-portal/billing`
7. Documents — `/client-portal/documents`
8. Messages — `/client-portal/messages`
9. Account Settings — `/client-portal/account`
10. Security Center — `/client-portal/security`
11. Support — `/client-portal/support`

Each route requires loading / empty / error / success / permission-denied /
mobile responsive states.

## 4. Dashboard (`/client-portal`)
Visible: latest report card, operational score, active recommendations,
upcoming strategy call, project progress summary, billing status, secure
documents count, unread messages, security status.
Forbidden: raw client records, admin notes, internal CRM scoring, other
clients, developer assignments.
DB: organizations, users, reports, recommendations, bookings, invoices,
messages, activity_events, security_events.
States: loading skeleton, empty first-login, normal dashboard, error with
support CTA.

## 5. Reports (`/client-portal/reports`)
Show reports `WHERE organization_id = current` sorted by newest. Visible:
title, scan type, date, status, page count, executive preview, View, Download
PDF, Email Report. Buttons:
- View Report → `/client-portal/reports/{reportId}` secure viewer.
- Download PDF → permission check, signed cloud URL, log download, start.
- Email Report → verify recipient, send secure link, log email event.
Forbidden: other org reports, drafts not released, raw AI prompts, admin notes.
DB: reports, report_sections, report_downloads, email_events, audit_logs,
cloud_files. Cloud: encrypted PDFs, signed temporary URLs only. Admin notify
when high-value reports are downloaded or emailed.

## 6. AI Scan History (`/client-portal/ai-scans`)
Load scan sessions for organization_id. Statuses: Draft, Completed, Report
Generated, Awaiting Expert Review, Released. Allow continuation of unfinished
scans if permitted. Buttons:
- Continue Scan → `/ai-scan/session/{scanSessionId}` (resume saved answers).
- View Results → `/client-portal/ai-scans/{scanSessionId}` (score dashboard).
- View Report → report route if released.
Forbidden: weights, hidden recommendation logic, other org scans, admin
notes. DB: ai_scan_sessions, ai_scan_answers, scan_scores, reports,
ecosystem_recommendations, audit_logs. Automation: completion triggers
scoring, rec engine, report generation, admin notification, portal visibility.

## 7. Recommendations (`/client-portal/recommendations`)
Load recommendations linked to organization_id. Show priority, impact, related
report/scan, status, next action. Visible: rec cards, impact tags, expected
outcome, related service/ecosystem, roadmap CTA. Buttons:
- Review Recommendation → `/client-portal/recommendations/{recommendationId}`.
- Book Strategy Call → `/book-strategy-call?rec={id}` prefilled.
- Request Proposal → create CRM proposal request, notify admin, confirmation.
- Start Implementation → create implementation interest record, notify admin.
Forbidden: internal pricing margins, internal lead score, admin reasoning,
non-client recs. DB: ecosystem_recommendations, reports, ai_scan_sessions,
crm_leads, proposal_requests, notifications, audit_logs.

## 8. Strategy Calls (`/client-portal/strategy-calls`)
Load bookings linked to organization_id. Show upcoming + past calls,
preparation notes visible to client, join/reschedule. Visible: call type,
date/time, timezone, status, join link, reschedule, prep questions, related
scan/report. Buttons:
- Book New Call → `/book-strategy-call` with client context.
- Join Call → open meeting link if time window valid.
- Reschedule → open scheduling flow, update booking, notify admin, email.
- Cancel Request → create cancellation request, notify admin, update status.
Forbidden: admin private notes, internal qualification score, other clients.
DB: bookings, calendar_events, booking_answers, notifications, email_events,
audit_logs. Automation: 24h + 1h reminders; admin dashboard notification on
booking/reschedule/cancel.

## 9. Invoices & Billing (`/client-portal/billing`)
Load invoices + payments for organization_id. Show open/paid/overdue
invoices, setup fees, monthly retainers. Visible: status, amount, due date,
payment method, receipts, subscriptions, Pay Now, Download Receipt.
Payment options: Stripe Checkout, credit card, iDEAL, PayPal. Buttons:
- Pay Invoice → create checkout session, redirect, update on webhook.
- Download Invoice → signed URL, audit log.
- Download Receipt → signed URL, audit log.
- Update Payment Method → secure update flow.
Forbidden: processor secrets, margins, admin payment settings, other clients.
DB: invoices, payments, subscriptions, payment_methods, receipts, audit_logs.
Admin notify on payment success / failure / overdue.

## 10. Documents (`/client-portal/documents`)
Load documents `WHERE organization_id = current AND visibility = client_visible`.
Folders: Reports, Invoices, Agreements, Uploaded Documents, Shared Files.
Buttons:
- Upload Document → validate, scan, encrypted store, DB record, notify admin.
- Download Document → permission check, signed URL, audit log.
- Delete Request → create request for admin review (no hard delete).
- Preview Document → secure viewer if file type supported.
Forbidden: admin-only files, developer files, other clients, raw bucket paths.
DB: documents, cloud_files, document_events, audit_logs, notifications.
Cloud: encrypted storage, signed URLs only, no public buckets.

## 11. Messages (`/client-portal/messages`)
Load message threads for organization_id, only client-authorized threads.
Visible: admin/client messages, attachments, read status, reply box. Buttons:
- Open Thread → load messages.
- Send Message → save, notify admin, audit event.
- Attach File → secure upload, link to message, notify admin.
Forbidden: direct developer comms, internal admin discussions, other clients.
Important: clients cannot directly message developers; everything routes
through IO SKY admin/team.

## 12. Account Settings (`/client-portal/account`)
Visible: name, email, phone, job title, company info, language preference,
notification preferences. Buttons:
- Save Profile → validate, update DB, audit log.
- Change Email → require verification + MFA, update after confirmation.
- Change Phone → require verification code.
- Update Company Info → update org profile, notify admin if important fields.
- Change Language → update preference, refresh localized UI.
Forbidden: role escalation, permission changes, other users (unless org
manager). DB: users, organizations, user_preferences, audit_logs,
verification_codes.

## 13. Security Center (`/client-portal/security`)
Visible: MFA status, active sessions, trusted devices, recent login activity,
password update, SMS/email/authenticator MFA options. Buttons:
- Enable MFA → choose method, verify 6-digit code, save.
- Disable MFA → require password + MFA confirmation, notify admin (high risk).
- Logout Device → revoke session, audit log.
- Change Password → validate current, enforce strong, notify user.
- Download Security Activity → export own account activity only.
Forbidden: platform-wide events, other users, admin monitoring dashboard.
Admin notify on MFA disabled, suspicious login, new device, repeated failures.

## 14. Support (`/client-portal/support`)
Visible: create ticket, ticket history, status, priority, category, replies.
Buttons:
- Create Ticket → save, notify admin, confirmation.
- Open Ticket → load details.
- Reply → save reply, notify admin.
- Attach File → secure upload, scan, link to ticket, log event.
- Close Ticket → update status, log event.
Forbidden: developer tickets, internal notes, other clients.
DB: support_tickets, support_messages, attachments, notifications, audit_logs.

## 15. Global states for every page
Loading skeleton, empty (helpful next-best action), error (calm with retry +
support CTA), success (polished confirmation), permission-denied (no
technical details, secure access message), mobile (stacked, sidebar
collapsed into secure drawer).

## 16. Database & permission filtering
Every query enforces: authenticated user id, active session, client role,
organization_id filter, permission scope, record visibility status. Sample:
`SELECT reports WHERE organization_id = current_user.organization_id AND
visibility = 'client_visible';`
Backend MUST enforce — frontend hiding alone is insufficient.

## 17. Final rule
Sidebar must operate as a real client workspace. Every item meaningful, every
click a real route, every dataset client-specific, every important action
logged, every cloud file permission-protected. No loose buttons, no fake
panels, no static dashboards.
