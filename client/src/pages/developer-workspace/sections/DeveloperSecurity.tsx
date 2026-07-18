/*
 * IO SKY — Developer Workspace · Security center.
 *
 * Step 3 iteration:
 *   - email-MFA quick toggle (kept from Step 2)
 *   - TOTP authenticator-app factors (list / add / set primary / remove)
 *   - 10 single-use recovery codes (regenerate)
 *   - audit timeline for the calling developer
 *   - sign-out action
 *
 * Full SMS factor + post-login challenge gate ship in Step 3c/3d.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "@/pages/client-portal/components/PortalUI";
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
import { toast } from "sonner";

import { SMSEnrollDialog } from "../components/SMSEnrollDialog";
import { TOTPEnrollDialog } from "../components/TOTPEnrollDialog";

function formatTs(value: unknown): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function DeveloperSecurity() {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();
  const gateQuery = trpc.developer.gateStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });
  const auditQuery = trpc.developer.listAuditEvents.useQuery(
    { limit: 25 },
    { refetchOnWindowFocus: false, retry: false },
  );
  const factorsQuery = trpc.mfa.listFactors.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [smsEnrollOpen, setSmsEnrollOpen] = useState(false);
  const [freshRecoveryCodes, setFreshRecoveryCodes] = useState<string[] | null>(
    null,
  );

  const setMfa = trpc.developer.setMfaMethodLite.useMutation({
    onSuccess: async () => {
      toast.success("Security preference saved");
      await utils.auth.me.invalidate();
      await utils.developer.listAuditEvents.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not update MFA");
    },
  });

  const deleteFactor = trpc.mfa.deleteFactor.useMutation({
    onSuccess: async () => {
      toast.success("Factor removed");
      await utils.mfa.listFactors.invalidate();
      await utils.developer.listAuditEvents.invalidate();
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
    onError: (err) => {
      toast.error(err.message ?? "Could not sign out");
    },
  });

  const mfaMethod =
    (meQuery.data as { mfaMethod?: string } | undefined)?.mfaMethod ?? "none";
  const mfaActive = mfaMethod !== "none";
  const mfaRequired = (gateQuery.data?.profile as any)?.mfaRequired === 1;
  const factors = factorsQuery.data ?? [];
  const verifiedCount = factors.filter((f: any) => f.verifiedAt !== null).length;

  return (
    <div>
      <SectionHeader
        eyebrow="Security"
        title="Security center"
        description="Account status, multi-factor authentication, recovery codes, audit trail, and session controls."
      />

      <SectionStateSwitch
        loading={meQuery.isLoading || gateQuery.isLoading}
        error={meQuery.error ?? gateQuery.error}
        onRetry={() => {
          meQuery.refetch();
          gateQuery.refetch();
        }}
        data={meQuery.data ?? null}
        isEmpty={(d) => d == null}
        emptyIcon={<ShieldCheck className="h-5 w-5" />}
        emptyTitle="No identity loaded"
        emptyBody="Refresh to retry."
        skeletonRows={2}
      />

      {meQuery.data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── MFA + Factors ── */}
          <GlassCard className="p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill
                status={mfaActive ? `mfa: ${mfaMethod}` : "mfa: not set"}
                variant={mfaActive ? "good" : "warn"}
              />
              {mfaRequired && (
                <StatusPill status="required" variant="danger" />
              )}
              {verifiedCount > 0 && (
                <StatusPill
                  status={`${verifiedCount} authenticator${
                    verifiedCount === 1 ? "" : "s"
                  }`}
                  variant="good"
                />
              )}
            </div>

            <div>
              <h3 className="text-base font-semibold text-white">
                Multi-factor authentication
              </h3>
              <p className="mt-1 text-sm text-white/60">
                {mfaRequired
                  ? "MFA is required for this developer account. It cannot be disabled."
                  : "MFA is optional for this account but strongly recommended."}
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

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
              <span className="text-xs text-white/55">Email factor (legacy):</span>
              <Button
                size="sm"
                variant={mfaMethod === "email" ? "default" : "outline"}
                disabled={setMfa.isPending || mfaMethod === "email"}
                onClick={() => setMfa.mutate({ method: "email" })}
              >
                Enable email MFA
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={setMfa.isPending || mfaRequired || mfaMethod === "none"}
                onClick={() => setMfa.mutate({ method: "none" })}
                className="border-white/15 bg-white/[0.03] text-white/85 hover:bg-rose-500/10 hover:text-rose-200 hover:border-rose-500/40"
              >
                Disable email MFA
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
                        await navigator.clipboard.writeText(
                          freshRecoveryCodes.join("\n"),
                        );
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-white/[0.06] pt-4">
              <div className="flex justify-between">
                <span className="text-white/55">Email</span>
                <span className="text-white/85 truncate">
                  {meQuery.data.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/55">Role</span>
                <span className="text-white/85 capitalize">
                  {meQuery.data.role}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* ── Session ── */}
          <GlassCard className="p-5 flex flex-col gap-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-300">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-white">
                Session
              </h3>
              <p className="mt-1 text-xs text-white/60">
                Sign out of this device. The post-login MFA challenge will
                land alongside the SMS factor.
              </p>
            </div>
            <Button
              variant="outline"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              className="border-white/15 bg-white/[0.03] text-white/85 hover:bg-rose-500/10 hover:text-rose-200 hover:border-rose-500/40"
            >
              {logout.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              <span className="ml-2">Sign out</span>
            </Button>
          </GlassCard>

          {/* ── Factor list ── */}
          <GlassCard className="p-5 lg:col-span-3">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Authenticator factors
            </h3>
            <p className="mt-1 text-xs text-white/55">
              Manage the second-factor devices linked to your account. The
              primary factor is the one challenged at login.
            </p>
            <div className="mt-3">
              <SectionStateSwitch
                loading={factorsQuery.isLoading}
                error={factorsQuery.error}
                onRetry={() => factorsQuery.refetch()}
                data={factors}
                isEmpty={(d) => (d?.length ?? 0) === 0}
                emptyIcon={<Smartphone className="h-5 w-5" />}
                emptyTitle="No authenticator factors yet"
                emptyBody="Add an authenticator app to harden your account."
                skeletonRows={2}
              />
              {factors.length > 0 && (
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
                            {f.lastUsedAt
                              ? ` · last used ${formatTs(f.lastUsedAt)}`
                              : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {f.primary ? (
                          <StatusPill status="primary" variant="good" />
                        ) : (
                          f.verifiedAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={setPrimary.isPending}
                              onClick={() =>
                                setPrimary.mutate({ factorId: f.id })
                              }
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
                          onClick={() =>
                            deleteFactor.mutate({ factorId: f.id })
                          }
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
          </GlassCard>

          {/* ── Audit timeline ── */}
          <GlassCard className="p-5 lg:col-span-3">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Audit timeline
            </h3>
            <p className="mt-1 text-xs text-white/55">
              The 25 most recent security-relevant events on your developer
              account. All entries are admin-visible too.
            </p>
            <div className="mt-3">
              <SectionStateSwitch
                loading={auditQuery.isLoading}
                error={auditQuery.error}
                onRetry={() => auditQuery.refetch()}
                data={auditQuery.data ?? []}
                isEmpty={(d) => (d?.length ?? 0) === 0}
                emptyIcon={<ShieldCheck className="h-5 w-5" />}
                emptyTitle="No audit events yet"
                emptyBody="Profile and security changes will appear here."
                skeletonRows={4}
              />
              {auditQuery.data && auditQuery.data.length > 0 && (
                <ul className="space-y-2 text-sm">
                  {auditQuery.data.map((row: any) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between border-b border-white/[0.05] pb-2"
                    >
                      <div>
                        <div className="text-white/85">{row.event}</div>
                        {row.detail && (
                          <div className="text-[11px] text-white/45">
                            {row.detail}
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-white/55 text-right">
                        <div>{formatTs(row.createdAt)}</div>
                        {row.ip && (
                          <div className="text-white/35">{row.ip}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      <TOTPEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onEnrolled={() => {
          // Encourage user to refetch identity since mfaMethod may surface
          // primary factor next.
          utils.auth.me.invalidate();
          utils.developer.listAuditEvents.invalidate();
        }}
      />

      <SMSEnrollDialog
        open={smsEnrollOpen}
        onOpenChange={setSmsEnrollOpen}
        onEnrolled={() => {
          utils.auth.me.invalidate();
          utils.developer.listAuditEvents.invalidate();
        }}
      />
    </div>
  );
}
