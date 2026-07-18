# IO SKY — Client Portal Master Specification (condensed)

Source: `/home/ubuntu/upload/IO_SKY_CLIENT_PORTAL_MASTER_SPECIFICATION(1).pdf` (8 pages).
Captured 2026-05-22.

## Master purpose
Private operational-intelligence workspace per client organization. Must feel
premium, secure, calm, enterprise-grade. "This is **my** private IO SKY
operational-intelligence environment."

Portal must **never** expose admin tools, developer tools, backend systems,
internal software links, database controls, audit administration, security
monitoring controls, API keys, infrastructure settings, or sensitive internal
IO SKY operations.

## Login change
- Remove visible portal-selection cards on `/login`.
- Single unified login. After auth, server detects role and redirects:
  - `client` → `/client-portal`
  - `admin`  → `/admin`
  - `developer` → `/developer-workspace`
- Role detection is automatic, secure and **logged**.

## Routing architecture
- `/client-portal` — overview dashboard
- `/client-portal/reports` — AI Scan reports + operational intelligence PDFs
- `/client-portal/recommendations` — ecosystem recommendations + roadmap actions
- `/client-portal/projects` — project status, milestones, implementation progress
- `/client-portal/billing` — invoices, payments, subscriptions, receipts
- `/client-portal/documents` — secure uploads / downloads
- `/client-portal/messages` — secure communication center
- `/client-portal/strategy-calls` — consultation bookings + call history
- `/client-portal/company` — company profile + operational details
- `/client-portal/security` — login security, MFA, sessions
- `/client-portal/support` — support requests + help center

Every route loads **real client-specific data** scoped to the company.

## What a client may see (tenant-isolated)
Their own AI Scan results & reports; ecosystem recommendations for their
company; invoices + payment status; documents uploaded by their company or
shared by IO SKY; active project phases & milestones; their strategy-call
bookings + meeting notes; secure messages between IO SKY and them; company
profile; their own security settings; support tickets they raised.

## What clients must NOT see
Admin dashboard, developer workspace, internal CRM pipelines, internal lead
scores, internal cost/margin calculations, database tables, backend infra,
audit logs outside their own account, API keys, internal integration secrets,
other client records, developer applications / permissions, admin approvals,
system-wide analytics, raw AI prompts, internal scoring rules, hidden
recommendation logic.

## Dashboard layout (progressive disclosure)
Top: welcome with company name, current operational status, next recommended
action, quick link to latest report.

Primary cards: Latest AI Scan Report · Recommended Ecosystem · Project
Progress · Upcoming Strategy Call · Billing Status · Secure Documents.

Secondary area: notifications · recent activity · messages · security status.

## Button behaviour
- View Report → `/client-portal/reports/{id}`
- Download PDF → permission check, signed URL, audit log, download
- Email Report → verify permission, send secure link, log delivery
- Book Strategy Call → opens booking flow + persists + creates CRM lead +
  notifies admin
- Upload Document → secure modal, malware scan, encrypted storage, signed URL,
  audit log
- Pay Invoice → opens checkout flow (Stripe / iDEAL / PayPal)
- Enable 2FA → starts MFA setup
- Create Support Request → creates ticket, notifies admin, shows confirmation

## Payments & billing
- Stripe Checkout (credit card · iDEAL · PayPal)
- Routes: `/checkout/ai-scan/{free|growth|elite}`,
  `/checkout/ecosystem/{growth|enterprise|elite}`,
  `/client-portal/billing/invoice/{invoiceId}`
- On success: update invoice status, create receipt, notify admin, send
  confirmation email, unlock correct scan/ecosystem access, log transaction.

## Cross-product flows
- AI Scan: select → answer questions → pay if needed → report generation →
  saved to client portal → admin notified
- Solutions: select ecosystem → request proposal or checkout → CRM
  lead/project created → portal shows recommendation/proposal/project
- Recommendations carry CTAs: Review Recommendation · Book Strategy Call ·
  Request Proposal · Start Implementation

## MFA / 2FA
Authenticator app 6-digit code, email verification code, SMS verification
code. Failed attempts rate-limited, codes expire after short window,
successful login creates secure session + audit log. High-risk actions
(changing email, downloading sensitive reports, changing billing info) require
re-authentication or MFA confirmation.

## Database architecture
PostgreSQL or equivalent. Required tables: users, organizations,
organization_memberships, roles, permissions, sessions, mfa_methods,
login_attempts, ai_scan_sessions, ai_scan_answers, scan_scores, reports,
report_downloads, ecosystem_recommendations, projects, project_milestones,
invoices, payments, payment_methods, documents, messages, support_tickets,
bookings, notifications, audit_logs, security_events, cloud_files.

Every record must be connected to **organization_id** where relevant to
enforce tenant isolation.

## Cloud storage
S3 / R2 / Supabase style. Store AI Scan PDFs, invoices, uploaded docs, signed
agreements, project files, backups. Required behaviour: encrypted storage,
signed temporary URLs, file size/type validation, malware scanning where
possible, access permission checks before download, audit log for
upload/download/delete, automatic backups, retention policies, admin
notification for important uploads.

## Admin notifications
Admin must receive notifications when: client logs in from a new device,
client completes AI Scan, report is generated, report is downloaded, invoice
is paid, payment fails, document is uploaded, strategy call is booked,
support ticket is created, company profile is changed, MFA is disabled,
suspicious activity detected.

## Security monitoring
Role-based access control, least-privilege, tenant isolation, encryption in
transit and at rest, secure cookies, CSRF protection, rate limiting, brute
force protection, MFA/2FA, signed URLs, audit logging, anomaly detection,
suspicious login detection, fraud monitoring, file upload scanning, backups
and disaster recovery, admin alerting.

## Automation
- AI Scan completion → report auto-generated, saved to portal, admin notified
- Report saved → auto-emailed
- Payment success → access auto-unlocked, invoice marked paid
- Document upload → admin notified
- Strategy call booking → CRM lead + admin notification
- Support ticket → admin workflow + acknowledge
- Security events → audit log entries

## Design language
Deep navy-black atmosphere · premium glass surfaces · restrained orange hover
system · cinematic spacing · executive typography · calm hierarchy · subtle
motion · summaries first then details after interaction · restrained orange
interaction language on every hover/modal/card/button.

## Final rule
The Client Portal must function as a real production-grade client operating
environment. Everything visible connects to database records, cloud files,
automation workflows, admin notifications, security logs and client-specific
permissions. No placeholders. No fake data in production. No exposed
admin/developer controls. No dead routes. Secure, premium, automated, fully
consistent with the IO SKY ecosystem.
