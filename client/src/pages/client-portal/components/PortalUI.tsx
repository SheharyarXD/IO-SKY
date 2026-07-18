/*
 * IO SKY — Client Portal shared UI primitives.
 * Glass cards, section headers, premium empty states.
 */
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 md:mb-9 flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/90">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-2xl md:text-[28px] font-semibold tracking-tight text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-white/55 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function GlassCard({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <Card
      className={cn(
        "border-white/8 bg-gradient-to-br from-[#0c1424]/70 to-[#0a1020]/70 backdrop-blur-md text-white",
        "shadow-[0_18px_60px_-30px_rgba(0,0,0,0.7)]",
        interactive &&
          "transition-all duration-200 hover:border-orange-500/30 hover:shadow-[0_0_30px_-10px_rgba(255,134,46,0.4)]",
        className,
      )}
    >
      {children}
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <GlassCard className="p-10 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-300">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 mx-auto max-w-md text-sm text-white/55">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </GlassCard>
  );
}

export function PortalSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-xl border border-white/5 bg-white/[0.03] animate-pulse"
        />
      ))}
    </div>
  );
}

export function StatusPill({
  status,
  variant = "neutral",
}: {
  status: string;
  variant?: "neutral" | "good" | "warn" | "info" | "danger";
}) {
  const map: Record<string, string> = {
    neutral: "border-white/15 bg-white/[0.04] text-white/70",
    good: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    warn: "border-orange-400/40 bg-orange-500/10 text-orange-200",
    info: "border-sky-400/30 bg-sky-500/10 text-sky-200",
    danger: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        map[variant],
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}


export function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
  retryLabel = "Try again",
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <GlassCard className="p-10 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 ring-1 ring-rose-400/30 text-rose-200">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      {body && <p className="mt-2 mx-auto max-w-md text-sm text-white/55">{body}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white/85 hover:border-orange-400/40 hover:text-orange-200 transition-colors"
        >
          {retryLabel}
        </button>
      )}
    </GlassCard>
  );
}

export function PermissionDenied({
  title = "Restricted area",
  body = "Your account doesn't have access to this section. If you believe this is a mistake, please contact your account manager.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <GlassCard className="p-10 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-400/30 text-amber-200">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 mx-auto max-w-md text-sm text-white/55">{body}</p>
    </GlassCard>
  );
}

/**
 * SectionStateSwitch — single component that renders the right state card
 * (loading / error / empty / permission-denied) so every portal section can
 * stay visually consistent without duplicating logic.
 *
 * `permissionDenied` short-circuits everything else.
 * `error` renders ErrorState; `loading && !data` renders PortalSkeleton; if
 * `data` is empty (length 0 / null / undefined / handled by predicate),
 * EmptyState renders. Otherwise it returns null and the caller renders the
 * data list itself.
 */
export function SectionStateSwitch<T>({
  permissionDenied,
  loading,
  error,
  onRetry,
  data,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyBody,
  emptyAction,
  skeletonRows = 4,
}: {
  permissionDenied?: boolean;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  data?: T;
  isEmpty?: (data: T) => boolean;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
  skeletonRows?: number;
}): ReactNode | null {
  if (permissionDenied) {
    return <PermissionDenied />;
  }
  if (error) {
    const errMsg =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "Unable to load this section. Please try again.";
    return <ErrorState body={errMsg} onRetry={onRetry} />;
  }
  if (loading && !data) {
    return <PortalSkeleton rows={skeletonRows} />;
  }
  if (data !== undefined && data !== null && isEmpty && isEmpty(data)) {
    return (
      <EmptyState
        icon={emptyIcon ?? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M3 7h18M3 12h18M3 17h18" />
          </svg>
        )}
        title={emptyTitle ?? "Nothing here yet"}
        body={emptyBody ?? "New items will show up here as soon as they're available."}
        action={emptyAction}
      />
    );
  }
  return null;
}
