/*
 * IO SKY — Intelligence page (per IO_SKY_Master_Design_Spec.md §4).
 *
 * Sections (top → bottom):
 *   1. Hero — eyebrow · headline · body · Book Discovery Call CTA ·
 *      isometric particle dome visual with floating telemetry tags (kept —
 *      not contradicted by spec, no visual specified either way)
 *   2. What Happens Together Is Often Seen Separately
 *   3. Routine in One Situation, Critical in Another
 *   4. Not All of Them Can Wait
 *   5. The Ability to Act Is Not a Reason to Act
 *   6. Not Everything Needs Intervention
 *   7. Work Doesn't Need to Wait (3-state row)
 *   8. Intelligence Earns Its Place (4 cards)
 *   9. Final CTA
 *
 * Locked design language identical to Homepage and Foundation: deep
 * navy-black, restrained orange accents, premium glass surfaces, executive
 * typography. All copy localized via useT().
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bot, Eye, LayoutList, Workflow,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { SiteImage } from "@/components/SiteImage";
import Footer from "@/components/Footer";
import RevealOnScroll from "@/components/RevealOnScroll";
import { useT } from "@/contexts/LanguageContext";

/*
 * Editorial visuals resolve through the central registry (client/src/lib/siteImages.ts).
 *
 * These previously pointed at the Manus/Forge CDN, which now returns 403 for
 * every asset — the originals are gone and no archived copy exists. <SiteImage>
 * renders a placeholder occupying the same layout box until replacements are
 * supplied, so a missing visual never shows as a broken-image icon.
 */

