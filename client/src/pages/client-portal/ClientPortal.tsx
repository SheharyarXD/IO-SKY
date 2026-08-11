/*
 * IO SKY — Client Portal entry.
 * Role-gated shell. Renders the dark cinematic sidebar layout and dispatches
 * to the appropriate section page based on the URL.
 */
import { useEffect } from "react";
import { Redirect, useLocation, useRoute } from "wouter";
import { useRouteGuard, recordAttemptProvider } from "@/_core/hooks/useRouteGuard";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import ClientPortalLayout from "./components/ClientPortalLayout";
import ClientDashboard from "./sections/ClientDashboard";
import ClientReports from "./sections/ClientReports";
import ClientAIScan from "./sections/ClientAIScan";
import ClientRecommendations from "./sections/ClientRecommendations";
import ClientStrategyCalls from "./sections/ClientStrategyCalls";
import ClientProjects from "./sections/ClientProjects";
import ClientInvoices from "./sections/ClientInvoices";
import ClientDocuments from "./sections/ClientDocuments";
import ClientMessages from "./sections/ClientMessages";
import ClientAccount from "./sections/ClientAccount";
import ClientSecurity from "./sections/ClientSecurity";
import ClientSupport from "./sections/ClientSupport";
import ClientPortalLockedCard from "./components/ClientPortalLockedCard";
import PortalLoader from "./components/PortalLoader";

const SECTIONS = [
  "",
  "dashboard",
  "reports",
  "ai-scans",
  "recommendations",
  "strategy-calls",
  "projects",
  "billing",
  "documents",
  "messages",
  "account",
  "security",
  "support",
  // Legacy aliases tolerated:
  "ai-scan",
  "company",
] as const;

export default function ClientPortal() {
  const [, params] = useRoute("/client-portal/:section*");
  const [location] = useLocation();
  const { user, loading, isAuthenticated, isImpersonatingTarget } = useRouteGuard();
  const rawSection = (params as Record<string, string | undefined> | null)?.["section*"] ?? "dashboard";
  const section = rawSection.split("/")[0] || "dashboard";

  // Log portal access (one shot per mount/section).
  const recordAttempt = trpc.auth.recordAttempt.useMutation();
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    recordAttempt.mutate({
      identifier: user.email ?? null,
      provider: recordAttemptProvider(user.loginMethod),
      outcome: "success",
      reason: `client-portal:${section || "dashboard"}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, section]);

  if (loading) return <PortalLoader />;
  if (!isAuthenticated) {
    window.location.href = getLoginUrl(location);
    return null;
  }

  // Impersonation: when an admin is in View-As-Client we let them through
  // and treat them as a virtual client (the real admin role stays on the
  // server context for adminProcedure access).
  const impersonatingClient = isImpersonatingTarget(user, "client");

  // Role-based redirect away from client portal (skip when impersonating).
  if (user?.role === "admin" && !impersonatingClient) {
    return <Redirect to="/admin" replace />;
  }

  const role = user?.role;
  const hasOrg = !!user?.organizationId;

  // While impersonating we always render the dashboard surface so admins
  // can preview every client section without being told the account is
  // not linked. The audit trail is already recorded server-side.
  if (!impersonatingClient && (role !== "client" || !hasOrg)) {
    return (
      <ClientPortalLayout
        section="dashboard"
        organizationName={null}
        userDisplayName={user?.name ?? user?.email ?? "Guest"}
        userEmail={user?.email ?? null}
      >
        <ClientPortalLockedCard
          role={role ?? "user"}
          email={user?.email ?? null}
        />
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout
      section={section}
      organizationName={null /* filled by inner sections via dashboard query */}
      userDisplayName={user?.name ?? user?.email ?? "Client"}
      userEmail={user?.email ?? null}
    >
      <SectionSwitch section={section} />
    </ClientPortalLayout>
  );
}

function SectionSwitch({ section }: { section: string }) {
  const key = (SECTIONS as readonly string[]).includes(section) ? section : "dashboard";
  switch (key) {
    case "reports":
      return <ClientReports />;
    case "ai-scan":
    case "ai-scans":
      return <ClientAIScan />;
    case "recommendations":
      return <ClientRecommendations />;
    case "strategy-calls":
      return <ClientStrategyCalls />;
    case "projects":
      return <ClientProjects />;
    case "billing":
      return <ClientInvoices />;
    case "documents":
      return <ClientDocuments />;
    case "messages":
      return <ClientMessages />;
    case "company":
    case "account":
      return <ClientAccount />;
    case "security":
      return <ClientSecurity />;
    case "support":
      return <ClientSupport />;
    case "":
    case "dashboard":
    default:
      return <ClientDashboard />;
  }
}
