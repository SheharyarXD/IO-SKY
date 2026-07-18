/**
 * IO SKY — Engineering Access router.
 *
 * Public:
 *   - engineering.submit — submit an NDA-gated developer application.
 * Admin:
 *   - engineering.listRecent — last 100 applications, ordered by creation desc.
 *   - engineering.setStatus — admin-only review action.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createDevApplication,
  createLead,
  listRecentDevApplications,
  markDevAppOwnerNotified,
  updateDevAppStatus,
} from "../db";
import { sendDevApplicationAck } from "../email";
import { notifyOwner } from "../_core/notification";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";

const submissionsByIp = new Map<string, number[]>();
const SUBMISSION_WINDOW_MS = 60_000;
const SUBMISSION_LIMIT_PER_MIN = 3;

function isRateLimited(ip: string | null): boolean {
  if (!ip) return false;
  const now = Date.now();
  const recent = (submissionsByIp.get(ip) || []).filter(
    (t) => now - t < SUBMISSION_WINDOW_MS,
  );
  recent.push(now);
  submissionsByIp.set(ip, recent);
  return recent.length > SUBMISSION_LIMIT_PER_MIN;
}

function generatePublicRef(): string {
  const block = () =>
    Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()
      .replace(/[0OIL1]/g, "X");
  return `IOSKY-DEV-${block()}-${block()}`;
}

const applyInputSchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(64).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  roleTitle: z.string().max(120).optional().nullable(),
  yearsExperience: z.number().int().min(0).max(60).optional().nullable(),

  links: z.string().max(2000).optional().nullable(),
  message: z.string().max(4000).optional().nullable(),

  ackNda: z.boolean(),
  ackConfidentiality: z.boolean(),
  ackNonSolicitation: z.boolean(),

  /** Honeypot — must be empty. */
  website: z.string().max(0).optional().nullable(),
  /** Recipient UI locale for the localised confirmation email (e.g. "NL"). */
  locale: z.string().max(16).optional().nullable(),
});

export const engineeringRouter = router({
  submit: publicProcedure
    .input(applyInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Honeypot — silently succeed-shape so bots can't probe.
      if (input.website && input.website.length > 0) {
        return {
          success: true as const,
          publicRef: "IOSKY-DEV-XXXX-XXXX",
          emailTransport: "console" as const,
        };
      }

      // All three acknowledgements are required.
      if (
        !input.ackNda ||
        !input.ackConfidentiality ||
        !input.ackNonSolicitation
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "All three acknowledgements (NDA, Confidentiality, Non-solicitation) are required.",
        });
      }

      const ip =
        (ctx.req?.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() ||
        ctx.req?.socket?.remoteAddress ||
        null;
      const userAgent = (ctx.req?.headers["user-agent"] as string) || null;

      if (isRateLimited(ip)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many applications. Please try again shortly.",
        });
      }

      const publicRef = generatePublicRef();
      const application = await createDevApplication({
        publicRef,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        company: input.company?.trim() || null,
        roleTitle: input.roleTitle?.trim() || null,
        yearsExperience: input.yearsExperience ?? null,
        links: input.links?.trim() || null,
        message: input.message?.trim() || null,
        ackNda: 1,
        ackConfidentiality: 1,
        ackNonSolicitation: 1,
        status: "pending",
        ip,
        userAgent,
      });

      if (!application) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Your application could not be saved. Please try again or contact us directly.",
        });
      }

      // CRM lead.
      try {
        await createLead({
          source: "eng-access",
          sourceId: application.id,
          fullName: application.fullName,
          email: application.email,
          company: application.company,
          phone: application.phone,
          interest: "engineering-access",
          note: (application.message ?? "").slice(0, 1800),
          status: "new",
          ip,
          userAgent,
        });
      } catch (error) {
        console.warn("[engineering.submit] createLead threw:", error);
      }

      const emailResult = await sendDevApplicationAck({
        publicRef,
        fullName: application.fullName,
        email: application.email,
        locale: input.locale ?? null,
      });

      // Owner notification.
      try {
        const sent = await notifyOwner({
          title: `IO SKY · Engineering Access application`,
          content: [
            `Ref: ${publicRef}`,
            `Name: ${application.fullName}`,
            `Email: ${application.email}`,
            application.company ? `Company: ${application.company}` : null,
            application.roleTitle ? `Role: ${application.roleTitle}` : null,
            application.yearsExperience != null
              ? `YoE: ${application.yearsExperience}`
              : null,
            application.links ? `\nLinks: ${application.links}` : null,
            application.message ? `\nMessage: ${application.message}` : null,
            ``,
            `Acknowledgements: NDA ✓ · Confidentiality ✓ · Non-solicitation ✓`,
          ]
            .filter(Boolean)
            .join("\n"),
        });
        if (sent) await markDevAppOwnerNotified(application.id);
      } catch (error) {
        console.warn("[engineering.submit] notifyOwner threw:", error);
      }

      return {
        success: true as const,
        publicRef,
        emailTransport: emailResult.transport,
      };
    }),

  listRecent: adminProcedure.query(async () => {
    return listRecentDevApplications(100);
  }),

  setStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().min(1),
        status: z.enum(["pending", "in_review", "approved", "rejected"]),
        reviewerNote: z.string().max(2000).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      await updateDevAppStatus(
        input.id,
        input.status,
        input.reviewerNote ?? null,
      );
      return { success: true as const };
    }),
});
