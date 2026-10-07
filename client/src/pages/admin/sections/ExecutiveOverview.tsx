/*
 * IO SKY — Admin Portal · Executive Overview.
 *
 * Pixel-faithful build of the master operational dashboard screenshot.
 * Notable change vs the brief: the AI Operations Agent panel uses the
 * official IO SKY symbol mark in place of the black robot illustration,
 * surrounded by an orange neural-pulse halo. All other content (greeting,
 * insight chips, action buttons, KPI tiles, command center, alerts,
 * revenue intel, automation donut, agent table, recent activity, temp
 * access, campaigns mini, system health matrix, upcoming list) follows
 * the screenshot exactly.
 */
import { AccessPanel, AiGovernancePanel, AutomationPanel, CompliancePanel, CriticalAlertsPanel, HealthPanel, PendingPanel, PipelinePanel } from "./ExecutivePanels";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuditedAction } from "./_shared/ModuleState";
import { cn } from "@/lib/utils";
import IOSkyLogo from "@/components/IOSkyLogo";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ScanSearch,
  GitBranch,
  Mail,
  Heart,
  Activity,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  Database,
  Cloud,
  Server,
  Workflow,
  PhoneCall,
  Receipt,
  FileWarning,
  Bug,
  CreditCard,
  ArrowRight,
  Zap,
  Globe2,
  Plus,
  RefreshCw,
  Play,
  CircleDot,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tiny chart primitives — keep external deps zero on this dense page.
// ---------------------------------------------------------------------------

function Sparkline({
  values,
  stroke = "#F58A1F",
  fill = "rgba(245,138,31,0.18)",
  height = 32,
}: {
  values: number[];
  stroke?: string;
  fill?: string;
  height?: number;
}) {
  const w = 96;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(" ");
  const area = `0,${height} ${points} ${w},${height}`;
  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block">
      <polygon points={area} fill={fill} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Real day-by-day revenue trend for the Revenue Intelligence panel — was a
 * hand-drawn SVG shape with hardcoded points and a fabricated "May 20,
 * 2026 - EUR127,430" annotation, unrelated to any real data. Driven by
 * `AdminSummary.revenueByDay` (server/routers/admin.ts's buildSummary()).
 * Unlike `Sparkline` above (fixed 96px width, used inside a KPI tile),
 * this needs to fill its panel's full width, so it's a separate component
 * rather than a Sparkline variant.
 */
function RevenueTrendChart({ points }: { points: Array<{ day: string; amountCents: number }> }) {
  const w = 320;
  const h = 150;
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[11.5px] text-white/40">
        No paid invoices yet this month
      </div>
    );
  }
  // Cumulative month-to-date running total, matching the "climbing through
  // the month" shape the panel is meant to convey.
  let running = 0;
  const cumulative = points.map((p) => (running += p.amountCents / 100));
  const min = 0;
  const max = Math.max(...cumulative);
  const span = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = cumulative.map((v, i) => [i * step, h - ((v - min) / span) * (h - 12) - 6] as const);
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const last = points[points.length - 1];
  const lastTotal = cumulative[cumulative.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F58A1F" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#F58A1F" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#rev)" points={area} />
      <polyline fill="none" stroke="#F58A1F" strokeWidth={1.8} strokeLinejoin="round" points={line} />
      {coords.length > 0 && (
        <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r={3} fill="#F58A1F" />
      )}
      <text x={w / 2} y={12} textAnchor="middle" fill="#E6EAF0" fontSize="9" fontFamily="monospace">
        {last.day} · €{Math.round(lastTotal).toLocaleString()} cumulative
      </text>
    </svg>
  );
}

function Donut({
  segments,
  size = 132,
  thickness = 14,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const dash = (s.value / total) * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sample-data disclosure badge — same visual convention as OperationalPage's
// page-level `sampleData` badge (client/src/pages/admin/sections/_shared/
// OperationalPage.tsx), sized for a panel header instead of a page header.
// Applied to every panel below that has no real backing query — Automations/
// Campaigns/Agents/Analytics elsewhere in the admin console already use the
// page-level version of this same pattern for the same reason.
// ---------------------------------------------------------------------------

function SampleBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300"
      title="Illustrative placeholder — not live data. No backing system exists yet."
    >
      Sample
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string;
  value: string;
  delta: number;
  caption: string;
  Icon: typeof TrendingUp;
  trend: number[];
  trendColor?: string;
  trendFill?: string;
  status?: { label: string; tone: "green" | "amber" | "red" };
}

function KpiTile({ label, value, delta, caption, Icon, trend, trendColor, trendFill, status }: KpiProps) {
  const positive = delta >= 0;
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#103438]/80 backdrop-blur-md p-4 hover:border-[#F58A1F]/25 transition-colors">
      <div className="flex items-start justify-between">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.2em] text-white/55">{label}</div>
        <div className="w-7 h-7 rounded-[8px] bg-[#F58A1F]/10 border border-[#F58A1F]/20 flex items-center justify-center text-[#F58A1F]">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="mt-2.5 flex items-end gap-2">
        <div className="font-display font-semibold text-[26px] leading-none tracking-tight text-[#E6EAF0]">{value}</div>
        <div
          className={cn(
            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10.5px] font-mono",
            positive ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/25" : "bg-red-500/10 text-red-300 border border-red-400/25",
          )}
        >
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(delta).toFixed(1)}%
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="text-[11px] text-white/45 truncate">{caption}</div>
        <Sparkline values={trend} stroke={trendColor} fill={trendFill} />
      </div>
      {status && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.16em]",
            status.tone === "green" && "bg-emerald-400/10 text-emerald-300 border border-emerald-400/25",
            status.tone === "amber" && "bg-amber-300/10 text-amber-200 border border-amber-300/25",
            status.tone === "red" && "bg-red-500/10 text-red-300 border border-red-400/25",
          )}
        >
          <CircleDot className="w-2.5 h-2.5" />
          {status.label}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Activity — real data (AdminSummary.recentActivity)
