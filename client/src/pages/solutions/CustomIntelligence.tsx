/**
 * Custom Intelligence Infrastructure deep-dive + multi-step Custom Discovery
 * flow (Package 7). Persists every step via `solutions.saveDiscoveryStep`
 * and submits the final session to convert into a CRM lead + admin notification.
 */
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Layers,
  Cpu,
  ShieldCheck,
  Cloud,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { i: Step; label: string }[] = [
  { i: 1, label: "About you" },
  { i: 2, label: "What you need" },
  { i: 3, label: "Current systems" },
  { i: 4, label: "Timeline" },
  { i: 5, label: "Review & submit" },
];

const NEEDS = [
  "Custom software",
  "Mobile application",
  "Private AI system",
  "Internal dashboard / portal",
  "Custom CRM or ERP",
  "AI agents",
  "IVR / voice systems",
  "Enterprise integrations",
  "Custom reporting / analytics",
  "Security / cloud architecture",
] as const;

const TEAM_SIZES = ["1–10", "11–50", "51–200", "201–1000", "1000+"] as const;
const GROWTH_STAGES = ["Early stage", "Scale-up", "Mid-market", "Enterprise"] as const;
const TIMELINES = ["< 1 month", "1–3 months", "3–6 months", "6+ months"] as const;
const URGENCIES = ["Exploring", "Planning", "Active project", "Critical"] as const;

