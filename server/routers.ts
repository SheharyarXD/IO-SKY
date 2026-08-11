import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getRequestMeta } from "./_core/requestMeta";
import { bookingsRouter } from "./routers/bookings";
import { contactRouter } from "./routers/contact";
import { engineeringRouter } from "./routers/engineering";
import { auditRouter } from "./routers/audit";
import { clientPortalRouter } from "./routers/clientPortal";
import { developerRouter } from "./routers/developer";
import { mfaRouter } from "./routers/mfa";
import { adminRouter } from "./routers/admin";
import { bookingAdminRouter } from "./routers/bookingAdmin";
import { solutionsRouter } from "./routers/solutions";
import { legalRouter } from "./routers/legal";
import { aiScansRouter } from "./routers/aiScans";
import { appendLoginAudit } from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      // Surface impersonation breadcrumb to the SPA so role gates and the
      // banner can render correctly. We never expose the realAdminOpenId
      // beyond what is already in the JWT.
      return {
        ...user,
        impersonation: opts.ctx.impersonation
          ? {
              active: true as const,
              target: opts.ctx.impersonation.target,
              reason: opts.ctx.impersonation.reason,
              expiresAt: opts.ctx.impersonation.expiresAt,
            }
          : null,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    /**
     * Record a login attempt for audit purposes.
     *
     * This is intentionally a public mutation: the caller may not yet be
     * authenticated, and we want to log blocked / failed / sso-redirect
     * attempts even when they don't resolve to a session. The actual
     * session creation continues to happen through `/api/oauth/callback`.
     */
    recordAttempt: publicProcedure
      .input(
        z.object({
          identifier: z.string().email().max(320).nullable().optional(),
          provider: z.enum([
            "manus",
            "supabase",
            "google",
            "microsoft",
            "apple",
            "magic-link",
            "credentials",
          ]),
          outcome: z.enum([
            "success",
            "failed",
            "blocked",
            "mfa_required",
            "redirect",
          ]),
          reason: z.string().max(200).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { ip, userAgent } = getRequestMeta(ctx.req);

        await appendLoginAudit({
          userId: ctx.user?.id ?? null,
          identifier: input.identifier ?? null,
          provider: input.provider,
          outcome: input.outcome,
          reason: input.reason ?? null,
          ip,
          userAgent,
        });

        return { logged: true } as const;
      }),
  }),
  bookings: bookingsRouter,
  contact: contactRouter,
  engineering: engineeringRouter,
  audit: auditRouter,
  clientPortal: clientPortalRouter,
  developer: developerRouter,
  mfa: mfaRouter,
  admin: adminRouter,
  bookingAdmin: bookingAdminRouter,
  solutions: solutionsRouter,
  legal: legalRouter,
  aiScans: aiScansRouter,
});

export type AppRouter = typeof appRouter;
