/*
 * IO SKY — Account activation (SRS 8.7), public surface.
 *
 * The sequence is: invitation, activation email, identity verification (the
 * emailed secret link proves control of the address), password creation,
 * acceptance of the applicable legal agreements, optional MFA enrolment
 * depending on role, activation, automatic sign in, and automatic portal
 * routing. Until it completes no account exists, so nothing protected can be
 * reached.
 *
 * Every failure on the link returns the same message. Distinguishing "expired"
 * from "never existed" would let anyone probe which tokens are real.
 */
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { COOKIE_NAME, getSessionTtlMs } from "@shared/const";
import { publicProcedure, router } from "../_core/trpc";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { createRateLimiter } from "../_core/rateLimiter";
import { getRequestMeta } from "../_core/requestMeta";
import { roleBasedDestination } from "../_core/oauth";
import { ACTIVATION_AGREEMENT_KINDS, checkPasswordStrength, roleRequiresMfa } from "../../shared/srsRules";
import { activateAccount, appendLoginAudit, getInvitationByToken, getLiveAgreementVersion, recordAgreementAcceptance } from "../db";
import { emitNotification } from "../notificationDispatcher";
import { getPasswordMinLength } from "../_core/policy";

const isActivationRateLimited = createRateLimiter(10);

const INVALID_LINK = "This activation link is not valid. It may have expired or already been used. Ask your IO SKY contact for a new invitation.";

const KIND_HREF: Record<string, string> = { "privacy-policy": "/privacy", "terms-of-service": "/terms" };

async function liveAgreements() {
  const out: Array<{ kind: string; versionId: number; title: string; href: string }> = [];
  for (const kind of ACTIVATION_AGREEMENT_KINDS) {
    const live = await getLiveAgreementVersion(kind);
    // A document with no published version is not enforceable yet (same rule as requireAcceptances).
    if (live) out.push({ kind, versionId: live.version.id, title: live.document.title ?? kind, href: KIND_HREF[kind] ?? `/legal/${kind}` });
  }
  return out;
}

export const accountsRouter = router({
  activationDetails: publicProcedure.input(z.object({ token: z.string().min(20).max(200) })).query(async ({ ctx, input }) => {
    const { ip } = getRequestMeta(ctx.req);
    if (await isActivationRateLimited(ip)) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please wait a minute." });
    }
    const found = await getInvitationByToken(input.token);
    if (!found || found.state !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: INVALID_LINK });
    return {
      email: found.invitation.email,
      role: found.invitation.role,
      mfaRequired: roleRequiresMfa(found.invitation.role),
      passwordMinLength: getPasswordMinLength(),
      agreements: await liveAgreements(),
      expiresAt: found.invitation.expiresAt,
    };
  }),

  activate: publicProcedure
    .input(
      z.object({
        token: z.string().min(20).max(200),
        name: z.string().trim().min(2).max(120),
        password: z.string().min(1).max(200),
        acceptedAgreements: z.literal(true, { message: "You must accept the agreements to continue." }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { ip, userAgent } = getRequestMeta(ctx.req);
      if (await isActivationRateLimited(ip)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please wait a minute." });
      }
      const found = await getInvitationByToken(input.token);
      if (!found || found.state !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: INVALID_LINK });

      const strength = checkPasswordStrength(input.password, found.invitation.email, getPasswordMinLength());
      if (!strength.ok) throw new TRPCError({ code: "BAD_REQUEST", message: strength.reason });

      const agreements = await liveAgreements();
      const passwordHash = await bcrypt.hash(input.password, 12);
      const result = await activateAccount({ token: input.token, name: input.name, passwordHash });
      if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Activation is temporarily unavailable." });
      if (!result.ok) throw new TRPCError({ code: result.reason === "user_exists" ? "CONFLICT" : "NOT_FOUND", message: result.reason === "user_exists" ? "An account with this email already exists. Sign in instead." : INVALID_LINK });

      const { user, invitation } = result;
      for (const a of agreements) {
        await recordAgreementAcceptance({ userId: user.id, organizationId: user.organizationId, versionId: a.versionId, documentKind: a.kind, ip, userAgent, method: "signup" }).catch((e) =>
          console.error("[activation] could not record an agreement acceptance:", e),
        );
      }
      await appendLoginAudit({ userId: user.id, identifier: user.email, provider: "activation", outcome: "success", reason: `activated:${user.role}`, ip, userAgent });

      // Automatic sign in, with the same cookie the password login mints.
      const ttl = getSessionTtlMs();
      const session = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ttl });
      ctx.res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(ctx.req as never), maxAge: ttl });

      if (user.role === "client") {
        await emitNotification({ event: "CLIENT_ACCOUNT_CREATED", audience: { type: "admin" }, dedupeRef: `user:${user.id}`, title: `Client account activated: ${user.email}`, href: "/admin/clients" });
      }
      void invitation;
      // Privileged roles go straight to MFA enrolment, which the existing gate enforces on first use.
      return { ok: true as const, role: user.role, next: roleBasedDestination(user.role, "/"), mfaRequired: roleRequiresMfa(user.role) };
    }),
});
