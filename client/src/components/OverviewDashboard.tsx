/*
 * IO SKY — Hero "Operational Intelligence" command center (premium).
 *
 * This is intentionally NOT a generic CRM widget. It visualizes what IO SKY
 * delivers as an enterprise operational-intelligence preview. Per the design
 * spec it surfaces seven distinct blocks:
 *   1. Operational Intelligence Score   5. Efficiency Opportunities
 *   2. Automation Readiness             6. System Health
 *   3. Workflow Bottlenecks             7. Next Best Actions
 *   4. AI Recommendations
 *
 * The whole panel is clearly labelled as a sample analysis ("Voorbeeldanalyse")
 * so it is never mistaken for live customer data. No fake client names, no
 * exaggerated claims. Every visible string is localized via the `hov.*` keys.
 */
import {
  Gauge, Workflow, BrainCircuit, TrendingUp, AlertTriangle,
  CheckCircle2, ArrowUpRight, Sparkles, Activity, Zap,
  HeartPulse, ListChecks, Target,
} from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function OverviewDashboard() {
  const { t } = useT();

  // Automation readiness sub-dimensions (sample).
  const READINESS = [
    { icon: Workflow,     label: t("hov.dim.processes"),   score: 72 },
    { icon: BrainCircuit, label: t("hov.dim.decisions"),   score: 64 },
    { icon: Activity,     label: t("hov.dim.visibility"),  score: 81 },
    { icon: Zap,          label: t("hov.dim.automation"),  score: 58 },
  ];

  const BOTTLENECKS = [
    { label: t("hov.bottleneck.handoffs"),  severity: "high" as const },
    { label: t("hov.bottleneck.manual"),    severity: "med" as const },
    { label: t("hov.bottleneck.reporting"), severity: "low" as const },
  ];

  const RECS = [
    { label: t("hov.rec.automateIntake"), impact: t("hov.impact.high") },
    { label: t("hov.rec.routeApprovals"), impact: t("hov.impact.med") },
    { label: t("hov.rec.unifyData"),      impact: t("hov.impact.high") },
  ];

  // Efficiency opportunities (qualitative, no fabricated guarantees).
  const OPPS = [
    { label: t("hov.opp.intake"),    tag: t("hov.opp.tag.process") },
    { label: t("hov.opp.handover"),  tag: t("hov.opp.tag.workflow") },
  ];

  // System health signals.
  const HEALTH = [
    { label: t("hov.health.integrations"), state: "ok" as const },
    { label: t("hov.health.data"),         state: "ok" as const },
    { label: t("hov.health.automations"),  state: "watch" as const },
  ];

  // Next best actions queue.
  const ACTIONS = [
    t("hov.action.mapIntake"),
    t("hov.action.connectData"),
    t("hov.action.autoFollowups"),
  ];

  const sevColor = (s: "high" | "med" | "low") =>
    s === "high"
      ? "oklch(0.72 0.205 45)"
      : s === "med"
      ? "oklch(0.8 0.16 80)"
      : "oklch(0.68 0.13 250)";

  const healthColor = (s: "ok" | "watch") =>
    s === "ok" ? "oklch(0.78 0.18 150)" : "oklch(0.8 0.16 80)";

  return (
    <div className="glass-strong p-3 md:p-4 w-full overflow-hidden relative">
      {/* Honest disclosure: sample analysis, not live tenant data. */}
      <div className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] font-medium text-[var(--color-orange)] bg-[oklch(0.72_0.205_45/0.12)] backdrop-blur-sm border border-[oklch(0.72_0.205_45/0.3)] rounded-sm px-2 py-0.5">
        <Sparkles className="w-2.5 h-2.5" strokeWidth={2} />
        {t("hov.sample")}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-1 pt-1">
        <span className="w-7 h-7 rounded-md bg-[oklch(0.72_0.205_45/0.12)] border border-[oklch(0.72_0.205_45/0.3)] flex items-center justify-center text-[var(--color-orange)] shrink-0">
          <Gauge className="w-4 h-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] md:text-[16px] font-display font-semibold text-[var(--color-ivory)] leading-tight truncate">
            {t("hov.title")}
          </h3>
          <div className="text-[10px] text-[oklch(0.6_0.014_250)] leading-tight">{t("hov.subtitle")}</div>
        </div>
      </div>

      {/* Row 1: Operational Intelligence Score + Automation Readiness */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col items-center justify-center">
          <div className="text-[9.5px] uppercase tracking-[0.16em] text-[oklch(0.6_0.014_250)] font-medium mb-1 text-center">
            {t("hov.opScore")}
          </div>
          <ScoreGauge value={71} label={t("hov.score.label")} />
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-300 font-medium">
            <TrendingUp className="w-2.5 h-2.5" strokeWidth={2} />
            {t("hov.score.grade")}
          </div>
        </div>

        <div className="sm:col-span-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-ivory)] mb-2">
            <Zap className="w-3 h-3 text-[var(--color-orange)]" strokeWidth={2} />
            {t("hov.readiness")}
          </div>
          <div className="flex flex-col gap-2">
            {READINESS.map((d) => (
              <div key={d.label} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-white/[0.04] flex items-center justify-center text-[var(--color-orange)] shrink-0">
                  <d.icon className="w-3 h-3" strokeWidth={2} />
                </span>
                <span className="text-[11px] text-[oklch(0.78_0.014_250)] w-[42%] shrink-0 truncate">{d.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${d.score}%`,
                      background: "linear-gradient(90deg, oklch(0.62 0.205 42), oklch(0.82 0.19 55))",
                    }}
                  />
                </div>
                <span className="text-[10.5px] tabular-nums text-[var(--color-ivory)] w-7 text-right shrink-0">{d.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Workflow Bottlenecks + AI Recommendations */}
      <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-ivory)] mb-2">
            <AlertTriangle className="w-3 h-3 text-[var(--color-orange)]" strokeWidth={2} />
            {t("hov.bottlenecks")}
          </div>
          <div className="flex flex-col gap-1.5">
            {BOTTLENECKS.map((b) => (
              <div key={b.label} className="flex items-center justify-between rounded-md px-2 py-1.5 bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sevColor(b.severity), boxShadow: `0 0 8px ${sevColor(b.severity)}` }} />
                  <span className="text-[11px] text-[oklch(0.78_0.014_250)] truncate">{b.label}</span>
                </div>
                <span className="text-[9px] uppercase tracking-[0.12em] font-medium shrink-0" style={{ color: sevColor(b.severity) }}>
                  {b.severity === "high" ? t("hov.sev.high") : b.severity === "med" ? t("hov.sev.med") : t("hov.sev.low")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-ivory)] mb-2">
            <BrainCircuit className="w-3 h-3 text-[var(--color-orange)]" strokeWidth={2} />
            {t("hov.recommendations")}
          </div>
          <div className="flex flex-col gap-1.5">
            {RECS.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-md px-2 py-1.5 bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-300 shrink-0" strokeWidth={2} />
                  <span className="text-[11px] text-[oklch(0.78_0.014_250)] truncate">{r.label}</span>
                </div>
                <span className="text-[9px] uppercase tracking-[0.12em] font-medium text-[var(--color-orange)] shrink-0">{r.impact}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Efficiency Opportunities + System Health */}
      <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-ivory)] mb-2">
            <Target className="w-3 h-3 text-[var(--color-orange)]" strokeWidth={2} />
            {t("hov.efficiency")}
          </div>
          <div className="flex flex-col gap-1.5">
            {OPPS.map((o) => (
              <div key={o.label} className="flex items-center justify-between rounded-md px-2 py-1.5 bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-orange)] shadow-[0_0_6px_var(--color-orange)] shrink-0" />
                  <span className="text-[11px] text-[oklch(0.78_0.014_250)] truncate">{o.label}</span>
                </div>
                <span className="text-[9px] uppercase tracking-[0.12em] font-medium text-[oklch(0.66_0.014_250)] shrink-0">{o.tag}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-ivory)] mb-2">
            <HeartPulse className="w-3 h-3 text-[var(--color-orange)]" strokeWidth={2} />
            {t("hov.systemHealth")}
          </div>
          <div className="flex flex-col gap-1.5">
            {HEALTH.map((h) => (
              <div key={h.label} className="flex items-center justify-between rounded-md px-2 py-1.5 bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[11px] text-[oklch(0.78_0.014_250)] truncate">{h.label}</span>
                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] font-medium shrink-0" style={{ color: healthColor(h.state) }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: healthColor(h.state), boxShadow: `0 0 8px ${healthColor(h.state)}` }} />
                  {h.state === "ok" ? t("hov.health.ok") : t("hov.health.watch")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Next Best Actions */}
      <div className="mt-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-ivory)] mb-2">
          <ListChecks className="w-3 h-3 text-[var(--color-orange)]" strokeWidth={2} />
          {t("hov.nextActions")}
        </div>
        <div className="flex flex-col gap-1.5">
          {ACTIONS.map((a, i) => (
            <div key={a} className="flex items-center gap-2.5">
              <span className="w-4.5 h-4.5 min-w-[18px] h-[18px] rounded-md bg-[oklch(0.72_0.205_45/0.14)] border border-[oklch(0.72_0.205_45/0.3)] text-[var(--color-orange)] flex items-center justify-center text-[9.5px] font-semibold tabular-nums shrink-0">
                {i + 1}
              </span>
              <span className="text-[11px] text-[oklch(0.78_0.014_250)] truncate">{a}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: AI Scan insight preview */}
      <div className="mt-2.5 rounded-lg border border-[oklch(0.72_0.205_45/0.25)] bg-[oklch(0.72_0.205_45/0.06)] p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-md bg-[oklch(0.72_0.205_45/0.14)] border border-[oklch(0.72_0.205_45/0.3)] flex items-center justify-center text-[var(--color-orange)] shrink-0">
            <Sparkles className="w-4 h-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-[11.5px] font-medium text-[var(--color-ivory)] leading-tight truncate">{t("hov.scan.title")}</div>
            <div className="text-[10px] text-[oklch(0.66_0.014_250)] leading-tight truncate">{t("hov.scan.desc")}</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--color-orange)] shrink-0">
          {t("hov.scan.cta")}
          <ArrowUpRight className="w-3 h-3" strokeWidth={2.25} />
        </span>
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function ScoreGauge({ value, label }: { value: number; label: string }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="92" height="92" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.2 50)" />
            <stop offset="100%" stopColor="oklch(0.62 0.205 42)" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth="6" fill="none" />
        <circle
          cx="32" cy="32" r={r}
          stroke="url(#scoreGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 32 32)"
          style={{ filter: "drop-shadow(0 0 6px oklch(0.72 0.205 45 / 0.6))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[20px] font-display font-semibold text-[var(--color-ivory)] leading-none">{value}</div>
        <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-[oklch(0.6_0.014_250)]">{label}</div>
      </div>
    </div>
  );
}
