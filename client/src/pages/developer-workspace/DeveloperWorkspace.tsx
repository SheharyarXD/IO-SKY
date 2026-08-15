/*
 * IO SKY — Developer Workspace entry.
 *
 * This page is the hard role-gate for the developer surface. It mirrors
 * the ClientPortal pattern (auth → role → layout → section dispatch) but
 * adds the Workspace Gate before any section renders. Sections that need
 * to bypass the gate (e.g. /agreements when the gate is "agreements
 * required") declare their bypass list explicitly.
 */
import { useEffect } from "react";
import { Redirect, useLocation, useRoute } from "wouter";
import { useRouteGuard, recordAttemptProvider } from "@/_core/hooks/useRouteGuard";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import WorkspaceLayout from "./components/WorkspaceLayout";
import WorkspaceGate from "./components/WorkspaceGate";
import DeveloperOverview from "./sections/DeveloperOverview";
import DeveloperTasks from "./sections/DeveloperTasks";
import DeveloperFiles from "./sections/DeveloperFiles";
import DeveloperProjects from "./sections/DeveloperProjects";
import DeveloperSubmissions from "./sections/DeveloperSubmissions";
import DeveloperMessages from "./sections/DeveloperMessages";
import DeveloperAgreements from "./sections/DeveloperAgreements";
import DeveloperAccessScope from "./sections/DeveloperAccessScope";
import DeveloperProfile from "./sections/DeveloperProfile";
import DeveloperSecurity from "./sections/DeveloperSecurity";
import DeveloperSupport from "./sections/DeveloperSupport";
import PortalLoader from "@/pages/client-portal/components/PortalLoader";

const SECTIONS = [
  "",
  "overview",
  "projects",
  "tasks",
  "files",
  "submissions",
  "messages",
  "access-scope",
  "agreements",
  "profile",
  "security",
  "support",
] as const;

export default function DeveloperWorkspace() {
  const [, params] = useRoute("/developer-workspace/:section*");
  const [location] = useLocation();
  const { user, loading, isAuthenticated, isImpersonatingTarget, isAdminRole } = useRouteGuard();
  const rawSection =
    (params as Record<string, string | undefined> | null)?.["section*"] ?? "overview";
  const section = rawSection.split("/")[0] || "overview";

  // Audit every workspace mount so the engineering coordinator can see
  // who opened the workspace and which section. This intentionally fires
  // on every section change.
  const recordAttempt = trpc.auth.recordAttempt.useMutation();
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    recordAttempt.mutate({
      identifier: user.email ?? null,
      provider: recordAttemptProvider(user.loginMethod),
      outcome: "success",
      reason: `developer-workspace:${section || "overview"}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, section]);

  if (loading) return <PortalLoader />;
  if (!isAuthenticated) {
    window.location.href = getLoginUrl(location);
    return null;
  }

  // Impersonation breadcrumb (admin acting as developer).
  const impersonatingDeveloper = isImpersonatingTarget(user, "developer");

  // Hard role redirects (skip when impersonating).
  if (user?.role === "client") {
    return <Redirect to="/client-portal" replace />;
  }
  if (isAdminRole(user?.role) && !impersonatingDeveloper) {
    return <Redirect to="/admin" replace />;
  }
  if (user?.role !== "developer" && !impersonatingDeveloper) {
    // Render the layout shell with a permission-denied gate so the user
    // gets a calm explanatory state rather than a hard route bounce.
    return (
      <WorkspaceLayout
        userDisplayName={user?.name ?? user?.email ?? "Guest"}
        userEmail={user?.email ?? null}
      >
        <WorkspaceGate>{() => null}</WorkspaceGate>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout
      userDisplayName={user?.name ?? user?.email ?? "Engineer"}
      userEmail={user?.email ?? null}
    >
      <SectionSwitch section={section} />
    </WorkspaceLayout>
  );
}

function SectionSwitch({ section }: { section: string }) {
  const key = (SECTIONS as readonly string[]).includes(section) ? section : "overview";

  // Routes that *must* render even when the gate fails for that specific
  // reason — otherwise you couldn't sign agreements or set up MFA from
  // inside the workspace.
  switch (key) {
    case "overview":
    case "":
      return (
        <WorkspaceGate>
          {(g) => (
            <DeveloperOverview
              fullName={g.profile?.fullName ?? "Engineer"}
            />
          )}
        </WorkspaceGate>
      );

    case "agreements":
      return (
        <WorkspaceGate bypassReasons={["agreements_required", "no_assignments", "scope_expired"]}>
          {() => <DeveloperAgreements />}
        </WorkspaceGate>
      );

    case "security":
      return (
        <WorkspaceGate bypassReasons={["mfa_required", "no_assignments", "agreements_required", "scope_expired"]}>
          {() => <DeveloperSecurity />}
        </WorkspaceGate>
      );

    case "access-scope":
      return (
        <WorkspaceGate bypassReasons={["scope_expired", "no_assignments"]}>
          {() => <DeveloperAccessScope />}
        </WorkspaceGate>
      );

    case "support":
      return (
        <WorkspaceGate bypassReasons={["no_assignments", "agreements_required", "scope_expired", "mfa_required"]}>
          {() => <DeveloperSupport />}
        </WorkspaceGate>
      );

    case "projects":
      return (
        <WorkspaceGate>
          {() => <DeveloperProjects />}
        </WorkspaceGate>
      );

    case "tasks":
      return (
        <WorkspaceGate>
          {() => <DeveloperTasks />}
        </WorkspaceGate>
      );

    case "files":
      return (
        <WorkspaceGate>
          {() => <DeveloperFiles />}
        </WorkspaceGate>
      );

    case "submissions":
      return (
        <WorkspaceGate>
          {() => <DeveloperSubmissions />}
        </WorkspaceGate>
      );

    case "messages":
      return (
        <WorkspaceGate>
          {() => <DeveloperMessages />}
        </WorkspaceGate>
      );

    case "profile":
      return (
        <WorkspaceGate bypassReasons={["no_assignments", "agreements_required", "scope_expired"]}>
          {() => <DeveloperProfile />}
        </WorkspaceGate>
      );

    default:
      return (
        <WorkspaceGate>
          {(g) => (
            <DeveloperOverview
              fullName={g.profile?.fullName ?? "Engineer"}
            />
          )}
        </WorkspaceGate>
      );
  }
}
