/**
 * Growth Ecosystem deep-dive page (Package 7).
 *
 * Long-form, conversion-focused. Covers:
 *   • What is the Growth Ecosystem
 *   • What is included (deep feature list)
 *   • Who it's for / not for
 *   • Outcomes & metrics
 *   • Timeline
 *   • Pricing transparency
 *   • CTA — Book Discovery Call / Request Proposal / AI Scan
 *
 * Reuses the master /solutions design vocabulary.
 */
import { Link } from "wouter";
import { useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Boxes,
  Gauge,
  Layers,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";

export default function GrowthEcosystem() {
  const recordClick = trpc.solutions.recordClick.useMutation();

  useEffect(() => {
    recordClick.mutate({
      eventKey: "growth_page_view",
      source: "solutions/growth",
      ecosystem: "growth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fire = (key: string, payload?: string) =>
    recordClick.mutate({
      eventKey: key,
      source: "solutions/growth",
      ecosystem: "growth",
      payload: payload ?? null,
    });

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <Navbar />

      {/* Breadcrumb */}
      <div className="container pt-24 pb-2">
        <Link
          href="/solutions"
          onClick={() => fire("growth_breadcrumb_back")}
          className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-[var(--orange)] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Solutions
        </Link>
      </div>

      {/* Hero */}
      <section className="container pt-6 pb-16 grid lg:grid-cols-[1.2fr,1fr] gap-12 items-start">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.24em] text-emerald-300 font-semibold">
            GROWTH ECOSYSTEM
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.07]">
            An operational foundation built for{" "}
            <span className="text-emerald-300">ambitious scale-ups.</span>
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed text-white/68 max-w-2xl">
            CRM structure, workflow automation, reporting, AI-assisted operations and
            scalable execution systems — packaged into one premium IO SKY ecosystem.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book-strategy?source=growth"
              onClick={() => fire("growth_book_strategy")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
            >
              <CalendarDays className="size-4" />
              Book Discovery Call
            </Link>
            <Link
              href="/solutions/proposal-request?ecosystem=growth"
              onClick={() => fire("growth_request_proposal")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/12 text-white/85 text-[13.5px] font-medium hover:border-[var(--orange)]/55 hover:text-[var(--orange)] transition-colors"
            >
              Request Proposal
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ai-scan?source=growth"
              onClick={() => fire("growth_ai_scan")}
              className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-[var(--orange)] underline-offset-4 hover:underline"
            >
              <Sparkles className="size-4" />
              Run AI Scan first
            </Link>
          </div>
        </div>

        <aside className="rounded-2xl glass-soft p-7 ring-1 ring-emerald-400/15">
          <p className="text-[11px] uppercase tracking-[0.20em] text-white/45">
            Investment
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            From EUR 15,000<span className="text-white/45 text-lg"> setup</span>
          </p>
          <p className="mt-2 text-[13.5px] text-white/60">From EUR 3,500 / month</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-[12.5px] text-white/72">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                Onboarding
              </p>
              <p className="mt-1 font-medium">4–6 weeks</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                Best for
              </p>
              <p className="mt-1 font-medium">10–80 employees</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                AI Scan
              </p>
              <p className="mt-1 font-medium">Included</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                Support
              </p>
              <p className="mt-1 font-medium">Monthly oversight</p>
            </div>
          </div>
        </aside>
      </section>

      {/* What's included */}
      <section className="container py-12">
        <p className="text-[10.5px] uppercase tracking-[0.24em] text-[var(--orange)] font-semibold">
          WHAT'S INCLUDED
        </p>
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
          Every Growth Ecosystem ships with these capabilities.
        </h2>
        <div className="mt-10 grid md:grid-cols-2 gap-4">
          {[
            ["CRM and lead infrastructure", "Modern lead pipeline, qualification flows and segmentation."],
            ["Workflow automation", "Cross-tool automations that remove operational friction."],
            ["AI Scan integration", "Continuous AI analysis of your operations and gaps."],
            ["Operational dashboards", "Single source of truth — KPI visibility for the team."],
            ["Reporting and recommendations", "Monthly briefings with concrete next-step actions."],
            ["Secure document and client portal", "Foundations for client-facing portals when ready."],
            ["Monthly optimization", "An IO SKY operator reviewing system health and outcomes."],
            ["Security baseline", "MFA, audit logs and EU-region cloud included by default."],
          ].map(([t, b], i) => (
            <div
              key={i}
              className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-emerald-400/30 transition-colors"
            >
              <CheckCircle2 className="size-5 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold text-white">{t}</p>
                <p className="mt-1 text-[13px] text-white/60 leading-relaxed">{b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for / not for */}
      <section className="container py-12 grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl glass-soft p-7 ring-1 ring-emerald-400/15">
          <p className="text-[10.5px] uppercase tracking-[0.22em] text-emerald-300 font-semibold">
            WHO IT'S FOR
          </p>
          <h3 className="mt-3 text-2xl font-semibold">
            Scale-ups ready to operationalize growth.
          </h3>
          <ul className="mt-5 space-y-3 text-[14px] text-white/72">
            {[
              "10–80 employees with growing customer & lead volume.",
              "Founder/COO ready to delegate operations to systems.",
              "Tooling sprawl (CRM, sheets, email) hurting consistency.",
              "Ambition to reach next ARR milestone within 12 months.",
            ].map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl glass-soft p-7 ring-1 ring-white/8">
          <p className="text-[10.5px] uppercase tracking-[0.22em] text-white/55 font-semibold">
            WHEN ELITE OR CUSTOM FITS BETTER
          </p>
          <h3 className="mt-3 text-2xl font-semibold">
            Move up the ecosystem if you need…
          </h3>
          <ul className="mt-5 space-y-3 text-[14px] text-white/72">
            {[
              "Multi-system enterprise automation across 5+ tools.",
              "Production AI agents, IVR or campaign infrastructure.",
              "Custom portals or proprietary software.",
              "Compliance-bound industries (finance / healthcare / public).",
            ].map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <ArrowRight className="size-4 text-[var(--orange)] mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/solutions/elite-ecosystem"
              onClick={() => fire("growth_to_elite_link")}
              className="text-[12.5px] text-[var(--orange)] underline-offset-4 hover:underline"
            >
              Explore Elite →
            </Link>
            <Link
              href="/solutions/custom-intelligence-infrastructure"
              onClick={() => fire("growth_to_custom_link")}
              className="text-[12.5px] text-violet-300 underline-offset-4 hover:underline"
            >
              Explore Custom Intelligence →
            </Link>
          </div>
        </div>
      </section>

      {/* Outcomes / timeline */}
      <section className="container py-12 grid md:grid-cols-3 gap-5">
        {[
          { i: Gauge, t: "Operational velocity", b: "Faster decision cycles with a single source of truth." },
          { i: Boxes, t: "System consolidation", b: "Replace fragmented tooling with one coherent stack." },
          { i: Layers, t: "Scalable foundations", b: "An architecture that grows into Elite when you're ready." },
        ].map(({ i: Icon, t, b }, i) => (
          <div
            key={i}
            className="rounded-2xl glass-soft p-6 ring-1 ring-white/8 hover:ring-emerald-400/30 transition-all duration-200"
          >
            <Icon className="size-6 text-emerald-300" />
            <p className="mt-4 text-[14.5px] font-semibold text-white">{t}</p>
            <p className="mt-2 text-[13px] text-white/60 leading-relaxed">{b}</p>
          </div>
        ))}
      </section>

      {/* Closing CTA */}
      <section className="container py-16">
        <div className="rounded-2xl glass-soft p-8 sm:p-10 ring-1 ring-[var(--orange)]/35 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.24em] text-[var(--orange)] font-semibold">
              NEXT STEP
            </p>
            <h3 className="mt-3 text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              Book a discovery call to scope your Growth Ecosystem.
            </h3>
            <p className="mt-3 max-w-xl text-[14px] text-white/65">
              30 minutes, no obligation. We'll map your current state, gaps and the
              fastest path to operational velocity.
            </p>
          </div>
          <Link
            href="/book-strategy?source=growth_footer"
            onClick={() => fire("growth_footer_cta")}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
          >
            <CalendarDays className="size-4" />
            Book Discovery Call
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
