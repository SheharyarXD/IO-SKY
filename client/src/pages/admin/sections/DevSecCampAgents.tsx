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
                  className="text-[11px] text-[#FF7A00] hover:underline"
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

const CAMP_KPIS: KpiTile[] = [
  { id: "act", label: "Active campaigns", value: "12", delta: { value: "2", positive: true }, icon: Mail, accent: "orange", spark: [8, 9, 9, 10, 11, 11, 12] },
  { id: "open", label: "Avg. open rate", value: "42.6%", delta: { value: "1.8%", positive: true }, icon: Activity, accent: "green", spark: [38, 39, 40, 41, 41, 42, 42.6] },
  { id: "sms", label: "SMS delivery", value: "98.4%", delta: { value: "0.2%", positive: true }, icon: MessageSquare, accent: "blue", spark: [97, 97, 97.5, 98, 98.2, 98.3, 98.4] },
  { id: "rev", label: "Attributed rev.", value: "€48,210", delta: { value: "11.2%", positive: true }, icon: Activity, accent: "violet", spark: [30, 33, 36, 38, 42, 45, 48] },
];

const CAMPAIGNS: Campaign[] = [
  { id: "C-414", name: "Q2 Strategy outreach", channel: "Email", audience: 4218, openRate: 44.2, status: "Sending" },
  { id: "C-413", name: "AI Scan reminders",    channel: "SMS",   audience: 1284, deliveryRate: 99.1, status: "Done" },
  { id: "C-412", name: "Voice agent launch",   channel: "Email", audience: 8120, openRate: 39.8, status: "Done" },
  { id: "C-411", name: "Renewals nudge",       channel: "Email", audience: 612,  openRate: 51.4, status: "Done" },
  { id: "C-410", name: "Critical alert SMS",   channel: "SMS",   audience: 142,  deliveryRate: 100, status: "Done" },
];

const CAMP_COLS: DataColumn<Campaign>[] = [
  { key: "id", header: "Ref", width: "80px" },
  { key: "name", header: "Campaign" },
  { key: "channel", header: "Channel", render: (r) => <StatusPill tone={r.channel === "Email" ? "info" : "warn"} label={r.channel} /> },
  { key: "audience", header: "Audience", align: "right", render: (r) => <span className="font-mono text-white/65">{r.audience.toLocaleString()}</span> },
  {
    key: "openRate",
    header: "Performance",
    render: (r) =>
      r.channel === "Email" ? (
        <span className="font-mono text-emerald-400">{r.openRate?.toFixed(1)}% open</span>
      ) : (
        <span className="font-mono text-emerald-400">{r.deliveryRate?.toFixed(1)}% delivery</span>
      ),
  },
  { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "Done" ? "ok" : r.status === "Sending" ? "info" : r.status === "Scheduled" ? "warn" : "muted"} label={r.status} /> },
];

