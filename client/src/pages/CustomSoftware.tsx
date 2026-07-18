/*
 * IO SKY — Custom Software page.
 *
 * Permanently visible inside the Enterprise navigation (per master spec).
 * Showcases custom enterprise platforms, AI-enhanced systems, workflow
 * software ecosystems, and scalable infrastructure software — using the
 * same visual language as the rest of the site.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight, ArrowUpRight,
  Layers, Cpu, Workflow, Boxes, ShieldCheck, Gauge,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useT } from "@/contexts/LanguageContext";

const ICON = "w-[18px] h-[18px]";

type Pillar = { id: string; titleKey: string; bodyKey: string; icon: ReactNode };
const PILLARS: Pillar[] = [
  { id: "platforms", titleKey: "custom.pillar.platforms.title", bodyKey: "custom.pillar.platforms.body", icon: <Layers   className={ICON} strokeWidth={1.6} /> },
  { id: "ai",        titleKey: "custom.pillar.ai.title",        bodyKey: "custom.pillar.ai.body",        icon: <Cpu      className={ICON} strokeWidth={1.6} /> },
  { id: "workflows", titleKey: "custom.pillar.workflows.title", bodyKey: "custom.pillar.workflows.body", icon: <Workflow className={ICON} strokeWidth={1.6} /> },
  { id: "scalable",  titleKey: "custom.pillar.scalable.title",  bodyKey: "custom.pillar.scalable.body",  icon: <Boxes    className={ICON} strokeWidth={1.6} /> },
  { id: "secure",    titleKey: "custom.pillar.secure.title",    bodyKey: "custom.pillar.secure.body",    icon: <ShieldCheck className={ICON} strokeWidth={1.6} /> },
  { id: "operate",   titleKey: "custom.pillar.operate.title",   bodyKey: "custom.pillar.operate.body",   icon: <Gauge    className={ICON} strokeWidth={1.6} /> },
];

const PROCESS = [
  { id: "discover",  titleKey: "custom.process.discover.title",  bodyKey: "custom.process.discover.body" },
  { id: "design",    titleKey: "custom.process.design.title",    bodyKey: "custom.process.design.body" },
  { id: "build",     titleKey: "custom.process.build.title",     bodyKey: "custom.process.build.body" },
  { id: "operate",   titleKey: "custom.process.operate.title",   bodyKey: "custom.process.operate.body" },
];

export default function CustomSoftware() {
  const { t } = useT();

  return (
    <div className="relative min-h-screen bg-[#03060d] text-[var(--color-ivory)] overflow-x-hidden">
      <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,rgba(255,106,0,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_85%_15%,rgba(255,106,0,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#03060d_0%,#050a16_50%,#03060d_100%)]" />
      </div>

      <Navbar />

      <main className="relative z-[1] page-enter">
        {/* HERO */}
        <section className="relative pt-32 md:pt-40 pb-16 md:pb-20 overflow-hidden">
          <div className="container max-w-[820px] text-center mx-auto">
            <div className="inline-flex items-center gap-2 text-[12px] font-mono tracking-[0.22em] uppercase text-[#FF6A00]">
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
              <span>{t("custom.eyebrow")}</span>
            </div>
            <h1 className="font-display text-[44px] sm:text-[54px] md:text-[64px] leading-[1.04] tracking-[-0.02em] font-semibold mt-6">
              {t("custom.hero.title.line1")}
              <br />
              <span className="text-[#FF6A00]">{t("custom.hero.title.line2")}</span>
            </h1>
            <p className="text-[15.5px] leading-[1.7] text-[oklch(0.78_0.012_250)] mt-6 max-w-[640px] mx-auto">
              {t("custom.hero.body")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/book-strategy" className="btn-primary">
                {t("nav.cta")}
                <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
              </Link>
              <Link
                href="#pillars"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#FF6A00]/40 hover:text-[#FF6A00] text-[13.5px] font-medium text-[var(--color-ivory)] transition-colors"
              >
                {t("custom.cta.explore")}
                <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
              </Link>
            </div>
          </div>
        </section>

        {/* PILLARS */}
        <section id="pillars" className="relative py-14 md:py-18 border-t border-white/[0.05]">
          <div className="container">
            <div className="text-center max-w-[820px] mx-auto">
              <h2 className="font-display text-[34px] sm:text-[40px] md:text-[44px] leading-[1.08] tracking-[-0.015em] font-semibold">
                {t("custom.pillars.title.lead")} <span className="text-[#FF6A00]">{t("custom.pillars.title.accent")}</span>
              </h2>
              <p className="text-[15.5px] leading-[1.7] text-[oklch(0.78_0.012_250)] mt-5">
                {t("custom.pillars.subtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 mt-12">
              {PILLARS.map((p) => (
                <article key={p.id} className="feature-card glass-soft p-6 flex flex-col gap-4 min-h-[220px]">
                  <span aria-hidden className="icon-chip glow-orange w-10 h-10 rounded-lg">
                    {p.icon}
                  </span>
                  <h3 className="font-display text-[18.5px] tracking-[-0.005em] font-semibold leading-snug">
                    {t(p.titleKey)}
                  </h3>
                  <p className="text-[13.5px] leading-[1.65] text-[oklch(0.78_0.012_250)]">
                    {t(p.bodyKey)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PROCESS */}
        <section className="relative py-14 md:py-18 border-t border-white/[0.05]">
          <div className="container">
            <div className="text-center max-w-[820px] mx-auto">
              <h2 className="font-display text-[30px] sm:text-[34px] md:text-[40px] leading-[1.1] tracking-[-0.01em] font-semibold">
                {t("custom.process.title")}
              </h2>
              <p className="text-[15px] leading-[1.7] text-[oklch(0.78_0.012_250)] mt-4">
                {t("custom.process.subtitle")}
              </p>
            </div>

            <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
              {PROCESS.map((s, i) => (
                <li key={s.id} className="feature-card glass-soft p-5 flex flex-col gap-3 min-h-[180px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-mono tracking-[0.22em] uppercase text-[#FF6A00]">
                      0{i + 1}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#FF6A00]/70" strokeWidth={2.25} />
                  </div>
                  <h3 className="font-display text-[17px] font-semibold tracking-[-0.005em]">{t(s.titleKey)}</h3>
                  <p className="text-[13px] leading-[1.6] text-[oklch(0.78_0.012_250)]">{t(s.bodyKey)}</p>
                </li>
              ))}
            </ol>

            <div className="text-center mt-12">
              <Link href="/book-strategy" className="btn-primary">
                {t("custom.cta.book")}
                <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