function TextSection({
  title,
  paragraphs,
  emphasizeLast,
}: {
  title: React.ReactNode;
  paragraphs: string[];
  emphasizeLast?: boolean;
}) {
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="max-w-[680px] mx-auto text-center">
          <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
            {title}
          </h2>
          <div className="mt-8 space-y-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)] text-left">
            {paragraphs.map((p, i) => (
              <p key={i} className={emphasizeLast && i === paragraphs.length - 1 ? "text-[var(--color-ivory)]" : undefined}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Intelligence() {
  const { t } = useT();

  const EARNS = [
    { titleKey: "intelligence2.earns.card1.title", bodyKey: "intelligence2.earns.card1.body", icon: Eye },
    { titleKey: "intelligence2.earns.card2.title", bodyKey: "intelligence2.earns.card2.body", icon: LayoutList },
    { titleKey: "intelligence2.earns.card3.title", bodyKey: "intelligence2.earns.card3.body", icon: Workflow },
    { titleKey: "intelligence2.earns.card4.title", bodyKey: "intelligence2.earns.card4.body", icon: Bot },
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
              <div className="lg:col-span-6">
                <div className="eyebrow">{t("intel.hero.eyebrow")}</div>
                <h1 className="mt-5 font-display font-medium tracking-[-0.02em] text-[38px] sm:text-[46px] md:text-[52px] leading-[1.1] text-[var(--color-ivory)]">
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
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </Link>
                </div>
              </div>

              {/* Right — particle dome visual */}
              <div className="lg:col-span-6 relative">
                <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden">
                  <SiteImage
                    image="intelligence.hero"
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

        <RevealOnScroll>
          <TextSection
            title={t("intelligence2.together.title")}
            paragraphs={[
              t("intelligence2.together.body1"),
              t("intelligence2.together.body2"),
              t("intelligence2.together.body3"),
            ]}
            emphasizeLast={false}
          />
        </RevealOnScroll>
        <RevealOnScroll>
          <div className="container -mt-16 mb-8">
            <p className="max-w-[680px] mx-auto text-center text-[15px] md:text-[16px] font-medium text-[var(--color-ivory)]">
              {t("intelligence2.together.body4")}
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <TextSection
            title={t("intelligence2.routine.title")}
            paragraphs={[t("intelligence2.routine.body1"), t("intelligence2.routine.body2")]}
            emphasizeLast
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <TextSection
            title={t("intelligence2.wait.title")}
            paragraphs={[t("intelligence2.wait.body1"), t("intelligence2.wait.body2")]}
            emphasizeLast
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <TextSection
            title={t("intelligence2.ability.title")}
            paragraphs={[t("intelligence2.ability.body1"), t("intelligence2.ability.body2")]}
            emphasizeLast
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <TextSection
            title={t("intelligence2.intervention.title")}
            paragraphs={[t("intelligence2.intervention.body1"), t("intelligence2.intervention.body2")]}
            emphasizeLast
          />
        </RevealOnScroll>

        {/* Work Doesn't Need to Wait — 3-state row */}
        <RevealOnScroll>
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="max-w-[680px] mx-auto text-center">
                <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("intelligence2.wontWait.title")}
                </h2>
                <p className="mt-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)]">
                  {t("intelligence2.wontWait.body")}
                </p>
              </div>
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-[820px] mx-auto">
                {[
                  { titleKey: "intelligence2.wontWait.state1.title", bodyKey: "intelligence2.wontWait.state1.body" },
                  { titleKey: "intelligence2.wontWait.state2.title", bodyKey: "intelligence2.wontWait.state2.body" },
                  { titleKey: "intelligence2.wontWait.state3.title", bodyKey: "intelligence2.wontWait.state3.body" },
                ].map((s, i) => (
                  <div key={s.titleKey} className="glass-soft p-6 text-center relative">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-orange)] font-medium">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <h3 className="mt-2 text-[16px] font-display font-semibold text-[var(--color-ivory)]">
                      {t(s.titleKey)}
                    </h3>
                    <p className="mt-2 text-[13px] text-[oklch(0.74_0.014_250)] leading-[1.6]">
                      {t(s.bodyKey)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* Intelligence Earns Its Place — 4 cards */}
        <RevealOnScroll>
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="max-w-[680px] mx-auto text-center">
                <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("intelligence2.earns.title")}
                </h2>
              </div>
              <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {EARNS.map((c) => (
                  <div key={c.titleKey} className="feature-card glass-soft p-6 flex flex-col gap-4">
                    <span className="icon-chip">
                      <c.icon className="w-[18px] h-[18px]" strokeWidth={1.7} />
                    </span>
                    <div>
                      <h3 className="text-[15.5px] font-display font-semibold text-[var(--color-ivory)] leading-snug">
                        {t(c.titleKey)}
                      </h3>
                      <p className="mt-2 text-[13px] text-[oklch(0.74_0.014_250)] leading-[1.6]">{t(c.bodyKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* Final CTA */}
        <RevealOnScroll>
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="max-w-[680px] mx-auto text-center">
                <h2 className="font-display font-semibold text-[26px] md:text-[32px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("intelligence2.finalCta.title1")}
                  <br />
                  <span className="text-[var(--color-orange)]">{t("intelligence2.finalCta.title2")}</span>
                </h2>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/book-strategy" className="btn-primary">
                    {t("intelligence2.finalCta.cta")}
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>
      </main>
      <Footer />
    </div>
  );
}

/* ---------- Floating telemetry tags for hero visual ---------- */
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
        {[15, 30, 45].map((y) => (
          <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="oklch(1 0 0 / 0.05)" strokeDasharray="2 4" />
        ))}
        <path d="M0,40 L25,32 L50,28 L75,22 L100,18 L125,14 L150,10 L175,8 L200,5" fill="none" stroke="var(--color-orange)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M0,40 L25,32 L50,28 L75,22 L100,18 L125,14 L150,10 L175,8 L200,5 L200,60 L0,60 Z" fill="url(#out-orange)" />
        <path d="M0,30 L25,32 L50,30 L75,34 L100,32 L125,36 L150,34 L175,38 L200,36" fill="none" stroke="oklch(0.65 0.18 290)" strokeWidth="1.3" strokeLinecap="round" />
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
