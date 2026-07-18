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
  void audited;
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="Automation hub"
      sampleData
      title="Notifications & Automations"
      tagline="Automation queues, retries, webhooks, reminders and AI generation pipelines. Surface failed runs, retry on-demand and audit every change."
      kpis={AUTO_KPIS}
      toolbar={<DefaultToolbar searchPlaceholder="Search workflows, triggers…" filters={["Status", "Trigger"]} primaryAction={{ label: "New workflow" }} />}
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
// Analytics & Insights
// =============================================================================
const ANALYTICS_KPIS: KpiTile[] = [
  { id: "conv", label: "Conversion (30d)", value: "32.4%", delta: { value: "2.1%", positive: true }, icon: TrendingUp, accent: "green", spark: [28, 29, 30, 31, 31, 32, 32.4] },
  { id: "mau", label: "Active operators", value: "47", delta: { value: "4", positive: true }, icon: Users, accent: "orange", spark: [38, 40, 42, 43, 45, 46, 47] },
  { id: "scn", label: "AI Scans → leads", value: "89%", delta: { value: "1.6%", positive: true }, icon: Activity, accent: "violet", spark: [82, 84, 85, 86, 87, 88, 89] },
  { id: "ret", label: "Net retention", value: "118%", delta: { value: "3.2%", positive: true }, icon: TrendingUp, accent: "blue", spark: [108, 110, 112, 114, 115, 117, 118] },
];

export function Analytics() {
  const q = trpc.admin.analytics.useQuery(undefined, { staleTime: 30_000 });
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="Insights"
      sampleData
      title="Analytics & Insights"
      tagline="Conversion, ecosystem, AI Scan, operational and campaign analytics. Drill from KPI to source event in one click."
      kpis={ANALYTICS_KPIS}
      primary={
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[14px] font-medium text-white">Funnel · last 30 days</h3>
              <span className="font-mono text-[11px] text-white/55">Booking → Won</span>
            </div>
            <div className="space-y-2.5">
              {[
                { stage: "Strategy calls booked", count: 412, pct: 100 },
                { stage: "Calls completed",       count: 367, pct: 89 },
                { stage: "AI Scans triggered",    count: 318, pct: 77 },
                { stage: "Qualified leads",       count: 187, pct: 45 },
                { stage: "Won deals",             count: 134, pct: 32 },
              ].map((f) => (
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
              ))}
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-5">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[14px] font-medium text-white">Top contributing scans</h3>
              <span className="font-mono text-[11px] text-white/55">By converted revenue</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12.5px]">
              {[
                { name: "Operational efficiency",  rev: "€96,400" },
                { name: "Workflow automation",     rev: "€72,180" },
                { name: "Voice agent rollout",     rev: "€54,920" },
                { name: "Centralised storage",     rev: "€38,560" },
              ].map((s) => (
                <li key={s.name} className="flex items-center justify-between rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className="text-white/85">{s.name}</span>
                  <span className="font-mono text-emerald-400">{s.rev}</span>
                </li>
              ))}
            </ul>
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
  id: string;
  name: string;
  email: string;
  role: "Super Admin" | "Admin" | "Operator" | "Developer" | "Client";
  mfa: "Enabled" | "Pending";
  lastSeen: string;
}

const USER_KPIS: KpiTile[] = [
  { id: "tot", label: "Total users", value: "128", delta: { value: "4", positive: true }, icon: Users, accent: "orange", spark: [110, 116, 120, 122, 124, 126, 128] },
  { id: "adm", label: "Admins", value: "6", icon: ShieldCheck, accent: "violet", spark: [5, 5, 6, 6, 6, 6, 6] },
  { id: "mfa", label: "MFA enabled", value: "97.6%", delta: { value: "1.2%", positive: true }, icon: ShieldCheck, accent: "green", spark: [94, 95, 96, 96.5, 97, 97.4, 97.6] },
  { id: "lock", label: "Locked accounts", value: "1", icon: AlertTriangle, accent: "red", spark: [0, 0, 1, 1, 1, 1, 1] },
];

