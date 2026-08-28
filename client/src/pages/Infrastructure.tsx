/*
 * IO SKY — Infrastructure page (enterprise rebuild).
 *
 * Sections (top → bottom):
 *   1. Hero — eyebrow · headline (orange accent) · body · Start AI Scan / Book
 *      a discovery call CTAs · premium operational command center visual
 *   2. Six capability pillars (CRM, Automation, Data & Insight, Integrations,
 *      Security & Governance, Scalability) — each with a dedicated CTA
 *   3. Benefits bar — 5 qualitative pillars (Control, Automation, Integration,
 *      Scalability, Governance)
 *   4. Mid-page CTA
 *   5. Qualitative AI Scan indicators (no fake KPIs)
 *   6. Ecosystem diagram — IO SKY Operational Layer connecting sources/outcomes
 *
 * Locked design language: deep navy-black, restrained orange accents, premium
 * glass surfaces, executive typography. All copy localized via useT().
 */
import { Link } from "wouter";
import {
  ArrowRight, ArrowUpRight,
  UserSquare2, Workflow, Boxes, BarChart3, ShieldCheck, Infinity as InfinityIcon,
  Gauge, Plug, Layers, Building2, MessagesSquare, LifeBuoy, Cpu, Sparkles,
  Eye, Activity, TrendingUp, CheckCircle2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useT } from "@/contexts/LanguageContext";

