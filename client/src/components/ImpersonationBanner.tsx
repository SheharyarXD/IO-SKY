/**
 * IO SKY — Impersonation banner.
 *
 * Sits at the very top of any portal whenever an admin is in
 * View-As mode. Shows the target role + reason + countdown, and
 * exposes a single Exit button that calls `DELETE /api/admin/view-as`.
 */
import { useEffect, useMemo, useState } from "react";
import { Eye, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

function fmtRemaining(ms: number) {
  if (ms <= 0) return "expired";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function ImpersonationBanner() {
  const { user, refresh } = useAuth();
  const impersonation = (user as any)?.impersonation as
    | { active: true; target: "client" | "developer"; reason: string; expiresAt: number }
    | null
    | undefined;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!impersonation) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [impersonation]);

  const remaining = useMemo(
    () => (impersonation ? impersonation.expiresAt - now : 0),
    [impersonation, now],
  );

  if (!impersonation) return null;

  const exit = async () => {
    try {
      await fetch("/api/admin/view-as", { method: "DELETE", credentials: "include" });
    } catch {
      /* ignore — we still try to refresh + redirect */
    }
    await refresh();
    // Double rAF: flush portal unmounts before hard navigation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.location.href = "/admin";
      });
    });
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-[#FF6A00] via-[#FF7A1A] to-[#FF6A00] text-white border-b border-amber-300/30">
      <div className="px-4 py-2 flex items-center gap-3 text-[12.5px] sm:text-[13px]">
        <span className="inline-flex items-center gap-2 font-medium">
          <Eye className="w-4 h-4" />
          Viewing as {impersonation.target}
        </span>
        <span className="hidden sm:inline text-white/80 font-mono text-[11.5px] truncate">
          {impersonation.reason}
        </span>
        <span className="ml-auto inline-flex items-center gap-3 font-mono text-[11.5px]">
          <span className="hidden md:inline text-white/85">expires in {fmtRemaining(remaining)}</span>
          <button
            onClick={exit}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/30 hover:border-white/60 bg-white/10 hover:bg-white/20 px-2.5 py-1 transition-colors duration-150 ease-out"
            style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
          >
            <X className="w-3.5 h-3.5" />
            Exit View-As
          </button>
        </span>
      </div>
    </div>
  );
}
