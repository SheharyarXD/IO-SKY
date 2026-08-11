import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  appendClientMessage,
  appendClientNotification,
  appendLoginAudit,
  createClientSupportTicket,
  getClientDocumentById,
  getClientInvoiceById,
  getClientPortalDashboard,
  deleteClientDocumentById,
  getBookingForOrg,
  getClientRecommendationById,
  getClientReportById,
  getOrganizationById,
  insertClientDocument,
  listClientDocuments,
  markIoSkyMessagesRead,
  listClientInvoices,
  listClientMessages,
  listClientNotifications,
  listClientProjectMilestones,
  listClientProjects,
  listClientRecommendations,
  listClientReports,
  listClientSupportTickets,
  listStrategyCallsForOrg,
  listLoginAuditForUser,
  updateBookingStatus,
  updateClientRecommendationStatus,
  updateUserDisplayName,
  updateUserMfaMethod,
} from "../db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { notifyOwner } from "../_core/notification";
import { storageGetSignedUrl, storagePut } from "../storage";
import { clientProcedure, router } from "../_core/trpc";
import { generatePublicRef } from "../_core/publicRef";

const supportTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(8).max(4000),
  category: z.enum(["general", "billing", "technical", "security"]).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

const messageSchema = z.object({
  threadKey: z.string().min(1).max(64).default("general"),
  body: z.string().min(2).max(4000),
  subject: z.string().max(200).nullable().optional(),
});