export function Campaigns() {
  const q = trpc.admin.campaigns.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="Outbound"
      sampleData
      title="Email & SMS Campaigns"
      tagline="Outbound and inbound campaigns wired to Twilio, SendGrid and Postmark with conversion analytics, segment targeting and automation triggers."
      kpis={CAMP_KPIS}
      toolbar={<DefaultToolbar searchPlaceholder="Search campaigns, segments…" filters={["Channel", "Status", "Owner"]} primaryAction={{ label: "New campaign", onClick: () => audited.fire("campaigns", "new-campaign") }} />}
      primary={<DataTable columns={CAMP_COLS} rows={CAMPAIGNS} />}
      aside={
        <SideCard title="Inbox health">
          <ul className="space-y-2.5 text-[12.5px] text-white/85">
            <li className="flex items-center justify-between"><span>SPF / DKIM</span><span className="text-emerald-400 font-mono">aligned</span></li>
            <li className="flex items-center justify-between"><span>Bounce rate</span><span className="font-mono text-white/65">0.4%</span></li>
            <li className="flex items-center justify-between"><span>Spam complaints</span><span className="font-mono text-white/65">0.02%</span></li>
            <li className="flex items-center justify-between"><span>Reputation</span><span className="text-emerald-400 font-mono">A+</span></li>
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
interface Agent {
  id: string;
  name: string;
  type: "Outbound AI" | "Inbound AI / IVR" | "Support" | "Booking";
  status: "Live" | "Paused" | "Tuning";
  callsToday: number;
  csat: number;
}

const AGENT_KPIS: KpiTile[] = [
  { id: "calls", label: "Calls (today)", value: "61", delta: { value: "18.5%", positive: true }, icon: PhoneCall, accent: "orange", spark: [22, 28, 36, 44, 51, 56, 61] },
  { id: "ivr", label: "IVR sessions", value: "37", delta: { value: "11.3%", positive: true }, icon: Headphones, accent: "violet", spark: [18, 22, 27, 30, 33, 35, 37] },
  { id: "csat", label: "CSAT", value: "4.7 / 5", delta: { value: "0.1", positive: true }, icon: Activity, accent: "green", spark: [4.5, 4.5, 4.6, 4.6, 4.7, 4.7, 4.7] },
  { id: "esc", label: "Escalations", value: "3", delta: { value: "12.5%", positive: true }, icon: AlertTriangle, accent: "red", spark: [6, 5, 5, 4, 4, 3, 3] },
];

const AGENTS: Agent[] = [
  { id: "AG-08", name: "OutboundAI · Strategy", type: "Outbound AI",       status: "Live",   callsToday: 24, csat: 4.7 },
  { id: "AG-07", name: "InboundAI · Reception", type: "Inbound AI / IVR",  status: "Live",   callsToday: 37, csat: 4.6 },
  { id: "AG-06", name: "Support Agent · Tier 1",type: "Support",           status: "Live",   callsToday: 18, csat: 4.5 },
  { id: "AG-05", name: "Booking Agent",         type: "Booking",           status: "Live",   callsToday: 12, csat: 4.8 },
  { id: "AG-04", name: "OutboundAI · Renewals", type: "Outbound AI",       status: "Tuning", callsToday: 0,  csat: 4.4 },
];

const AGENT_COLS: DataColumn<Agent>[] = [
  { key: "id", header: "Ref", width: "70px" },
  { key: "name", header: "Agent" },
  { key: "type", header: "Type" },
  { key: "callsToday", header: "Calls (today)", align: "right" },
  { key: "csat", header: "CSAT", align: "right", render: (r) => <span className="font-mono text-emerald-400">{r.csat.toFixed(1)}</span> },
  { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "Live" ? "ok" : r.status === "Paused" ? "muted" : "warn"} label={r.status} /> },
];

export function Agents() {
  const q = trpc.admin.agents.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="Voice & assistive AI"
      sampleData
      title="AI Agents & IVR"
      tagline="Voice agents, IVR routing, appointment scheduling and escalation workflows. Tune scripts, monitor CSAT and route overflow to humans."
      kpis={AGENT_KPIS}
      toolbar={<DefaultToolbar searchPlaceholder="Search agents, routes…" filters={["Type", "Status"]} primaryAction={{ label: "New agent", onClick: () => audited.fire("agents", "new-agent") }} />}
      primary={<DataTable columns={AGENT_COLS} rows={AGENTS} />}
      aside={
        <SideCard title="Live escalation queue">
          <ul className="space-y-2.5 text-[12.5px] text-white/85">
            <li className="flex items-center justify-between"><span>Brouwer Logistics</span><span className="font-mono text-amber-400">02:14</span></li>
            <li className="flex items-center justify-between"><span>BlueCedar Capital</span><span className="font-mono text-amber-400">01:42</span></li>
            <li className="flex items-center justify-between"><span>Khan Capital</span><span className="font-mono text-white/55">00:38</span></li>
          </ul>
        </SideCard>
      }
    />
      )}
    </ModuleStateBoundary>
  );
}
