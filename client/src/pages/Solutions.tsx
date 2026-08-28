/**
 * IO SKY — Solutions / Ecosystem page.
 *
 * Rebuilt per IO_SKY_Master_Design_Spec.md §5 (Ecosystem Copy) + §6
 * (Ecosystem Capability Interface UI Spec). Replaces the previous 3-tier
 * pricing page — the spec is explicit that ecosystems are "composed around
 * the business objective... not a fixed package," so no pricing is shown.
 *
 * Section order:
 *   1. Hero
 *   2. Ecosystems intro
 *   3. Three ecosystem entry cards (Growth · Operational · Custom) with
 *      progressive-disclosure capability interface beneath the selected one
 *      — one glass surface, closed rows expand to explanation + exactly 5
 *      examples, only one family open at a time
 *   4. Built Around the Business
 *   5. Delivery
 *   6. Final CTA
 *
 * Every CTA still wires to a real route and emits a `solutions.recordClick`
 * analytics event so the admin can see funnel activity.
 */

import { Link } from "wouter";
import { ArrowRight, ChevronDown, Target, Users, Layers3, TrendingUp, LineChart, Workflow, Headset, CalendarClock, Wallet, ShieldAlert, Gauge, Blocks } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import RevealOnScroll from "@/components/RevealOnScroll";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

function useEcosystemClick() {
  const m = trpc.solutions.recordClick.useMutation();
  return (eventKey: string, ecosystem: string | null = null, payload?: string) => {
    m.mutate({ eventKey, source: "solutions", ecosystem, payload: payload ?? null });
  };
}

type EcosystemId = "growth" | "operational" | "custom";

interface Family {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  titleKey: string;
  bodyKey: string;
  examplesKey: string;
}

const GROWTH_FAMILIES: Family[] = [
  { icon: Target, titleKey: "sol2.growth.f1.title", bodyKey: "sol2.growth.f1.body", examplesKey: "sol2.growth.f1.examples" },
  { icon: Users, titleKey: "sol2.growth.f2.title", bodyKey: "sol2.growth.f2.body", examplesKey: "sol2.growth.f2.examples" },
  { icon: Layers3, titleKey: "sol2.growth.f3.title", bodyKey: "sol2.growth.f3.body", examplesKey: "sol2.growth.f3.examples" },
  { icon: TrendingUp, titleKey: "sol2.growth.f4.title", bodyKey: "sol2.growth.f4.body", examplesKey: "sol2.growth.f4.examples" },
  { icon: LineChart, titleKey: "sol2.growth.f5.title", bodyKey: "sol2.growth.f5.body", examplesKey: "sol2.growth.f5.examples" },
];

const OPERATIONAL_FAMILIES: Family[] = [
  { icon: Workflow, titleKey: "sol2.operational.f1.title", bodyKey: "sol2.operational.f1.body", examplesKey: "sol2.operational.f1.examples" },
  { icon: Headset, titleKey: "sol2.operational.f2.title", bodyKey: "sol2.operational.f2.body", examplesKey: "sol2.operational.f2.examples" },
  { icon: CalendarClock, titleKey: "sol2.operational.f3.title", bodyKey: "sol2.operational.f3.body", examplesKey: "sol2.operational.f3.examples" },
  { icon: Wallet, titleKey: "sol2.operational.f4.title", bodyKey: "sol2.operational.f4.body", examplesKey: "sol2.operational.f4.examples" },
  { icon: ShieldAlert, titleKey: "sol2.operational.f5.title", bodyKey: "sol2.operational.f5.body", examplesKey: "sol2.operational.f5.examples" },
  { icon: Gauge, titleKey: "sol2.operational.f6.title", bodyKey: "sol2.operational.f6.body", examplesKey: "sol2.operational.f6.examples" },
];