const USERS: UserRow[] = [
  { id: "U-014", name: "Alex Admin",       email: "alex@io.sky",        role: "Super Admin", mfa: "Enabled", lastSeen: "now" },
  { id: "U-013", name: "Sara Ops",         email: "sara@io.sky",        role: "Admin",       mfa: "Enabled", lastSeen: "12m" },
  { id: "U-012", name: "Mike Field",       email: "mike@io.sky",        role: "Operator",    mfa: "Enabled", lastSeen: "1h" },
  { id: "U-011", name: "John Developer",   email: "john@dev.io.sky",    role: "Developer",   mfa: "Enabled", lastSeen: "today" },
  { id: "U-010", name: "Lena Client",      email: "lena@nordic.com",    role: "Client",      mfa: "Pending", lastSeen: "yesterday" },
];

const USER_COLS: DataColumn<UserRow>[] = [
  { key: "id", header: "Ref", width: "70px" },
  { key: "name", header: "User" },
  { key: "email", header: "Email", render: (r) => <span className="font-mono text-white/65">{r.email}</span> },
  { key: "role", header: "Role" },
  { key: "mfa", header: "MFA", render: (r) => <StatusPill tone={r.mfa === "Enabled" ? "ok" : "warn"} label={r.mfa} /> },
  { key: "lastSeen", header: "Last seen", align: "right", render: (r) => <span className="font-mono text-white/55">{r.lastSeen}</span> },
];

export function UsersPermissions() {
  const q = trpc.admin.users.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  void audited;
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="Identity"
      title="Users & Permissions"
      tagline="Manage roles, access scopes, suspensions, MFA enforcement and time-bound permissions. Every change writes to the audit trail."
      kpis={USER_KPIS}
      toolbar={<DefaultToolbar searchPlaceholder="Search users, roles…" filters={["Role", "MFA", "Status"]} primaryAction={{ label: "Invite user" }} />}
      primary={<DataTable columns={USER_COLS} rows={USERS} />}
      aside={
        <SideCard title="Role catalogue">
          <ul className="space-y-2.5 text-[12.5px] text-white/85">
            <li className="flex items-center justify-between"><span>Super Admin</span><span className="font-mono text-white/55">2</span></li>
            <li className="flex items-center justify-between"><span>Admin</span><span className="font-mono text-white/55">4</span></li>
            <li className="flex items-center justify-between"><span>Operator</span><span className="font-mono text-white/55">12</span></li>
            <li className="flex items-center justify-between"><span>Developer</span><span className="font-mono text-white/55">18</span></li>
            <li className="flex items-center justify-between"><span>Client</span><span className="font-mono text-white/55">92</span></li>
          </ul>
        </SideCard>
      }
    />
      )}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Audit Logs
// =============================================================================
interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  outcome: "success" | "failure";
}

const AUDIT_KPIS: KpiTile[] = [
  { id: "ev", label: "Events (24h)", value: "1,842", delta: { value: "4.6%", positive: true }, icon: ScrollText, accent: "orange", spark: [1480, 1520, 1610, 1680, 1740, 1790, 1842] },
  { id: "fail", label: "Failures", value: "11", delta: { value: "2", positive: true }, icon: AlertTriangle, accent: "red", spark: [16, 14, 14, 13, 12, 11, 11] },
  { id: "exp", label: "Exports (7d)", value: "4", icon: ScrollText, accent: "violet", spark: [2, 2, 3, 3, 3, 4, 4] },
  { id: "ret", label: "Retention", value: "10 yr", icon: Clock, accent: "blue", spark: [10, 10, 10, 10, 10, 10, 10] },
];

