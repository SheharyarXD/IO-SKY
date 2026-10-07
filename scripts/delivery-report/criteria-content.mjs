/**
 * Delivery report: per criterion mapping.
 *
 * For each completed SRS criterion: the screenshot scene ids that evidence it
 * (ids from manifest.json), the test files whose results back it (matched by
 * file name substring against vitest.json), optional non screenshot evidence
 * blocks (keys of evidence-data.json) and one explanatory paragraph.
 */
const P = (...a) => a;
const PUB_ALL = P("pub-home", "pub-solutions", "pub-ai-scan", "pub-custom-software", "pub-about", "pub-contact", "pub-book", "pub-enterprise", "pub-infrastructure", "pub-security", "pub-intelligence", "pub-login");

export const MODULE_INTRO = {
  1: "The public website is the first thing a prospect sees. It routes visitors to the AI Scan, the Discovery Call booking and the contact form, captures leads into the CRM, and links to the legal documents.",
  2: "Identity covers invited only account creation, password recovery, multi factor authentication, session management and the rule that every person lands in the right portal. Every sign in event is written to an append only audit log.",
  3: "The AI Scan turns a questionnaire into a scored readiness report. A generated report is never shown to the customer until a named expert has reviewed and approved it, and every status change is written to an append only history.",
  4: "The Client Portal is the customer's own view of reports, projects, documents, invoices, messages, notifications and support, scoped strictly to their organization.",
  5: "The Developer Portal gives engineers only the projects they are assigned to: tasks, time registration, deliverable submission, internal messaging and a scoped, expiring access grant.",
  6: "The Admin Portal is the operating desk: customers, AI Scans and their review, reports, projects, developer assignment, billing and notifications, all behind multi factor authentication.",
  7: "The Super Admin capabilities add organizations, user and permission management, AI configuration with versioning, security monitoring, searchable audit logs and validated platform configuration.",
  8: "CRM and sales management cover leads, Discovery Calls and their outcomes, the opportunity lifecycle, proposals, activities and follow ups, the customer timeline, and hand over to delivery when an opportunity is won.",
  9: "Project and delivery management cover projects, tasks, milestones and deliverables, customer approvals, secure documentation, notifications, audit events and archiving under policy.",
  10: "Commercial billing covers quotations, invoice generation, subscriptions and financial reporting, with an audit record for every financial event.",
  11: "Notifications combine an 84 event catalogue, a single dispatcher, per user preferences with security notices always on, an append only communication history and recorded delivery failures.",
  12: "File and document management cover secure upload and download, version history, approval workflows, authorized search, automated document workflows and audit records.",
  13: "The AI Intelligence Layer governs agents, centrally managed and versioned prompts, execution auditing and human approval before anything reaches a customer.",
  14: "Audit, compliance and security monitoring cover business critical audit records, continuous monitoring, compliance checks, incident handling, alert rules, immutable history and security reports.",
  15: "Analytics and business intelligence cover dashboards, KPIs, generated and scheduled reports, twelve month history and dashboard permissions.",
  16: "Integration and API management cover API security, integration monitoring, enforced security controls, integration logs and alerts.",
  17: "The workflow engine runs event driven and scheduled workflows, supports approvals, keeps a run history, enforces security and is monitored.",
  18: "Platform configuration covers validated configuration changes, administrative permissions, change history, consistency, configurable security policies and AI configuration.",
  19: "Platform operations cover continuous monitoring, maintenance mode, operational incident management, release history and capacity monitoring.",
  20: "Global non functional requirements: the quality standards the platform is built and tested to.",
};

