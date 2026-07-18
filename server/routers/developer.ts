import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { notifyOwner } from "../_core/notification";
import {
  developerProcedure,
  developerSelfProcedure,
  protectedProcedure,
  router,
} from "../_core/trpc";
import {
  REQUIRED_DEVELOPER_AGREEMENTS,
  appendDeveloperAudit,
  appendDeveloperMessage,
  appendDeveloperNotification,
  appendDeveloperSecurityEvent,
  createDeveloperAccessRequest,
  createDeveloperSubmission,
  createDeveloperSupportTicket,
  evaluateDeveloperGate,
  getApprovedFileForDeveloper,
  getAssignedDeveloperProject,
  getDeveloperProfileByUserId,
  listAssignedDeveloperProjects,
  listDeveloperAuditEventsForSelf,
  listDeveloperFiles,
  listDeveloperMessages,
  listDeveloperNotifications,
  listDeveloperSubmissions,
  listDeveloperTasks,
  listSignedAgreementsForDeveloper,
  markAdminMessagesReadForDeveloper,
  signDeveloperAgreement,
  updateDeveloperProfile,
  updateDeveloperTaskStatus,
  updateUserMfaMethod,
} from "../db";
import { storageGet } from "../storage";

/**
 * Helper — pull the caller's IP and user-agent out of the express ctx so
 * we can stamp them onto audit rows uniformly.
 */
function callerMeta(req: any) {
  const ip =
    (req?.headers?.["x-forwarded-for"] as string | undefined)
      ?.split(",")[0]
      ?.trim() ||
    (req?.socket?.remoteAddress as string | undefined) ||
    null;
  const userAgent =
    (req?.headers?.["user-agent"] as string | undefined) ?? null;
  return { ip, userAgent };
}

/**
 * Generate a stable public reference for support tickets.
 * Format: ENG-XXXXXXXX (8 random uppercase alphanumerics).
 */