const AUDIT_ENTRIES: AuditEntry[] = [
  { id: "A-9412", actor: "alex@io.sky",       action: "admin.summary",        target: "/admin",            timestamp: "10:42:08", outcome: "success" },
  { id: "A-9411", actor: "sara@io.sky",       action: "lead.update",          target: "L-241",             timestamp: "10:41:55", outcome: "success" },
  { id: "A-9410", actor: "alex@io.sky",       action: "report.release",       target: "R-9412",            timestamp: "10:41:20", outcome: "success" },
  { id: "A-9409", actor: "developer@io.sky",  action: "developer.access",     target: "DEV-21",            timestamp: "10:40:08", outcome: "success" },
  { id: "A-9408", actor: "—",                 action: "auth.login",           target: "185.234.x.x",       timestamp: "10:39:14", outcome: "failure" },
];

const AUDIT_COLS: DataColumn<AuditEntry>[] = [
  { key: "timestamp", header: "Time", width: "100px", render: (r) => <span className="font-mono text-white/65">{r.timestamp}</span> },
  { key: "actor", header: "Actor" },
  { key: "action", header: "Action", render: (r) => <span className="font-mono text-[11.5px] text-white/85">{r.action}</span> },
  { key: "target", header: "Target", render: (r) => <span className="font-mono text-[11.5px] text-white/65">{r.target}</span> },
  { key: "outcome", header: "Outcome", render: (r) => <StatusPill tone={r.outcome === "success" ? "ok" : "err"} label={r.outcome} /> },
];

export function AuditLogs() {
  const q = trpc.admin.audit.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  void audited;
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="Compliance"
      title="Audit Logs"
      tagline="Immutable audit trail with export and search across every important system event. Hash-chained for tamper evidence."
      kpis={AUDIT_KPIS}
      toolbar={<DefaultToolbar searchPlaceholder="Search actor, action, target…" filters={["Outcome", "Actor", "Period"]} primaryAction={{ label: "Export" }} />}
      primary={<DataTable columns={AUDIT_COLS} rows={AUDIT_ENTRIES} />}
      aside={
        <SideCard title="Integrity">
          <ul className="space-y-2.5 text-[12.5px] text-white/85">
            <li className="flex items-center justify-between"><span>Hash chain</span><span className="text-emerald-400 font-mono">verified</span></li>
            <li className="flex items-center justify-between"><span>Last anchor</span><span className="font-mono text-white/55">2m ago</span></li>
            <li className="flex items-center justify-between"><span>Replication</span><span className="text-emerald-400 font-mono">3 regions</span></li>
            <li className="flex items-center justify-between"><span>WORM bucket</span><span className="text-emerald-400 font-mono">enforced</span></li>
          </ul>
        </SideCard>
      }
    />
      )}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// System Settings
