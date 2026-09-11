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

/**
 * RM-57: "super_admin" is a strict superset of "admin" — every place that
 * previously checked `role === "admin"` to mean "this account has
 * admin-or-above privilege" must also accept "super_admin", or a promoted
 * account would silently lose access an ordinary admin still has. Use this
 * instead of comparing to the literal "admin" string.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

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
    if (ctx.user.role !== "client" && !isAdminRole(ctx.user.role)) {
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
    if (ctx.user.role !== "developer" && !isAdminRole(ctx.user.role)) {
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

/**
 * Milestone 2 §2.5 — the hard, blocking per-role MFA gate. Deliberately
 * scoped to the highest-privilege roles only (admin, super_admin,
 * technical_operator) rather than every role: client/developer are
 * self-service accounts with their own separate MFA UX (clientPortal's
 * lite toggle, the developer gate's own mfa_required check), while these
 * three roles hold the platform's most sensitive capabilities (customer
 * data, financial records, infra visibility) and were previously the only
 * authenticated tier with NO enforcement at all. Uses the same
 * `mfa_factors`/`listVerifiedMfaFactorsForUser` source of truth
 * `admin.mfaPosture`'s compliance dashboard already reads — a verified
 * factor, not just `users.mfaMethod` (which clients/developers can set
 * without proof of possession via the lite toggle).
 */
const PRIVILEGED_MFA_ROLES = new Set(["admin", "super_admin", "technical_operator"]);

export async function evaluatePrivilegedMfaGate(
  user: User,
): Promise<{ ok: true } | { ok: false; reason: "mfa_required" }> {
  if (!PRIVILEGED_MFA_ROLES.has(user.role)) return { ok: true };
  const { listVerifiedMfaFactorsForUser } = await import("../db");
  const factors = await listVerifiedMfaFactorsForUser(user.id);
  if (factors.length === 0) return { ok: false, reason: "mfa_required" };
  return { ok: true };
}

async function assertPrivilegedMfaGate(user: User) {
  const result = await evaluatePrivilegedMfaGate(user);
  if (!result.ok) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `privileged_gate:${result.reason}`,
    });
  }
}

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    await assertPrivilegedMfaGate(ctx.user);

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * superAdminProcedure — strictly role="super_admin", no admin fallback.
 * Use for the Milestone 2 §2.5 capabilities that are exclusively
 * super_admin's (organization management, role/permission management,
 * platform & integration configuration) — the capabilities a regular
 * admin does NOT get, per the RM-57 decision. Everything a regular admin
 * can already do stays reachable through adminProcedure, which
 * super_admin also passes (see isAdminRole above) — this procedure is
 * additive, not a replacement for adminProcedure elsewhere.
 */
/**
 * privacyOfficerProcedure — Data Subject Rights administration.
 *
 * The client's requirement was explicit: "Only specifically authorised users
 * may perform privacy-request actions. Developers, Admins or other roles must
 * not receive access merely because of their general role."
 *
 * So this middleware deliberately does NOT consult `user.role` at all. There
 * is no admin fallback and no super-admin override. Authority comes from a
 * live row in `privacy_officer_grants` naming this specific user, and nothing
 * else. A Super Admin without a grant gets exactly the same refusal as an
 * anonymous caller would.
 *
 * The privileged MFA gate still applies on top, because acting on a privacy
 * request means reading other people's personal data, and that should not be
 * reachable from a session secured by a password alone. Note the ordering:
 * the grant is checked FIRST, so a user with no grant never learns whether
 * their MFA state would have been acceptable.
 */
export const privacyOfficerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    const { getActivePrivacyOfficerGrant } = await import("../db");
    const grant = await getActivePrivacyOfficerGrant(ctx.user.id);
    if (!grant) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "privacy_officer_required",
      });
    }

    // Reading another person's personal data is not something a
    // password-only session should reach.
    const mfa = await evaluatePrivilegedMfaGate({
      ...ctx.user,
      // The gate is scoped to three roles by design; a privacy officer must
      // clear it whatever their role is, so evaluate them as one of those.
      role: "admin",
    } as User);
    if (!mfa.ok) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `privileged_gate:${mfa.reason}`,
      });
    }

    return next({
      ctx: { ...ctx, user: ctx.user, privacyGrant: grant },
    });
  }),
);

export const superAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "super_admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    await assertPrivilegedMfaGate(ctx.user);

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Milestone 2 §2.5 — "technical_operator" is a distinct, lateral RBAC tier
 * (not a superset or subset of admin) scoped to infrastructure/operational
 * visibility, deliberately walled off from customer and financial data.
 * `opsProcedure` gates the small set of ops-only endpoints (system health,
 * email delivery health, security-event volume) to
 * technical_operator + admin + super_admin — admins keep everything they
 * already had (this is additive), and a technical_operator gets exactly
 * this ops slice and nothing else: they do NOT pass `adminProcedure`, so
 * every customer/financial/leads/documents endpoint stays out of reach.
 */
export function isOpsRole(role: string | null | undefined): boolean {
  return role === "technical_operator" || isAdminRole(role);
}

export const opsProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !isOpsRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    await assertPrivilegedMfaGate(ctx.user);

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