function makePublicRef(prefix: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${suffix}`;
}

export const developerRouter = router({
  /**
   * Gate status — public to any *authenticated* user. The Overview page
   * uses this to render the calm "Setup MFA / Sign Agreements / Access
   * Expired / No Assignments" cards instead of letting `developerProcedure`
   * raise a 403. Anyone whose role !== "developer" gets a hard "denied".
   */
  gateStatus: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "developer" && ctx.user.role !== "admin") {
      return {
        ok: false as const,
        reason: "denied" as const,
        signedTypes: [] as string[],
        requiredAgreements: REQUIRED_DEVELOPER_AGREEMENTS,
        scope: null,
        assignmentCount: 0,
      };
    }
    const result = await evaluateDeveloperGate({
      userId: ctx.user.id,
      mfaMethod: ctx.user.mfaMethod ?? "none",
    });
    return {
      ok: result.gate.ok,
      reason: result.gate.ok ? null : result.gate.reason,
      missingAgreements:
        result.gate.ok || result.gate.reason !== "agreements_required"
          ? []
          : result.gate.missing,
      signedTypes: result.signedTypes,
      requiredAgreements: REQUIRED_DEVELOPER_AGREEMENTS,
      scope: result.scope,
      assignmentCount: result.assignments.length,
      profile: result.profile
        ? {
            id: result.profile.id,
            fullName: result.profile.fullName,
            availability: result.profile.availability,
            status: result.profile.status,
          }
        : null,
    };
  }),

  // -----------------------------------------------------------------
  // Overview — KPI counts, latest messages, recent activity, status
  // -----------------------------------------------------------------
  dashboard: developerProcedure.query(async ({ ctx }) => {
    const [projects, tasks, submissions, messages, signedAgreements, notifications] =
      await Promise.all([
        listAssignedDeveloperProjects(ctx.developer.id),
        listDeveloperTasks(ctx.developer.id),
        listDeveloperSubmissions(ctx.developer.id),
        listDeveloperMessages(ctx.developer.id),
        listSignedAgreementsForDeveloper(ctx.developer.id),
        listDeveloperNotifications(ctx.developer.id, 10),
      ]);

    const myTasks = tasks.filter((t) => t.mine);
    const activeTasks = myTasks.filter((t) =>
      ["planned", "in_progress", "blocked", "in_review"].includes(t.status),
    );
    const inboundMessages = messages.filter((m) => m.sender === "admin");
    const unreadInbound = inboundMessages.filter((m) => !m.readAt).length;
    const recentSubmissions = submissions.slice(0, 5);
    const latestMessages = inboundMessages.slice(-5).reverse();

    return {
      profile: ctx.developer.profile,
      scope: ctx.developer.scope,
      assignedProjectCount: projects.length,
      activeTaskCount: activeTasks.length,
      pendingSubmissionCount: submissions.filter((s) => s.status === "pending").length,
      unreadMessageCount: unreadInbound,
      signedAgreementCount: signedAgreements.length,
      requiredAgreementCount: REQUIRED_DEVELOPER_AGREEMENTS.length,
      latestMessages,
      recentSubmissions,
      notifications,
    };
  }),

  // -----------------------------------------------------------------
  // Projects
  // -----------------------------------------------------------------
  listProjects: developerProcedure.query(async ({ ctx }) => {
    return listAssignedDeveloperProjects(ctx.developer.id);
  }),

  getProject: developerProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await getAssignedDeveloperProject({
        developerId: ctx.developer.id,
        projectId: input.projectId,
      });
      if (!project) {
        await appendDeveloperSecurityEvent({
          developerId: ctx.developer.id,
          kind: "unauthorized_route",
          severity: "warn",
          message: "Attempt to read unassigned project",
          detail: `projectId=${input.projectId}`,
          ...callerMeta(ctx.req),
        });
        throw new TRPCError({ code: "FORBIDDEN", message: "project_not_assigned" });
      }
      return project;
    }),

  // -----------------------------------------------------------------
  // Tasks
  // -----------------------------------------------------------------
  listTasks: developerProcedure.query(async ({ ctx }) => {
    return listDeveloperTasks(ctx.developer.id);
  }),

  setTaskStatus: developerProcedure
    .input(
      z.object({
        taskId: z.number().int().positive(),
        status: z.enum(["planned", "in_progress", "blocked", "in_review", "done"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const after = await updateDeveloperTaskStatus({
        developerId: ctx.developer.id,
        taskId: input.taskId,
        status: input.status,
      });
      if (!after) {
        await appendDeveloperSecurityEvent({
          developerId: ctx.developer.id,
          kind: "unauthorized_route",
          severity: "warn",
          message: "Attempt to update unassigned task",
          detail: `taskId=${input.taskId}`,
          ...callerMeta(ctx.req),
        });
        throw new TRPCError({ code: "FORBIDDEN", message: "task_not_assigned" });
      }
      const meta = callerMeta(ctx.req);
      await appendDeveloperAudit({
        developerId: ctx.developer.id,
        event: "task.status_changed",
        detail: `taskId=${input.taskId} status=${input.status}`,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      await notifyOwner({
        title: "Developer task status changed",
        content: `${ctx.developer.profile.fullName} marked task #${input.taskId} as ${input.status}.`,
      });
      return after;
    }),

  // -----------------------------------------------------------------
  // Files (approved files only, via signed URLs)
  // -----------------------------------------------------------------
  listFiles: developerProcedure.query(async ({ ctx }) => {
    return listDeveloperFiles(ctx.developer.id);
  }),

  requestFileSignedUrl: developerProcedure
    .input(z.object({ fileId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const file = await getApprovedFileForDeveloper({
        developerId: ctx.developer.id,
        fileId: input.fileId,
      });
      if (!file) {
        await appendDeveloperSecurityEvent({
          developerId: ctx.developer.id,
          kind: "unauthorized_route",
          severity: "high",
          message: "Attempt to download unassigned/unapproved file",
          detail: `fileId=${input.fileId}`,
          ...callerMeta(ctx.req),
        });
        throw new TRPCError({ code: "FORBIDDEN", message: "file_not_accessible" });
      }
      const { url } = await storageGet(file.fileKey);
      const meta = callerMeta(ctx.req);
      await appendDeveloperAudit({
        developerId: ctx.developer.id,
        event: "file.downloaded",
        detail: `fileId=${file.id} key=${file.fileKey}`,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return { url, name: file.name, mimeType: file.mimeType };
    }),

  // -----------------------------------------------------------------
  // Submissions / commits
  // -----------------------------------------------------------------
  listSubmissions: developerProcedure.query(async ({ ctx }) => {
    return listDeveloperSubmissions(ctx.developer.id);
  }),

  createSubmission: developerProcedure
    .input(
      z
        .object({
          projectId: z.number().int().positive(),
          kind: z.enum(["submission", "commit"]),
          title: z.string().trim().min(3).max(200),
          body: z.string().trim().max(5000).optional(),
          fileKey: z.string().max(512).optional(),
          repository: z.string().trim().max(320).optional(),
          sha: z.string().trim().max(64).optional(),
          branch: z.string().trim().max(200).optional(),
        })
        .superRefine((val, ctx) => {
          if (val.kind === "commit") {
            if (!val.repository || !val.sha) {
              ctx.addIssue({
                code: "custom",
                path: ["repository"],
                message: "Repository and sha are required for commit submissions",
              });
            }
          }
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getAssignedDeveloperProject({
        developerId: ctx.developer.id,
        projectId: input.projectId,
      });
      if (!project) {
        await appendDeveloperSecurityEvent({
          developerId: ctx.developer.id,
          kind: "unauthorized_route",
          severity: "warn",
          message: "Attempt to submit work for unassigned project",
          detail: `projectId=${input.projectId}`,
          ...callerMeta(ctx.req),
        });
        throw new TRPCError({ code: "FORBIDDEN", message: "project_not_assigned" });
      }
      const inserted = await createDeveloperSubmission({
        developerId: ctx.developer.id,
        projectId: input.projectId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        fileKey: input.fileKey ?? null,
        repository: input.repository ?? null,
        sha: input.sha ?? null,
        branch: input.branch ?? null,
      });
      const meta = callerMeta(ctx.req);
      await appendDeveloperAudit({
        developerId: ctx.developer.id,
        event: input.kind === "commit" ? "commit.recorded" : "submission.created",
        detail: `projectId=${input.projectId} title="${input.title}"`,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      await appendDeveloperNotification({
        developerId: ctx.developer.id,
        kind: "review",
        title:
          input.kind === "commit"
            ? "Commit recorded — admin notified"
            : "Submission created — awaiting review",
        body: input.title,
        href: "/developer-workspace/submissions",
      });
      await notifyOwner({
        title:
          input.kind === "commit"
            ? "Developer commit reported"
            : "Developer submission ready for review",
        content: `${ctx.developer.profile.fullName} on ${project.code}: ${input.title}`,
      });
      return inserted;
    }),

  // -----------------------------------------------------------------
  // Messages — admin <-> developer ONLY
  // -----------------------------------------------------------------
  listMessages: developerProcedure.query(async ({ ctx }) => {
    return listDeveloperMessages(ctx.developer.id);
  }),

  sendMessage: developerProcedure
    .input(
      z.object({
        subject: z.string().trim().max(200).optional(),
        body: z.string().trim().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const inserted = await appendDeveloperMessage({
        developerId: ctx.developer.id,
        senderName: ctx.developer.profile.fullName,
        subject: input.subject ?? null,
        body: input.body,
      });
      const meta = callerMeta(ctx.req);
      await appendDeveloperAudit({
        developerId: ctx.developer.id,
        event: "message.sent",
        detail: input.subject ?? "(no subject)",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      await notifyOwner({
        title: "Developer sent a message",
        content: `${ctx.developer.profile.fullName}: ${input.subject ?? input.body.slice(0, 80)}`,
      });
      return inserted;
    }),

  markMessagesRead: developerProcedure.mutation(async ({ ctx }) => {
    const updated = await markAdminMessagesReadForDeveloper(ctx.developer.id);
    return { updated };
  }),

  // -----------------------------------------------------------------
  // Agreements
  // -----------------------------------------------------------------
  listAgreements: developerProcedure.query(async ({ ctx }) => {
    const signed = await listSignedAgreementsForDeveloper(ctx.developer.id);
    const signedTypes = new Set(signed.map((row) => row.agreementType));
    return REQUIRED_DEVELOPER_AGREEMENTS.map((req) => ({
      ...req,
      signed: signedTypes.has(req.type),
      signedAtMs:
        signed.find((row) => row.agreementType === req.type)?.signedMs ?? null,
    }));
  }),

  /**
   * Sign agreement is intentionally `protectedProcedure` so a developer
   * who has *not yet* signed (and therefore can't pass developerProcedure)
   * can still record their signatures. We re-derive the developer profile
   * from the user id manually here.
   */
  signAgreement: protectedProcedure
    .input(
      z.object({
        agreementType: z.enum([
          "nda",
          "confidentiality",
          "non-solicitation",
          "liability",
          "security-policy",
        ]),
        version: z.string().min(1).max(32),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "developer" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "developer_only" });
      }
      const result = await evaluateDeveloperGate({
        userId: ctx.user.id,
        mfaMethod: ctx.user.mfaMethod ?? "none",
      });
      if (!result.profile) {
        throw new TRPCError({ code: "FORBIDDEN", message: "developer_gate:no_profile" });
      }
      const meta = callerMeta(ctx.req);
      const row = await signDeveloperAgreement({
        developerId: result.profile.id,
        agreementType: input.agreementType,
        version: input.version,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      await appendDeveloperAudit({
        developerId: result.profile.id,
        event: "agreement.signed",
        detail: `${input.agreementType}@${input.version}`,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      await notifyOwner({
        title: "Developer signed agreement",
        content: `${result.profile.fullName} signed ${input.agreementType} (${input.version}).`,
      });
      return row;
    }),

  // -----------------------------------------------------------------
  // Access (extension request)
  // -----------------------------------------------------------------
  requestAccessExtension: developerProcedure
    .input(z.object({ reason: z.string().trim().min(8).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await createDeveloperAccessRequest({
        developerId: ctx.developer.id,
        scopeId: ctx.developer.scope?.id ?? null,
        reason: input.reason,
      });
      const meta = callerMeta(ctx.req);
      await appendDeveloperAudit({
        developerId: ctx.developer.id,
        event: "access.extension_requested",
        detail: input.reason.slice(0, 200),
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      await notifyOwner({
        title: "Developer requested access extension",
        content: `${ctx.developer.profile.fullName}: ${input.reason.slice(0, 200)}`,
      });
      return { ok: true } as const;
    }),

  // -----------------------------------------------------------------
  // Support
  // -----------------------------------------------------------------
  createSupportTicket: developerProcedure
    .input(
      z.object({
        subject: z.string().trim().min(3).max(200),
        body: z.string().trim().min(8).max(5000),
        category: z
          .enum(["technical", "access", "agreements", "billing", "general"])
          .default("general"),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await createDeveloperSupportTicket({
        developerId: ctx.developer.id,
        publicRef: makePublicRef("ENG"),
        subject: input.subject,
        body: input.body,
        category: input.category,
        priority: input.priority,
      });
      const meta = callerMeta(ctx.req);
      await appendDeveloperAudit({
        developerId: ctx.developer.id,
        event: "support.ticket_opened",
        detail: `${input.category}/${input.priority} subject="${input.subject}"`,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      await notifyOwner({
        title: `Developer support ticket (${input.priority})`,
        content: `${ctx.developer.profile.fullName}: ${input.subject}`,
      });
      return ticket;
    }),

  // -----------------------------------------------------------------
  // Notifications
  // -----------------------------------------------------------------
  listNotifications: developerProcedure.query(async ({ ctx }) => {
    return listDeveloperNotifications(ctx.developer.id, 50);
  }),

  // -----------------------------------------------------------------
  // Step 2 — Editable profile + security
  // -----------------------------------------------------------------

  /**
   * Update the calling developer's own profile fields. The admin-owned
   * columns (status, mfaRequired, approvedMs, …) cannot be modified.
   * Availability changes also raise an admin notification because they
   * affect assignment planning.
   */
  updateProfile: developerSelfProcedure
    .input(
      z.object({
        fullName: z.string().trim().min(2).max(200).optional(),
        country: z.string().trim().max(64).nullable().optional(),
        linkedin: z.string().trim().max(320).nullable().optional(),
        github: z.string().trim().max(320).nullable().optional(),
        portfolio: z.string().trim().max(320).nullable().optional(),
        specialties: z.string().trim().max(320).nullable().optional(),
        availability: z
          .enum(["available", "limited", "unavailable"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const previousAvailability = ctx.developer.profile.availability;
      const updated = await updateDeveloperProfile(
        ctx.developer.id,
        input,
      );
      const meta = callerMeta(ctx.req);
      await appendDeveloperAudit({
        developerId: ctx.developer.id,
        event: "profile.update",
        detail: JSON.stringify({
          actorUserId: ctx.user.id,
          fields: Object.keys(input),
        }),
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      if (
        input.availability &&
        input.availability !== previousAvailability
      ) {
        await notifyOwner({
          title: `Developer availability changed (${input.availability})`,
          content: `${ctx.developer.profile.fullName}: ${previousAvailability} → ${input.availability}`,
        });
      }
      return updated;
    }),

  /**
   * Toggle the developer's email-MFA factor ("lite" — full TOTP/SMS
   * lives in the next track). Off is only allowed when the admin has
   * not flagged mfaRequired; otherwise the call is rejected with a
   * security event row so the admin sees the attempt.
   */
  setMfaMethodLite: developerSelfProcedure
    .input(z.object({ method: z.enum(["none", "email"]) }))
    .mutation(async ({ ctx, input }) => {
      const meta = callerMeta(ctx.req);
      if (
        input.method === "none" &&
        ctx.developer.profile.mfaRequired === 1
      ) {
        await appendDeveloperSecurityEvent({
          developerId: ctx.developer.id,
          kind: "mfa.disable_denied",
          severity: "warn",
          message: "Developer attempted to disable MFA while mfaRequired=1",
          detail: JSON.stringify({
            requested: input.method,
            reason: "mfa_required",
          }),
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "MFA is required for this account",
        });
      }
      await updateUserMfaMethod(ctx.user.id, input.method);
      await appendDeveloperAudit({
        developerId: ctx.developer.id,
        event: "security.mfa_method.update",
        detail: JSON.stringify({
          actorUserId: ctx.user.id,
          method: input.method,
        }),
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      if (input.method === "none") {
        await notifyOwner({
          title: "Developer disabled MFA",
          content: `${ctx.developer.profile.fullName} switched MFA to none`,
        });
      }
      return { ok: true as const, method: input.method };
    }),

  /**
   * Return the last N audit rows for the calling developer.
   * Defaults to 50, capped at 200.
   */
  listAuditEvents: developerSelfProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(200).optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      return listDeveloperAuditEventsForSelf(ctx.developer.id, limit);
    }),

  /**
   * Full developer profile row for the editable Profile UI.
   * `gateStatus.profile` only returns a slim summary, so the editor
   * needs this richer payload (country, linkedin, github, portfolio,
   * specialties, …).
   */
  getProfileForEdit: developerSelfProcedure.query(async ({ ctx }) => {
    return getDeveloperProfileByUserId(ctx.user.id);
  }),
});

export type DeveloperRouter = typeof developerRouter;