export const clientPortalRouter = router({
  dashboard: clientProcedure.query(async ({ ctx }) => getClientPortalDashboard(ctx.organizationId)),

  organization: clientProcedure.query(async ({ ctx }) => {
    const org = await getOrganizationById(ctx.organizationId);
    if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
    return org;
  }),

  reports: clientProcedure.query(async ({ ctx }) => {
    const reports = await listClientReports(ctx.organizationId);
    // Surface defensive defaults so the UI can use scanType/delta confidently.
    return reports.map(r => ({
      ...r,
      scanType: (r as any).scanType ?? "ai-scan",
      delta: (r as any).delta ?? 0,
      score: (r as any).score ?? 0,
      pages: (r as any).pages ?? null,
    }));
  }),

  recommendations: clientProcedure.query(async ({ ctx }) =>
    listClientRecommendations(ctx.organizationId),
  ),

  projects: clientProcedure.query(async ({ ctx }) => {
    const projects = await listClientProjects(ctx.organizationId);
    const milestones = await listClientProjectMilestones(projects.map(p => p.id));
    return projects.map(p => ({
      ...p,
      progress: (p as any).progress ?? 0,
      summary: (p as any).summary ?? null,
      targetMs: (p as any).targetMs ?? null,
      milestones: milestones
        .filter(m => m.projectId === p.id)
        .map(m => ({ label: m.title, done: m.status === "completed" })),
    }));
  }),

  invoices: clientProcedure.query(async ({ ctx }) => {
    const list = await listClientInvoices(ctx.organizationId);
    return list.map(i => ({
      ...i,
      issuedMs: (i as any).issuedMs ?? null,
      dueMs: (i as any).dueMs ?? null,
      pdfKey: (i as any).pdfKey ?? null,
    }));
  }),

  documents: clientProcedure.query(async ({ ctx }) => listClientDocuments(ctx.organizationId)),

  messages: clientProcedure.query(async ({ ctx }) => {
    const list = await listClientMessages(ctx.organizationId);
    return list.map(m => ({
      ...m,
      readAt: (m as any).readAt ?? null,
    }));
  }),

  notifications: clientProcedure.query(async ({ ctx }) =>
    listClientNotifications(ctx.organizationId),
  ),

  strategyCalls: clientProcedure.query(async ({ ctx }) =>
    listStrategyCallsForOrg(ctx.organizationId),
  ),

  tickets: clientProcedure.query(async ({ ctx }) => listClientSupportTickets(ctx.organizationId)),

  security: clientProcedure.query(async ({ ctx }) => {
    const recent = await listLoginAuditForUser(ctx.user.id, 25);
    return {
      mfaMethod: (ctx.user as any).mfaMethod ?? null,
      recentLogins: recent.map(r => ({
        id: r.id,
        provider: r.provider,
        outcome: r.outcome,
        reason: r.reason,
        ip: r.ip,
        createdAt: r.createdAt,
      })),
    };
  }),

  /*
   * Mark every IO-SKY-authored message as read for this tenant. Called when
   * the client opens the Messages section so the unread badges in the
   * sidebar / bell drop to zero.
   */
  markMessagesRead: clientProcedure.mutation(async ({ ctx }) => {
    const updated = await markIoSkyMessagesRead(ctx.organizationId);
    return { updated };
  }),

  /*
   * Flip MFA enrolment for the logged-in client. We deliberately keep the
   * surface tiny: only "none" or "email" can be set from the portal — TOTP
   * and SMS will land once we ship a proper challenge endpoint. Every
   * change is audited so the Security Center timeline tells the full story.
   */

  // displayName mutation block below — kept short so the file stays scannable.

  /*
   * Update the logged-in user's display name. The portal does not allow
   * editing e-mail (OAuth identity) or organizationId (tenancy is admin-only).
   * Each change is audited so we can trace social-engineering attempts later.
   */
  updateDisplayName: clientProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await updateUserDisplayName(ctx.user.id, input.name);
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          provider: ctx.user.loginMethod || "unknown",
          outcome: "success",
          reason: `profile-update:name:${input.name.slice(0, 80)}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      return { ok: true, name: input.name };
    }),

  setMfaMethod: clientProcedure
    .input(z.object({ method: z.enum(["none", "email"]) }))
    .mutation(async ({ ctx, input }) => {
      await updateUserMfaMethod(ctx.user.id, input.method);
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          provider: ctx.user.loginMethod || "unknown",
          outcome: "success",
          reason: input.method === "none"
            ? "mfa-disabled"
            : `mfa-enabled:${input.method}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      return { ok: true, method: input.method };
    }),

  /*
   * Revoke the current browser session by clearing the IO SKY session
   * cookie. We always log the revocation as a security event so the
   * Security Center timeline shows it, even when the cookie clear races
   * with concurrent navigation.
   *
   * Note: this signs the user *out of this device* only. A future iteration
   * will support `everywhere: true` once we keep a server-side session
   * registry.
   */
  revokeSession: clientProcedure
    .input(z.object({ everywhere: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const everywhere = input?.everywhere === true;
      try {
        const cookieOptions = getSessionCookieOptions(ctx.req as any);
        // Express's res.clearCookie expects the cookie definition; we set
        // maxAge to -1 so the browser drops it immediately.
        (ctx.res as any).clearCookie(COOKIE_NAME, {
          ...cookieOptions,
          maxAge: -1,
        });
      } catch {
        /* clearing is best-effort — the audit row is the source of truth */
      }
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          provider: ctx.user.loginMethod || "unknown",
          outcome: "success",
          reason: everywhere
            ? "session-revoke:everywhere"
            : "session-revoke:current",
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      return { ok: true, everywhere } as const;
    }),

  sendMessage: clientProcedure
    .input(messageSchema)
    .mutation(async ({ ctx, input }) => {
      await appendClientMessage({
        organizationId: ctx.organizationId,
        threadKey: input.threadKey,
        sender: "client",
        senderName: ctx.user.name ?? ctx.user.email ?? "Client",
        subject: input.subject ?? null,
        body: input.body,
      });
      await appendClientNotification({
        organizationId: ctx.organizationId,
        kind: "message",
        title: "Message sent to IO SKY",
        body: input.subject ?? input.body.slice(0, 120),
        href: "/client-portal/messages",
      });
      try {
        await notifyOwner({
          title: "Client message",
          content: `${ctx.user.name ?? ctx.user.email}: ${input.body.slice(0, 240)}`,
        });
      } catch {
        /* notification is best-effort */
      }
      return { ok: true };
    }),

  requestReportSignedUrl: clientProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const report = await getClientReportById(ctx.organizationId, input.id);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      if (!report.pdfKey) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This report has no downloadable PDF yet" });
      }
      let url: string;
      try {
        url = await storageGetSignedUrl(report.pdfKey);
      } catch {
        url = `/manus-storage/${report.pdfKey}`;
      }
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          identifier: ctx.user.email ?? null,
          provider: "client-portal",
          outcome: "success",
          reason: `report-download:${report.publicRef}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      try {
        await notifyOwner({
          title: `Client downloaded report ${report.publicRef}`,
          content: `${ctx.user.name ?? ctx.user.email} downloaded \"${report.title}\".`,
        });
      } catch {
        /* notify best-effort */
      }
      return { url, expiresInSec: 600, publicRef: report.publicRef };
    }),

  requestInvoiceSignedUrl: clientProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await getClientInvoiceById(ctx.organizationId, input.id);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      if (!invoice.pdfKey) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This invoice has no downloadable PDF yet" });
      }
      let url: string;
      try {
        url = await storageGetSignedUrl(invoice.pdfKey);
      } catch {
        url = `/manus-storage/${invoice.pdfKey}`;
      }
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          identifier: ctx.user.email ?? null,
          provider: "client-portal",
          outcome: "success",
          reason: `invoice-download:${invoice.number}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      return { url, expiresInSec: 600, number: invoice.number };
    }),

  /*
   * Pay Now — scaffolded checkout intent.
   *
   * Stripe is not yet enabled on this project (see webdev_add_feature
   * stripe). Until it is, we still need a real, audited entry point so the
   * UI can show “Pay Now”, log the intent, alert the IO SKY team and tell
   * the user how the funds will reach us. The procedure:
   *   • confirms tenant ownership of the invoice
   *   • rejects already-paid / void invoices
   *   • audits via login_audit
   *   • writes a client_notification
   *   • notifies the owner
   *   • returns { mode: "manual", instructionsUrl } so the client can be
   *     redirected to a manual payment instructions screen until Stripe is
   *     wired in.
   */
  requestInvoiceCheckout: clientProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await getClientInvoiceById(ctx.organizationId, input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.status === "paid" || invoice.status === "void") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This invoice is already ${invoice.status}.`,
        });
      }
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          identifier: ctx.user.email ?? null,
          provider: "client-portal",
          outcome: "success",
          reason: `invoice-pay-intent:${invoice.number}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      try {
        await appendClientNotification({
          organizationId: ctx.organizationId,
          kind: "billing",
          title: `Payment started for ${invoice.number}`,
          body: `${ctx.user.name ?? ctx.user.email} initiated payment for ${invoice.number}.`,
          href: "/client-portal/billing",
        });
      } catch {
        /* best-effort */
      }
      try {
        await notifyOwner({
          title: `Client started payment for ${invoice.number}`,
          content: `Initiated by ${ctx.user.name ?? ctx.user.email}\nInvoice: ${
            invoice.number
          }\nAmount: ${(invoice.amountCents / 100).toFixed(2)} ${invoice.currency}`,
        });
      } catch {
        /* best-effort */
      }
      return {
        mode: "manual" as const,
        instructionsUrl: `/client-portal/billing?pay=${encodeURIComponent(invoice.number)}`,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          amountCents: invoice.amountCents,
          currency: invoice.currency,
        },
      };
    }),

  requestDocumentSignedUrl: clientProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getClientDocumentById(ctx.organizationId, input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      let url: string;
      try {
        url = await storageGetSignedUrl(doc.fileKey);
      } catch {
        url = `/manus-storage/${doc.fileKey}`;
      }
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          identifier: ctx.user.email ?? null,
          provider: "client-portal",
          outcome: "success",
          reason: `document-download:${doc.id}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      return { url, expiresInSec: 600, name: doc.name };
    }),

  /*
   * Upload a document into the client's vault.
   *
   * The client sends the file as a base64 string (small enough — we cap at
   * 15 MB) plus its name / mime / size. We:
   *   1. validate size + extension (no .exe / .bat / .sh);
   *   2. write the bytes to S3 via storagePut under a per-org prefix;
   *   3. record the metadata in client_documents;
   *   4. audit + write a client_notification + notifyOwner so the IO SKY
   *      team sees the upload immediately.
   */
  uploadDocument: clientProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        category: z
          .enum(["general", "contract", "deliverable", "design", "data"])
          .default("general"),
        mimeType: z.string().max(96).optional(),
        // base64-encoded payload; ~15 MB ceiling translates to ~20 MB string.
        contentBase64: z.string().min(8).max(20_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Reject obviously dangerous extensions even if the mime says otherwise.
      const lower = input.name.toLowerCase();
      const blocked = [".exe", ".bat", ".cmd", ".sh", ".js", ".msi"];
      if (blocked.some(ext => lower.endsWith(ext))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This file type is not allowed in the client vault.",
        });
      }
      let buffer: Buffer;
      try {
        buffer = Buffer.from(input.contentBase64, "base64");
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not decode the uploaded file.",
        });
      }
      const sizeBytes = buffer.byteLength;
      const FIFTEEN_MB = 15 * 1024 * 1024;
      if (sizeBytes === 0 || sizeBytes > FIFTEEN_MB) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File must be between 1 byte and 15 MB.",
        });
      }
      // Slug the filename so the S3 key stays predictable.
      const safeName = input.name
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 120);
      const key = `client-portal/${ctx.organizationId}/${Date.now()}-${safeName}`;
      let putKey = key;
      try {
        const out = await storagePut(
          key,
          buffer,
          input.mimeType ?? "application/octet-stream",
        );
        putKey = out.key ?? key;
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn’t persist the file. Please try again.",
          cause: err,
        });
      }
      const inserted = await insertClientDocument({
        organizationId: ctx.organizationId,
        name: input.name,
        category: input.category,
        fileKey: putKey,
        sizeBytes,
        mimeType: input.mimeType ?? null,
        uploadedByUserId: ctx.user.id ?? null,
        uploadedBy: ctx.user.name ?? ctx.user.email ?? null,
      });
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          identifier: ctx.user.email ?? null,
          provider: "client-portal",
          outcome: "success",
          reason: `document-upload:${inserted?.id ?? "unknown"}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      try {
        await appendClientNotification({
          organizationId: ctx.organizationId,
          kind: "document",
          title: `New document uploaded — ${input.name}`,
          body: `${ctx.user.name ?? ctx.user.email} added a ${input.category} file.`,
          href: "/client-portal/documents",
        });
      } catch {
        /* best-effort */
      }
      try {
        await notifyOwner({
          title: `Client uploaded ${input.name}`,
          content: `Org #${ctx.organizationId} — ${ctx.user.name ?? ctx.user.email}\nCategory: ${input.category}\nSize: ${sizeBytes} bytes`,
        });
      } catch {
        /* best-effort */
      }
      return {
        id: inserted?.id ?? null,
        fileKey: putKey,
        sizeBytes,
      };
    }),

  /*
   * Self-serve delete for documents the client uploaded themselves. We
   * deliberately scope to uploadedByUserId === ctx.user.id so the client
   * cannot wipe IO-SKY-issued contracts — those go through support.
   */
  requestDocumentDeletion: clientProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getClientDocumentById(ctx.organizationId, input.id);
      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }
      if (doc.uploadedByUserId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only documents you uploaded can be removed here. Reach out via Support to delete IO-SKY-issued files.",
        });
      }
      await deleteClientDocumentById(ctx.organizationId, doc.id);
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          identifier: ctx.user.email ?? null,
          provider: "client-portal",
          outcome: "success",
          reason: `document-delete:${doc.id}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      try {
        await appendClientNotification({
          organizationId: ctx.organizationId,
          kind: "document",
          title: `Document removed — ${doc.name}`,
          body: `${ctx.user.name ?? ctx.user.email} removed a file from the vault.`,
          href: "/client-portal/documents",
        });
      } catch {
        /* best-effort */
      }
      return { id: doc.id, removed: true as const };
    }),

  cancelStrategyCall: clientProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingForOrg(ctx.organizationId, input.id);
      if (!booking) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      }
      if (booking.status === "cancelled" || booking.status === "completed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This call cannot be cancelled in its current state.",
        });
      }
      // Block cancellations < 60 minutes before the slot — client should
      // call the operating partner directly past that gate.
      const minutesUntil = (booking.slotStartMs - Date.now()) / 60_000;
      if (minutesUntil < 60) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Calls within 60 minutes can’t be self-cancelled. Message your operating partner directly.",
        });
      }
      await updateBookingStatus(booking.id, "cancelled");
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          identifier: ctx.user.email ?? null,
          provider: "client-portal",
          outcome: "success",
          reason: `booking-cancel:${booking.publicRef}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      try {
        await appendClientNotification({
          organizationId: ctx.organizationId,
          kind: "strategy-call",
          title: `Discovery call cancelled — ${booking.publicRef}`,
          body: input.reason ?? null,
          href: "/client-portal/strategy-calls",
        });
      } catch {
        /* best-effort */
      }
      try {
        await notifyOwner({
          title: `Client cancelled discovery call ${booking.publicRef}`,
          content: `Cancelled by ${ctx.user.name ?? ctx.user.email}\nSlot: ${new Date(
            booking.slotStartMs,
          ).toUTCString()}\nReason: ${input.reason ?? "(none provided)"}`,
        });
      } catch {
        /* best-effort */
      }
      return { id: booking.id, publicRef: booking.publicRef, status: "cancelled" as const };
    }),

  recommendationAction: clientProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        kind: z.enum(["discuss", "proposal", "implement", "dismiss"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rec = await getClientRecommendationById(ctx.organizationId, input.id);
      if (!rec) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recommendation not found" });
      }
      // Status transitions: discuss is non-mutating (a UX redirect to /book-strategy);
      // proposal/implement move the rec to in_progress so the project pipeline can pick
      // it up; dismiss closes it on the client's side.
      let nextStatus: "pending" | "in_progress" | "completed" | "dismissed" | null = null;
      if (input.kind === "proposal" || input.kind === "implement") nextStatus = "in_progress";
      if (input.kind === "dismiss") nextStatus = "dismissed";
      if (nextStatus && nextStatus !== rec.status) {
        await updateClientRecommendationStatus(ctx.organizationId, rec.id, nextStatus);
      }
      try {
        await appendLoginAudit({
          userId: ctx.user.id,
          identifier: ctx.user.email ?? null,
          provider: "client-portal",
          outcome: "success",
          reason: `rec-action:${input.kind}:${rec.id}`,
          ip: null,
          userAgent: null,
        });
      } catch {
        /* audit best-effort */
      }
      // Surface the action inside the client's own notification feed too so the
      // activity stream reflects it immediately without a page refresh.
      try {
        const titleByKind: Record<typeof input.kind, string> = {
          discuss: `Discussion requested — ${rec.title}`,
          proposal: `Proposal requested — ${rec.title}`,
          implement: `Implementation kicked off — ${rec.title}`,
          dismiss: `Recommendation dismissed — ${rec.title}`,
        };
        await appendClientNotification({
          organizationId: ctx.organizationId,
          kind: "recommendation",
          title: titleByKind[input.kind],
          body: rec.body?.slice(0, 200) ?? null,
          href: "/client-portal/recommendations",
        });
      } catch {
        /* best-effort */
      }
      if (input.kind === "proposal" || input.kind === "implement") {
        try {
          await notifyOwner({
            title:
              input.kind === "proposal"
                ? `Client requested a proposal — ${rec.title}`
                : `Client kicking off implementation — ${rec.title}`,
            content: `Requested by ${ctx.user.name ?? ctx.user.email}\n\nCategory: ${rec.category}\nImpact: ${rec.impact}\n\n${rec.body ?? "(no body)"}`,
          });
        } catch {
          /* notification is best-effort */
        }
      }
      return {
        id: rec.id,
        status: nextStatus ?? rec.status,
        kind: input.kind,
      };
    }),

  createTicket: clientProcedure
    .input(supportTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const publicRef = generatePublicRef("T");
      await createClientSupportTicket({
        organizationId: ctx.organizationId,
        openedByUserId: ctx.user.id,
        publicRef,
        subject: input.subject,
        body: input.body,
        category: input.category,
        priority: input.priority,
      });
      await appendClientNotification({
        organizationId: ctx.organizationId,
        kind: "support",
        title: `Support ticket opened — ${publicRef}`,
        body: input.subject,
        href: "/client-portal/support",
      });
      try {
        await notifyOwner({
          title: `New support ticket ${publicRef} (${input.priority})`,
          content: `${input.subject}\n\nCategory: ${input.category}\nPriority: ${input.priority}\n\n${input.body}`,
        });
      } catch {
        /* notification is best-effort */
      }
      return { publicRef };
    }),
});

export type ClientPortalRouter = typeof clientPortalRouter;
