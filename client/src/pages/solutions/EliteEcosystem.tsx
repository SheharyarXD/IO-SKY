/**
 * Elite Ecosystem deep-dive page (Package 7).
 * Premium tier — focuses on AI agents, portals, integrations and
 * enterprise infrastructure.
 */
import { Link } from "wouter";
import { useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Cpu,
  Layers,
  ShieldCheck,
  Cloud,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";

export default function EliteEcosystem() {
  const recordClick = trpc.solutions.recordClick.useMutation();

  useEffect(() => {
    recordClick.mutate({
      eventKey: "elite_page_view",
      source: "solutions/elite",
      ecosystem: "elite",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fire = (key: string) =>
    recordClick.mutate({
      eventKey: key,
      source: "solutions/elite",
      ecosystem: "elite",
    });

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <Navbar />

      <div className="container pt-24 pb-2">
        <Link
          href="/solutions"
          onClick={() => fire("elite_breadcrumb_back")}
          className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-[var(--orange)] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Solutions
        </Link>
      </div>

      {/* Hero */}
      <section className="container pt-6 pb-16 grid lg:grid-cols-[1.2fr,1fr] gap-12 items-start">
        <div>
          <p className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[var(--orange)]/15 text-[10.5px] uppercase tracking-[0.22em] text-[var(--orange)] font-semibold">
            ELITE ECOSYSTEM · MOST CHOSEN
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.07]">
            High-control operational intelligence for{" "}
            <span className="text-[var(--orange)]">advanced operations.</span>
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed text-white/68 max-w-2xl">
            Advanced automation, AI agents, portals, integrations, security
            monitoring, cloud and executive visibility — engineered into one
            cohesive operational fabric.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book-strategy?source=elite"
              onClick={() => fire("elite_book_strategy")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
            >
              <CalendarDays className="size-4" />
              Book Discovery Call
            </Link>
            <Link
              href="/solutions/proposal-request?ecosystem=elite"
              onClick={() => fire("elite_request_proposal")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/12 text-white/85 text-[13.5px] font-medium hover:border-[var(--orange)]/55 hover:text-[var(--orange)] transition-colors"
            >
              Request Proposal
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ai-scan?source=elite"
              onClick={() => fire("elite_ai_scan")}
              className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-[var(--orange)] underline-offset-4 hover:underline"
            >
              <Sparkles className="size-4" />
              Run AI Scan first
            </Link>
          </div>
        </div>

        <aside className="rounded-2xl glass-soft p-7 ring-2 ring-[var(--orange)]/55 shadow-[0_24px_72px_-26px_rgba(255, 122, 0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.20em] text-white/45">
            Investment
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            From EUR 40,000<span className="text-white/45 text-lg"> setup</span>
          </p>
          <p className="mt-2 text-[13.5px] text-white/60">From EUR 8,000 / month</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-[12.5px] text-white/72">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                Onboarding
              </p>
              <p className="mt-1 font-medium">8–14 weeks</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                Best for
              </p>
              <p className="mt-1 font-medium">40–500 employees</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                AI agents
              </p>
              <p className="mt-1 font-medium">Production</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                SLA
              </p>
              <p className="mt-1 font-medium">99.9% uptime</p>
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
          The full Elite Ecosystem capability set.
        </h2>
        <div className="mt-10 grid md:grid-cols-2 gap-4">
          {[
            ["Advanced AI workflows", "Production-grade AI agents embedded in core operations."],
            ["Custom dashboards & portals", "Stakeholder portals with role-based access and audit."],
            ["Enterprise integrations", "Salesforce, HubSpot, ERP, finance, voice, comms — connected."],
            ["Cloud & backup architecture", "Multi-region failover, daily backups, blue/green deploys."],
            ["Security monitoring", "security-first practices controls, audit logs and alerting."],
            ["IVR / campaign / communication", "Voice systems, multi-channel campaigns and reporting."],
            ["Ongoing optimization & support", "Dedicated operator with monthly system reviews."],
            ["Executive briefings", "Quarterly strategic reviews and roadmap planning."],
          ].map(([t, b], i) => (
            <div
              key={i}
              className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-[var(--orange)]/35 transition-colors"
            >
              <CheckCircle2 className="size-5 shrink-0 text-[var(--orange)] mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold text-white">{t}</p>
                <p className="mt-1 text-[13px] text-white/60 leading-relaxed">{b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Strategic capabilities */}
      <section className="container py-12 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { i: Cpu, t: "AI Agents", b: "Conversational + workflow agents in production." },
          { i: Layers, t: "Custom Portals", b: "Built-to-spec portals for clients, partners and teams." },
          { i: Cloud, t: "Cloud-native", b: "Multi-region failover, high-availability targets, full backup posture." },
          { i: ShieldCheck, t: "Security baseline", b: "MFA, SSO, audit logs, device trust on every surface." },
        ].map(({ i: Icon, t, b }, i) => (
          <div
            key={i}
            className="rounded-2xl glass-soft p-6 ring-1 ring-white/8 hover:ring-[var(--orange)]/40 transition-all duration-200"
          >
            <Icon className="size-6 text-[var(--orange)]" />
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
              Book a discovery call to scope your Elite Ecosystem.
            </h3>
            <p className="mt-3 max-w-xl text-[14px] text-white/65">
              We'll map your operational maturity, integrations and security
              requirements — and deliver a tailored Elite proposal.
            </p>
          </div>
          <Link
            href="/book-strategy?source=elite_footer"
            onClick={() => fire("elite_footer_cta")}
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
