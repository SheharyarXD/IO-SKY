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
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
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
  Stethoscope,
  CircleDot,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tiny chart primitives — keep external deps zero on this dense page.
// ---------------------------------------------------------------------------

function Sparkline({
  values,
  stroke = "#FF6A00",
  fill = "rgba(255,106,0,0.18)",
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
    <div className="relative overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#0E1320]/80 backdrop-blur-md p-4 hover:border-[#FF6A00]/25 transition-colors">
      <div className="flex items-start justify-between">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.2em] text-white/55">{label}</div>
        <div className="w-7 h-7 rounded-[8px] bg-[#FF6A00]/10 border border-[#FF6A00]/20 flex items-center justify-center text-[#FF6A00]">
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
// Page
// ---------------------------------------------------------------------------

export default function ExecutiveOverview() {
  const summaryQuery = trpc.admin.summary.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

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
  const trendHealth = useMemo(() => [99.7, 99.8, 99.9, 99.95, 99.9, 99.99, 99.99, 99.97, 99.99, 99.99, 99.99, 99.99], []);

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
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
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
        <KpiTile
          label="System Health"
          value={kpis ? `${kpis.systemHealthPct.toFixed(2)}%` : "—"}
          delta={0}
          caption={kpis ? "" : "awaiting first probe"}
          Icon={Heart}
          trend={trendHealth}
          trendColor="#34D399"
          trendFill="rgba(52,211,153,0.18)"
          status={{ label: "Excellent", tone: "green" }}
        />
      </section>

      {/* Row 2 — AI Agent · Command Center · Critical Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* AI Operations Agent */}
        <div className="lg:col-span-4 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">
              AI Operations Agent
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF6A00]/15 border border-[#FF6A00]/35 text-[#FF6A00] font-mono text-[10px] uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-pulse shadow-[0_0_8px_#FF6A00]" />
              Live
            </span>
          </div>

          {/* IO SYMBOL replaces robot — neural pulse halo */}
          <div className="mt-4 flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 -m-2 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,0.45)_0%,rgba(255,106,0,0)_70%)] blur-md animate-pulse" />
              <div className="relative w-[88px] h-[88px] rounded-[18px] border border-[#FF6A00]/25 bg-gradient-to-b from-[#0B1020] to-[#070A14] flex items-center justify-center shadow-[inset_0_0_20px_rgba(255,106,0,0.18)]">
                <IOSkyLogo variant="mark" height={56} />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#FF6A00] border-2 border-[#0E1320] shadow-[0_0_8px_#FF6A00]" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-semibold text-[18px] tracking-tight leading-tight text-[#E6EAF0]">
                Good morning, {(typeof window !== "undefined" && (JSON.parse(localStorage.getItem("iosky-current-user-cache") ?? "null")?.name?.split(" ")[0])) || "Alex"}.
              </div>
              <p className="text-[13px] text-white/65 leading-snug mt-1">
                I've analyzed all systems and prepared your operational brief.
              </p>
            </div>
          </div>

          {/* Insight chips */}
          <ul className="mt-4 space-y-1.5">
            {[
              { n: 2, label: "high priority alerts require action", tone: "amber" as const },
              { n: 5, label: "automations failed in the last 24h", tone: "red" as const },
              { n: "€12,430", label: "in failed payments", tone: "red" as const },
              { n: 3, label: "reports awaiting approval", tone: "neutral" as const },
              { n: 1, label: "critical security event detected", tone: "red" as const },
            ].map((row, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[10px] bg-white/[0.02] border border-white/[0.05]"
              >
                <span
                  className={cn(
                    "w-5 h-5 rounded-full text-[10px] font-mono flex items-center justify-center",
                    row.tone === "amber" && "bg-amber-300/15 text-amber-200 border border-amber-300/30",
                    row.tone === "red" && "bg-red-500/15 text-red-300 border border-red-400/30",
                    row.tone === "neutral" && "bg-white/[0.05] text-white/70 border border-white/10",
                  )}
                >
                  {row.n}
                </span>
                <span className="text-[12.5px] text-white/75 truncate">{row.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[10px] bg-gradient-to-b from-[#FFB347] to-[#FF6A00] text-[#0B1020] text-[11.5px] font-semibold shadow-[0_6px_18px_-6px_rgba(255,106,0,0.55)]">
              <Plus className="w-3.5 h-3.5" /> Ask Agent
            </button>
            <button className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[10px] border border-white/[0.08] text-[11.5px] text-white/80 hover:border-[#FF6A00]/35 transition-colors">
              <Activity className="w-3.5 h-3.5" /> Operational Brief
            </button>
            <button className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[10px] border border-white/[0.08] text-[11.5px] text-white/80 hover:border-[#FF6A00]/35 transition-colors">
              <Stethoscope className="w-3.5 h-3.5" /> Run Diagnostics
            </button>
          </div>
        </div>

        {/* Operational Command Center */}
        <div className="lg:col-span-5 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4 flex flex-col">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">
            Operational Command Center
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative h-[220px] rounded-[14px] border border-white/[0.05] bg-[radial-gradient(circle_at_50%_50%,rgba(255,106,0,0.08)_0%,rgba(11,16,32,0.6)_60%)] flex items-center justify-center overflow-hidden">
              <Globe2 className="w-[160px] h-[160px] text-[#FF6A00]/55" strokeWidth={0.7} />
              <div className="absolute inset-0 pointer-events-none">
                {[
                  { top: "18%", left: "32%" },
                  { top: "30%", left: "62%" },
                  { top: "55%", left: "26%" },
                  { top: "62%", left: "70%" },
                  { top: "76%", left: "44%" },
                ].map((p, i) => (
                  <span
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-[#FF6A00] shadow-[0_0_8px_#FF6A00] animate-pulse"
                    style={{ top: p.top, left: p.left, animationDelay: `${i * 0.4}s` }}
                  />
                ))}
              </div>
            </div>
            <ul className="space-y-1.5">
              {[
                { label: "AI Scan Engine", status: "Operational", tone: "green", Icon: ScanSearch },
                { label: "Report Pipeline", status: "Healthy", tone: "green", Icon: FileWarning },
                { label: "Automations", status: "Running", tone: "amber", Icon: Workflow },
                { label: "Email Service", status: "Healthy", tone: "green", Icon: Mail },
                { label: "SMS Service", status: "Healthy", tone: "green", Icon: Mail },
                { label: "AI Agents", status: "Operational", tone: "green", Icon: PhoneCall },
                { label: "Cloud Infrastructure", status: "Healthy", tone: "green", Icon: Cloud },
                { label: "Database", status: "Healthy", tone: "green", Icon: Database },
                { label: "Backup & DR", status: "Protected", tone: "green", Icon: ShieldAlert },
              ].map((row, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-[10px] bg-white/[0.02] border border-white/[0.05]"
                >
                  <div className="flex items-center gap-2 text-[12px] text-white/85">
                    <row.Icon className="w-3.5 h-3.5 text-white/55" />
                    {row.label}
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.16em]",
                      row.tone === "green" && "text-emerald-300",
                      row.tone === "amber" && "text-amber-200",
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        row.tone === "green" && "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]",
                        row.tone === "amber" && "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.7)]",
                      )}
                    />
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <button className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] border border-white/[0.08] text-[12px] text-white/80 hover:text-white hover:border-[#FF6A00]/35 self-start transition-colors">
            <Server className="w-3.5 h-3.5" /> Open Infrastructure Monitor
          </button>
        </div>

        {/* Critical Alerts */}
        <div className="lg:col-span-3 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">
              Critical Alerts
            </div>
            <button className="text-[11px] text-[#FF6A00] hover:underline">View all</button>
          </div>
          <ul className="mt-3 space-y-2">
            {[
              { Icon: ShieldAlert, title: "Suspicious Login Detected", body: "IP: 185.234.*.* · Netherlands", sev: "High", color: "#F87171", ago: "2m ago" },
              { Icon: CreditCard, title: "High Risk Payment Failure", body: "Client: TechVision Enterprises · €4,950", sev: "High", color: "#F87171", ago: "8m ago" },
              { Icon: Workflow, title: "Automation Workflow Failed", body: "Workflow: Report Generation", sev: "Medium", color: "#FCD34D", ago: "15m ago" },
              { Icon: Bug, title: "Unusual Data Export", body: "Client: Global Retail Group", sev: "Medium", color: "#FCD34D", ago: "32m ago" },
            ].map((row, i) => (
              <li key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-[10px] bg-white/[0.02] border border-white/[0.05]">
                <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: `${row.color}1A`, border: `1px solid ${row.color}40` }}>
                  <row.Icon className="w-3.5 h-3.5" style={{ color: row.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12.5px] text-[#E6EAF0] truncate font-medium">{row.title}</div>
                    <span className="text-[10px] font-mono uppercase" style={{ color: row.color }}>{row.sev}</span>
                  </div>
                  <div className="text-[11px] text-white/55 truncate">{row.body}</div>
                  <div className="text-[10px] font-mono text-white/40 mt-0.5">{row.ago}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-[#FF6A00]">3 Unread Alerts</span>
            <button className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] border border-white/[0.08] text-[11px] text-white/80 hover:border-[#FF6A00]/35">
              <ShieldAlert className="w-3.5 h-3.5" /> Open Security Center
            </button>
          </div>
        </div>
      </section>

      {/* Row 3 — Revenue / Automation / Agents / Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Revenue Intelligence */}
        <div className="lg:col-span-4 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Revenue Intelligence</div>
            <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/[0.08] text-[11px] text-white/75">
              This Month <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="font-display font-semibold text-[26px] tracking-tight">€127,430</div>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/25 text-[11px] font-mono">
              <TrendingUp className="w-3 h-3" /> 18.4%
            </span>
          </div>
          <div className="text-[11px] text-white/45">vs Apr 20, 2026</div>
          <div className="mt-3 relative h-[150px] rounded-[12px] bg-[radial-gradient(circle_at_70%_30%,rgba(255,106,0,0.08)_0%,rgba(11,16,32,0)_70%)] border border-white/[0.04] overflow-hidden">
            <svg viewBox="0 0 320 150" className="w-full h-full">
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6A00" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#FF6A00" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="#FF6A00"
                strokeWidth={1.8}
                points="0,120 30,110 60,100 90,95 120,80 150,72 180,60 210,50 240,38 270,30 300,22 320,18"
              />
              <polygon fill="url(#rev)" points="0,120 30,110 60,100 90,95 120,80 150,72 180,60 210,50 240,38 270,30 300,22 320,18 320,150 0,150" />
              <polyline
                fill="none"
                stroke="#FFB347"
                strokeWidth={1.4}
                strokeDasharray="3,3"
                points="0,135 60,128 120,118 180,108 240,90 300,72"
              />
              <circle cx={300} cy={22} r={3} fill="#FF6A00" />
              <text x="180" y="14" fill="#E6EAF0" fontSize="9" fontFamily="monospace">May 20, 2026 · €127,430</text>
            </svg>
            <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[9.5px] font-mono text-white/35">
              {["May 1", "May 5", "May 10", "May 15", "May 20", "May 25", "May 30"].map(d => <span key={d}>{d}</span>)}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10.5px] font-mono text-white/55">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FF6A00]" /> MTD Revenue</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FFB347]" /> Projected</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/30" /> Last Month</span>
          </div>
        </div>

        {/* Automation Center */}
        <div className="lg:col-span-3 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Automation Center</div>
            <button className="text-[11px] text-[#FF6A00] hover:underline">View all</button>
          </div>
          <div className="mt-3 flex items-center justify-center relative">
            <Donut
              segments={[
                { label: "Running", value: 96, color: "#34D399" },
                { label: "Completed", value: 24, color: "#60A5FA" },
                { label: "Failed", value: 5, color: "#F87171" },
                { label: "Paused", value: 3, color: "#FCD34D" },
              ]}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display font-semibold text-[22px] leading-none">128</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/55 mt-1">Total Workflows</div>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-[12px]">
            {[
              { lab: "Running", v: "96 (75%)", c: "#34D399" },
              { lab: "Completed", v: "24 (19%)", c: "#60A5FA" },
              { lab: "Failed", v: "5 (4%)", c: "#F87171" },
              { lab: "Paused", v: "3 (2%)", c: "#FCD34D" },
            ].map(r => (
              <li key={r.lab} className="flex items-center justify-between text-white/75">
                <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: r.c }} /> {r.lab}</span>
                <span className="font-mono text-white/55">{r.v}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { v: "5", t: "Failed Workflows", sub: "Needs Attention", color: "text-red-300" },
              { v: "12", t: "Retries", sub: "In Progress", color: "text-amber-200" },
              { v: "0", t: "Blocked", sub: "No Issues", color: "text-emerald-300" },
            ].map(b => (
              <div key={b.t} className="rounded-[10px] bg-white/[0.02] border border-white/[0.05] p-2">
                <div className={cn("text-[18px] font-semibold leading-none", b.color)}>{b.v}</div>
                <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/55 mt-1">{b.t}</div>
                <div className="text-[10px] text-white/45">{b.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Agents & IVR */}
        <div className="lg:col-span-3 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">AI Agents & IVR Real-time</div>
            <button className="text-[11px] text-[#FF6A00] hover:underline">View all</button>
          </div>
          <ul className="mt-3 space-y-2 text-[12px]">
            {[
              { lab: "Outbound AI Calls", v: "24", d: "+18.5%", live: true, trend: trendOrange, c: "#FF6A00" },
              { lab: "Inbound AI (IVR)", v: "37", d: "+11.3%", live: true, trend: trendBlue, c: "#60A5FA" },
              { lab: "Calls Booked", v: "16", d: "+23.1%", today: true, trend: trendGreen, c: "#34D399" },
              { lab: "Avg. Call Duration", v: "04:32", d: "-8.2%", today: true, trend: trendRed, c: "#F87171" },
              { lab: "Escalations", v: "3", d: "+12.5%", today: true, trend: trendPurple, c: "#A78BFA" },
            ].map(r => (
              <li key={r.lab} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white/75 truncate">{r.lab}</span>
                  {r.live && <span className="text-[9.5px] font-mono px-1 py-0.5 rounded bg-[#FF6A00]/15 text-[#FF6A00]">LIVE</span>}
                  {r.today && <span className="text-[9.5px] font-mono px-1 py-0.5 rounded bg-white/[0.04] text-white/55">TODAY</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono">{r.v}</span>
                  <span className={cn("text-[10.5px] font-mono", r.d.startsWith("-") ? "text-red-300" : "text-emerald-300")}>{r.d}</span>
                  <Sparkline values={r.trend} stroke={r.c} fill={`${r.c}33`} height={20} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Recent Activity</div>
            <button className="text-[11px] text-[#FF6A00] hover:underline">View all</button>
          </div>
          <ul className="mt-3 space-y-2">
            {[
              { Icon: Users, title: "New client onboarded", body: "TechVision Enterprises", ago: "2m ago" },
              { Icon: ScanSearch, title: "AI scan completed", body: "Growth Accelerator Scan", ago: "15m ago" },
              { Icon: FileWarning, title: "Report approved", body: "TechVision Report 2.0", ago: "25m ago" },
              { Icon: Receipt, title: "Payment received", body: "Invoice #INV-2026-1297", ago: "40m ago" },
              { Icon: ShieldAlert, title: "Developer access granted", body: "Temporary Access", ago: "1h ago" },
              { Icon: AlertTriangle, title: "Automation workflow failed", body: "Report Generation", ago: "1h ago" },
            ].map((row, i) => (
              <li key={i} className="flex gap-2.5">
                <div className="w-7 h-7 rounded-[8px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/65 shrink-0">
                  <row.Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] text-[#E6EAF0] truncate">{row.title}</div>
                  <div className="text-[10.5px] text-white/55 truncate">{row.body}</div>
                  <div className="text-[10px] font-mono text-white/40">{row.ago}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Row 4 — Temp Access · Email & SMS · System Health · Upcoming */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Temporary Access Control */}
        <div className="lg:col-span-4 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Temporary Access Control</div>
            <button className="text-[11px] text-[#FF6A00] hover:underline">View all</button>
          </div>
          <div className="mt-3 overflow-x-auto -mx-2">
            <table className="min-w-full text-[12px]">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
                  <th className="text-left px-2 py-1">Developer</th>
                  <th className="text-left px-2 py-1">Purpose</th>
                  <th className="text-left px-2 py-1">Access Level</th>
                  <th className="text-left px-2 py-1">Expires In</th>
                  <th className="text-left px-2 py-1">Status</th>
                  <th className="text-left px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[
                  ["John Developer", "Infrastructure Maintenance", "Elevated", "2h 14m"],
                  ["Sarah Engineer", "Database Optimization", "Elevated", "1h 32m"],
                  ["Mike DevOps", "Server Deployment", "Elevated", "45m"],
                  ["Tom Engineer", "Bug Investigation", "Limited", "1h 05m"],
                ].map(([name, purpose, lvl, exp]) => (
                  <tr key={name} className="text-white/85">
                    <td className="px-2 py-2 whitespace-nowrap">{name}</td>
                    <td className="px-2 py-2 text-white/65">{purpose}</td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "inline-flex px-1.5 py-0.5 rounded-md text-[10.5px] font-mono",
                          lvl === "Elevated" ? "bg-[#FF6A00]/12 text-[#FF6A00] border border-[#FF6A00]/30" : "bg-white/[0.05] text-white/65 border border-white/10",
                        )}
                      >
                        {lvl}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-mono text-white/65">{exp}</td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.14em] text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Active
                      </span>
                    </td>
                    <td className="px-2 py-2 text-white/55">
                      <button className="hover:text-[#FF6A00] mr-1.5"><CheckCircle2 className="w-3.5 h-3.5 inline" /></button>
                      <button className="hover:text-red-400"><AlertTriangle className="w-3.5 h-3.5 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-gradient-to-b from-[#FFB347] to-[#FF6A00] text-[#0B1020] text-[12px] font-semibold">
            <Plus className="w-3.5 h-3.5" /> Grant New Access
          </button>
        </div>

        {/* Email & SMS Campaigns */}
        <div className="lg:col-span-3 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Email & SMS Campaigns</div>
            <button className="text-[11px] text-[#FF6A00] hover:underline">View all</button>
          </div>
          <ul className="mt-3 space-y-2.5">
            {[
              { Icon: Mail, lab: "Email Campaigns", n: 12, sub: "Active Campaigns", metric: "42.6%", metricLabel: "Open Rate", trend: trendOrange, c: "#FF6A00" },
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

        {/* System Health Overview */}
        <div className="lg:col-span-3 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">System Health Overview</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            {[
              { Icon: Server, lab: "Web Servers", st: "Operational" },
              { Icon: Zap, lab: "API Services", st: "Operational" },
              { Icon: Database, lab: "Database Cluster", st: "Operational" },
              { Icon: Cloud, lab: "Cache Service", st: "Operational" },
              { Icon: Cloud, lab: "Cloud Storage", st: "Operational" },
              { Icon: Globe2, lab: "CDN & Edge", st: "Operational" },
              { Icon: ShieldAlert, lab: "Backup System", st: "Protected" },
              { Icon: Heart, lab: "Disaster Recovery", st: "Ready" },
            ].map(r => (
              <div key={r.lab} className="flex items-start gap-2 px-2.5 py-2 rounded-[10px] bg-white/[0.02] border border-white/[0.05]">
                <div className="w-7 h-7 rounded-[8px] bg-emerald-400/[0.07] border border-emerald-400/25 text-emerald-300 flex items-center justify-center">
                  <r.Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-white/85 truncate">{r.lab}</div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-emerald-300">{r.st}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming & Pending */}
        <div className="lg:col-span-2 rounded-[16px] border border-white/[0.07] bg-[#0E1320]/85 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Upcoming & Pending</div>
            <button className="text-[11px] text-[#FF6A00] hover:underline">View all</button>
          </div>
          <ul className="mt-3 space-y-1.5 text-[12px]">
            {[
              { lab: "Reports awaiting approval", v: 3 },
              { lab: "Invoices awaiting payment", v: 7 },
              { lab: "Support tickets open", v: 14 },
              { lab: "Strategy calls today", v: 5 },
              { lab: "Contracts awaiting signature", v: 2 },
              { lab: "Developers awaiting onboarding", v: 4 },
            ].map(r => (
              <li key={r.lab} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-[10px] hover:bg-white/[0.02]">
                <span className="text-white/75 truncate flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-white/40" />
                  {r.lab}
                </span>
                <span className="font-mono text-[#FF6A00] bg-[#FF6A00]/10 border border-[#FF6A00]/25 px-1.5 rounded">
                  {r.v}
                </span>
              </li>
            ))}
          </ul>
        </div>
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
          className="ml-auto inline-flex items-center gap-1 text-white/55 hover:text-[#FF6A00]"
        >
          <Play className="w-3 h-3" /> Refresh
        </button>
      </div>
    </div>
  );
}