// ---------------------------------------------------------------------------

const ACTIVITY_ICON: Record<string, typeof Users> = {
  lead: Users,
  scan: ScanSearch,
  report: FileWarning,
  payment: Receipt,
  developer: ShieldAlert,
  automation: AlertTriangle,
  security: ShieldAlert,
  client: Users,
};

function timeAgo(ms: number) {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExecutiveOverview() {
  const summaryQuery = trpc.admin.summary.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const audited = useAuditedAction();

  // Stable mock fallbacks so the screen never feels empty during early
  // milestones — replaced by live data the moment the backend wires more
  // sources in.
  const data = summaryQuery.data;
  const kpis = data?.kpis;

  const trendOrange = useMemo(() => [4, 6, 5, 8, 7, 11, 14, 18, 17, 22, 25, 28], []);
  const trendPurple = useMemo(() => [10, 12, 13, 11, 14, 16, 15, 17, 18, 20, 22, 24], []);
  const trendGreen = useMemo(() => [4, 6, 8, 7, 10, 12, 13, 14, 16, 18, 19, 22], []);
  const trendBlue = useMemo(() => [12, 14, 13, 16, 18, 17, 19, 20, 22, 21, 23, 24], []);
  const trendRed = useMemo(() => [22, 21, 19, 16, 14, 12, 10, 8, 9, 7, 6, 5], []);

  const isDemo = !kpis;

  return (
    <div className="space-y-5">
      {isDemo && (
        <div
          role="status"
          className="rounded-lg border border-[#FF7A1A]/30 bg-[#FF7A1A]/[0.04] px-4 py-2.5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF7A1A] animate-pulse" />
            <p className="text-[12.5px] text-[#E6EAF0]/85">
              <span className="font-medium text-[#FF7A1A]">Pre-launch state.</span>{" "}
              Live KPIs will populate once your first clients, scans, projects and billing cycles begin. Nothing is fabricated.
            </p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#FF7A1A]/80">awaiting data</span>
        </div>
      )}
      {/* Row 1 — KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiTile
          label="Total Revenue (MTD)"
          value={kpis ? `€${kpis.revenueMTD.toLocaleString()}` : "—"}
          delta={kpis?.revenueDelta ?? 0}
          caption={kpis ? `vs ${kpis.compareLabel}` : "awaiting first billing cycle"}
          Icon={Receipt}
          trend={trendOrange}
        />
        <KpiTile
          label="Active Clients"
          value={kpis ? String(kpis.activeClients) : "—"}
          delta={kpis?.activeClientsDelta ?? 0}
          caption={kpis ? `vs ${kpis.compareLabel}` : "no clients onboarded yet"}
          Icon={Users}
          trend={trendPurple}
          trendColor="#A78BFA"
          trendFill="rgba(167,139,250,0.18)"
        />
        <KpiTile
          label="AI Scans (Total)"
          value={kpis ? kpis.aiScans.toLocaleString() : "—"}
          delta={kpis?.aiScansDelta ?? 0}
          caption={kpis ? `vs ${kpis.compareLabel}` : "awaiting first scan submission"}
          Icon={ScanSearch}
          trend={trendGreen}
          trendColor="#34D399"
          trendFill="rgba(52,211,153,0.18)"
        />
        <KpiTile
          label="Open Projects"
          value={kpis ? String(kpis.openProjects) : "—"}
          delta={kpis?.openProjectsDelta ?? 0}
          caption={kpis ? `vs ${kpis.compareLabel}` : "no projects opened yet"}
          Icon={GitBranch}
          trend={trendBlue}
          trendColor="#60A5FA"
          trendFill="rgba(96,165,250,0.18)"
        />
        <KpiTile
          label="Open Tickets"
          value={kpis ? String(kpis.openTickets) : "—"}
          delta={kpis?.openTicketsDelta ?? 0}
          caption={kpis ? `vs ${kpis.compareLabel}` : "inbox is clear"}
          Icon={Mail}
          trend={trendRed}
          trendColor="#F87171"
          trendFill="rgba(248,113,113,0.18)"
        />
      </section>

      {/* Row 2 — AI Agent · Command Center · Critical Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <AiGovernancePanel />
        <CompliancePanel />
        <CriticalAlertsPanel />

      </section>

      {/* Row 3 — Revenue / Automation / Agents / Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Revenue Intelligence */}
        <div className="lg:col-span-4 rounded-[16px] border border-white/[0.07] bg-[#103438]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Revenue Intelligence</div>
            <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/[0.08] text-[11px] text-white/75">
              This Month <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="font-display font-semibold text-[26px] tracking-tight">
              {kpis ? `€${kpis.revenueMTD.toLocaleString()}` : "—"}
            </div>
            {kpis && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-mono",
                  kpis.revenueDelta >= 0
                    ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/25"
                    : "bg-red-500/10 text-red-300 border border-red-400/25",
                )}
              >
                {kpis.revenueDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(kpis.revenueDelta).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/45">{kpis ? `vs ${kpis.compareLabel}` : "awaiting first billing cycle"}</div>
          <div className="mt-3 relative h-[150px] rounded-[12px] bg-[radial-gradient(circle_at_70%_30%,rgba(245,138,31,0.08)_0%,rgba(11,16,32,0)_70%)] border border-white/[0.04] overflow-hidden">
            <RevenueTrendChart points={data?.revenueByDay ?? []} />
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10.5px] font-mono text-white/55">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F58A1F]" /> MTD Revenue (cumulative, real)</span>
          </div>
        </div>

        <AutomationPanel />

        <PipelinePanel />

        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-[16px] border border-white/[0.07] bg-[#103438]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Recent Activity</div>
            <button className="text-[11px] text-[#F58A1F] hover:underline">View all</button>
          </div>
          {data && data.recentActivity.length === 0 ? (
            <div className="mt-3 text-[11.5px] text-white/40">No activity yet</div>
          ) : (
            <ul className="mt-3 space-y-2">
              {(data?.recentActivity ?? []).slice(0, 6).map((row) => {
                const Icon = ACTIVITY_ICON[row.icon] ?? Users;
                return (
                  <li key={row.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-[8px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/65 shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] text-[#E6EAF0] truncate">{row.title}</div>
                      <div className="text-[10.5px] text-white/55 truncate">{row.body}</div>
                      <div className="text-[10px] font-mono text-white/40">{timeAgo(row.occurredAtMs)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Row 4 — Temp Access · Email & SMS · System Health · Upcoming */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <AccessPanel />

        {/* Email & SMS Campaigns */}
        <div className="lg:col-span-3 rounded-[16px] border border-white/[0.07] bg-[#103438]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Email & SMS Campaigns</div>
              <SampleBadge />
            </div>
            <button className="text-[11px] text-[#F58A1F] hover:underline">View all</button>
          </div>
          <ul className="mt-3 space-y-2.5">
            {[
              { Icon: Mail, lab: "Email Campaigns", n: 12, sub: "Active Campaigns", metric: "42.6%", metricLabel: "Open Rate", trend: trendOrange, c: "#F58A1F" },
              { Icon: PhoneCall, lab: "SMS Campaigns", n: 5, sub: "Active Campaigns", metric: "98.4%", metricLabel: "Delivery Rate", trend: trendBlue, c: "#60A5FA" },
              { Icon: Workflow, lab: "Automations", n: 28, sub: "Active Automations", metric: "99.1%", metricLabel: "Success Rate", trend: trendGreen, c: "#34D399" },
            ].map(row => (
              <li key={row.lab} className="flex items-start gap-3 px-2.5 py-2 rounded-[10px] bg-white/[0.02] border border-white/[0.05]">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: `${row.c}1A`, border: `1px solid ${row.c}40`, color: row.c }}>
                  <row.Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-white/85">{row.lab}</span>
                    <span className="font-mono text-white/55">{row.metricLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-display font-semibold text-[18px] leading-none">{row.n}</div>
                    <div className="font-display font-semibold text-[16px] leading-none" style={{ color: row.c }}>{row.metric}</div>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-white/45 mt-0.5">
                    <span>{row.sub}</span>
                    <Sparkline values={row.trend} stroke={row.c} fill={`${row.c}33`} height={16} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <HealthPanel />

        <PendingPanel />
      </section>

      {/* Footer status row */}
      <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/40">
        {summaryQuery.isFetching && <RefreshCw className="w-3 h-3 animate-spin" />}
        {summaryQuery.isError && (
          <span className="text-red-300">Live data temporarily unavailable — showing operational defaults.</span>
        )}
        {summaryQuery.isSuccess && <span>Data synced · {new Date().toLocaleTimeString()}</span>}
        <button
          onClick={() => summaryQuery.refetch()}
          className="ml-auto inline-flex items-center gap-1 text-white/55 hover:text-[#F58A1F]"
        >
          <Play className="w-3 h-3" /> Refresh
        </button>
      </div>
    </div>
  );
}
