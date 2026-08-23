import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { getSupabaseClient } from "@/lib/supabase";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // RM-50: also end any Supabase Auth session (harmless no-op for
      // accounts that only ever used the Manus/local-password path — the
      // Supabase client just has no active session to clear). Best-effort:
      // the app's own session cookie (cleared above) is what actually
      // gates access, so a Supabase sign-out failure must not block logout.
      try {
        await getSupabaseClient()?.auth.signOut();
      } catch {
        /* best-effort */
      }
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // Milestone 2 §2.2 cosmetic sweep: renamed from "manus-runtime-user-info"
    // — purely an internal display cache (one writer here, one reader in
    // ExecutiveOverview.tsx's greeting fallback), never an external call,
    // but the old name was a stale Manus-era leftover worth cleaning up.
    localStorage.setItem(
      "iosky-current-user-cache",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;

    // Only resolve the (potentially network/env-dependent) login URL when a
    // redirect is actually about to happen — this used to be a destructuring
    // default (`redirectPath = getLoginUrl()`) that ran on EVERY render of
    // every component using useAuth()/useRouteGuard(), regardless of
    // whether redirectOnUnauthenticated was even true. getLoginUrl() throws
    // when VITE_OAUTH_PORTAL_URL isn't configured — a valid deployment state
    // since RM-50 added local email/password + Supabase Auth login — which
    // crashed the entire admin/client/developer console on every render, not
    // just unauthenticated ones. No caller in this codebase actually passes
    // redirectOnUnauthenticated: true, so this path was pure dead weight
    // paying a real crash cost for zero benefit.
    const target = redirectPath ?? getLoginUrl();
    if (window.location.pathname === target) return;

    // Double rAF: let React flush portal unmounts before hard navigation
    // to prevent the removeChild crash on Radix/Sonner portal nodes.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.location.href = target;
      });
    });
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
