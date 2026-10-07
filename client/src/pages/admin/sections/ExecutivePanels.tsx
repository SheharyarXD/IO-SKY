/*
 * IO SKY — Admin Portal · Executive Overview panels backed by real data.
 *
 * These replace panels that used to show invented rows ("Suspicious Login
 * Detected, IP 185.234.*.*") and unmeasured claims ("Backup System: Protected").
 * Each panel only states what a query can back, and says so when there is
 * nothing to show.
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const card = "rounded-[16px] border border-white/[0.07] bg-[#103438]/85 p-4";
const label = "font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55";

function ago(d: string | Date) {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function CriticalAlertsPanel() {
  const q = trpc.adminOps.notifications.useQuery({ unreadOnly: false, limit: 40 }, { staleTime: 30_000, retry: false });
  const urgent = (q.data?.rows ?? []).filter((n) => n.priority === "critical" || n.priority === "high").slice(0, 5);
  const unreadUrgent = urgent.filter((n) => !n.readAt).length;
  return (
    <div className={cn(card, "lg:col-span-3 flex flex-col")}>
      <div className="flex items-center justify-between">
        <div className={label}>Critical Alerts</div>
        <Link href="/admin/governance" className="text-[11px] text-[#F58A1F] hover:underline">Open governance</Link>
      </div>
      {q.isLoading ? (
        <p className="mt-4 text-[12px] text-white/50">Loading…</p>
      ) : urgent.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-white/60">No high priority alerts. Alerts appear here when an alert rule fires or a critical incident is registered.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {urgent.map((n) => (
            <li key={n.id} className="px-2.5 py-2 rounded-[10px] bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] text-[#E6EAF0] truncate font-medium">{n.title}</span>
                <span className={cn("text-[10px] font-mono uppercase", n.priority === "critical" ? "text-red-300" : "text-amber-300")}>{n.priority}</span>
              </div>
              {n.body ? <div className="text-[11px] text-white/55 truncate">{n.body}</div> : null}
              <div className="text-[10px] font-mono text-white/40 mt-0.5">{ago(n.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 text-[11px] text-[#F58A1F]">{unreadUrgent} unread</div>
    </div>
  );
}

export function AutomationPanel() {
  const defs = trpc.admin.workflowDefinitions.useQuery(undefined, { staleTime: 30_000, retry: false });
  const runs = trpc.admin.workflowRuns.useQuery(undefined, { staleTime: 30_000, retry: false });
  const d = (defs.data ?? []) as Array<{ enabled: number }>;
  const r = (runs.data ?? []) as Array<{ status: string; id: number; triggerType: string; ranAt: string | Date }>;
  const failed = r.filter((x) => x.status === "failed");
  const stat = (v: number, t: string, tone: string) => (
    <div className="rounded-[10px] bg-white/[0.02] border border-white/[0.05] p-2 text-center">
      <div className={cn("text-[18px] font-semibold leading-none", tone)}>{v}</div>
      <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/55 mt-1">{t}</div>
    </div>
  );
  return (
    <div className={cn(card, "lg:col-span-3")}>
      <div className="flex items-center justify-between">
        <div className={label}>Automation Center</div>
        <Link href="/admin/automations" className="text-[11px] text-[#F58A1F] hover:underline">View all</Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {stat(d.length, "Workflows", "text-white")}
        {stat(d.filter((x) => x.enabled === 1).length, "Enabled", "text-emerald-300")}
        {stat(failed.length, "Failed runs", failed.length ? "text-red-300" : "text-emerald-300")}
      </div>
      <div className={cn(label, "mt-4")}>Recent failures</div>
      {failed.length === 0 ? (
        <p className="mt-2 text-[12px] text-white/55">{r.length === 0 ? "No workflow has run yet." : "No recent run has failed."}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-[12px]">
          {failed.slice(0, 4).map((x) => (
            <li key={x.id} className="flex items-center justify-between text-white/75">
              <span className="truncate">{x.triggerType}</span>
              <span className="font-mono text-white/45">{ago(x.ranAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HealthPanel() {
  const q = trpc.adminOps.platformHealth.useQuery(undefined, { staleTime: 30_000, retry: false });
  const h = q.data;
  const row = (name: string, ok: boolean, okText: string, offText: string) => (
    <div key={name} className="flex items-center justify-between px-2.5 py-2 rounded-[10px] bg-white/[0.02] border border-white/[0.05] text-[12px]">
      <span className="text-white/85 truncate">{name}</span>
      <span className={cn("text-[10px] font-mono uppercase tracking-[0.14em]", ok ? "text-emerald-300" : "text-amber-300")}>{ok ? okText : offText}</span>
    </div>
  );
  return (
    <div className={cn(card, "lg:col-span-3")}>
      <div className="flex items-center justify-between">
        <div className={label}>System Health Overview</div>
        <Link href="/admin/governance" className="text-[11px] text-[#F58A1F] hover:underline">Details</Link>
      </div>
      {!h ? (
        <p className="mt-4 text-[12px] text-white/50">{q.isLoading ? "Loading…" : "Health data is unavailable."}</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {row("Database", h.capacity.databaseSizeMb !== null || Object.values(h.capacity.tableRows).some((n) => n > 0), "Reachable", "Not confirmed")}
          {h.integrations.providers.map((p) => row(p.name, p.configured, "Configured", "Not configured"))}
          {row("Email, last 24h", h.integrations.email24h.failed === 0, `${h.integrations.email24h.sent} sent`, `${h.integrations.email24h.failed} failed`)}
          {row("Open incidents", h.openIncidents.security + h.openIncidents.operational === 0, "None", `${h.openIncidents.security + h.openIncidents.operational} open`)}
        </div>
      )}
      <p className="mt-3 text-[10.5px] text-white/40">Backups and disaster recovery are provided by the database host and are not measured here.</p>
    </div>
  );
}

export function PendingPanel() {
  const review = trpc.adminOps.aiScanReviewQueue.useQuery({ statuses: ["awaiting_expert_review"] }, { staleTime: 30_000, retry: false });
  const approvals = trpc.adminOps.pendingApprovals.useQuery(undefined, { staleTime: 30_000, retry: false });
  const follow = trpc.adminOps.followUps.useQuery(undefined, { staleTime: 30_000, retry: false });
  const time = trpc.adminOps.timeEntries.useQuery({ status: "submitted" }, { staleTime: 30_000, retry: false });
  const fin = trpc.adminOps.financialSummary.useQuery(undefined, { staleTime: 30_000, retry: false });
  const rows: Array<{ lab: string; v: number | undefined; href: string }> = [
    { lab: "Reports awaiting expert review", v: review.data?.length, href: "/admin/governance" },
    { lab: "Approvals waiting on customers", v: approvals.data?.length, href: "/admin/delivery" },
    { lab: "Follow ups open", v: follow.data?.length, href: "/admin/sales" },
    { lab: "Time entries to review", v: time.data?.length, href: "/admin/delivery" },
    { lab: "Invoices awaiting payment", v: fin.data?.openInvoices, href: "/admin/billing" },
  ];
  return (
    <div className={cn(card, "lg:col-span-2")}>
      <div className={label}>Upcoming & Pending</div>
      <ul className="mt-3 space-y-1.5 text-[12px]">
        {rows.map((r) => (
          <li key={r.lab}>
            <Link href={r.href} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-[10px] hover:bg-white/[0.04]">
              <span className="text-white/75 truncate">{r.lab}</span>
              <span className="font-mono text-[#F58A1F] bg-[#F58A1F]/10 border border-[#F58A1F]/25 px-1.5 rounded">{r.v === undefined ? "…" : r.v}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompliancePanel() {
  const q = trpc.adminOps.compliance.useQuery(undefined, { staleTime: 60_000, retry: false });
  const c = q.data;
  return (
    <div className={cn(card, "lg:col-span-5 flex flex-col")}>
      <div className="flex items-center justify-between">
        <div className={label}>Compliance and Security Posture</div>
        <Link href="/admin/governance" className="text-[11px] text-[#F58A1F] hover:underline">Open governance</Link>
      </div>
      {!c ? (
        <p className="mt-4 text-[12px] text-white/50">{q.isLoading ? "Checking…" : "Compliance data is unavailable."}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { v: c.summary.pass, t: "Passing", tone: "text-emerald-300" },
              { v: c.summary.warn, t: "Warning", tone: "text-amber-300" },
              { v: c.summary.fail, t: "Failing", tone: c.summary.fail ? "text-red-300" : "text-emerald-300" },
            ].map((b) => (
              <div key={b.t} className="rounded-[10px] bg-white/[0.02] border border-white/[0.05] p-2">
                <div className={cn("text-[22px] font-semibold leading-none", b.tone)}>{b.v}</div>
                <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/55 mt-1">{b.t}</div>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-[12px]">
            {c.checks.map((k) => (
              <li key={k.key} className="flex items-center justify-between gap-2 text-white/80">
                <span className="truncate">{k.title}</span>
                <span className={cn("font-mono text-[10px] uppercase", k.status === "pass" ? "text-emerald-300" : k.status === "warn" ? "text-amber-300" : "text-red-300")}>{k.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function AiGovernancePanel() {
  const agents = trpc.adminOps.aiAgents.useQuery(undefined, { staleTime: 60_000, retry: false });
  const execs = trpc.adminOps.aiExecutions.useQuery({}, { staleTime: 60_000, retry: false });
  const runs = execs.data ?? [];
  const decided = new Set(runs.map((e) => e.subjectRef).filter((x): x is string => !!x?.startsWith("execution:")));
  const waiting = runs.filter((e) => e.outcome === "awaiting_approval" && !decided.has("execution:" + e.id)).length;
  const blocked = runs.filter((e) => e.outcome === "blocked_by_permission").length;
  const list = agents.data ?? [];
  return (
    <div className={cn(card, "lg:col-span-4 flex flex-col")}>
      <div className="flex items-center justify-between">
        <div className={label}>AI Governance</div>
        <Link href="/admin/agents" className="text-[11px] text-[#F58A1F] hover:underline">Open registry</Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { v: list.length, t: "Agents", tone: "text-white" },
          { v: waiting, t: "Awaiting a person", tone: waiting ? "text-amber-300" : "text-emerald-300" },
          { v: blocked, t: "Runs refused", tone: blocked ? "text-amber-300" : "text-white" },
        ].map((b) => (
          <div key={b.t} className="rounded-[10px] bg-white/[0.02] border border-white/[0.05] p-2">
            <div className={cn("text-[22px] font-semibold leading-none", b.tone)}>{b.v}</div>
            <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/55 mt-1">{b.t}</div>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-[12px]">
        {list.length === 0 ? <li className="text-white/55">No agent is registered yet.</li> : null}
        {list.map((a) => (
          <li key={a.key} className="flex items-center justify-between gap-2 text-white/80">
            <span className="truncate">{a.name}</span>
            <span className={cn("font-mono text-[10px] uppercase", a.status === "active" ? "text-emerald-300" : "text-white/45")}>{a.status}</span>
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-3 text-[10.5px] text-white/40">Every AI action is checked against the agent's permissions and recorded. A report an agent drafts is held for a person to approve.</p>
    </div>
  );
}

export function PipelinePanel() {
  const q = trpc.adminOps.opportunities.useQuery({}, { staleTime: 60_000, retry: false });
  const rows = q.data?.pipeline ?? [];
  const open = rows.filter((r) => r.stage !== "won" && r.stage !== "lost");
  const openValue = open.reduce((a, r) => a + r.valueCents, 0);
  return (
    <div className={cn(card, "lg:col-span-3")}>
      <div className="flex items-center justify-between">
        <div className={label}>Sales Pipeline</div>
        <Link href="/admin/sales" className="text-[11px] text-[#F58A1F] hover:underline">Open sales</Link>
      </div>
      <div className="mt-2 font-display font-semibold text-[22px]">EUR {(openValue / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}</div>
      <div className="text-[11px] text-white/45">open across {open.reduce((a, r) => a + r.count, 0)} opportunities</div>
      {rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-white/55">No opportunities yet.</p>
      ) : (
        <ul className="mt-3 space-y-1 text-[12px]">
          {rows.map((r) => (
            <li key={r.stage} className="flex items-center justify-between text-white/75">
              <span className="capitalize">{r.stage}</span>
              <span className="font-mono text-white/55">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccessPanel() {
  const q = trpc.admin.developers.useQuery(undefined, { staleTime: 60_000, retry: false });
  const data = q.data as { scopes?: Array<{ developerId: number; level: string; status: string; expiresMs: number | null }> } | undefined;
  const now = Date.now();
  const live = (data?.scopes ?? []).filter((s) => s.status === "active" && s.level !== "baseline" && (s.expiresMs === null || s.expiresMs > now));
  return (
    <div className={cn(card, "lg:col-span-4")}>
      <div className="flex items-center justify-between">
        <div className={label}>Temporary Access Control</div>
        <Link href="/admin/developers" className="text-[11px] text-[#F58A1F] hover:underline">Manage</Link>
      </div>
      {live.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-white/60">No elevated developer access is active.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-[12px]">
          {live.slice(0, 6).map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-[10px] bg-white/[0.02] border border-white/[0.05]">
              <span className="text-white/85">Developer #{s.developerId}, {s.level}</span>
              <span className="font-mono text-white/55">
                {s.expiresMs === null ? "no expiry" : "expires " + new Date(s.expiresMs).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
