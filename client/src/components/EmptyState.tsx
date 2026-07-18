/**
 * EmptyState — canonical empty/error/no-data state for IO SKY.
 *
 * Uses the `.io-empty-state` token defined in `index.css` so every surface
 * (admin modules, client portal, developer workspace, auth flow, MFA, etc.)
 * speaks the exact same visual language when there is nothing to show.
 */

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={["io-empty-state", className ?? ""].join(" ").trim()}
    >
      <div className="io-empty-icon" aria-hidden="true">
        {icon ?? <Inbox size={16} />}
      </div>
      <div className="font-display text-base text-ivory">{title}</div>
      {description ? (
        <p className="text-sm text-mute-1 max-w-md">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
