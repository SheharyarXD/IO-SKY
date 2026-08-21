/*
 * IO SKY — Admin Portal · remaining sections.
 *
 * Notifications & Automations, Analytics & Insights, Users & Permissions,
 * Audit Logs, System Settings, Support Desk.
 */
import OperationalPage, {
  DefaultToolbar,
  DataTable,
  SideCard,
  StatusPill,
  type KpiTile,
  type DataColumn,
} from "./_shared/OperationalPage";
import { ModuleStateBoundary, useAuditedAction } from "./_shared/ModuleState";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Workflow,
  BarChart3,
  Users,
  ShieldCheck,
  ScrollText,
  Settings as SettingsIcon,
  LifeBuoy,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Activity,
  TrendingUp,
} from "lucide-react";

// =============================================================================
// Notifications & Automations
// =============================================================================
interface Automation {
  id: string;
  name: string;
  trigger: string;
  runs24h: number;
  successRate: number;
  status: "Healthy" | "Degraded" | "Paused";
}

const AUTO_KPIS: KpiTile[] = [
  { id: "wf", label: "Total workflows", value: "128", delta: { value: "6", positive: true }, icon: Workflow, accent: "orange", spark: [110, 115, 118, 121, 124, 126, 128] },
  { id: "ok", label: "Healthy", value: "96", icon: CheckCircle2, accent: "green", spark: [88, 90, 92, 93, 94, 95, 96] },
  { id: "deg", label: "Degraded", value: "5", delta: { value: "1", positive: false }, icon: AlertTriangle, accent: "red", spark: [3, 4, 4, 5, 5, 5, 5] },
  { id: "rate", label: "Success rate", value: "99.1%", delta: { value: "0.2%", positive: true }, icon: Activity, accent: "violet", spark: [98.6, 98.7, 98.8, 98.9, 99.0, 99.0, 99.1] },
];

const AUTOMATIONS: Automation[] = [
  { id: "WF-218", name: "AI Scan → Lead",            trigger: "Scan completed", runs24h: 142, successRate: 99.4, status: "Healthy" },
  { id: "WF-217", name: "Strategy call confirmation",trigger: "Booking created", runs24h: 28, successRate: 100,   status: "Healthy" },
  { id: "WF-216", name: "Invoice retry",             trigger: "Payment failed",  runs24h: 12, successRate: 91.7,  status: "Degraded" },
  { id: "WF-215", name: "Owner alert · critical",    trigger: "Critical event",  runs24h: 4,  successRate: 100,   status: "Healthy" },
  { id: "WF-214", name: "Renewal nudge",             trigger: "Cron · 09:00",    runs24h: 1,  successRate: 100,   status: "Healthy" },
];

const AUTO_COLS: DataColumn<Automation>[] = [
  { key: "id", header: "Ref", width: "84px" },
  { key: "name", header: "Workflow" },
  { key: "trigger", header: "Trigger" },
  { key: "runs24h", header: "Runs (24h)", align: "right" },
  { key: "successRate", header: "Success", align: "right", render: (r) => (
    <span className={r.successRate >= 99 ? "text-emerald-400 font-mono" : "text-amber-400 font-mono"}>{r.successRate.toFixed(1)}%</span>
  )},
  { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "Healthy" ? "ok" : r.status === "Degraded" ? "warn" : "muted"} label={r.status} /> },
];

