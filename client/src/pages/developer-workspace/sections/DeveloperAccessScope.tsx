/*
 * IO SKY — Developer Workspace · Access Scope.
 *
 * Read-only view of the developer's current access envelope:
 *   - level (baseline / extended / elevated),
 *   - allowed actions and allowed sidebar routes,
 *   - start + expiry,
 *   - status.
 *
 * Plus a single user action: request a scope extension. The extension
 * runs through `developer.requestAccessExtension`, audits the row, and
 * pings the IO SKY engineering desk. Approving/extending happens admin-
 * side; this surface only lets the developer ASK.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "@/pages/client-portal/components/PortalUI";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Send } from "lucide-react";

function fmt(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function DeveloperAccessScope() {
  const utils = trpc.useUtils();
  const gateQuery = trpc.developer.gateStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [reason, setReason] = useState("");

  const requestExtension = trpc.developer.requestAccessExtension.useMutation({
    onSuccess: () => {
      toast.success("Extension request sent to engineering desk");
      setReason("");
      utils.developer.gateStatus.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not submit request");
    },
  });

  const scope = gateQuery.data?.scope;
  const allowedActions = (scope?.allowedActions ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedRoutes = (scope?.allowedRoutes ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div>
      <SectionHeader
        eyebrow="Permissions"
        title="Access scope"
        description="The exact access envelope set by the IO SKY engineering desk: level, allowed actions, allowed routes, and expiry."
      />

      <SectionStateSwitch
        loading={gateQuery.isLoading}
        error={gateQuery.error}
        onRetry={() => gateQuery.refetch()}
        data={scope ?? null}
        isEmpty={(d) => d == null}
        emptyIcon={<ShieldCheck className="h-5 w-5" />}
        emptyTitle="No access scope assigned"
        emptyBody="Your account isn't bound to an access scope yet. The engineering desk will provision one when you're staffed onto a project."
        skeletonRows={2}
      />

      {scope && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlassCard className="p-5 lg:col-span-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="border-orange-500/40 bg-orange-500/10 text-orange-200 text-[10px] uppercase tracking-wider"
              >
                {scope.level}
              </Badge>
              <StatusPill
                status={scope.status}
                variant={
                  scope.status === "active"
                    ? "good"
                    : scope.status === "expired"
                      ? "warn"
                      : "danger"
                }
              />
            </div>
            <h3 className="mt-3 text-base font-semibold text-white">
              Current envelope
            </h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span className="text-white/55">Started</span>
                <span className="text-white/85">{fmt(scope.startMs)}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span className="text-white/55">Expires</span>
                <span className="text-white/85">{fmt(scope.expiresMs)}</span>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-white/55">
                Allowed actions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {allowedActions.length === 0 ? (
                  <span className="text-xs text-white/45">
                    Inherits from access level (baseline read-only).
                  </span>
                ) : (
                  allowedActions.map((a) => (
                    <Badge
                      key={a}
                      variant="outline"
                      className="border-white/10 bg-white/[0.02] text-white/70 text-[10px] uppercase tracking-wider font-mono"
                    >
                      {a}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-white/55">
                Allowed routes
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {allowedRoutes.length === 0 ? (
                  <span className="text-xs text-white/45">
                    All sidebar routes (default for active scopes).
                  </span>
                ) : (
                  allowedRoutes.map((r) => (
                    <Badge
                      key={r}
                      variant="outline"
                      className="border-white/10 bg-white/[0.02] text-white/70 text-[10px] uppercase tracking-wider font-mono"
                    >
                      /{r}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Request an extension
            </h3>
            <p className="mt-1 text-xs text-white/55">
              Explain the scope or duration you need. Granting extensions is
              an engineering-desk decision; you'll get notified by email and
              in the workspace bell.
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you need extended access? (8+ characters)"
              maxLength={2000}
              rows={6}
              className="mt-3 bg-white/[0.02] border-white/10 text-white/90"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-white/40">
                {reason.length}/2000
              </span>
              <Button
                disabled={
                  reason.trim().length < 8 || requestExtension.isPending
                }
                onClick={() =>
                  requestExtension.mutate({ reason: reason.trim() })
                }
                className="bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-[0_0_18px_-8px_rgba(255,134,46,0.7)]"
              >
                {requestExtension.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-2">Send request</span>
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
