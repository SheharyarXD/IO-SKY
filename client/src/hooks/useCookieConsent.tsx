/**
 * IO SKY — Cookie Consent hook.
 *
 * Manages an anonymous (or authenticated) cookie consent decision and keeps
 * it in sync between localStorage (so the UI is instant) and the database
 * (so it is auditable). On mount we:
 *
 *   1. Generate or read a stable `subjectKey` from localStorage.
 *   2. Read the locally-cached decision (instant UI).
 *   3. Sync with the server in the background. If server has a more recent
 *      decision, we adopt it.
 *
 * The functional category is *always* true server-side (the platform cannot
 * function without session cookies), even if the client tries to opt out.
 *
 * GDPR/AVG note: anonymous storage of the subjectKey is itself a "strictly
 * necessary" cookie because it is required to persist the user's consent
 * decision. It is therefore exempt from prior consent under recital 32.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

export type ConsentCategories = {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentDecision = "accepted-all" | "rejected-all" | "custom";

const STORAGE_KEY = "iosky.consent.v1";
const SUBJECT_KEY = "iosky.consent.subject";

const DEFAULT_CATEGORIES: ConsentCategories = {
  functional: true,
  analytics: false,
  marketing: false,
};

type LocalState = {
  subjectKey: string;
  decision: ConsentDecision | null;
  categories: ConsentCategories;
  recordedAt: string | null;
};

function safeRandomKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `iosky-${crypto.randomUUID()}`;
  }
  return `iosky-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readLocal(): LocalState {
  if (typeof window === "undefined") {
    return {
      subjectKey: "",
      decision: null,
      categories: DEFAULT_CATEGORIES,
      recordedAt: null,
    };
  }

  let subjectKey = window.localStorage.getItem(SUBJECT_KEY);
  if (!subjectKey) {
    subjectKey = safeRandomKey();
    try {
      window.localStorage.setItem(SUBJECT_KEY, subjectKey);
    } catch {
      // localStorage unavailable (private mode); fall back to per-tab key.
    }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      subjectKey,
      decision: null,
      categories: DEFAULT_CATEGORIES,
      recordedAt: null,
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    return {
      subjectKey,
      decision: (parsed.decision as ConsentDecision) ?? null,
      categories: {
        functional: true,
        analytics: parsed.categories?.analytics ?? false,
        marketing: parsed.categories?.marketing ?? false,
      },
      recordedAt: parsed.recordedAt ?? null,
    };
  } catch {
    return {
      subjectKey,
      decision: null,
      categories: DEFAULT_CATEGORIES,
      recordedAt: null,
    };
  }
}

function writeLocal(state: LocalState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUBJECT_KEY, state.subjectKey);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        decision: state.decision,
        categories: state.categories,
        recordedAt: state.recordedAt,
      }),
    );
  } catch {
    // ignore quota / private-mode
  }
}

export function useCookieConsent() {
  const [state, setState] = useState<LocalState>(() => readLocal());

  const recordMutation = trpc.legal.recordCookieConsent.useMutation();

  // Background sync: if the server has a more recent decision (e.g. user
  // accepted on another device while logged in), adopt it.
  const serverConsent = trpc.legal.getCookieConsent.useQuery(
    { subjectKey: state.subjectKey },
    { enabled: !!state.subjectKey, refetchOnWindowFocus: false },
  );

  useEffect(() => {
    if (!serverConsent.data) return;
    const server = serverConsent.data;
    const localTs = state.recordedAt ? Date.parse(state.recordedAt) : 0;
    const serverTs = new Date(server.acceptedAt).getTime();
    if (serverTs <= localTs) return;
    setState((prev) => {
      const next: LocalState = {
        subjectKey: prev.subjectKey,
        decision: server.decision as ConsentDecision,
        categories: {
          functional: true,
          analytics: server.categories.analytics,
          marketing: server.categories.marketing,
        },
        recordedAt: new Date(server.acceptedAt).toISOString(),
      };
      writeLocal(next);
      return next;
    });
  }, [serverConsent.data, state.recordedAt]);

  const persist = useCallback(
    async (
      decision: ConsentDecision,
      categories: ConsentCategories,
    ): Promise<void> => {
      const sanitised: ConsentCategories = {
        functional: true,
        analytics: categories.analytics,
        marketing: categories.marketing,
      };
      const next: LocalState = {
        subjectKey: state.subjectKey,
        decision,
        categories: sanitised,
        recordedAt: new Date().toISOString(),
      };
      setState(next);
      writeLocal(next);

      try {
        await recordMutation.mutateAsync({
          subjectKey: state.subjectKey,
          decision,
          categories: sanitised,
        });
      } catch (err) {
        console.warn("[consent] server sync failed (kept locally):", err);
      }
    },
    [recordMutation, state.subjectKey],
  );

  const acceptAll = useCallback(
    () =>
      persist("accepted-all", {
        functional: true,
        analytics: true,
        marketing: true,
      }),
    [persist],
  );

  const rejectAll = useCallback(
    () =>
      persist("rejected-all", {
        functional: true,
        analytics: false,
        marketing: false,
      }),
    [persist],
  );

  const saveCustom = useCallback(
    (categories: ConsentCategories) => persist("custom", categories),
    [persist],
  );

  const isResolved = state.decision !== null;

  return useMemo(
    () => ({
      subjectKey: state.subjectKey,
      decision: state.decision,
      categories: state.categories,
      recordedAt: state.recordedAt,
      isResolved,
      isSaving: recordMutation.isPending,
      acceptAll,
      rejectAll,
      saveCustom,
    }),
    [
      state.subjectKey,
      state.decision,
      state.categories,
      state.recordedAt,
      isResolved,
      recordMutation.isPending,
      acceptAll,
      rejectAll,
      saveCustom,
    ],
  );
}