type Cap = {
  id: string;
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  icon: React.ReactNode;
};
const CAPS: Cap[] = [
  { id: "crm", titleKey: "infra.cap.crm.title", bodyKey: "infra.cap.crm.body", ctaKey: "infra.cap.crm.cta", icon: <UserSquare2 className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
  { id: "automation", titleKey: "infra.cap.automation.title", bodyKey: "infra.cap.automation.body", ctaKey: "infra.cap.automation.cta", icon: <Workflow className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
  { id: "data", titleKey: "infra.cap.data.title", bodyKey: "infra.cap.data.body", ctaKey: "infra.cap.data.cta", icon: <BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
  { id: "integrations", titleKey: "infra.cap.integrations.title", bodyKey: "infra.cap.integrations.body", ctaKey: "infra.cap.integrations.cta", icon: <Boxes className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
  { id: "security", titleKey: "infra.cap.security.title", bodyKey: "infra.cap.security.body", ctaKey: "infra.cap.security.cta", icon: <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
  { id: "scalability", titleKey: "infra.cap.scalability.title", bodyKey: "infra.cap.scalability.body", ctaKey: "infra.cap.scalability.cta", icon: <InfinityIcon className="w-[18px] h-[18px]" strokeWidth={1.6} /> },
];

type Benefit = { id: string; titleKey: string; subKey: string; icon: React.ReactNode };
const BENEFITS: Benefit[] = [
  { id: "control", titleKey: "infra.benefit.control.title", subKey: "infra.benefit.control.sub", icon: <Eye className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { id: "automation", titleKey: "infra.benefit.automation.title", subKey: "infra.benefit.automation.sub", icon: <Workflow className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { id: "integration", titleKey: "infra.benefit.integration.title", subKey: "infra.benefit.integration.sub", icon: <Plug className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { id: "scalability", titleKey: "infra.benefit.scalability.title", subKey: "infra.benefit.scalability.sub", icon: <Layers className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { id: "governance", titleKey: "infra.benefit.governance.title", subKey: "infra.benefit.governance.sub", icon: <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
];

const RESULTS = [
  { key: "infra.results.i1", icon: <Workflow className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { key: "infra.results.i2", icon: <Activity className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { key: "infra.results.i3", icon: <Gauge className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { key: "infra.results.i4", icon: <Eye className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
];

export default function Infrastructure() {
  const { t } = useT();

  const sources = [
    { key: "infra.diagram.left.crm", icon: <UserSquare2 className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.left.erp", icon: <Building2 className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.left.comms", icon: <MessagesSquare className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.left.support", icon: <LifeBuoy className="w-4 h-4" strokeWidth={1.7} /> },
  ];
  const outcomes = [
    { key: "infra.diagram.right.dashboards", icon: <BarChart3 className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.right.analytics", icon: <TrendingUp className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.right.ai", icon: <Cpu className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.right.automation", icon: <Workflow className="w-4 h-4" strokeWidth={1.7} /> },
  ];

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
                "radial-gradient(40% 50% at 18% 28%, rgba(255, 122, 0,0.10), transparent 70%), radial-gradient(35% 45% at 82% 22%, rgba(255, 122, 0,0.08), transparent 70%)",
            }}
          />
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left — copy */}
              <div className="lg:col-span-6">
                <div className="eyebrow">{t("infra.hero.eyebrow")}</div>
                <h1 className="mt-5 font-display font-medium tracking-[-0.02em] text-[36px] sm:text-[46px] md:text-[54px] lg:text-[58px] leading-[1.06] text-[var(--color-ivory)]">
                  {t("infra.hero.title.part1")}{" "}
                  <span className="text-[var(--color-orange)]">{t("infra.hero.title.accent")}</span>
                  {t("infra.hero.title.dot")}
                </h1>
                <p className="mt-6 max-w-[560px] text-[15.5px] leading-[1.65] text-[oklch(0.78_0.014_250)]">
                  {t("infra.hero.body")}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/ai-scan" className="btn-primary">
                    {t("infra.hero.cta.book")}
                    <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
                  </Link>
                  <Link href="/book-strategy" className="btn-secondary">
                    {t("infra.hero.cta.explore")}
                    <ArrowRight className="w-4 h-4 opacity-80" strokeWidth={2} />
                  </Link>
                </div>
              </div>

              {/* Right — operational command center */}
              <div className="lg:col-span-6 relative">
                <CommandCenter t={t} sources={sources} outcomes={outcomes} />
              </div>
            </div>
          </div>
        </section>

        {/* ====================== CAPABILITY PILLARS ====================== */}
        <section className="relative pb-16 md:pb-20">
          <div className="container">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {CAPS.map((cap) => (
                <article
                  key={cap.id}
                  id={cap.id}
                  className="feature-card glass-soft p-6 flex flex-col gap-4 min-h-[230px]"
                  style={{ scrollMarginTop: "120px" }}
                >
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="icon-chip glow-orange w-10 h-10 rounded-lg">
                      {cap.icon}
                    </span>
                    <h3 className="font-display font-medium tracking-[-0.005em] text-[18px] leading-tight text-[var(--color-ivory)]">
                      {t(cap.titleKey)}
                    </h3>
                  </div>
                  <p className="text-[14px] leading-[1.6] text-[oklch(0.78_0.014_250)]">
                    {t(cap.bodyKey)}
                  </p>
                  <Link
                    href={`/infrastructure#${cap.id}`}
                    className="mt-auto text-[13px] font-medium text-[var(--color-orange)] inline-flex items-center gap-1.5 hover:gap-2.5 transition-[gap] duration-200"
                  >
                    {t(cap.ctaKey)}
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ BENEFITS BAR ============================ */}
        <section className="relative pb-16 md:pb-20">
          <div className="container">
            <div className="glass p-5 md:p-7 relative overflow-hidden">
              <span
                className="pointer-events-none absolute inset-x-6 bottom-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255, 122, 0,0.45) 50%, transparent 100%)",
                  filter: "blur(0.5px)",
                }}
              />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-6">
                {BENEFITS.map((b) => (
                  <div key={b.id} className="flex items-start gap-3 min-w-0">
                    <span aria-hidden className="icon-chip w-10 h-10 rounded-lg shrink-0">
                      {b.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[var(--color-ivory)] leading-tight">
                        {t(b.titleKey)}
                      </div>
                      <div className="text-[12px] text-[oklch(0.72_0.014_250)] leading-snug mt-1">
                        {t(b.subKey)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================ MID-PAGE CTA ============================ */}
        <section className="relative pb-16 md:pb-20">
          <div className="container">
            <div className="glass p-8 md:p-12 relative overflow-hidden text-center">
              <div
                className="pointer-events-none absolute inset-0 -z-[1]"
                style={{
                  background:
                    "radial-gradient(50% 80% at 50% 0%, rgba(255, 122, 0,0.12), transparent 70%)",
                }}
              />
              <h2 className="font-display font-medium tracking-[-0.015em] text-[26px] md:text-[34px] leading-[1.15] text-[var(--color-ivory)] max-w-[680px] mx-auto">
                {t("infra.midcta.title")}
              </h2>
              <p className="mt-4 text-[15px] leading-[1.6] text-[oklch(0.78_0.014_250)] max-w-[520px] mx-auto">
                {t("infra.midcta.body")}
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link href="/ai-scan" className="btn-primary">
                  {t("infra.midcta.scan")}
                  <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
                </Link>
                <Link href="/book-strategy" className="btn-secondary">
                  {t("infra.midcta.book")}
                  <ArrowRight className="w-4 h-4 opacity-80" strokeWidth={2} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ====================== QUALITATIVE RESULTS ====================== */}
        <section className="relative pb-16 md:pb-20">
          <div className="container">
            <div className="eyebrow">{t("infra.results.eyebrow")}</div>
            <h2 className="mt-4 font-display font-medium tracking-[-0.015em] text-[26px] md:text-[34px] leading-[1.15] text-[var(--color-ivory)] max-w-[640px]">
              {t("infra.results.title")}
            </h2>
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {RESULTS.map((r) => (
                <div key={r.key} className="glass-soft p-5 flex items-center gap-3 min-h-[88px]">
                  <span aria-hidden className="icon-chip w-10 h-10 rounded-lg shrink-0">
                    {r.icon}
                  </span>
                  <div className="text-[14px] font-medium text-[var(--color-ivory)] leading-snug">
                    {t(r.key)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====================== ECOSYSTEM DIAGRAM ====================== */}
        <section id="hub" className="relative pb-20 md:pb-28" style={{ scrollMarginTop: "120px" }}>
          <div className="container">
            <div className="eyebrow">{t("infra.diagram.eyebrow")}</div>
            <h2 className="mt-4 font-display font-medium tracking-[-0.015em] text-[26px] md:text-[34px] leading-[1.15] text-[var(--color-ivory)] max-w-[680px]">
              {t("infra.diagram.title")}
            </h2>

            <div className="mt-10 glass p-6 md:p-10 relative overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-6 items-center">
                {/* Sources */}
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[oklch(0.7_0.014_250)] font-medium mb-4">
                    {t("infra.diagram.left.title")}
                  </div>
                  <div className="flex flex-col gap-3">
                    {sources.map((s) => (
                      <div key={s.key} className="glass-soft px-4 py-3 rounded-lg flex items-center gap-3">
                        <span aria-hidden className="text-[var(--color-orange)]">{s.icon}</span>
                        <span className="text-[14px] text-[var(--color-ivory)]">{t(s.key)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Core */}
                <div className="flex flex-col items-center justify-center px-2">
                  <ArrowRight className="hidden lg:block w-6 h-6 text-[var(--color-orange)]/50 mb-4" strokeWidth={1.5} />
                  <div
                    className="relative rounded-2xl px-6 py-7 text-center min-w-[210px]"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255, 122, 0,0.16), rgba(255, 122, 0,0.04))",
                      border: "1px solid rgba(255, 122, 0,0.35)",
                      boxShadow: "0 0 40px rgba(255, 122, 0,0.18)",
                    }}
                  >
                    <Sparkles className="w-6 h-6 text-[var(--color-orange)] mx-auto" strokeWidth={1.6} />
                    <div className="mt-3 font-display font-medium text-[16px] leading-tight text-[var(--color-ivory)]">
                      {t("infra.diagram.core")}
                    </div>
                  </div>
                  <ArrowRight className="hidden lg:block w-6 h-6 text-[var(--color-orange)]/50 mt-4" strokeWidth={1.5} />
                </div>

                {/* Outcomes */}
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[oklch(0.7_0.014_250)] font-medium mb-4 lg:text-right">
                    {t("infra.diagram.right.title")}
                  </div>
                  <div className="flex flex-col gap-3">
                    {outcomes.map((o) => (
                      <div key={o.key} className="glass-soft px-4 py-3 rounded-lg flex items-center gap-3 lg:flex-row-reverse lg:text-right">
                        <span aria-hidden className="text-[var(--color-orange)]">{o.icon}</span>
                        <span className="flex-1 text-[14px] text-[var(--color-ivory)]">{t(o.key)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/* ---------- Operational command center hero visual ---------- */
function CommandCenter({
  t,
  sources,
  outcomes,
}: {
  t: (k: string) => string;
  sources: { key: string; icon: React.ReactNode }[];
  outcomes: { key: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="glass p-5 md:p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10.5px] uppercase tracking-[0.16em] text-[oklch(0.74_0.014_250)] font-medium">
          {t("infra.viz.badge")}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[oklch(0.7_0.014_250)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-orange)]" style={{ boxShadow: "0 0 8px rgba(255, 122, 0,0.7)" }} />
          live
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        {/* Systems */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[oklch(0.66_0.014_250)] mb-2">
            {t("infra.viz.left.title")}
          </div>
          <div className="flex flex-col gap-2">
            {sources.map((s) => (
              <div key={s.key} className="glass-soft px-2.5 py-2 rounded-md flex items-center gap-2">
                <span aria-hidden className="text-[var(--color-orange)] opacity-90">{s.icon}</span>
                <span className="text-[11.5px] text-[var(--color-ivory)] truncate">{t(s.key)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Core */}
        <div className="flex items-center">
          <div
            className="rounded-xl px-3 py-4 text-center w-[112px]"
            style={{
              background: "linear-gradient(180deg, rgba(255, 122, 0,0.16), rgba(255, 122, 0,0.04))",
              border: "1px solid rgba(255, 122, 0,0.35)",
              boxShadow: "0 0 30px rgba(255, 122, 0,0.16)",
            }}
          >
            <Cpu className="w-5 h-5 text-[var(--color-orange)] mx-auto" strokeWidth={1.6} />
            <div className="mt-2 text-[11px] font-medium leading-tight text-[var(--color-ivory)]">
              {t("infra.viz.core.title")}
            </div>
            <div className="mt-1 text-[9.5px] leading-tight text-[oklch(0.68_0.014_250)]">
              {t("infra.viz.core.sub")}
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[oklch(0.66_0.014_250)] mb-2 text-right">
            {t("infra.viz.right.title")}
          </div>
          <div className="flex flex-col gap-2">
            {[
              { key: "infra.viz.right.visibility", icon: <Eye className="w-4 h-4" strokeWidth={1.7} /> },
              { key: "infra.viz.right.automation", icon: <Workflow className="w-4 h-4" strokeWidth={1.7} /> },
              { key: "infra.viz.right.health", icon: <Activity className="w-4 h-4" strokeWidth={1.7} /> },
              { key: "infra.viz.right.status", icon: <CheckCircle2 className="w-4 h-4" strokeWidth={1.7} /> },
            ].map((o) => (
              <div key={o.key} className="glass-soft px-2.5 py-2 rounded-md flex items-center gap-2 flex-row-reverse text-right">
                <span aria-hidden className="text-[var(--color-orange)] opacity-90">{o.icon}</span>
                <span className="flex-1 text-[11.5px] text-[var(--color-ivory)] truncate">{t(o.key)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[oklch(0.7_0.014_250)]">
        <span>{t("infra.viz.core.sub")}</span>
        <span className="text-[var(--color-orange)]">IO SKY</span>
      </div>
    </div>
  );
}
