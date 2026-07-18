/*
 * IO SKY — Intelligence page (master spec).
 *
 * Refined master implementation per:
 *   /home/ubuntu/upload/IO_SKY_INTELLIGENCE_PAGE_MASTER_SPECIFICATION(1).pdf
 *   + uploaded mockup (intelligencepage.png).
 *
 * Sections (top → bottom):
 *   1. Hero — eyebrow · two-line headline ("Intelligence that sees everything." +
 *      orange "AI that executes.") · body · Book Strategy / Explore Capabilities
 *      CTAs · isometric particle dome visual with floating telemetry tags
 *   2. From data to decisive action — 5-step flow (Connect → Intelligence →
 *      Insights → Execution → Impact)
 *   3. Six capability cards (AI Agents, Operational Intelligence, Predictive
 *      Systems, Executive Analytics, Data Intelligence, Intelligence Hub)
 *   4. Trust strip — 5 enterprise pillars
 *
 * Locked design language identical to Homepage and Infrastructure: deep
 * navy-black, restrained orange accents, premium glass surfaces, executive
 * typography. All copy localized via useT().
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight, ArrowUpRight,
  Bot, Activity, TrendingUp, BarChart3, Database, Network,
  Cpu, Sparkles, Eye, Zap, Repeat,
  ShieldCheck, Globe2, Infinity as InfinityIcon, Clock,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useT } from "@/contexts/LanguageContext";

const HERO_VISUAL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-intelligence-dome-au5JWDJ3Shwz3Yt4dWsF7j.webp";

type Step = { id: string; titleKey: string; bodyKey: string; icon: React.ReactNode };
const FLOW: Step[] = [
  { id: "connect",      titleKey: "intel.flow.connect.title",      bodyKey: "intel.flow.connect.body",      icon: <Network    className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
  { id: "intelligence", titleKey: "intel.flow.intelligence.title", bodyKey: "intel.flow.intelligence.body", icon: <Zap        className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
  { id: "insights",     titleKey: "intel.flow.insights.title",     bodyKey: "intel.flow.insights.body",     icon: <Eye        className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
  { id: "execution",    titleKey: "intel.flow.execution.title",    bodyKey: "intel.flow.execution.body",    icon: <Cpu        className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
  { id: "impact",       titleKey: "intel.flow.impact.title",       bodyKey: "intel.flow.impact.body",       icon: <Repeat     className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
];

type Cap = { id: string; titleKey: string; bodyKey: string; icon: React.ReactNode; bullets: string[] };
const CAPS: Cap[] = [
  {
    id: "agents",
    titleKey: "intel.cap.agents.title",
    bodyKey: "intel.cap.agents.body",
    icon: <Bot className="w-[18px] h-[18px]" strokeWidth={1.6} />,
    bullets: ["intel.cap.agents.b1", "intel.cap.agents.b2", "intel.cap.agents.b3", "intel.cap.agents.b4"],
  },
  {
    id: "operational",
    titleKey: "intel.cap.operational.title",
    bodyKey: "intel.cap.operational.body",
    icon: <Activity className="w-[18px] h-[18px]" strokeWidth={1.6} />,
    bullets: ["intel.cap.operational.b1", "intel.cap.operational.b2", "intel.cap.operational.b3", "intel.cap.operational.b4"],
  },
  {
    id: "predictive",
    titleKey: "intel.cap.predictive.title",
    bodyKey: "intel.cap.predictive.body",
    icon: <TrendingUp className="w-[18px] h-[18px]" strokeWidth={1.6} />,
    bullets: ["intel.cap.predictive.b1", "intel.cap.predictive.b2", "intel.cap.predictive.b3", "intel.cap.predictive.b4"],
  },
  {
    id: "executive",
    titleKey: "intel.cap.executive.title",
    bodyKey: "intel.cap.executive.body",
    icon: <BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.6} />,
    bullets: ["intel.cap.executive.b1", "intel.cap.executive.b2", "intel.cap.executive.b3", "intel.cap.executive.b4"],
  },
  {
    id: "data",
    titleKey: "intel.cap.data.title",
    bodyKey: "intel.cap.data.body",
    icon: <Database className="w-[18px] h-[18px]" strokeWidth={1.6} />,
    bullets: ["intel.cap.data.b1", "intel.cap.data.b2", "intel.cap.data.b3", "intel.cap.data.b4"],
  },
  {
    id: "hub",
    titleKey: "intel.cap.hub.title",
    bodyKey: "intel.cap.hub.body",
    icon: <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.6} />,
    bullets: ["intel.cap.hub.b1", "intel.cap.hub.b2", "intel.cap.hub.b3", "intel.cap.hub.b4"],
  },
];

/*
 * Spec-mandated footer anchor names differ from the historical capability ids
 * (which the navbar mega-menu already uses). To keep BOTH working we render an
 * invisible alias anchor with the spec hash inside the matching card, so e.g.
 * /intelligence#operational-intelligence and /intelligence#operational both
 * land on the same section. Cards without a spec alias simply omit it.
 */
