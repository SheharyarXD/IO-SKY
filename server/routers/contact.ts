/**
 * IO SKY — Contact form tRPC router.
 *
 * Public:
 *   - contact.submit — validate + persist + email confirmation + admin notify + CRM lead.
 * Admin:
 *   - contact.listRecent — last 100 submissions for the operations dashboard.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createContactSubmission,
  createLead,
  listRecentContactSubmissions,
  markContactEmailSent,
  markContactOwnerNotified,
} from "../db";
import { sendContactConfirmation } from "../email";
import { notifyOwner } from "../_core/notification";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";

const submissionsByIp = new Map<string, number[]>();
const SUBMISSION_WINDOW_MS = 60_000;
const SUBMISSION_LIMIT_PER_MIN = 4;

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
  return `IOSKY-MSG-${block()}-${block()}`;
}

const contactInputSchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(64).optional().nullable(),
  company: z.string().min(1).max(200),
  industry: z.string().max(64).optional().nullable(),
  size: z.string().max(64).optional().nullable(),
  subject: z.string().min(1).max(64),
  message: z.string().min(10).max(2000),

  utmSource: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),

  /** Honeypot — must be empty. */
  website: z.string().max(0).optional().nullable(),
  /** Recipient UI locale for the localised confirmation email (e.g. "NL"). */
  locale: z.string().max(16).optional().nullable(),
});

export const contactRouter = router({
  submit: publicProcedure
    .input(contactInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Honeypot — silently succeed-shape so bots can't probe.
      if (input.website && input.website.length > 0) {
        return {
          success: true as const,
          publicRef: "IOSKY-MSG-XXXX-XXXX",
          emailTransport: "console" as const,
        };
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
          message: "Too many submissions. Please try again shortly.",
        });
      }

      const publicRef = generatePublicRef();
      const submission = await createContactSubmission({
        publicRef,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        company: input.company.trim(),
        industry: input.industry?.trim() || null,
        size: input.size?.trim() || null,
        subject: input.subject.trim(),
        message: input.message.trim(),
        status: "new",
        ip,
        userAgent,
      });

      if (!submission) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Your message could not be saved. Please try again or email us directly.",
        });
      }

      // CRM lead.
      try {
        await createLead({
          source: "contact",
          sourceId: submission.id,
          fullName: submission.fullName,
          email: submission.email,
          company: submission.company,
          phone: submission.phone,
          interest: submission.subject,
          note: submission.message.slice(0, 1800),
          status: "new",
          utmSource: input.utmSource ?? null,
          utmCampaign: input.utmCampaign ?? null,
          ip,
          userAgent,
        });
      } catch (error) {
        console.warn("[contact.submit] createLead threw:", error);
      }

      // Confirmation email.
      const emailResult = await sendContactConfirmation({
        publicRef,
        fullName: submission.fullName,
        email: submission.email,
        subject: submission.subject,
        message: submission.message,
        locale: input.locale ?? null,
      });
      if (emailResult.ok) await markContactEmailSent(submission.id);

      // Owner notification — best effort.
      try {
        const sent = await notifyOwner({
          title: `IO SKY · Contact form (${submission.subject})`,
          content: [
            `Ref: ${publicRef}`,
            `Name: ${submission.fullName}`,
            `Email: ${submission.email}`,
            submission.phone ? `Phone: ${submission.phone}` : null,
            `Company: ${submission.company}`,
            submission.industry ? `Industry: ${submission.industry}` : null,
            submission.size ? `Size: ${submission.size}` : null,
            ``,
            `Message:`,
            submission.message,
          ]
            .filter(Boolean)
            .join("\n"),
        });
        if (sent) await markContactOwnerNotified(submission.id);
      } catch (error) {
        console.warn("[contact.submit] notifyOwner threw:", error);
      }

      return {
        success: true as const,
        publicRef,
        emailTransport: emailResult.transport,
      };
    }),

  listRecent: adminProcedure.query(async () => {
    return listRecentContactSubmissions(100);
  }),
});
