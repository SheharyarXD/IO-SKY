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
// Notifications & Automations — Milestone 2 §2.6 workflow-definition engine.
// Previously every row/KPI here was a hardcoded literal (disclosed via
// sampleData) with no real system behind it at all. Now backed by the real
// workflow_definitions/workflow_runs tables (server/workflowEngine.ts):
// a bounded set of trigger types (real events this app emits — currently
// document approve/reject) mapped to a bounded set of safe actions
// (owner notification via the §2.3 Resend transport, or an audit-log
// entry), with every execution logged and inspectable.
// =============================================================================
interface WorkflowDefRow {
  id: number;
  name: string;
  triggerType: string;
  actionType: string;
  actionConfig: string | null;
  enabled: number;
  createdAt: string | Date;
}
interface WorkflowRunRow {
  id: number;
  workflowDefinitionId: number;
  triggerType: string;
  triggerEntityRef: string | null;
  status: "succeeded" | "failed";
  resultMessage: string | null;
  ranAt: string | Date;
}

const TRIGGER_TYPES = ["document_approved", "document_rejected", "booking_completed", "lead_won", "ai_scan_completed"] as const;
const ACTION_TYPES = ["notify_owner", "audit_log"] as const;

function workflowCols(opts: {
  isSuperAdmin: boolean;
  onToggle: (row: WorkflowDefRow) => void;
}): DataColumn<WorkflowDefRow>[] {
  const cols: DataColumn<WorkflowDefRow>[] = [
    { key: "id", header: "Ref", width: "70px", render: (r) => <span className="font-mono text-white/55">WF-{r.id}</span> },
    { key: "name", header: "Workflow" },
    { key: "triggerType", header: "Trigger", render: (r) => <span className="font-mono text-white/65">{r.triggerType}</span> },
    { key: "actionType", header: "Action", render: (r) => <span className="font-mono text-white/65">{r.actionType}</span> },
    { key: "enabled", header: "Status", render: (r) => <StatusPill tone={r.enabled === 1 ? "ok" : "muted"} label={r.enabled === 1 ? "Enabled" : "Disabled"} /> },
  ];
  if (opts.isSuperAdmin) {
    cols.push({
      key: "id" as keyof WorkflowDefRow,
      header: "Actions",
      render: (r) => (
        <button onClick={() => opts.onToggle(r)} className="text-[11px] text-[#FF7A00] hover:underline">
          {r.enabled === 1 ? "Disable" : "Enable"}
        </button>
      ),
    });
  }
  return cols;
}

