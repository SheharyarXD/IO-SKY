import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import type { User } from "../../drizzle/schema";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * clientProcedure — requires authenticated user with role="client" AND a
 * non-null organizationId. Every downstream procedure can rely on
 * `ctx.user.organizationId` being a real integer.
 */
export const clientProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.role !== "client" && ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    if (!ctx.user.organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No organization is linked to this account.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        organizationId: ctx.user.organizationId as number,
      },
    });
  }),
);

/**
 * Shared gate-evaluation used by both developerProcedure and
 * developerSelfProcedure below — profile exists, MFA enrolled, all
 * required agreements signed, an active non-expired access scope, at
 * least one active assignment. Throws FORBIDDEN with a stable code in the
 * error message so the front-end can render the matching setup page (mfa /
 * agreements / access-expired / no-assignments) on failure; otherwise
 * returns the `ctx.developer` object both middlewares inject.
 *
 * Previously this whole block (gate call + error throws + ctx shape) was
 * duplicated line-for-line between the two middlewares; only the initial
 * role check actually differs between them.
 */
async function resolveDeveloperContext(user: User) {
  // Lazy-import the helper to keep this file free of DB deps.
  const { evaluateDeveloperGate } = await import("../db");
  const result = await evaluateDeveloperGate({
    userId: user.id,
    mfaMethod: user.mfaMethod ?? "none",
  });

  if (!result.gate.ok) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `developer_gate:${result.gate.reason}`,
    });
  }
  if (!result.profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "developer_gate:no_profile",
    });
  }

  return {
    id: result.profile.id,
    profile: result.profile,
    scope: result.scope,
    assignments: result.assignments,
  };
}

/**
 * developerProcedure — requires role="developer" AND a passing gate
 * (see resolveDeveloperContext above).
 *
 * If any gate fails it raises FORBIDDEN with a stable code in the error
 * message so the front-end can render the matching setup page (mfa /
 * agreements / access-expired / no-assignments). The Overview page
 * deliberately uses a separate `gateStatus` query against
 * `protectedProcedure` so the UI can show a calm error state instead
 * of redirecting through a 403.
 *
 * Downstream procedures can rely on `ctx.developer.id`, `ctx.developer.profile`,
 * and `ctx.developer.scope` always being defined.
 */
export const developerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.role !== "developer" && ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    const developer = await resolveDeveloperContext(ctx.user);

    return next({
      ctx: { ...ctx, user: ctx.user, developer },
    });
  }),
);

/**
 * developerSelfProcedure — strict variant of developerProcedure for
 * self-service surfaces (own profile, own MFA, own audit timeline).
 *
 * Unlike developerProcedure (which intentionally lets admins through so
 * support tooling can introspect a developer's data), this middleware
 * refuses admin callers outright. The only allowed role is `developer`,
 * and the same gates still have to pass (resolveDeveloperContext above).
 *
 * Use this for any endpoint that writes to the calling developer's row
 * or returns their personal audit log.
 */
export const developerSelfProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.role !== "developer") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "developer_self_only",
      });
    }

    const developer = await resolveDeveloperContext(ctx.user);

    return next({
      ctx: { ...ctx, user: ctx.user, developer },
    });
  }),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * requireAcceptances(kinds) — server-side enforcement that the calling
 * user has accepted the **currently live** version of each given legal
 * document kind. Use this to wrap any mutation that legally requires the
 * user to have an up-to-date Privacy / Terms / AI-Disclaimer / etc.
 * acceptance on file.
 *
 * Behaviour:
 *   - Anonymous calls are allowed through (the gate is by-user). The
 *     mutation can decide whether to accept anonymous traffic via its
 *     own zod input gate.
 *   - For authenticated calls, every kind is checked against
 *     `agreement_acceptances` for the live `agreement_versions` row.
 *   - If any required acceptance is missing, throws FORBIDDEN with code
 *     `acceptance_missing:<kind1>,<kind2>` so the client UI can surface
 *     the right modal.
 *   - If a document kind has no live version yet (early environment),
 *     that kind is silently skipped — it is not enforceable until it's
 *     published.
 *
 * Admins are NOT exempt — admins are also subject to ToS/Privacy
 * acceptances since they too consume the platform.
 */
export function requireAcceptances(kinds: string[]) {
  return t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) return next({ ctx });
    if (kinds.length === 0) return next({ ctx });

    const { userHasAcceptedLatest } = await import("../legalDb");
    const missing: string[] = [];
    for (const kind of kinds) {
      const result = await userHasAcceptedLatest(ctx.user.id, kind);
      if (!result.version) continue;
      if (!result.accepted) missing.push(kind);
    }

    if (missing.length > 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `acceptance_missing:${missing.join(",")}`,
      });
    }

    return next({ ctx });
  });
}

/**
 * acceptedProcedure — protectedProcedure pre-composed with the canonical
 * "user must have accepted Privacy + Terms" gate. Use this for any write
 * mutation that legally requires the calling user to have an up-to-date
 * acceptance on file.
 */
export const acceptedProcedure = protectedProcedure.use(
  requireAcceptances(["privacy-policy", "terms-of-service"]),
);