export function Automations() {
  const q = trpc.admin.automations.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="Automation hub"
      sampleData
      title="Notifications & Automations"
      tagline="Automation queues, retries, webhooks, reminders and AI generation pipelines. Surface failed runs, retry on-demand and audit every change."
      kpis={AUTO_KPIS}
      toolbar={<DefaultToolbar searchPlaceholder="Search workflows, triggers…" filters={["Status", "Trigger"]} primaryAction={{ label: "New workflow", onClick: () => audited.fire("automations", "new-workflow") }} />}
      primary={<DataTable columns={AUTO_COLS} rows={AUTOMATIONS} />}
      aside={
        <SideCard title="Queue health">
          <ul className="space-y-2.5 text-[12.5px] text-white/85">
            <li className="flex items-center justify-between"><span>Pending jobs</span><span className="font-mono text-white/65">12</span></li>
            <li className="flex items-center justify-between"><span>Retrying</span><span className="font-mono text-amber-400">3</span></li>
            <li className="flex items-center justify-between"><span>Avg. latency</span><span className="font-mono text-white/65">320 ms</span></li>
            <li className="flex items-center justify-between"><span>Worker pool</span><span className="font-mono text-emerald-400">healthy</span></li>
          </ul>
        </SideCard>
      }
    />
      )}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Analytics & Insights — Milestone 2 §2.5 Business Intelligence dashboards.
// Previously every KPI/funnel/scan number here was a hardcoded literal,
// disconnected from trpc.admin.analytics's response entirely. Now driven
// by server/routers/admin.ts's readBusinessIntelligence(): a real 30-day
// funnel over bookings/ai_scans/leads, and scans ranked by real score
// (there is no per-scan revenue attribution anywhere in this schema, so
// the previous "by converted revenue" framing was never honestly fixable).
// =============================================================================
function buildAnalyticsKpis(data: {
  leads30d: number;
  leadsDelta: number;
  bookings30d: number;
  aiScans30d: number;
  wonDeals30d: number;
}): KpiTile[] {
  return [
    {
      id: "leads",
      label: "Leads (30d)",
      value: String(data.leads30d),
      delta: { value: `${Math.abs(data.leadsDelta)}%`, positive: data.leadsDelta >= 0 },
      icon: TrendingUp,
      accent: "green",
    },
    { id: "bookings", label: "Bookings (30d)", value: String(data.bookings30d), icon: Users, accent: "orange" },
    { id: "scans", label: "AI Scans (30d)", value: String(data.aiScans30d), icon: Activity, accent: "violet" },
    { id: "won", label: "Won deals (30d)", value: String(data.wonDeals30d), icon: TrendingUp, accent: "blue" },
  ];
}

