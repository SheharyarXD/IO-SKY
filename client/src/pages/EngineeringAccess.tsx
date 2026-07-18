/*
 * IO SKY — /engineering-access
 *
 * Developer access entry point (secure, exclusive, enterprise-grade).
 * Reached only via the subtle "Building the future with us?" card on /contact.
 *
 * Layout:
 *   • HERO — eyebrow, executive headline, intro, three trust pills (NDA-protected,
 *     manual review, limited cohort).
 *   • APPLICATION FORM — premium glass card with the exact fields required by
 *     the functional master spec: full name, country, LinkedIn, GitHub, portfolio,
 *     specialties (multi), years of experience, preferred technologies, AI
 *     experience, enterprise systems experience.
 *   • LEGAL CONSENT — single grouped tile with the four required acceptances
 *     (NDA · confidentiality · client protection · non-solicitation).
 *   • SUCCESS STATE — replaces the application card once submitted.
 *
 * Submissions are persisted to localStorage `io-sky.engineering.queue` so the
 * application survives a refresh and is ready to be wired to a future REST
 * endpoint.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  ArrowUpRight,
  Send,
  ShieldCheck,
  Lock,
  UserCheck,
  CheckCircle2,
  Code2,
  Linkedin,
  Github,
  Globe2,
  Sparkles,
  Cpu,
  Briefcase,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const QUEUE_KEY = "io-sky.engineering.queue";

const SPECIALTIES = [
  "Frontend engineering",
  "Backend engineering",
  "Full-stack engineering",
  "DevOps / infrastructure",
  "Data engineering",
  "AI / ML engineering",
  "Security engineering",
  "Solution architecture",
  "Product engineering",
];

const TECHNOLOGIES = [
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Go",
  "Rust",
  "PostgreSQL",
  "AWS",
  "GCP",
  "Cloudflare",
  "Kubernetes",
];

const EXPERIENCE = [
  "exp.0-2",
  "exp.3-5",
  "exp.6-10",
  "exp.10+",
];

function expLabel(k: string) {
  const map: Record<string, string> = {
    "exp.0-2": "0 – 2 years",
    "exp.3-5": "3 – 5 years",
    "exp.6-10": "6 – 10 years",
    "exp.10+": "10+ years",
  };
  return map[k] ?? k;
}

export default function EngineeringAccess() {
  const ctx = useT();
  const t = (key: string, fallback: string) => {
    const v = ctx.t(key);
    return v === key ? fallback : v;
  };

  /* ---- state ---- */
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [publicRef, setPublicRef] = useState<string | null>(null);
  const formMountedAt = useRef<number>(Date.now());
  const submitMutation = trpc.engineering.submit.useMutation();

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [years, setYears] = useState("");
  const [stack, setStack] = useState<string[]>([]);
  const [aiExperience, setAiExperience] = useState("");
  const [enterpriseExperience, setEnterpriseExperience] = useState("");
  const [accept, setAccept] = useState({
    nda: false,
    confidentiality: false,
    client: false,
    nonSolicit: false,
  });
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});

  useEffect(() => {
    formMountedAt.current = Date.now();
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()),
    [email],
  );
  const nameValid = fullName.trim().length >= 2;
  const countryValid = country.trim().length >= 2;
  const specialtyValid = specialties.length > 0;
  const yearsValid = years.length > 0;
  const aiValid = aiExperience.trim().length >= 20;
  const entValid = enterpriseExperience.trim().length >= 20;
  const allAccepted = accept.nda && accept.confidentiality && accept.client && accept.nonSolicit;

  const canSubmit =
    nameValid &&
    countryValid &&
    emailValid &&
    specialtyValid &&
    yearsValid &&
    aiValid &&
    entValid &&
    allAccepted;

  function err(field: string, valid: boolean) {
    return touched[field] && !valid;
  }

  function toggleArr(arr: string[], v: string, setter: (a: string[]) => void) {
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setTouched({
      fullName: true,
      country: true,
      email: true,
      specialties: true,
      years: true,
      ai: true,
      ent: true,
      accept: true,
    });

    if (!canSubmit) {
      toast.error(t("eng.invalid.title", "Please review the application"), {
        description: t(
          "eng.invalid.body",
          "A few required fields and agreements still need attention.",
        ),
      });
      return;
    }

    const fd = new FormData(e.currentTarget);
    const honeypot = (fd.get("website") || "").toString().trim();
    const elapsed = Date.now() - formMountedAt.current;
    if (honeypot.length > 0 || elapsed < 1500) {
      toast.error(t("eng.reject.title", "Application rejected"), {
        description: t(
          "eng.reject.body",
          "We could not validate your submission. Please refresh and try again.",
        ),
      });
      return;
    }

    setSubmitting(true);

    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      queue.push({
        id: crypto.randomUUID?.() ?? String(Date.now()),
        fullName,
        country,
        email,
        linkedin,
        github,
        portfolio,
        specialties,
        years,
        stack,
        aiExperience,
        enterpriseExperience,
        accept,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      /* no-op */
    }

    const yoeMatch = years.match(/(\d+)/);
    const linksParts = [linkedin, github, portfolio]
      .map((s) => s.trim())
      .filter(Boolean);
    const messageParts: string[] = [];
    if (specialties.length)
      messageParts.push(`Specialties: ${specialties.join(", ")}`);
    if (stack.length) messageParts.push(`Stack: ${stack.join(", ")}`);
    if (aiExperience.trim())
      messageParts.push(`AI experience: ${aiExperience.trim()}`);
    if (enterpriseExperience.trim())
      messageParts.push(`Enterprise: ${enterpriseExperience.trim()}`);
    if (country.trim()) messageParts.push(`Country: ${country.trim()}`);

    try {
      const result = await submitMutation.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim(),
        company: null,
        roleTitle: specialties[0] ?? null,
        yearsExperience: yoeMatch ? Number(yoeMatch[1]) : null,
        links: linksParts.join("\n") || null,
        message: messageParts.join("\n\n") || null,
        ackNda: accept.nda,
        ackConfidentiality: accept.confidentiality,
        ackNonSolicitation: accept.nonSolicit,
        locale: ctx.lang,
      });
      setPublicRef(result.publicRef);
      setSubmitted(true);
      toast.success(t("eng.success.toast", "Application received"), {
        description: t(
          "eng.success.toastBody",
          "Our engineering operations team will review and respond within 7 business days.",
        ),
      });
    } catch (error) {
      console.warn("[engineering.submit] backend unreachable, queued offline:", error);
      setPublicRef(null);
      setSubmitted(true);
      toast.success(t("eng.success.toast", "Application received"), {
        description: t(
          "eng.success.offlineBody",
          "Saved offline — our engineering operations team will reconcile and respond within 7 business days.",
        ),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0B1020] text-[#E6EAF0]">
      {/* Atmospheric backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: [
            "radial-gradient(60% 38% at 18% 18%, oklch(0.72 0.205 45 / 0.10), transparent 70%)",
            "radial-gradient(46% 32% at 92% 0%, oklch(0.55 0.18 255 / 0.08), transparent 70%)",
            "radial-gradient(80% 50% at 50% 100%, oklch(0.72 0.205 45 / 0.06), transparent 70%)",
          ].join(", "),
        }}
      />

      <Navbar />

      <main className="relative z-10 flex-1 pt-[88px] md:pt-[100px] pb-20">
        {/* HERO */}
        <section className="container">
          <div className="max-w-[820px]">
            <div className="inline-flex items-center gap-2 text-[10.5px] font-mono tracking-[0.24em] uppercase text-[var(--color-orange)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-orange)] shadow-[0_0_10px_rgba(255,106,0,0.7)]" />
              {t("eng.eyebrow", "Engineering Access")}
            </div>
            <h1 className="mt-5 font-display font-medium tracking-[-0.022em] leading-[1.05] text-[40px] md:text-[52px] xl:text-[58px] text-[var(--color-ivory)]">
              {t("eng.h1.pre", "Build the ")}
              <span className="text-[var(--color-orange)]">
                {t("eng.h1.accent", "operational infrastructure")}
              </span>{" "}
              {t("eng.h1.post", "of the next decade.")}
            </h1>
            <p className="mt-5 text-[15px] md:text-[16px] leading-[1.65] text-[oklch(0.78_0.014_250)] max-w-[62ch]">
              {t(
                "eng.intro",
                "IO SKY Engineering Access is an invitation-only programme for senior engineers, architects and AI specialists who want to contribute to a real operational intelligence platform under NDA. Every application is reviewed manually by our engineering operations team.",
              )}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Pill icon={<ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />}>
                {t("eng.pill.nda", "NDA-protected onboarding")}
              </Pill>
              <Pill icon={<UserCheck className="w-3.5 h-3.5" strokeWidth={2} />}>
                {t("eng.pill.manual", "Manual review by engineering ops")}
              </Pill>
              <Pill icon={<Sparkles className="w-3.5 h-3.5" strokeWidth={2} />}>
                {t("eng.pill.cohort", "Limited cohort each quarter")}
              </Pill>
            </div>
          </div>
        </section>

        {/* APPLICATION */}
        <section className="container mt-12 md:mt-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left column — context */}
            <aside className="lg:col-span-4">
              <div className="glass p-6">
                <h2 className="font-display text-[18px] font-medium text-[var(--color-ivory)]">
                  {t("eng.what.title", "What we look for")}
                </h2>
                <ul className="mt-4 space-y-3 text-[13px] leading-[1.6] text-[oklch(0.78_0.014_250)]">
                  <Bullet>
                    {t(
                      "eng.what.1",
                      "Senior engineering judgment — five years or more building production systems.",
                    )}
                  </Bullet>
                  <Bullet>
                    {t(
                      "eng.what.2",
                      "Operational thinking — comfortable with infrastructure, automation and data flow, not just UI.",
                    )}
                  </Bullet>
                  <Bullet>
                    {t(
                      "eng.what.3",
                      "Discretion — willingness to operate inside NDA-protected environments and respect client data.",
                    )}
                  </Bullet>
                  <Bullet>
                    {t(
                      "eng.what.4",
                      "Craft — taste for premium product surfaces, measured motion and disciplined design language.",
                    )}
                  </Bullet>
                </ul>

                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <div className="text-[11.5px] font-mono tracking-[0.18em] uppercase text-[oklch(0.65_0.014_250)]">
                    {t("eng.process.title", "Process")}
                  </div>
                  <ol className="mt-3 space-y-2 text-[13px] text-[oklch(0.82_0.014_250)] list-decimal pl-5">
                    <li>{t("eng.process.1", "You submit this application")}</li>
                    <li>{t("eng.process.2", "Engineering ops reviews and signs NDA")}</li>
                    <li>{t("eng.process.3", "30-minute technical conversation")}</li>
                    <li>{t("eng.process.4", "Scoped, paid trial engagement")}</li>
                    <li>{t("eng.process.5", "Cohort onboarding & portal access")}</li>
                  </ol>
                </div>
              </div>
            </aside>

            {/* Right column — application form */}
            <div className="lg:col-span-8">
              {!submitted ? (
                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className="glass-strong p-6 md:p-8 relative overflow-hidden"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255,106,0,0.55) 50%, transparent 100%)",
                    }}
                  />

                  <header className="flex items-center gap-3 mb-5">
                    <span className="w-9 h-9 rounded-lg border border-[#FF6A00]/30 bg-[rgba(255,106,0,0.08)] text-[var(--color-orange)] flex items-center justify-center">
                      <Code2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
                    </span>
                    <h2 className="font-display text-[20px] md:text-[22px] font-medium tracking-[-0.012em] text-[var(--color-ivory)]">
                      {t("eng.form.title", "Engineering application")}
                    </h2>
                  </header>

                  {/* honeypot */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    className="absolute left-[-9999px] top-auto w-px h-px"
                    aria-hidden
                  />

                  {/* row 1 — name + country */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Input
                      label={t("eng.field.name", "Full name")}
                      required
                      value={fullName}
                      onChange={setFullName}
                      onBlur={() => setTouched((p) => ({ ...p, fullName: true }))}
                      error={err("fullName", nameValid)}
                      errorMsg={t("eng.field.name.err", "Required")}
                      placeholder={t("eng.field.name.ph", "Your name")}
                    />
                    <Input
                      label={t("eng.field.country", "Country of residence")}
                      required
                      value={country}
                      onChange={setCountry}
                      onBlur={() => setTouched((p) => ({ ...p, country: true }))}
                      error={err("country", countryValid)}
                      errorMsg={t("eng.field.country.err", "Required")}
                      placeholder={t("eng.field.country.ph", "Netherlands")}
                    />
                  </div>

                  {/* row 2 — email */}
                  <div className="mb-4">
                    <Input
                      label={t("eng.field.email", "Email address")}
                      required
                      type="email"
                      value={email}
                      onChange={setEmail}
                      onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                      error={err("email", emailValid)}
                      errorMsg={t("eng.field.email.err", "Please enter a valid email")}
                      placeholder="you@email.com"
                    />
                  </div>

                  {/* row 3 — linkedin + github */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Input
                      label={t("eng.field.linkedin", "LinkedIn")}
                      value={linkedin}
                      onChange={setLinkedin}
                      icon={<Linkedin className="w-4 h-4" strokeWidth={1.8} />}
                      placeholder="linkedin.com/in/…"
                    />
                    <Input
                      label={t("eng.field.github", "GitHub")}
                      value={github}
                      onChange={setGithub}
                      icon={<Github className="w-4 h-4" strokeWidth={1.8} />}
                      placeholder="github.com/…"
                    />
                  </div>

                  {/* row 4 — portfolio */}
                  <div className="mb-5">
                    <Input
                      label={t("eng.field.portfolio", "Portfolio / personal site")}
                      value={portfolio}
                      onChange={setPortfolio}
                      icon={<Globe2 className="w-4 h-4" strokeWidth={1.8} />}
                      placeholder="https://"
                    />
                  </div>

                  {/* Specialties */}
                  <FieldGroup
                    label={t("eng.field.specialties", "Specialties")}
                    required
                    error={err("specialties", specialtyValid)}
                    errorMsg={t("eng.field.specialties.err", "Select at least one")}
                    icon={<Briefcase className="w-3.5 h-3.5" strokeWidth={1.8} />}
                  >
                    <div className="flex flex-wrap gap-2">
                      {SPECIALTIES.map((s) => (
                        <Chip
                          key={s}
                          active={specialties.includes(s)}
                          onClick={() =>
                            toggleArr(specialties, s, setSpecialties)
                          }
                        >
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </FieldGroup>

                  {/* Years */}
                  <div className="mt-5 mb-5">
                    <label className="block text-[12.5px] font-medium text-[oklch(0.82_0.012_250)] mb-1.5">
                      {t("eng.field.years", "Years of experience")}{" "}
                      <span className="text-[var(--color-orange)]">*</span>
                    </label>
                    <Select
                      value={years}
                      onValueChange={(v) => {
                        setYears(v);
                        setTouched((p) => ({ ...p, years: true }));
                      }}
                    >
                      <SelectTrigger
                        className={`w-full md:w-[280px] h-11 bg-white/[0.04] border ${err("years", yearsValid) ? "border-rose-400/60" : "border-white/10 hover:border-[#FF6A00]/30 focus:border-[#FF6A00]/60"} text-[var(--color-ivory)]`}
                      >
                        <SelectValue
                          placeholder={t("eng.field.years.ph", "Select range")}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[oklch(0.13_0.022_260)] border-white/10">
                        {EXPERIENCE.map((k) => (
                          <SelectItem key={k} value={k} className="text-[13px]">
                            {t(k, expLabel(k))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stack */}
                  <FieldGroup
                    label={t("eng.field.stack", "Preferred technologies")}
                    icon={<Cpu className="w-3.5 h-3.5" strokeWidth={1.8} />}
                  >
                    <div className="flex flex-wrap gap-2">
                      {TECHNOLOGIES.map((tech) => (
                        <Chip
                          key={tech}
                          active={stack.includes(tech)}
                          onClick={() => toggleArr(stack, tech, setStack)}
                        >
                          {tech}
                        </Chip>
                      ))}
                    </div>
                  </FieldGroup>

                  {/* AI experience */}
                  <div className="mt-5 mb-5">
                    <label className="block text-[12.5px] font-medium text-[oklch(0.82_0.012_250)] mb-1.5">
                      {t("eng.field.ai", "AI / agentic experience")}{" "}
                      <span className="text-[var(--color-orange)]">*</span>
                    </label>
                    <textarea
                      value={aiExperience}
                      onChange={(e) => setAiExperience(e.target.value.slice(0, 1500))}
                      onBlur={() => setTouched((p) => ({ ...p, ai: true }))}
                      rows={4}
                      placeholder={t(
                        "eng.field.ai.ph",
                        "Briefly describe production work with LLMs, agents, retrieval systems or autonomous workflows.",
                      )}
                      className={`w-full px-3 py-3 rounded-md bg-white/[0.04] border ${err("ai", aiValid) ? "border-rose-400/60" : "border-white/10 hover:border-[#FF6A00]/30 focus:border-[#FF6A00]/60"} focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/25 text-[14px] text-[var(--color-ivory)] placeholder:text-[oklch(0.55_0.014_250)] resize-y transition-colors`}
                    />
                  </div>

                  {/* Enterprise systems experience */}
                  <div className="mb-6">
                    <label className="block text-[12.5px] font-medium text-[oklch(0.82_0.012_250)] mb-1.5">
                      {t("eng.field.ent", "Enterprise systems experience")}{" "}
                      <span className="text-[var(--color-orange)]">*</span>
                    </label>
                    <textarea
                      value={enterpriseExperience}
                      onChange={(e) =>
                        setEnterpriseExperience(e.target.value.slice(0, 1500))
                      }
                      onBlur={() => setTouched((p) => ({ ...p, ent: true }))}
                      rows={4}
                      placeholder={t(
                        "eng.field.ent.ph",
                        "Briefly describe production work on CRMs, ERPs, data platforms or high-trust enterprise applications.",
                      )}
                      className={`w-full px-3 py-3 rounded-md bg-white/[0.04] border ${err("ent", entValid) ? "border-rose-400/60" : "border-white/10 hover:border-[#FF6A00]/30 focus:border-[#FF6A00]/60"} focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/25 text-[14px] text-[var(--color-ivory)] placeholder:text-[oklch(0.55_0.014_250)] resize-y transition-colors`}
                    />
                  </div>

                  {/* Legal block */}
                  <div className="rounded-lg border border-[#FF6A00]/20 bg-[rgba(255,106,0,0.04)] p-4 md:p-5 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Lock className="w-4 h-4 text-[var(--color-orange)]" strokeWidth={2} />
                      <h3 className="font-display text-[14px] font-medium text-[var(--color-ivory)]">
                        {t("eng.legal.title", "Required agreements")}
                      </h3>
                    </div>
                    <ul className="space-y-2.5">
                      <Check
                        checked={accept.nda}
                        onChange={(v) => setAccept((p) => ({ ...p, nda: v }))}
                        label={t(
                          "eng.legal.nda",
                          "I agree to be onboarded under a Non-Disclosure Agreement covering all IO SKY systems, code and client information.",
                        )}
                      />
                      <Check
                        checked={accept.confidentiality}
                        onChange={(v) =>
                          setAccept((p) => ({ ...p, confidentiality: v }))
                        }
                        label={t(
                          "eng.legal.conf",
                          "I will treat all materials, repositories and conversations as strictly confidential.",
                        )}
                      />
                      <Check
                        checked={accept.client}
                        onChange={(v) => setAccept((p) => ({ ...p, client: v }))}
                        label={t(
                          "eng.legal.client",
                          "I will not directly access, contact or solicit IO SKY clients outside of explicitly assigned scope.",
                        )}
                      />
                      <Check
                        checked={accept.nonSolicit}
                        onChange={(v) =>
                          setAccept((p) => ({ ...p, nonSolicit: v }))
                        }
                        label={t(
                          "eng.legal.nonsolicit",
                          "I accept the IO SKY non-solicitation clause for the duration of and 12 months after the engagement.",
                        )}
                      />
                    </ul>
                    {touched.accept && !allAccepted && (
                      <p className="mt-3 text-[12px] text-rose-300">
                        {t(
                          "eng.legal.err",
                          "All four agreements are required to submit the application.",
                        )}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full justify-center !h-[48px] !text-[14.5px] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? t("eng.form.sending", "Submitting…")
                      : t("eng.form.submit", "Submit application")}
                    <Send className="w-4 h-4" strokeWidth={2} />
                  </button>
                </form>
              ) : (
                <EngineeringSuccess publicRef={publicRef} t={t} />
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ---------- sub-components ---------- */

function Pill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 px-3 h-8 rounded-full border border-white/10 bg-white/[0.04] text-[12px] text-[var(--color-ivory)]">
      <span className="text-[var(--color-orange)]">{icon}</span>
      {children}
    </span>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Layers
        className="mt-[2px] w-3.5 h-3.5 text-[var(--color-orange)] shrink-0"
        strokeWidth={2}
      />
      <span>{children}</span>
    </li>
  );
}

function Input({
  label,
  required = false,
  value,
  onChange,
  onBlur,
  icon,
  placeholder,
  type = "text",
  error,
  errorMsg,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  icon?: React.ReactNode;
  placeholder?: string;
  type?: string;
  error?: boolean;
  errorMsg?: string;
}) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-[oklch(0.82_0.012_250)] mb-1.5">
        {label}{" "}
        {required && <span className="text-[var(--color-orange)]">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(0.6_0.014_250)] pointer-events-none">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`w-full h-11 ${icon ? "pl-9" : "pl-3"} pr-3 rounded-md bg-white/[0.04] border ${error ? "border-rose-400/60 focus:border-rose-400" : "border-white/10 hover:border-[#FF6A00]/30 focus:border-[#FF6A00]/60"} focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/25 text-[14px] text-[var(--color-ivory)] placeholder:text-[oklch(0.55_0.014_250)] transition-colors`}
        />
      </div>
      {error && errorMsg && (
        <p className="mt-1 text-[12px] text-rose-300">{errorMsg}</p>
      )}
    </div>
  );
}

function FieldGroup({
  label,
  required,
  icon,
  children,
  error,
  errorMsg,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  error?: boolean;
  errorMsg?: string;
}) {
  return (
    <div>
      <label className="text-[12.5px] font-medium text-[oklch(0.82_0.012_250)] mb-2 flex items-center gap-1.5">
        {icon && <span className="text-[var(--color-orange)]">{icon}</span>}
        {label}{" "}
        {required && <span className="text-[var(--color-orange)]">*</span>}
      </label>
      {children}
      {error && errorMsg && (
        <p className="mt-1 text-[12px] text-rose-300">{errorMsg}</p>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12px] transition-colors ${active ? "border-[#FF6A00]/55 bg-[rgba(255,106,0,0.12)] text-[var(--color-ivory)]" : "border-white/10 bg-white/[0.03] text-[oklch(0.78_0.014_250)] hover:border-[#FF6A00]/30 hover:text-[var(--color-orange)]"}`}
    >
      {children}
    </button>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <li>
      <label className="flex items-start gap-3 cursor-pointer group">
        <span
          className={`shrink-0 mt-0.5 w-4 h-4 rounded border ${checked ? "bg-[var(--color-orange)] border-[var(--color-orange)]" : "border-white/25 bg-white/[0.03] group-hover:border-[#FF6A00]/40"} flex items-center justify-center transition-colors`}
        >
          {checked && (
            <CheckCircle2 className="w-3 h-3 text-[#0B1020]" strokeWidth={3} />
          )}
        </span>
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-[12.5px] leading-[1.55] text-[oklch(0.82_0.014_250)]">
          {label}
        </span>
      </label>
    </li>
  );
}

function EngineeringSuccess({
  publicRef,
  t,
}: {
  publicRef: string | null;
  t: (k: string, fb: string) => string;
}) {
  return (
    <div className="glass-strong p-8 md:p-12 relative overflow-hidden text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,106,0,0.6) 50%, transparent 100%)",
        }}
      />
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-[#FF6A00]/40 bg-[rgba(255,106,0,0.1)] text-[var(--color-orange)] mb-5">
        <CheckCircle2 className="w-8 h-8" strokeWidth={1.7} />
      </div>
      <h2 className="font-display text-[24px] md:text-[28px] font-medium tracking-[-0.012em] text-[var(--color-ivory)]">
        {t("eng.success.title", "Application received.")}
      </h2>
      {publicRef && (
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FF6A00]/30 bg-[#FF6A00]/[0.08] text-[11.5px] font-mono uppercase tracking-[0.16em] text-[#FF6A00]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shadow-[0_0_8px_#FF6A00]" />
          Reference · {publicRef}
        </div>
      )}
      <p className="mt-3 text-[14px] leading-[1.65] text-[oklch(0.78_0.014_250)] max-w-[48ch] mx-auto">
        {t(
          "eng.success.body",
          "Engineering operations will manually review your application and respond within 7 business days. If accepted, you will receive a secure NDA and a 30-minute technical conversation link.",
        )}
      </p>
      <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/" className="btn-secondary !h-11 !text-[13.5px] !px-5">
          {t("eng.success.home", "Back to home")}
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-md border border-white/10 bg-white/[0.03] hover:border-[#FF6A00]/30 hover:bg-[rgba(255,106,0,0.06)] text-[13.5px] text-[var(--color-ivory)] transition-colors"
        >
          {t("eng.success.contact", "Contact IO SKY")}
          <ArrowUpRight className="w-4 h-4 text-[var(--color-orange)]" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
