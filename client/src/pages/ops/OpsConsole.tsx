/*
 * IO SKY — Technical Operator Console (Milestone 2 §2.5).
 *
 * A deliberately small, standalone shell — NOT AdminLayout. AdminLayout's
 * sidebar links to 21 sections that are almost all gated by `adminProcedure`
 * (leads, billing, documents, clients...), none of which a technical_operator
 * is allowed to reach (server/_core/trpc.ts's opsProcedure is a distinct
 * gate, not an admin subset). Reusing that shell would either show a wall of
 * broken/forbidden links or require silently widening this role's access —
 * both wrong. This page only surfaces what `server/routers/ops.ts` actually
 * grants: infra health, email delivery health, and the Security Center
 * investigation/acknowledge workflow.
 *
 * Admin/super_admin can also open this page (opsProcedure accepts them too)
 * for a fast infra-only view without wading through the full admin console.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useRouteGuard } from "@/_core/hooks/useRouteGuard";
import { getLoginUrl } from "@/const";
import {
  Loader2,
  ServerCog,
  Mail,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

function isOpsRole(role: string | null | undefined): boolean {
  return role === "technical_operator" || role === "admin" || role === "super_admin";
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof ServerCog;
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "bad"
          ? "text-red-300"
          : "text-[#E6EAF0]";
  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-white/55 text-[11px] font-mono uppercase tracking-[0.16em] mb-2">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`text-[26px] font-display font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

const SEVERITY_TONE: Record<string, string> = {
  info: "text-white/60 border-white/[0.12]",
  warn: "text-amber-300 border-amber-400/30",
  high: "text-orange-300 border-orange-400/30",
  critical: "text-red-300 border-red-400/40",
};

export default function OpsConsole() {
  const [location] = useLocation();
  const { user, loading, isAuthenticated } = useRouteGuard();
  const [ackBusy, setAckBusy] = useState<number | null>(null);

  const enabled = isAuthenticated && isOpsRole(user?.role);

  const health = trpc.ops.systemHealth.useQuery(undefined, { enabled, refetchInterval: 60_000 });
  const emailLog = trpc.ops.emailDeliveryLog.useQuery(undefined, { enabled });
  const securityEvents = trpc.ops.securityEvents.useQuery(undefined, { enabled });
  const utils = trpc.useUtils();
  const acknowledge = trpc.ops.acknowledgeSecurityEvent.useMutation({
    onSuccess: () => {
      utils.ops.securityEvents.invalidate();
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1020] text-white/70">
        <Loader2 className="w-5 h-5 animate-spin mr-3" /> Verifying session…
      </div>
    );
  }
  if (!isAuthenticated) {
    window.location.href = getLoginUrl(location);
    return null;
  }
  if (!isOpsRole(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1020] text-white/70 px-6 text-center">
        <div>
          <ShieldAlert className="w-8 h-8 mx-auto mb-3 text-red-300" />
          <p className="text-[15px]">This console is restricted to Technical Operator and admin accounts.</p>
        </div>
      </div>
    );
  }

  const h = health.data;
  const failedPct =
    h && h.email.sent24h > 0 ? Math.round((h.email.failed24h / h.email.sent24h) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#E6EAF0]">
      <header className="border-b border-white/[0.06] bg-[#080C18]/90 backdrop-blur-xl px-5 lg:px-7 py-4 flex items-center gap-3">
        <ServerCog className="w-5 h-5 text-[#FF6A00]" />
        <div>
          <h1 className="font-display font-semibold text-[18px]">Technical Operator Console</h1>
          <p className="text-[11.5px] text-white/50">
            Infrastructure &amp; security visibility only — no customer, billing, or document data lives here.
          </p>
        </div>
        <button
          onClick={() => {
            health.refetch();
            emailLog.refetch();
            securityEvents.refetch();
          }}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-white/[0.08] text-[12px] text-white/75 hover:text-white hover:border-[#FF6A00]/40 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${health.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <main className="px-5 lg:px-7 py-6 max-w-[1200px] mx-auto space-y-6">
        {/* Infra health strip */}
        <section>
          <h2 className="text-[13px] font-mono uppercase tracking-[0.16em] text-white/50 mb-3">System Health (24h)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Mail} label="Emails Sent" value={h?.email.sent24h ?? "—"} />
            <StatCard
              icon={AlertTriangle}
              label="Email Failures"
              value={h ? `${h.email.failed24h} (${failedPct}%)` : "—"}
              tone={h && h.email.failed24h > 0 ? "warn" : "good"}
            />
            <StatCard
              icon={ShieldAlert}
              label="Failed Logins"
              value={h?.failedLogins24h ?? "—"}
              tone={h && h.failedLogins24h > 0 ? "warn" : "good"}
            />
            <StatCard
              icon={KeyRound}
              label="MFA Enrollment"
              value={h ? `${h.mfa.mfaEnrolledPct}%` : "—"}
              tone={h && h.mfa.mfaEnrolledPct >= 80 ? "good" : "neutral"}
            />
          </div>
          {h && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["info", "warn", "high", "critical"] as const).map((sev) => (
                <span
                  key={sev}
                  className={`text-[11px] font-mono uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border ${SEVERITY_TONE[sev]}`}
                >
                  {sev}: {h.securityEvents24h[sev]}
                </span>
              ))}
            </div>
          )}
          {h?.source === "unavailable" && (
            <p className="mt-2 text-[11.5px] text-amber-300/80">Database unreachable — showing zeros, not an error state.</p>
          )}
        </section>

        {/* Security Center */}
        <section>
          <h2 className="text-[13px] font-mono uppercase tracking-[0.16em] text-white/50 mb-3">Security Center — Recent Events</h2>
          <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-white/45 text-[10.5px] font-mono uppercase tracking-[0.14em] border-b border-white/[0.06]">
                  <th className="px-4 py-2.5">Severity</th>
                  <th className="px-4 py-2.5">Kind</th>
                  <th className="px-4 py-2.5">Message</th>
                  <th className="px-4 py-2.5">IP</th>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {(securityEvents.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-white/40">
                      {securityEvents.isLoading ? "Loading…" : "No security events recorded."}
                    </td>
                  </tr>
                ) : (
                  (securityEvents.data ?? []).map((ev: any) => (
                    <tr key={ev.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-2.5">
                        <span className={`text-[10.5px] font-mono uppercase px-1.5 py-0.5 rounded border ${SEVERITY_TONE[ev.severity] ?? SEVERITY_TONE.info}`}>
                          {ev.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-white/75">{ev.kind}</td>
                      <td className="px-4 py-2.5 text-white/60">{ev.message}</td>
                      <td className="px-4 py-2.5 text-white/50 font-mono text-[11.5px]">{ev.ip ?? "—"}</td>
                      <td className="px-4 py-2.5 text-white/45 text-[11.5px]">
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {ev.acknowledgedAt ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300 text-[11.5px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed
                          </span>
                        ) : (
                          <button
                            disabled={ackBusy === ev.id}
                            onClick={async () => {
                              setAckBusy(ev.id);
                              try {
                                await acknowledge.mutateAsync({ eventId: ev.id });
                              } finally {
                                setAckBusy(null);
                              }
                            }}
                            className="text-[11.5px] px-2.5 py-1 rounded-md border border-white/[0.1] text-white/75 hover:text-white hover:border-[#FF6A00]/40 disabled:opacity-50 transition-colors"
                          >
                            {ackBusy === ev.id ? "Acknowledging…" : "Acknowledge"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Email delivery health */}
        <section>
          <h2 className="text-[13px] font-mono uppercase tracking-[0.16em] text-white/50 mb-3">Email Delivery Log</h2>
          <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-white/45 text-[10.5px] font-mono uppercase tracking-[0.14em] border-b border-white/[0.06]">
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Transport</th>
                  <th className="px-4 py-2.5">Recipient</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">When</th>
                </tr>
              </thead>
              <tbody>
                {(emailLog.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-white/40">
                      {emailLog.isLoading ? "Loading…" : "No email delivery activity recorded."}
                    </td>
                  </tr>
                ) : (
                  (emailLog.data ?? []).slice(0, 50).map((row: any) => (
                    <tr key={row.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-2.5 text-white/75">{row.messageType}</td>
                      <td className="px-4 py-2.5 text-white/55 font-mono text-[11.5px]">{row.transport}</td>
                      <td className="px-4 py-2.5 text-white/60">{row.recipient}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            row.status === "delivered" || row.status === "sent"
                              ? "text-emerald-300"
                              : row.status === "bounced" || row.status === "complained" || row.status === "failed"
                                ? "text-red-300"
                                : "text-white/60"
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-white/45 text-[11.5px]">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