export function Analytics() {
  const q = trpc.admin.analytics.useQuery(undefined, { staleTime: 30_000 });
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {(data) => (
    <OperationalPage
      eyebrow="Insights"
      title="Analytics & Insights"
      tagline="Conversion, ecosystem, AI Scan, operational and campaign analytics. Drill from KPI to source event in one click."
      kpis={buildAnalyticsKpis(data)}
      primary={
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[14px] font-medium text-white">Funnel · last 30 days</h3>
              <span className="font-mono text-[11px] text-white/55">Booking → Won</span>
            </div>
            <div className="space-y-2.5">
              {data.funnel.length === 0 ? (
                <p className="text-[12.5px] text-white/45">No funnel activity in the last 30 days.</p>
              ) : (
                data.funnel.map((f) => (
                  <div key={f.stage}>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-white/85">{f.stage}</span>
                      <span className="font-mono text-white/65">
                        {f.count} <span className="text-white/35">· {f.pct}%</span>
                      </span>
                    </div>
                    <div className="h-2 mt-1 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#FF6A00] to-[#FF8E3D]"
                        style={{ width: `${f.pct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-5">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[14px] font-medium text-white">Top scoring scans</h3>
              <span className="font-mono text-[11px] text-white/55">By AI Scan score</span>
            </div>
            {data.topScans.length === 0 ? (
              <p className="text-[12.5px] text-white/45">No scored AI Scans yet.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12.5px]">
                {data.topScans.map((s) => (
                  <li key={s.name} className="flex items-center justify-between rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <span className="text-white/85">{s.name}</span>
                    <span className="font-mono text-emerald-400">{s.score}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      }
    />
      )}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Users & Permissions
// =============================================================================
interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  mfaMethod: string;
  organizationId: number | null;
  lastSignedIn: string | Date;
}

type UsersPayload = { rows: UserRow[]; total: number };

interface OrgRow {
  id: number;
  slug: string;
  name: string;
  memberCount: number;
}

const ROLE_OPTIONS = ["user", "client", "developer", "admin", "super_admin", "technical_operator"] as const;

/**
 * Milestone 2 §2.5 — real role/org-assignment actions, built on
 * admin.setUserRole / admin.assignUserOrganization (server/routers/admin.ts,
 * both superAdminProcedure-gated). window.prompt()-based, matching the
 * established lightweight-flow convention already used for View-As's
 * reason prompt (AdminLayout.tsx) and Reports/Projects' "Generate" flow -
 * not a full modal form, but a genuine mutation, not an audit-only stub.
 * Only rendered for callers who are actually super_admin - a plain admin
 * would just get FORBIDDEN from the backend, but hiding the buttons
 * avoids a dead-end click.
 */
function buildUserCols(opts: {
  isSuperAdmin: boolean;
  orgsById: Map<number, OrgRow>;
  onChangeRole: (row: UserRow) => void;
  onAssignOrg: (row: UserRow) => void;
}): DataColumn<UserRow>[] {
  const cols: DataColumn<UserRow>[] = [
    { key: "id", header: "Ref", width: "70px", render: (r) => <span className="font-mono text-white/55">U-{r.id}</span> },
    { key: "name", header: "User", render: (r) => <span>{r.name ?? "—"}</span> },
    { key: "email", header: "Email", render: (r) => <span className="font-mono text-white/65">{r.email ?? "—"}</span> },
    { key: "role", header: "Role" },
    {
      key: "organizationId",
      header: "Organization",
      render: (r) =>
        r.organizationId ? (
          <span className="text-white/75">{opts.orgsById.get(r.organizationId)?.name ?? `#${r.organizationId}`}</span>
        ) : (
          <span className="text-white/35">—</span>
        ),
    },
    { key: "mfaMethod", header: "MFA", render: (r) => <StatusPill tone={r.mfaMethod !== "none" ? "ok" : "warn"} label={r.mfaMethod !== "none" ? r.mfaMethod : "disabled"} /> },
    { key: "lastSignedIn", header: "Last seen", align: "right", render: (r) => <span className="font-mono text-white/55">{new Date(r.lastSignedIn).toLocaleDateString()}</span> },
  ];
  if (opts.isSuperAdmin) {
    cols.push({
      key: "id" as keyof UserRow,
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2 justify-end">
          <button onClick={() => opts.onChangeRole(r)} className="text-[11px] text-[#FF6A00] hover:underline">
            Role
          </button>
          <button onClick={() => opts.onAssignOrg(r)} className="text-[11px] text-[#FF6A00] hover:underline">
            Org
          </button>
        </div>
      ),
    });
  }
  return cols;
}

export function UsersPermissions() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === "super_admin";
  const q = trpc.admin.users.useQuery(undefined, { staleTime: 30_000 });
  const orgsQuery = trpc.admin.listOrganizations.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();
  const audited = useAuditedAction();

  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => utils.admin.users.invalidate(),
    onError: (e) => window.alert(e.message || "Could not update role"),
  });
  const assignOrg = trpc.admin.assignUserOrganization.useMutation({
    onSuccess: () => utils.admin.users.invalidate(),
    onError: (e) => window.alert(e.message || "Could not update organization"),
  });
  const createOrg = trpc.admin.createOrganization.useMutation({
    onSuccess: () => utils.admin.listOrganizations.invalidate(),
    onError: (e) => window.alert(e.message || "Could not create organization"),
  });

  const onChangeRole = (row: UserRow) => {
    const role = window.prompt(
      `New role for ${row.name ?? row.email ?? `user #${row.id}`}?\n(${ROLE_OPTIONS.join(" / ")})`,
      row.role,
    );
    if (!role) return;
    if (!(ROLE_OPTIONS as readonly string[]).includes(role)) {
      window.alert(`Not a valid role. Must be one of: ${ROLE_OPTIONS.join(", ")}`);
      return;
    }
    setRole.mutate({ userId: row.id, role: role as (typeof ROLE_OPTIONS)[number] });
  };

  const onAssignOrg = (row: UserRow) => {
    const orgs = orgsQuery.data ?? [];
    const list = orgs.map((o) => `${o.id}: ${o.name}`).join("\n") || "(no organizations yet)";
    const input = window.prompt(
      `Organization id for ${row.name ?? row.email ?? `user #${row.id}`}? Leave blank to clear.\n\n${list}`,
      row.organizationId ? String(row.organizationId) : "",
    );
    if (input === null) return;
    const trimmed = input.trim();
    if (trimmed === "") {
      assignOrg.mutate({ userId: row.id, organizationId: null });
      return;
    }
    const orgId = Number(trimmed);
    if (!Number.isInteger(orgId) || orgId <= 0) {
      window.alert("Organization id must be a positive number");
      return;
    }
    assignOrg.mutate({ userId: row.id, organizationId: orgId });
  };

  const onCreateOrg = () => {
    const name = window.prompt("New organization name?");
    if (!name || !name.trim()) return;
    const slug = window.prompt(
      "Slug (lowercase letters, numbers, hyphens only)?",
      name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64),
    );
    if (!slug || !slug.trim()) return;
    createOrg.mutate({ slug: slug.trim(), name: name.trim() });
  };

  return (
    <ModuleStateBoundary<UsersPayload>
      isLoading={q.isLoading}
      error={q.error as any}
      data={q.data as UsersPayload | undefined}
      isEmpty={(d) => d.rows.length === 0}
      onRetry={() => q.refetch()}
    >
      {(data) => {
        const byRole = new Map<string, number>();
        for (const r of data.rows) byRole.set(r.role, (byRole.get(r.role) ?? 0) + 1);
        const mfaEnabled = data.rows.filter((r) => r.mfaMethod !== "none").length;
        const mfaPct = data.rows.length > 0 ? ((mfaEnabled / data.rows.length) * 100).toFixed(1) : "0.0";
        const orgs = (orgsQuery.data ?? []) as OrgRow[];
        const orgsById = new Map(orgs.map((o) => [o.id, o]));
        return (
    <OperationalPage
      eyebrow="Identity"
      title="Users & Permissions"
      tagline={
        isSuperAdmin
          ? "Every registered account, role and organization assignment. Role and organization changes are audited."
          : "Every registered account, role and MFA status. Role/organization mutations are Super Admin-only — see Milestone 2 §2.5."
      }
      kpis={[
        { id: "tot", label: "Total users", value: String(data.total), icon: Users, accent: "orange" },
        { id: "adm", label: "Admins + Super Admins", value: String((byRole.get("admin") ?? 0) + (byRole.get("super_admin") ?? 0)), icon: ShieldCheck, accent: "violet" },
        { id: "mfa", label: "MFA enabled", value: `${mfaPct}%`, icon: ShieldCheck, accent: "green" },
        { id: "org", label: "Organizations", value: String(orgs.length), icon: Users, accent: "green" },
      ]}
      toolbar={<DefaultToolbar searchPlaceholder="Search users, roles…" filters={["Role", "MFA", "Status"]} primaryAction={{ label: "Invite user", onClick: () => audited.fire("users", "invite-user") }} />}
      primary={
        <DataTable
          columns={buildUserCols({ isSuperAdmin, orgsById, onChangeRole, onAssignOrg })}
          rows={data.rows}
        />
      }
      aside={
        <div className="space-y-4">
          <SideCard title="Role catalogue">
            <ul className="space-y-2.5 text-[12.5px] text-white/85">
              {["super_admin", "admin", "developer", "client", "user"].map((role) => (
                <li key={role} className="flex items-center justify-between">
                  <span>{role}</span>
                  <span className="font-mono text-white/55">{byRole.get(role) ?? 0}</span>
                </li>
              ))}
            </ul>
          </SideCard>
          <SideCard title="Organizations">
            <ul className="space-y-2 text-[12.5px] text-white/85 mb-3 max-h-[220px] overflow-y-auto">
              {orgs.length === 0 ? (
                <li className="text-white/40">No organizations yet</li>
              ) : (
                orgs.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{o.name}</span>
                    <span className="font-mono text-white/55 shrink-0">{o.memberCount} members</span>
                  </li>
                ))
              )}
            </ul>
            {isSuperAdmin && (
              <button
                onClick={onCreateOrg}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] bg-gradient-to-b from-[#FFB347] to-[#FF6A00] text-[#0B1020] text-[12px] font-semibold"
              >
                New organization
              </button>
            )}
          </SideCard>
        </div>
      }
    />
        );
      }}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Audit Logs
// =============================================================================
interface AuditEntry {
  id: number;
  identifier: string | null;
  provider: string;
  reason: string | null;
  outcome: string;
  createdAt: string | Date;
}

type AuditPayload = { rows: AuditEntry[] };

const AUDIT_COLS: DataColumn<AuditEntry>[] = [
  { key: "createdAt", header: "Time", width: "150px", render: (r) => <span className="font-mono text-white/65">{new Date(r.createdAt).toLocaleString()}</span> },
  { key: "identifier", header: "Actor", render: (r) => <span>{r.identifier ?? "—"}</span> },
  { key: "reason", header: "Action", render: (r) => <span className="font-mono text-[11.5px] text-white/85">{r.reason ?? r.provider}</span> },
  { key: "provider", header: "Via", render: (r) => <span className="font-mono text-[11.5px] text-white/65">{r.provider}</span> },
  { key: "outcome", header: "Outcome", render: (r) => <StatusPill tone={r.outcome === "success" ? "ok" : "err"} label={r.outcome} /> },
];

export function AuditLogs() {
  const q = trpc.admin.audit.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  return (
    <ModuleStateBoundary<AuditPayload>
      isLoading={q.isLoading}
      error={q.error as any}
      data={q.data as AuditPayload | undefined}
      isEmpty={(d) => d.rows.length === 0}
      onRetry={() => q.refetch()}
    >
      {(data) => {
        const failures = data.rows.filter((r) => r.outcome !== "success").length;
        return (
    <OperationalPage
      eyebrow="Compliance"
      title="Audit Logs"
      tagline="Every login attempt and admin action, written to login_audit at the moment it happens — not a separate best-effort log."
      kpis={[
        { id: "ev", label: "Events (recent)", value: String(data.rows.length), icon: ScrollText, accent: "orange" },
        { id: "fail", label: "Failures", value: String(failures), icon: AlertTriangle, accent: failures > 0 ? "red" : "green" },
      ]}
      toolbar={<DefaultToolbar searchPlaceholder="Search actor, action, target…" filters={["Outcome", "Actor", "Period"]} primaryAction={{ label: "Export", onClick: () => audited.fire("audit", "export") }} />}
      primary={<DataTable columns={AUDIT_COLS} rows={data.rows} />}
    />
        );
      }}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// System Settings
// =============================================================================
export function SystemSettings() {
  const audited = useAuditedAction();
  const sections = [
    { key: "branding", title: "Branding", desc: "Logo, accent colour, favicon and admin portal name.", state: "Configured" },
    { key: "storage", title: "Cloud storage", desc: "Supabase Storage buckets (client-portal, developer-workspace, ai-scan-reports, branding) — see Milestone 2 §2.1.", state: "Configured" },
    { key: "security", title: "Security policies", desc: "MFA enforcement, session length, IP allowlists, password policy.", state: "Hardened" },
    { key: "i18n", title: "Localisation", desc: "Default timezone (Europe/Amsterdam), languages and currency formats.", state: "EN · NL" },
    { key: "integrations", title: "Integrations", desc: "Resend (email), Supabase (auth/db/storage). LLM provider and Slack owner-alerts are configured but not yet activated — see Milestone 2 §2.2/§2.3.", state: "Partial" },
    { key: "observability", title: "Observability", desc: "Audit retention, error reporting, performance budgets, alerting.", state: "Active" },
  ];
  return (
    <OperationalPage
      eyebrow="Configuration"
      sampleData
      title="System Settings"
      tagline="Reference view of platform configuration — not yet a live settings editor. Real per-section management (branding upload, security policy editing, etc) is not built."
      primary={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map((s) => (
            <div key={s.title} className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-medium text-white">{s.title}</h3>
                <StatusPill tone={s.state === "Partial" ? "warn" : "ok"} label={s.state} />
              </div>
              <p className="mt-1.5 text-[12.5px] text-white/65 leading-relaxed">{s.desc}</p>
              <button
                className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-mono text-[#FF6A00] hover:text-[#FF7A1A]"
                onClick={() => audited.fire("settings", `view-${s.key}`)}
              >
                <SettingsIcon className="w-3 h-3" />
                Manage
              </button>
            </div>
          ))}
        </div>
      }
    />
  );
}

// =============================================================================
// Support Desk
// =============================================================================
interface Ticket {
  id: number;
  publicRef: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string | Date;
  organizationName: string | null;
}

type SupportPayload = { rows: Ticket[]; total: number };

const prTone = (p: string) =>
  p === "urgent" ? "err" : p === "high" ? "warn" : p === "low" ? "muted" : "info";

const SUP_COLS: DataColumn<Ticket>[] = [
  { key: "publicRef", header: "Ref", width: "96px", render: (r) => <span className="font-mono text-white/55">{r.publicRef}</span> },
  { key: "subject", header: "Subject" },
  { key: "organizationName", header: "Client", render: (r) => <span>{r.organizationName ?? "—"}</span> },
  { key: "priority", header: "Priority", render: (r) => <StatusPill tone={prTone(r.priority) as any} label={r.priority} /> },
  { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "resolved" ? "ok" : r.status === "in_progress" ? "info" : "warn"} label={r.status} /> },
  { key: "createdAt", header: "Opened", align: "right", render: (r) => <span className="font-mono text-white/55">{new Date(r.createdAt).toLocaleDateString()}</span> },
];

export function SupportDesk() {
  const q = trpc.admin.support.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  return (
    <ModuleStateBoundary<SupportPayload>
      isLoading={q.isLoading}
      error={q.error as any}
      data={q.data as SupportPayload | undefined}
      isEmpty={(d) => d.rows.length === 0}
      onRetry={() => q.refetch()}
    >
      {(data) => {
        const open = data.rows.filter((r) => r.status === "open").length;
        const urgent = data.rows.filter((r) => r.priority === "urgent").length;
        return (
    <OperationalPage
      eyebrow="Support"
      title="Support Desk"
      tagline="Every client_support_tickets row — real tickets clients raise from the Client Portal."
      kpis={[
        { id: "open", label: "Open tickets", value: String(open), icon: LifeBuoy, accent: "orange" },
        { id: "urgent", label: "Urgent", value: String(urgent), icon: AlertTriangle, accent: urgent > 0 ? "red" : "green" },
        { id: "total", label: "Total (recent)", value: String(data.total), icon: Activity, accent: "blue" },
      ]}
      toolbar={<DefaultToolbar searchPlaceholder="Search tickets, clients…" filters={["Status", "Priority", "Owner"]} primaryAction={{ label: "New ticket", onClick: () => audited.fire("support", "new-ticket") }} />}
      primary={<DataTable columns={SUP_COLS} rows={data.rows} />}
    />
        );
      }}
    </ModuleStateBoundary>
  );
}
