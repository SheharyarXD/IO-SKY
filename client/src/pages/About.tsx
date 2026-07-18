/**
 * About — IO SKY
 *
 * Master rebuild per uploaded mockup + master spec PDF.
 * Locked design language: deep navy-black atmosphere, restrained orange
 * interaction language, premium glass surfaces, cinematic spacing,
 * executive typography hierarchy, calm enterprise depth.
 *
 * Page sections (top → bottom):
 *   1. Hero          — globe-network visual + headline + intro + CTAs
 *   2. Trust strip   — six partner wordmarks
 *   3. Triad         — Mission · Vision · Purpose (3 glass cards)
 *   4. Why we exist  — copy + 4 micro-cards (icons)
 *   5. Philosophy    — 5 numbered pillars (01–05)
 *   6. Impact        — copy + 4 large-number metrics
 *   7. Trust & sec.  — copy + CTA + 4 badge cards
 *   8. People        — skyline image + team copy + 4 attributes
 *   9. CTA band      — final consultation CTA
 *  10. Footer        — global Footer component
 */

import {
  ArrowRight,
  Target,
  Eye,
  Rocket,
  Network,
  Brain,
  Zap,
  TrendingUp,
  ShieldCheck,
  Lock,
  Server,
  Activity,
  Users,
  Workflow,
  Compass,
  UserCheck,
} from "lucide-react";
import { Link } from "wouter";
import { useT } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/* ------------------------------------------------------------------ */
/* Static asset URLs (lifecycle-bound to webdev project)               */
/* ------------------------------------------------------------------ */
const GLOBE_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-about-globe-v2-kiHXtRNZogDKqZWBu6HdeC.webp";
const TEAM_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-about-team-v2-3mpPvd2TLSVEFh3Jn7GDnp.webp";

