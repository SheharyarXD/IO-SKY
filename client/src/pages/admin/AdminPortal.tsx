/*
 * IO SKY — Admin Portal entrypoint.
 *
 * Wraps the AdminLayout shell and dispatches every /admin/* route to the
 * correct section component. The layout, RBAC gate, role redirect and
 * audit handshake are handled once in AdminLayout.
 */
import { useParams, useLocation, Redirect } from "wouter";
import AdminLayout from "./components/AdminLayout";
import ExecutiveOverview from "./sections/ExecutiveOverview";
import CrmLeads from "./sections/CrmLeads";
import Clients from "./sections/Clients";
import AiScans from "./sections/AiScans";
import {
  Reports,
  Projects,
  Billing,
  Documents,
} from "./sections/ReportsProjectsBillingDocs";
import {
  Developers,
  Security,
  Campaigns,
  Agents,
} from "./sections/DevSecCampAgents";
import {
  Automations,
  Analytics,
  UsersPermissions,
  AuditLogs,
  SystemSettings,
  SupportDesk,
} from "./sections/AutomationsAnalyticsRest";
import AdminBookings from "../AdminBookings";
import BookingAvailability from "./sections/BookingAvailability";
import AdminSecurityCenter from "./sections/AdminSecurityCenter";

interface SectionDef {
  title: string;
  Component: React.ComponentType;
}

const SECTIONS: Record<string, SectionDef> = {
  crm:              { title: "CRM & Leads",                Component: CrmLeads },
  clients:          { title: "Clients",                    Component: Clients },
  "ai-scans":       { title: "AI Scans",                   Component: AiScans },
  reports:          { title: "Reports",                    Component: Reports },
  projects:         { title: "Projects & Ecosystems",      Component: Projects },
  billing:          { title: "Billing & Payments",         Component: Billing },
  documents:        { title: "Documents & Storage",        Component: Documents },
  developers:       { title: "Developer Management",       Component: Developers },
  security:         { title: "Security Monitoring",        Component: Security },
  campaigns:        { title: "Email & SMS Campaigns",      Component: Campaigns },
  agents:           { title: "AI Agents & IVR",            Component: Agents },
  automations:      { title: "Notifications & Automations",Component: Automations },
  analytics:        { title: "Analytics & Insights",       Component: Analytics },
  users:            { title: "Users & Permissions",        Component: UsersPermissions },
  audit:            { title: "Audit Logs",                 Component: AuditLogs },
  settings:         { title: "System Settings",            Component: SystemSettings },
  support:          { title: "Support Desk",               Component: SupportDesk },
  "booking-availability": { title: "Booking Availability",  Component: BookingAvailability },
  "my-security":    { title: "My Security (MFA)",         Component: AdminSecurityCenter },
};

export default function AdminPortal() {
  const params = useParams<{ section?: string }>();
  const [location] = useLocation();
  // Prefer wouter param when present, fall back to parsing location so that
  // /admin/<single-segment> routes work even when the :section* matcher
  // does not populate params (observed with wouter 3 + non-greedy wildcards).
  const section =
    params.section ??
    (location.startsWith("/admin/") ? location.slice("/admin/".length).split("/")[0] : "");

  // Discovery Calls is wired to the existing recent-bookings table, which
  // already proves the RBAC + audit + tRPC pattern end-to-end.
  if (section === "strategy-calls" || location === "/admin/bookings") {
    return (
      <AdminLayout title="Discovery Calls">
        <AdminBookings embedded />
      </AdminLayout>
    );
  }

  // Top-level Executive Overview.
  if (!section) {
    return (
      <AdminLayout title="Executive Overview">
        <ExecutiveOverview />
      </AdminLayout>
    );
  }

  const def = SECTIONS[section];
  if (!def) {
    return <Redirect to="/admin" />;
  }

  const Section = def.Component;
  return (
    <AdminLayout title={def.title}>
      <Section />
    </AdminLayout>
  );
}
