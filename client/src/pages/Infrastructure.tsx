/*
 * IO SKY — Foundation page (per IO_SKY_Master_Design_Spec.md §3).
 *
 * Sections (top → bottom):
 *   1. Hero — eyebrow · headline · body · Book a Discovery Call CTA ·
 *      operational command center visual (kept — not contradicted by spec,
 *      no visual is specified either way for this hero)
 *   2. What Is Connected
 *   3. Not Every Problem Stands on Its Own
 *   4. First Understand, Then Decide
 *   5. What Needs to Work Together (4 pillars)
 *   6. New Is Not Automatically Better
 *   7. Room to Evolve
 *   8. Intelligence Does Not Begin with AI
 *   9. Final CTA
 *
 * Locked design language: deep navy-black, restrained orange accents, premium
 * glass surfaces, executive typography. All copy localized via useT().
 */
import { Link } from "wouter";
import {
  ArrowRight,
  UserSquare2, Building2, MessagesSquare, LifeBuoy, Cpu, Eye, Activity,
  CheckCircle2, Workflow, KeyRound, Database, ServerCog,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import RevealOnScroll from "@/components/RevealOnScroll";
import { useT } from "@/contexts/LanguageContext";

function TextSection({
  eyebrow,
  title,
  paragraphs,
  emphasizeLast,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  paragraphs: string[];
  emphasizeLast?: boolean;
}) {
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="max-w-[680px] mx-auto text-center">
          {eyebrow && <div className="eyebrow justify-center">{eyebrow}</div>}
          <h2 className={`${eyebrow ? "mt-5" : ""} font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance`}>
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

export default function Infrastructure() {
  const { t } = useT();

  const sources = [
    { key: "infra.diagram.left.crm", icon: <UserSquare2 className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.left.erp", icon: <Building2 className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.left.comms", icon: <MessagesSquare className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.left.support", icon: <LifeBuoy className="w-4 h-4" strokeWidth={1.7} /> },
  ];
  const outcomes = [
    { key: "infra.diagram.right.dashboards", icon: <Activity className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.right.analytics", icon: <Eye className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.right.ai", icon: <Cpu className="w-4 h-4" strokeWidth={1.7} /> },
    { key: "infra.diagram.right.automation", icon: <Workflow className="w-4 h-4" strokeWidth={1.7} /> },
  ];

  const PILLARS = [
    { titleKey: "foundation.pillars.systems.title", bodyKey: "foundation.pillars.systems.body", icon: Workflow },
    { titleKey: "foundation.pillars.identity.title", bodyKey: "foundation.pillars.identity.body", icon: KeyRound },
    { titleKey: "foundation.pillars.data.title", bodyKey: "foundation.pillars.data.body", icon: Database },
    { titleKey: "foundation.pillars.infra.title", bodyKey: "foundation.pillars.infra.body", icon: ServerCog },
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
                <div className="eyebrow">{t("infra.hero.eyebrow")}</div>
                <h1 className="mt-5 font-display font-medium tracking-[-0.02em] text-[34px] sm:text-[42px] md:text-[48px] leading-[1.12] text-[var(--color-ivory)]">
                  {t("infra.hero.title.part1")}
                  <br />
                  <span className="text-[var(--color-orange)]">{t("infra.hero.title.accent")}</span>
                </h1>
                <div className="mt-6 max-w-[560px] space-y-3 text-[15.5px] leading-[1.65] text-[oklch(0.78_0.014_250)]">
                  <p>{t("infra.hero.body.1")}</p>
                  <p>{t("infra.hero.body.2")}</p>
                  <p>{t("infra.hero.body.3")}</p>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/book-strategy" className="btn-primary">
                    {t("infra.hero.cta.book")}
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6 relative">
                <CommandCenter t={t} sources={sources} outcomes={outcomes} />
              </div>
            </div>
          </div>
        </section>

        <RevealOnScroll>
          <TextSection
            title={t("foundation.connected.title")}
            paragraphs={[
              t("foundation.connected.body1"),
              t("foundation.connected.body2"),
              t("foundation.connected.body3"),
              t("foundation.connected.body4"),
            ]}
            emphasizeLast
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="max-w-[680px] mx-auto text-center">
                <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("foundation.notAlone.title")}
                </h2>
                <div className="mt-8 space-y-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)] text-left">
                  <p>{t("foundation.notAlone.body1")}</p>
                  <p>{t("foundation.notAlone.body2")}</p>
                </div>
                <div className="mt-8 glass-soft p-6 text-left space-y-2">
                  <p className="text-[14px] text-[oklch(0.62_0.014_250)]">{t("foundation.notAlone.q1")}</p>
                  <p className="text-[15px] font-medium text-[var(--color-ivory)]">{t("foundation.notAlone.q2")}</p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        <RevealOnScroll>
          <TextSection
            title={
              <>
                {t("foundation.firstUnderstand.title1")}
                <br />
                {t("foundation.firstUnderstand.title2")}
              </>
            }
            paragraphs={[
              t("foundation.firstUnderstand.body1"),
              t("foundation.firstUnderstand.body2"),
              t("foundation.firstUnderstand.body3"),
              t("foundation.firstUnderstand.body4"),
              t("foundation.firstUnderstand.body5"),
              t("foundation.firstUnderstand.body6"),
            ]}
          />
        </RevealOnScroll>

        {/* What Needs to Work Together — 4 pillars */}
        <RevealOnScroll>
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="max-w-[680px] mx-auto text-center">
                <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("foundation.pillars.title")}
                </h2>
                <p className="mt-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)]">
                  {t("foundation.pillars.body")}
                </p>
              </div>
              <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PILLARS.map((p) => (
                  <div key={p.titleKey} className="feature-card glass-soft p-6 flex flex-col gap-4">
                    <span className="icon-chip">
                      <p.icon className="w-[18px] h-[18px]" strokeWidth={1.7} />
                    </span>
                    <div>
                      <h3 className="text-[15.5px] font-display font-semibold text-[var(--color-ivory)] leading-snug">
                        {t(p.titleKey)}
                      </h3>
                      <p className="mt-2 text-[13px] text-[oklch(0.74_0.014_250)] leading-[1.6]">{t(p.bodyKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </RevealOnScroll>

        <RevealOnScroll>
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="max-w-[680px] mx-auto text-center">
                <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("foundation.notBetter.title")}
                </h2>
                <div className="mt-8 space-y-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)] text-left">
                  <p>{t("foundation.notBetter.body1")}</p>
                  <p>{t("foundation.notBetter.body2")}</p>
                </div>
                <div className="mt-8 flex flex-col items-center gap-1.5 text-[15px] font-medium text-[var(--color-ivory)]">
                  <p>{t("foundation.notBetter.triad1")}</p>
                  <p>{t("foundation.notBetter.triad2")}</p>
                  <p>{t("foundation.notBetter.triad3")}</p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        <RevealOnScroll>
          <TextSection
            title={t("foundation.roomToEvolve.title")}
            paragraphs={[
              t("foundation.roomToEvolve.body1"),
              t("foundation.roomToEvolve.body2"),
              t("foundation.roomToEvolve.body3"),
            ]}
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <TextSection
            title={t("foundation.intelligenceStart.title")}
            paragraphs={[
              t("foundation.intelligenceStart.body1"),
              t("foundation.intelligenceStart.body2"),
              t("foundation.intelligenceStart.body3"),
              t("foundation.intelligenceStart.body4"),
              t("foundation.intelligenceStart.body5"),
            ]}
            emphasizeLast
          />
        </RevealOnScroll>

        {/* Final CTA */}
        <RevealOnScroll>
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="max-w-[680px] mx-auto text-center">
                <h2 className="font-display font-semibold text-[26px] md:text-[32px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("foundation.finalCta.title")}
                </h2>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/book-strategy" className="btn-primary">
                    {t("infra.hero.cta.book")}
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
