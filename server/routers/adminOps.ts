/*
 * IO SKY — Admin Portal · SRS completion router.
 *
 * Sales (opportunities, proposals, activities, quotations, subscriptions),
 * delivery (time review, customer approvals, archiving), governance (AI
 * registry, prompts, configuration history, incidents, alerts, scheduled
 * reports) and the admin notification feed.
 *
 * Authority:
 *   - adminProcedure      day to day operation
 *   - opsProcedure        incidents and alerts (technical operators too)
 *   - superAdminProcedure platform configuration and AI governance
 *
 * Every mutation writes an audit row through recordAdminEvent, and every state
 * change is guarded by the lifecycle rules in shared/srsRules.ts.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, opsProcedure, router, superAdminProcedure } from "../_core/trpc";
import {
  activatePromptVersion,
  addPromptVersion,
  appendDeveloperNotification,
  archiveClientProject,
  authoriseAndRecordAgentAction,
  completeActivity,
  countUnreadAdminNotifications,
  createActivity,
  createAdminNotification,
  createIncident,
  createOpportunity,
  createProposal,
  createQuote,
  createScheduledReport,
  createSubscription,
  customerTimeline,
  decideAiExecution,
  evaluateAlertRules,
  getDeveloperProfileById,
  listAdminNotifications,
  listAiAgents,
  listAiExecutions,
  listAlertRules,
  listConfigHistory,
  listIncidents,
  listOpenFollowUps,
  listOpportunities,
  listPendingApprovalsAcrossProjects,
  listProposals,
  listPromptVersions,
  listQuotes,
  listScheduledReports,
  listSubscriptions,
  listTimeEntriesForReview,
  markAdminNotificationsRead,
  moveOpportunity,
  moveProposal,
  moveQuote,
  readFinancialSummary,
  readPipelineSummary,
  requestProjectApproval,
  reviewTimeEntry,
  setScheduledReportEnabled,
  setSubscriptionStatus,
  updateAlertRule,
  updateIncident,
  upsertAiAgent,
} from "../db";
import {
  DOCUMENT_STATUSES,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "../../shared/srsRules";
import { recordAdminEvent } from "./admin";
import { emitNotification } from "../notificationDispatcher";
import { complianceSummary, evaluateCompliance } from "../../shared/srsRules";
import { AI_SCAN_AGENT_KEY, decideLatestAiExecutionForSubject, readComplianceInputs } from "../db";
import { fireTrigger } from "../workflowEngine";
import { CALL_OUTCOMES, REPORT_STATUSES, checkCallOutcome, toCsv, type ReportStatus } from "../../shared/srsRules";
import { addTaskCommentByStaff, getCallOutcome, listNotificationEvents, listRecentEmailLog, listTaskCommentsForStaff, recordCallOutcome } from "../db";
import { dispatchSimpleEmail, escapeHtml } from "../email";
import {
  assignAiScanReviewer,
  getAiScanById,
  getProjectOrganizationId,
  listAiScanStatusEvents,
  listAiScansForReview,
  transitionAiScanReport,
} from "../db";
import { AUDIT_EXPORT_LIMIT, exportAuditLog, readPlatformHealth, searchAuditLog, searchDocuments } from "../db";

const auditFilter = z.object({
  q: z.string().trim().max(200).optional(),
  outcome: z.enum(["success", "failed", "blocked", "mfa_required"]).optional(),
  provider: z.string().trim().max(32).optional(),
  fromMs: z.number().int().optional(),
  toMs: z.number().int().optional(),
});
import { notifyDeveloper } from "../notifications";

const currency = z.string().length(3).transform((s) => s.toUpperCase());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

function fail(code: "NOT_FOUND" | "PRECONDITION_FAILED" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR", message: string): never {
  throw new TRPCError({ code, message });
}

export const adminOpsRouter = router({
  // =========================================================================
  // Admin notification feed (SRS 12.15)
  // =========================================================================
  notifications: adminProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false), limit: z.number().int().min(1).max(200).default(50) }).default({ unreadOnly: false, limit: 50 }))
    .query(async ({ input }) => ({
      rows: await listAdminNotifications(input.limit, input.unreadOnly),
      unread: await countUnreadAdminNotifications(),
    })),

  unreadNotificationCount: adminProcedure.query(async () => ({ unread: await countUnreadAdminNotifications() })),

  markNotificationsRead: adminProcedure
    .input(z.object({ id: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => ({ marked: await markAdminNotificationsRead(ctx.user.id, input.id) })),

  // =========================================================================
  // CRM: opportunities, proposals, activities, timelines
  // =========================================================================
  opportunities: adminProcedure
    .input(z.object({ stage: z.enum(OPPORTUNITY_STAGES).optional() }).default({}))
    .query(async ({ input }) => ({ rows: await listOpportunities(input.stage), pipeline: await readPipelineSummary() })),

  createOpportunity: adminProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(200),
        leadId: z.number().int().positive().optional(),
        organizationId: z.number().int().positive().optional(),
        valueCents: z.number().int().min(0).max(1_000_000_000_00).default(0),
        currency: currency.default("EUR"),
        expectedCloseDate: isoDate.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.leadId && !input.organizationId) fail("BAD_REQUEST", "Link the opportunity to a lead or an organization.");
      const opp = await createOpportunity({
        title: input.title,
        leadId: input.leadId ?? null,
        organizationId: input.organizationId ?? null,
        valueCents: input.valueCents,
        currency: input.currency,
        ownerUserId: ctx.user.id,
        expectedCloseDate: input.expectedCloseDate ?? null,
      });
      if (!opp) fail("INTERNAL_SERVER_ERROR", "Could not create the opportunity.");
      await recordAdminEvent({ ctx, reason: `admin.opportunity.create(${opp.id})` });
      return opp;
    }),

  moveOpportunity: adminProcedure
    .input(z.object({ id: z.number().int().positive(), to: z.enum(OPPORTUNITY_STAGES), lostReason: z.string().trim().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const res = await moveOpportunity({ id: input.id, to: input.to as OpportunityStage, lostReason: input.lostReason ?? null });
      if (!res) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      if (!res.ok) fail(res.code, res.reason);
      await recordAdminEvent({ ctx, reason: `admin.opportunity.move(${input.id}->${input.to})` });
      if (input.to === "won") {
        void fireTrigger("opportunity_won", { title: res.opportunity.title }, String(input.id));
      }
      if (input.to === "won") {
        await createAdminNotification({
          kind: "opportunity_won",
          title: `Opportunity won: ${res.opportunity.title}`,
          body: res.handoverProjectId ? `Project handover created (project #${res.handoverProjectId}).` : null,
          href: "/admin/projects",
        });
      }
      return res;
    }),

  proposals: adminProcedure
    .input(z.object({ opportunityId: z.number().int().positive().optional() }).default({}))
    .query(async ({ input }) => listProposals(input.opportunityId)),

  createProposal: adminProcedure
    .input(
      z.object({
        opportunityId: z.number().int().positive(),
        title: z.string().trim().min(1).max(200),
        amountCents: z.number().int().min(0),
        currency: currency.default("EUR"),
        validUntil: isoDate.optional(),
        body: z.string().max(20000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const p = await createProposal({ ...input, validUntil: input.validUntil ?? null, body: input.body ?? null, createdByUserId: ctx.user.id });
      if (p === "opportunity_not_found") fail("NOT_FOUND", "Opportunity not found.");
      if (!p) fail("INTERNAL_SERVER_ERROR", "Could not create the proposal.");
      await recordAdminEvent({ ctx, reason: `admin.proposal.create(${p.id})` });
      return p;
    }),

  moveProposal: adminProcedure
    .input(z.object({ id: z.number().int().positive(), to: z.enum(DOCUMENT_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const res = await moveProposal(input.id, input.to);
      if (!res) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      if (!res.ok) fail(res.code, res.reason);
      await recordAdminEvent({ ctx, reason: `admin.proposal.move(${input.id}->${input.to})` });
      return res.proposal;
    }),

  createActivity: adminProcedure
    .input(
      z.object({
        kind: z.enum(["call", "email", "meeting", "note", "follow_up"]),
        subject: z.string().trim().min(1).max(200),
        body: z.string().max(8000).optional(),
        leadId: z.number().int().positive().optional(),
        opportunityId: z.number().int().positive().optional(),
        organizationId: z.number().int().positive().optional(),
        dueAt: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.leadId && !input.opportunityId && !input.organizationId) fail("BAD_REQUEST", "Attach the activity to a lead, opportunity or organization.");
      if (input.kind === "follow_up" && !input.dueAt) fail("BAD_REQUEST", "A follow up needs a due date.");
      const a = await createActivity({
        kind: input.kind,
        subject: input.subject,
        body: input.body ?? null,
        leadId: input.leadId ?? null,
        opportunityId: input.opportunityId ?? null,
        organizationId: input.organizationId ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        createdByUserId: ctx.user.id,
      });
      if (!a) fail("INTERNAL_SERVER_ERROR", "Could not record the activity.");
      await recordAdminEvent({ ctx, reason: `admin.activity.create(${a.id}:${a.kind})` });
      return a;
    }),

  completeActivity: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const a = await completeActivity(input.id);
    if (!a) fail("NOT_FOUND", "No open activity with that id.");
    await recordAdminEvent({ ctx, reason: `admin.activity.complete(${a.id})` });
    return a;
  }),

  followUps: adminProcedure.query(async () => listOpenFollowUps()),

  customerTimeline: adminProcedure
    .input(z.object({ leadId: z.number().int().positive().optional(), organizationId: z.number().int().positive().optional() }))
    .query(async ({ input }) => {
      if (!input.leadId && !input.organizationId) fail("BAD_REQUEST", "Provide a lead or an organization.");
      return customerTimeline(input);
    }),

  // =========================================================================
  // Quotations, subscriptions, financial summary
  // =========================================================================
  quotes: adminProcedure.query(async () => listQuotes()),

  createQuote: adminProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(200),
        organizationId: z.number().int().positive().optional(),
        opportunityId: z.number().int().positive().optional(),
        currency: currency.default("EUR"),
        validUntil: isoDate.optional(),
        lines: z
          .array(z.object({ description: z.string().trim().min(1).max(300), quantity: z.number().int().positive().max(100000), unitCents: z.number().int().min(0).max(1_000_000_000) }))
          .min(1)
          .max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const q = await createQuote({
        title: input.title,
        organizationId: input.organizationId ?? null,
        opportunityId: input.opportunityId ?? null,
        currency: input.currency,
        validUntil: input.validUntil ?? null,
        lines: input.lines,
        createdByUserId: ctx.user.id,
      }).catch((e: Error) => fail("BAD_REQUEST", e.message));
      if (!q) fail("INTERNAL_SERVER_ERROR", "Could not create the quotation.");
      await recordAdminEvent({ ctx, reason: `admin.quote.create(${q.publicRef})` });
      return q;
    }),

  moveQuote: adminProcedure
    .input(z.object({ id: z.number().int().positive(), to: z.enum(DOCUMENT_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const res = await moveQuote(input.id, input.to);
      if (!res) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      if (!res.ok) fail(res.code, res.reason);
      await recordAdminEvent({ ctx, reason: `admin.quote.move(${res.quote.publicRef}->${input.to})` });
      return res.quote;
    }),

  subscriptions: adminProcedure
    .input(z.object({ organizationId: z.number().int().positive().optional() }).default({}))
    .query(async ({ input }) => listSubscriptions(input.organizationId)),

  createSubscription: adminProcedure
    .input(
      z.object({
        organizationId: z.number().int().positive(),
        plan: z.string().trim().min(1).max(96),
        amountCents: z.number().int().min(0),
        currency: currency.default("EUR"),
        billingInterval: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
        renewsAt: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const s = await createSubscription({ ...input, renewsAt: input.renewsAt ? new Date(input.renewsAt) : null });
      if (!s) fail("INTERNAL_SERVER_ERROR", "Could not create the subscription.");
      await recordAdminEvent({ ctx, reason: `admin.subscription.create(${s.id})` });
      return s;
    }),

  setSubscriptionStatus: adminProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "paused", "past_due", "cancelled"]) }))
    .mutation(async ({ ctx, input }) => {
      const s = await setSubscriptionStatus(input.id, input.status);
      if (!s) fail("PRECONDITION_FAILED", "Subscription not found, or already cancelled.");
      await recordAdminEvent({ ctx, reason: `admin.subscription.status(${input.id}->${input.status})` });
      return s;
    }),

  financialSummary: adminProcedure.query(async () => readFinancialSummary()),

  // =========================================================================
  // Delivery: time review, approvals, archive
  // =========================================================================
  timeEntries: adminProcedure
    .input(z.object({ status: z.enum(["submitted", "approved", "rejected"]).optional() }).default({}))
    .query(async ({ input }) => listTimeEntriesForReview(input.status ?? null)),

  reviewTimeEntry: adminProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.status === "rejected" && !input.note) fail("BAD_REQUEST", "Say why the entry is rejected.");
      const row = await reviewTimeEntry({ id: input.id, status: input.status, reviewerUserId: ctx.user.id, note: input.note ?? null });
      if (!row) fail("PRECONDITION_FAILED", "Entry not found, or it was already reviewed.");
      const dev = await getDeveloperProfileById(row.developerId);
      if (dev) {
        await notifyDeveloper({
          developerId: row.developerId,
          kind: "time",
          title: `Time entry ${input.status}`,
          body: `${row.workDate}: ${row.minutes} minutes${input.note ? `. ${input.note}` : ""}`,
          href: "/developer-workspace/time",
          priority: "normal",
        });
      }
      await recordAdminEvent({ ctx, reason: `admin.time_entry.${input.status}(${input.id})` });
      return row;
    }),

  pendingApprovals: adminProcedure.query(async () => listPendingApprovalsAcrossProjects()),

  requestProjectApproval: adminProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        milestoneId: z.number().int().positive().optional(),
        title: z.string().trim().min(1).max(200),
        description: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const a = await requestProjectApproval({ projectId: input.projectId, milestoneId: input.milestoneId ?? null, title: input.title, description: input.description ?? null, requestedByUserId: ctx.user.id });
      if (a === "project_not_found") fail("NOT_FOUND", "Project not found.");
      if (a === "milestone_mismatch") fail("BAD_REQUEST", "That milestone does not belong to this project.");
      if (!a) fail("INTERNAL_SERVER_ERROR", "Could not request the approval.");
      await recordAdminEvent({ ctx, reason: `admin.project_approval.request(${a.id}:project=${input.projectId})` });
      const orgId = await getProjectOrganizationId(input.projectId);
      if (orgId) {
        await emitNotification({ event: "PROJECT_REVIEW_REQUESTED", audience: { type: "client", organizationId: orgId }, dedupeRef: `approval:${a.id}`, title: `Your approval is needed: ${input.title}`, href: "/client-portal/approvals" });
      }
      return a;
    }),

  archiveProject: adminProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const res = await archiveClientProject(input.projectId);
    if (!res) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
    if (!res.ok) fail("PRECONDITION_FAILED", res.reason);
    await recordAdminEvent({ ctx, reason: `admin.project.archive(${input.projectId})` });
    return { ok: true as const };
  }),

  // =========================================================================
  // AI governance (SRS 19), super admin
  // =========================================================================
  aiAgents: adminProcedure.query(async () => listAiAgents()),
  aiExecutions: adminProcedure
    .input(z.object({ agentKey: z.string().max(64).optional() }).default({}))
    .query(async ({ input }) => listAiExecutions(input.agentKey)),
  aiPromptVersions: adminProcedure.input(z.object({ agentKey: z.string().max(64) })).query(async ({ input }) => listPromptVersions(input.agentKey)),

  upsertAiAgent: superAdminProcedure
    .input(
      z.object({
        key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/, "Lower case letters, digits and underscores."),
        name: z.string().trim().min(1).max(120),
        purpose: z.string().max(2000).optional(),
        permissions: z.array(z.string().trim().min(1).max(96)).max(50),
        requiresHumanApproval: z.boolean().default(true),
        status: z.enum(["active", "disabled"]).default("active"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const a = await upsertAiAgent({ ...input, purpose: input.purpose ?? null });
      if (!a) fail("INTERNAL_SERVER_ERROR", "Could not save the agent.");
      await recordAdminEvent({ ctx, reason: `admin.ai_agent.upsert(${a.key}:${a.status})` });
      return a;
    }),

  addPromptVersion: superAdminProcedure
    .input(z.object({ agentKey: z.string().max(64), body: z.string().trim().min(1).max(50000), changeNote: z.string().max(500).optional(), activate: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const v = await addPromptVersion({ agentKey: input.agentKey, body: input.body, changeNote: input.changeNote ?? null, createdByUserId: ctx.user.id, activate: input.activate });
      if (v === "agent_not_found") fail("NOT_FOUND", "Agent not found.");
      if (!v) fail("INTERNAL_SERVER_ERROR", "Could not save the prompt.");
      await recordAdminEvent({ ctx, reason: `admin.ai_prompt.add(${input.agentKey}:v${v.version}${input.activate ? ":active" : ""})` });
      return v;
    }),

  activatePromptVersion: superAdminProcedure
    .input(z.object({ agentKey: z.string().max(64), version: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await activatePromptVersion(input.agentKey, input.version))) fail("NOT_FOUND", "That prompt version does not exist.");
      await recordAdminEvent({ ctx, reason: `admin.ai_prompt.activate(${input.agentKey}:v${input.version})` });
      return { ok: true as const };
    }),

  runAiAgentAction: adminProcedure
    .input(z.object({ agentKey: z.string().max(64), action: z.string().max(96), subjectRef: z.string().max(128).optional(), detail: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const r = await authoriseAndRecordAgentAction({ agentKey: input.agentKey, action: input.action, subjectRef: input.subjectRef ?? null, detail: input.detail ?? null });
      if (!r) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      await recordAdminEvent({ ctx, reason: `admin.ai_agent.run(${input.agentKey}:${input.action}:${r.outcome})`, outcome: r.outcome === "blocked_by_permission" ? "failed" : "success" });
      return r;
    }),

  decideAiExecution: adminProcedure
    .input(z.object({ executionId: z.number().int().positive(), approve: z.boolean(), note: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const r = await decideAiExecution({ executionId: input.executionId, approve: input.approve, userId: ctx.user.id, note: input.note ?? null });
      if (r === "not_found") fail("NOT_FOUND", "Execution not found.");
      if (r === "not_awaiting") fail("PRECONDITION_FAILED", "That execution is not awaiting approval.");
      if (r === "already_decided") fail("PRECONDITION_FAILED", "A decision was already recorded.");
      if (!r) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      await recordAdminEvent({ ctx, reason: `admin.ai_execution.${input.approve ? "approve" : "reject"}(${input.executionId})` });
      return { ok: true as const };
    }),

  // =========================================================================
  // Configuration with validation and history (SRS 13.9, 24.9), super admin
  // =========================================================================
  configHistory: adminProcedure
    .input(z.object({ settingKey: z.string().max(128).optional() }).default({}))
    .query(async ({ input }) => listConfigHistory(input.settingKey)),

  // =========================================================================
  // Incidents and alerts (SRS 20, 25), ops
  // =========================================================================
  incidents: opsProcedure
    .input(z.object({ category: z.enum(["security", "operational"]).optional(), status: z.enum(["open", "investigating", "resolved", "closed"]).optional() }).default({}))
    .query(async ({ input }) => listIncidents(input)),

  createIncident: opsProcedure
    .input(
      z.object({
        category: z.enum(["security", "operational"]),
        title: z.string().trim().min(1).max(200),
        description: z.string().max(8000).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const i = await createIncident({ ...input, description: input.description ?? null, reportedByUserId: ctx.user.id });
      if (!i) fail("INTERNAL_SERVER_ERROR", "Could not register the incident.");
      if (i.severity === "critical") {
        await emitNotification({
          event: i.category === "security" ? "SECURITY_ALERT_CRITICAL" : "PLATFORM_INCIDENT_CRITICAL",
          audience: { type: "admin" },
          dedupeRef: `incident:${i.id}`,
          title: `Critical ${i.category} incident: ${i.title}`,
          href: "/admin/governance",
        });
      } else if (i.severity === "high") {
        await createAdminNotification({ kind: "incident", title: `High ${i.category} incident: ${i.title}`, href: "/admin/governance", priority: "high" });
      }
      await recordAdminEvent({ ctx, reason: `ops.incident.create(${i.id}:${i.category}:${i.severity})` });
      void fireTrigger("incident_created", { title: i.title, severity: i.severity, category: i.category }, String(i.id));
      return i;
    }),

  updateIncident: opsProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["open", "investigating", "resolved", "closed"]).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        assignedToUserId: z.number().int().positive().nullable().optional(),
        resolution: z.string().max(8000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const r = await updateIncident(input);
      if (!r) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      if (!r.ok) fail(r.code, r.reason);
      await recordAdminEvent({ ctx, reason: `ops.incident.update(${input.id}${input.status ? `:${input.status}` : ""})` });
      return r.incident;
    }),

  alertRules: opsProcedure.query(async () => listAlertRules()),

  updateAlertRule: superAdminProcedure
    .input(z.object({ id: z.number().int().positive(), threshold: z.number().int().min(1).max(100000).optional(), windowMinutes: z.number().int().min(1).max(10080).optional(), enabled: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const r = await updateAlertRule(input);
      if (!r) fail("NOT_FOUND", "Alert rule not found, or nothing to change.");
      await recordAdminEvent({ ctx, reason: `admin.alert_rule.update(${r.key})` });
      return r;
    }),

  /** Run the evaluator now. The same function runs on a timer in production. */
  evaluateAlerts: opsProcedure.mutation(async ({ ctx }) => {
    const results = await evaluateAlertRules();
    await recordAdminEvent({ ctx, reason: `ops.alerts.evaluate(fired=${results.filter((r) => r.fired).length})` });
    return results;
  }),

  // =========================================================================
  // Scheduled reports (SRS 21.11)
  // =========================================================================
  scheduledReports: adminProcedure.query(async () => listScheduledReports()),

  createScheduledReport: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(160),
        reportKind: z.enum(["pipeline", "billing", "delivery", "security"]),
        cadence: z.enum(["daily", "weekly", "monthly"]),
        recipients: z.array(z.string().email()).min(1).max(20),
        firstRunAt: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const first = new Date(input.firstRunAt);
      if (first.getTime() < Date.now() - 60_000) fail("BAD_REQUEST", "The first run must be in the future.");
      const r = await createScheduledReport({ ...input, firstRunAt: first, createdByUserId: ctx.user.id });
      if (!r) fail("INTERNAL_SERVER_ERROR", "Could not schedule the report.");
      await recordAdminEvent({ ctx, reason: `admin.scheduled_report.create(${r.id}:${r.reportKind}:${r.cadence})` });
      return r;
    }),

  setScheduledReportEnabled: adminProcedure
    .input(z.object({ id: z.number().int().positive(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const r = await setScheduledReportEnabled(input.id, input.enabled);
      if (!r) fail("NOT_FOUND", "Scheduled report not found.");
      await recordAdminEvent({ ctx, reason: `admin.scheduled_report.${input.enabled ? "enable" : "disable"}(${input.id})` });
      return r;
    }),

  // =========================================================================
  // Audit search and export (SRS 13.9), documents search (SRS 18.12), health
  // =========================================================================
  auditSearch: adminProcedure
    .input(auditFilter.extend({ limit: z.number().int().min(1).max(200).default(50), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const { limit, offset, ...filter } = input;
      await recordAdminEvent({ ctx, reason: "admin.audit.search" });
      return searchAuditLog(filter, limit, offset);
    }),

  /** Returns CSV text; the browser turns it into a download. Capped, and the export itself is audited. */
  auditExport: adminProcedure.input(auditFilter).mutation(async ({ ctx, input }) => {
    const rows = await exportAuditLog(input);
    await recordAdminEvent({ ctx, reason: `admin.audit.export(rows=${rows.length})` });
    const columns = ["createdAt", "provider", "outcome", "identifier", "reason", "ip", "userId"];
    return { csv: toCsv(columns, rows as unknown as Array<Record<string, unknown>>), rows: rows.length, truncated: rows.length >= AUDIT_EXPORT_LIMIT };
  }),

  searchDocuments: adminProcedure
    .input(z.object({ q: z.string().trim().min(2).max(100), category: z.string().max(96).optional() }))
    .query(async ({ ctx, input }) => {
      await recordAdminEvent({ ctx, reason: "admin.documents.search" });
      return searchDocuments({ organizationId: null, q: input.q, category: input.category });
    }),

  platformHealth: opsProcedure.query(async () => readPlatformHealth()),

  // =========================================================================
  // AI Scan expert review (SRS 9.6, 12.8, BR-009, BR-016)
  // =========================================================================
  aiScanReviewQueue: adminProcedure
    .input(z.object({ statuses: z.array(z.enum(REPORT_STATUSES)).min(1).max(9).default(["awaiting_expert_review", "revision_required", "approved"]) }).default({ statuses: ["awaiting_expert_review", "revision_required", "approved"] }))
    .query(async ({ input }) => listAiScansForReview(input.statuses as ReportStatus[])),

  aiScanHistory: adminProcedure.input(z.object({ scanId: z.number().int().positive() })).query(async ({ input }) => listAiScanStatusEvents(input.scanId)),

  assignAiScanReviewer: adminProcedure
    .input(z.object({ scanId: z.number().int().positive(), reviewerUserId: z.number().int().positive().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const scan = await assignAiScanReviewer(input.scanId, input.reviewerUserId);
      if (!scan) fail("NOT_FOUND", "AI Scan not found.");
      await recordAdminEvent({ ctx, reason: `admin.ai_scan.assign_reviewer(${input.scanId}->${input.reviewerUserId ?? "none"})` });
      if (input.reviewerUserId) {
        await emitNotification({ event: "AI_SCAN_REVIEW_ASSIGNED", audience: { type: "admin" }, dedupeRef: `scan:${input.scanId}:reviewer:${input.reviewerUserId}`, title: `AI Scan SCN-${input.scanId} assigned for review`, href: "/admin/governance" });
      }
      return { ok: true as const };
    }),

  /** The only way a report is approved, sent back, published or archived: a person does it. */
  moveAiScanReport: adminProcedure
    .input(
      z.object({
        scanId: z.number().int().positive(),
        to: z.enum(["approved", "revision_required", "published", "archived"]),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const res = await transitionAiScanReport({ scanId: input.scanId, to: input.to, actorUserId: ctx.user.id, note: input.note ?? null });
      if (!res) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      if (!res.ok) fail(res.code, res.reason);
      await recordAdminEvent({ ctx, reason: `admin.ai_scan.${input.to}(${input.scanId}:from=${res.from})` });
      const label = res.scan.company || res.scan.fullName;
      // The reviewer's decision is the human decision on the AI run that drafted this report.
      if (input.to === "approved" || input.to === "revision_required") {
        await decideLatestAiExecutionForSubject({ agentKey: AI_SCAN_AGENT_KEY, subjectRef: `scan:${res.scan.id}`, approve: input.to === "approved", userId: ctx.user.id, note: input.note ?? null }).catch((e) => console.error("[aiScan] could not link the decision to the AI run:", e));
      }
      if (input.to === "published") {
        // SRS 9.9: tell the customer. A mail failure must not undo the publication.
        const base = process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || "https://iosky.com";
        const link = `${base}/ai-scan/result/${res.scan.reportToken}`;
        try {
          await dispatchSimpleEmail({
            to: res.scan.email,
            subject: "Your IO SKY AI Scan report is ready",
            html: `<p>Hello ${escapeHtml(res.scan.fullName)},</p><p>Your AI Scan report has been reviewed by our team and is now available.</p><p><a href="${link}">Open your report</a></p><p>IO SKY</p>`,
            text: `Hello ${res.scan.fullName},\n\nYour AI Scan report has been reviewed by our team and is now available:\n${link}\n\nIO SKY`,
            refHeader: `ai-scan-published:${res.scan.id}`,
            messageType: "notification",
            relatedRef: `ai-scan:${res.scan.id}`,
          });
        } catch (err) {
          console.error("[aiScan] publish email failed:", err);
        }
      }
      const eventFor = { approved: "AI_SCAN_REVIEW_APPROVED", revision_required: "AI_SCAN_CHANGES_REQUIRED", published: "AI_SCAN_PUBLISHED" } as const;
      if (input.to !== "archived") {
        await emitNotification({
          event: eventFor[input.to],
          audience: { type: "admin" },
          dedupeRef: `scan:${res.scan.id}:${input.to}:${Date.now()}`,
          title: `AI Scan ${input.to.replace(/_/g, " ")}: ${label}`,
          body: input.note ?? null,
          href: "/admin/governance",
        });
      }
      return { ok: true as const, status: input.to };
    }),

  /** After a revision request: re-run the engine against the stored answers, then it returns to review. */
  regenerateAiScanReport: adminProcedure.input(z.object({ scanId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const scan = await getAiScanById(input.scanId);
    if (!scan) fail("NOT_FOUND", "AI Scan not found.");
    if (scan.reportStatus !== "revision_required") fail("PRECONDITION_FAILED", "Only a report that needs revision can be regenerated.");
    let answers: Record<string, string>;
    let contextNote: string | undefined;
    try {
      const parsed = JSON.parse(scan.responses ?? "{}") as { answers?: Record<string, string>; contextNote?: string };
      if (!parsed.answers || Object.keys(parsed.answers).length === 0) throw new Error("none");
      answers = parsed.answers;
      contextNote = parsed.contextNote ?? undefined;
    } catch {
      fail("BAD_REQUEST", "This scan has no stored answers to regenerate from.");
    }
    const { runAiScanEngine } = await import("./aiScans");
    runAiScanEngine({
      scanId: scan.id,
      reportToken: scan.reportToken,
      tier: scan.tier as "free" | "growth" | "elite",
      locale: scan.locale ?? "en",
      fullName: scan.fullName ?? "",
      email: scan.email ?? "",
      company: scan.company ?? "",
      answers,
      contextNote,
    }).catch((e) => console.warn("[adminOps.regenerateAiScanReport] engine threw:", e));
    await recordAdminEvent({ ctx, reason: `admin.ai_scan.regenerate(${scan.id})` });
    return { ok: true as const };
  }),

  // =========================================================================
  // Discovery Call outcomes (SRS 14.7) and developer task comments (SRS 11.7)
  // =========================================================================
  callOutcome: adminProcedure.input(z.object({ bookingId: z.number().int().positive() })).query(async ({ input }) => getCallOutcome(input.bookingId)),

  recordCallOutcome: adminProcedure
    .input(
      z.object({
        bookingId: z.number().int().positive(),
        outcome: z.enum(CALL_OUTCOMES),
        notes: z.string().trim().max(4000).optional(),
        followUpAt: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const followUpAt = input.followUpAt ? new Date(input.followUpAt) : null;
      const verdict = checkCallOutcome({ outcome: input.outcome, followUpAt, now: new Date() });
      if (!verdict.ok) fail("BAD_REQUEST", verdict.reason);
      const res = await recordCallOutcome({ bookingId: input.bookingId, outcome: input.outcome, notes: input.notes ?? null, followUpAt, userId: ctx.user.id });
      if (res === "booking_not_found") fail("NOT_FOUND", "Booking not found.");
      if (res === "booking_cancelled") fail("PRECONDITION_FAILED", "A cancelled call cannot have an outcome.");
      if (!res) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      await recordAdminEvent({ ctx, reason: `admin.call_outcome(${input.bookingId}:${input.outcome})` });
      return res;
    }),

  taskComments: adminProcedure.input(z.object({ taskId: z.number().int().positive() })).query(async ({ input }) => listTaskCommentsForStaff(input.taskId)),

  commentOnTask: adminProcedure
    .input(z.object({ taskId: z.number().int().positive(), body: z.string().trim().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const c = await addTaskCommentByStaff({ taskId: input.taskId, userId: ctx.user.id, body: input.body });
      if (c === "task_not_found") fail("NOT_FOUND", "That task is not assigned to anyone yet.");
      if (!c) fail("INTERNAL_SERVER_ERROR", "Could not save the comment.");
      await recordAdminEvent({ ctx, reason: `admin.task_comment(${input.taskId})` });
      return c;
    }),

  /** Who was told what, and every email attempt (SRS 17.13). Admin only: recipients are personal data. */
  communicationHistory: adminProcedure.query(async ({ ctx }) => {
    await recordAdminEvent({ ctx, reason: "admin.read.communication_history" });
    const [events, emails] = await Promise.all([listNotificationEvents(100), listRecentEmailLog(100)]);
    return { events, emails };
  }),

  /** Live compliance checks (SRS 20.9): each is a query against current data, not a stored label. */
  compliance: opsProcedure.query(async () => {
    // Rules are created on first use; make sure the defaults exist so a fresh install is judged fairly.
    await listAlertRules();
    const checks = evaluateCompliance(await readComplianceInputs());
    return { checks, summary: complianceSummary(checks), generatedAt: Date.now() };
  }),
});
