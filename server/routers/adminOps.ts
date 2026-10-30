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
 *   - scopedOpsProcedure(op)       incidents, alerts and health (technical operators too, by granted scope)
 *   - superAdminProcedure platform configuration and AI governance
 *
 * Every mutation writes an audit row through recordAdminEvent, and every state
 * change is guarded by the lifecycle rules in shared/srsRules.ts.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, scopedOpsProcedure, router, superAdminProcedure } from "../_core/trpc";
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
  updateQuote,
  getQuoteWithCustomer,
  createScheduledReport,
  createSubscription,
  customerTimeline,
  customerProfile,
  decideAiExecution,
  evaluateAlertRules,
  getDeveloperProfileById,
  listAdminNotifications,
  getAdminNotificationById,
  listEmailOutbox,
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
  shapeFinancialSummaryForRole,
  readPipelineSummary,
  requestProjectApproval,
  reviewTimeEntry,
  setScheduledReportEnabled,
  setSubscriptionStatus,
  updateAlertRule,
  updateIncident,
  upsertAiAgent,
  getAiAgentDefinition,
} from "../db";
import {
  DOCUMENT_STATUSES,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "../../shared/srsRules";
import { recordAdminEvent } from "./admin";
import { emitNotification } from "../notificationDispatcher";
import { resolveNotificationLink } from "../../shared/notificationLinks";
import { evaluateRelease } from "../../shared/documentHandoff";
import { FAQ_AUDIENCES, FAQ_STATUSES, reviewWarnings, validateFaqDraft } from "../../shared/faqRules";
import { createFaq, decideFaq, editFaq, listFaqEvents, listFaqForReview } from "../db/faq";
import { previewTeamAssignment, addTeamMember, createTeam, listTeams, removeTeamMember, setTeamArchived, setTeamMemberRole, setTeamPrimaryContact, type TeamOutcome } from "../db/developerTeams";
import { MEMBER_REFUSAL_TEXT, TEAM_ROLES } from "../../shared/teamRules";
import { diffPrompts, PROMPT_LIMITS, renderPreview } from "../../shared/promptTools";
import { buildQuoteDocument, renderQuoteHtml } from "../../shared/quoteDocument";
import { actionFor, authorizeReportAction, REPORT_REFUSAL_TEXT } from "../../shared/reportPermissions";
import { attachDecisions, compareReports, parseReportPayload } from "../../shared/reportCompare";
import { getReportVersionPayload, listReportVersions } from "../db/aiScans";
import { getScopeGrants } from "../db/platformGovernance";
import { renderQuotePdf } from "../quotePdf";
import { OWNER_REFUSAL_TEXT } from "../../shared/leadOwnership";
import { PLAN_REFUSAL_TEXT } from "../../shared/teamAssignment";
import { SUPPORT_AGENT, SUPPORT_AGENT_KEY, SUPPORT_BASE_PROMPT } from "../../shared/supportAgent";
import { ATTEMPT_RESULTS, REFUSAL_TEXT as CALLBACK_REFUSAL } from "../../shared/callbackRules";
import { actOnCallback, createCallback as createCallbackTask, isStaffUser, listCallbackEvents, listCallbacks } from "../db/callbacks";
import { assignDeveloperToProject } from "../db/developerWorkspace";
import { checkMessage, describeLeaks, findIdentityLeaks, MESSAGE_LIMITS, MESSAGE_REFUSAL_TEXT } from "../../shared/mediatedMessaging";
import { broadcastToDevelopers, clientIdentities, developerIdentities, developerServesOrganization, getClientMessage, getDeveloperMessage, listMediationLog, relayToClient, relayToDeveloper } from "../db/mediatedMessaging";
import { setLeadOwner } from "../db/crm";
import { createRelease, getReleaseFacts, linkDeveloperProject, listActiveAssignedDeveloperIds, listReleases, revokeRelease, unlinkDeveloperProject } from "../db/documentHandoff";
const message_alreadyReleased = "This document is already released to that project.";
import { KNOWLEDGE_SOURCES, REGISTRY_LIMITS, validateRegistryFields } from "../../shared/aiAgentRegistry";
import { EXPORT_DATASETS, INVITABLE_ROLES, mayViewCompanyRevenue, INVITATION_TTL_DAYS, canInviteRole, complianceSummary, evaluateCompliance } from "../../shared/srsRules";
import { AI_SCAN_AGENT_KEY, createInvitation, decideLatestAiExecutionForSubject, listInvitations, revokeInvitation, listDeployments, readComplianceInputs, readExportDataset, readMonthlyHistory } from "../db";
import { fireTrigger } from "../workflowEngine";
import { readCampaignOverview } from "../db/campaigns";
import { brandedEmail, resolveEventMessage } from "../emailShell";
import { PROJECT_LIFECYCLE } from "../../shared/srsRules";
import { listProjectLifecycleEvents, listProjectLifecycles, setProjectLifecycle } from "../db/srsDelivery";
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
import { notifyClient, notifyDeveloper } from "../notifications";

const currency = z.string().length(3).transform((s) => s.toUpperCase());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

/** Turn a team operation outcome into the right error, or return when it succeeded. */
function teamResult(r: TeamOutcome): void {
  if (r.ok) return;
  if (r.reason === "team_not_found") fail("NOT_FOUND", "No such team.");
  if (r.reason === "developer_not_found") fail("NOT_FOUND", "Developer not found.");
  if (r.reason === "conflict") fail("CONFLICT", "The team changed at the same moment. Reload and try again.");
  if (r.reason === "unavailable") fail("INTERNAL_SERVER_ERROR", "The team store is unavailable.");
  fail(r.reason === "team_archived" ? "PRECONDITION_FAILED" : "BAD_REQUEST", MEMBER_REFUSAL_TEXT[r.reason]);
}

function fail(code: "NOT_FOUND" | "PRECONDITION_FAILED" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR" | "FORBIDDEN" | "CONFLICT", message: string): never {
  throw new TRPCError({ code, message });
}

export const adminOpsRouter = router({
  /** C01: give a lead an owner (an admin or super admin), change it, or clear it. Recorded. */
  assignLeadOwner: adminProcedure
    .input(z.object({ leadId: z.number().int().positive(), ownerUserId: z.number().int().positive().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const r = await setLeadOwner({ ...input, actorUserId: ctx.user.id });
      if (!r.ok) {
        if (r.reason === "lead_not_found") fail("NOT_FOUND", "Lead not found.");
        if (r.reason === "unavailable") fail("INTERNAL_SERVER_ERROR", "The owner could not be saved.");
        fail("BAD_REQUEST", OWNER_REFUSAL_TEXT[r.reason]);
      }
      await recordAdminEvent({ ctx, reason: `admin.lead.owner(lead=${input.leadId}->${input.ownerUserId ?? "none"})` });
      return r;
    }),

  // ---- Callbacks (R21): a promised callback is tracked, assigned and escalated if missed ----------------------------

  callbacks: adminProcedure.input(z.object({ openOnly: z.boolean().default(true), mine: z.boolean().default(false) }).default({ openOnly: true, mine: false })).query(async ({ ctx, input }) => listCallbacks({ openOnly: input.openOnly, assignedToUserId: input.mine ? ctx.user.id : undefined })),

  callbackHistory: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => listCallbackEvents(input.id)),

  createCallback: adminProcedure
    .input(z.object({ callerName: z.string().trim().min(2).max(200), callerPhone: z.string().trim().min(7).max(40), reason: z.string().trim().min(3).max(500), urgent: z.boolean().default(false), leadId: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const r = await createCallbackTask({ leadId: input.leadId ?? null, organizationId: null, callerName: input.callerName, callerPhone: input.callerPhone, reason: input.reason, source: "manual", priority: input.urgent ? "urgent" : "normal", createdByUserId: ctx.user.id });
      if (!r.ok) fail(r.reason === "invalid_phone" ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR", r.reason === "invalid_phone" ? "That phone number cannot be dialled." : "The callback could not be saved.");
      await recordAdminEvent({ ctx, reason: `admin.callback.create(cb=${r.task.id}${r.duplicate ? ":already_open" : ""})` });
      return { id: r.task.id, duplicate: r.duplicate };
    }),

  /** One action on a callback: assign, log an attempt, complete or cancel. The rules decide; a closed callback is never reopened. */
  actOnCallback: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        action: z.discriminatedUnion("type", [
          z.object({ type: z.literal("assign"), userId: z.number().int().positive().nullable() }),
          z.object({ type: z.literal("attempt"), result: z.enum(ATTEMPT_RESULTS), newDueAtMs: z.number().int().optional() }),
          z.object({ type: z.literal("complete"), note: z.string().max(500) }),
          z.object({ type: z.literal("cancel"), reason: z.string().max(500) }),
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const a = input.action;
      if (a.type === "assign" && a.userId !== null && !(await isStaffUser(a.userId))) fail("BAD_REQUEST", "A callback can only be assigned to an admin or super admin.");
      const action = a.type === "attempt" ? ({ type: "attempt", result: a.result, newDueAt: a.newDueAtMs ? new Date(a.newDueAtMs) : null } as const) : a;
      const r = await actOnCallback(input.id, action, ctx.user.id);
      if (!r.ok) {
        if (r.reason === "not_found") fail("NOT_FOUND", "No such callback.");
        if (r.reason === "unavailable") fail("INTERNAL_SERVER_ERROR", "The callback store is unavailable.");
        fail("PRECONDITION_FAILED", CALLBACK_REFUSAL[r.reason]);
      }
      await recordAdminEvent({ ctx, reason: `admin.callback.${a.type}(cb=${input.id}:status=${r.task.status})` });
      return { status: r.task.status, attempts: r.task.attempts, dueAt: r.task.dueAt };
    }),

  /**
   * G10: register the AI Support Agent in the agent registry, DISABLED. A super admin reviews it and enables it
   * from the registry. It never overwrites an agent that is already registered, so edits made there are kept.
   */
  registerSupportAgent: superAdminProcedure.mutation(async ({ ctx }) => {
    if (await getAiAgentDefinition(SUPPORT_AGENT_KEY)) fail("CONFLICT", "The Support Agent is already registered. Change it in the AI agent registry.");
    const a = SUPPORT_AGENT;
    const saved = await upsertAiAgent({ key: a.key, name: a.name, purpose: a.purpose, permissions: [...a.permissions], requiresHumanApproval: a.requiresHumanApproval, status: "disabled", businessFunction: a.businessFunction, capabilities: [...a.capabilities], supportedModules: [...a.supportedModules], tools: [...a.tools], knowledgeSources: [...a.knowledgeSources], escalationRules: a.escalationRules, maxAuthority: a.maxAuthority, responsibleAdminUserId: ctx.user.id });
    if (!saved || saved === "invalid_responsible_admin") fail("INTERNAL_SERVER_ERROR", "The agent could not be registered.");
    const prompt = await addPromptVersion({ agentKey: a.key, body: SUPPORT_BASE_PROMPT, changeNote: "Initial prompt for the Support Agent.", createdByUserId: ctx.user.id, activate: true });
    await recordAdminEvent({ ctx, reason: `admin.ai_agent.register(${a.key}:disabled)` });
    return { key: a.key, status: "disabled" as const, promptVersion: prompt && prompt !== "agent_not_found" ? prompt.version : null };
  }),

  /** C03: one customer's timeline (CRM history, calls, scans, projects, files) with a summary. Staff only. */
  customerProfile: adminProcedure
    .input(z.object({ leadId: z.number().int().positive().optional(), organizationId: z.number().int().positive().optional() }))
    .query(async ({ input }) => {
      if (!input.leadId && !input.organizationId) fail("BAD_REQUEST", "Provide a lead or an organization.");
      return customerProfile(input);
    }),

  // =========================================================================
  // Admin notification feed (SRS 12.15)
  // =========================================================================
  notifications: adminProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false), limit: z.number().int().min(1).max(200).default(50) }).default({ unreadOnly: false, limit: 50 }))
    .query(async ({ input }) => ({
      rows: await listAdminNotifications(input.limit, input.unreadOnly),
      unread: await countUnreadAdminNotifications(),
    })),

  /** N03: failed emails waiting for a retry, or given up on. States only, never the message content. */
  emailRetries: adminProcedure.query(async () => listEmailOutbox(100)),

  unreadNotificationCount: adminProcedure.query(async () => ({ unread: await countUnreadAdminNotifications() })),

  /** N13 (F-28): re-check the link when an admin notification is opened. */
  openNotification: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const n = await getAdminNotificationById(input.id);
      if (!n) fail("NOT_FOUND", "Notification not found.");
      const d = resolveNotificationLink({ href: n.href, portal: "admin", role: ctx.user.role });
      if (!d.allowed) {
        if (d.reason !== "no_link") await recordAdminEvent({ ctx, reason: `admin.notification_link_denied(${d.reason}:${n.id})` });
        return { allowed: false as const, href: null, home: d.home, reason: d.reason };
      }
      await markAdminNotificationsRead(ctx.user.id, n.id);
      return { allowed: true as const, href: d.href, home: null, reason: null };
    }),

  // =========================================================================
  // Controlled document handoff (J09, J10): only IO SKY staff release a client document to developers
  // =========================================================================
  linkDeveloperProject: adminProcedure
    .input(z.object({ developerProjectId: z.number().int().positive(), clientProjectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const r = await linkDeveloperProject({ ...input, userId: ctx.user.id });
      if (r === "developer_project_not_found") fail("NOT_FOUND", "Developer project not found.");
      if (r === "client_project_not_found") fail("NOT_FOUND", "Client project not found.");
      if (r === "unavailable") fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      await recordAdminEvent({ ctx, reason: `admin.handoff.link(dev=${input.developerProjectId}:client=${input.clientProjectId})` });
      return { ok: true as const };
    }),

  unlinkDeveloperProject: adminProcedure
    .input(z.object({ developerProjectId: z.number().int().positive(), clientProjectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const r = await unlinkDeveloperProject({ ...input, userId: ctx.user.id });
      if (!r.removed) fail("NOT_FOUND", "No such link.");
      await recordAdminEvent({ ctx, reason: `admin.handoff.unlink(dev=${input.developerProjectId}:client=${input.clientProjectId}:revoked=${r.revoked})` });
      return r;
    }),

  releaseDocumentToDevelopers: adminProcedure
    .input(z.object({ documentId: z.number().int().positive(), developerProjectId: z.number().int().positive(), note: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const facts = await getReleaseFacts(input);
      if (!facts) fail("NOT_FOUND", "Document or developer project not found.");
      const verdict = evaluateRelease({ actorRole: ctx.user.role, documentStatus: facts.document.status, documentOrganizationId: facts.document.organizationId, linkedProjectOrganizationIds: facts.linkedProjectOrganizationIds, alreadyReleased: facts.alreadyReleased });
      if (!verdict.ok) {
        const message: Record<string, string> = {
          not_staff: "Only IO SKY staff can release a document.",
          document_not_approved: "Approve the document in review before releasing it.",
          not_linked: "Link this developer project to the client project first.",
          organization_mismatch: "This document belongs to a different client than the project linked to this developer project.",
          already_released: "This document is already released to that project.",
        };
        // A mismatch is the one that matters: it means a wrong selection nearly sent one client's file to another's project.
        if (verdict.reason === "organization_mismatch") await recordAdminEvent({ ctx, reason: `admin.handoff.release_blocked(doc=${input.documentId}:dev=${input.developerProjectId}:organization_mismatch)` });
        fail(verdict.reason === "already_released" ? "CONFLICT" : verdict.reason === "not_staff" ? "FORBIDDEN" : "PRECONDITION_FAILED", message[verdict.reason]);
      }
      const rel = await createRelease({ documentId: input.documentId, developerProjectId: input.developerProjectId, userId: ctx.user.id, note: input.note ?? null });
      if (rel === "already_released") fail("CONFLICT", message_alreadyReleased);
      if (!rel) fail("INTERNAL_SERVER_ERROR", "Could not record the release.");
      await recordAdminEvent({ ctx, reason: `admin.handoff.release(doc=${input.documentId}:dev=${input.developerProjectId}:release=${rel.id})` });
      // Tell the developers on that project, without naming the client or the file.
      for (const developerId of await listActiveAssignedDeveloperIds(input.developerProjectId)) {
        await notifyDeveloper({ developerId, kind: "document", title: "A document was released to your project", body: "IO SKY released a new document. Open Released documents to view it.", href: "/developer-workspace/projects", priority: "normal" }).catch(() => undefined);
      }
      return { ok: true as const, releaseId: rel.id };
    }),

  revokeDocumentRelease: adminProcedure
    .input(z.object({ releaseId: z.number().int().positive(), note: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const r = await revokeRelease({ releaseId: input.releaseId, userId: ctx.user.id, note: input.note ?? null });
      if (!r) fail("NOT_FOUND", "No active release with that id.");
      await recordAdminEvent({ ctx, reason: `admin.handoff.revoke(release=${input.releaseId}:doc=${r.documentId}:dev=${r.developerProjectId})` });
      return { ok: true as const };
    }),

  // ---- Approved FAQ store (R17): the only wording the assistants may answer general questions from ----------

  faqEntries: adminProcedure
    .input(z.object({ status: z.enum(FAQ_STATUSES).optional() }).default({}))
    .query(async ({ input }) => (await listFaqForReview(input.status)).map((e) => ({ ...e, warnings: reviewWarnings(e.answer) }))),

  faqHistory: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => listFaqEvents(input.id)),

  createFaq: adminProcedure
    .input(z.object({ question: z.string().trim().min(5).max(300), answer: z.string().trim().min(5).max(2000), keywords: z.array(z.string().trim().min(1).max(40)).max(20).default([]), audience: z.enum(FAQ_AUDIENCES).default("public") }))
    .mutation(async ({ ctx, input }) => {
      const problems = validateFaqDraft(input);
      if (problems.length) fail("BAD_REQUEST", `FAQ entry is not valid: ${problems.join(", ")}.`);
      const r = await createFaq({ ...input, userId: ctx.user.id });
      if (!r) fail("INTERNAL_SERVER_ERROR", "Could not save the FAQ entry.");
      await recordAdminEvent({ ctx, reason: `admin.faq.create(faq=${r.id})` });
      return { id: r.id };
    }),

  editFaq: adminProcedure
    .input(z.object({ id: z.number().int().positive(), question: z.string().trim().min(5).max(300).optional(), answer: z.string().trim().min(5).max(2000).optional(), keywords: z.array(z.string().trim().min(1).max(40)).max(20).optional(), audience: z.enum(FAQ_AUDIENCES).optional() }))
    .mutation(async ({ ctx, input }) => {
      const r = await editFaq({ ...input, userId: ctx.user.id });
      if (!r) fail("NOT_FOUND", "No such FAQ entry.");
      if (r.changed) await recordAdminEvent({ ctx, reason: `admin.faq.edit(faq=${input.id}:status=${r.status}:version=${r.version})` });
      return r;
    }),

  decideFaq: adminProcedure
    .input(z.object({ id: z.number().int().positive(), action: z.enum(["submit", "approve", "reject", "retire", "restore"]) }))
    .mutation(async ({ ctx, input }) => {
      const r = await decideFaq({ id: input.id, action: input.action, userId: ctx.user.id, role: ctx.user.role });
      if (!r.ok) {
        const message: Record<string, [Parameters<typeof fail>[0], string]> = {
          not_found: ["NOT_FOUND", "No such FAQ entry."],
          invalid_transition: ["PRECONDITION_FAILED", "That step is not available for the entry's current status."],
          self_approval: ["FORBIDDEN", "A different person must approve wording you wrote or last changed."],
          not_staff: ["FORBIDDEN", "Only IO SKY staff can review FAQ entries."],
          unavailable: ["INTERNAL_SERVER_ERROR", "The FAQ store is unavailable."],
        };
        if (r.reason === "self_approval") await recordAdminEvent({ ctx, reason: `admin.faq.self_approval_blocked(faq=${input.id})` });
        fail(...message[r.reason]);
      }
      await recordAdminEvent({ ctx, reason: `admin.faq.${input.action}(faq=${input.id}:status=${r.status}:version=${r.version})` });
      return r;
    }),

  // ---- Developer teams (J03): create, members, roles, one primary contact ------------------------------------

  teams: adminProcedure.query(async () => listTeams()),

  createTeam: adminProcedure
    .input(z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const r = await createTeam({ name: input.name, description: input.description ?? null, userId: ctx.user.id });
      if (!r.ok) {
        if (r.reason === "invalid_name") fail("BAD_REQUEST", "Team names use letters, digits, spaces and common punctuation, 2 to 80 characters.");
        if (r.reason === "name_taken") fail("CONFLICT", "An active team already has that name.");
        fail("INTERNAL_SERVER_ERROR", "Could not create the team.");
      }
      await recordAdminEvent({ ctx, reason: `admin.team.create(team=${r.id})` });
      return { id: r.id };
    }),

  addTeamMember: adminProcedure
    .input(z.object({ teamId: z.number().int().positive(), developerId: z.number().int().positive(), role: z.enum(TEAM_ROLES).default("member") }))
    .mutation(async ({ ctx, input }) => {
      teamResult(await addTeamMember({ ...input, userId: ctx.user.id }));
      await notifyDeveloper({ developerId: input.developerId, kind: "team", title: "You were added to a team", body: null, href: "/developer-workspace", priority: "normal" }).catch(() => undefined);
      await recordAdminEvent({ ctx, reason: `admin.team.add_member(team=${input.teamId}:dev=${input.developerId}:${input.role})` });
      return { ok: true as const };
    }),

  removeTeamMember: adminProcedure
    .input(z.object({ teamId: z.number().int().positive(), developerId: z.number().int().positive(), successorId: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      teamResult(await removeTeamMember({ ...input, userId: ctx.user.id }));
      await recordAdminEvent({ ctx, reason: `admin.team.remove_member(team=${input.teamId}:dev=${input.developerId}${input.successorId ? `:successor=${input.successorId}` : ""})` });
      return { ok: true as const };
    }),

  setTeamPrimaryContact: adminProcedure
    .input(z.object({ teamId: z.number().int().positive(), developerId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      teamResult(await setTeamPrimaryContact({ ...input, userId: ctx.user.id }));
      await recordAdminEvent({ ctx, reason: `admin.team.primary_contact(team=${input.teamId}:dev=${input.developerId})` });
      return { ok: true as const };
    }),

  setTeamMemberRole: adminProcedure
    .input(z.object({ teamId: z.number().int().positive(), developerId: z.number().int().positive(), role: z.enum(TEAM_ROLES) }))
    .mutation(async ({ ctx, input }) => {
      teamResult(await setTeamMemberRole({ ...input, userId: ctx.user.id }));
      await recordAdminEvent({ ctx, reason: `admin.team.role(team=${input.teamId}:dev=${input.developerId}:${input.role})` });
      return { ok: true as const };
    }),

  /** J06: what putting this team on this project would do, member by member. Changes nothing. */
  previewTeamAssignment: adminProcedure
    .input(z.object({ teamId: z.number().int().positive(), projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const v = await previewTeamAssignment(input);
      if (!v.found) fail(v.reason === "unavailable" ? "INTERNAL_SERVER_ERROR" : "NOT_FOUND", v.reason === "unavailable" ? "The team store is unavailable." : v.reason === "team_not_found" ? "No such team." : "No such project.");
      return { project: v.project, team: v.team, names: v.names, plan: v.plan, refusal: v.plan.ok ? null : PLAN_REFUSAL_TEXT[v.plan.reason] };
    }),

  /**
   * J06: put every eligible member of a team on a developer project. The plan is recomputed here from the data,
   * never taken from the screen. An existing project lead is not displaced. Each member is reported.
   */
  assignTeamToProject: adminProcedure
    .input(z.object({ teamId: z.number().int().positive(), projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const v = await previewTeamAssignment(input);
      if (!v.found) fail(v.reason === "unavailable" ? "INTERNAL_SERVER_ERROR" : "NOT_FOUND", v.reason === "unavailable" ? "The team store is unavailable." : v.reason === "team_not_found" ? "No such team." : "No such project.");
      if (!v.plan.ok) fail("PRECONDITION_FAILED", PLAN_REFUSAL_TEXT[v.plan.reason]);
      const assigned: number[] = [];
      const failed: number[] = [];
      for (const a of v.plan.assign) {
        const r = await assignDeveloperToProject({ projectId: input.projectId, developerId: a.developerId, assignmentRole: a.role, createdByUserId: ctx.user.id }).catch(() => null);
        if (r) {
          assigned.push(a.developerId);
          await emitNotification({ event: "PROJECT_ASSIGNED", audience: { type: "developer", developerId: a.developerId }, dedupeRef: `project:${input.projectId}:${a.developerId}:${Date.now()}`, title: `New project assignment: ${v.project.name}`, body: `You were assigned to ${v.project.code} as ${a.role}.`, href: "/developer-workspace/projects" });
        } else failed.push(a.developerId);
      }
      await recordAdminEvent({ ctx, reason: `admin.team.assign_project(team=${input.teamId}:project=${input.projectId}:assigned=${assigned.length}:skipped=${v.plan.skipped.length}:failed=${failed.length})` });
      return { assigned: assigned.length, skipped: v.plan.skipped, failed: failed.length };
    }),

  setTeamArchived: adminProcedure
    .input(z.object({ teamId: z.number().int().positive(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const r = await setTeamArchived(input);
      if (r === "not_found") fail("NOT_FOUND", "No such team.");
      if (r === "name_taken") fail("CONFLICT", "Another active team now has this name. Rename one of them first.");
      if (r === "unavailable") fail("INTERNAL_SERVER_ERROR", "The team store is unavailable.");
      await recordAdminEvent({ ctx, reason: `admin.team.${input.archived ? "archive" : "restore"}(team=${input.teamId})` });
      return { ok: true as const };
    }),

  // ---- Mediated messaging (J07): staff stand between developers and clients ---------------------------------

  /**
   * Carry a point from a developer to a client. Staff write the message; it arrives as IO SKY, never under the
   * developer's name, and is refused if it reveals who the developer is. The developer must actually work on
   * this client's project.
   */
  relayDeveloperMessageToClient: adminProcedure
    .input(z.object({ developerMessageId: z.number().int().positive(), organizationId: z.number().int().positive(), subject: z.string().max(200).optional(), body: z.string().max(MESSAGE_LIMITS.body) }))
    .mutation(async ({ ctx, input }) => {
      const src = await getDeveloperMessage(input.developerMessageId);
      if (!src || src.sender !== "developer") fail("NOT_FOUND", "That developer message does not exist.");
      if (!(await developerServesOrganization(src.developerId, input.organizationId))) fail("PRECONDITION_FAILED", "That developer does not work on this client's project, so their message cannot be passed to this client.");
      const msg = checkMessage({ subject: input.subject, body: input.body });
      if (!msg.ok) fail("BAD_REQUEST", MESSAGE_REFUSAL_TEXT[msg.reason]);
      const leaks = findIdentityLeaks(`${msg.subject ?? ""}\n${msg.body}`, await developerIdentities(src.developerId));
      if (leaks.blocking.length > 0) fail("BAD_REQUEST", describeLeaks(leaks));
      const sent = await relayToClient({ sourceMessageId: src.id, developerId: src.developerId, organizationId: input.organizationId, subject: msg.subject, body: msg.body, actorUserId: ctx.user.id });
      if (!sent.ok) fail("INTERNAL_SERVER_ERROR", "The message could not be sent, so nothing was delivered.");
      await notifyClient({ organizationId: input.organizationId, kind: "message", title: "New message from IO SKY", body: msg.subject, href: "/client-portal/messages", priority: "normal" }).catch(() => undefined);
      await recordAdminEvent({ ctx, reason: `admin.message.relay(developer_to_client:src=${src.id}:org=${input.organizationId})` });
      return { ok: true as const, warnings: leaks.warnings.map((w) => w.kind) };
    }),

  /** The other direction: a client's point goes to the developer who needs it, as IO SKY, without naming the client. */
  relayClientMessageToDeveloper: adminProcedure
    .input(z.object({ clientMessageId: z.number().int().positive(), developerId: z.number().int().positive(), subject: z.string().max(200).optional(), body: z.string().max(MESSAGE_LIMITS.body) }))
    .mutation(async ({ ctx, input }) => {
      const src = await getClientMessage(input.clientMessageId);
      if (!src || src.sender !== "client") fail("NOT_FOUND", "That client message does not exist.");
      if (!(await developerServesOrganization(input.developerId, src.organizationId))) fail("PRECONDITION_FAILED", "That developer does not work on this client's project, so this client's message cannot be passed to them.");
      const msg = checkMessage({ subject: input.subject, body: input.body });
      if (!msg.ok) fail("BAD_REQUEST", MESSAGE_REFUSAL_TEXT[msg.reason]);
      const leaks = findIdentityLeaks(`${msg.subject ?? ""}\n${msg.body}`, await clientIdentities(src.organizationId, src.senderName));
      if (leaks.blocking.length > 0) fail("BAD_REQUEST", describeLeaks(leaks));
      const sent = await relayToDeveloper({ sourceMessageId: src.id, developerId: input.developerId, organizationId: src.organizationId, subject: msg.subject, body: msg.body, actorUserId: ctx.user.id });
      if (!sent.ok) fail("INTERNAL_SERVER_ERROR", "The message could not be sent, so nothing was delivered.");
      await notifyDeveloper({ developerId: input.developerId, kind: "message", title: "New message from IO SKY", body: msg.subject, href: "/developer-workspace/messages", priority: "normal" }).catch(() => undefined);
      await recordAdminEvent({ ctx, reason: `admin.message.relay(client_to_developer:src=${src.id}:dev=${input.developerId})` });
      return { ok: true as const, warnings: leaks.warnings.map((w) => w.kind) };
    }),

  /** One message to a developer, a whole team, or everyone active on a developer project. Each gets it in their own thread. */
  messageDevelopers: adminProcedure
    .input(z.object({ audience: z.object({ type: z.enum(["developer", "team", "project"]), id: z.number().int().positive() }), subject: z.string().max(200).optional(), body: z.string().max(MESSAGE_LIMITS.body) }))
    .mutation(async ({ ctx, input }) => {
      const msg = checkMessage({ subject: input.subject, body: input.body });
      if (!msg.ok) fail("BAD_REQUEST", MESSAGE_REFUSAL_TEXT[msg.reason]);
      const sent = await broadcastToDevelopers({ audienceType: input.audience.type, audienceRef: input.audience.id, subject: msg.subject, body: msg.body, actorUserId: ctx.user.id });
      if (!sent.ok) {
        if (sent.reason === "no_recipients" || sent.reason === "too_many") fail("PRECONDITION_FAILED", MESSAGE_REFUSAL_TEXT[sent.reason]);
        fail("INTERNAL_SERVER_ERROR", "The message could not be sent, so nothing was delivered.");
      }
      for (const developerId of sent.recipients) await notifyDeveloper({ developerId, kind: "message", title: "New message from IO SKY", body: msg.subject, href: "/developer-workspace/messages", priority: "normal" }).catch(() => undefined);
      await recordAdminEvent({ ctx, reason: `admin.message.broadcast(${input.audience.type}=${input.audience.id}:recipients=${sent.recipients.length})` });
      return { ok: true as const, recipients: sent.recipients.length };
    }),

  mediationLog: adminProcedure.query(async () => listMediationLog(100)),

  documentReleases: adminProcedure
    .input(z.object({ developerProjectId: z.number().int().positive().optional(), documentId: z.number().int().positive().optional() }).default({}))
    .query(async ({ input }) => listReleases(input)),

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

  /** B07: edit a DRAFT quotation. The total is recomputed from the lines. A sent quotation cannot be edited. */
  updateQuote: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(200).optional(),
        organizationId: z.number().int().positive().nullable().optional(),
        opportunityId: z.number().int().positive().nullable().optional(),
        currency: currency.optional(),
        validUntil: isoDate.nullable().optional(),
        lines: z
          .array(z.object({ description: z.string().trim().min(1).max(300), quantity: z.number().int().positive().max(100000), unitCents: z.number().int().min(0).max(1_000_000_000) }))
          .min(1)
          .max(100)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const res = await updateQuote(id, patch).catch((e: Error) => fail("BAD_REQUEST", e.message));
      if (!res) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      if (!res.ok) fail(res.code, res.reason);
      await recordAdminEvent({ ctx, reason: `admin.quote.update(${res.quote.publicRef}:${Object.keys(patch).join(",")})` });
      return res.quote;
    }),

  /**
   * B07: the quotation as a branded document: standalone HTML and a PDF (base64). Staff only; nothing is emailed.
   * The total is recomputed from the lines, and no tax is calculated.
   */
  quoteDocument: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const found = await getQuoteWithCustomer(input.id);
    if (!found) fail("NOT_FOUND", "Quotation not found.");
    const doc = buildQuoteDocument(found.quote, found.customer);
    await recordAdminEvent({ ctx, reason: `admin.quote.document(${found.quote.publicRef})` });
    return { ref: doc.ref, filename: `${doc.ref}.pdf`, html: renderQuoteHtml(doc), pdfBase64: (await renderQuotePdf(doc)).toString("base64"), totalCents: doc.totalCents };
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

  /** Outstanding and overdue for Admin; paid totals and recurring revenue for Super Admin only (SRS 13.5, 12.5). */
  financialSummary: adminProcedure.query(async ({ ctx }) => shapeFinancialSummaryForRole(await readFinancialSummary(), ctx.user.role)),

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

  campaignOverview: adminProcedure.query(async () => {
    const o = await readCampaignOverview();
    if (!o) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
    return o;
  }),
  projectLifecycles: adminProcedure.query(() => listProjectLifecycles()),
  projectLifecycleHistory: adminProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ input }) => listProjectLifecycleEvents(input.projectId)),
  setProjectLifecycle: adminProcedure
    .input(z.object({ projectId: z.number().int().positive(), to: z.enum(PROJECT_LIFECYCLE), note: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const res = await setProjectLifecycle({ projectId: input.projectId, to: input.to, actorUserId: ctx.user.id, note: input.note ?? null });
      if (!res) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      if (!res.ok) fail("PRECONDITION_FAILED", res.reason);
      await recordAdminEvent({ ctx, reason: `admin.project.lifecycle(${input.projectId}:${res.from}->${input.to})` });
      const orgId = await getProjectOrganizationId(input.projectId);
      if (orgId) {
        await emitNotification({ event: "PROJECT_DELIVERY_STATE_CHANGED", audience: { type: "client", organizationId: orgId }, dedupeRef: `project:${input.projectId}:${input.to}`, title: `Your project moved to ${input.to.replace(/_/g, " ")}`, href: "/client-portal/projects" });
      }
      // Project automations (SRS 15.16): administrators can attach workflows to these events.
      void fireTrigger("project_stage_changed", { projectId: String(input.projectId), stage: input.to, previous: res.from }, String(input.projectId));
      if (input.to === "completed") void fireTrigger("project_completed", { projectId: String(input.projectId) }, String(input.projectId));
      return { ok: true as const, from: res.from };
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
        // SRS 19.17 registry fields (G02). Optional: a field that is not sent is left unchanged.
        businessFunction: z.string().trim().max(REGISTRY_LIMITS.businessFunction).nullable().optional(),
        capabilities: z.array(z.string().trim()).max(REGISTRY_LIMITS.capabilities).optional(),
        supportedModules: z.array(z.string().trim()).max(REGISTRY_LIMITS.modules).optional(),
        tools: z.array(z.string().trim()).max(REGISTRY_LIMITS.tools).optional(),
        knowledgeSources: z.array(z.string().trim()).max(KNOWLEDGE_SOURCES.length).optional(),
        escalationRules: z.string().trim().max(REGISTRY_LIMITS.escalation).nullable().optional(),
        maxAuthority: z.string().trim().max(24).optional(),
        responsibleAdminUserId: z.number().int().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const check = validateRegistryFields(input);
      if (!check.ok) fail("BAD_REQUEST", check.errors.join(" "));
      const a = await upsertAiAgent({ ...input, purpose: input.purpose ?? null });
      if (a === "invalid_responsible_admin") fail("BAD_REQUEST", "The responsible admin must be an existing admin or super admin.");
      if (!a) fail("INTERNAL_SERVER_ERROR", "Could not save the agent.");
      await recordAdminEvent({ ctx, reason: `admin.ai_agent.upsert(${a.key}:${a.status}:registry v${a.registryVersion})` });
      return a;
    }),

  /**
   * G06: what changed between two saved versions of an agent's prompt, line by line. Local only: no model is
   * called and nothing is sent to a provider.
   */
  comparePromptVersions: adminProcedure
    .input(z.object({ agentKey: z.string().max(64), from: z.number().int().positive(), to: z.number().int().positive() }))
    .query(async ({ input }) => {
      const versions = await listPromptVersions(input.agentKey);
      const a = versions.find((v) => v.version === input.from);
      const b = versions.find((v) => v.version === input.to);
      if (!a || !b) fail("NOT_FOUND", "One of those prompt versions does not exist.");
      const diff = diffPrompts(a.body, b.body);
      return {
        from: { version: a.version, isActive: a.isActive, createdAt: a.createdAt, changeNote: a.changeNote },
        to: { version: b.version, isActive: b.isActive, createdAt: b.createdAt, changeNote: b.changeNote },
        ...diff,
      };
    }),

  /**
   * G06: a prompt with sample values filled in, for checking wording before it is activated. Takes either a saved
   * version or draft text. Local only: nothing is sent to a model, so a preview costs nothing.
   */
  previewPrompt: adminProcedure
    .input(
      z
        .object({
          agentKey: z.string().max(64).optional(),
          version: z.number().int().positive().optional(),
          body: z.string().max(PROMPT_LIMITS.body).optional(),
          samples: z.record(z.string().max(32), z.string().max(PROMPT_LIMITS.sampleValue)).default({}),
        })
        .refine((v) => (v.body !== undefined) !== (v.agentKey !== undefined && v.version !== undefined), { message: "give either draft text, or an agent and a version" }),
    )
    .query(async ({ input }) => {
      let body = input.body;
      if (body === undefined) {
        const v = (await listPromptVersions(input.agentKey!)).find((x) => x.version === input.version);
        if (!v) fail("NOT_FOUND", "That prompt version does not exist.");
        body = v.body;
      }
      return renderPreview(body, input.samples);
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
  incidents: scopedOpsProcedure("incidents")
    .input(z.object({ category: z.enum(["security", "operational"]).optional(), status: z.enum(["open", "investigating", "resolved", "closed"]).optional() }).default({}))
    .query(async ({ input }) => listIncidents(input)),

  createIncident: scopedOpsProcedure("incidents")
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

  updateIncident: scopedOpsProcedure("incidents")
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
      if (input.status === "resolved") {
        const security = r.incident.category === "security";
        await emitNotification({ event: security ? "SECURITY_INCIDENT_RESOLVED" : "GOVERNANCE_INCIDENT_RESOLVED", audience: { type: "admin" }, dedupeRef: `incident:${input.id}:resolved`, title: `Incident resolved: ${r.incident.title}`, href: "/admin/governance" });
      }
      return r.incident;
    }),

  alertRules: scopedOpsProcedure("alerts").query(async () => listAlertRules()),

  updateAlertRule: superAdminProcedure
    .input(z.object({ id: z.number().int().positive(), threshold: z.number().int().min(1).max(100000).optional(), windowMinutes: z.number().int().min(1).max(10080).optional(), enabled: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const r = await updateAlertRule(input);
      if (!r) fail("NOT_FOUND", "Alert rule not found, or nothing to change.");
      await recordAdminEvent({ ctx, reason: `admin.alert_rule.update(${r.key})` });
      return r;
    }),

  /** Run the evaluator now. The same function runs on a timer in production. */
  evaluateAlerts: scopedOpsProcedure("alerts").mutation(async ({ ctx }) => {
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

  platformHealth: scopedOpsProcedure("platform_health").query(async () => readPlatformHealth()),

  // =========================================================================
  // AI Scan expert review (SRS 9.6, 12.8, BR-009, BR-016)
  // =========================================================================
  aiScanReviewQueue: adminProcedure
    .input(z.object({ statuses: z.array(z.enum(REPORT_STATUSES)).min(1).max(9).default(["awaiting_expert_review", "revision_required", "approved"]) }).default({ statuses: ["awaiting_expert_review", "revision_required", "approved"] }))
    .query(async ({ input }) => listAiScansForReview(input.statuses as ReportStatus[])),

  /** What the signed-in staff member may do to a report, so the screen offers only what the API will allow. */
  myReportPermissions: adminProcedure.query(async ({ ctx }) => {
    const grants = await getScopeGrants(ctx.user.id);
    return {
      canReview: authorizeReportAction({ role: ctx.user.role, action: "review", grants }).allowed,
      canPublish: authorizeReportAction({ role: ctx.user.role, action: "publish", grants }).allowed,
    };
  }),

  /** P06: every version of a scan's report, with the approvals, publications and revision requests that applied to each. */
  aiScanVersions: adminProcedure.input(z.object({ scanId: z.number().int().positive() })).query(async ({ input }) => {
    const [versions, events] = await Promise.all([listReportVersions(input.scanId), listAiScanStatusEvents(input.scanId)]);
    return attachDecisions(versions, events).reverse();
  }),

  /** P06: what changed between two versions of a report. Read only. */
  compareAiScanVersions: adminProcedure
    .input(z.object({ scanId: z.number().int().positive(), from: z.number().int().positive(), to: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [a, b] = await Promise.all([getReportVersionPayload(input.scanId, input.from), getReportVersionPayload(input.scanId, input.to)]);
      const from = parseReportPayload(a);
      const to = parseReportPayload(b);
      if (!from || !to) fail("NOT_FOUND", "One of those report versions does not exist or cannot be read.");
      return { from: input.from, to: input.to, ...compareReports(from, to) };
    }),

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
      // P07: review and publish are different rights. The check runs before anything is changed.
      const verdict = authorizeReportAction({ role: ctx.user.role, action: actionFor(input.to), grants: await getScopeGrants(ctx.user.id) });
      if (!verdict.allowed) {
        await recordAdminEvent({ ctx, reason: `admin.ai_scan.${input.to}_refused(${input.scanId}:${verdict.reason})`, outcome: "failed" });
        fail("FORBIDDEN", REPORT_REFUSAL_TEXT[verdict.reason]);
      }
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
          const msg = await resolveEventMessage("AI_SCAN_PUBLISHED", res.scan.locale, { recipientName: res.scan.fullName, link, reference: `SCN-${res.scan.id}` }, {
            subject: "Your IO SKY AI Scan report is ready",
            paragraphs: [`Hello ${res.scan.fullName},`, "Your AI Scan report has been reviewed by our team and is now available."],
          });
          const shell = brandedEmail({ title: msg.subject, paragraphs: msg.paragraphs, cta: { label: "Open your report", url: link } });
          await dispatchSimpleEmail({
            to: res.scan.email,
            subject: msg.subject,
            html: shell.html,
            text: shell.text,
            refHeader: `ai-scan-published:${res.scan.id}`,
            messageType: "notification",
            relatedRef: `ai-scan:${res.scan.id}`,
          });
        } catch (err) {
          console.error("[aiScan] publish email failed:", err);
          await emitNotification({ event: "AI_SCAN_PUBLICATION_FAILED", audience: { type: "admin" }, dedupeRef: `scan:${res.scan.id}:publish-email:${Date.now()}`, title: `Publication email failed for ${label}`, body: "The report is published. The customer email did not send.", href: "/admin/governance" });
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
  compliance: scopedOpsProcedure("compliance").query(async () => {
    // Rules are created on first use; make sure the defaults exist so a fresh install is judged fairly.
    await listAlertRules();
    const checks = evaluateCompliance(await readComplianceInputs());
    return { checks, summary: complianceSummary(checks), generatedAt: Date.now() };
  }),

  /** Twelve months of leads, paid revenue and won deals (SRS 21.10). Paid revenue is withheld from an Admin (SRS 13.5). */
  history: adminProcedure.query(async ({ ctx }) => {
    const rows = await readMonthlyHistory(12);
    const mayRevenue = mayViewCompanyRevenue(ctx.user.role);
    return rows.map((r) => ({ ...r, paidCents: mayRevenue ? r.paidCents : null }));
  }),

  /** CSV export of a fixed dataset (SRS 21.9). Audited, and formula defused like the audit export. */
  exportDataset: adminProcedure.input(z.object({ dataset: z.enum(EXPORT_DATASETS) })).mutation(async ({ ctx, input }) => {
    const { columns, rows } = await readExportDataset(input.dataset);
    await recordAdminEvent({ ctx, reason: `admin.export.${input.dataset}(rows=${rows.length})` });
    return { csv: toCsv(columns, rows), rows: rows.length };
  }),

  deployments: scopedOpsProcedure("deployments").query(async () => listDeployments(20)),

  // =========================================================================
  // Account invitations (SRS 8.7, BR-004): registration is invitation only
  // =========================================================================
  invitations: adminProcedure.query(async () => listInvitations()),

  inviteUser: adminProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email().max(320),
        role: z.enum(INVITABLE_ROLES),
        organizationId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // A regular admin may invite customers and developers; the privileged roles are a super admin's to hand out.
      if (!canInviteRole(ctx.user.role, input.role)) {
        fail("FORBIDDEN", "Only a super admin can invite that role.");
      }
      if (input.role === "client" && !input.organizationId) fail("BAD_REQUEST", "A client invitation needs the organization it belongs to.");
      const res = await createInvitation({ email: input.email, role: input.role, organizationId: input.organizationId ?? null, invitedByUserId: ctx.user.id });
      if (res === "user_exists") fail("CONFLICT", "An account with that email already exists.");
      if (!res) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      const base = process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || "https://iosky.com";
      const link = `${base}/activate?token=${res.token}`;
      // The link is the secret. It goes to the invitee by email and is never returned to the admin
      // or written to a log, so the admin cannot activate the account on their behalf.
      const inviteShell = brandedEmail({
        title: "Your IO SKY invitation",
        paragraphs: [`You have been invited to IO SKY as ${input.role.replace(/_/g, " ")}.`, `This link works once and expires in ${INVITATION_TTL_DAYS} days. If you were not expecting it, ignore this email.`],
        cta: { label: "Activate your account", url: link },
      });
      const sent = await dispatchSimpleEmail({
        to: res.invitation.email,
        subject: "Your IO SKY invitation",
        html: inviteShell.html,
        text: inviteShell.text,
        refHeader: `invitation:${res.invitation.id}`,
        messageType: "notification",
        relatedRef: `invitation:${res.invitation.id}`,
      }).catch(() => ({ ok: false }));
      await recordAdminEvent({ ctx, reason: `admin.invitation.create(${res.invitation.id}:${input.role}:email=${sent.ok ? "sent" : "failed"})` });
      return { id: res.invitation.id, emailSent: sent.ok === true, expiresAt: res.invitation.expiresAt };
    }),

  revokeInvitation: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    if (!(await revokeInvitation(input.id))) fail("NOT_FOUND", "No pending invitation with that id.");
    await recordAdminEvent({ ctx, reason: `admin.invitation.revoke(${input.id})` });
    return { ok: true as const };
  }),
});
