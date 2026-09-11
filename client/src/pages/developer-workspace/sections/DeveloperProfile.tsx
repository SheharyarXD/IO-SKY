/*
 * IO SKY — Developer Workspace · Profile & Availability.
 *
 * Editable form. Pulls profile from `gateStatus` (which already returns
 * the developer's own profile when role=developer) and lets the
 * developer update: full name, country, LinkedIn, GitHub, portfolio,
 * comma-separated specialties, and availability.
 *
 * Admin-owned fields (status, mfaRequired, approvedMs, …) are not in
 * scope here. Saving runs through `developer.updateProfile`, which is
 * audited server-side, with an extra admin notify when availability
 * changes (so engineering scheduling stays in sync).
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "@/pages/client-portal/components/PortalUI";
import { UserCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProfilePhoto } from "@/components/ProfilePhoto";

type Availability = "available" | "limited" | "unavailable";

type FormState = {
  fullName: string;
  country: string;
  linkedin: string;
  github: string;
  portfolio: string;
  specialties: string;
  availability: Availability;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  country: "",
  linkedin: "",
  github: "",
  portfolio: "",
  specialties: "",
  availability: "available",
};

export default function DeveloperProfile() {
  const utils = trpc.useUtils();
  const profileQuery = trpc.developer.getProfileForEdit.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });
  const meQuery = trpc.auth.me.useQuery();

  const profile = profileQuery.data ?? null;

  // Snapshot the server profile into local form state so we can detect
  // a dirty form and disable Save until the user actually changes
  // something.
  const initial: FormState = useMemo(
    () =>
      profile
        ? {
            fullName: profile.fullName ?? "",
            country: profile.country ?? "",
            linkedin: profile.linkedin ?? "",
            github: profile.github ?? "",
            portfolio: profile.portfolio ?? "",
            specialties: profile.specialties ?? "",
            availability: (profile.availability as Availability) ?? "available",
          }
        : EMPTY_FORM,
    [profile],
  );
  const [form, setForm] = useState<FormState>(initial);
  // Re-sync when the server returns a new profile (e.g. after Save).
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const dirty = useMemo(() => {
    return (
      form.fullName.trim() !== initial.fullName.trim() ||
      form.country.trim() !== initial.country.trim() ||
      form.linkedin.trim() !== initial.linkedin.trim() ||
      form.github.trim() !== initial.github.trim() ||
      form.portfolio.trim() !== initial.portfolio.trim() ||
      form.specialties.trim() !== initial.specialties.trim() ||
      form.availability !== initial.availability
    );
  }, [form, initial]);

  const update = trpc.developer.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Profile saved");
      await utils.developer.getProfileForEdit.invalidate();
      await utils.developer.gateStatus.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not save profile");
    },
  });

  const onSave = () => {
    if (!profile || !dirty) return;
    update.mutate({
      fullName: form.fullName.trim() || undefined,
      country: form.country.trim() ? form.country.trim() : null,
      linkedin: form.linkedin.trim() ? form.linkedin.trim() : null,
      github: form.github.trim() ? form.github.trim() : null,
      portfolio: form.portfolio.trim() ? form.portfolio.trim() : null,
      specialties: form.specialties.trim() ? form.specialties.trim() : null,
      availability: form.availability,
    });
  };

  return (
    <div>
      <SectionHeader
        eyebrow="You"
        title="Profile & availability"
        description="Your engineering profile as known to IO SKY. Availability changes are recorded and the engineering desk is notified so scheduling stays in sync."
      />

      <SectionStateSwitch
        loading={profileQuery.isLoading || meQuery.isLoading}
        error={profileQuery.error}
        onRetry={() => profileQuery.refetch()}
        data={profile}
        isEmpty={(d) => d == null}
        emptyIcon={<UserCircle2 className="h-5 w-5" />}
        emptyTitle="No developer profile"
        emptyBody="Your account is not yet bound to a developer profile. Contact engineering desk via Support to provision one."
        skeletonRows={3}
      />

      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlassCard className="p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill
                status={profile.status}
                variant={profile.status === "active" ? "good" : "danger"}
              />
              <StatusPill
                status={form.availability}
                variant={
                  form.availability === "available"
                    ? "good"
                    : form.availability === "limited"
                      ? "warn"
                      : "neutral"
                }
              />
            </div>

            <ProfilePhoto />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, country: e.target.value }))
                  }
                  maxLength={64}
                  placeholder="e.g. Netherlands"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="availability">Availability</Label>
                <Select
                  value={form.availability}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, availability: v as Availability }))
                  }
                >
                  <SelectTrigger id="availability">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="limited">Limited capacity</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={form.linkedin}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, linkedin: e.target.value }))
                  }
                  maxLength={320}
                  placeholder="https://linkedin.com/in/…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="github">GitHub</Label>
                <Input
                  id="github"
                  value={form.github}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, github: e.target.value }))
                  }
                  maxLength={320}
                  placeholder="https://github.com/…"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="portfolio">Portfolio</Label>
                <Input
                  id="portfolio"
                  value={form.portfolio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, portfolio: e.target.value }))
                  }
                  maxLength={320}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="specialties">Specialties</Label>
                <Input
                  id="specialties"
                  value={form.specialties}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, specialties: e.target.value }))
                  }
                  maxLength={320}
                  placeholder="ai, backend, enterprise-systems"
                />
                <p className="text-[11px] text-white/45">
                  Comma-separated tags. Used by engineering routing.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <div className="text-xs text-white/45">
                Account email: {meQuery.data?.email ?? "—"} · Role:{" "}
                <span className="capitalize">{meQuery.data?.role ?? "—"}</span>
              </div>
              <Button
                onClick={onSave}
                disabled={!dirty || update.isPending}
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              What this affects
            </h3>
            <p className="mt-2 text-xs text-white/60">
              Marking yourself <em>Limited</em> or <em>Unavailable</em> stops
              new assignments from being routed to you and notifies the
              engineering desk. Your existing assignments stay open until
              admins re-allocate them.
            </p>
            <p className="mt-3 text-xs text-white/60">
              Admin-owned fields (account status, MFA requirement,
              assignments, scope) cannot be modified here.
            </p>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