export const CRITERIA = {
  "SRS-01.1": { shots: ["pub-home", "pub-solutions", "pub-ai-scan", "pub-about", "pub-book", "pub-security"], tests: ["siteImages", "RouteTransition"], text: "Every public route renders from the live deployment: Home, Intelligence, Solutions, AI Scan, Custom Software, About, Contact, Book a Discovery Call, Enterprise, Infrastructure, Security and Sign in. The additional captures of the remaining public routes are in Appendix I." },
  "SRS-01.3": { shots: ["val-contact-empty", "val-contact-email", "val-login-disabled"], tests: ["contact-engineering-auth", "inputValidationCoverage", "Login.test"], text: "Forms validate on the client and again on the server. An empty contact form is refused, an invalid email address is rejected, and the sign in button stays disabled until the form is valid. Every tRPC procedure input is covered by a zod schema, and a test enforces that coverage." },
  "SRS-01.4": { shots: ["pub-contact", "pub-book"], tests: ["createLead", "contact-engineering-auth", "bookings.test", "solutions.test"], ev: ["counts"], text: "Contact, engineering, proposal, Discovery Call and AI Scan submissions create CRM records. The live database held the lead and booking counts shown on the evidence page when this report was generated." },
  "SRS-01.5": { shots: ["ad-bell", "ad-gov-comms"], tests: ["notificationDispatcher", "notificationCatalogue", "bookingReminders"], ev: ["emissions"], text: "Lead and booking events create notifications through the single dispatcher. The most recent emissions from the append only notification event log are printed on the evidence page." },
  "SRS-01.6": { shots: ["pub-login", "auth-anon-admin", "cl-dashboard", "dv-overview", "ad-landing"], tests: ["useRouteGuard", "oauth.redirect", "rbac.authOrigin"], text: "After authentication a client lands in the Client Portal, a developer in the Developer Workspace and an administrator in the Admin Portal. The screenshots are taken after real sign ins with three different demo accounts." },
  "SRS-01.9": { shots: ["pub-legal-privacy", "pub-legal-terms", "pub-legal-cookies", "pub-legal-ai", "pub-legal-dpa", "pub-legal-trust"], tests: ["legal.test", "requireAcceptances"], text: "Privacy policy, terms of service, cookie policy, AI disclaimer, data processing agreement and trust centre are published and reachable without signing in." },

  "SRS-02.1": { shots: ["auth-anon-admin", "auth-anon-client", "auth-anon-dev", "cl-forbidden-admin", "dv-forbidden-admin"], tests: ["rbac.authOrigin", "admin.modules", "ops.test", "developer.test", "rls.negative"], ev: ["rls"], text: "Anonymous visitors are sent to sign in. A signed in client who opens the admin address is sent to their own portal, and a developer is refused. Authorization is enforced on the server by role specific procedures, and row level security is enabled and forced on every public table." },
  "SRS-02.2": { shots: ["auth-no-signup", "pub-login"], tests: ["accounts.test", "supabaseAuth"], text: "The sign in page has no registration option. Accounts exist only through an invitation issued by an authorized administrator." },
  "SRS-02.3": { shots: ["act-invalid", "act-form", "act-weak", "act-success"], tests: ["accounts.test", "srsRules.test"], text: "An invitation link is hashed at rest, one time and valid for seven days. An invalid link gives one generic message, a weak password is refused with a reason, and a valid activation signs the new user in and routes them to the correct portal." },
  "SRS-02.4": { shots: ["auth-forgot", "auth-reset-invalid"], tests: ["supabaseAuth", "localAuth.errors", "policy.test"], text: "Password recovery starts from the sign in page. A reset link that is invalid or expired is refused without revealing whether an account exists." },
  "SRS-02.5": { shots: ["ad-landing", "ad-my-security", "ad-gov-audit-mfa"], tests: ["mfa.test", "mfaChallenge", "mfaTotp", "mfaCrypto", "localAuth.mfa", "admin.mfaPosture"], text: "Administrators sign in with a password and a time based one time code. TOTP secrets are envelope encrypted, recovery codes are single use, and the local password route enforces the second factor. If the factor lookup fails the sign in fails closed. The audit filter shows the recorded MFA challenges." },
  "SRS-02.6": { shots: ["cl-security", "dv-security", "ad-my-security"], tests: ["sessionRevocation", "policy.test", "cookieSecurity", "auth.logout"], text: "Sessions carry an issued at claim, can be revoked server side, use secure cookies and have a deliberate, configurable lifetime." },
  "SRS-02.7": { shots: ["cl-dashboard", "dv-overview", "ad-landing", "cl-forbidden-dev", "dv-forbidden-client"], tests: ["useRouteGuard", "oauth.redirect"], text: "Role based landing is automatic after every sign in path. Opening the wrong portal redirects or refuses." },
  "SRS-02.8": { shots: ["ad-audit", "ad-gov-audit", "ad-gov-audit-failed"], tests: ["auth.recordAttempt", "auditCoverage", "localAuth.errors"], ev: ["auditSample"], text: "Every sign in outcome, successful, failed, blocked or MFA required, is written to the login audit log. The latest rows are printed on the evidence page." },
  "SRS-02.9": { shots: ["ad-gov-audit-blocked", "cl-forbidden-admin", "dv-forbidden-admin", "auth-wrong-password"], tests: ["admin.srsOps", "auditCoverage", "rbac.authOrigin"], text: "A denied request is refused and recorded. The audit search can be filtered to denied access attempts, as shown." },

  "SRS-03.3": { shots: ["scan-q-start", "scan-q-save", "scan-q-resumed"], tests: ["aiScans.test", "aiScanModel", "srsRules.test"], text: "The questionnaire is completed step by step. Save and continue later produces a link that works for 14 days, and opening it in a fresh browser restores the saved progress." },
  "SRS-03.5": { shots: ["ad-gov-scanreview", "scan-result-review"], tests: ["admin.srsOps", "srsRules.test", "admin.retriggerAiScan"], text: "A generated report enters an awaiting expert review status. It cannot be published without an explicit expert decision, and the customer sees only the holding message until then." },
  "SRS-03.6": { shots: ["scan-result-review", "scan-result-revision", "scan-result-published"], tests: ["admin.srsOps", "srsRules.test", "admin.reportsProjects"], text: "A report that is held back or sent for revision stays hidden. Only a published report is visible to the customer." },
  "SRS-03.7": { shots: ["scan-result-published", "scan-result-published-2", "scan-result-published-3", "cl-reports", "cl-ai-scans"], tests: ["clientPortal.test", "aiScanReportPdf", "i18n.usedKeys"], text: "Once published, the report shows its dimensions, opportunities, roadmap and disclaimers and appears in the Client Portal under reports and AI Scan history." },
  "SRS-03.8": { shots: ["ad-gov-scanreview-history", "ad-gov-scanreview-all"], tests: ["srsRules.test", "admin.srsOps"], ev: ["scanEvents", "immutability"], text: "Each status transition of a report is written to an append only status history, with the actor and note. The database refuses updates to those rows." },
  "SRS-03.9": { shots: ["cl-ai-scans", "cl-bell", "ad-bell"], tests: ["notificationCatalogue", "notificationDispatcher", "clientNotifications"], text: "Milestone notifications for submission, review, publication and revision are part of the event catalogue and are delivered through the dispatcher." },

  "SRS-04.1": { shots: ["pub-login", "cl-dashboard"], tests: ["useRouteGuard", "oauth.redirect"], text: "A client who signs in is taken to the Client Portal dashboard." },
  "SRS-04.2": { shots: ["cl-dashboard", "cl-documents-search", "cl-forbidden-admin"], tests: ["clientPortal.test", "rls.negative"], ev: ["policies"], text: "Dashboards show only the signed in client's own organization. Every client query is scoped by organization on the server and by row level security policies in the database." },
  "SRS-04.3": { shots: ["cl-reports", "scan-result-published"], tests: ["clientPortal.test"], text: "Published reports are listed and can be opened and downloaded as PDF." },
  "SRS-04.4": { shots: ["cl-ai-scans"], tests: ["clientPortal.test", "srsRules.test"], text: "The AI Scan history shows a review progress card so the customer sees where a report is in the review lifecycle." },
  "SRS-04.5": { shots: ["cl-projects", "cl-approvals-pending"], tests: ["clientPortal.test", "admin.reportsProjects"], text: "Project progress, milestones and phases are displayed from live data." },
  "SRS-04.6": { shots: ["cl-documents", "cl-documents-search"], tests: ["clientPortal.test", "admin.documentLifecycle"], text: "Documents are served through short lived signed URLs after an authorization check. The vault shows only the client's own documents." },
  "SRS-04.7": { shots: ["cl-billing"], tests: ["clientPortal.test", "admin.createInvoice"], text: "Invoices and billing history are listed in the portal." },
  "SRS-04.8": { shots: ["cl-messages", "cl-support"], tests: ["clientPortal.test"], text: "Secure messaging and support tickets work from the portal and are recorded." },
  "SRS-04.9": { shots: ["cl-bell", "cl-account-prefs", "cl-account-prefs-off"], tests: ["clientNotifications", "NotificationBell", "notificationDispatcher"], text: "The notification bell lists recent events. Preferences allow opting out of a category for in app delivery, while security notices stay locked on." },
  "SRS-04.10": { shots: ["cl-approvals-reject-needs-note", "cl-approvals-decided", "ad-audit"], tests: ["auditCoverage", "clientPortal.test"], text: "Client mutations such as sending a message, opening a ticket and deciding an approval are written to the audit log by middleware, and a test enumerates the covered procedures." },

  "SRS-05.1": { shots: ["pub-login", "dv-overview"], tests: ["useRouteGuard", "developer.test"], text: "A developer who signs in is taken to the Developer Workspace." },
  "SRS-05.2": { shots: ["dv-projects", "dv-access-scope", "dv-forbidden-client"], tests: ["developer.test", "admin.grantDeveloperAccess"], text: "A developer sees only the projects they are assigned to, and the access scope shows what was granted and when it expires." },
  "SRS-05.3": { shots: ["dv-tasks", "dv-task-thread", "dv-task-ask"], tests: ["developer.test", "admin.developerDelivery"], text: "Tasks can be listed, updated and discussed. A progress note or a clarification request goes to the engineering desk and the answer comes back on the same thread." },
  "SRS-05.4": { shots: ["dv-submissions", "dv-files"], tests: ["developer.test", "profileAvatar"], text: "Deliverables are uploaded to private storage with type and size checks and listed with their review state." },
  "SRS-05.5": { shots: ["dv-time", "dv-time-form", "dv-time-future"], tests: ["srsRules.test", "admin.developerDelivery"], text: "Time is registered against an assigned project. A future date is refused, and every entry carries a review status." },
  "SRS-05.6": { shots: ["dv-messages", "ad-delivery-messages"], tests: ["developer.test", "admin.developerDelivery"], text: "The engineering desk can message a developer and the developer sees it in the workspace." },
  "SRS-05.7": { shots: ["dv-bell", "dv-profile-prefs"], tests: ["developer.test", "NotificationBell", "notificationDispatcher"], text: "Assignment and task events reach the developer's notification bell. Security notices stay on regardless of preferences." },
  "SRS-05.8": { shots: ["ad-audit", "ad-delivery-time"], tests: ["auditCoverage", "admin.developerDelivery"], text: "Business critical developer actions are audit logged by the mutation audit middleware." },

  "SRS-06.1": { shots: ["pub-login", "ad-landing", "ad-overview"], tests: ["admin.modules", "useRouteGuard"], text: "An administrator is routed to the Admin Portal after the multi factor challenge." },
  "SRS-06.2": { shots: ["ad-clients", "ad-crm", "ad-users"], tests: ["admin.superAdmin", "admin.createLead", "admin.modules"], text: "Customer organizations and their records are managed from the Clients and CRM modules." },
  "SRS-06.3": { shots: ["ad-ai-scans", "ad-gov-scanreview", "ad-gov-scanreview-all"], tests: ["admin.srsOps", "admin.retriggerAiScan"], text: "Administrators open any AI Scan, read its answers and score, and move it through the review queue." },
  "SRS-06.4": { shots: ["ad-gov-scanreview", "ad-gov-scanreview-history"], tests: ["admin.srsOps", "admin.reportsProjects"], text: "Publication is a distinct, explicit action performed by a reviewer and recorded in the status history." },
  "SRS-06.5": { shots: ["ad-projects", "ad-delivery-assign", "ad-delivery-assign-form"], tests: ["admin.reportsProjects", "admin.developerDelivery"], text: "Projects and milestones are created and updated with tenant isolation." },
  "SRS-06.6": { shots: ["ad-delivery-assign", "ad-developers", "ad-delivery-tasks"], tests: ["admin.developerDelivery", "admin.grantDeveloperAccess"], text: "Developers are assigned to projects with a scope and an expiry date." },
  "SRS-06.7": { shots: ["ad-billing", "ad-sales-finance"], tests: ["admin.createInvoice", "admin.srsOps"], text: "Invoices, payments and the financial summary are available to authorized administrators." },
  "SRS-06.9": { shots: ["ad-bell", "ad-automations"], tests: ["notificationDispatcher", "admin.summary"], text: "Administrators receive notifications for operational events through the same dispatcher." },
  "SRS-06.10": { shots: ["ad-audit", "ad-gov-audit"], tests: ["auditCoverage", "admin.srsOps"], ev: ["auditSample"], text: "Administrative mutations are audited by middleware, and a coverage test enumerates the audited procedures." },

  "SRS-07.1": { shots: ["ad-clients", "ad-users"], tests: ["admin.superAdmin"], text: "Organizations can be listed, created and updated, and users can be assigned to them. Only a super admin can do so." },
  "SRS-07.2": { shots: ["ad-users", "ad-gov-invites"], tests: ["admin.superAdmin", "accounts.test", "admin.modules"], text: "Roles are set through a controlled procedure, invitations are limited by the inviter's authority, and role changes are audited." },
  "SRS-07.4": { shots: ["ad-agents", "ad-gov-ai", "ad-gov-ai-2"], tests: ["aiGovernance", "admin.srsOps", "srsRules.test"], ev: ["aiExecutions"], text: "Agents are registered, prompts are versioned, and each execution is recorded in an append only log with the prompt version used." },
  "SRS-07.5": { shots: ["ad-security", "ad-gov-incidents", "ad-gov-alerts"], tests: ["ops.test", "admin.srsOps"], ev: ["alertRules"], text: "Security events, incidents and alert rules are visible and can be acknowledged by operators." },
  "SRS-07.6": { shots: ["ad-gov-audit", "ad-gov-audit-blocked", "ad-gov-audit-failed", "ad-audit"], tests: ["admin.srsOps"], text: "The audit log is searchable by outcome, provider and date, and can be exported as CSV." },
  "SRS-07.7": { shots: ["ad-gov-config", "ad-gov-config-rejected", "ad-settings"], tests: ["srsRules.test", "admin.platformSettings", "policy.test"], ev: ["configHistory"], text: "Each setting has a type, a range and a rule. A value that fails validation is refused and the refusal is recorded in the configuration history." },
  "SRS-07.10": { shots: ["ad-audit", "ad-gov-audit"], tests: ["auditCoverage", "viewAs"], text: "Platform wide actions, including View As impersonation, are recorded in the audit log." },

  "SRS-08.1": { shots: ["ad-crm"], tests: ["admin.createLead", "solutions.test", "bookings.test"], text: "Leads arrive from the public site and can be created and managed by administrators." },
  "SRS-08.2": { shots: ["ad-strategy-calls", "ad-availability", "ad-sales-activities"], tests: ["bookingAdmin", "bookings.test", "bookingReminders", "concurrency"], text: "Discovery Calls are booked against availability, can be confirmed or cancelled by token, and have outcomes recorded." },
  "SRS-08.3": { shots: ["ad-sales-pipeline"], tests: ["srsRules.test", "admin.srsOps"], text: "Opportunities move through a defined lifecycle and illegal transitions are refused." },
  "SRS-08.4": { shots: ["ad-sales-proposals", "ad-sales-quotes"], tests: ["srsRules.test", "admin.srsOps", "solutions.test"], text: "Proposals and quotations follow their own lifecycle." },
  "SRS-08.5": { shots: ["ad-sales-timeline"], tests: ["admin.srsOps"], text: "The customer timeline merges activities, calls, quotes and status changes for an organization." },
  "SRS-08.6": { shots: ["ad-sales-activities"], tests: ["admin.srsOps", "srsRules.test"], text: "Activities, follow ups and call outcomes are recorded and listed." },
  "SRS-08.7": { shots: ["ad-sales-pipeline", "ad-projects"], tests: ["admin.srsOps", "srsRules.test"], text: "Marking an opportunity as won creates a project hand over." },
  "SRS-08.8": { shots: ["ad-audit"], tests: ["auditCoverage", "admin.srsOps"], text: "Commercial mutations are in the audited procedure list." },

  "SRS-09.1": { shots: ["ad-projects", "ad-delivery-assign-form"], tests: ["admin.reportsProjects", "admin.developerDelivery"], text: "Projects are created and managed from the admin portal." },
  "SRS-09.2": { shots: ["ad-delivery-tasks", "dv-tasks", "cl-projects"], tests: ["admin.reportsProjects", "admin.developerDelivery", "developer.test"], text: "Tasks, milestones and deliverables are managed by admins, worked by developers and followed by the client." },
  "SRS-09.3": { shots: ["cl-approvals-pending", "cl-approvals-reject-needs-note", "cl-approvals-decided", "ad-delivery-approvals"], tests: ["clientPortal.test", "admin.developerDelivery"], text: "A phase waits for customer approval. Requesting changes requires a note, and the decision is recorded." },
  "SRS-09.4": { shots: ["ad-documents", "cl-documents", "dv-files"], tests: ["admin.documentLifecycle", "clientPortal.test"], text: "Project documents are stored in private buckets and served by signed URL." },
  "SRS-09.6": { shots: ["cl-bell", "dv-bell", "ad-bell"], tests: ["notificationDispatcher", "notifications.test"], text: "Project events create notifications for the right audience." },
  "SRS-09.7": { shots: ["ad-audit", "ad-delivery-time"], tests: ["auditCoverage"], text: "Project mutations are audited." },
  "SRS-09.8": { shots: ["ad-projects", "ad-gov-reports"], tests: ["srsRules.test", "admin.srsOps"], text: "Completed projects follow an archive policy that is evaluated by a pure, tested rule." },

  "SRS-10.1": { shots: ["ad-sales-quotes"], tests: ["srsRules.test", "admin.srsOps"], text: "Quotations are created and moved through their lifecycle." },
  "SRS-10.2": { shots: ["ad-billing", "cl-billing"], tests: ["admin.createInvoice", "clientPortal.test"], text: "Invoices are generated with numbering and totals, and are visible to the client." },
  "SRS-10.5": { shots: ["ad-sales-subs"], tests: ["admin.srsOps", "srsRules.test"], text: "Subscriptions can be created, paused and cancelled." },
  "SRS-10.6": { shots: ["ad-sales-finance", "ad-analytics"], tests: ["srsRules.test", "admin.analytics"], text: "The financial summary shows twelve months of history and can be exported." },
  "SRS-10.7": { shots: ["ad-audit"], tests: ["auditCoverage"], text: "Financial mutations are included in the audited procedure list." },

  "SRS-11.2": { shots: ["cl-bell", "ad-bell", "ad-gov-comms"], tests: ["notificationDispatcher", "emailDeliveryLogging", "email-i18n", "emailBranding", "resendWebhook"], ev: ["emailLog"], text: "Notifications are delivered in app and by email with localized, branded templates. The latest email log rows are printed on the evidence page." },
  "SRS-11.3": { shots: ["cl-account-prefs", "cl-account-prefs-off", "dv-profile-prefs"], tests: ["notificationDispatcher", "srsRules.test", "clientNotifications"], text: "Per category preferences are honoured by the dispatcher, with security categories locked on." },
  "SRS-11.4": { shots: ["ad-gov-comms"], tests: ["notificationDispatcher", "emailDeliveryLogging"], ev: ["emissions", "immutability"], text: "Every emission is stored in the append only notification event log and shown in the communication history." },
  "SRS-11.6": { shots: ["ad-gov-comms", "ad-security"], tests: ["emailDeliveryLogging", "resendWebhook", "ops.test"], ev: ["emailLog"], text: "Bounces and failures are recorded in the email delivery log, including those reported by the provider webhook." },
  "SRS-11.7": { shots: ["cl-account-prefs", "dv-profile-prefs"], tests: ["notificationDispatcher", "srsRules.test", "notificationCatalogue"], ev: ["catalogue"], text: "Security notices have a priority floor and cannot be disabled by preference." },

  "SRS-12.1": { shots: ["cl-documents", "ad-documents", "dv-files"], tests: ["clientPortal.test", "developer.test", "admin.documentLifecycle"], text: "Uploads go to private storage buckets and downloads use short lived signed URLs. A storage round trip was verified on all four buckets." },
  "SRS-12.2": { shots: ["ad-documents"], tests: ["admin.documentLifecycle"], text: "A document keeps its versions, and a new upload can supersede the earlier one." },
  "SRS-12.4": { shots: ["ad-documents", "ad-delivery-approvals"], tests: ["admin.documentLifecycle", "admin.workflows"], text: "Documents go through a review decision which can trigger a workflow." },
  "SRS-12.5": { shots: ["cl-documents-search", "cl-documents-search-none"], tests: ["clientPortal.test", "srsRules.test"], text: "Search is scoped to the caller's organization, escapes wildcard characters and says so when nothing matches." },
  "SRS-12.6": { shots: ["ad-automations"], tests: ["admin.workflows", "workflowEngine"], text: "Document events trigger workflows automatically." },
  "SRS-12.7": { shots: ["ad-audit"], tests: ["auditCoverage", "admin.documentLifecycle"], text: "Document mutations are audited." },

  "SRS-13.1": { shots: ["ad-agents", "ad-gov-ai"], tests: ["aiGovernance", "srsRules.test"], text: "An agent can run only if it is registered, enabled and authorized for the action. The gate is called before every AI Scan run." },
  "SRS-13.4": { shots: ["ad-gov-ai", "ad-gov-ai-2"], tests: ["aiGovernance", "admin.srsOps"], text: "Prompts are stored with versions. The scoring call uses the managed prompt rather than inline text." },
  "SRS-13.5": { shots: ["ad-gov-ai"], tests: ["aiGovernance"], ev: ["aiExecutions", "immutability"], text: "Each execution is written to an append only log." },
  "SRS-13.6": { shots: ["ad-gov-scanreview", "ad-gov-scanreview-history"], tests: ["admin.srsOps", "aiGovernance"], text: "Human approval is required before AI output reaches a customer." },

  "SRS-14.1": { shots: ["ad-audit", "ad-gov-audit"], tests: ["auditCoverage", "admin.srsOps"], ev: ["auditTriggers"], text: "Audit records are generated by middleware and database triggers for business critical activity." },
  "SRS-14.2": { shots: ["ad-security", "ad-gov-health"], tests: ["ops.test", "healthRoute"], text: "Monitoring covers health, readiness, security events and alert rules." },
  "SRS-14.3": { shots: ["ad-gov-compliance"], tests: ["srsRules.test", "admin.srsOps"], text: "Compliance checks are evaluated from live data and reported with a pass or fail." },
  "SRS-14.4": { shots: ["ad-gov-incidents"], tests: ["admin.srsOps", "ops.test"], ev: ["counts"], text: "Incidents are registered, assigned, updated and resolved with a timeline." },
  "SRS-14.5": { shots: ["ad-gov-alerts", "ad-overview-2"], tests: ["srsRules.test", "admin.srsOps"], ev: ["alertRules"], text: "Alert rules have a metric, a threshold, a window and a severity, and fire according to a tested rule." },
  "SRS-14.6": { shots: ["ad-gov-scanreview-history"], tests: ["dbConstraints", "auditCoverage"], ev: ["immutability", "auditTriggers"], text: "Audit tables are append only. The database refuses UPDATE and DELETE, and the evidence page shows the real refusals." },
  "SRS-14.7": { shots: ["ad-gov-audit", "ad-gov-reports"], tests: ["admin.srsOps"], text: "Audit and security reports are available to authorized users and can be exported." },

  "SRS-15.1": { shots: ["ad-overview", "ad-overview-2", "ad-overview-3", "ad-analytics"], tests: ["admin.summary", "admin.analytics", "rawSqlDates"], text: "Dashboards read live data. A guard test covers the raw SQL date handling that once produced silent zero counters." },
  "SRS-15.2": { shots: ["ad-overview", "ad-analytics"], tests: ["admin.analytics", "srsRules.test"], text: "KPIs are computed by tested functions." },
  "SRS-15.3": { shots: ["ad-reports", "ad-gov-reports"], tests: ["admin.reportsProjects", "admin.srsOps"], text: "Reports are generated on demand." },
  "SRS-15.4": { shots: ["ad-sales-finance", "ad-analytics"], tests: ["srsRules.test"], text: "Twelve month history views are available." },
  "SRS-15.5": { shots: ["ad-overview", "cl-forbidden-admin"], tests: ["admin.modules", "ops.test"], text: "Dashboards are gated by role." },
  "SRS-15.6": { shots: ["ad-gov-reports"], tests: ["admin.srsOps", "workflowSchedule"], text: "Scheduled reports are defined with a cadence and next run time." },

  "SRS-16.1": { shots: ["pub-security", "ad-security"], tests: ["apiHardening", "cookieSecurity", "inputValidationCoverage"], text: "Security headers, an explicit CORS policy, rate limiting, validated input and secure cookies protect the API." },
  "SRS-16.4": { shots: ["ad-automations", "ad-gov-health"], tests: ["admin.webhooks", "webhookDispatcher", "healthRoute"], text: "Webhook deliveries and health endpoints are monitored." },
  "SRS-16.5": { shots: ["ad-security"], tests: ["apiHardening", "rls.negative", "stagingGate"], ev: ["rls"], text: "Rate limits, row level security, the staging gate and credential redaction enforce the security controls." },
  "SRS-16.6": { shots: ["ad-automations", "ad-gov-comms"], tests: ["admin.webhooks", "webhookDispatcher", "emailDeliveryLogging"], text: "Webhook delivery attempts and email transports are logged." },
  "SRS-16.7": { shots: ["ad-gov-alerts", "ad-security"], tests: ["srsRules.test", "ops.test"], text: "Alert rules produce alerts where integrations fail." },

  "SRS-17.1": { shots: ["ad-automations"], tests: ["workflowEngine", "admin.workflows"], text: "Workflows execute their steps and record the result." },
  "SRS-17.2": { shots: ["ad-automations"], tests: ["admin.workflows", "workflowEngine"], text: "Each run is kept with status and output." },
  "SRS-17.3": { shots: ["ad-automations", "ad-delivery-approvals"], tests: ["admin.workflows"], text: "A document review decision starts the approval workflow." },
  "SRS-17.4": { shots: ["ad-automations"], tests: ["workflowSchedule", "workflowEngine"], text: "Events fire the matching workflows through fireTrigger." },
  "SRS-17.5": { shots: ["ad-automations", "ad-gov-reports"], tests: ["workflowSchedule"], text: "Schedule triggers run due workflows and advance the next run time." },
  "SRS-17.6": { shots: ["ad-automations"], tests: ["admin.workflows", "workflowCoverage"], text: "Workflow administration is restricted to authorized roles." },
  "SRS-17.7": { shots: ["ad-automations", "ad-overview-2"], tests: ["workflowCoverage", "admin.workflows"], text: "The workflow state is surfaced on the overview and the automation module." },

  "SRS-18.1": { shots: ["ad-settings", "ad-gov-config"], tests: ["admin.platformSettings", "srsRules.test"], text: "Settings are changed through a validated form." },
  "SRS-18.2": { shots: ["ad-settings"], tests: ["admin.modules", "admin.platformSettings"], text: "Only authorized roles may change settings." },
  "SRS-18.3": { shots: ["ad-gov-config"], tests: ["admin.platformSettings"], ev: ["configHistory", "immutability"], text: "Every change and refusal is kept in an append only history." },
  "SRS-18.4": { shots: ["ad-gov-config", "ad-gov-config-rejected"], tests: ["srsRules.test", "policy.test"], text: "Validation rules keep settings consistent." },
  "SRS-18.5": { shots: ["ad-settings", "ad-gov-config"], tests: ["policy.test"], text: "Session length and password length are configurable and take effect without a deploy." },
  "SRS-18.6": { shots: ["ad-gov-ai", "ad-agents"], tests: ["aiGovernance", "llm.test"], text: "AI settings, agents and prompts are configured through the governance module." },

  "SRS-19.1": { shots: ["ad-gov-health", "ad-security", "ad-overview-3"], tests: ["healthRoute", "ops.test"], text: "Liveness, readiness and version endpoints plus the health panel." },
  "SRS-19.2": { shots: ["ad-maint-form", "ad-maint-public", "ad-maint-admin-reachable", "ad-maint-off"], tests: ["stagingGate", "admin.platformSettings"], text: "Maintenance mode was switched on in the live app through the validated settings form, a visitor saw the maintenance page, the admin portal stayed reachable, and it was switched off again." },
  "SRS-19.4": { shots: ["ad-gov-incidents"], tests: ["admin.srsOps", "ops.test"], text: "Operational incidents are tracked to resolution." },
  "SRS-19.5": { shots: ["ad-gov-health"], tests: ["healthRoute"], ev: ["deployments"], text: "Releases are recorded with commit, environment and start time." },
  "SRS-19.6": { shots: ["ad-gov-health"], tests: ["queryPerformance", "concurrency"], text: "Capacity indicators and query performance baselines are monitored." },

  "SRS-20.3": { shots: ["pub-home", "ad-overview"], tests: ["designLanguage", "i18n.completeness", "i18n.locale", "inputValidationCoverage", "dbConstraints", "tailwindArbitraryValues"], text: "The platform is built to enforced quality standards: a design language, translation completeness, input validation coverage, database constraints, and a full automated test suite that passes." },
};

export const PUB_ALL_SHOTS = PUB_ALL;
