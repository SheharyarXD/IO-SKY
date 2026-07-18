/*
 * IO SKY — Admin Portal · uniform module state primitives.
 *
 * Every /admin/* module renders through `<ModuleStateBoundary>` so the
 * loading, empty, error and forbidden states share one visual language
 * across the 19 surfaces.
 */
import type { ReactNode } from "react";
import { Loader2, ShieldAlert, AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { trpc } from "@/lib/trpc";

interface BoundaryProps<T> {
  isLoading: boolean;
  error: { message: string; data?: { code?: string } } | null | undefined;
  data: T | undefined;
  /** Returns true when `data` should be considered an "empty" payload. */
  isEmpty?: (data: T) => boolean;
  onRetry?: () => void;
  /** What to render in the happy-path state. */
  children: (data: T) => ReactNode;
}

export function ModuleStateBoundary<T>({
  isLoading,
  error,
  data,
  isEmpty,
  onRetry,
  children,
}: BoundaryProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/55">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-[13px] font-mono uppercase tracking-[0.14em]">Loading…</span>
      </div>
    );
  }

  if (error) {
    const code = error.data?.code;
    if (code === "FORBIDDEN" || code === "UNAUTHORIZED") {
      return (
        <EmptyState
          icon={<ShieldAlert size={16} />}
          title="Permission denied"
          description="Your account does not have the role required to view this module. Reach out to a Super Administrator if you need access."
        />
      );
    }
    return (
      <div className="io-empty-state border-red-500/30 bg-red-500/[0.06]" role="alert">
        <div className="io-empty-icon" style={{ color: "oklch(0.78 0.20 25)" }}>
          <AlertCircle size={16} />
        </div>
        <div className="font-display text-base text-ivory">
          Could not load this module
        </div>
        <p className="text-sm text-mute-1 max-w-md break-words">
          {error.message || "An unexpected error occurred."}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 bg-white/[0.04]"
            onClick={onRetry}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (data === undefined) {
    return null;
  }

  if (isEmpty?.(data)) {
    return (
      <EmptyState
        icon={<Inbox size={16} />}
        title="Nothing here yet"
        description="This surface is connected and audited but has no data yet. Activity captured by other modules will populate here automatically."
      />
    );
  }

  return <>{children(data)}</>;
}

/**
 * Hook that wraps `trpc.admin.action.useMutation()` so any sidebar module
 * can declare a button as `audited("crm", "export-csv")` without
 * boilerplate. The mutation is fire-and-forget from the UI's point of
 * view: the audit row is what matters, the tooltip / toast just confirms
 * the user that something happened.
 */
export function useAuditedAction() {
  const m = trpc.admin.action.useMutation();
  return {
    fire: (module: string, action: string, payload?: Record<string, string | number | boolean | null>) => {
      // Intentionally not awaited — UI responsiveness > audit ack latency.
      m.mutate({ module, action, payload });
    },
    isPending: m.isPending,
  };
}
