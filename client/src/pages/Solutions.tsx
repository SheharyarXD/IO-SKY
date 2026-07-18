/**
 * IO SKY — Solutions / Ecosystem page (Package 7).
 *
 * Master commercial conversion page per the Solutions Ecosystem master
 * specification PDF. Replaces the previous flat 3-tier pricing surface.
 *
 * Section order (per spec):
 *   1.  Hero
 *   2.  Ecosystem Overview
 *   3.  Ecosystem Cards (Growth · Elite · Custom Intelligence)
 *   4.  Growth Ecosystem deep-link cue
 *   5.  Elite Ecosystem deep-link cue
 *   6.  Custom Intelligence Infrastructure deep-link cue
 *   7.  AI Scan → Ecosystem Recommendation Flow
 *   8.  Custom Discovery Flow entry
 *   9.  Comparison / Fit Guide
 *   10. What Happens After You Click
 *   11. Security, Cloud, Automation Trust Section
 *   12. Discovery Call CTA band
 *   13. FAQ
 *
 * Every CTA wires to a real route and emits a `solutions.recordClick`
 * analytics event so the admin can see funnel activity.
 *
 * Pricing language: "Starting from" / "Custom scoped" — no "buy now".
 */

import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Cloud,
  Lock,
  Gauge,
  Sparkles,
  CalendarDays,
  Workflow,
  Layers,
  Boxes,
  Cpu,
  ChevronDown,
} from "lucide-react";
import { useT } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

/* ------------------------------------------------------------------ */
/* Hero floating ecosystem visual                                       */
/* ------------------------------------------------------------------ */

const HERO_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-solutions-ecosystem-C35vyimKxuUX95vs65Y8sL.webp";

/* ------------------------------------------------------------------ */
/* Click analytics helper                                               */
/* ------------------------------------------------------------------ */

function useEcosystemClick() {
  const m = trpc.solutions.recordClick.useMutation();
  return (eventKey: string, ecosystem: string | null = null, payload?: string) => {
    m.mutate({ eventKey, source: "solutions", ecosystem, payload: payload ?? null });
  };
}

/* ------------------------------------------------------------------ */
/* Ecosystem card                                                       */
/* ------------------------------------------------------------------ */

type EcosystemId = "growth" | "elite" | "custom";
type Accent = "green" | "orange" | "violet";

interface Ecosystem {
  id: EcosystemId;
  accent: Accent;
  badge?: string;
  name: string;
  label: string;
  priceSetup: string;
  priceMonthly: string;
  description: string;
  inclusions: string[];
  cta: string;
  ctaHref: string;
  clickKey: string;
}

const ACCENT_RING: Record<Accent, string> = {
  green:
    "ring-1 ring-emerald-400/15 hover:ring-emerald-400/40 hover:shadow-[0_24px_72px_-26px_rgba(16,185,129,0.35)]",
  orange:
    "ring-2 ring-[var(--orange)]/55 shadow-[0_24px_72px_-26px_rgba(255,106,0,0.55),0_0_0_1px_rgba(255,106,0,0.30)]",
  violet:
    "ring-1 ring-violet-400/15 hover:ring-violet-400/40 hover:shadow-[0_24px_72px_-26px_rgba(139,92,246,0.35)]",
};
const ACCENT_NAME: Record<Accent, string> = {
  green: "text-emerald-300",
  orange: "text-[var(--orange)]",
  violet: "text-violet-300",
};
const ACCENT_DOT: Record<Accent, string> = {
  green: "text-emerald-400",
  orange: "text-[var(--orange)]",
  violet: "text-violet-400",
};

