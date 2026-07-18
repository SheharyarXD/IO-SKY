/*
 * IO SKY \u2014 Client Portal \u00b7 Account
 *
 * What this view does:
 *   \u2022 Lets the client edit only their display name (everything else is
 *     read-only because tenancy and e-mail belong to the OAuth identity).
 *   \u2022 Surfaces organization metadata pulled from the dashboard query.
 *   \u2022 Mounts the SectionStateSwitch around the org card so loading /
 *     error / permission states stay consistent with the rest of the
 *     portal.
 */
import { useEffect, useState } from "react";
import {
  Building2,
  Globe,
  IdCard,
  Loader2,
  Mail,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
} from "../components/PortalUI";

export default function ClientAccount() {
  const dashboard = trpc.clientPortal.dashboard.useQuery();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const org = dashboard.data?.organization;

  const [displayName, setDisplayName] = useState(user?.name ?? "");

  // Keep local state in sync when auth resolves after first paint.
  useEffect(() => {
    if (user?.name && !displayName) setDisplayName(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const update = trpc.clientPortal.updateDisplayName.useMutation({
    onSuccess: out => {
      toast.success("Profile updated", {
        description: `Display name is now \u201c${out.name}\u201d.`,
      });
      utils.auth.me.invalidate();
    },
    onError: err =>
      toast.error("Couldn't update profile", {
        description: err.message ?? "Please try again.",
      }),
  });

  const trimmedName = displayName.trim();
  const dirty =
    trimmedName.length >= 2 && trimmedName !== (user?.name ?? "").trim();

  return (
    <>
      <SectionHeader
        eyebrow="Account"
        title="Company & profile"
        description="Your organization details and personal profile. Tenancy and e-mail are managed by your IO SKY account manager."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard className="p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
            Your Profile
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="account-display-name"
                className="text-[10px] uppercase tracking-[0.18em] text-white/45"
              >
                Display name
              </label>
              <Input
                id="account-display-name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={120}
                className="mt-1 bg-white/[0.02] border-white/10 text-white placeholder:text-white/35"
              />
              <p className="mt-1 text-[10px] text-white/35">
                Shown on messages, audit logs, and exported deliverables.
              </p>
            </div>

            <ReadOnlyRow
              label="E-mail"
              value={user?.email ?? "\u2014"}
              icon={<Mail className="h-4 w-4" />}
              hint="Managed by Manus OAuth"
            />
            <ReadOnlyRow
              label="Role"
              value={user?.role ?? "\u2014"}
              icon={<IdCard className="h-4 w-4" />}
              mono
            />

            <Button
              onClick={() => update.mutate({ name: trimmedName })}
              disabled={!dirty || update.isPending}
              className="w-full bg-orange-500 hover:bg-orange-400 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {update.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {update.isPending ? "Saving\u2026" : "Save changes"}
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
            Organization
          </p>
          <div className="mt-4">
            <SectionStateSwitch
              loading={dashboard.isLoading}
              error={dashboard.error}
              onRetry={() => dashboard.refetch()}
              data={org ?? null}
              isEmpty={d => !d}
              emptyTitle="No organization linked"
              emptyBody="Ask your IO SKY account manager to link your tenancy."
              skeletonRows={3}
            />

            {!dashboard.isLoading && !dashboard.error && org && (
              <div className="space-y-3">
                <ReadOnlyRow
                  label="Company"
                  value={org.name ?? "\u2014"}
                  icon={<Building2 className="h-4 w-4" />}
                />
                <ReadOnlyRow
                  label="Industry"
                  value={(org as any).industry ?? "\u2014"}
                  icon={<Globe className="h-4 w-4" />}
                />
                <ReadOnlyRow
                  label="Operational Score"
                  value={
                    org.operationalScore
                      ? `${org.operationalScore}/100`
                      : "\u2014"
                  }
                  icon={<IdCard className="h-4 w-4" />}
                  mono
                />
                <ReadOnlyRow
                  label="Country"
                  value={(org as any).country ?? "\u2014"}
                  icon={<Globe className="h-4 w-4" />}
                />
                <ReadOnlyRow
                  label="Status"
                  value={org.statusLabel ?? "\u2014"}
                  icon={<IdCard className="h-4 w-4" />}
                />
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <p className="mt-6 text-[11px] text-white/40">
        Tenancy, e-mail, or company-level fields can only be changed by your
        IO SKY account manager. Send a secure message and we will apply the
        change after verification.
      </p>
    </>
  );
}

function ReadOnlyRow({
  label,
  value,
  icon,
  mono,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
      <div className="h-8 w-8 rounded-md bg-orange-500/10 ring-1 ring-orange-500/30 flex items-center justify-center text-orange-300 shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          {label}
          {hint && (
            <span className="ml-2 normal-case tracking-normal text-white/35">
              \u00b7 {hint}
            </span>
          )}
        </p>
        <p className={`text-sm text-white truncate ${mono ? "font-mono" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
