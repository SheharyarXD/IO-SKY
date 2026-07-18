/*
 * IO SKY — Admin Portal · "My Security (MFA)" section.
 *
 * This is the ADMIN OPERATOR's own account-security surface (distinct from the
 * "Security Monitoring" module which shows tenant-wide events). Admins had no
 * MFA-enrollment path before; this section reuses the shared `mfa.*` tRPC
 * procedures and the same TOTP / SMS enrollment dialogs used by the developer
 * workspace, so admins can:
 *
 *   - enroll an authenticator app (TOTP) or SMS factor
 *   - list / set-primary / remove factors
 *   - regenerate single-use recovery codes
 *   - sign out of the current session
 *
 * All crypto + audit happen server-side. The badge is intentionally NOT
 * "sample data" — this surface is fully live.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OperationalPage, { SideCard } from "./_shared/OperationalPage";
import { TOTPEnrollDialog } from "@/pages/developer-workspace/components/TOTPEnrollDialog";
import { SMSEnrollDialog } from "@/pages/developer-workspace/components/SMSEnrollDialog";

function formatTs(value: unknown): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AdminSecurityCenter() {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();
  const factorsQuery = trpc.mfa.listFactors.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [smsEnrollOpen, setSmsEnrollOpen] = useState(false);
  const [freshRecoveryCodes, setFreshRecoveryCodes] = useState<string[] | null>(null);

  const deleteFactor = trpc.mfa.deleteFactor.useMutation({
    onSuccess: async () => {
      toast.success("Factor removed");
      await utils.mfa.listFactors.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Could not remove factor"),
  });

  const setPrimary = trpc.mfa.setPrimaryFactor.useMutation({
    onSuccess: async () => {
      toast.success("Primary factor updated");
      await utils.mfa.listFactors.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Could not update primary"),
  });

  const regenerateCodes = trpc.mfa.regenerateRecoveryCodes.useMutation({
    onSuccess: (out) => {
      setFreshRecoveryCodes(out.recoveryCodes);
      toast.success("New recovery codes generated");
    },
    onError: (err) => toast.error(err.message ?? "Could not regenerate"),
  });

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("Signed out");
      window.location.href = getLoginUrl();
    },
    onError: (err) => toast.error(err.message ?? "Could not sign out"),
  });

  const mfaMethod = (meQuery.data as { mfaMethod?: string } | undefined)?.mfaMethod ?? "none";
  const factors = factorsQuery.data ?? [];
  const verifiedCount = factors.filter((f: any) => f.verifiedAt !== null).length;

  return (
    <>
      <OperationalPage
        eyebrow="Account security"
        title="My Security (MFA)"
        tagline="Protect your administrator account with a second factor. Add an authenticator app or SMS, manage factors, and store single-use recovery codes. All changes are audited."
        primary={
          <div className="space-y-5">
            {/* MFA status + actions */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[10.5px] uppercase tracking-[0.16em] " +
                  (verifiedCount > 0
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-400/40 bg-amber-400/10 text-amber-300")
                }
              >
                <ShieldCheck className="w-3 h-3" />
                {verifiedCount > 0
                  ? `${verifiedCount} verified factor${verifiedCount === 1 ? "" : "s"}`
                  : "No second factor yet"}
              </span>
              {mfaMethod !== "none" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.1] bg-white/[0.03] font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/70">
                  primary: {mfaMethod}
                </span>
              ) : null}
            </div>

            <div>
              <h3 className="text-[15px] font-medium text-white">
                Multi-factor authentication
              </h3>
              <p className="mt-1 text-[13px] text-white/60 leading-relaxed max-w-[640px]">
                MFA is strongly recommended for every administrator. Enroll at
                least one authenticator app and save your recovery codes in a
                password manager.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setEnrollOpen(true)}>
                <Smartphone className="h-3.5 w-3.5" />
                <span className="ml-2">Add authenticator app</span>
              </Button>
              <Button variant="outline" onClick={() => setSmsEnrollOpen(true)}>
                <Smartphone className="h-3.5 w-3.5" />
                <span className="ml-2">Add SMS</span>
              </Button>
              <Button
                variant="outline"
                disabled={regenerateCodes.isPending}
                onClick={() => regenerateCodes.mutate()}
              >
                {regenerateCodes.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5" />
                )}
                <span className="ml-2">Regenerate recovery codes</span>
              </Button>
            </div>

            {freshRecoveryCodes && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
                <div className="flex items-center gap-2 text-emerald-200 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  Save these recovery codes
                </div>
                <p className="text-xs text-emerald-100/80 mt-1">
                  They will not be shown again. Previous codes are now invalid.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px] text-white/85">
                  {freshRecoveryCodes.map((c) => (
                    <code key={c} className="select-all">
                      {c}
                    </code>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(freshRecoveryCodes.join("\n"));
                        toast.success("Recovery codes copied");
                      } catch {
                        toast.error("Clipboard unavailable — copy manually");
                      }
                    }}
                  >
                    Copy codes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFreshRecoveryCodes(null)}
                  >
                    I saved them
                  </Button>
                </div>
              </div>
            )}

            {/* Factor list */}
            <div className="border-t border-white/[0.06] pt-4">
              <h3 className="text-[14px] font-medium text-white">Authenticator factors</h3>
              <p className="mt-1 text-[12px] text-white/55">
                The primary factor is the one challenged at login.
              </p>
              <div className="mt-3">
                {factorsQuery.isLoading ? (
                  <div className="py-6 text-center text-[12.5px] text-white/55">
                    <Loader2 className="inline h-4 w-4 animate-spin" /> Loading factors…
                  </div>
                ) : factors.length === 0 ? (
                  <div className="py-8 text-center text-[12.5px] text-white/55">
                    No authenticator factors yet. Add one above to harden your account.
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {factors.map((f: any) => (
                      <li
                        key={f.id}
                        className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <Smartphone className="h-4 w-4 text-white/55" />
                          <div className="min-w-0">
                            <div className="text-white/85 truncate">
                              {f.label ?? "Authenticator"}
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-white/45">
                                {f.kind}
                              </span>
                            </div>
                            <div className="text-[11px] text-white/45">
                              {f.verifiedAt
                                ? `verified ${formatTs(f.verifiedAt)}`
                                : "pending verification"}
                              {f.lastUsedAt ? ` · last used ${formatTs(f.lastUsedAt)}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {f.primary ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] border border-emerald-500/25 bg-emerald-500/12 text-emerald-300 text-[10.5px] font-mono uppercase tracking-[0.14em]">
                              primary
                            </span>
                          ) : (
                            f.verifiedAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={setPrimary.isPending}
                                onClick={() => setPrimary.mutate({ factorId: f.id })}
                              >
                                <Star className="h-3.5 w-3.5" />
                                <span className="ml-2">Make primary</span>
                              </Button>
                            )
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={deleteFactor.isPending}
                            onClick={() => deleteFactor.mutate({ factorId: f.id })}
                            className="border-white/15 bg-white/[0.03] text-white/85 hover:bg-rose-500/10 hover:text-rose-200 hover:border-rose-500/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        }
        aside={
          <>
            <SideCard title="Account">
              <ul className="space-y-2.5 text-[12.5px] text-white/85">
                <li className="flex items-center justify-between">
                  <span className="text-white/55">Email</span>
                  <span className="truncate">{meQuery.data?.email ?? "—"}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-white/55">Role</span>
                  <span className="capitalize">{meQuery.data?.role ?? "—"}</span>
                </li>
              </ul>
            </SideCard>
            <SideCard title="Session">
              <p className="text-[12px] text-white/60 leading-relaxed">
                Sign out of this device. You will be returned to the login page.
              </p>
              <Button
                variant="outline"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
                className="mt-3 w-full border-white/15 bg-white/[0.03] text-white/85 hover:bg-rose-500/10 hover:text-rose-200 hover:border-rose-500/40"
              >
                {logout.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                <span className="ml-2">Sign out</span>
              </Button>
            </SideCard>
            <SideCard title="Why this matters">
              <div className="flex items-start gap-2 text-[12px] text-white/65 leading-relaxed">
                <Lock className="h-3.5 w-3.5 mt-0.5 text-orange-300 shrink-0" />
                <span>
                  Administrator accounts hold the highest privileges in the
                  platform. A second factor blocks account takeover even if a
                  password is compromised.
                </span>
              </div>
            </SideCard>
          </>
        }
      />

      <TOTPEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onEnrolled={() => {
          utils.auth.me.invalidate();
          utils.mfa.listFactors.invalidate();
        }}
      />
      <SMSEnrollDialog
        open={smsEnrollOpen}
        onOpenChange={setSmsEnrollOpen}
        onEnrolled={() => {
          utils.auth.me.invalidate();
          utils.mfa.listFactors.invalidate();
        }}
      />
    </>
  );
}