function EcosystemCard({ eco }: { eco: Ecosystem }) {
  const recordClick = useEcosystemClick();
  return (
    <div
      className={[
        "relative rounded-2xl p-7 sm:p-8 glass-soft transition-all duration-300",
        ACCENT_RING[eco.accent],
        eco.accent === "orange" ? "lg:-mt-4 lg:mb-4" : "",
      ].join(" ")}
    >
      {eco.badge ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10.5px] uppercase tracking-[0.18em] font-semibold bg-[var(--orange)] text-[#0B1020] shadow-[0_8px_24px_-8px_rgba(255,106,0,0.7)]">
          {eco.badge}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p
          className={[
            "text-[10.5px] uppercase tracking-[0.22em] font-semibold",
            ACCENT_NAME[eco.accent],
          ].join(" ")}
        >
          {eco.name}
        </p>
        <p className="text-[13.5px] text-white/60">{eco.label}</p>
      </div>

      <div className="mt-6 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.20em] text-white/45">
          Starting from
        </p>
        <p className="text-2xl font-semibold text-white">{eco.priceSetup}</p>
        <p className="text-[13px] text-white/55">{eco.priceMonthly}</p>
      </div>

      <p className="mt-6 text-[14px] leading-relaxed text-white/72">
        {eco.description}
      </p>

      <ul className="mt-6 space-y-2.5">
        {eco.inclusions.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-[13.5px] text-white/78">
            <CheckCircle2
              className={["mt-0.5 size-4 shrink-0", ACCENT_DOT[eco.accent]].join(" ")}
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <Link
          href={eco.ctaHref}
          onClick={() => recordClick(eco.clickKey, eco.id)}
          className={[
            "group inline-flex items-center justify-between w-full px-5 py-3 rounded-xl border text-[13.5px] font-semibold transition-all duration-200 active:scale-[0.98]",
            eco.accent === "orange"
              ? "bg-[var(--orange)] border-transparent text-[#0B1020] hover:bg-[var(--orange-hover)]"
              : "border-white/12 text-white/85 hover:border-[var(--orange)]/55 hover:text-[var(--orange)]",
          ].join(" ")}
        >
          <span>{eco.cta}</span>
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section helpers                                                     */
/* ------------------------------------------------------------------ */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.24em] font-semibold text-[var(--orange)]/85">
      <span className="size-1.5 rounded-full bg-[var(--orange)] shadow-[0_0_12px_var(--orange)]" />
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
}) {
  return (
    <div className="max-w-3xl">
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <h2 className="mt-4 text-3xl sm:text-4xl font-semibold text-white tracking-tight leading-[1.15]">
        {title}
      </h2>
      {body ? (
        <p className="mt-4 text-[15px] leading-relaxed text-white/65">{body}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ item                                                            */
/* ------------------------------------------------------------------ */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] transition-colors duration-200 hover:border-[var(--orange)]/35">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-[14.5px] font-medium text-white/90">{q}</span>
        <ChevronDown
          className={[
            "size-4 text-white/55 transition-transform duration-200",
            open ? "rotate-180 text-[var(--orange)]" : "",
          ].join(" ")}
        />
      </button>
      <div
        className={[
          "grid transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 pt-0 text-[13.5px] leading-relaxed text-white/65">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Solutions page                                                       */
/* ------------------------------------------------------------------ */

export default function Solutions() {
  const { t } = useT();
  const recordClick = useEcosystemClick();

  // Persist an anonymous session token so we can later stitch a funnel.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("io-sky-session")) {
      localStorage.setItem(
        "io-sky-session",
        Math.random().toString(36).slice(2, 11) +
          Math.random().toString(36).slice(2, 11),
      );
    }
    recordClick("solutions_page_view", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ecosystems = useMemo<Ecosystem[]>(
    () => [
      {
        id: "growth",
        accent: "green",
        name: "Growth Ecosystem",
        label: "For ambitious startups and scale-ups",
        priceSetup: "From EUR 15,000 setup",
        priceMonthly: "From EUR 3,500/month",
        description:
          "A premium operational foundation for companies that need CRM structure, workflow automation, reporting, AI-assisted processes and scalable execution systems.",
        inclusions: [
          "CRM and lead infrastructure",
          "Workflow automation",
          "AI Scan integration",
          "Operational dashboards",
          "Reporting and recommendations",
          "Secure document and client portal foundations",
          "Monthly optimization and system oversight",
        ],
        cta: "Explore Growth Ecosystem",
        ctaHref: "/solutions/growth-ecosystem",
        clickKey: "solutions_growth_click",
      },
      {
        id: "elite",
        accent: "orange",
        badge: "MOST CHOSEN",
        name: "Elite Ecosystem",
        label: "For advanced operations and enterprise infrastructure",
        priceSetup: "From EUR 40,000 setup",
        priceMonthly: "From EUR 8,000/month",
        description:
          "A high-control operational intelligence layer for companies that need advanced automation, AI agents, portals, security monitoring, cloud infrastructure, integrations and executive visibility.",
        inclusions: [
          "Advanced AI workflows and agent systems",
          "Custom dashboards and portals",
          "Enterprise integrations",
          "Cloud and backup architecture",
          "Security monitoring and audit systems",
          "IVR / campaign / communication infrastructure",
          "Ongoing optimization, monitoring and operational support",
        ],
        cta: "Explore Elite Ecosystem",
        ctaHref: "/solutions/elite-ecosystem",
        clickKey: "solutions_elite_click",
      },
      {
        id: "custom",
        accent: "violet",
        name: "Custom Intelligence Infrastructure",
        label: "For proprietary systems, custom software and enterprise infrastructure",
        priceSetup: "Custom scoped",
        priceMonthly: "Custom retainer",
        description:
          "For companies that need proprietary software, mobile apps, custom portals, private AI systems, IVR, integrations, internal tools or operational infrastructure built around their exact business model.",
        inclusions: [
          "Custom software · mobile applications",
          "Private AI systems · internal dashboards",
          "Custom CRM or ERP layers",
          "AI agents and IVR systems",
          "Enterprise integrations",
          "Custom reporting and analytics",
          "Security and cloud architecture",
        ],
        cta: "Start Custom Discovery",
        ctaHref: "/solutions/custom-intelligence-infrastructure",
        clickKey: "custom_discovery_start",
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <Navbar />

      {/* ===================================================================
       * 1. HERO
       * =================================================================*/}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 30% 0%, rgba(255,106,0,0.10), transparent 60%), radial-gradient(50% 60% at 80% 30%, rgba(139,92,246,0.10), transparent 60%)",
          }}
        />
        <div className="container pt-24 pb-16 lg:pt-32 lg:pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <SectionEyebrow>IO SKY SOLUTIONS</SectionEyebrow>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.05]">
              Operational ecosystems engineered for{" "}
              <span className="text-[var(--orange)]">scalable execution.</span>
            </h1>
            <p className="mt-6 text-[16px] sm:text-[17px] leading-relaxed text-white/68 max-w-xl">
              From AI-powered workflows to custom infrastructure, IO SKY builds the systems
              companies need to operate, grow and scale with intelligence.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#ecosystems"
                onClick={() => recordClick("solutions_hero_explore", null)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
              >
                Explore Ecosystems
                <ArrowRight className="size-4" />
              </a>
              <Link
                href="/ai-scan?source=solutions_hero"
                onClick={() => recordClick("solutions_hero_ai_scan", null)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/12 text-white/85 text-[13.5px] font-medium hover:border-[var(--orange)]/55 hover:text-[var(--orange)] transition-colors"
              >
                <Sparkles className="size-4" />
                Start AI Scan
              </Link>
              <Link
                href="/solutions/custom-intelligence-infrastructure"
                onClick={() => recordClick("solutions_hero_custom", "custom")}
                className="text-[13px] text-white/55 hover:text-[var(--orange)] underline-offset-4 hover:underline"
              >
                Need custom infrastructure?
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src={HERO_IMG}
              alt="IO SKY operational ecosystem"
              className="w-full max-w-[520px] mx-auto select-none pointer-events-none"
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* ===================================================================
       * 2. ECOSYSTEM OVERVIEW
       * =================================================================*/}
      <section className="container pt-4 pb-16">
        <SectionHeading
          eyebrow="ECOSYSTEM OVERVIEW"
          title={<>Choose the operational layer your company needs next.</>}
          body="Every IO SKY ecosystem combines strategy, automation, infrastructure, cloud systems, reporting, security and continuous optimization. The right ecosystem depends on your operational maturity, complexity and growth goals."
        />
      </section>

      {/* ===================================================================
       * 3. ECOSYSTEM CARDS
       * =================================================================*/}
      <section id="ecosystems" className="container pb-20">
        <div className="grid gap-6 lg:gap-8 md:grid-cols-2 lg:grid-cols-3 items-start">
          {ecosystems.map((eco) => (
            <EcosystemCard key={eco.id} eco={eco} />
          ))}
        </div>
      </section>

      {/* ===================================================================
       * 7. AI SCAN → ECOSYSTEM RECOMMENDATION FLOW
       * =================================================================*/}
      <section className="container py-16">
        <div className="rounded-2xl glass-soft p-8 lg:p-12 ring-1 ring-white/8">
          <div className="grid lg:grid-cols-[1.1fr,1fr] gap-10 items-center">
            <div>
              <SectionEyebrow>AI SCAN RECOMMENDATION</SectionEyebrow>
              <h2 className="mt-4 text-3xl sm:text-4xl font-semibold text-white tracking-tight">
                Let our AI map you to the right ecosystem in under 4 minutes.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/65 max-w-xl">
                The AI Scan analyzes your current systems, complexity and growth goals.
                You receive a personalized recommendation across Growth, Elite or
                Custom Intelligence Infrastructure — with rationale and next steps.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/ai-scan?source=solutions"
                  onClick={() => recordClick("solutions_ai_scan_open", null)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
                >
                  <Sparkles className="size-4" />
                  Start AI Scan
                </Link>
                <Link
                  href="/book-strategy?source=solutions"
                  onClick={() => recordClick("solutions_book_strategy", null)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/12 text-white/85 text-[13.5px] font-medium hover:border-[var(--orange)]/55 hover:text-[var(--orange)] transition-colors"
                >
                  <CalendarDays className="size-4" />
                  Book Discovery Call
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { l: "Lower complexity", e: "→ Growth", k: "growth" as const },
                { l: "Multi-system ops", e: "→ Elite", k: "elite" as const },
                { l: "Custom build", e: "→ Custom", k: "custom" as const },
              ].map((t) => (
                <div
                  key={t.k}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-4"
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                    {t.l}
                  </p>
                  <p className="mt-2 text-[13.5px] font-semibold text-[var(--orange)]">
                    {t.e}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
       * 8. CUSTOM DISCOVERY ENTRY
       * =================================================================*/}
      <section className="container py-16">
        <SectionHeading
          eyebrow="CUSTOM INTELLIGENCE INFRASTRUCTURE"
          title={<>Need a system built around your exact operating model?</>}
          body="Run a guided Custom Discovery to scope proprietary software, mobile apps, private AI systems, IVR, or internal dashboards. Multi-step intake, autosaved, and ends in a personalized roadmap recommendation."
        />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/solutions/custom-intelligence-infrastructure"
            onClick={() => recordClick("solutions_custom_discovery_open", "custom")}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
          >
            <Layers className="size-4" />
            Start Custom Discovery
          </Link>
          <Link
            href="/solutions/proposal-request?ecosystem=custom"
            onClick={() => recordClick("solutions_proposal_open", "custom")}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/12 text-white/85 text-[13.5px] font-medium hover:border-[var(--orange)]/55 hover:text-[var(--orange)] transition-colors"
          >
            Request Proposal
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* ===================================================================
       * 9. COMPARISON / FIT GUIDE
       * =================================================================*/}
      <section className="container py-16">
        <SectionHeading
          eyebrow="ECOSYSTEM FIT GUIDE"
          title={<>How the ecosystems compare at a glance.</>}
        />
        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                <th className="py-3 pr-4 font-semibold">Capability</th>
                <th className="py-3 px-4 font-semibold">Growth</th>
                <th className="py-3 px-4 font-semibold text-[var(--orange)]">Elite</th>
                <th className="py-3 px-4 font-semibold">Custom Intelligence</th>
              </tr>
            </thead>
            <tbody className="text-[13.5px] text-white/72">
              {[
                ["CRM & lead infrastructure", "Standard", "Advanced", "Custom"],
                ["Workflow automation", "Core flows", "Multi-system", "Bespoke pipelines"],
                ["AI agents", "—", "Production agents", "Private AI systems"],
                ["Custom portals & dashboards", "Foundations", "Full custom", "Built-to-spec"],
                ["IVR / voice / campaigns", "—", "Included", "Optional, custom"],
                ["Compliance & audit", "Standard", "Enterprise", "Custom-scoped"],
                ["Onboarding timeline", "4–6 weeks", "8–14 weeks", "Discovery → Build"],
              ].map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-white/6 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 pr-4 text-white/85 font-medium">{row[0]}</td>
                  <td className="py-3 px-4">{row[1]}</td>
                  <td className="py-3 px-4 text-[var(--orange)]">{row[2]}</td>
                  <td className="py-3 px-4">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===================================================================
       * 10. WHAT HAPPENS AFTER YOU CLICK
       * =================================================================*/}
      <section className="container py-16">
        <SectionHeading
          eyebrow="WHAT HAPPENS NEXT"
          title={<>A premium intake — never a generic checkout.</>}
        />
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { i: Workflow, t: "Personalized intake", b: "We capture your context, systems and operational goals." },
            { i: Cpu, t: "AI-recommended fit", b: "AI Scan ranks Growth, Elite or Custom for your stage." },
            { i: CalendarDays, t: "Strategy call scheduled", b: "Native booking, no third-party calendar dependencies." },
            { i: Boxes, t: "Custom proposal delivered", b: "Branded scope, timeline and pricing in your inbox." },
          ].map(({ i: Icon, t, b }, idx) => (
            <div
              key={idx}
              className="rounded-2xl glass-soft p-6 ring-1 ring-white/8 hover:ring-[var(--orange)]/35 transition-all duration-200"
            >
              <Icon className="size-6 text-[var(--orange)]" />
              <p className="mt-4 text-[14px] font-semibold text-white">{t}</p>
              <p className="mt-2 text-[13px] text-white/60 leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================
       * 11. SECURITY, CLOUD, AUTOMATION TRUST
       * =================================================================*/}
      <section className="container py-16">
        <div className="rounded-2xl glass-soft p-8 lg:p-10 ring-1 ring-white/8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { i: ShieldCheck, t: "Security-first architecture", b: "Encryption, audit logs, retention policies on every action." },
            { i: Cloud, t: "Cloud-native", b: "AWS / EU regions, rolling deployments, daily backups." },
            { i: Lock, t: "MFA & SSO", b: "TOTP, SSO, device trust on every IO SKY surface." },
            { i: Gauge, t: "Operational SLA", b: "High-availability targets with continuous monitoring and response-time alerts." },
          ].map(({ i: Icon, t, b }, idx) => (
            <div key={idx} className="space-y-2">
              <Icon className="size-5 text-[var(--orange)]" />
              <p className="text-[13.5px] font-semibold text-white">{t}</p>
              <p className="text-[12.5px] text-white/55 leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================
       * 12. STRATEGY CALL CTA BAND
       * =================================================================*/}
      <section className="container py-16">
        <div className="relative overflow-hidden rounded-2xl p-8 sm:p-10 glass-soft ring-1 ring-[var(--orange)]/35">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-80"
            style={{
              background:
                "radial-gradient(60% 80% at 80% 0%, rgba(255,106,0,0.18), transparent 70%)",
            }}
          />
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <SectionEyebrow>STRATEGY CALL</SectionEyebrow>
              <h3 className="mt-3 text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                Talk to an IO SKY operational architect.
              </h3>
              <p className="mt-3 text-[14px] text-white/65">
                30 minutes, no pitch, no sales pressure — just a clear read on
                the ecosystem that fits your stage.
              </p>
            </div>
            <Link
              href="/book-strategy?source=solutions"
              onClick={() => recordClick("solutions_strategy_cta", null)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
            >
              <CalendarDays className="size-4" />
              Book Discovery Call
            </Link>
          </div>
        </div>
      </section>

      {/* ===================================================================
       * 13. FAQ
       * =================================================================*/}
      <section className="container py-16">
        <SectionHeading
          eyebrow="FAQ"
          title={<>Frequently asked questions.</>}
        />
        <div className="mt-10 grid lg:grid-cols-2 gap-4">
          {[
            {
              q: "Is the setup price fixed?",
              a: "No. Setup investment is scoped to your environment. The numbers shown are starting points based on common implementations.",
            },
            {
              q: "Do I have to choose an ecosystem now?",
              a: "No. Start the AI Scan or book a discovery call — IO SKY will recommend a fit before you commit.",
            },
            {
              q: "Can Custom Intelligence Infrastructure replace internal dev teams?",
              a: "Often yes for specific products. We can also work alongside your team in a hybrid build / co-build model.",
            },
            {
              q: "Where is my data hosted?",
              a: "EU-region cloud by default. Other regions available on request. All data is encrypted in transit and at rest.",
            },
            {
              q: "Do you integrate with Salesforce, HubSpot or our existing CRM?",
              a: "Yes — Growth and Elite include CRM integration. Custom Intelligence Infrastructure can replace or extend any existing CRM.",
            },
            {
              q: "How quickly can we start?",
              a: "Growth: typically 4–6 weeks. Elite: 8–14 weeks. Custom: discovery first, then build plan with timeline.",
            },
          ].map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