export default function CustomIntelligence() {
  const recordClick = trpc.solutions.recordClick.useMutation();
  const startSession = trpc.solutions.startDiscovery.useMutation();
  const saveStep = trpc.solutions.saveDiscoveryStep.useMutation();
  const submitDiscovery = trpc.solutions.submitDiscovery.useMutation();

  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    company: "",
    phone: "",
    needsTypes: [] as string[],
    currentSystems: "",
    teamSize: "" as (typeof TEAM_SIZES)[number] | "",
    growthStage: "" as (typeof GROWTH_STAGES)[number] | "",
    integrations: "",
    timeline: "" as (typeof TIMELINES)[number] | "",
    urgency: "" as (typeof URGENCIES)[number] | "",
    preferredNext: "" as "ai-scan" | "strategy-call" | "proposal" | "",
  });

  // bootstrap session
  useEffect(() => {
    recordClick.mutate({
      eventKey: "custom_page_view",
      source: "solutions/custom",
      ecosystem: "custom",
    });
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("io-sky-custom-discovery")
      : null;
    startSession.mutate(
      { token: stored ?? null },
      {
        onSuccess: ({ token }) => {
          setToken(token);
          if (typeof window !== "undefined") {
            localStorage.setItem("io-sky-custom-discovery", token);
          }
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autosave whenever step boundaries pass
  const persist = (next: Partial<typeof form>) => {
    if (!token) return;
    const merged = { ...form, ...next };
    setForm(merged);
    saveStep.mutate({
      token,
      patch: {
        fullName: merged.fullName || undefined,
        email: merged.email || undefined,
        company: merged.company || undefined,
        phone: merged.phone || undefined,
        needsTypes: merged.needsTypes.join(", ") || undefined,
        currentSystems: merged.currentSystems || undefined,
        teamSize: merged.teamSize || undefined,
        growthStage: merged.growthStage || undefined,
        integrations: merged.integrations || undefined,
        timeline: merged.timeline || undefined,
        urgency: merged.urgency || undefined,
        preferredNext: (merged.preferredNext || undefined) as
          | "ai-scan"
          | "strategy-call"
          | "proposal"
          | undefined,
      },
    });
  };

  const goNext = () => setStep((s) => Math.min(5, (s + 1) as Step) as Step);
  const goPrev = () => setStep((s) => Math.max(1, (s - 1) as Step) as Step);

  const submit = async () => {
    if (!token) return;
    try {
      setSubmitting(true);
      // ensure final form state is saved first
      await new Promise<void>((res) =>
        saveStep.mutate(
          {
            token,
            patch: {
              fullName: form.fullName,
              email: form.email,
              company: form.company || undefined,
              phone: form.phone || undefined,
              needsTypes: form.needsTypes.join(", ") || undefined,
              currentSystems: form.currentSystems || undefined,
              teamSize: form.teamSize || undefined,
              growthStage: form.growthStage || undefined,
              integrations: form.integrations || undefined,
              timeline: form.timeline || undefined,
              urgency: form.urgency || undefined,
              preferredNext: (form.preferredNext || undefined) as
                | "ai-scan"
                | "strategy-call"
                | "proposal"
                | undefined,
            },
          },
          { onSettled: () => res() },
        ),
      );
      const r = await submitDiscovery.mutateAsync({ token });
      if (r.ok) {
        setSubmitted(true);
        toast.success("Custom Discovery submitted");
        if (typeof window !== "undefined") {
          localStorage.removeItem("io-sky-custom-discovery");
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Submission failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const stepValid = useMemo(() => {
    if (step === 1) return form.fullName.trim().length > 1 && /@/.test(form.email);
    if (step === 2) return form.needsTypes.length > 0;
    if (step === 3) return Boolean(form.teamSize) && Boolean(form.growthStage);
    if (step === 4) return Boolean(form.timeline) && Boolean(form.urgency);
    return true;
  }, [step, form]);

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <Navbar />

      <div className="container pt-24 pb-2">
        <Link
          href="/solutions"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-[var(--orange)] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Solutions
        </Link>
      </div>

      {/* Hero */}
      <section className="container pt-6 pb-12 grid lg:grid-cols-[1.2fr,1fr] gap-12 items-start">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.24em] text-violet-300 font-semibold">
            CUSTOM INTELLIGENCE INFRASTRUCTURE
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.07]">
            Proprietary systems engineered around{" "}
            <span className="text-violet-300">your exact operating model.</span>
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed text-white/68 max-w-2xl">
            Custom software, mobile applications, private AI systems, IVR, internal
            portals, dashboards, integrations — designed and built by IO SKY for
            companies that need infrastructure not products.
          </p>
        </div>

        <aside className="rounded-2xl glass-soft p-7 ring-1 ring-violet-400/15">
          <p className="text-[11px] uppercase tracking-[0.20em] text-white/45">
            Investment
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">Custom scoped</p>
          <p className="mt-2 text-[13.5px] text-white/60">Custom retainer / build</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-[12.5px] text-white/72">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                Discovery
              </p>
              <p className="mt-1 font-medium">1–2 weeks</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                Best for
              </p>
              <p className="mt-1 font-medium">Bespoke product needs</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                AI systems
              </p>
              <p className="mt-1 font-medium">Private / proprietary</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                Cloud
              </p>
              <p className="mt-1 font-medium">EU / Global</p>
            </div>
          </div>
        </aside>
      </section>

      {/* Capability cards */}
      <section className="container py-8 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { i: Cpu, t: "Custom software", b: "Bespoke products, internal tools, mobile apps." },
          { i: Layers, t: "Private AI systems", b: "On-domain AI agents, RAG, internal copilots." },
          { i: Cloud, t: "Cloud architecture", b: "Multi-region, scalable, EU-data residency." },
          { i: ShieldCheck, t: "Security & compliance", b: "audit-ready controls, audit logs, MFA, SSO." },
        ].map(({ i: Icon, t, b }, i) => (
          <div
            key={i}
            className="rounded-2xl glass-soft p-6 ring-1 ring-white/8 hover:ring-violet-400/35 transition-all duration-200"
          >
            <Icon className="size-6 text-violet-300" />
            <p className="mt-4 text-[14.5px] font-semibold text-white">{t}</p>
            <p className="mt-2 text-[13px] text-white/60 leading-relaxed">{b}</p>
          </div>
        ))}
      </section>

      {/* Custom Discovery multi-step */}
      <section id="custom-discovery" className="container py-16">
        <p className="text-[10.5px] uppercase tracking-[0.24em] text-[var(--orange)] font-semibold">
          CUSTOM DISCOVERY
        </p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
          A guided intake — not a contact form.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/65">
          Five short steps. We use the intake to scope a private proposal — no
          generic email blasts, no sales pressure. Your progress autosaves.
        </p>

        {!submitted ? (
          <div className="mt-10 rounded-2xl glass-soft p-7 sm:p-10 ring-1 ring-white/8">
            {/* Progress */}
            <ol className="flex flex-wrap gap-2 text-[11.5px] uppercase tracking-[0.16em] text-white/55">
              {STEPS.map((s) => (
                <li
                  key={s.i}
                  className={[
                    "px-3 py-1 rounded-full border",
                    step === s.i
                      ? "border-[var(--orange)]/55 bg-[var(--orange)]/15 text-[var(--orange)]"
                      : step > s.i
                      ? "border-emerald-400/30 text-emerald-300"
                      : "border-white/10",
                  ].join(" ")}
                >
                  <span className="mr-2 font-semibold">{s.i}</span>
                  {s.label}
                </li>
              ))}
            </ol>

            <div className="mt-8 space-y-6">
              {step === 1 && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field
                    label="Full name *"
                    value={form.fullName}
                    onChange={(v) => persist({ fullName: v })}
                  />
                  <Field
                    label="Work email *"
                    type="email"
                    value={form.email}
                    onChange={(v) => persist({ email: v })}
                  />
                  <Field
                    label="Company"
                    value={form.company}
                    onChange={(v) => persist({ company: v })}
                  />
                  <Field
                    label="Phone"
                    value={form.phone}
                    onChange={(v) => persist({ phone: v })}
                  />
                </div>
              )}

              {step === 2 && (
                <div>
                  <p className="text-[12.5px] text-white/55 mb-3">
                    Pick all that apply. You can refine later.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {NEEDS.map((n) => {
                      const active = form.needsTypes.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? form.needsTypes.filter((x) => x !== n)
                              : [...form.needsTypes, n];
                            persist({ needsTypes: next });
                          }}
                          className={[
                            "px-3 py-1.5 rounded-full border text-[12.5px] transition-all duration-150",
                            active
                              ? "border-[var(--orange)]/55 bg-[var(--orange)]/15 text-[var(--orange)]"
                              : "border-white/12 text-white/75 hover:border-[var(--orange)]/30 hover:text-[var(--orange)]",
                          ].join(" ")}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <RadioGroup
                    label="Team size"
                    options={TEAM_SIZES as readonly string[]}
                    value={form.teamSize}
                    onChange={(v) => persist({ teamSize: v as (typeof TEAM_SIZES)[number] })}
                  />
                  <RadioGroup
                    label="Growth stage"
                    options={GROWTH_STAGES as readonly string[]}
                    value={form.growthStage}
                    onChange={(v) =>
                      persist({ growthStage: v as (typeof GROWTH_STAGES)[number] })
                    }
                  />
                  <Field
                    label="Current integrations / systems (optional)"
                    value={form.integrations}
                    onChange={(v) => persist({ integrations: v })}
                    multiline
                  />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <RadioGroup
                    label="Timeline"
                    options={TIMELINES as readonly string[]}
                    value={form.timeline}
                    onChange={(v) => persist({ timeline: v as (typeof TIMELINES)[number] })}
                  />
                  <RadioGroup
                    label="Urgency"
                    options={URGENCIES as readonly string[]}
                    value={form.urgency}
                    onChange={(v) => persist({ urgency: v as (typeof URGENCIES)[number] })}
                  />
                  <Field
                    label="What's the current pain (optional)"
                    value={form.currentSystems}
                    onChange={(v) => persist({ currentSystems: v })}
                    multiline
                  />
                </div>
              )}

              {step === 5 && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 text-[13.5px] text-white/75 space-y-1.5">
                    <p>
                      <span className="text-white/55">Name:</span> {form.fullName || "—"}
                    </p>
                    <p>
                      <span className="text-white/55">Email:</span> {form.email || "—"}
                    </p>
                    <p>
                      <span className="text-white/55">Company:</span> {form.company || "—"}
                    </p>
                    <p>
                      <span className="text-white/55">Needs:</span>{" "}
                      {form.needsTypes.join(", ") || "—"}
                    </p>
                    <p>
                      <span className="text-white/55">Team / stage:</span>{" "}
                      {form.teamSize || "—"} · {form.growthStage || "—"}
                    </p>
                    <p>
                      <span className="text-white/55">Timeline / urgency:</span>{" "}
                      {form.timeline || "—"} · {form.urgency || "—"}
                    </p>
                  </div>
                  <RadioGroup
                    label="Preferred next step"
                    options={[
                      "ai-scan",
                      "strategy-call",
                      "proposal",
                    ]}
                    value={form.preferredNext}
                    onChange={(v) =>
                      persist({
                        preferredNext: v as "ai-scan" | "strategy-call" | "proposal",
                      })
                    }
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={goPrev}
                disabled={step === 1 || submitting}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/12 text-white/72 text-[13px] disabled:opacity-40 hover:border-white/30 transition-colors"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              {step < 5 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!stepValid}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold disabled:opacity-40 hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !form.fullName || !form.email}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold disabled:opacity-40 hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Submit Discovery
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl glass-soft p-10 ring-1 ring-emerald-400/30 text-center">
            <CheckCircle2 className="size-9 mx-auto text-emerald-300" />
            <h3 className="mt-4 text-2xl font-semibold">Discovery received.</h3>
            <p className="mt-3 max-w-xl mx-auto text-[14px] text-white/65">
              An IO SKY operational architect will review your intake and reach
              out with next steps — typically within one business day.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/book-strategy?source=custom_discovery"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13px] font-semibold hover:bg-[var(--orange-hover)] transition-colors"
              >
                <CalendarDays className="size-4" />
                Book Discovery Call
              </Link>
              <Link
                href="/solutions"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/12 text-white/85 text-[13px] hover:border-[var(--orange)]/45 hover:text-[var(--orange)] transition-colors"
              >
                Back to Solutions
              </Link>
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small UI primitives                                                  */
/* ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  const cls =
    "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-white/35 outline-none transition-colors focus:border-[var(--orange)]/55";
  return (
    <label className="block">
      <span className="block text-[12px] uppercase tracking-[0.18em] text-white/55 mb-2">
        {label}
      </span>
      {multiline ? (
        <textarea
          rows={3}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.18em] text-white/55 mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={[
                "px-3 py-1.5 rounded-full border text-[12.5px] transition-all duration-150",
                active
                  ? "border-[var(--orange)]/55 bg-[var(--orange)]/15 text-[var(--orange)]"
                  : "border-white/12 text-white/75 hover:border-[var(--orange)]/30 hover:text-[var(--orange)]",
              ].join(" ")}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
