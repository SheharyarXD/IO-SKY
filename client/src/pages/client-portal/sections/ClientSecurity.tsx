/*
 * IO SKY \u2014 Client Portal \u00b7 Security Center
 *
 * What this view does:
 *   \u2022 Surfaces the authentication posture (provider, MFA, encryption).
 *   \u2022 Lets the client enable or disable e-mail MFA via
 *     trpc.clientPortal.setMfaMethod (audited, tenant-scoped).
 *   \u2022 Lets the client sign out of this device or revoke every session via
 *     trpc.clientPortal.revokeSession (audited, then redirects to login).
 *   \u2022 Renders the recent login audit timeline returned by
 *     trpc.clientPortal.security.
 */
import { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  GlassCard,
  PortalSkeleton,
  SectionHeader,
  StatusPill,
} from "../components/PortalUI";
import { getLoginUrl } from "@/const";

export default function ClientSecurity() {
  const utils = trpc.useUtils();
  const security = trpc.clientPortal.security.useQuery();
  const data = security.data;

  const [confirmRevoke, setConfirmRevoke] = useState<null | {
    everywhere: boolean;
  }>(null);

  const setMfa = trpc.clientPortal.setMfaMethod.useMutation({
    onSuccess: out => {
      toast.success(
        out.method === "email"
          ? "E-mail MFA enabled"
          : "E-mail MFA disabled",
        {
          description:
            out.method === "email"
              ? "We'll e-mail you a one-time code on every new sign-in."
              : "Multi-factor protection is now off for this account.",
        },
      );
      utils.clientPortal.security.invalidate();
    },
    onError: err =>
      toast.error("Couldn't update MFA", {
        description: err.message ?? "Please try again.",
      }),
  });

  const revoke = trpc.clientPortal.revokeSession.useMutation({
    onSuccess: out => {
      toast.success(
        out.everywhere
          ? "Signed out of every device"
          : "Signed out of this device",
        {
          description: "Redirecting you to the login screen\u2026",
        },
      );
      // Give the toast a tick to render before navigating away.
      setTimeout(() => {
        window.location.href = getLoginUrl();
      }, 700);
    },
    onError: err =>
      toast.error("Couldn't revoke session", {
        description: err.message ?? "Please try again.",
      }),
  });

  const mfaActive = (data?.mfaMethod ?? null) && data?.mfaMethod !== "none";

  return (
    <>
      <SectionHeader
        eyebrow="Security"
        title="Security Center"
        description="Authentication posture, multi-factor status and recent access events for your account."
      />

      {/* Posture cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <GlassCard className="p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Authentication
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 ring-1 ring-orange-500/30 flex items-center justify-center text-orange-300">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Manus OAuth</p>
              <p className="text-[11px] text-white/55">Single sign-on enabled</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              Multi-factor
            </p>
            <StatusPill
              status={mfaActive ? "active" : "off"}
              variant={mfaActive ? "good" : "warn"}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center ring-1 ${
                mfaActive
                  ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-300"
                  : "bg-white/[0.04] ring-white/15 text-white/55"
              }`}
            >
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white capitalize">
                {data?.mfaMethod && data.mfaMethod !== "none"
                  ? data.mfaMethod
                  : "Not configured"}
              </p>
              <p className="text-[11px] text-white/55">
                {mfaActive
                  ? "Active on every new sign-in"
                  : "Add a one-time code on top of SSO"}
              </p>
            </div>
          </div>
          <div className="mt-4">
            {mfaActive ? (
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 text-white/80 hover:text-white hover:border-orange-400/40"
                disabled={setMfa.isPending}
                onClick={() => setMfa.mutate({ method: "none" })}
              >
                {setMfa.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <ShieldOff className="h-3.5 w-3.5 mr-2" />
                )}
                Disable MFA
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
                disabled={setMfa.isPending}
                onClick={() => setMfa.mutate({ method: "email" })}
              >
                {setMfa.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                )}
                Enable e-mail MFA
              </Button>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Encryption
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-sky-500/10 ring-1 ring-sky-500/30 flex items-center justify-center text-sky-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">AES-256 at rest</p>
              <p className="text-[11px] text-white/55">TLS 1.3 in transit</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Session controls */}
      <GlassCard className="p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              Active session
            </p>
            <h3 className="text-base font-semibold text-white mt-1">
              Sign out of IO SKY
            </h3>
            <p className="text-sm text-white/60 mt-1 max-w-prose">
              Revoking signs you out immediately. \u201cEverywhere\u201d will also
              terminate any other open IO SKY sessions on other devices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 text-white/80 hover:text-white hover:border-orange-400/40"
              onClick={() => setConfirmRevoke({ everywhere: false })}
              disabled={revoke.isPending}
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sign out
            </Button>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
              onClick={() => setConfirmRevoke({ everywhere: true })}
              disabled={revoke.isPending}
            >
              <ShieldOff className="h-3.5 w-3.5 mr-2" />
              Revoke everywhere
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Recent access events */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Recent access events
          </p>
          <p className="text-sm text-white/65 mt-1">
            Login attempts and portal access for your account.
          </p>
        </div>
        {security.isLoading ? (
          <div className="p-5">
            <PortalSkeleton rows={4} />
          </div>
        ) : security.error ? (
          <div className="p-6">
            <p className="text-sm text-red-300/90">
              Couldn't load access events. Please retry.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-white/15 text-white/80"
              onClick={() => security.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (data?.recentLogins ?? []).length === 0 ? (
          <p className="px-5 py-8 text-sm text-white/55">
            No access events recorded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.18em] text-white/45">
              <tr>
                <th className="px-5 py-3 text-left">When</th>
                <th className="px-5 py-3 text-left">Provider</th>
                <th className="px-5 py-3 text-left">Outcome</th>
                <th className="px-5 py-3 text-left">Reason</th>
                <th className="px-5 py-3 text-left">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(data?.recentLogins ?? []).map(ev => (
                <tr key={ev.id} className="hover:bg-orange-500/[0.04]">
                  <td className="px-5 py-3 text-white/80">
                    {new Date(ev.createdAt as unknown as string).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-white/65 capitalize">
                    {ev.provider}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill
                      status={ev.outcome}
                      variant={
                        ev.outcome === "success"
                          ? "good"
                          : ev.outcome === "failure"
                            ? "danger"
                            : "info"
                      }
                    />
                  </td>
                  <td className="px-5 py-3 text-white/55">{ev.reason ?? "\u2014"}</td>
                  <td className="px-5 py-3 text-white/45 font-mono text-xs">
                    {ev.ip ?? "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          "End-to-end encryption",
          "security-first practices",
          "GDPR compliant",
          "24/7 monitoring",
        ].map(label => (
          <GlassCard key={label} className="p-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            <span className="text-sm text-white/80">{label}</span>
          </GlassCard>
        ))}
      </div>

      <AlertDialog
        open={!!confirmRevoke}
        onOpenChange={open => !open && setConfirmRevoke(null)}
      >
        <AlertDialogContent className="bg-[#0a0f1d] border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmRevoke?.everywhere
                ? "Revoke every IO SKY session?"
                : "Sign out of this device?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/65">
              {confirmRevoke?.everywhere
                ? "All active IO SKY sessions across every device will be invalidated. You will be redirected to the login screen."
                : "You will be signed out of this browser only and redirected to the login screen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-transparent text-white/80 hover:bg-white/[0.04]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
              onClick={() => {
                const everywhere = !!confirmRevoke?.everywhere;
                setConfirmRevoke(null);
                revoke.mutate({ everywhere });
              }}
            >
              {confirmRevoke?.everywhere
                ? "Revoke everywhere"
                : "Sign out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