// =============================================================================
export function SystemSettings() {
  const sections = [
    { title: "Branding", desc: "Logo, accent colour, favicon and admin portal name.", state: "Configured" },
    { title: "Cloud storage", desc: "S3-compatible bucket, region, encryption and retention.", state: "Configured" },
    { title: "Security policies", desc: "MFA enforcement, session length, IP allowlists, password policy.", state: "Hardened" },
    { title: "Localisation", desc: "Default timezone (Europe/Amsterdam), languages and currency formats.", state: "EN · NL" },
    { title: "Integrations", desc: "Stripe, Twilio, SendGrid, Postmark, OpenAI, Google Maps, Manus auth.", state: "Connected" },
    { title: "Observability", desc: "Audit retention, error reporting, performance budgets, alerting.", state: "Active" },
  ];
  return (
    <OperationalPage
      eyebrow="Configuration"
      title="System Settings"
      tagline="Manage branding, cloud storage, security policies, localisation, integrations and observability — every change writes an audit row."
      primary={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map((s) => (
            <div key={s.title} className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-medium text-white">{s.title}</h3>
                <StatusPill tone="ok" label={s.state} />
              </div>
              <p className="mt-1.5 text-[12.5px] text-white/65 leading-relaxed">{s.desc}</p>
              <button className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-mono text-[#FF6A00] hover:text-[#FF7A1A]">
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
  id: string;
  subject: string;
  client: string;
  priority: "Low" | "Normal" | "High" | "Urgent";
  status: "Open" | "In Progress" | "Resolved";
  age: string;
}

const SUP_KPIS: KpiTile[] = [
  { id: "open", label: "Open tickets", value: "14", delta: { value: "7.1%", positive: true }, icon: LifeBuoy, accent: "orange", spark: [22, 20, 18, 17, 16, 15, 14] },
  { id: "urgent", label: "Urgent", value: "2", icon: AlertTriangle, accent: "red", spark: [3, 3, 2, 2, 2, 2, 2] },
  { id: "frt", label: "Avg. first response", value: "4m 12s", delta: { value: "12s", positive: true }, icon: Clock, accent: "violet", spark: [320, 305, 290, 275, 268, 260, 252] },
  { id: "csat", label: "CSAT", value: "4.8", delta: { value: "0.1", positive: true }, icon: Activity, accent: "green", spark: [4.6, 4.6, 4.7, 4.7, 4.7, 4.8, 4.8] },
];

const TICKETS: Ticket[] = [
  { id: "T-1042", subject: "Invoice export failing for May",  client: "TechVision Enterprises", priority: "High",    status: "In Progress", age: "1h 12m" },
  { id: "T-1041", subject: "AI Scan stuck at 80%",             client: "Brouwer Logistics",      priority: "Urgent",  status: "Open",        age: "2h 04m" },
  { id: "T-1040", subject: "MFA reset request",                client: "Khan Capital",           priority: "Normal",  status: "Resolved",    age: "yesterday" },
  { id: "T-1039", subject: "Document download 403",            client: "Nordic Retail Group",    priority: "High",    status: "In Progress", age: "3h 28m" },
  { id: "T-1038", subject: "Add billing contact",              client: "Hartog Industries",      priority: "Low",     status: "Open",        age: "yesterday" },
];

const prTone = (p: Ticket["priority"]) =>
  p === "Urgent" ? "err" : p === "High" ? "warn" : p === "Low" ? "muted" : "info";

const SUP_COLS: DataColumn<Ticket>[] = [
  { key: "id", header: "Ref", width: "82px" },
  { key: "subject", header: "Subject" },
  { key: "client", header: "Client" },
  { key: "priority", header: "Priority", render: (r) => <StatusPill tone={prTone(r.priority) as any} label={r.priority} /> },
  { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "Resolved" ? "ok" : r.status === "In Progress" ? "info" : "warn"} label={r.status} /> },
  { key: "age", header: "Age", align: "right", render: (r) => <span className="font-mono text-white/55">{r.age}</span> },
];

export function SupportDesk() {
  const q = trpc.admin.support.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  void audited;
  return (
    <ModuleStateBoundary isLoading={q.isLoading} error={q.error as any} data={q.data} onRetry={() => q.refetch()}>
      {() => (
    <OperationalPage
      eyebrow="Support"
      title="Support Desk"
      tagline="Triage tickets, escalations and SLA breaches across every IO SKY surface. Routing, macros and knowledge base live alongside the queue."
      kpis={SUP_KPIS}
      toolbar={<DefaultToolbar searchPlaceholder="Search tickets, clients…" filters={["Status", "Priority", "Owner"]} primaryAction={{ label: "New ticket" }} />}
      primary={<DataTable columns={SUP_COLS} rows={TICKETS} />}
      aside={
        <SideCard title="SLA dashboard">
          <ul className="space-y-2.5 text-[12.5px] text-white/85">
            <li className="flex items-center justify-between"><span>Within SLA</span><span className="text-emerald-400 font-mono">96%</span></li>
            <li className="flex items-center justify-between"><span>Breached (24h)</span><span className="font-mono text-red-400">1</span></li>
            <li className="flex items-center justify-between"><span>Open · urgent</span><span className="font-mono text-amber-400">2</span></li>
            <li className="flex items-center justify-between"><span>On-call engineer</span><span className="font-mono text-white/65">Mike DevOps</span></li>
          </ul>
        </SideCard>
      }
    />
      )}
    </ModuleStateBoundary>
  );
}
