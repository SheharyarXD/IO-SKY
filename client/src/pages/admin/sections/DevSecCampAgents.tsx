/*
 * IO SKY — Admin Portal · Developers / Security / Campaigns / Agents pages.
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
import {
  Wrench,
  KeySquare,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Mail,
  MessageSquare,
  Headphones,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

// =============================================================================
// Developer Management
// =============================================================================
interface DeveloperRow {
  id: number;
  fullName: string;
  country: string | null;
  status: string;
  availability: string | null;
  mfaRequired: boolean | number | null;
  approvedMs: number | null;
}

type DevelopersPayload = {
  rows: DeveloperRow[];
  scopes: { developerId: number; level: string; status: string; expiresMs: number | null }[];
  pendingRequests: number;
  total: number;
};

const devStatusTone = (s: string) =>
  s === "active" ? "ok" : s === "pending" || s === "suspended" ? "warn" : "muted";

const DEV_COLS: DataColumn<DeveloperRow & { elevatedLevel: string; expiresLabel: string }>[] = [
  { key: "id", header: "Ref", width: "78px", render: (r) => <span className="font-mono text-white/55">DEV-{r.id}</span> },
  { key: "fullName", header: "Developer" },
  { key: "elevatedLevel", header: "Access" },
  { key: "expiresLabel", header: "Expires", align: "right", render: (r) => <span className="font-mono text-white/65">{r.expiresLabel}</span> },
  { key: "status", header: "Status", render: (r) => <StatusPill tone={devStatusTone(r.status) as any} label={r.status} /> },
];

function relativeFromNow(ms: number | null): string {
  if (!ms) return "—";
  const diff = ms - Date.now();
  if (diff <= 0) return "expired";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export function Developers() {
  const q = trpc.admin.developers.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();
  const grantAccess = trpc.admin.grantDeveloperAccess.useMutation({
    onSuccess: () => utils.admin.developers.invalidate(),
  });

  const handleGrantAccess = async () => {
    const rows = q.data && "rows" in q.data ? (q.data as DevelopersPayload).rows : [];
    if (rows.length === 0) {
      window.alert("No developers on file yet — nothing to grant access to.");
      return;
    }
    const list = rows.map((r) => `${r.id}: ${r.fullName}`).join("\n");
    const idRaw = window.prompt(`Grant access to which developer? Enter their ref number.\n\n${list}`);
    if (!idRaw) return;
    const developerId = Number(idRaw.trim());
    if (!Number.isInteger(developerId) || developerId <= 0) {
      window.alert("Enter a valid developer ref number.");
      return;
    }
    const level = window.prompt(
      "Access level? baseline / extended / elevated",
      "baseline",
    );
    if (!level || !["baseline", "extended", "elevated"].includes(level.trim())) {
      window.alert("Access level must be baseline, extended, or elevated.");
      return;
    }
    const daysRaw = window.prompt("Expires in how many days? (blank = no expiry)", "30");
    const expiresInDays = daysRaw && daysRaw.trim() ? Number(daysRaw.trim()) : undefined;
    if (expiresInDays !== undefined && (!Number.isInteger(expiresInDays) || expiresInDays <= 0)) {
      window.alert("Expiry must be a positive whole number of days, or left blank.");
      return;
    }
    try {
      await grantAccess.mutateAsync({
        developerId,
        level: level.trim() as "baseline" | "extended" | "elevated",
        expiresInDays,
      });
      window.alert("Access granted.");
    } catch (e: any) {
      window.alert(e?.message ?? "Could not grant access.");
    }
  };

  return (
    <ModuleStateBoundary<DevelopersPayload>
      isLoading={q.isLoading}
      error={q.error as any}
      data={q.data as DevelopersPayload | undefined}
      isEmpty={(d) => d.rows.length === 0}
      onRetry={() => q.refetch()}
    >
      {(data) => {
        // data.scopes is ordered desc(createdAt) (newest first) — build the
        // map by "first write wins" so each developer maps to their MOST
        // RECENT scope, not their oldest (Map(arr.map(...)) would silently
        // keep the last, i.e. oldest, entry for any developer with more
        // than one scope row, which grantDeveloperAccess now makes real).
        const scopeByDeveloper = new Map<number, (typeof data.scopes)[number]>();
        for (const s of data.scopes) {
          if (!scopeByDeveloper.has(s.developerId)) scopeByDeveloper.set(s.developerId, s);
        }
        const rows = data.rows.map((r) => {
          const scope = scopeByDeveloper.get(r.id);
          return {
            ...r,
            elevatedLevel: scope?.level ?? "none",
            expiresLabel: relativeFromNow(scope?.expiresMs ?? null),
          };
        });
        const elevatedCount = data.scopes.filter((s) => s.status === "active" && s.level !== "none").length;
        const activeCount = data.rows.filter((r) => r.status === "active").length;
        return (
    <OperationalPage
      eyebrow="Workforce"
      title="Developer Management"
      tagline="Approve developers, assign projects and grant temporary maintenance access with auto-expiration. Revoke instantly with full audit trail."
      kpis={[
        { id: "active", label: "Active devs", value: String(activeCount), icon: Wrench, accent: "orange" },
        { id: "elev", label: "Elevated access", value: String(elevatedCount), icon: KeySquare, accent: "violet" },
        { id: "pending", label: "Pending requests", value: String(data.pendingRequests), icon: Clock, accent: data.pendingRequests > 0 ? "red" : "green" },
        { id: "total", label: "Total developers", value: String(data.total), icon: AlertTriangle, accent: "blue" },
      ]}
      toolbar={<DefaultToolbar searchPlaceholder="Search developers, projects…" filters={["Access", "Status"]} primaryAction={{ label: "Grant access", onClick: handleGrantAccess }} />}
      primary={<DataTable columns={DEV_COLS} rows={rows} />}
      aside={
        <SideCard title="Access policies">
          <ul className="space-y-2.5 text-[12.5px] text-white/85">
            <li className="flex items-center justify-between"><span>MFA required</span><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></li>
            <li className="flex items-center justify-between"><span>Session ≤ 8h</span><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></li>
            <li className="flex items-center justify-between"><span>Per-project scoping</span><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></li>
            <li className="flex items-center justify-between"><span>NDA + SLA signed</span><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></li>
          </ul>
        </SideCard>
      }
    />
        );
      }}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Security Monitoring
// =============================================================================
interface SecurityEventRow {
  id: number;
  kind: string;
  severity: string;
  message: string;
  ip: string | null;
  acknowledgedAt: string | Date | null;
  createdAt: string | Date;
}

type SecurityPayload = { rows: SecurityEventRow[]; failedLogins24h: number; total: number };

const sevTone = (s: string) =>
  s === "critical" ? "err" : s === "high" ? "warn" : s === "medium" ? "info" : "muted";

const SEC_COLS: DataColumn<SecurityEventRow>[] = [
  { key: "id", header: "Ref", width: "84px", render: (r) => <span className="font-mono text-white/55">SE-{r.id}</span> },
  { key: "kind", header: "Event" },
  { key: "ip", header: "Source", render: (r) => <span className="font-mono text-white/65">{r.ip ?? "—"}</span> },
  { key: "severity", header: "Severity", render: (r) => <StatusPill tone={sevTone(r.severity) as any} label={r.severity} /> },
  { key: "createdAt", header: "Detected", align: "right", render: (r) => <span className="font-mono text-white/65">{new Date(r.createdAt).toLocaleString()}</span> },
  { key: "acknowledgedAt", header: "Status", render: (r) => <StatusPill tone={r.acknowledgedAt ? "ok" : "warn"} label={r.acknowledgedAt ? "Acknowledged" : "New"} /> },
];

export function Security() {
  const q = trpc.admin.security.useQuery(undefined, { staleTime: 30_000 });
  const mfaQ = trpc.admin.mfaPosture.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  const utils = trpc.useUtils();
  const acknowledge = trpc.ops.acknowledgeSecurityEvent.useMutation({
    onSuccess: () => utils.admin.security.invalidate(),
    onError: (e) => window.alert(e.message || "Could not acknowledge event"),
  });
  return (
    <ModuleStateBoundary<SecurityPayload>
      isLoading={q.isLoading}
      error={q.error as any}
      data={q.data as SecurityPayload | undefined}
      isEmpty={(d) => d.rows.length === 0}
      onRetry={() => q.refetch()}
    >
      {(data) => {
        const highCritical = data.rows.filter((r) => r.severity === "high" || r.severity === "critical").length;
        const cols: DataColumn<SecurityEventRow>[] = [
          ...SEC_COLS,
          {
            key: "id" as keyof SecurityEventRow,
            header: "Action",
            render: (r) =>
              r.acknowledgedAt ? null : (
                <button
                  onClick={() => acknowledge.mutate({ eventId: r.id })}
                  className="text-[11px] text-[#F58A1F] hover:underline"
                >
                  Acknowledge
                </button>
              ),
          },
        ];
        return (
    <OperationalPage
      eyebrow="SecOps"
      title="Security Monitoring"
      tagline="Developer-workspace security events (suspicious access, MFA failures, escalations) plus failed-login volume across the platform."
      kpis={[
        { id: "events", label: "Events (recent)", value: String(data.total), icon: ShieldAlert, accent: "orange" },
        { id: "high", label: "High / Critical", value: String(highCritical), icon: AlertTriangle, accent: highCritical > 0 ? "red" : "green" },
        { id: "failed", label: "Failed logins (24h)", value: String(data.failedLogins24h), icon: ShieldCheck, accent: data.failedLogins24h > 0 ? "red" : "green" },
      ]}
      toolbar={<DefaultToolbar searchPlaceholder="Search events, sources, IPs…" filters={["Severity", "Type", "Status"]} primaryAction={{ label: "Run scan", onClick: () => audited.fire("security", "run-scan") }} />}
      primary={<DataTable columns={cols} rows={data.rows} />}
      aside={
        <>
          <SideCard title="Live posture">
            <ul className="space-y-2.5 text-[12.5px] text-white/85">
              <li className="flex items-center justify-between"><span>Failed logins (24h)</span><span className="font-mono text-white/65">{data.failedLogins24h}</span></li>
              <li className="flex items-center justify-between"><span>Unacknowledged events</span><span className="font-mono text-white/65">{data.rows.filter((r) => !r.acknowledgedAt).length}</span></li>
            </ul>
          </SideCard>
          <SideCard title="MFA compliance by role">
            <ul className="space-y-2.5 text-[12.5px] text-white/85">
              {(mfaQ.data?.byRole ?? []).length === 0 ? (
                <li className="text-white/45">{mfaQ.isLoading ? "Loading…" : "No user data yet."}</li>
              ) : (
                mfaQ.data!.byRole.map((r) => (
                  <li key={r.role} className="flex items-center justify-between">
                    <span className="capitalize">{r.role.replace(/_/g, " ")}</span>
                    <span className="font-mono text-white/65">
                      {r.enrolled}/{r.total}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </SideCard>
        </>
      }
    />
        );
      }}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Email / SMS Campaigns
// =============================================================================
interface Campaign {
  id: string;
  name: string;
  channel: "Email" | "SMS";
  audience: number;
  openRate?: number;
  deliveryRate?: number;
  status: "Draft" | "Scheduled" | "Sending" | "Done";
}

type CampaignRow = { id: string; campaign: string; source: string; leads: number; last30Days: number; qualified: number; won: number; lastSeen: Date | string | null };

export function Campaigns() {
  const q = trpc.adminOps.campaignOverview.useQuery(undefined, { staleTime: 30_000 });
  const d = q.data;
  const rows: CampaignRow[] = (d?.rows ?? []).map((r) => ({ ...r, id: `${r.campaign}|${r.source}` }));
  const cols: DataColumn<CampaignRow>[] = [
    { key: "campaign", header: "Campaign tag" },
    { key: "source", header: "Source", render: (r) => <span className="font-mono">{r.source}</span> },
    { key: "leads", header: "Leads", align: "right", render: (r) => <span className="font-mono">{r.leads}</span> },
    { key: "last30Days", header: "Last 30 days", align: "right", render: (r) => <span className="font-mono">{r.last30Days}</span> },
    { key: "qualified", header: "Qualified or further", align: "right", render: (r) => <span className="font-mono">{r.qualified}</span> },
    { key: "won", header: "Won", align: "right", render: (r) => <span className="font-mono">{r.won}</span> },
    { key: "lastSeen", header: "Last lead", render: (r) => (r.lastSeen ? new Date(r.lastSeen).toLocaleDateString() : "n/a") },
  ];
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
        <OperationalPage
          eyebrow="Campaigns"
          title="Campaign attribution"
          tagline="Where inbound leads come from, by campaign tag and source, taken from the leads the platform captured. Outbound sending is part of AI Sales Outbound and is not in this release."
          kpis={[
            { id: "leads", label: "Leads captured", value: String(d?.totals.leads ?? 0), icon: Mail, accent: "orange" },
            { id: "attr", label: "Attributed to a campaign", value: String(d?.totals.attributed ?? 0), icon: Activity, accent: "green" },
            { id: "camp", label: "Campaign tags", value: String(d?.totals.campaigns ?? 0), icon: MessageSquare, accent: "blue" },
            { id: "won", label: "Won", value: String(d?.totals.won ?? 0), icon: Activity, accent: "violet" },
          ]}
          primary={<DataTable columns={cols} rows={rows} emptyLabel="No leads captured yet." />}
          aside={
            <SideCard title="Automations">
              <ul className="space-y-2.5 text-[12.5px] text-white/85">
                <li className="flex items-center justify-between"><span>Active workflows</span><span className="font-mono text-white/65">{d?.automations.active ?? 0}</span></li>
                <li className="flex items-center justify-between"><span>Runs, last 30 days</span><span className="font-mono text-white/65">{d?.automations.runs30Days ?? 0}</span></li>
                <li className="flex items-center justify-between"><span>Success rate</span><span className="font-mono text-white/65">{d?.automations.successRate == null ? "no runs yet" : `${d.automations.successRate}%`}</span></li>
                <li className="flex items-center justify-between"><span>Leads without a campaign tag</span><span className="font-mono text-white/65">{d?.totals.unattributed ?? 0}</span></li>
              </ul>
            </SideCard>
          }
        />
      )}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// AI Agents & IVR
// =============================================================================
export function Agents() {
  const agents = trpc.adminOps.aiAgents.useQuery(undefined, { staleTime: 30_000 });
  const execs = trpc.adminOps.aiExecutions.useQuery({}, { staleTime: 30_000 });
  type AgentRow = NonNullable<typeof agents.data>[number];
  const rows = agents.data ?? [];
  const runs = execs.data ?? [];
  const awaiting = runs.filter((e) => e.outcome === "awaiting_approval").length;
  const blocked = runs.filter((e) => e.outcome === "blocked_by_permission").length;
  const cols: DataColumn<AgentRow>[] = [
    { key: "key", header: "Agent", render: (r) => <span className="font-mono">{r.key}</span> },
    { key: "name", header: "Name" },
    { key: "permissions", header: "Permitted actions", render: (r) => (r.permissions.length ? r.permissions.join(", ") : "none") },
    { key: "activePromptVersion", header: "Prompt", render: (r) => (r.activePromptVersion ? `v${r.activePromptVersion}` : "none") },
    { key: "requiresHumanApproval", header: "Human approval", render: (r) => (r.requiresHumanApproval ? "required" : "not required") },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "active" ? "ok" : "muted"} label={r.status} /> },
  ];
  return (
    <ModuleStateBoundary isLoading={agents.isLoading} error={agents.error as any} data={agents.data} onRetry={() => agents.refetch()}>
      {() => (
        <OperationalPage
          eyebrow="AI governance"
          title="AI Agents & IVR"
          tagline="The registry of AI agents the platform runs, what each is permitted to do, and every run. Voice agents and IVR are not part of this release."
          kpis={[
            { id: "agents", label: "Registered agents", value: String(rows.length), icon: Headphones, accent: "orange" },
            { id: "active", label: "Active", value: String(rows.filter((r) => r.status === "active").length), icon: CheckCircle2, accent: "green" },
            { id: "await", label: "Awaiting approval", value: String(awaiting), icon: Clock, accent: awaiting > 0 ? "red" : "green" },
            { id: "blocked", label: "Runs blocked", value: String(blocked), icon: ShieldAlert, accent: blocked > 0 ? "red" : "blue" },
          ]}
          primary={<DataTable columns={cols} rows={rows} emptyLabel="No agent has been registered yet. The AI Scan analyst registers itself the first time a scan runs." />}
          aside={
            <SideCard title="Governance">
              <p className="text-[12.5px] text-white/70">An agent can only do what its permission list allows, and a refusal is recorded. Edit permissions, prompts and approvals under Governance, then AI agents. Disabling an agent stops it immediately.</p>
            </SideCard>
          }
        />
      )}
    </ModuleStateBoundary>
  );
}
