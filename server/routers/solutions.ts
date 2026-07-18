/**
 * IO SKY — Solutions ecosystem tRPC router (Package 7).
 *
 * Powers the /solutions surface and its child funnels:
 *   • click events  — every CTA tap stored for analytics
 *   • proposal      — branded proposal-request intake (Growth / Elite / Custom)
 *   • discovery     — multi-step Custom Intelligence Infrastructure intake
 *
 * Each public mutation:
 *   – validates input via zod
 *   – persists to MySQL through server/db helpers
 *   – creates a CRM `leads` row for downstream sales/ops
 *   – notifies the project owner so they see new pipeline activity
 *   – never exposes PII back to anonymous callers
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "../_core/notification";
import {
  createEcosystemProposalRequest,
  createLead,
  getCustomDiscoveryByToken,
  listEcosystemProposalRequests,
  listRecentEcosystemClicks,
  listCustomDiscoverySessions,
  recordEcosystemClick,
  upsertCustomDiscoverySession,
} from "../db";

/* -------------------------------------------------------------------------- */
/* shared types + helpers                                                     */
/* -------------------------------------------------------------------------- */

const ecosystemEnum = z.enum(["growth", "elite", "custom"]);

/** ~9 base36 chars — 47 bits of entropy, plenty for an anonymous resume key. */
function newToken(): string {
  return (
    Math.random().toString(36).slice(2, 11) +
    Math.random().toString(36).slice(2, 11)
  );
}

function ctxIp(ctx: { req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } } }) {
  const xf = ctx.req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0]?.trim() || null;
  return ctx.req.socket?.remoteAddress ?? null;
}

function ctxUa(ctx: { req: { headers: Record<string, unknown> } }) {
  const ua = ctx.req.headers["user-agent"];
  return typeof ua === "string" ? ua : null;
}

/* -------------------------------------------------------------------------- */
/* router                                                                     */
/* -------------------------------------------------------------------------- */