export function Automations() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === "super_admin";
  const q = trpc.admin.workflowDefinitions.useQuery(undefined, { staleTime: 30_000 });
  const runsQ = trpc.admin.workflowRuns.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();
  const toggle = trpc.admin.setWorkflowDefinitionEnabled.useMutation({
    onSuccess: () => utils.admin.workflowDefinitions.invalidate(),
    onError: (e) => window.alert(e.message || "Could not update workflow"),
  });
  const create = trpc.admin.createWorkflowDefinition.useMutation({
    onSuccess: () => utils.admin.workflowDefinitions.invalidate(),
    onError: (e) => window.alert(e.message || "Could not create workflow"),
  });
  const webhooksQ = trpc.admin.webhookRegistrations.useQuery(undefined, { staleTime: 30_000, enabled: isSuperAdmin });
  const createWebhook = trpc.admin.createWebhookRegistration.useMutation({
    onSuccess: () => utils.admin.webhookRegistrations.invalidate(),
    onError: (e) => window.alert(e.message || "Could not register webhook"),
  });
  const toggleWebhook = trpc.admin.setWebhookRegistrationEnabled.useMutation({
    onSuccess: () => utils.admin.webhookRegistrations.invalidate(),
    onError: (e) => window.alert(e.message || "Could not update webhook"),
  });

  const onNewWebhook = () => {
    const name = window.prompt("Webhook name?");
    if (!name?.trim()) return;
    const url = window.prompt("Webhook URL (https:// only)?");
    if (!url?.trim()) return;
    const triggerType = window.prompt(`Trigger type?\n(${TRIGGER_TYPES.join(" / ")})`, TRIGGER_TYPES[0]);
    if (!triggerType || !(TRIGGER_TYPES as readonly string[]).includes(triggerType)) {
      window.alert(`Not a valid trigger. Must be one of: ${TRIGGER_TYPES.join(", ")}`);
      return;
    }
    const secret = window.prompt("Signing secret (min 8 chars, optional — leave blank for none)?") || undefined;
    createWebhook.mutate({
      name: name.trim(),
      url: url.trim(),
      triggerType: triggerType as (typeof TRIGGER_TYPES)[number],
      secret: secret?.trim() || undefined,
    });
  };

  const onNewWorkflow = () => {
    const name = window.prompt("Workflow name?");
    if (!name?.trim()) return;
    const triggerType = window.prompt(`Trigger type?\n(${TRIGGER_TYPES.join(" / ")})`, TRIGGER_TYPES[0]);
    if (!triggerType || !(TRIGGER_TYPES as readonly string[]).includes(triggerType)) {
      window.alert(`Not a valid trigger. Must be one of: ${TRIGGER_TYPES.join(", ")}`);
      return;
    }
    const actionType = window.prompt(`Action type?\n(${ACTION_TYPES.join(" / ")})`, ACTION_TYPES[0]);
    if (!actionType || !(ACTION_TYPES as readonly string[]).includes(actionType)) {
      window.alert(`Not a valid action. Must be one of: ${ACTION_TYPES.join(", ")}`);
      return;
    }
    create.mutate({
      name: name.trim(),
      triggerType: triggerType as (typeof TRIGGER_TYPES)[number],
      actionType: actionType as (typeof ACTION_TYPES)[number],
    });
  };

  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {(defs) => {
        const rows = defs as WorkflowDefRow[];
        const runs = (runsQ.data ?? []) as WorkflowRunRow[];
        const enabled = rows.filter((r) => r.enabled === 1).length;
        const succeeded = runs.filter((r) => r.status === "succeeded").length;
        const failed = runs.filter((r) => r.status === "failed").length;
        const successRate = runs.length === 0 ? 0 : Math.round((succeeded / runs.length) * 1000) / 10;
        const kpis: KpiTile[] = [
          { id: "wf", label: "Total workflows", value: String(rows.length), icon: Workflow, accent: "orange" },
          { id: "ok", label: "Enabled", value: String(enabled), icon: CheckCircle2, accent: "green" },
          { id: "runs", label: "Runs (recent)", value: String(runs.length), icon: Activity, accent: "violet" },
          { id: "rate", label: "Success rate", value: runs.length === 0 ? "—" : `${successRate}%`, icon: TrendingUp, accent: failed > 0 ? "red" : "green" },
        ];
        return (
    <OperationalPage
      eyebrow="Workflow engine"
      title="Notifications & Automations"
      tagline="Bounded workflow-definition engine: real trigger events (document review decisions today) mapped to real, safe actions (owner notification or an audit-log entry), every run logged."
      kpis={kpis}
      toolbar={
        <DefaultToolbar
          searchPlaceholder="Search workflows, triggers…"
          filters={["Status", "Trigger"]}
          primaryAction={isSuperAdmin ? { label: "New workflow", onClick: onNewWorkflow } : undefined}
        />
      }
      primary={
        rows.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">
            No workflow definitions yet.{isSuperAdmin ? " Use \"New workflow\" to create one." : ""}
          </div>
        ) : (
          <DataTable
            columns={workflowCols({ isSuperAdmin, onToggle: (r) => toggle.mutate({ id: r.id, enabled: r.enabled !== 1 }) })}
            rows={rows}
          />
        )
      }
      aside={
        <>
          <SideCard title="Recent runs">
            {runs.length === 0 ? (
              <p className="text-[12.5px] text-white/45">No workflow runs recorded yet.</p>
            ) : (
              <ul className="space-y-2.5 text-[12.5px] text-white/85">
                {runs.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{r.triggerType}{r.triggerEntityRef ? ` #${r.triggerEntityRef}` : ""}</span>
                    <span className={`font-mono shrink-0 ${r.status === "succeeded" ? "text-emerald-400" : "text-red-400"}`}>{r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </SideCard>
          {isSuperAdmin && (
            <SideCard title="Webhook registry">
              <div className="space-y-2.5">
                {(webhooksQ.data ?? []).length === 0 ? (
                  <p className="text-[12.5px] text-white/45">No webhooks registered yet.</p>
                ) : (
                  <ul className="space-y-2 text-[12.5px] text-white/85">
                    {(webhooksQ.data ?? []).map((w: any) => (
                      <li key={w.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{w.name} · {w.triggerType}</span>
                        <button
                          onClick={() => toggleWebhook.mutate({ id: w.id, enabled: w.enabled !== 1 })}
                          className="font-mono text-[11px] shrink-0 text-[#FF7A00] hover:underline"
                        >
                          {w.enabled === 1 ? "Disable" : "Enable"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={onNewWebhook}
                  className="w-full text-[11.5px] font-mono uppercase tracking-[0.16em] py-1.5 rounded-md border border-white/[0.08] hover:border-[#FF7A00]/45 hover:bg-[#FF7A00]/10 text-white/75 hover:text-white transition-colors"
                >
                  New webhook
                </button>
              </div>
            </SideCard>
          )}
        </>
      }
    />
        );
      }}
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
                        className="h-full bg-gradient-to-r from-[#FF7A00] to-[#FF8E3D]"
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
  mfaVerified: boolean;
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
    { key: "mfaMethod", header: "MFA", render: (r) => <StatusPill tone={r.mfaVerified ? "ok" : "warn"} label={r.mfaVerified ? "enabled" : "disabled"} /> },
    { key: "lastSignedIn", header: "Last seen", align: "right", render: (r) => <span className="font-mono text-white/55">{new Date(r.lastSignedIn).toLocaleDateString()}</span> },
  ];
  if (opts.isSuperAdmin) {
    cols.push({
      key: "id" as keyof UserRow,
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2 justify-end">
          <button onClick={() => opts.onChangeRole(r)} className="text-[11px] text-[#FF7A00] hover:underline">
            Role
          </button>
          <button onClick={() => opts.onAssignOrg(r)} className="text-[11px] text-[#FF7A00] hover:underline">
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
        const mfaEnabled = data.rows.filter((r) => r.mfaVerified).length;
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
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] bg-gradient-to-b from-[#FFB347] to-[#FF7A00] text-[#0B1020] text-[12px] font-semibold"
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

/**
 * Real CSV export of the currently-loaded audit rows — was previously an
 * audited.fire("audit", "export") stub that did nothing visible to the
 * operator besides an audit-log row. The rows are already in hand (this
 * page's own query result), so this needs no new endpoint.
 */
function exportAuditRowsAsCsv(rows: AuditEntry[]) {
  const header = ["Time", "Actor", "Action", "Via", "Outcome"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        new Date(r.createdAt).toISOString(),
        r.identifier ?? "",
        r.reason ?? r.provider,
        r.provider,
        r.outcome,
      ]
        .map((v) => escape(String(v)))
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `io-sky-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
      toolbar={<DefaultToolbar searchPlaceholder="Search actor, action, target…" filters={["Outcome", "Actor", "Period"]} primaryAction={{ label: "Export", onClick: () => { audited.fire("audit", "export"); exportAuditRowsAsCsv(data.rows); } }} />}
      primary={<DataTable columns={AUDIT_COLS} rows={data.rows} />}
    />
        );
      }}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// System Settings — Milestone 2 §2.5 platform configuration store.
// Previously a hardcoded local array never even wired to trpc.admin.settings,
// disclosed as `sampleData`. Now backed by the real `platform_settings`
// table (server/db/platformSettings.ts): any admin can read it, only
// super_admin can edit a value (matching RM-57's decision that platform
// configuration is a super_admin-exclusive capability). Deliberately still
// NOT live third-party provider wiring — editing a card updates its stored
// label/state string, not real Stripe/Twilio/SendGrid credentials.
// =============================================================================
export function SystemSettings() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === "super_admin";
  const q = trpc.admin.settings.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();
  const audited = useAuditedAction();
  const updateSetting = trpc.admin.updateSetting.useMutation({
    onSuccess: () => utils.admin.settings.invalidate(),
    onError: (e) => window.alert(e.message || "Could not update setting"),
  });

  const onEdit = (key: string, title: string, current: string) => {
    const value = window.prompt(`New value for "${title}"?`, current);
    if (!value || value.trim() === current) return;
    updateSetting.mutate({ key, value: value.trim() });
  };

  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {(data) => (
    <OperationalPage
      eyebrow="Configuration"
      title="System Settings"
      tagline={
        isSuperAdmin
          ? "Live platform configuration store — edit a card to persist a new value. Third-party provider credentials are configured outside this app, not here."
          : "Platform configuration (read-only for your role — super_admin can edit)."
      }
      primary={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.sections.map((s) => (
            <div key={s.key} className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-medium text-white">{s.title}</h3>
                <StatusPill tone={s.state === "Partial" ? "warn" : "ok"} label={s.state} />
              </div>
              <p className="mt-1.5 text-[12.5px] text-white/65 leading-relaxed">{s.desc}</p>
              <button
                className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-mono text-[#FF7A00] hover:text-[#FF7A1A]"
                onClick={() =>
                  isSuperAdmin
                    ? onEdit(s.key, s.title, s.state)
                    : audited.fire("settings", `view-${s.key}`)
                }
              >
                <SettingsIcon className="w-3 h-3" />
                {isSuperAdmin ? "Edit" : "Manage"}
              </button>
            </div>
          ))}
        </div>
      }
    />
      )}
    </ModuleStateBoundary>
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
  const orgsQuery = trpc.admin.listOrganizations.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();
  const createTicket = trpc.admin.createSupportTicket.useMutation({
    onSuccess: () => utils.admin.support.invalidate(),
    onError: (e) => window.alert(e.message || "Could not create ticket"),
  });

  const onNewTicket = () => {
    const orgs = orgsQuery.data ?? [];
    const list = orgs.map((o) => `${o.id}: ${o.name}`).join("\n") || "(no organizations yet)";
    const orgIdRaw = window.prompt(`Organization id for this ticket?\n\n${list}`);
    const organizationId = orgIdRaw ? Number(orgIdRaw) : NaN;
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const subject = window.prompt("Ticket subject?");
    if (!subject?.trim()) return;
    const body = window.prompt("Ticket details?");
    if (!body?.trim()) return;
    createTicket.mutate({ organizationId, subject: subject.trim(), body: body.trim() });
  };

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
      toolbar={<DefaultToolbar searchPlaceholder="Search tickets, clients…" filters={["Status", "Priority", "Owner"]} primaryAction={{ label: "New ticket", onClick: onNewTicket }} />}
      primary={<DataTable columns={SUP_COLS} rows={data.rows} />}
    />
        );
      }}
    </ModuleStateBoundary>
  );
}