function CapabilitySurface({ families }: { families: Family[] }) {
  const { t } = useT();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="mt-10 max-w-[1152px] mx-auto glass rounded-[24px] overflow-hidden">
      {families.map((f, i) => {
        const open = openIdx === i;
        return (
          <div key={f.titleKey} className={i > 0 ? "border-t border-white/[0.07]" : undefined}>
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              aria-expanded={open}
              className="w-full flex items-center gap-6 px-6 md:px-10 py-6 text-left min-h-[80px] hover:bg-white/[0.015] transition-colors"
            >
              <f.icon className="w-6 h-6 text-[var(--color-orange)] shrink-0" strokeWidth={1.5} />
              <span className="flex-1 font-display font-medium text-[18px] md:text-[20px] text-[var(--color-ivory)]">
                {t(f.titleKey)}
              </span>
              <ChevronDown
                className={`w-5 h-5 shrink-0 transition-transform duration-300 ${open ? "rotate-180 text-[var(--color-orange)]" : "text-white/55"}`}
                strokeWidth={2}
              />
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="px-6 md:px-10 pb-8 pl-[52px] md:pl-[64px]">
                  <p className="max-w-[620px] text-[15px] md:text-[16px] leading-[1.6] text-[oklch(0.78_0.014_250)]">
                    {t(f.bodyKey)}
                  </p>
                  <div className="mt-6">
                    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[oklch(0.72_0.014_250)]">
                      {t("sol2.examplesLabel").toUpperCase()}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-2 gap-y-2 text-[14px] text-[var(--color-ivory)]">
                      {t(f.examplesKey).split(" · ").map((ex, idx, arr) => (
                        <span key={ex} className="inline-flex items-center gap-2">
                          {ex}
                          {idx < arr.length - 1 && (
                            <span className="w-1 h-1 rounded-full bg-[var(--color-orange)]" />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ECOSYSTEMS: { id: EcosystemId; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; titleKey: string; taglineKey: string }[] = [
  { id: "growth", icon: TrendingUp, titleKey: "sol2.growth.title", taglineKey: "sol2.growth.tagline" },
  { id: "operational", icon: Workflow, titleKey: "sol2.operational.title", taglineKey: "sol2.operational.tagline" },
  { id: "custom", icon: Blocks, titleKey: "sol2.custom.title", taglineKey: "sol2.custom.tagline" },
];

export default function Solutions() {
  const { t } = useT();
  const recordClick = useEcosystemClick();
  const [selected, setSelected] = useState<EcosystemId>("growth");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("io-sky-session")) {
      localStorage.setItem(
        "io-sky-session",
        Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 11),
      );
    }
    recordClick("solutions_page_view", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar />
      <main className="relative z-[1] page-enter">
        {/* Hero */}
        <section className="relative pt-32 md:pt-40 pb-16 md:pb-20">
          <div className="container">
            <div className="max-w-[680px]">
              <h1 className="font-display font-semibold text-[36px] sm:text-[44px] md:text-[52px] leading-[1.1] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                {t("sol2.hero.title")}
              </h1>
              <div className="mt-6 space-y-3 text-[15.5px] md:text-[16px] leading-[1.7] text-[oklch(0.78_0.014_250)]">
                <p>{t("sol2.hero.body1")}</p>
                <p>{t("sol2.hero.body2")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Ecosystems intro */}
        <RevealOnScroll>
          <section className="pb-10 md:pb-14">
            <div className="container">
              <h2 className="font-display font-semibold text-[24px] md:text-[28px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)]">
                {t("sol2.intro.title")}
              </h2>
              <p className="mt-3 max-w-[620px] text-[15px] leading-[1.7] text-[oklch(0.78_0.014_250)]">
                {t("sol2.intro.body")}
              </p>
            </div>
          </section>
        </RevealOnScroll>

        {/* Ecosystem entry cards + capability interface */}
        <RevealOnScroll>
          <section className="pb-20 md:pb-28">
            <div className="container">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {ECOSYSTEMS.map((eco) => {
                  const active = selected === eco.id;
                  return (
                    <button
                      key={eco.id}
                      type="button"
                      onClick={() => {
                        setSelected(eco.id);
                        recordClick(`solutions_ecosystem_select_${eco.id}`, eco.id);
                      }}
                      className={`text-left feature-card glass p-7 min-h-[220px] flex flex-col gap-4 transition-all duration-300 ${
                        active ? "ring-2 ring-[var(--color-orange)]/55" : "ring-1 ring-white/[0.06] hover:ring-white/[0.14]"
                      }`}
                    >
                      <span className={`icon-chip w-11 h-11 rounded-xl ${active ? "glow-orange" : ""}`}>
                        <eco.icon className="w-5 h-5" strokeWidth={1.7} />
                      </span>
                      <div>
                        <h3 className="text-[19px] font-display font-semibold text-[var(--color-ivory)]">
                          {t(eco.titleKey)}
                        </h3>
                        <p className="mt-2 text-[13.5px] text-[oklch(0.76_0.014_250)] leading-[1.6]">
                          {t(eco.taglineKey)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selected === "growth" && (
                <>
                  <p className="mt-8 max-w-[620px] text-[14px] text-[oklch(0.72_0.014_250)] leading-[1.6]">
                    {t("sol2.growth.body")}
                  </p>
                  <p className="mt-2 max-w-[600px] text-[13px] text-[oklch(0.62_0.014_250)] leading-[1.5]">
                    {t("sol2.growth.disclosure")}
                  </p>
                  <CapabilitySurface families={GROWTH_FAMILIES} />
                </>
              )}
              {selected === "operational" && (
                <>
                  <p className="mt-8 max-w-[620px] text-[14px] text-[oklch(0.72_0.014_250)] leading-[1.6]">
                    {t("sol2.operational.body")}
                  </p>
                  <p className="mt-2 max-w-[600px] text-[13px] text-[oklch(0.62_0.014_250)] leading-[1.5]">
                    {t("sol2.operational.disclosure")}
                  </p>
                  <CapabilitySurface families={OPERATIONAL_FAMILIES} />
                </>
              )}
              {selected === "custom" && (
                <div className="mt-10 max-w-[680px] mx-auto text-center glass rounded-[24px] p-10">
                  <p className="text-[15px] md:text-[16px] leading-[1.7] text-[oklch(0.78_0.014_250)]">
                    {t("sol2.custom.body1")}
                  </p>
                  <p className="mt-4 text-[15px] md:text-[16px] leading-[1.7] text-[var(--color-ivory)]">
                    {t("sol2.custom.body2")}
                  </p>
                  <div className="mt-8">
                    <Link
                      href="/solutions/custom-intelligence-infrastructure"
                      onClick={() => recordClick("solutions_custom_discovery_open", "custom")}
                      className="btn-primary"
                    >
                      {t("sol2.finalCta.cta")}
                      <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>
        </RevealOnScroll>

        {/* Built Around the Business */}
        <RevealOnScroll>
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="max-w-[680px] mx-auto text-center">
                <h2 className="font-display font-semibold text-[26px] md:text-[32px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("sol2.built.title")}
                </h2>
                <div className="mt-6 space-y-4 text-[15px] leading-[1.75] text-[oklch(0.78_0.014_250)] text-left">
                  <p>{t("sol2.built.body1")}</p>
                  <p>{t("sol2.built.body2")}</p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* Delivery */}
        <RevealOnScroll>
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="max-w-[680px] mx-auto text-center">
                <h2 className="font-display font-semibold text-[26px] md:text-[32px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("sol2.delivery.title")}
                </h2>
                <div className="mt-6 space-y-4 text-[15px] leading-[1.75] text-[oklch(0.78_0.014_250)] text-left">
                  <p>{t("sol2.delivery.body1")}</p>
                  <p>{t("sol2.delivery.body2")}</p>
                  <p>{t("sol2.delivery.body3")}</p>
                  <p className="text-[var(--color-ivory)]">{t("sol2.delivery.body4")}</p>
                </div>
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
                  {t("sol2.finalCta.title")}
                </h2>
                <p className="mt-4 text-[15px] leading-[1.7] text-[oklch(0.78_0.014_250)]">
                  {t("sol2.finalCta.body")}
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/book-strategy?source=solutions"
                    onClick={() => recordClick("solutions_strategy_cta", null)}
                    className="btn-primary"
                  >
                    {t("sol2.finalCta.cta")}
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
