/*
 * IO SKY — Hero (master design, fully localized).
 * Every visible string is read through useT() so the entire hero re-renders
 * when the user changes language. Layout is identical to the master image.
 */
import { Link } from "wouter";
import {
  ArrowUpRight, ArrowRight,
  ShieldCheck, BrainCog, Layers, Lock,
} from "lucide-react";
import OverviewDashboard from "@/components/OverviewDashboard";
import { useT } from "@/contexts/LanguageContext";

export default function Hero() {
  const { t } = useT();

  const TRUST = [
    { icon: ShieldCheck, title: t("hero.trust.security"),  desc: t("hero.trust.security.note") },
    { icon: BrainCog,    title: t("hero.trust.ai"),        desc: t("hero.trust.ai.note") },
    { icon: Layers,      title: t("hero.trust.scale"),     desc: t("hero.trust.scale.note") },
    { icon: Lock,        title: t("hero.trust.privacy"),   desc: t("hero.trust.privacy.note") },
  ];

  return (
    <section className="relative pt-28 md:pt-32 lg:pt-36 pb-24 md:pb-32 overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-32 top-20 w-[520px] h-[520px] rounded-full bg-[oklch(0.72_0.205_45/0.10)] blur-[110px]" />
        <div className="absolute -right-40 top-40 w-[560px] h-[560px] rounded-full bg-[oklch(0.55_0.18_255/0.10)] blur-[120px]" />
      </div>

      <div className="container relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* LEFT */}
          <div className="lg:col-span-5">
            <h1 className="font-display font-semibold text-[34px] sm:text-[40px] md:text-[44px] lg:text-[52px] xl:text-[60px] leading-[1.06] tracking-[-0.025em] text-[var(--color-ivory)] text-balance">
              {t("hero.title.part1")} {t("hero.title.part2")}
            </h1>

            <p className="mt-6 max-w-[560px] text-[15.5px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)]">
              {t("hero.body")}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/ai-scan" className="btn-primary">
                {t("hero.cta.scan")}
                <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
              </Link>
              <Link href="/book-strategy" className="btn-secondary">
                {t("hero.cta.book")}
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-5">
              {TRUST.map((row) => (
                <div key={row.title} className="flex items-center gap-3">
                  <span className="icon-chip shrink-0">
                    <row.icon className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-[var(--color-ivory)] leading-tight">{row.title}</div>
                    <div className="text-[11px] text-[oklch(0.62_0.014_250)] leading-tight mt-0.5">{row.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-10 h-[120px] md:h-[140px]" aria-hidden="true">
              <div className="absolute inset-x-0 bottom-0 h-[120px]">
                <svg viewBox="0 0 600 140" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
                  <defs>
                    <radialGradient id="globeGlow" cx="50%" cy="100%" r="55%">
                      <stop offset="0%" stopColor="oklch(0.72 0.205 45 / 0.55)" />
                      <stop offset="60%" stopColor="oklch(0.72 0.205 45 / 0.08)" />
                      <stop offset="100%" stopColor="transparent" />
                    </radialGradient>
                  </defs>
                  <ellipse cx="300" cy="220" rx="320" ry="140" fill="oklch(0.1 0.022 260)" stroke="oklch(1 0 0 / 0.05)" />
                  {[0, 1, 2, 3, 4].map((i) => (
                    <ellipse key={i} cx="300" cy="220" rx={320 - i * 30} ry={140 - i * 14} fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="0.6" />
                  ))}
                  {[60, 140, 220, 300, 380, 460, 540].map((x) => (
                    <line key={x} x1={x} y1={120 - Math.abs(x - 300) * 0.05} x2={x} y2={140} stroke="oklch(0.72 0.205 45 / 0.45)" strokeWidth="0.7" />
                  ))}
                  <rect x="0" y="0" width="600" height="140" fill="url(#globeGlow)" />
                </svg>
              </div>
            </div>
          </div>

          {/* RIGHT — Overview dashboard */}
          <div className="lg:col-span-7 relative">
            <div className="absolute -inset-6 bg-[oklch(0.72_0.205_45/0.06)] blur-[60px] rounded-[36px] -z-10" />
            <OverviewDashboard />
          </div>
        </div>
      </div>
    </section>
  );
}
