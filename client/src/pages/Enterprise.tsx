/*
 * IO SKY — Enterprise page (master spec).
 *
 * Source of truth:
 *   - /home/ubuntu/upload/ioskyenterprisepage.png  (final mockup)
 *   - /home/ubuntu/upload/IO_SKY_ENTERPRISE_PAGE_MASTER_SPECIFICATION.pdf
 *
 * Sections (top → bottom):
 *   1. Hero — eyebrow · two-line headline ("Enterprise infrastructure for"
 *      + orange "mission-critical growth.") · body · Book Strategy /
 *      Explore Enterprise Systems CTAs · isometric city visual with three
 *      floating tags (Enterprise Performance 98.7%, Operational Efficiency
 *      +47%, Security Compliance audit-ready security).
 *   2. Enterprise systems — section eyebrow + headline "Enterprise systems
 *      engineered to elevate your entire organization." + 6 capability
 *      cards (Enterprise Systems · AI Enterprise Systems · Custom Software
 *      · Security & Compliance · Scalability & Growth · Integration Hub).
 *   3. Enterprise Command Center — wide control-room photo with body copy +
 *      4 mini features (Real-time Monitoring, Predictive Insights,
 *      Intelligent Alerts, Operational Control) and "Explore Command Center"
 *      CTA.
 *   4. Trusted by Ambitious Organizations — 6 partner monograms.
 *   5. Footer (shared).
 *
 * Design language identical to Home / Infrastructure / Intelligence:
 * deep navy-black atmosphere, restrained orange accents, premium glass
 * surfaces, cinematic typography hierarchy, motion via .page-enter,
 * .feature-card, .icon-chip, .glow-orange.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight, ArrowUpRight,
  Briefcase, Cpu, Code2, ShieldCheck, Gauge, Network,
  Activity, TrendingUp, Bell, SlidersHorizontal,
  ShieldCheck as ShieldIcon, BarChart3, Sparkles,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useT } from "@/contexts/LanguageContext";

const HERO_VISUAL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-enterprise-city-79Rkgw2soCRfRyspsX49EW.webp";
const COMMAND_VISUAL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-enterprise-command-room-ECc3xuN3udjC9Lo59q5etC.webp";

const ICON = "w-[18px] h-[18px]";

type Cap = { id: string; titleKey: string; bodyKey: string; icon: ReactNode; bullets: string[] };
const CAPS: Cap[] = [
  {
    id: "systems",
    titleKey: "ent.cap.systems.title",
    bodyKey: "ent.cap.systems.body",
    icon: <Briefcase className={ICON} strokeWidth={1.6} />,
    bullets: ["ent.cap.systems.b1", "ent.cap.systems.b2", "ent.cap.systems.b3", "ent.cap.systems.b4"],
  },
  {
    id: "ai-systems",
    titleKey: "ent.cap.aiSystems.title",
    bodyKey: "ent.cap.aiSystems.body",
    icon: <Cpu className={ICON} strokeWidth={1.6} />,
    bullets: ["ent.cap.aiSystems.b1", "ent.cap.aiSystems.b2", "ent.cap.aiSystems.b3", "ent.cap.aiSystems.b4"],
  },
  {
    id: "custom",
    titleKey: "ent.cap.customSoftware.title",
    bodyKey: "ent.cap.customSoftware.body",
    icon: <Code2 className={ICON} strokeWidth={1.6} />,
    bullets: ["ent.cap.customSoftware.b1", "ent.cap.customSoftware.b2", "ent.cap.customSoftware.b3", "ent.cap.customSoftware.b4"],
  },
  {
    id: "security",
    titleKey: "ent.cap.security.title",
    bodyKey: "ent.cap.security.body",
    icon: <ShieldCheck className={ICON} strokeWidth={1.6} />,
    bullets: ["ent.cap.security.b1", "ent.cap.security.b2", "ent.cap.security.b3", "ent.cap.security.b4"],
  },
  {
    id: "scalability",
    titleKey: "ent.cap.scalability.title",
    bodyKey: "ent.cap.scalability.body",
    icon: <Gauge className={ICON} strokeWidth={1.6} />,
    bullets: ["ent.cap.scalability.b1", "ent.cap.scalability.b2", "ent.cap.scalability.b3", "ent.cap.scalability.b4"],
  },
  {
    id: "integration",
    titleKey: "ent.cap.integrationHub.title",
    bodyKey: "ent.cap.integrationHub.body",
    icon: <Network className={ICON} strokeWidth={1.6} />,
    bullets: ["ent.cap.integrationHub.b1", "ent.cap.integrationHub.b2", "ent.cap.integrationHub.b3", "ent.cap.integrationHub.b4"],
  },
];

type Mini = { id: string; titleKey: string; bodyKey: string; icon: ReactNode };
const COMMAND_MINIS: Mini[] = [
  { id: "monitoring", titleKey: "ent.cmd.monitoring.title", bodyKey: "ent.cmd.monitoring.body", icon: <Activity className={ICON} strokeWidth={1.6} /> },
  { id: "predictive", titleKey: "ent.cmd.predictive.title", bodyKey: "ent.cmd.predictive.body", icon: <TrendingUp className={ICON} strokeWidth={1.6} /> },
  { id: "alerts",     titleKey: "ent.cmd.alerts.title",     bodyKey: "ent.cmd.alerts.body",     icon: <Bell        className={ICON} strokeWidth={1.6} /> },
  { id: "control",    titleKey: "ent.cmd.control.title",    bodyKey: "ent.cmd.control.body",    icon: <SlidersHorizontal className={ICON} strokeWidth={1.6} /> },
];

const PARTNERS: { id: string; nameKey: string; subKey: string }[] = [
  { id: "nexora",   nameKey: "ent.partner.nexora.name",   subKey: "ent.partner.nexora.sub" },
  { id: "vertex",   nameKey: "ent.partner.vertex.name",   subKey: "ent.partner.vertex.sub" },
  { id: "alphora",  nameKey: "ent.partner.alphora.name",  subKey: "ent.partner.alphora.sub" },
  { id: "noventic", nameKey: "ent.partner.noventic.name", subKey: "ent.partner.noventic.sub" },
  { id: "quantum",  nameKey: "ent.partner.quantum.name",  subKey: "ent.partner.quantum.sub" },
  { id: "stratum",  nameKey: "ent.partner.stratum.name",  subKey: "ent.partner.stratum.sub" },
];

export default function Enterprise() {
  const { t } = useT();

  return (
    <div className="relative min-h-screen bg-[#03060d] text-[var(--color-ivory)] overflow-x-hidden">
      <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,rgba(255, 122, 0,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_85%_15%,rgba(255, 122, 0,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#03060d_0%,#050a16_50%,#03060d_100%)]" />
      </div>

      <Navbar />

      <main className="relative z-[1] page-enter">
        {/* HERO */}
        <section className="relative pt-32 md:pt-40 pb-16 md:pb-20 overflow-hidden">
          <div className="container">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-10 lg:gap-12 items-center">
              <div className="max-w-[640px]">
                <div className="inline-flex items-center gap-2 text-[12px] font-mono tracking-[0.22em] uppercase text-[#FF7A00]">
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
                  <span>{t("ent.eyebrow")}</span>
                </div>
                <h1 className="font-display text-[44px] sm:text-[54px] md:text-[64px] leading-[1.04] tracking-[-0.02em] font-semibold mt-6">
                  {t("ent.hero.title.line1")}
                  <br />
                  <span className="text-[#FF7A00]">{t("ent.hero.title.line2")}</span>
                </h1>
                <p className="text-[15.5px] leading-[1.7] text-[oklch(0.78_0.012_250)] mt-6 max-w-[520px]">
                  {t("ent.hero.body")}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-8">
                  <Link href="/book-strategy" className="btn-primary">
                    {t("nav.cta")}
                    <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
                  </Link>
                  <Link
                    href="#systems"
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#FF7A00]/40 hover:text-[#FF7A00] text-[13.5px] font-medium text-[var(--color-ivory)] transition-colors"
                  >
                    {t("ent.cta.explore")}
                    <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,rgba(255, 122, 0,0.18),transparent_60%)]" />
                  <img
                    src={HERO_VISUAL}
                    alt={t("ent.hero.imageAlt")}
                    width={1408}
                    height={1056}
                    className="w-full h-full object-contain select-none"
                    fetchPriority="high"
                    decoding="async"
                  />
                </div>

                <FloatingPerformanceTag t={t} className="absolute -right-2 sm:right-2 top-4 md:top-8 w-[200px]" />
                <FloatingEfficiencyTag  t={t} className="absolute right-2 sm:right-6 top-[42%] w-[210px]" />
                <FloatingComplianceTag  t={t} className="absolute right-4 sm:right-10 bottom-6 w-[200px]" />
              </div>
            </div>
          </div>
        </section>

        {/* SYSTEMS */}
        <section id="systems" className="relative py-14 md:py-18 border-t border-white/[0.05]">
          <div className="container">
            <div className="text-center max-w-[860px] mx-auto">
              <h2 className="font-display text-[34px] sm:text-[40px] md:text-[46px] leading-[1.08] tracking-[-0.015em] font-semibold">
                {t("ent.systems.title.lead")} <span className="text-[#FF7A00]">{t("ent.systems.title.accent")}</span>
              </h2>
              <p className="text-[15.5px] leading-[1.7] text-[oklch(0.78_0.012_250)] mt-5">
                {t("ent.systems.subtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 mt-12">
              {CAPS.map((c) => (
                <article
                  key={c.id}
                  id={c.id}
                  className="feature-card glass-soft p-6 flex flex-col gap-4 min-h-[320px] scroll-mt-28"
                >
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="icon-chip glow-orange w-10 h-10 rounded-lg">
                      {c.icon}
                    </span>
                  </div>
                  <h3 className="font-display text-[18.5px] tracking-[-0.005em] font-semibold leading-snug">
                    {t(c.titleKey)}
                  </h3>
                  <p className="text-[13.5px] leading-[1.65] text-[oklch(0.78_0.012_250)]">
                    {t(c.bodyKey)}
                  </p>
                  <ul className="flex flex-col gap-1.5 mt-auto">
                    {c.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-[13px] text-[var(--color-ivory)]">
                        <span aria-hidden className="mt-[7px] w-[5px] h-[5px] rounded-full bg-[#FF7A00] shadow-[0_0_8px_rgba(255, 122, 0,0.6)]" />
                        <span>{t(b)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={c.id === "custom" ? "/custom-software" : `/enterprise#${c.id}`}
                    className="inline-flex items-center gap-1.5 text-[13px] text-[#FF7A00] hover:text-[#FF8A33] mt-2 transition-colors"
                  >
                    {t("infra.cap.learnMore")}
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* COMMAND CENTER */}
        <section className="relative py-14 md:py-18 border-t border-white/[0.05]">
          <div className="container">
            <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-10 lg:gap-14 items-center">
              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-white/[0.06] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
                <img
                  src={COMMAND_VISUAL}
                  alt={t("ent.cmd.imageAlt")}
                  width={2560}
                  height={1440}
                  className="w-full h-full object-cover select-none"
                  loading="lazy"
                  decoding="async"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-tr from-[#03060d]/30 via-transparent to-[#03060d]/20" />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 text-[12px] font-mono tracking-[0.22em] uppercase text-[#FF7A00]">
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={2.25} />
                  <span>{t("ent.cmd.eyebrow")}</span>
                </div>
                <h2 className="font-display text-[32px] sm:text-[38px] md:text-[42px] leading-[1.08] tracking-[-0.01em] font-semibold mt-5">
                  {t("ent.cmd.title")}
                </h2>
                <p className="text-[15px] leading-[1.7] text-[oklch(0.78_0.012_250)] mt-5 max-w-[560px]">
                  {t("ent.cmd.body")}
                </p>

                <div className="grid sm:grid-cols-2 gap-4 mt-8">
                  {COMMAND_MINIS.map((m) => (
                    <div key={m.id} className="feature-card glass-soft px-4 py-4 flex items-start gap-3">
                      <span aria-hidden className="icon-chip glow-orange w-9 h-9 rounded-lg shrink-0">
                        {m.icon}
                      </span>
                      <div>
                        <div className="text-[14px] font-medium text-[var(--color-ivory)]">{t(m.titleKey)}</div>
                        <div className="text-[12.5px] text-[oklch(0.74_0.012_250)] leading-[1.5] mt-0.5">{t(m.bodyKey)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/solutions"
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-md mt-8 border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#FF7A00]/40 hover:text-[#FF7A00] text-[13.5px] font-medium text-[var(--color-ivory)] transition-colors"
                >
                  {t("ent.cmd.cta")}
                  <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* PARTNERS */}
        <section className="relative py-12 md:py-16 border-t border-white/[0.05]">
          <div className="container">
            <div className="text-center text-[11.5px] font-mono tracking-[0.32em] uppercase text-[oklch(0.65_0.012_250)]">
              {t("ent.partners.title")}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 lg:gap-4 mt-10">
              {PARTNERS.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col items-center justify-center text-center px-3 py-5 rounded-md border border-white/[0.05] bg-white/[0.015] hover:border-[#FF7A00]/25 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="font-display text-[18px] tracking-[0.22em] uppercase text-[var(--color-ivory)]">
                    {t(p.nameKey)}
                  </div>
                  <div className="text-[10px] font-mono tracking-[0.28em] uppercase text-[oklch(0.55_0.012_250)] mt-1">
                    {t(p.subKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ============================== Floating tags ============================== */

function TagShell({
  children,
  className,
  style,
}: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`glass-strong rounded-xl px-3.5 py-3 border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}

function FloatingPerformanceTag({
  t,
  className,
}: { t: (k: string) => string; className?: string }) {
  return (
    <TagShell className={className}>
      <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] uppercase text-[oklch(0.78_0.012_250)]">
        <BarChart3 className="w-3 h-3 text-[#FF7A00]" strokeWidth={2.25} />
        <span>{t("ent.tag.performance.label")}</span>
      </div>
      <div className="font-display text-[26px] tracking-[-0.02em] text-[var(--color-ivory)] mt-1.5">
        98.7<span className="text-[14px] text-[#FF7A00] align-top ml-0.5">%</span>
      </div>
      <div className="text-[10.5px] text-[oklch(0.7_0.012_250)] mt-0.5">{t("ent.tag.performance.sub")}</div>
      <svg className="mt-2 w-full h-7" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="entLine" x1="0" y1="0" x2="120" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FF7A00" stopOpacity="0.2" />
            <stop offset="0.5" stopColor="#FF7A00" stopOpacity="1" />
            <stop offset="1" stopColor="#FF8A33" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path
          d="M0 22 L12 19 L22 21 L32 14 L46 16 L58 10 L72 13 L86 7 L100 9 L120 3"
          fill="none"
          stroke="url(#entLine)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </TagShell>
  );
}

function FloatingEfficiencyTag({
  t,
  className,
}: { t: (k: string) => string; className?: string }) {
  return (
    <TagShell className={className}>
      <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] uppercase text-[oklch(0.78_0.012_250)]">
        <TrendingUp className="w-3 h-3 text-[#FF7A00]" strokeWidth={2.25} />
        <span>{t("ent.tag.efficiency.label")}</span>
      </div>
      <div className="flex items-end justify-between mt-1.5 gap-2">
        <div>
          <div className="font-display text-[26px] tracking-[-0.02em] text-[var(--color-ivory)]">
            <span className="text-[#FF7A00]">+</span>47<span className="text-[14px] text-[#FF7A00] align-top ml-0.5">%</span>
          </div>
          <div className="text-[10.5px] text-[oklch(0.7_0.012_250)]">{t("ent.tag.efficiency.sub")}</div>
        </div>
        <div className="flex items-end gap-[3px] h-7" aria-hidden>
          {[35, 50, 38, 60, 55, 78, 70, 92].map((h, i) => (
            <span
              key={i}
              className="w-[3.5px] rounded-[1px]"
              style={{
                height: `${h}%`,
                background: "linear-gradient(180deg, #FF8A33 0%, #FF7A00 100%)",
                boxShadow: "0 0 6px rgba(255, 122, 0,0.45)",
              }}
            />
          ))}
        </div>
      </div>
    </TagShell>
  );
}

function FloatingComplianceTag({
  t,
  className,
}: { t: (k: string) => string; className?: string }) {
  return (
    <TagShell className={className}>
      <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] uppercase text-[oklch(0.78_0.012_250)]">
        <ShieldIcon className="w-3 h-3 text-[#FF7A00]" strokeWidth={2.25} />
        <span>{t("ent.tag.compliance.label")}</span>
      </div>
      <div className="font-display text-[24px] tracking-[-0.01em] text-[var(--color-ivory)] mt-1.5">Audit-Ready</div>
      <div className="text-[10.5px] text-[oklch(0.7_0.012_250)] mt-0.5">{t("ent.tag.compliance.sub")}</div>
    </TagShell>
  );
}
