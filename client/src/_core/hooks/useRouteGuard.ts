/**
 * IO SKY — shared route-guard logic (RM-58/59).
 *
 * Built against the current auth/RBAC layer: `useAuth()` (below) resolves
 * through `trpc.auth.me`, which reflects `ctx.user` — populated identically
 * whether the session originated from Manus OAuth, local-password, or the
 * Supabase Auth bridge (RM-50, server/_core/supabaseAuthRoute.ts). This
 * hook adds nothing auth-source-specific on top of that, so it is not a
 * throwaway guard tied to the old session system — it works unchanged as
 * more accounts move to Supabase Auth.
 *
 * Before this file existed, `AdminLayout.tsx`, `ClientPortal.tsx`, and
 * `DeveloperWorkspace.tsx` each independently reimplemented: the
 * role -> home-portal mapping, the impersonation-target check (with unsafe
 * `(user as any)` casts), and a barely-differing loading/unauthenticated
 * check. This file centralizes the two pieces that are genuinely identical
 * across all three (the role->home mapping and the impersonation check) —
 * see the exports below.
 *
 * Deliberately NOT centralized: each portal's choice of hard-redirect vs.
 * in-place "access denied" card for a wrong-role visitor, and each
 * portal's loading-state UI. Those are real, pre-existing UX differences
 * between the three surfaces, not accidental duplication — forcing them
 * into one shape here would be a visual behavior change nobody asked for
 * and this environment cannot QA. Only the decision *logic* is shared.
 */
import { useAuth } from "./useAuth";

export type PortalRole = "user" | "client" | "developer" | "admin" | "super_admin" | "technical_operator";
export type ImpersonationTarget = "client" | "developer";

/**
 * RM-57: "super_admin" is a strict superset of "admin" — everywhere the
 * portal shells used to check `role === "admin"` to mean "this account has
 * admin-or-above access" must also accept "super_admin", the same rule
 * `server/_core/trpc.ts`'s `isAdminRole()` enforces server-side. Client-side
 * checks are UX only (the real boundary is the server), but a stale check
 * here would still incorrectly bounce a super_admin out of the admin
 * console, so it has to stay in sync.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export type GuardUser = {
  role?: string | null;
  impersonation?: {
    active: boolean;
    target: ImpersonationTarget;
  } | null;
} | null | undefined;

/**
 * Canonical "where does this role live" mapping — the client-side
 * counterpart of `server/_core/oauth.ts`'s `roleBasedDestination()`, used
 * for in-app role-mismatch redirects rather than the post-login redirect
 * that function handles. Keep the two in sync if the role model changes
 * (e.g. RM-57's Super Admin decision, once made).
 */
export function roleHome(role: string | null | undefined): string {
  switch (role) {
    case "admin":
    case "super_admin":
      return "/admin";
    case "client":
    case "client_member":
      return "/client-portal";
    case "developer":
      return "/developer-workspace";
    case "technical_operator":
      return "/ops";
    default:
      return "/";
  }
}

/**
 * True when an admin is actively impersonating (View-As) the given target
 * role. Replaces the `(user as any)?.impersonation?.active && ...` casts
 * previously duplicated in ClientPortal.tsx and DeveloperWorkspace.tsx.
 */
export function isImpersonatingTarget(
  user: GuardUser,
  target: ImpersonationTarget,
): boolean {
  return Boolean(user?.impersonation?.active && user.impersonation.target === target);
}

/**
 * Maps a user's `loginMethod` (free-text on `users.loginMethod`, e.g.
 * "google", "supabase", "email") onto the fixed provider enum
 * `auth.recordAttempt` accepts. Used for portal-access audit logging
 * (ClientPortal.tsx, DeveloperWorkspace.tsx) — previously both hardcoded
 * `provider: "manus"` regardless of how the user actually authenticated,
 * which became actively wrong once the Supabase Auth bridge (RM-50) made
 * "supabase" a real, distinct login path. Falls back to "credentials" for
 * any value outside the known set rather than guessing.
 */
export function recordAttemptProvider(
  loginMethod: string | null | undefined,
): "manus" | "supabase" | "google" | "microsoft" | "apple" | "magic-link" | "credentials" {
  switch (loginMethod) {
    case "supabase":
    case "google":
    case "microsoft":
    case "apple":
    case "magic-link":
      return loginMethod;
    default:
      // Covers "email"/"github"/anything else `deriveLoginMethod()` in
      // sdk.ts can produce, plus null/undefined — none of those are valid
      // recordAttempt provider values, so fall back to the generic one.
      return "credentials";
  }
}

/**
 * Thin wrapper around `useAuth()` that also surfaces the two shared guard
 * helpers above, so portal shells have one import for "am I logged in, what
 * role am I, where does my role live, am I being impersonated into this
 * surface" instead of reaching for `useAuth` plus ad-hoc local logic.
 */
export function useRouteGuard() {
  const auth = useAuth();
  return { ...auth, roleHome, isImpersonatingTarget, isAdminRole };
}
