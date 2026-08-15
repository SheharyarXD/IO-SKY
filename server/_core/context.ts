import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { isAdminRole } from "./trpc";
import {
  getImpersonationFromRequest,
  verifyImpersonationToken,
  type ImpersonationPayload,
} from "./viewAsRoute";

export type ImpersonationContext = {
  active: true;
  realAdminOpenId: string;
  target: "client" | "developer";
  reason: string;
  expiresAt: number;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  impersonation: ImpersonationContext | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }

  // View-As: if the impersonation cookie is present and signed correctly,
  // and the underlying session is a real admin, surface the impersonation
  // role to downstream procedures while keeping the real admin identity
  // recorded for audit. If anything is off we silently ignore it.
  let impersonation: ImpersonationContext | null = null;
  if (user && isAdminRole(user.role)) {
    const token = getImpersonationFromRequest(opts.req);
    if (token) {
      const claim = await verifyImpersonationToken(token);
      if (claim) {
        impersonation = {
          active: true,
          realAdminOpenId: claim.realAdminOpenId,
          target: claim.target,
          reason: claim.reason,
          expiresAt: claim.exp * 1000,
        };
        // We deliberately keep ctx.user.role untouched (admin or, per
        // RM-57, super_admin) so adminProcedure continues to work — both
        // tiers can keep using admin RPCs while previewing. Frontend role
        // gates use auth.me.impersonation to allow rendering the client /
        // developer portal UI.
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    impersonation,
  };
}

export type { ImpersonationPayload };
