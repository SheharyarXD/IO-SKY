/**
 * IO SKY — AI SCAN (flagship operational intelligence funnel)
 *
 * Design language locked from master spec & mockup:
 *   - deep navy-black atmosphere (#0A0F1A)
 *   - restrained orange interaction language (#F97316 / #FB923C)
 *   - premium glass surfaces, cinematic spacing
 *   - executive typography hierarchy
 *   - progressive disclosure (no overload)
 *
 * Structure (mirrors uploaded mockup):
 *   1. Hero (IO symbol art) + 3 pricing tiers + WHY THIS INVESTMENT PAYS OFF
 *   2. HOW THE AI SCAN WORKS — 6 steps
 *   3. QUESTIONS YOU'LL ANSWER — 3 tier previews with example questions + result previews
 *   4. WHAT YOU RECEIVE — 3 report mockups
 *   5. HOW WE CALCULATE YOUR SCORES + SCORING MODULE + HYBRID ANALYSIS
 *   6. UNLOCK FULL RESULTS form + WHAT HAPPENS NEXT + TRUST & SECURITY
 *   7. Bottom value strip
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { useT } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  TrendingUp,
  Cog,
  Brain,
  Rocket,
  ClipboardList,
  HelpCircle,
  Sparkles,
  FileText,
  CheckCheck,
  ShieldCheck,
  GaugeCircle,
  Activity,
  Layers,
  Network,
  CircuitBoard,
  Users,
  UserCog,
  Compass,
  Calendar,
  Phone,
  Mail,
  User,
  Building2,
} from "lucide-react";

const HERO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-aiscan-hero-7mx4aJFAtGTwYcUbZpUrYE.webp";
const REPORT_FREE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-aiscan-report-free-FJNZinRYBpqm9MrCkeR8xy.webp";
const REPORT_GROWTH = "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-aiscan-report-growth-gFu7LTjsJjDi4HNxLSBYSh.webp";
const REPORT_ELITE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-aiscan-report-elite-jfhB99C8w8kv4JZKjPrmUo.webp";

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────
function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center">
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">{children}</h2>
      {sub ? <p className="mt-3 text-sm md:text-base text-neutral-400 max-w-3xl mx-auto">{sub}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing tier card
// ─────────────────────────────────────────────────────────────────────────────
function TierCard({
  eyebrow,
  eyebrowColor,
  title,
  subtitle,
  setup,
  setupLabel,
  monthly,
  monthlyLabel,
  features,
  cta,
  onCta,
  highlight = false,
}: {
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  subtitle: string;
  setup: string;
  setupLabel: string;
  monthly?: string;
  monthlyLabel?: string;
  features: string[];
  cta: string;
  onCta: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border bg-[#0E1422]/70 p-6 md:p-7 backdrop-blur transition will-change-transform ${
        highlight
          ? "border-orange-500/60 shadow-[0_0_40px_-12px_rgba(249,115,22,0.55)]"
          : "border-white/10 hover:border-orange-400/40 hover:shadow-[0_0_28px_-14px_rgba(249,115,22,0.45)]"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-semibold tracking-widest text-white">
          MOST CHOSEN
        </div>
      )}
      <div className="text-center">
        <div className={`text-xs font-semibold tracking-[0.18em] ${eyebrowColor}`}>{eyebrow}</div>
        <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs text-neutral-400">{subtitle}</p>
      </div>

      <div className="mt-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">{setupLabel}</div>
        <div className="mt-1 text-4xl font-semibold text-white">{setup}</div>
        {monthly && (
          <>
            <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500">{monthlyLabel}</div>
            <div className="mt-1 text-3xl font-semibold text-orange-400">{monthly}</div>
          </>
        )}
      </div>

      <ul className="mt-6 space-y-2.5 text-sm text-neutral-300">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onCta}
        className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
          highlight
            ? "bg-orange-500 text-white hover:bg-orange-400"
            : "border border-white/15 text-white hover:border-orange-400 hover:text-orange-300"
        }`}
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Why-invest card
// ─────────────────────────────────────────────────────────────────────────────
function WhyCard({ icon: Icon, title, body }: { icon: typeof TrendingUp; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-orange-400/30 bg-orange-500/10 text-orange-300">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <p className="mt-0.5 text-xs text-neutral-400 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step pill
// ─────────────────────────────────────────────────────────────────────────────
function StepPill({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: number;
  icon: typeof ClipboardList;
  title: string;
  body: string;
}) {
  return (
    <div className="flex-1 min-w-[160px] rounded-2xl border border-white/10 bg-[#0E1422]/70 p-5 backdrop-blur transition hover:border-orange-400/40">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-orange-400/30 bg-orange-500/10 text-orange-300">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-2xl font-semibold text-orange-300">{n}</div>
      </div>
      <div className="mt-4 text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-xs text-neutral-400 leading-relaxed">{body}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question preview card (per tier)
// ─────────────────────────────────────────────────────────────────────────────
function QuestionPreviewCard({
  eyebrow,
  eyebrowColor,
  title,
  questions,
  whatYoullSee,
  examplePreview,
  step,
  stepColor,
}: {
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  questions: string[];
  whatYoullSee: { items: string[] };
  examplePreview: React.ReactNode;
  step: string;
  stepColor: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0E1422]/70 p-5 md:p-6 backdrop-blur">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className={`text-xs font-semibold tracking-[0.18em] ${eyebrowColor}`}>{eyebrow}</div>
          <div className="text-xs text-neutral-500 mt-0.5">{title}</div>
        </div>
      </div>

      <ol className="mt-4 space-y-2.5 text-sm text-neutral-300">
        {questions.map((q, i) => (
          <li key={q} className="flex gap-2.5">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-orange-400/30 bg-orange-500/10 text-[10px] font-semibold text-orange-300">
              {i + 1}
            </span>
            <span>{q}</span>
          </li>
        ))}
      </ol>

      {/* In-progress question shell */}
      <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
        <div className={`text-[10px] font-semibold tracking-[0.18em] ${stepColor}`}>{step}</div>
        <div className="mt-2 text-sm font-medium text-white leading-snug">{title}</div>
        <div className="mt-3 h-9 rounded-md border border-white/10 bg-black/40 text-[11px] text-neutral-500 px-3 py-2">
          Type your answer here...
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-neutral-500">Back</span>
          <span className={`rounded-md bg-orange-500/20 px-2.5 py-1 text-orange-300 ${stepColor}`}>Next →</span>
        </div>
      </div>

      {/* What you'll see + example preview */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.18em] text-orange-300">WHAT YOU'LL SEE</div>
          <ul className="mt-2 space-y-1.5 text-xs text-neutral-300">
            {whatYoullSee.items.map((i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-orange-400" /> {i}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-[0.18em] text-orange-300">EXAMPLE PREVIEW</div>
          <div className="mt-2">{examplePreview}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report preview tile
// ─────────────────────────────────────────────────────────────────────────────
function ReportTile({
  eyebrow,
  eyebrowColor,
  title,
  pages,
  includes,
  image,
  footer,
}: {
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  pages: string;
  includes: string[];
  image: string;
  footer: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0E1422]/70 p-5 md:p-6 backdrop-blur">
      <div className={`text-xs font-semibold tracking-[0.18em] ${eyebrowColor}`}>{eyebrow}</div>
      <div className="mt-1 text-sm text-neutral-400">{title}</div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{pages}</div>

      <div className="mt-4 aspect-[4/5] w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <img src={image} alt={title} loading="lazy" className="h-full w-full object-cover" />
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-semibold tracking-[0.18em] text-orange-300">INCLUDES</div>
        <ul className="mt-2 space-y-1.5 text-xs text-neutral-300">
          {includes.map((i) => (
            <li key={i} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
              {i}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 text-[11px] text-neutral-500">{footer}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AIScan() {
  const ctx = useT();
  const t = (key: string, fallback: string) => {
    const v = ctx.t(key);
    return v === key ? fallback : v;
  };
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });
  const [, navigate] = useLocation();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"free" | "growth" | "elite">("free");
  const [submitState, setSubmitState] = useState<
    | { kind: "idle" }
    | { kind: "success"; tier: "free" | "growth" | "elite" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const acknowledgeAi = trpc.legal.acknowledgeAi.useMutation();
  const submitLead = trpc.aiScans.submitLead.useMutation({
    onSuccess: (data) => {
      setSubmitState({ kind: "success", tier: data.tier });
      acknowledgeAi.mutate({ context: `ai-scan:${data.tier}` });
      setForm({ name: "", email: "", phone: "", company: "" });
      setAcceptedDisclaimer(false);
    },
    onError: (err) => {
      setSubmitState({
        kind: "error",
        message:
          err.message ||
          t(
            "aiscan.unlock.errorGeneric",
            "Something went wrong submitting your request. Please try again.",
          ),
      });
    },
  });
  const openUnlock = (tier: "free" | "growth" | "elite") => {
    setSelectedTier(tier);
    setSubmitState({ kind: "idle" });
    setUnlockOpen(true);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#070A12] text-[#E6EAF0] pt-20">
      <div className="container max-w-[1280px] py-10 md:py-14 page-enter">
        {/* ─── 1. HERO + PRICING ─────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.05fr_2fr_1fr] gap-6">
          {/* Left: title + sub + bullets + hero art */}
          <div className="rounded-2xl border border-white/10 bg-[#0E1422]/60 p-6 md:p-7 backdrop-blur">
            <div className="text-4xl md:text-5xl font-semibold tracking-tight text-white">AI SCAN</div>
            <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
              {t("aiscan.hero.sub", "Discover what's holding your operations back — and how to unlock unstoppable growth.")}
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                t("aiscan.hero.li1", "AI-Powered Analysis"),
                t("aiscan.hero.li2", "Expert Refinement"),
                t("aiscan.hero.li3", "Actionable Roadmaps"),
                t("aiscan.hero.li4", "Measurable Results"),
              ].map((s) => (
                <li key={s} className="flex items-center gap-2.5 text-neutral-200">
                  <CheckCircle2 className="h-4 w-4 text-orange-400" /> {s}
                </li>
              ))}
            </ul>
            <div className="mt-6 aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <img src={HERO_IMG} alt="IO SKY AI Scan" className="h-full w-full object-cover" />
            </div>
          </div>

          {/* Middle: 3 pricing tiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            <TierCard
              eyebrow={t("aiscan.tier.free.eyebrow", "FREE AI SCAN")}
              eyebrowColor="text-sky-400"
              title={t("aiscan.tier.free.title", "Get instant insights about your operations.")}
              subtitle=""
              setup="€0"
              setupLabel={t("aiscan.tier.free.setupLabel", "ONE-TIME SCAN")}
              features={[
                t("aiscan.tier.free.f1", "Basic operational score"),
                t("aiscan.tier.free.f2", "Top 3 opportunities"),
                t("aiscan.tier.free.f3", "Limited insights preview"),
                t("aiscan.tier.free.f4", "Manual summary (basic)"),
              ]}
              cta={t("aiscan.tier.free.cta", "Start Free Scan")}
              onCta={() => navigate("/ai-scan/start?tier=free")}
            />
            <TierCard
              eyebrow={t("aiscan.tier.growth.eyebrow", "GROWTH AI SCAN")}
              eyebrowColor="text-orange-300"
              title={t("aiscan.tier.growth.title", "Deep operational analysis for growing companies.")}
              subtitle=""
              setup="€1,500"
              setupLabel={t("aiscan.tier.growth.setupLabel", "SETUP (ONE-TIME)")}
              monthly="€350"
              monthlyLabel={t("aiscan.tier.growth.monthlyLabel", "ONGOING INSIGHTS & OPTIMIZATION")}
              features={[
                t("aiscan.tier.growth.f1", "Complete operational analysis"),
                t("aiscan.tier.growth.f2", "Detailed opportunities"),
                t("aiscan.tier.growth.f3", "Growth roadmap preview"),
                t("aiscan.tier.growth.f4", "Ecosystem recommendation"),
                t("aiscan.tier.growth.f5", "Expert refinement"),
                t("aiscan.tier.growth.f6", "Executive PDF report"),
                t("aiscan.tier.growth.f7", "Ongoing monitoring & updates"),
              ]}
              cta={t("aiscan.tier.growth.cta", "Start Growth Scan")}
              onCta={() => navigate("/ai-scan/start?tier=growth")}
              highlight
            />
            <TierCard
              eyebrow={t("aiscan.tier.elite.eyebrow", "ELITE AI SCAN")}
              eyebrowColor="text-fuchsia-300"
              title={t("aiscan.tier.elite.title", "Enterprise-grade analysis for complex organizations.")}
              subtitle=""
              setup="€5,000+"
              setupLabel={t("aiscan.tier.elite.setupLabel", "SETUP (ONE-TIME)")}
              monthly="€1,500"
              monthlyLabel={t("aiscan.tier.elite.monthlyLabel", "ONGOING INSIGHTS & OPTIMIZATION")}
              features={[
                t("aiscan.tier.elite.f1", "Deep operational audit"),
                t("aiscan.tier.elite.f2", "AI opportunity mapping"),
                t("aiscan.tier.elite.f3", "Infrastructure & risk analysis"),
                t("aiscan.tier.elite.f4", "Custom ecosystem architecture"),
                t("aiscan.tier.elite.f5", "Executive roadmap"),
                t("aiscan.tier.elite.f6", "Expert refinement by specialists"),
                t("aiscan.tier.elite.f7", "Premium executive report with appendix"),
                t("aiscan.tier.elite.f8", "Priority support & consultations"),
              ]}
              cta={t("aiscan.tier.elite.cta", "Start Elite Scan")}
              onCta={() => navigate("/ai-scan/start?tier=elite")}
            />
          </div>

          {/* Right: WHY THIS INVESTMENT PAYS OFF */}
          <div className="rounded-2xl border border-white/10 bg-[#0E1422]/60 p-6 md:p-7 backdrop-blur">
            <div className="text-xs font-semibold tracking-[0.18em] text-orange-300">{t("aiscan.why.eyebrow", "WHY THIS INVESTMENT PAYS OFF")}</div>
            <div className="mt-5 space-y-5">
              <WhyCard
                icon={TrendingUp}
                title={t("aiscan.why.1.t", "Increase Operational Efficiency")}
                body={t("aiscan.why.1.b", "Reduce costs by 20–40%")}
              />
              <WhyCard
                icon={Cog}
                title={t("aiscan.why.2.t", "Automate & Scale")}
                body={t("aiscan.why.2.b", "Eliminate manual work and scale without limits")}
              />
              <WhyCard
                icon={Brain}
                title={t("aiscan.why.3.t", "Make Smarter Decisions")}
                body={t("aiscan.why.3.b", "Data-driven insights for better decision making")}
              />
              <WhyCard
                icon={Rocket}
                title={t("aiscan.why.4.t", "Accelerate Growth")}
                body={t("aiscan.why.4.b", "Clear roadmap to sustainable growth and profitability")}
              />
            </div>
          </div>
        </section>

        {/* ─── 2. HOW THE AI SCAN WORKS ──────────────────────────────────── */}
        <section className="mt-10 md:mt-14">
          <SectionTitle>{t("aiscan.flow.title", "HOW THE AI SCAN WORKS")}</SectionTitle>
          <div className="mt-8 flex flex-wrap gap-4">
            {[
              { icon: ClipboardList, title: t("aiscan.flow.1.t", "Choose Your Scan"), body: t("aiscan.flow.1.b", "Select the scan that fits your needs.") },
              { icon: HelpCircle, title: t("aiscan.flow.2.t", "Answer Questions"), body: t("aiscan.flow.2.b", "Answer a series of strategic questions about your operations.") },
              { icon: Sparkles, title: t("aiscan.flow.3.t", "AI Analysis"), body: t("aiscan.flow.3.b", "Our AI analyzes your inputs and systems in real-time.") },
              { icon: UserCog, title: t("aiscan.flow.4.t", "Expert Refinement"), body: t("aiscan.flow.4.b", "Our experts refine the analysis for maximum accuracy.") },
              { icon: FileText, title: t("aiscan.flow.5.t", "Get Your Results"), body: t("aiscan.flow.5.b", "Receive your detailed report and roadmap.") },
              { icon: CheckCheck, title: t("aiscan.flow.6.t", "Take Action"), body: t("aiscan.flow.6.b", "Implement, optimize and achieve measurable growth.") },
            ].map((s, i) => (
              <StepPill key={i} n={i + 1} icon={s.icon} title={s.title} body={s.body} />
            ))}
          </div>
        </section>

        {/* ─── 3. QUESTIONS YOU'LL ANSWER ─────────────────────────────────── */}
        <section className="mt-10 md:mt-14">
          <SectionTitle>{t("aiscan.q.title", "QUESTIONS YOU'LL ANSWER (EXAMPLES PER SCAN)")}</SectionTitle>
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <QuestionPreviewCard
              eyebrow={t("aiscan.q.free.eyebrow", "FREE AI SCAN — 7 QUESTIONS")}
              eyebrowColor="text-sky-400"
              title={t("aiscan.q.free.shortSub", "Quick assessment to give you instant insights.")}
              questions={[
                t("aiscan.q.free.q1", "Company snapshot — name, industry, size"),
                t("aiscan.q.free.q2", "Primary operational goal for the next 12 months"),
                t("aiscan.q.free.q3", "Top friction point slowing the team down"),
                t("aiscan.q.free.q4", "Core systems currently in use"),
              ]}
              whatYoullSee={{
                items: [
                  t("aiscan.q.free.s1", "Operational Score (preview)"),
                  t("aiscan.q.free.s2", "Top 3 Opportunities"),
                  t("aiscan.q.free.s3", "Key Strengths"),
                  t("aiscan.q.free.s4", "Critical Gaps (blurred)"),
                  t("aiscan.q.free.s5", "Recommendations (blurred)"),
                ],
              }}
              examplePreview={
                <div className="rounded-md border border-white/10 bg-black/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">Operational Score (Preview)</div>
                  <div className="mt-1 text-3xl font-semibold text-white">58<span className="text-sm text-neutral-500">/100</span></div>
                  <div className="text-[10px] text-orange-300 mt-0.5">Fair</div>
                  <button
                    type="button"
                    onClick={() => openUnlock("free")}
                    className="mt-2 flex items-center gap-2 text-[10px] text-neutral-400 hover:text-orange-300 transition"
                  >
                    <Lock className="h-3 w-3" /> {t("aiscan.preview.unlockHint", "Unlock full results to see your complete analysis.")}
                  </button>
                </div>
              }
              step={t("aiscan.q.free.step", "PREVIEW · 4 OF 7")}
              stepColor="text-sky-300"
            />
            <QuestionPreviewCard
              eyebrow={t("aiscan.q.growth.eyebrow", "GROWTH AI SCAN — 18 QUESTIONS")}
              eyebrowColor="text-orange-300"
              title={t("aiscan.q.growth.shortSub", "In-depth analysis for growing businesses.")}
              questions={[
                t("aiscan.q.growth.q1", "Where workflows break or slow down"),
                t("aiscan.q.growth.q2", "Reporting & KPI visibility today"),
                t("aiscan.q.growth.q3", "Integrations between core tools"),
                t("aiscan.q.growth.q4", "Capacity to scale current operations"),
                t("aiscan.q.growth.q5", "Expected ROI from optimization"),
              ]}
              whatYoullSee={{
                items: [
                  t("aiscan.q.growth.s1", "Full operational score"),
                  t("aiscan.q.growth.s2", "5 key opportunities"),
                  t("aiscan.q.growth.s3", "Efficiency estimates"),
                  t("aiscan.q.growth.s4", "Risk indicators"),
                  t("aiscan.q.growth.s5", "Ecosystem recommendation"),
                  t("aiscan.q.growth.s6", "Roadmap preview"),
                ],
              }}
              examplePreview={
                <div className="rounded-md border border-white/10 bg-black/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">Operational Maturity Score</div>
                  <div className="mt-1 text-3xl font-semibold text-white">72<span className="text-sm text-neutral-500">/100</span></div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">Good</div>
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-orange-300">Recommended Ecosystem</div>
                  <div className="text-[11px] font-semibold text-white">GROWTH ECOSYSTEM</div>
                  <div className="text-[10px] text-orange-300">View details →</div>
                </div>
              }
              step={t("aiscan.q.growth.step", "PREVIEW · 5 OF 18")}
              stepColor="text-orange-300"
            />
            <QuestionPreviewCard
              eyebrow={t("aiscan.q.elite.eyebrow", "ELITE AI SCAN — 30+ QUESTIONS")}
              eyebrowColor="text-fuchsia-300"
              title={t("aiscan.q.elite.shortSub", "Comprehensive audit for complex organizations.")}
              questions={[
                t("aiscan.q.elite.q1", "Governance, risk & compliance posture"),
                t("aiscan.q.elite.q2", "Architecture maturity & resilience"),
                t("aiscan.q.elite.q3", "Capacity planning across business units"),
                t("aiscan.q.elite.q4", "Transformation readiness & change capacity"),
                t("aiscan.q.elite.q5", "Strategic objectives over 24 months"),
              ]}
              whatYoullSee={{
                items: [
                  t("aiscan.q.elite.s1", "Enterprise operational score"),
                  t("aiscan.q.elite.s2", "Detailed risk map"),
                  t("aiscan.q.elite.s3", "AI opportunity map"),
                  t("aiscan.q.elite.s4", "Infrastructure assessment"),
                  t("aiscan.q.elite.s5", "Executive summary"),
                  t("aiscan.q.elite.s6", "Strategic roadmap"),
                  t("aiscan.q.elite.s7", "Ecosystem architecture"),
                ],
              }}
              examplePreview={
                <div className="rounded-md border border-white/10 bg-black/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">Enterprise Score</div>
                  <div className="mt-1 text-3xl font-semibold text-white">86<span className="text-sm text-neutral-500">/100</span></div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">Excellent</div>
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-orange-300">Recommended Ecosystem</div>
                  <div className="text-[11px] font-semibold text-white">ELITE ECOSYSTEM</div>
                  <div className="text-[10px] text-orange-300">View details →</div>
                </div>
              }
              step={t("aiscan.q.elite.step", "PREVIEW · 5 OF 30+")}
              stepColor="text-fuchsia-300"
            />
          </div>
        </section>

        {/* ─── 4. WHAT YOU RECEIVE — 3 reports ────────────────────────────── */}
        <section className="mt-10 md:mt-14">
          <SectionTitle>{t("aiscan.reports.title", "WHAT YOU RECEIVE")}</SectionTitle>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            <ReportTile
              eyebrow={t("aiscan.report.free.eyebrow", "FREE AI SCAN REPORT")}
              eyebrowColor="text-sky-400"
              title={t("aiscan.report.free.sub", "Executive PDF preview")}
              pages={t("aiscan.report.free.pages", "Basic operational insights")}
              includes={[
                t("aiscan.report.free.i1", "Operational score"),
                t("aiscan.report.free.i2", "Top 3 opportunities"),
                t("aiscan.report.free.i3", "Key strengths"),
                t("aiscan.report.free.i4", "Basic recommendations"),
              ]}
              image={REPORT_FREE}
              footer={t("aiscan.report.free.footer", "Unlock full report — see your complete analysis and roadmap.")}
            />
            <ReportTile
              eyebrow={t("aiscan.report.growth.eyebrow", "GROWTH AI SCAN REPORT")}
              eyebrowColor="text-orange-300"
              title={t("aiscan.report.growth.sub", "Executive PDF sample")}
              pages={t("aiscan.report.growth.pages", "Professional, detailed, actionable")}
              includes={[
                t("aiscan.report.growth.i1", "Executive summary"),
                t("aiscan.report.growth.i2", "Detailed analysis"),
                t("aiscan.report.growth.i3", "Opportunities (Top 5)"),
                t("aiscan.report.growth.i4", "Roadmap preview"),
                t("aiscan.report.growth.i5", "ROI estimates"),
                t("aiscan.report.growth.i6", "Recommendations"),
                t("aiscan.report.growth.i7", "Next steps"),
              ]}
              image={REPORT_GROWTH}
              footer={t("aiscan.report.growth.footer", "Operational intelligence for sustainable growth.")}
            />
            <ReportTile
              eyebrow={t("aiscan.report.elite.eyebrow", "ELITE AI SCAN REPORT")}
              eyebrowColor="text-fuchsia-300"
              title={t("aiscan.report.elite.sub", "Premium executive PDF sample")}
              pages={t("aiscan.report.elite.pages", "Executive-level, comprehensive, transformation-focused")}
              includes={[
                t("aiscan.report.elite.i1", "Executive summary"),
                t("aiscan.report.elite.i2", "Deep operational audit"),
                t("aiscan.report.elite.i3", "Infrastructure analysis"),
                t("aiscan.report.elite.i4", "Risk assessment"),
                t("aiscan.report.elite.i5", "AI opportunity mapping"),
                t("aiscan.report.elite.i6", "Custom ecosystem architecture"),
                t("aiscan.report.elite.i7", "ROI & business case"),
              ]}
              image={REPORT_ELITE}
              footer={t("aiscan.report.elite.footer", "Strategic operational transformation blueprint.")}
            />
          </div>
        </section>

        {/* ─── 5. HOW WE CALCULATE YOUR SCORES + SCORING + HYBRID ─────────── */}
        <section className="mt-10 md:mt-14">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* HOW WE CALCULATE */}
            <div className="rounded-2xl border border-white/10 bg-[#0E1422]/70 p-6 backdrop-blur">
              <div className="text-xs font-semibold tracking-[0.18em] text-orange-300">{t("aiscan.scores.eyebrow", "HOW WE CALCULATE YOUR SCORES")}</div>
              <ul className="mt-5 space-y-4">
                {[
                  { icon: GaugeCircle, t: t("aiscan.score.1.t", "Operational Efficiency Score"), b: t("aiscan.score.1.b", "Measures how efficiently your operations run."), w: "25%" },
                  { icon: Cog, t: t("aiscan.score.2.t", "Automation Score"), b: t("aiscan.score.2.b", "Evaluates the level of automation and system integration."), w: "25%" },
                  { icon: Layers, t: t("aiscan.score.3.t", "Scalability Score"), b: t("aiscan.score.3.b", "Analyzes your ability to scale without operational friction."), w: "20%" },
                  { icon: Network, t: t("aiscan.score.4.t", "Infrastructure Score"), b: t("aiscan.score.4.b", "Assesses the strength and connectivity of your systems."), w: "20%" },
                  { icon: Sparkles, t: t("aiscan.score.5.t", "AI Opportunity Score"), b: t("aiscan.score.5.b", "Identifies the potential for AI to drive impact."), w: "10%" },
                ].map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-orange-400/30 bg-orange-500/10 text-orange-300">
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">{s.t}</div>
                        <div className="text-xs font-semibold text-orange-300">{s.w}</div>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{s.b}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* SCORING CALCULATION MODULE */}
            <div className="rounded-2xl border border-white/10 bg-[#0E1422]/70 p-6 backdrop-blur">
              <div className="text-xs font-semibold tracking-[0.18em] text-orange-300">{t("aiscan.module.eyebrow", "THE SCORING CALCULATION MODULE (EXAMPLE)")}</div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-[11px]">
                {[
                  { s: t("aiscan.module.step1.t", "Step 1: Question Scoring"), b: t("aiscan.module.step1.b", "Each answer is scored based on impact.") },
                  { s: t("aiscan.module.step2.t", "Step 2: Category Score"), b: t("aiscan.module.step2.b", "Average of all related questions.") },
                  { s: t("aiscan.module.step3.t", "Step 3: Weighted Score"), b: t("aiscan.module.step3.b", "Applied to overall operational score.") },
                ].map((s, i) => (
                  <div key={i} className="rounded-md border border-white/10 bg-black/30 p-3">
                    <div className="text-[10px] font-semibold text-orange-300">{s.s}</div>
                    <p className="mt-1.5 text-neutral-400 leading-relaxed">{s.b}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">Automation Score</div>
                  <div className="mt-1 text-2xl font-semibold text-white">78<span className="text-xs text-neutral-500">/100</span></div>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">Overall Operational Score</div>
                  <div className="mt-1 text-2xl font-semibold text-white">72<span className="text-xs text-neutral-500">/100</span></div>
                  <div className="text-[10px] text-emerald-400">Good</div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-neutral-500">
                {t("aiscan.module.footer", "100+ data points · AI analysis · Expert validation = Accurate, actionable insights")}
              </p>
            </div>

            {/* HYBRID ANALYSIS */}
            <div className="rounded-2xl border border-white/10 bg-[#0E1422]/70 p-6 backdrop-blur">
              <div className="text-xs font-semibold tracking-[0.18em] text-orange-300">{t("aiscan.hybrid.eyebrow", "HYBRID ANALYSIS PROCESS (ELITE SCAN)")}</div>
              <ol className="mt-5 space-y-3 text-sm">
                {[
                  { n: 1, t: t("aiscan.hybrid.1.t", "AI Analysis"), b: t("aiscan.hybrid.1.b", "AI analyzes all inputs and systems.") },
                  { n: 2, t: t("aiscan.hybrid.2.t", "Expert Review"), b: t("aiscan.hybrid.2.b", "Our experts refine and validate the analysis.") },
                  { n: 3, t: t("aiscan.hybrid.3.t", "Strategic Refinement"), b: t("aiscan.hybrid.3.b", "We add strategic insights and industry expertise.") },
                  { n: 4, t: t("aiscan.hybrid.4.t", "Final Report"), b: t("aiscan.hybrid.4.b", "Premium report delivered to you.") },
                ].map((s) => (
                  <li key={s.n} className="flex gap-3 rounded-md border border-white/10 bg-black/30 p-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-orange-400/30 bg-orange-500/10 text-[11px] font-semibold text-orange-300">{s.n}</div>
                    <div>
                      <div className="text-sm font-semibold text-white">{s.t}</div>
                      <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{s.b}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-md border border-orange-400/30 bg-orange-500/5 p-3">
                <div className="text-[10px] font-semibold tracking-widest text-orange-300">{t("aiscan.hybrid.why.eyebrow", "WHY HYBRID IS BEST")}</div>
                <p className="mt-1 text-xs text-neutral-300 leading-relaxed">
                  {t("aiscan.hybrid.why.b", "Combines the speed of AI with the insight of human experts. More accurate. More strategic. More valuable.")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 6. WHAT HAPPENS NEXT + TRUST (unlock form moved to modal) ─── */}
        <section id="unlock" className="mt-10 md:mt-14 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Hidden form lives inside <Dialog> further down */}
          <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
            <DialogContent className="max-w-md border border-white/10 bg-[#0E1422]/95 text-white backdrop-blur">
              <DialogHeader>
                <DialogTitle className="text-xs font-semibold tracking-[0.18em] text-orange-300">
                  {selectedTier === "free"
                    ? t("aiscan.unlock.eyebrow.free", "UNLOCK FREE AI SCAN")
                    : selectedTier === "growth"
                    ? t("aiscan.unlock.eyebrow.growth", "REQUEST GROWTH AI SCAN")
                    : t("aiscan.unlock.eyebrow.elite", "REQUEST ELITE AI SCAN")}
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-400">
                  {selectedTier === "free"
                    ? t("aiscan.unlock.sub.free", "To see your complete free analysis and roadmap, please provide your details.")
                    : t("aiscan.unlock.sub.paid", "Tell us a bit about you and our team will reach out to plan the scan engagement.")}
                </DialogDescription>
              </DialogHeader>
              {submitState.kind === "success" ? (
                <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  <div className="font-semibold mb-1">
                    {t("aiscan.unlock.success.title", "Thank you — request received.")}
                  </div>
                  <p className="text-emerald-200/80 text-xs leading-relaxed">
                    {submitState.tier === "free"
                      ? t("aiscan.unlock.success.free", "We'll email you the free AI Scan preview shortly. No payment required.")
                      : t("aiscan.unlock.success.paid", "Our team will contact you within one business day to plan the engagement. This does not auto-book a discovery call.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setUnlockOpen(false)}
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
                  >
                    {t("aiscan.unlock.success.close", "Close")}
                  </button>
                </div>
              ) : (
            <form className="mt-2 space-y-3" onSubmit={(e) => {
              e.preventDefault();
              if (!acceptedDisclaimer || submitLead.isPending) return;
              setSubmitState({ kind: "idle" });
              submitLead.mutate({
                tier: selectedTier,
                fullName: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim() || null,
                company: form.company.trim(),
                acceptedAiDisclaimer: true,
              });
            }}>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500">{t("aiscan.unlock.name", "Full Name")}</span>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-2">
                  <User className="h-3.5 w-3.5 text-neutral-500" />
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t("aiscan.unlock.namePh", "Enter your name")}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500">{t("aiscan.unlock.email", "Work Email")}</span>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-2">
                  <Mail className="h-3.5 w-3.5 text-neutral-500" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t("aiscan.unlock.emailPh", "Enter your email")}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500">{t("aiscan.unlock.phone", "Phone Number")}</span>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-2">
                  <Phone className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-xs text-neutral-500">+31</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={t("aiscan.unlock.phonePh", "Enter your phone number")}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500">{t("aiscan.unlock.company", "Company")}</span>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-2">
                  <Building2 className="h-3.5 w-3.5 text-neutral-500" />
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder={t("aiscan.unlock.companyPh", "Company name")}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
                  />
                </div>
              </label>
              <label className="flex items-start gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={acceptedDisclaimer}
                  onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-orange-500"
                />
                <span className="text-[11px] leading-[1.55] text-neutral-400">
                  {t(
                    "aiscan.unlock.disclaimerLeader",
                    "I understand this is an AI-assisted assessment with inherent limitations and accept the",
                  )}{" "}
                  <Link href="/ai-disclaimer" className="text-orange-400 hover:underline">
                    {t("aiscan.unlock.aiDisclaimer", "AI Disclaimer")}
                  </Link>{" "}
                  &amp;{" "}
                  <Link href="/privacy" className="text-orange-400 hover:underline">
                    {t("aiscan.unlock.privacyNotice", "Privacy Notice")}
                  </Link>
                  .
                </span>
              </label>
              {submitState.kind === "error" ? (
                <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  {submitState.message}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={!acceptedDisclaimer || submitLead.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock className="h-4 w-4" />
                {submitLead.isPending
                  ? t("aiscan.unlock.submitting", "Submitting…")
                  : selectedTier === "free"
                  ? t("aiscan.unlock.cta.free", "Unlock My Free Results")
                  : t("aiscan.unlock.cta.paid", "Request This AI Scan")}
              </button>
              <p className="text-[10px] text-neutral-500 leading-relaxed">
                {t("aiscan.unlock.privacy", "We respect your privacy. Your data is secure and will only be used to deliver your results and follow up.")}
              </p>
            </form>
              )}
            </DialogContent>
          </Dialog>

          {/* What happens next */}
          <div className="rounded-2xl border border-white/10 bg-[#0E1422]/70 p-6 backdrop-blur">
            <div className="text-xs font-semibold tracking-[0.18em] text-orange-300">{t("aiscan.next.eyebrow", "WHAT HAPPENS NEXT")}</div>
            <ol className="mt-5 space-y-3">
              {[
                { n: 1, icon: Lock, t: t("aiscan.next.1.t", "Instant Access"), b: t("aiscan.next.1.b", "Get immediate access to your full report and roadmap.") },
                { n: 2, icon: Users, t: t("aiscan.next.2.t", "Expert Consultation"), b: t("aiscan.next.2.b", "We'll contact you to walk through your results.") },
                { n: 3, icon: Compass, t: t("aiscan.next.3.t", "Custom Strategy"), b: t("aiscan.next.3.b", "Receive a personalized strategy and ecosystem recommendation.") },
                { n: 4, icon: Rocket, t: t("aiscan.next.4.t", "Implementation Support"), b: t("aiscan.next.4.b", "We help you execute and scale.") },
              ].map((s) => (
                <li key={s.n} className="flex gap-3 rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-orange-400/30 bg-orange-500/10 text-[11px] font-semibold text-orange-300">
                    {s.n}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{s.t}</div>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{s.b}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Dashboard preview */}
            <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">{t("aiscan.next.dash", "Your AI Scan Dashboard")}</div>
              <div className="mt-1 text-xs text-white">Welcome back, <span className="font-semibold">John</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                <div className="rounded-md border border-white/10 p-2">
                  <div className="text-neutral-500">Operational Score</div>
                  <div className="text-base font-semibold text-white">72<span className="text-[9px] text-neutral-500">/100</span></div>
                </div>
                <div className="rounded-md border border-white/10 p-2">
                  <div className="text-neutral-500">Top Opportunities</div>
                  <div className="text-base font-semibold text-white">5</div>
                </div>
                <div className="rounded-md border border-white/10 p-2">
                  <div className="text-neutral-500">Potential Impact</div>
                  <div className="text-base font-semibold text-orange-300">€120K+</div>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-neutral-400">{t("aiscan.next.roadmap", "Your Roadmap")}: Phase 1 (0–30 days) → Phase 2 (30–60 days) → Phase 3 (60–90 days)</div>
              <div className="mt-3 flex items-center gap-2">
                <button className="rounded-md border border-white/15 px-2.5 py-1 text-[10px] text-white hover:border-orange-400 hover:text-orange-300">
                  {t("aiscan.next.download", "Download Full Report")}
                </button>
                <button className="rounded-md bg-orange-500 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-orange-400">
                  <Calendar className="mr-1 inline h-3 w-3" />
                  {t("aiscan.next.book", "Book Discovery Call")}
                </button>
              </div>
            </div>
          </div>

          {/* Trust & Security */}
          <div className="rounded-2xl border border-white/10 bg-[#0E1422]/70 p-6 backdrop-blur">
            <div className="text-xs font-semibold tracking-[0.18em] text-orange-300">{t("aiscan.trust.eyebrow", "TRUST & SECURITY")}</div>
            <p className="mt-3 text-xs text-neutral-400">{t("aiscan.trust.sub", "Your data is safe with us.")}</p>
            <ul className="mt-5 space-y-3">
              {[
                { icon: ShieldCheck, t: t("aiscan.trust.1", "Enterprise-grade security") },
                { icon: CircuitBoard, t: t("aiscan.trust.2", "GDPR compliant") },
                { icon: Activity, t: t("aiscan.trust.3", "Data encrypted in transit & at rest") },
                { icon: Lock, t: t("aiscan.trust.4", "No data sharing or selling") },
                { icon: CheckCheck, t: t("aiscan.trust.5", "Used only to deliver your results") },
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-3 rounded-md border border-white/10 bg-black/30 p-3">
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                  <div className="text-xs text-neutral-200">{s.t}</div>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid place-items-center rounded-xl border border-white/10 bg-black/40 py-6">
              <div className="grid h-16 w-16 place-items-center rounded-xl border border-orange-400/30 bg-orange-500/10 text-orange-300">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-widest text-neutral-500">{t("aiscan.trust.iso", "ISO-aligned · Enterprise-grade")}</div>
            </div>
          </div>
        </section>

        {/* ─── 7. Bottom value strip ─────────────────────────────────────── */}
        <section className="mt-10 md:mt-14 rounded-2xl border border-white/10 bg-[#0E1422]/60 p-6 backdrop-blur">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[
              { icon: Sparkles, t: t("aiscan.strip.1.t", "AI-Powered"), b: t("aiscan.strip.1.b", "Advanced models analyze your operations in real-time.") },
              { icon: UserCog, t: t("aiscan.strip.2.t", "Expert Refined"), b: t("aiscan.strip.2.b", "Human experts refine insights for maximum accuracy.") },
              { icon: Compass, t: t("aiscan.strip.3.t", "Actionable Insights"), b: t("aiscan.strip.3.b", "Clear recommendations you can implement immediately.") },
              { icon: TrendingUp, t: t("aiscan.strip.4.t", "Measurable Results"), b: t("aiscan.strip.4.b", "Track performance and see the impact on real business outcomes.") },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-orange-400/30 bg-orange-500/10 text-orange-300">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{s.t}</div>
                  <p className="mt-0.5 text-xs text-neutral-400 leading-relaxed">{s.b}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
      <Footer />
    </>
  );
}