const SPEC_ANCHOR_ALIAS: Record<string, string> = {
  agents: "ai-agents",
  operational: "operational-intelligence",
  predictive: "predictive-systems",
  executive: "executive-analytics",
};

type Trust = { id: string; titleKey: string; subKey: string; icon: React.ReactNode };
const TRUST: Trust[] = [
  { id: "ai",      titleKey: "intel.trust.ai.title",      subKey: "intel.trust.ai.sub",      icon: <Sparkles    className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { id: "live",    titleKey: "intel.trust.live.title",    subKey: "intel.trust.live.sub",    icon: <Activity    className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { id: "secure",  titleKey: "intel.trust.secure.title",  subKey: "intel.trust.secure.sub",  icon: <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { id: "scale",   titleKey: "intel.trust.scale.title",   subKey: "intel.trust.scale.sub",   icon: <InfinityIcon className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { id: "always",  titleKey: "intel.trust.always.title",  subKey: "intel.trust.always.sub",  icon: <Clock       className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
];

export default function Intelligence() {
  const { t } = useT();

  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar />
      <main className="relative z-[1] page-enter">
        {/* ============================ HERO ============================ */}
        <section className="relative pt-32 md:pt-40 pb-16 md:pb-20 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-[1]"
            style={{
              background:
                "radial-gradient(40% 50% at 18% 28%, rgba(255,106,0,0.10), transparent 70%), radial-gradient(35% 45% at 82% 22%, rgba(255,106,0,0.08), transparent 70%)",
            }}
          />
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left — copy */}
              <div className="lg:col-span-6">
                <div className="eyebrow">{t("intel.hero.eyebrow")}</div>
                <h1 className="mt-5 font-display font-medium tracking-[-0.02em] text-[44px] sm:text-[52px] md:text-[60px] lg:text-[64px] leading-[1.04] text-[var(--color-ivory)]">
                  {t("intel.hero.title.line1")}
                  <br />
                  <span className="text-[var(--color-orange)]">{t("intel.hero.title.line2")}</span>
                </h1>
                <p className="mt-6 max-w-[560px] text-[15.5px] leading-[1.65] text-[oklch(0.78_0.014_250)]">
                  {t("intel.hero.body")}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/book-strategy" className="btn-primary">
                    {t("intel.hero.cta.book")}
                    <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
                  </Link>
                  <Link href="/intelligence#capabilities" className="btn-secondary">
                    {t("intel.hero.cta.explore")}
                    <ArrowRight className="w-4 h-4 opacity-80" strokeWidth={2} />
                  </Link>
                </div>
              </div>

              {/* Right — particle dome visual */}
              <div className="lg:col-span-6 relative">
                <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden">
                  <img
                    src={HERO_VISUAL}
                    alt="IO SKY operational intelligence dome"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                  />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(60% 60% at 50% 55%, transparent 55%, rgba(11,16,32,0.55) 100%)",
                    }}
                  />
                  <ScoreTag      className="right-[6%] top-[6%]"     t={t} />
                  <OutlookTag    className="right-[3%] top-[40%]"    t={t} />
                  <RealtimeTag   className="right-[6%] bottom-[10%]" t={t} />
                  <AgentsTag     className="left-[4%] bottom-[14%]"  t={t} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================== FROM DATA TO DECISIVE ACTION (5-step flow) ====================== */}
        <section className="relative pb-16 md:pb-20">
          <div className="container">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="font-display font-medium tracking-[-0.015em] text-[28px] md:text-[34px] leading-tight text-[var(--color-ivory)]">
                {t("intel.flow.title.part1")}{" "}
                <span className="text-[var(--color-orange)]">{t("intel.flow.title.accent")}</span>
                {t("intel.flow.title.dot")}
              </h2>
              <p className="mt-3 max-w-[640px] mx-auto text-[14.5px] leading-[1.6] text-[oklch(0.76_0.014_250)]">
                {t("intel.flow.body")}
              </p>
            </div>

            <div className="glass p-5 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-2 items-stretch">
                {FLOW.map((s, i) => (
                  <div key={s.id} className="relative flex">
                    <div className="feature-card glass-soft p-4 flex-1 flex flex-col gap-2.5 min-h-[160px]">
                      <span aria-hidden className="icon-chip glow-orange w-9 h-9 rounded-lg">
                        {s.icon}
                      </span>
                      <h3 className="font-display font-medium tracking-[-0.005em] text-[14.5px] leading-tight text-[var(--color-ivory)]">
                        {t(s.titleKey)}
                      </h3>
                      <p className="text-[12.5px] leading-[1.55] text-[oklch(0.76_0.014_250)]">
                        {t(s.bodyKey)}
                      </p>
                    </div>
                    {i < FLOW.length - 1 && (
                      <div className="hidden lg:flex items-center justify-center w-6 shrink-0 text-[var(--color-orange)]/70">
                        <ArrowRight className="w-4 h-4" strokeWidth={2} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ====================== CAPABILITY GRID ====================== */}
        <section id="capabilities" className="relative pb-16 md:pb-20">
          <div className="container">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="font-display font-medium tracking-[-0.015em] text-[28px] md:text-[34px] leading-tight text-[var(--color-ivory)]">
                {t("intel.caps.title.part1")}{" "}
                <span className="text-[var(--color-orange)]">{t("intel.caps.title.accent")}</span>{" "}
                {t("intel.caps.title.part2")}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
              {CAPS.map((cap) => (
                <article
                  key={cap.id}
                  id={cap.id}
                  className="relative feature-card glass-soft p-5 flex flex-col gap-4 min-h-[300px]"
                >
                  {SPEC_ANCHOR_ALIAS[cap.id] && (
                    <span
                      id={SPEC_ANCHOR_ALIAS[cap.id]}
                      aria-hidden
                      className="absolute -top-24 left-0"
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="icon-chip glow-orange w-10 h-10 rounded-lg">
                      {cap.icon}
                    </span>
                    <h3 className="font-display font-medium tracking-[-0.005em] text-[16px] leading-tight text-[var(--color-ivory)]">
                      {t(cap.titleKey)}
                    </h3>
                  </div>
                  <p className="text-[13px] leading-[1.55] text-[oklch(0.76_0.014_250)]">
                    {t(cap.bodyKey)}
                  </p>
                  <ul className="mt-auto flex flex-col gap-1.5 pt-1 border-t border-white/[0.05]">
                    {cap.bullets.map((bk) => (
                      <li key={bk} className="flex items-start gap-2 text-[12.5px] text-[oklch(0.82_0.012_250)] pt-1.5">
                        <span
                          aria-hidden
                          className="mt-[7px] shrink-0 w-1 h-1 rounded-full bg-[var(--color-orange)]"
                          style={{ boxShadow: "0 0 6px rgba(255,106,0,0.6)" }}
                        />
                        <span className="leading-snug">{t(bk)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/intelligence#${cap.id}`}
                    className="text-[12.5px] font-medium text-[var(--color-orange)] inline-flex items-center gap-1.5 hover:gap-2 transition-[gap]"
                  >
                    {t("intel.cap.learnMore")}
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ TRUST STRIP ============================ */}
        <section className="relative pb-20 md:pb-28">
          <div className="container">
            <div className="glass p-4 md:p-6 relative overflow-hidden">
              <span
                className="pointer-events-none absolute inset-x-6 bottom-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,106,0,0.45) 50%, transparent 100%)",
                  filter: "blur(0.5px)",
                }}
              />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
                {TRUST.map((tt) => (
                  <div key={tt.id} className="flex items-center gap-3 min-w-0">
                    <span aria-hidden className="icon-chip w-10 h-10 rounded-lg shrink-0">
                      {tt.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[var(--color-ivory)] leading-tight truncate">
                        {t(tt.titleKey)}
                      </div>
                      <div className="text-[12px] text-[oklch(0.7_0.014_250)] leading-tight mt-0.5 truncate">
                        {t(tt.subKey)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/* ---------- Floating telemetry tags for hero visual ---------- */
/* Each tag has its own visual signature that matches the master mockup. */

function TagShell({
  className,
  children,
  width,
}: {
  className: string;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className={`absolute ${className}`}>
      <div
        className={`glass-soft rounded-[12px] backdrop-blur-md px-3.5 py-3 ${width ?? "min-w-[170px]"}`}
        style={{
          background:
            "linear-gradient(180deg, oklch(0.2 0.022 260 / 0.78) 0%, oklch(0.13 0.022 260 / 0.78) 100%)",
          border: "1px solid oklch(1 0 0 / 0.10)",
          boxShadow:
            "inset 0 1px 0 oklch(1 0 0 / 0.06), 0 24px 60px -28px oklch(0 0 0 / 0.7)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TagEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.14em] text-[oklch(0.74_0.014_250)] font-medium leading-tight">
      {children}
    </div>
  );
}

function ScoreTag({ className, t }: { className: string; t: (k: string) => string }) {
  return (
    <TagShell className={className} width="w-[180px]">
      <TagEyebrow>{t("intel.tag.score.title")}</TagEyebrow>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="oklch(1 0 0 / 0.10)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="var(--color-orange)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(92 / 100) * 2 * Math.PI * 15} ${2 * Math.PI * 15}`}
              style={{ filter: "drop-shadow(0 0 4px oklch(0.72 0.205 45 / 0.6))" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-display font-semibold text-[13px] text-[var(--color-ivory)]">92%</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10.5px] leading-tight text-[oklch(0.78_0.018_250)]">
            <span className="text-[var(--color-orange)] font-medium">+18.7%</span>
          </div>
          <div className="text-[10px] text-[oklch(0.66_0.014_250)] leading-tight">
            {t("intel.tag.score.sub").replace("+18.7% ", "")}
          </div>
        </div>
      </div>
    </TagShell>
  );
}

function OutlookTag({ className, t }: { className: string; t: (k: string) => string }) {
  return (
    <TagShell className={className} width="w-[200px]">
      <TagEyebrow>{t("intel.tag.outlook.title")}</TagEyebrow>
      <svg viewBox="0 0 200 60" className="mt-2 w-full h-[52px]">
        <defs>
          <linearGradient id="out-orange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.205 45 / 0.45)" />
            <stop offset="100%" stopColor="oklch(0.72 0.205 45 / 0)" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[15, 30, 45].map((y) => (
          <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="oklch(1 0 0 / 0.05)" strokeDasharray="2 4" />
        ))}
        {/* growth (orange) */}
        <path d="M0,40 L25,32 L50,28 L75,22 L100,18 L125,14 L150,10 L175,8 L200,5" fill="none" stroke="var(--color-orange)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M0,40 L25,32 L50,28 L75,22 L100,18 L125,14 L150,10 L175,8 L200,5 L200,60 L0,60 Z" fill="url(#out-orange)" />
        {/* churn (purple) */}
        <path d="M0,30 L25,32 L50,30 L75,34 L100,32 L125,36 L150,34 L175,38 L200,36" fill="none" stroke="oklch(0.65 0.18 290)" strokeWidth="1.3" strokeLinecap="round" />
        {/* capacity (cyan) */}
        <path d="M0,46 L25,44 L50,42 L75,40 L100,42 L125,40 L150,38 L175,40 L200,38" fill="none" stroke="oklch(0.78 0.13 200)" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <div className="flex items-center gap-2.5 text-[9.5px] text-[oklch(0.74_0.014_250)] mt-1.5">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-orange)]" />Growth</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.65 0.18 290)" }} />Churn Risk</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.78 0.13 200)" }} />Capacity</span>
      </div>
    </TagShell>
  );
}

function RealtimeTag({ className, t }: { className: string; t: (k: string) => string }) {
  const bars = [22, 30, 26, 38, 32, 44, 40, 50];
  return (
    <TagShell className={className} width="w-[180px]">
      <TagEyebrow>{t("intel.tag.realtime.title")}</TagEyebrow>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="font-display font-semibold text-[20px] tracking-[-0.01em] text-[var(--color-ivory)] leading-none">
          {t("intel.tag.realtime.value")}
        </div>
        <div className="flex items-end gap-[3px] h-[28px]">
          {bars.map((h, i) => (
            <span
              key={i}
              className="w-[4px] rounded-sm"
              style={{
                height: `${h * 0.55}px`,
                background: i === bars.length - 1 ? "var(--color-orange)" : "oklch(0.72 0.205 45 / 0.55)",
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 text-[10px] text-[oklch(0.66_0.014_250)] leading-tight">
        {t("intel.tag.realtime.sub")}
      </div>
    </TagShell>
  );
}

function AgentsTag({ className, t }: { className: string; t: (k: string) => string }) {
  return (
    <TagShell className={className} width="w-[200px]">
      <TagEyebrow>{t("intel.tag.agents.title")}</TagEyebrow>
      <div className="mt-1.5 font-display font-semibold text-[18px] text-[oklch(0.78_0.13_160)] leading-tight">
        {t("intel.tag.agents.value")}
      </div>
      <div className="text-[10.5px] text-[oklch(0.7_0.014_250)] leading-tight">
        {t("intel.tag.agents.sub")}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="relative w-7 h-7 rounded-md grid place-items-center"
            style={{
              background: "oklch(0.72 0.205 45 / 0.12)",
              border: "1px solid oklch(0.72 0.205 45 / 0.32)",
            }}
          >
            <Bot className="w-3.5 h-3.5 text-[var(--color-orange)]" strokeWidth={1.6} />
            <span
              className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
              style={{ background: "oklch(0.78 0.16 160)", boxShadow: "0 0 6px oklch(0.78 0.16 160 / 0.6)" }}
            />
          </span>
        ))}
      </div>
    </TagShell>
  );
}
