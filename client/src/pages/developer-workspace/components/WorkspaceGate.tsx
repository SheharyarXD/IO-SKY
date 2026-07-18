/*
 * IO SKY — Developer Workspace Gate.
 *
 * The Sidebar Logic Master requires a strict pre-work gate: developers do
 * not see assignments until MFA is enrolled, all required agreements are
 * signed, the access scope is active, and at least one assignment exists.
 *
 * This component reads the developer's `gateStatus` and renders one of the
 * five setup states: profile-pending, MFA setup, agreements signing, access
 * expired, or no-assignments. Each state ends in a CTA that drops the user
 * into the right sub-route. While `loading` is true we render a calm
 * skeleton — never the workspace shell — to prevent any flash of
 * unauthorised content.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  GlassCard,
  PortalSkeleton,
  ErrorState,
  PermissionDenied,
} from "@/pages/client-portal/components/PortalUI";
import {
  ShieldCheck,
  ScrollText,
  KeyRound,
  Hourglass,
  FolderKanban,
  PauseOctagon,
  UserCog,
} from "lucide-react";

type GateReason =
  | "ok"
  | "denied"
  | "no_profile"
  | "profile_suspended"
  | "mfa_required"
  | "agreements_required"
  | "scope_expired"
  | "no_assignments";

interface WorkspaceGateProps {
  /**
   * When true, the parent route guarantees this gate must always pass
   * (e.g. the agreements page wants to render even when agreements are
   * the *reason* for the gate failure). Pass the list of reasons that the
   * inner route is allowed to handle directly so the gate can fall through.
   */
  bypassReasons?: GateReason[];
  children: (gate: { profile: { fullName: string; availability: string | null } | null }) => ReactNode;
}

function GateCard({
  icon,
  eyebrow,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <GlassCard className="p-10 max-w-2xl mx-auto text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-300">
        {icon}
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/90">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-3 mx-auto max-w-md text-sm leading-relaxed text-white/55">
        {body}
      </p>
      <div className="mt-6 inline-flex items-center gap-3">
        {primaryHref && primaryLabel && (
          <Link href={primaryHref}>
            <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-[0_0_28px_-10px_rgba(255,134,46,0.7)]">
              {primaryLabel}
            </Button>
          </Link>
        )}
        {secondaryHref && secondaryLabel && (
          <Link href={secondaryHref}>
            <Button
              variant="outline"
              className="border-white/15 bg-white/[0.03] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
            >
              {secondaryLabel}
            </Button>
          </Link>
        )}
      </div>
    </GlassCard>
  );
}

export default function WorkspaceGate({ bypassReasons = [], children }: WorkspaceGateProps) {
  const status = trpc.developer.gateStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (status.isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <PortalSkeleton rows={4} />
      </div>
    );
  }

  if (status.error) {
    return (
      <ErrorState
        body={status.error.message ?? "Unable to load workspace status."}
        onRetry={() => status.refetch()}
      />
    );
  }

  const data = status.data;
  if (!data) {
    return (
      <ErrorState body="No workspace status returned." onRetry={() => status.refetch()} />
    );
  }

  // Non-developer roles → permission denied. The wrapping route should
  // also redirect, but this is the last line of defence in the UI.
  if (!data.ok && data.reason === "denied") {
    return <PermissionDenied />;
  }

  // If the inner route handles a specific gate failure (e.g. /agreements
  // pages handles agreements_required), short-circuit and render the
  // children with whatever profile we have.
  if (
    !data.ok &&
    bypassReasons.includes(data.reason as GateReason)
  ) {
    return <>{children({ profile: data.profile ?? null })}</>;
  }

  if (!data.ok) {
    switch (data.reason) {
      case "no_profile":
        return (
          <GateCard
            icon={<UserCog className="h-5 w-5" />}
            eyebrow="Workspace setup"
            title="Your engineering profile isn't ready yet"
            body="Once IO SKY provisions your developer profile you'll see your assignments, files, and tasks here. We've notified the engineering coordinator."
            secondaryHref="/developer-workspace/support"
            secondaryLabel="Contact engineering"
          />
        );
      case "profile_suspended":
        return (
          <GateCard
            icon={<PauseOctagon className="h-5 w-5" />}
            eyebrow="Access paused"
            title="Your developer access is paused"
            body="Your engineering coordinator has temporarily paused this workspace. Please reach out to confirm your status before continuing."
            secondaryHref="/developer-workspace/support"
            secondaryLabel="Contact engineering"
          />
        );
      case "mfa_required":
        return (
          <GateCard
            icon={<KeyRound className="h-5 w-5" />}
            eyebrow="Security"
            title="Multi-factor authentication required"
            body="The Developer Workspace can only be accessed once you've enabled multi-factor authentication on your account. This is a hard requirement and cannot be skipped."
            primaryHref="/developer-workspace/security"
            primaryLabel="Set up MFA"
          />
        );
      case "agreements_required":
        return (
          <GateCard
            icon={<ScrollText className="h-5 w-5" />}
            eyebrow="Agreements"
            title="A few documents need your signature"
            body="To unlock assignments and files, please review and sign the engineering agreements (NDA, confidentiality, non-solicitation, liability, and security policy)."
            primaryHref="/developer-workspace/agreements"
            primaryLabel="Review agreements"
          />
        );
      case "scope_expired":
        return (
          <GateCard
            icon={<Hourglass className="h-5 w-5" />}
            eyebrow="Access scope"
            title="Your workspace access has expired"
            body="Your access window has lapsed. You can request an extension and an admin will review it shortly."
            primaryHref="/developer-workspace/access-scope"
            primaryLabel="Request extension"
          />
        );
      case "no_assignments":
        return (
          <GateCard
            icon={<FolderKanban className="h-5 w-5" />}
            eyebrow="Assignments"
            title="You don't have any active assignments yet"
            body="Once IO SKY assigns you to a project you'll see it here, along with the related tasks, files, and submission flows."
            secondaryHref="/developer-workspace/support"
            secondaryLabel="Contact engineering"
          />
        );
      default:
        return (
          <GateCard
            icon={<ShieldCheck className="h-5 w-5" />}
            eyebrow="Workspace"
            title="Setup pending"
            body="Your workspace is being prepared. Please contact engineering if this state persists."
            secondaryHref="/developer-workspace/support"
            secondaryLabel="Contact engineering"
          />
        );
    }
  }

  return <>{children({ profile: data.profile ?? null })}</>;
}
