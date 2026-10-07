/*
 * IO SKY — business rules from Master SRS v1.1, as pure functions.
 *
 * Nothing here touches the database, the clock (callers pass `now`) or the
 * network, so every rule is tested directly and the routers stay thin.
 */

// ---------------------------------------------------------------------------
// CRM lifecycle (SRS 14.8, 14.15)
// ---------------------------------------------------------------------------

export const OPPORTUNITY_STAGES = [
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

const OPEN_STAGES: OpportunityStage[] = ["qualification", "discovery", "proposal", "negotiation"];

export function isClosedStage(stage: OpportunityStage): boolean {
  return stage === "won" || stage === "lost";
}

/**
 * Open stages may move forward by any distance (a deal can skip discovery),
 * never backwards, and any open stage may close as won or lost. A closed
 * opportunity is terminal: reopening would let a won deal be won twice and
 * create a second project handover.
 */
export function canMoveOpportunity(from: OpportunityStage, to: OpportunityStage): boolean {
  if (from === to) return false;
  if (isClosedStage(from)) return false;
  if (to === "won" || to === "lost") return true;
  return OPEN_STAGES.indexOf(to) > OPEN_STAGES.indexOf(from);
}

export type CloseCheck = { ok: true } | { ok: false; reason: string };

/** SRS 14.15: won creates a project handover, which needs an organization to own it. */
export function checkCanClose(
  to: "won" | "lost",
  opts: { organizationId: number | null; lostReason?: string | null },
): CloseCheck {
  if (to === "won" && !opts.organizationId) {
    return { ok: false, reason: "Link the opportunity to a client organization before marking it won." };
  }
  if (to === "lost" && !opts.lostReason?.trim()) {
    return { ok: false, reason: "Record why the opportunity was lost." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Proposals and quotes share one document lifecycle (SRS 14.11, 16.6)
// ---------------------------------------------------------------------------

export const DOCUMENT_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const DOCUMENT_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
};

export function canMoveDocument(from: DocumentStatus, to: DocumentStatus): boolean {
  return DOCUMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export type QuoteLine = { description: string; quantity: number; unitCents: number };

/** Integer cents only. A fractional cent total is how invoices stop adding up. */
export function computeQuoteTotal(lines: QuoteLine[]): number {
  if (lines.length === 0) throw new Error("A quotation needs at least one line.");
  let total = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) throw new Error("Quantity must be a positive whole number.");
    if (!Number.isInteger(l.unitCents) || l.unitCents < 0) throw new Error("Unit price must be whole cents, zero or more.");
    total += l.quantity * l.unitCents;
  }
  if (!Number.isSafeInteger(total)) throw new Error("Quotation total is too large.");
  return total;
}

// ---------------------------------------------------------------------------
// Developer time registration (SRS 11.8)
// ---------------------------------------------------------------------------

export const TIME_BACKDATE_LIMIT_DAYS = 31;

export function checkTimeEntry(args: { workDate: string; minutes: number; now: Date }): CloseCheck {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.workDate)) return { ok: false, reason: "Use a YYYY-MM-DD date." };
  const day = Date.parse(`${args.workDate}T00:00:00Z`);
  if (Number.isNaN(day)) return { ok: false, reason: "That date does not exist." };
  const today = Date.UTC(args.now.getUTCFullYear(), args.now.getUTCMonth(), args.now.getUTCDate());
  if (day > today) return { ok: false, reason: "Time cannot be registered for a future date." };
  if (today - day > TIME_BACKDATE_LIMIT_DAYS * 86_400_000) {
    return { ok: false, reason: `Time cannot be registered more than ${TIME_BACKDATE_LIMIT_DAYS} days back.` };
  }
  if (!Number.isInteger(args.minutes) || args.minutes < 1 || args.minutes > 1440) {
    return { ok: false, reason: "Minutes must be a whole number from 1 to 1440." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notification preferences (SRS 17.11, 17.13)
// ---------------------------------------------------------------------------

export const NOTIFICATION_CATEGORIES = ["account", "project", "billing", "support", "marketing", "security"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export const NOTIFICATION_CHANNELS = ["email", "in_app"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type Preference = { category: string; channel: string; enabled: boolean };

/**
 * Security notifications are always delivered (SRS 17.13), so a stored
 * `enabled: false` for that category is ignored rather than honoured. Every
 * other category defaults to on until the user switches it off.
 */
export function shouldDeliver(args: {
  category: NotificationCategory;
  channel: NotificationChannel;
  prefs: Preference[];
}): boolean {
  if (args.category === "security") return true;
  const row = args.prefs.find((p) => p.category === args.category && p.channel === args.channel);
  return row ? row.enabled : true;
}

// ---------------------------------------------------------------------------
// Alerts (SRS 20.11, 22.12)
// ---------------------------------------------------------------------------

export const ALERT_METRICS = [
  "failed_logins",
  "webhook_failures",
  "email_failures",
  "open_critical_incidents",
] as const;
export type AlertMetric = (typeof ALERT_METRICS)[number];

/**
 * A rule fires when the observed count reaches its threshold, then stays quiet
 * for one window so a sustained condition raises one alert, not one per check.
 */
export function shouldFireAlert(args: {
  count: number;
  threshold: number;
  windowMinutes: number;
  lastFiredAt: Date | null;
  now: Date;
}): boolean {
  if (args.count < args.threshold) return false;
  if (!args.lastFiredAt) return true;
  return args.now.getTime() - args.lastFiredAt.getTime() >= args.windowMinutes * 60_000;
}

// ---------------------------------------------------------------------------
// Configuration validation (SRS 13.9, 24.9)
// ---------------------------------------------------------------------------

/** Settings that mirror the running environment and must not be hand edited. */
const DERIVED_KEYS = new Set(["integrations.summary", "ai_governance.llm_provider", "ai_governance.tiers"]);

const ON_OFF_KEYS = new Set(["operations.maintenance_mode", "security.mfa_required", "security.ip_allowlist_enabled"]);

const INTEGER_RANGES: Record<string, [number, number]> = {
  "security.session_hours": [1, 24],
  "security.password_min_length": [8, 128],
  "storage.retention_days": [1, 3650],
  "observability.audit_retention_days": [365, 3650],
};

export function validateSettingValue(key: string, value: string): CloseCheck {
  if (DERIVED_KEYS.has(key)) {
    return { ok: false, reason: "This value is derived from the running environment and cannot be edited." };
  }
  const v = value.trim();
  if (!v) return { ok: false, reason: "A setting cannot be empty." };
  if (v.length > 500) return { ok: false, reason: "A setting value is limited to 500 characters." };
  if (ON_OFF_KEYS.has(key) && v !== "on" && v !== "off") {
    return { ok: false, reason: 'This setting accepts only "on" or "off".' };
  }
  const range = INTEGER_RANGES[key];
  if (range) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < range[0] || n > range[1]) {
      return { ok: false, reason: `This setting must be a whole number from ${range[0]} to ${range[1]}.` };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Scheduling (SRS 21.11, 23.9)
// ---------------------------------------------------------------------------

export type Cadence = "daily" | "weekly" | "monthly";

export function nextRunAfter(cadence: Cadence, from: Date): Date {
  const d = new Date(from.getTime());
  if (cadence === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (cadence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    // Clamp so 31 January + 1 month is the end of February, not 3 March.
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d;
}

// ---------------------------------------------------------------------------
// AI agent permissions (SRS 19.8, BR-009)
// ---------------------------------------------------------------------------

export type AgentAuthorisation =
  | { allowed: true; needsApproval: boolean }
  | { allowed: false; reason: "agent_not_found" | "agent_disabled" | "action_not_permitted" };

export function authoriseAgentAction(
  agent: { status: string; permissions: string[]; requiresHumanApproval: boolean } | null,
  action: string,
): AgentAuthorisation {
  if (!agent) return { allowed: false, reason: "agent_not_found" };
  if (agent.status !== "active") return { allowed: false, reason: "agent_disabled" };
  if (!agent.permissions.includes(action)) return { allowed: false, reason: "action_not_permitted" };
  return { allowed: true, needsApproval: agent.requiresHumanApproval };
}

// ---------------------------------------------------------------------------
// Project archive policy (SRS 15.17)
// ---------------------------------------------------------------------------

/** Only a completed project with no approval still waiting on the customer may be archived. */
export function checkCanArchiveProject(args: { status: string; pendingApprovals: number; archivedAt: Date | null }): CloseCheck {
  if (args.archivedAt) return { ok: false, reason: "Project is already archived." };
  if (args.status !== "completed") return { ok: false, reason: "Only completed projects can be archived." };
  if (args.pendingApprovals > 0) {
    return { ok: false, reason: "Resolve the pending customer approvals before archiving." };
  }
  return { ok: true };
}

/**
 * Which preference category a notification belongs to, from its `kind`. Unknown
 * kinds fall into "account" rather than "marketing", so an unmapped kind is
 * never silently suppressed by an opt out meant for promotional mail.
 */
export function categoryForNotificationKind(kind: string): NotificationCategory {
  const k = kind.toLowerCase();
  if (k.includes("security") || k.includes("mfa") || k.includes("login") || k.includes("password")) return "security";
  if (k.includes("payment") || k.includes("invoice") || k.includes("billing") || k.includes("quote") || k.includes("subscription")) return "billing";
  if (k.includes("support") || k.includes("ticket")) return "support";
  if (k.includes("marketing") || k.includes("campaign") || k.includes("newsletter")) return "marketing";
  if (k.includes("report") || k.includes("project") || k.includes("milestone") || k.includes("task") || k.includes("assignment") || k.includes("approval") || k.includes("booking") || k.includes("document") || k.includes("message") || k.includes("time")) return "project";
  return "account";
}

// ---------------------------------------------------------------------------
// CSV export (SRS 13.9, 21.9)
// ---------------------------------------------------------------------------

/**
 * One CSV cell. Quotes are doubled and any cell containing a comma, quote or
 * line break is wrapped. A cell that starts with =, +, - or @ is prefixed with
 * an apostrophe: audit rows carry attacker-influenced text (an identifier typed
 * into a login form), and a spreadsheet would otherwise run it as a formula.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** Escape LIKE wildcards so a search for "100%" matches the text, not everything. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => "\\" + c);
}

// ---------------------------------------------------------------------------
// AI Scan report lifecycle (SRS 9.6, BR-009, BR-016)
// ---------------------------------------------------------------------------

export const REPORT_STATUSES = [
  "draft",
  "questionnaire_in_progress",
  "submitted",
  "ai_processing",
  "awaiting_expert_review",
  "revision_required",
  "approved",
  "published",
  "archived",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  draft: ["questionnaire_in_progress", "submitted"],
  questionnaire_in_progress: ["submitted"],
  submitted: ["ai_processing"],
  // A failed engine run drops back to submitted so it can be retried.
  ai_processing: ["awaiting_expert_review", "submitted"],
  awaiting_expert_review: ["approved", "revision_required"],
  // After the requested changes the report is regenerated, then reviewed again.
  revision_required: ["ai_processing", "awaiting_expert_review"],
  approved: ["published", "revision_required"],
  published: ["archived"],
  archived: [],
};

export function canMoveReport(from: ReportStatus, to: ReportStatus): boolean {
  return REPORT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** BR-016: no report is visible to the customer until it is Published. */
export function isReportVisibleToCustomer(status: string | null | undefined): boolean {
  return status === "published";
}

/** Steps only a human may take. The engine can never approve or publish. */
export function isHumanOnlyReportStep(to: ReportStatus): boolean {
  return to === "approved" || to === "revision_required" || to === "published" || to === "archived";
}

// ---------------------------------------------------------------------------
// Discovery Call outcomes, task comments, questionnaire drafts
// ---------------------------------------------------------------------------

export const CALL_OUTCOMES = ["qualified", "not_a_fit", "needs_follow_up", "proposal_requested"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

/** An outcome that leaves work to do must say when, or the follow up silently never happens. */
export function checkCallOutcome(args: { outcome: CallOutcome; followUpAt: Date | null; now: Date }): CloseCheck {
  if ((args.outcome === "needs_follow_up" || args.outcome === "proposal_requested") && !args.followUpAt) {
    return { ok: false, reason: "Set a follow up date for this outcome." };
  }
  if (args.followUpAt && args.followUpAt.getTime() < args.now.getTime() - 60_000) {
    return { ok: false, reason: "The follow up date is in the past." };
  }
  return { ok: true };
}

export const TASK_COMMENT_KINDS = ["progress_note", "comment", "clarification_request"] as const;
export type TaskCommentKind = (typeof TASK_COMMENT_KINDS)[number];

export const DRAFT_TTL_DAYS = 14;
export function draftExpiry(now: Date): Date {
  return new Date(now.getTime() + DRAFT_TTL_DAYS * 86_400_000);
}
export function isDraftExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

// ---------------------------------------------------------------------------
// Notification dispatch policy (SRS 17, Functional Specification 35 and 37)
// ---------------------------------------------------------------------------

export type DispatchPriority = "P1" | "P2" | "P3" | "P4";

/** Maps the catalogue priority onto the three existing in-app priority scales. */
export function inAppPriority(p: DispatchPriority): "low" | "normal" | "high" | "critical" {
  return p === "P1" ? "critical" : p === "P2" ? "high" : p === "P3" ? "normal" : "low";
}

/**
 * Whether the catalogue asks for an email. The source text is prose
 * ("IMMEDIATE where time-sensitive", "OPTIONAL"), so only the leading keyword
 * is read: IMMEDIATE and MANDATORY request email, anything else stays in app.
 * Reading further into the prose would be evaluating it at runtime, which the
 * Functional Specification forbids.
 */
export function catalogueWantsEmail(emailDelivery: string): boolean {
  return /^\s*(IMMEDIATE|MANDATORY)/i.test(emailDelivery);
}

/** Preference category implied by an event family, so opt outs and the security lock apply. */
export function kindForFamily(family: string): string {
  switch (family) {
    case "security_access":
      return "security";
    case "payments_billing":
      return "billing";
    case "projects_delivery":
      return "project";
    case "ai_scans":
      return "report";
    case "discovery_calls":
      return "booking";
    default:
      return "account";
  }
}

/**
 * The de-duplication key (Functional Specification 35). It is built from the
 * event, the audience and recipient, and a reference the caller chooses to say
 * what counts as "the same occurrence" (a scan id, an invoice id plus a date).
 */
export function buildDedupKey(parts: { eventId: string; audience: string; recipientRef: string; ref: string }): string {
  return [parts.eventId, parts.audience, parts.recipientRef, parts.ref].map((p) => p.trim()).join("|").slice(0, 300);
}

// ---------------------------------------------------------------------------
// Compliance monitoring (SRS 20.9)
// ---------------------------------------------------------------------------

export type ComplianceInputs = {
  adminsWithoutMfa: number;
  overduePrivacyRequests: number;
  staleDocumentReviews: number;
  scansWaitingTooLong: number;
  openCriticalIncidents: number;
  expiredActiveDeveloperScopes: number;
  enabledAlertRules: number;
};

export type ComplianceStatus = "pass" | "warn" | "fail";
export type ComplianceCheck = { key: string; title: string; status: ComplianceStatus; count: number; detail: string; href: string };

/**
 * Each check turns a count into a verdict with the reason spelled out. A fail is
 * something that is out of policy now (an admin with no second factor, a
 * statutory privacy deadline missed); a warn is drifting toward it.
 */
export function evaluateCompliance(i: ComplianceInputs): ComplianceCheck[] {
  const v = (n: number, failAt = 1, warnAt = 1): ComplianceStatus => (n >= failAt ? "fail" : n >= warnAt ? "warn" : "pass");
  return [
    { key: "admin_mfa", title: "Administrators have a verified second factor", status: v(i.adminsWithoutMfa), count: i.adminsWithoutMfa, detail: i.adminsWithoutMfa ? `${i.adminsWithoutMfa} administrator account(s) have no verified MFA factor.` : "Every administrator has a verified second factor.", href: "/admin/users" },
    { key: "privacy_deadlines", title: "Privacy requests answered within their deadline", status: v(i.overduePrivacyRequests), count: i.overduePrivacyRequests, detail: i.overduePrivacyRequests ? `${i.overduePrivacyRequests} data subject request(s) are past their due date.` : "No data subject request is overdue.", href: "/admin/governance" },
    { key: "critical_incidents", title: "No critical incident left open", status: v(i.openCriticalIncidents), count: i.openCriticalIncidents, detail: i.openCriticalIncidents ? `${i.openCriticalIncidents} critical incident(s) are open or under investigation.` : "No critical incident is open.", href: "/admin/governance" },
    { key: "developer_scopes", title: "Expired developer access is revoked", status: v(i.expiredActiveDeveloperScopes), count: i.expiredActiveDeveloperScopes, detail: i.expiredActiveDeveloperScopes ? `${i.expiredActiveDeveloperScopes} developer access scope(s) are past their expiry but still marked active.` : "No expired access scope is still active.", href: "/admin/developers" },
    { key: "document_reviews", title: "Documents reviewed within 7 days", status: v(i.staleDocumentReviews, 5, 1), count: i.staleDocumentReviews, detail: i.staleDocumentReviews ? `${i.staleDocumentReviews} document(s) have waited more than 7 days for review.` : "No document is waiting longer than 7 days.", href: "/admin/documents" },
    { key: "scan_reviews", title: "AI Scan reports reviewed within 48 hours", status: v(i.scansWaitingTooLong, 3, 1), count: i.scansWaitingTooLong, detail: i.scansWaitingTooLong ? `${i.scansWaitingTooLong} report(s) have waited more than 48 hours for an expert.` : "No report is waiting longer than 48 hours.", href: "/admin/governance" },
    { key: "alerting", title: "Alert rules are active", status: i.enabledAlertRules > 0 ? "pass" : "fail", count: i.enabledAlertRules, detail: i.enabledAlertRules > 0 ? `${i.enabledAlertRules} alert rule(s) are enabled.` : "No alert rule is enabled, so nothing is watching for abuse.", href: "/admin/governance" },
  ];
}

export function complianceSummary(checks: ComplianceCheck[]): { pass: number; warn: number; fail: number } {
  return { pass: checks.filter((c) => c.status === "pass").length, warn: checks.filter((c) => c.status === "warn").length, fail: checks.filter((c) => c.status === "fail").length };
}