/* ------------------------------------------------------------------ */
/* Section eyebrow                                                     */
/* ------------------------------------------------------------------ */
function Eyebrow({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-orange-400 uppercase">
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
function Hero() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      {/* Globe visual */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block">
        <img
          src={GLOBE_IMG}
          alt=""
          className="h-full w-full object-cover object-left"
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#0a0e1a] via-[#0a0e1a]/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#0a0e1a] to-transparent" />
      </div>

      {/* Mobile globe (cropped) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 lg:hidden">
        <img
          src={GLOBE_IMG}
          alt=""
          className="h-full w-full object-cover opacity-50"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a]/40 via-[#0a0e1a]/85 to-[#0a0e1a]" />
      </div>

      <div className="container relative z-10 grid items-center gap-12 pb-24 pt-44 lg:grid-cols-12 lg:pb-32 lg:pt-52">
        <div className="lg:col-span-6">
          <Eyebrow label={t("about.hero.eyebrow")} />
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[58px]">
            {t("about.hero.title.a")}{" "}
            <span className="text-orange-400">
              {t("about.hero.title.b")}
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-white/65">
            {t("about.hero.lead")}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/book-strategy"
              className="group inline-flex items-center gap-2 rounded-md bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(255,122,26,0.85)] transition hover:bg-orange-400"
            >
              {t("about.hero.cta.primary")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#philosophy"
              className="group inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition hover:border-orange-400/60 hover:bg-orange-500/10 hover:text-orange-300"
            >
              {t("about.hero.cta.secondary")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trust strip                                                         */
/* ------------------------------------------------------------------ */
function TrustStrip() {
  const { t } = useT();
  const partners = [
    { name: "NEXORA", line: "GROUP" },
    { name: "VERTEX", line: "INDUSTRIES" },
    { name: "ALPHORA", line: "SYSTEMS" },
    { name: "NOVENTIC", line: "SOLUTIONS" },
    { name: "QUANTUM", line: "ENTERPRISES" },
    { name: "STRATUM", line: "GLOBAL" },
  ];
  return (
    <section className="border-y border-white/5 bg-white/[0.015]">
      <div className="container py-10">
        <p className="text-center text-[10.5px] font-semibold tracking-[0.3em] text-white/45 uppercase">
          {t("about.trust.eyebrow")}
        </p>
        <div className="mt-7 grid grid-cols-2 items-center gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {partners.map((p) => (
            <div
              key={p.name}
              className="text-center text-white/45 transition hover:text-orange-300"
            >
              <div className="text-sm font-semibold tracking-[0.22em]">
                {p.name}
              </div>
              <div className="mt-1 text-[9px] font-semibold tracking-[0.32em] text-white/30">
                {p.line}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Triad — Mission / Vision / Purpose                                  */
/* ------------------------------------------------------------------ */
function Triad() {
  const { t } = useT();
  const cards = [
    {
      eyebrow: t("about.triad.mission.eyebrow"),
      title: t("about.triad.mission.title"),
      body: t("about.triad.mission.body"),
      Icon: Target,
    },
    {
      eyebrow: t("about.triad.vision.eyebrow"),
      title: t("about.triad.vision.title"),
      body: t("about.triad.vision.body"),
      Icon: Eye,
    },
    {
      eyebrow: t("about.triad.purpose.eyebrow"),
      title: t("about.triad.purpose.title"),
      body: t("about.triad.purpose.body"),
      Icon: Rocket,
    },
  ];
  return (
    <section className="border-b border-white/5">
      <div className="container grid gap-6 py-14 md:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.eyebrow}
            className="feature-card group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="text-[10px] font-semibold tracking-[0.28em] text-orange-400 uppercase">
                {c.eyebrow}
              </div>
              <div className="icon-chip flex h-10 w-10 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400">
                <c.Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
              </div>
            </div>
            <h3 className="mt-5 text-xl font-semibold leading-snug text-white">
              {c.title}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Why IO SKY exists                                                   */
/* ------------------------------------------------------------------ */
function WhyExists() {
  const { t } = useT();
  const reasons = [
    {
      Icon: Network,
      title: t("about.why.r1.title"),
      body: t("about.why.r1.body"),
    },
    {
      Icon: Brain,
      title: t("about.why.r2.title"),
      body: t("about.why.r2.body"),
    },
    {
      Icon: Zap,
      title: t("about.why.r3.title"),
      body: t("about.why.r3.body"),
    },
    {
      Icon: TrendingUp,
      title: t("about.why.r4.title"),
      body: t("about.why.r4.body"),
    },
  ];
  return (
    <section className="border-b border-white/5 bg-white/[0.012]">
      <div className="container grid gap-12 py-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Eyebrow label={t("about.why.eyebrow")} />
          <h2 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-[34px]">
            {t("about.why.title")}
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-white/60">
            {t("about.why.body1")}
          </p>
          <p className="mt-4 text-[15px] font-medium text-white/75">
            {t("about.why.body2")}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-white/60">
            {t("about.why.body3")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-7 lg:grid-cols-4">
          {reasons.map((r) => (
            <div
              key={r.title}
              className="feature-card group rounded-xl border border-white/8 bg-white/[0.02] p-5 text-center"
            >
              <div className="icon-chip mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400">
                <r.Icon className="h-5 w-5" strokeWidth={1.7} />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">
                {r.title}
              </h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">
                {r.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Philosophy — 5 numbered pillars                                     */
/* ------------------------------------------------------------------ */
function Philosophy() {
  const { t } = useT();
  const pillars = [
    {
      n: "01",
      title: t("about.phil.p1.title"),
      body: t("about.phil.p1.body"),
    },
    {
      n: "02",
      title: t("about.phil.p2.title"),
      body: t("about.phil.p2.body"),
    },
    {
      n: "03",
      title: t("about.phil.p3.title"),
      body: t("about.phil.p3.body"),
    },
    {
      n: "04",
      title: t("about.phil.p4.title"),
      body: t("about.phil.p4.body"),
    },
    {
      n: "05",
      title: t("about.phil.p5.title"),
      body: t("about.phil.p5.body"),
    },
  ];
  return (
    <section
      id="philosophy"
      className="border-b border-white/5 scroll-mt-24"
    >
      <div className="container grid gap-12 py-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Eyebrow label={t("about.phil.eyebrow")} />
          <h2 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-[34px]">
            {t("about.phil.title")}
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-white/60">
            {t("about.phil.body")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-5">
          {pillars.map((p) => (
            <div
              key={p.n}
              className="feature-card group rounded-xl border border-white/8 bg-white/[0.02] p-5"
            >
              <div className="text-2xl font-semibold tracking-tight text-orange-400">
                {p.n}
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">
                {p.title}
              </h3>
              <p className="mt-3 text-[12.5px] leading-relaxed text-white/55">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Impact — Real systems, real results                                 */
/* ------------------------------------------------------------------ */
function Impact() {
  const { t } = useT();
  const stats = [
    {
      value: t("about.impact.s1.value"),
      label: t("about.impact.s1.label"),
    },
    {
      value: t("about.impact.s2.value"),
      label: t("about.impact.s2.label"),
    },
    {
      value: t("about.impact.s3.value"),
      label: t("about.impact.s3.label"),
    },
    {
      value: t("about.impact.s4.value"),
      label: t("about.impact.s4.label"),
    },
  ];
  return (
    <section className="border-b border-white/5 bg-white/[0.012]">
      <div className="container grid gap-10 py-14 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-5">
          <Eyebrow label={t("about.impact.eyebrow")} />
          <h2 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-[34px]">
            {t("about.impact.title")}
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            {t("about.impact.body")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 lg:col-span-7 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-left">
              <div className="text-3xl font-semibold tracking-tight text-orange-400 sm:text-[34px]">
                {s.value}
              </div>
              <div className="mt-2 text-[12.5px] font-medium leading-snug text-white/65">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trust & Security                                                    */
/* ------------------------------------------------------------------ */
function TrustSecurity() {
  const { t } = useT();
  const badges = [
    {
      Icon: ShieldCheck,
      title: t("about.sec.b1.title"),
      body: t("about.sec.b1.body"),
    },
    {
      Icon: Lock,
      title: t("about.sec.b2.title"),
      body: t("about.sec.b2.body"),
    },
    {
      Icon: Server,
      title: t("about.sec.b3.title"),
      body: t("about.sec.b3.body"),
    },
    {
      Icon: Activity,
      title: t("about.sec.b4.title"),
      body: t("about.sec.b4.body"),
    },
  ];
  return (
    <section className="border-b border-white/5">
      <div className="container grid gap-12 py-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Eyebrow label={t("about.sec.eyebrow")} />
          <h2 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-[34px]">
            {t("about.sec.title")}
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-white/60">
            {t("about.sec.body")}
          </p>
          <Link
            href="/legal/security"
            className="mt-7 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-orange-400/60 hover:bg-orange-500/10 hover:text-orange-300"
          >
            {t("about.sec.cta")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-7 lg:grid-cols-4">
          {badges.map((b) => (
            <div
              key={b.title}
              className="feature-card group rounded-xl border border-white/8 bg-white/[0.02] p-5 text-center"
            >
              <div className="icon-chip mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400">
                <b.Icon className="h-5 w-5" strokeWidth={1.7} />
              </div>
              <h3 className="mt-4 text-sm font-semibold leading-snug text-white">
                {b.title}
              </h3>
              <p className="mt-2 text-[12px] leading-relaxed text-white/55">
                {b.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* People behind IO SKY                                                */
/* ------------------------------------------------------------------ */
function People() {
  const { t } = useT();
  const attrs = [
    {
      Icon: Users,
      title: t("about.people.a1.title"),
      body: t("about.people.a1.body"),
    },
    {
      Icon: Workflow,
      title: t("about.people.a2.title"),
      body: t("about.people.a2.body"),
    },
    {
      Icon: Compass,
      title: t("about.people.a3.title"),
      body: t("about.people.a3.body"),
    },
    {
      Icon: UserCheck,
      title: t("about.people.a4.title"),
      body: t("about.people.a4.body"),
    },
  ];
  return (
    <section className="border-b border-white/5 bg-white/[0.012]">
      <div className="container grid items-center gap-10 py-14 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-white/10 lg:col-span-6">
          <img
            src={TEAM_IMG}
            alt={t("about.people.alt")}
            className="aspect-[16/10] w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="lg:col-span-6">
          <Eyebrow label={t("about.people.eyebrow")} />
          <h2 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-[34px]">
            {t("about.people.title")}
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-white/60">
            {t("about.people.body")}
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {attrs.map((a) => (
              <div key={a.title} className="flex gap-3">
                <div className="icon-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400">
                  <a.Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">
                    {a.title}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">
                    {a.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* CTA band                                                            */
/* ------------------------------------------------------------------ */
function CTABand() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(60% 80% at 80% 50%, rgba(255,122,26,0.18), transparent 60%)`,
        }}
      />
      <div className="container relative grid items-center gap-8 py-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
            {t("about.cta.title")}
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
            {t("about.cta.body")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-5 lg:justify-end">
          <Link
            href="/book-strategy"
            className="group inline-flex items-center gap-2 rounded-md bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(255,122,26,0.85)] transition hover:bg-orange-400"
          >
            {t("about.cta.primary")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/ai-scan"
            className="group inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition hover:border-orange-400/60 hover:bg-orange-500/10 hover:text-orange-300"
          >
            {t("about.cta.secondary")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function About() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <Navbar />
      <main className="page-enter">
        <Hero />
        <Triad />
        <WhyExists />
        <Philosophy />
        <Impact />
        <TrustSecurity />
        <People />
        <CTABand />
      </main>
      <Footer />
    </div>
  );
}
