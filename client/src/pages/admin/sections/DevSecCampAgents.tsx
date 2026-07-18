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
interface Developer {
  id: string;
  name: string;
  role: string;
  access: "Standard" | "Elevated" | "Limited";
  expiresIn: string;
  status: "Active" | "Pending" | "Revoked";
}

const DEV_KPIS: KpiTile[] = [
  { id: "active", label: "Active devs", value: "18", delta: { value: "1", positive: true }, icon: Wrench, accent: "orange", spark: [12, 13, 15, 16, 17, 17, 18] },
  { id: "elev", label: "Elevated access", value: "5", icon: KeySquare, accent: "violet", spark: [3, 4, 4, 5, 5, 5, 5] },
  { id: "exp", label: "Expiring (24h)", value: "3", icon: Clock, accent: "red", spark: [1, 2, 2, 3, 3, 3, 3] },
  { id: "rev", label: "Revoked (7d)", value: "2", icon: AlertTriangle, accent: "red", spark: [0, 1, 1, 2, 2, 2, 2] },
];

const DEVS: Developer[] = [
  { id: "DEV-21", name: "John Developer",  role: "Infrastructure",         access: "Elevated", expiresIn: "2h 14m",  status: "Active" },
  { id: "DEV-20", name: "Sarah Engineer",  role: "Database",               access: "Elevated", expiresIn: "1h 32m",  status: "Active" },
  { id: "DEV-19", name: "Mike DevOps",     role: "Server deploy",          access: "Elevated", expiresIn: "45m",     status: "Active" },
  { id: "DEV-18", name: "Tom Engineer",    role: "Bug investigation",      access: "Limited",  expiresIn: "1h 05m",  status: "Active" },
  { id: "DEV-17", name: "Lena Backend",    role: "Backend rollout",        access: "Standard", expiresIn: "—",       status: "Pending" },
];

const accessTone = (a: Developer["access"]) =>
  a === "Elevated" ? "warn" : a === "Limited" ? "muted" : "info";

const DEV_COLS: DataColumn<Developer>[] = [
  { key: "id", header: "Ref", width: "78px" },
  { key: "name", header: "Developer" },
  { key: "role", header: "Purpose" },
  { key: "access", header: "Access", render: (r) => <StatusPill tone={accessTone(r.access) as any} label={r.access} /> },
  { key: "expiresIn", header: "Expires", align: "right", render: (r) => <span className="font-mono text-white/65">{r.expiresIn}</span> },
  { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "Active" ? "ok" : r.status === "Pending" ? "info" : "err"} label={r.status} /> },
];

export function Developers() {
  const q = trpc.admin.developers.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="Workforce"
      title="Developer Management"
      tagline="Approve developers, assign projects and grant temporary maintenance access with auto-expiration. Revoke instantly with full audit trail."
      kpis={DEV_KPIS}
      toolbar={<DefaultToolbar searchPlaceholder="Search developers, projects…" filters={["Access", "Status"]} primaryAction={{ label: "Grant access", onClick: () => audited.fire("developers", "grant-access") }} />}
      primary={<DataTable columns={DEV_COLS} rows={DEVS} />}
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
      )}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Security Monitoring
// =============================================================================
interface SecurityEvent {
  id: string;
  type: "Suspicious Login" | "Brute Force" | "Unusual Download" | "Failed MFA" | "Role Escalation";
  source: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  detectedAt: string;
  status: "New" | "Acknowledged" | "Resolved";
}

const SEC_KPIS: KpiTile[] = [
  { id: "events", label: "Events (24h)", value: "412", delta: { value: "3.4%", positive: false }, icon: ShieldAlert, accent: "orange", spark: [350, 360, 370, 388, 398, 405, 412] },
  { id: "high", label: "High / Critical", value: "5", delta: { value: "2", positive: false }, icon: AlertTriangle, accent: "red", spark: [2, 3, 3, 4, 4, 5, 5] },
  { id: "blk", label: "Blocked IPs", value: "67", delta: { value: "9", positive: true }, icon: ShieldCheck, accent: "green", spark: [50, 53, 58, 60, 63, 65, 67] },
  { id: "mttr", label: "MTTR", value: "12 min", delta: { value: "1.4", positive: true }, icon: Clock, accent: "violet", spark: [18, 17, 16, 15, 14, 13, 12] },
];

const SEC_EVENTS: SecurityEvent[] = [
  { id: "SE-2418", type: "Suspicious Login",   source: "185.234.x.x · NL",  severity: "High",     detectedAt: "10:42", status: "New" },
  { id: "SE-2417", type: "Brute Force",        source: "92.118.x.x · DE",   severity: "Critical", detectedAt: "10:18", status: "Acknowledged" },
  { id: "SE-2416", type: "Unusual Download",   source: "TechVision · US",    severity: "Medium",   detectedAt: "09:51", status: "Resolved" },
  { id: "SE-2415", type: "Failed MFA",         source: "developer@io",       severity: "Medium",   detectedAt: "09:21", status: "Resolved" },
  { id: "SE-2414", type: "Role Escalation",    source: "admin console",      severity: "High",     detectedAt: "08:48", status: "Acknowledged" },
];

const sevTone = (s: SecurityEvent["severity"]) =>
  s === "Critical" ? "err" : s === "High" ? "warn" : s === "Medium" ? "info" : "muted";

const SEC_COLS: DataColumn<SecurityEvent>[] = [
  { key: "id", header: "Ref", width: "84px" },
  { key: "type", header: "Event" },
  { key: "source", header: "Source" },
  { key: "severity", header: "Severity", render: (r) => <StatusPill tone={sevTone(r.severity) as any} label={r.severity} /> },
  { key: "detectedAt", header: "Detected", align: "right", render: (r) => <span className="font-mono text-white/65">{r.detectedAt}</span> },
  { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "Resolved" ? "ok" : r.status === "Acknowledged" ? "info" : "warn"} label={r.status} /> },
];

export function Security() {
  const q = trpc.admin.security.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="SecOps"
      sampleData
      title="Security Monitoring"
      tagline="24/7 monitoring for suspicious logins, brute-force attempts, unusual downloads, role escalations and failed MFA. Anomalies escalate automatically."
      kpis={SEC_KPIS}
      toolbar={<DefaultToolbar searchPlaceholder="Search events, sources, IPs…" filters={["Severity", "Type", "Status"]} primaryAction={{ label: "Run scan", onClick: () => audited.fire("security", "run-scan") }} />}
      primary={<DataTable columns={SEC_COLS} rows={SEC_EVENTS} />}
      aside={
        <SideCard title="Live posture">
          <ul className="space-y-2.5 text-[12.5px] text-white/85">
            <li className="flex items-center justify-between"><span>Login policy</span><span className="text-emerald-400 font-mono">enforced</span></li>
            <li className="flex items-center justify-between"><span>WAF</span><span className="text-emerald-400 font-mono">active</span></li>
            <li className="flex items-center justify-between"><span>Rate limit</span><span className="text-emerald-400 font-mono">100/min</span></li>
            <li className="flex items-center justify-between"><span>Threat feed</span><span className="text-emerald-400 font-mono">synced</span></li>
          </ul>
        </SideCard>
      }
    />
      )}
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