export const solutionsRouter = router({
  /**
   * Public click logger. Records analytics events like `solutions_growth_click`
   * (returns `{ ok: true }`; intentionally never exposes the inserted row).
   */
  recordClick: publicProcedure
    .input(
      z.object({
        eventKey: z.string().min(3).max(80),
        source: z.string().min(2).max(64).default("solutions"),
        ecosystem: z.string().min(2).max(32).nullable().optional(),
        sessionToken: z.string().min(4).max(64).nullable().optional(),
        payload: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await recordEcosystemClick({
          eventKey: input.eventKey,
          source: input.source,
          ecosystem: input.ecosystem ?? null,
          sessionToken: input.sessionToken ?? null,
          userId: ctx.user?.id ?? null,
          ip: ctxIp(ctx),
          userAgent: ctxUa(ctx),
          payload: input.payload ?? null,
        });
      } catch (err) {
        // Click logging must never break the UX — swallow but warn.
        console.warn("[solutions] recordClick failed:", err);
      }
      return { ok: true as const };
    }),

  /**
   * Branded proposal request — used by /solutions/proposal-request and the
   * `Request Proposal` CTAs on each ecosystem deep-dive page.
   */
  requestProposal: publicProcedure
    .input(
      z.object({
        ecosystem: ecosystemEnum,
        fullName: z.string().min(2).max(200),
        email: z.string().email().max(320),
        company: z.string().max(200).nullable().optional(),
        phone: z.string().max(64).nullable().optional(),
        message: z.string().max(4000).nullable().optional(),
        goals: z.string().max(2000).nullable().optional(),
        source: z.string().max(64).default("solutions"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await createLead({
        source: "solutions",
        sourceId: null,
        fullName: input.fullName,
        email: input.email,
        company: input.company ?? null,
        phone: input.phone ?? null,
        interest: input.ecosystem,
        note: input.message ?? null,
        ip: ctxIp(ctx),
        userAgent: ctxUa(ctx),
      });

      const proposal = await createEcosystemProposalRequest({
        ecosystem: input.ecosystem,
        fullName: input.fullName,
        email: input.email,
        company: input.company ?? null,
        phone: input.phone ?? null,
        message: input.message ?? null,
        goals: input.goals ?? null,
        source: input.source,
        leadId: lead?.id ?? null,
        ip: ctxIp(ctx),
        userAgent: ctxUa(ctx),
      });

      if (!proposal) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not record proposal request",
        });
      }

      // Fire-and-forget admin notification.
      void notifyOwner({
        title: `IO SKY — new proposal request (${input.ecosystem})`,
        content: [
          `Ecosystem: ${input.ecosystem.toUpperCase()}`,
          `Name: ${input.fullName}`,
          `Email: ${input.email}`,
          input.company ? `Company: ${input.company}` : null,
          input.phone ? `Phone: ${input.phone}` : null,
          input.goals ? `Goals: ${input.goals}` : null,
          input.message ? `Message: ${input.message}` : null,
          `Source: ${input.source}`,
        ]
          .filter((line) => line !== null)
          .join("\n"),
      }).catch((err) => console.warn("[solutions] notifyOwner failed", err));

      return {
        ok: true as const,
        proposalId: proposal.id,
      };
    }),

  /**
   * Resume or start a Custom Discovery session. Returns the token + the
   * latest persisted state so the multi-step UI can hydrate.
   */
  startDiscovery: publicProcedure
    .input(
      z.object({
        token: z.string().min(4).max(64).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.token) {
        const existing = await getCustomDiscoveryByToken(input.token);
        if (existing) {
          return { token: existing.token, session: existing };
        }
      }
      const token = newToken();
      const session = await upsertCustomDiscoverySession(token, {
        status: "in_progress",
      });
      return { token, session };
    }),

  /**
   * Save a partial step. Called once per step transition in the multi-step
   * Custom Discovery flow. Idempotent — safe to retry.
   */
  saveDiscoveryStep: publicProcedure
    .input(
      z.object({
        token: z.string().min(4).max(64),
        patch: z.object({
          fullName: z.string().max(200).optional(),
          email: z.string().email().max(320).optional(),
          company: z.string().max(200).optional(),
          phone: z.string().max(64).optional(),
          needsTypes: z.string().max(2000).optional(),
          currentSystems: z.string().max(4000).optional(),
          teamSize: z.string().max(32).optional(),
          growthStage: z.string().max(32).optional(),
          complianceTags: z.string().max(2000).optional(),
          integrations: z.string().max(4000).optional(),
          timeline: z.string().max(32).optional(),
          urgency: z.string().max(32).optional(),
          preferredNext: z
            .enum(["ai-scan", "strategy-call", "proposal"])
            .optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const session = await upsertCustomDiscoveryByToken(input.token, input.patch);
      return { session };
    }),

  /**
   * Final submit step — converts the discovery session into a CRM lead, marks
   * the session "submitted" and notifies the admin.
   */
  submitDiscovery: publicProcedure
    .input(
      z.object({
        token: z.string().min(4).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getCustomDiscoveryByToken(input.token);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Discovery session not found" });
      }
      if (!existing.email || !existing.fullName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Name and email are required before submitting",
        });
      }

      const lead = await createLead({
        source: "solutions",
        sourceId: existing.id,
        fullName: existing.fullName,
        email: existing.email,
        company: existing.company ?? null,
        phone: existing.phone ?? null,
        interest: "custom",
        note: [
          existing.needsTypes ? `Needs: ${existing.needsTypes}` : null,
          existing.currentSystems ? `Systems: ${existing.currentSystems}` : null,
          existing.timeline ? `Timeline: ${existing.timeline}` : null,
          existing.preferredNext ? `Preferred next: ${existing.preferredNext}` : null,
        ]
          .filter(Boolean)
          .join("\n") || null,
        ip: ctxIp(ctx),
        userAgent: ctxUa(ctx),
      });

      const updated = await upsertCustomDiscoverySession(input.token, {
        status: "submitted",
        leadId: lead?.id ?? null,
        submittedAt: new Date(),
      });

      void notifyOwner({
        title: `IO SKY — Custom Discovery submitted`,
        content: [
          `Name: ${existing.fullName}`,
          `Email: ${existing.email}`,
          existing.company ? `Company: ${existing.company}` : null,
          existing.needsTypes ? `Needs: ${existing.needsTypes}` : null,
          existing.timeline ? `Timeline: ${existing.timeline}` : null,
          existing.preferredNext ? `Preferred next: ${existing.preferredNext}` : null,
          `Token: ${existing.token}`,
        ]
          .filter((l) => l !== null)
          .join("\n"),
      }).catch(() => null);

      return { ok: true as const, session: updated };
    }),

  /* ------------------------------------------------------------------ */
  /* Admin-only listings used by the Admin Portal "Ecosystem" panel.    */
  /* ------------------------------------------------------------------ */

  adminListClicks: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return listRecentEcosystemClicks(input.limit);
    }),

  adminListProposals: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return listEcosystemProposalRequests(input.limit);
    }),

  adminListDiscoveries: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return listCustomDiscoverySessions(input.limit);
    }),
});

/** Small helper to keep saveDiscoveryStep tight. */
async function upsertCustomDiscoveryByToken(
  token: string,
  patch: Record<string, unknown>,
) {
  return upsertCustomDiscoverySession(token, patch);
}
