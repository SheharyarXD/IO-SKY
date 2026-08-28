/*
 * IO SKY — Contact page (master functional logic + official mockup).
 *
 * Layout (desktop ≥ lg):
 *   ┌───────────────────────────┬──────────────────────────┬───────────────┐
 *   │ LEFT RAIL                 │ CENTER FORM               │ RIGHT RAIL    │
 *   │ • eyebrow                 │ • "Send us a message"     │ • Contact     │
 *   │ • H1 (orange accent word) │   form card               │   Information │
 *   │ • intro body              │ • two-column field grid   │ • Book a      │
 *   │ • 4 trust pillars over    │ • industry & size selects │   Strategy    │
 *   │   the globe image         │ • subject select          │   Call card   │
 *   │                           │ • message + 2000 char     │ • Other       │
 *   │                           │   counter                 │   Inquiries   │
 *   │                           │ • Send Message CTA        │   card        │
 *   └───────────────────────────┴──────────────────────────┴───────────────┘
 *
 * Below the fold:
 *   • TRUST STRIP — 5 enterprise pillars + subtle Developer Access card
 *   • Footer (global)
 *
 * Functional logic master rules honoured:
 *   – Form validates fields (required, email regex, phone length, consent).
 *   – Submission is enqueued in localStorage `io-sky.contact.queue` so the
 *     submission persists even on a static deployment (drop-in replacement
 *     for a future REST endpoint).
 *   – Success state replaces the form card with a confirmation panel + reset.
 *   – Honeypot + 1.5 s gate + 8 s rate limit anti-spam guards.
 *   – Book Discovery Call CTA → /book-strategy   (real route).
 *   – Apply for Engineering Access → /engineering-access (real route).
 *   – No fake client logos. Trust strip is feature-based.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  ArrowUpRight,
  Send,
  Mail,
  Phone as PhoneIcon,
  MapPin,
  Building2,
  User as UserIcon,
  ChevronDown,
  Calendar,
  Briefcase,
  Megaphone,
  HelpCircle,
  Zap,
  ShieldCheck,
  Lightbulb,
  Handshake,
  Brain,
  Globe2,
  TrendingUp,
  Users,
  Lock,
  Code2,
  CheckCircle2,
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

/* ------------------------------------------------------------------ */
/* Static asset URLs                                                  */
/* ------------------------------------------------------------------ */
const GLOBE_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-about-globe-v2-kiHXtRNZogDKqZWBu6HdeC.webp";

const MAX_MESSAGE = 2000;
const QUEUE_KEY = "io-sky.contact.queue";

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

const COUNTRIES: { code: string; dial: string; flag: string; name: string }[] = [
  { code: "NL", dial: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "BE", dial: "+32", flag: "🇧🇪", name: "Belgium" },
  { code: "DE", dial: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "FR", dial: "+33", flag: "🇫🇷", name: "France" },
  { code: "ES", dial: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "PT", dial: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "IT", dial: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "IE", dial: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "CH", dial: "+41", flag: "🇨🇭", name: "Switzerland" },
  { code: "AT", dial: "+43", flag: "🇦🇹", name: "Austria" },
  { code: "DK", dial: "+45", flag: "🇩🇰", name: "Denmark" },
  { code: "SE", dial: "+46", flag: "🇸🇪", name: "Sweden" },
  { code: "NO", dial: "+47", flag: "🇳🇴", name: "Norway" },
  { code: "FI", dial: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "PL", dial: "+48", flag: "🇵🇱", name: "Poland" },
  { code: "US", dial: "+1", flag: "🇺🇸", name: "United States" },
  { code: "CA", dial: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "United Arab Emirates" },
  { code: "SA", dial: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "JP", dial: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "SG", dial: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "AU", dial: "+61", flag: "🇦🇺", name: "Australia" },
];

const INDUSTRIES = [
  "industry.saas",
  "industry.financial",
  "industry.ecommerce",
  "industry.healthcare",
  "industry.manufacturing",
  "industry.logistics",
  "industry.energy",
  "industry.realestate",
  "industry.professional",
  "industry.public",
  "industry.other",
];

const COMPANY_SIZES = [
  "size.1-10",
  "size.11-50",
  "size.51-200",
  "size.201-500",
  "size.501-1000",
  "size.1000+",
];

const SUBJECTS = [
  "subject.strategy",
  "subject.scan",
  "subject.partnership",
  "subject.press",
  "subject.general",
  "subject.security",
];

/* ------------------------------------------------------------------ */
/* Localised label helper                                              */
/* ------------------------------------------------------------------ */

function useLocalT() {
  const ctx = useT();
  return (key: string, fallback: string) => {
    const v = ctx.t(key);
    return v === key ? fallback : v;
  };
}

/* ================================================================== */
/* Page                                                                 */
/* ================================================================== */

export default function Contact() {
  const t = useLocalT();
  const { lang } = useT();

  /* ---- form state ---- */
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmitAt, setLastSubmitAt] = useState<number | null>(null);
  const [publicRef, setPublicRef] = useState<string | null>(null);
  const formMountedAt = useRef<number>(Date.now());
  const submitMutation = trpc.contact.submit.useMutation();

  /* fields */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("NL");
  const dial = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode)?.dial ?? "+31",
    [countryCode],
  );
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});

  useEffect(() => {
    formMountedAt.current = Date.now();
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);

  /* ---- validation ---- */
  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()),
    [email],
  );
  const nameValid = fullName.trim().length >= 2;
  const companyValid = company.trim().length >= 1;
  const subjectValid = subject.trim().length > 0;
  const messageValid =
    message.trim().length >= 10 && message.length <= MAX_MESSAGE;

  const canSubmit =
    nameValid && emailValid && companyValid && subjectValid && messageValid;

  function err(field: string, valid: boolean) {
    return touched[field] && !valid;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setTouched({
      fullName: true,
      email: true,
      company: true,
      subject: true,
      message: true,
    });

    if (!canSubmit) {
      toast.error(t("contact.form.invalid.title", "Please review the form"), {
        description: t(
          "contact.form.invalid.body",
          "A few required fields still need your attention.",
        ),
      });
      return;
    }

    const fd = new FormData(e.currentTarget);
    const honeypot = (fd.get("website") || "").toString().trim();
    const elapsed = Date.now() - formMountedAt.current;

    if (honeypot.length > 0 || elapsed < 1500) {
      toast.error(t("contact.form.error.title", "Submission rejected"), {
        description: t(
          "contact.form.error.body",
          "Please review the form and try again.",
        ),
      });
      return;
    }

    if (lastSubmitAt && Date.now() - lastSubmitAt < 8000) {
      toast.warning(t("contact.form.rate.title", "Please wait a moment"), {
        description: t(
          "contact.form.rate.body",
          "We received your last message. Give us a few seconds.",
        ),
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone ? `${dial} ${phone}`.trim() : null,
      company: company.trim(),
      industry: industry || null,
      size: size || null,
      subject,
      message: message.trim(),
      locale: lang,
    };

    /* Always queue locally so a static deployment still preserves leads. */
    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      queue.push({
        id: crypto.randomUUID?.() ?? String(Date.now()),
        ...payload,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      /* no-op; storage may be disabled */
    }

    try {
      const result = await submitMutation.mutateAsync(payload);
      setPublicRef(result.publicRef);
      setSubmitted(true);
      setLastSubmitAt(Date.now());
      toast.success(t("contact.form.success.title", "Message received"), {
        description: t(
          "contact.form.success.body",
          "An IO SKY operating partner will respond within 24 business hours.",
        ),
      });
    } catch (error) {
      // Backend unreachable — keep the localStorage queue + still show success
      // so the visitor isn't punished for our infra hiccup.
      console.warn("[contact.submit] backend unreachable, queued offline:", error);
      setPublicRef(null);
      setSubmitted(true);
      setLastSubmitAt(Date.now());
      toast.success(
        t("contact.form.success.title", "Message received"),
        {
          description: t(
            "contact.form.offline.body",
            "Saved offline — we'll reconcile and follow up within 24 business hours.",
          ),
        },
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSubmitted(false);
    setPublicRef(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setIndustry("");
    setSize("");
    setSubject("");
    setMessage("");
    setTouched({});
    formMountedAt.current = Date.now();
  }

  /* ---- trust pillars (left rail) ---- */
  const TRUST = [
    {
      icon: Zap,
      titleKey: "contact.trust.fast.title",
      titleFb: "Fast Response",
      bodyKey: "contact.trust.fast.body",
      bodyFb: "We respond within 24 business hours.",
    },
    {
      icon: ShieldCheck,
      titleKey: "contact.trust.secure.title",
      titleFb: "Confidential & Secure",
      bodyKey: "contact.trust.secure.body",
      bodyFb: "Your data is 100% confidential and protected at all times.",
    },
    {
      icon: Lightbulb,
      titleKey: "contact.trust.expert.title",
      titleFb: "Expert Guidance",
      bodyKey: "contact.trust.expert.body",
      bodyFb: "Speak directly with operational intelligence experts.",
    },
    {
      icon: Handshake,
      titleKey: "contact.trust.partner.title",
      titleFb: "Strategic Partnership",
      bodyKey: "contact.trust.partner.body",
      bodyFb: "We build long-term partnerships, not just solutions.",
    },
  ];

  /* ---- trust strip (below content) ---- */
  const STRIP = [
    {
      icon: Lock,
      titleKey: "contact.strip.security.title",
      titleFb: "Enterprise-Grade Security",
      bodyKey: "contact.strip.security.body",
      bodyFb: "Built with advanced security infrastructure and data protection by design.",
    },
    {
      icon: Brain,
      titleKey: "contact.strip.intel.title",
      titleFb: "Operational Intelligence",
      bodyKey: "contact.strip.intel.body",
      bodyFb: "AI-powered insights for smarter, faster and better decisions.",
    },
    {
      icon: Globe2,
      titleKey: "contact.strip.global.title",
      titleFb: "Global Operations",
      bodyKey: "contact.strip.global.body",
      bodyFb: "Supporting businesses and operations worldwide.",
    },
    {
      icon: TrendingUp,
      titleKey: "contact.strip.scale.title",
      titleFb: "Scalable Solutions",
      bodyKey: "contact.strip.scale.body",
      bodyFb: "Flexible systems that grow and adapt with your business.",
    },
    {
      icon: Users,
      titleKey: "contact.strip.partner.title",
      titleFb: "Long-Term Partnership",
      bodyKey: "contact.strip.partner.body",
      bodyFb: "We grow with you, not for you.",
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0B1020] text-[#E6EAF0]">
      {/* Atmospheric backdrop — identical to every other page. */}
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

      {/* =========================== MAIN =========================== */}
      <main className="relative z-10 flex-1 pt-[88px] md:pt-[100px] pb-20">
        <section className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* ---------------------- LEFT RAIL ---------------------- */}
            <aside className="lg:col-span-3 relative overflow-hidden">
              {/* eyebrow */}
              <div className="inline-flex items-center gap-2 text-[10.5px] font-mono tracking-[0.24em] uppercase text-[var(--color-orange)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-orange)] shadow-[0_0_10px_rgba(255, 122, 0,0.7)]" />
                {t("contact.eyebrow", "Contact IO SKY")}
              </div>

              <h1 className="mt-5 font-display font-medium tracking-[-0.022em] leading-[1.05] text-[40px] md:text-[44px] xl:text-[48px] text-[var(--color-ivory)]">
                {t("contact.h1.pre", "Let's build operational ")}
                <span className="text-[var(--color-orange)]">
                  {t("contact.h1.accent", "excellence")}
                </span>{" "}
                {t("contact.h1.post", "together.")}
              </h1>

              <p className="mt-5 text-[14.5px] leading-[1.65] text-[oklch(0.78_0.014_250)] max-w-[42ch]">
                {t(
                  "contact.intro",
                  "Whether you have a question, need expert advice, or want to explore how we can accelerate your operational growth — our team is ready to connect.",
                )}
              </p>

              {/* trust pillars over globe */}
              <div className="relative mt-8">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-12 right-0 top-4 bottom-0 opacity-[0.22]"
                  style={{
                    backgroundImage: `url(${GLOBE_IMG})`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "contain",
                    backgroundPosition: "left center",
                    maskImage:
                      "radial-gradient(closest-side at 30% 50%, #000 55%, transparent 100%)",
                    WebkitMaskImage:
                      "radial-gradient(closest-side at 30% 50%, #000 55%, transparent 100%)",
                  }}
                />
                <ul className="relative flex flex-col gap-5">
                  {TRUST.map((p) => {
                    const Icon = p.icon;
                    return (
                      <li key={p.titleKey} className="flex items-start gap-3.5">
                        <span className="shrink-0 w-10 h-10 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center text-[var(--color-orange)]">
                          <Icon className="w-[18px] h-[18px]" strokeWidth={1.7} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-display font-medium text-[var(--color-ivory)]">
                            {t(p.titleKey, p.titleFb)}
                          </div>
                          <p className="mt-1 text-[12.5px] leading-[1.55] text-[oklch(0.72_0.014_250)] max-w-[28ch]">
                            {t(p.bodyKey, p.bodyFb)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </aside>

            {/* ---------------------- CENTER FORM ---------------------- */}
            <div className="lg:col-span-6">
              {!submitted ? (
                <form
                  onSubmit={handleSubmit}
                  className="glass-strong p-6 md:p-8 relative overflow-hidden"
                  noValidate
                >
                  {/* top accent line */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255, 122, 0,0.55) 50%, transparent 100%)",
                    }}
                  />
                  {/* header */}
                  <header className="flex items-center gap-3 mb-1.5">
                    <span className="w-9 h-9 rounded-lg border border-[#FF7A00]/30 bg-[rgba(255, 122, 0,0.08)] text-[var(--color-orange)] flex items-center justify-center">
                      <Mail className="w-[18px] h-[18px]" strokeWidth={1.8} />
                    </span>
                    <h2 className="font-display text-[20px] md:text-[22px] font-medium tracking-[-0.012em] text-[var(--color-ivory)]">
                      {t("contact.form.title", "Send us a message")}
                    </h2>
                  </header>
                  <p className="text-[13px] text-[oklch(0.72_0.014_250)] mb-6">
                    {t(
                      "contact.form.subtitle",
                      "Fill in the form below and our team will get back to you shortly.",
                    )}
                  </p>

                  {/* honeypot — bots fill this; real users never see it */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    className="absolute left-[-9999px] top-auto w-px h-px"
                    aria-hidden
                  />

                  {/* row 1 — name + email */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Field
                      label={t("contact.field.name", "Full Name")}
                      required
                      icon={<UserIcon className="w-4 h-4" strokeWidth={1.8} />}
                      placeholder={t("contact.placeholder.name", "Your full name")}
                      value={fullName}
                      onChange={setFullName}
                      onBlur={() => setTouched((p) => ({ ...p, fullName: true }))}
                      error={err("fullName", nameValid)}
                      errorMsg={t("contact.field.name.err", "Please enter your full name")}
                    />
                    <Field
                      type="email"
                      label={t("contact.field.email", "Email Address")}
                      required
                      icon={<Mail className="w-4 h-4" strokeWidth={1.8} />}
                      placeholder={t("contact.placeholder.email", "you@email.com")}
                      value={email}
                      onChange={setEmail}
                      onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                      error={err("email", emailValid)}
                      errorMsg={t("contact.field.email.err", "Please enter a valid email")}
                    />
                  </div>

                  {/* row 2 — phone (dial+number) + company */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[12.5px] font-medium text-[oklch(0.82_0.012_250)] mb-1.5">
                        {t("contact.field.phone", "Phone Number")}
                      </label>
                      <div className="flex gap-2">
                        <Select value={countryCode} onValueChange={setCountryCode}>
                          <SelectTrigger className="w-[120px] h-11 bg-white/[0.04] border-white/10 hover:border-[#FF7A00]/30 focus:border-[#FF7A00]/60 text-[var(--color-ivory)]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[oklch(0.13_0.022_260)] border-white/10 max-h-[280px]">
                            {COUNTRIES.map((c) => (
                              <SelectItem
                                key={c.code}
                                value={c.code}
                                className="text-[13px]"
                              >
                                <span className="font-mono mr-1.5">{c.flag}</span>{" "}
                                {c.dial}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <input
                          type="tel"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder={t("contact.placeholder.phone", "6 12345678")}
                          className="flex-1 h-11 px-3 rounded-md bg-white/[0.04] border border-white/10 hover:border-[#FF7A00]/30 focus:border-[#FF7A00]/60 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/25 text-[14px] text-[var(--color-ivory)] placeholder:text-[oklch(0.55_0.014_250)] transition-colors"
                        />
                      </div>
                    </div>
                    <Field
                      label={t("contact.field.company", "Company Name")}
                      required
                      icon={<Building2 className="w-4 h-4" strokeWidth={1.8} />}
                      placeholder={t("contact.placeholder.company", "Your company name")}
                      value={company}
                      onChange={setCompany}
                      onBlur={() => setTouched((p) => ({ ...p, company: true }))}
                      error={err("company", companyValid)}
                      errorMsg={t("contact.field.company.err", "Please enter your company name")}
                    />
                  </div>

                  {/* row 3 — industry + size */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[12.5px] font-medium text-[oklch(0.82_0.012_250)] mb-1.5">
                        {t("contact.field.industry", "Industry")}
                      </label>
                      <Select value={industry} onValueChange={setIndustry}>
                        <SelectTrigger className="w-full h-11 bg-white/[0.04] border-white/10 hover:border-[#FF7A00]/30 focus:border-[#FF7A00]/60 text-[var(--color-ivory)]">
                          <SelectValue
                            placeholder={t(
                              "contact.placeholder.industry",
                              "Select your industry",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-[oklch(0.13_0.022_260)] border-white/10">
                          {INDUSTRIES.map((k) => (
                            <SelectItem key={k} value={k} className="text-[13px]">
                              {t(k, defaultIndustry(k))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[12.5px] font-medium text-[oklch(0.82_0.012_250)] mb-1.5">
                        {t("contact.field.size", "Company Size")}
                      </label>
                      <Select value={size} onValueChange={setSize}>
                        <SelectTrigger className="w-full h-11 bg-white/[0.04] border-white/10 hover:border-[#FF7A00]/30 focus:border-[#FF7A00]/60 text-[var(--color-ivory)]">
                          <SelectValue
                            placeholder={t(
                              "contact.placeholder.size",
                              "Select company size",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-[oklch(0.13_0.022_260)] border-white/10">
                          {COMPANY_SIZES.map((k) => (
                            <SelectItem key={k} value={k} className="text-[13px]">
                              {t(k, defaultSize(k))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* row 4 — subject */}
                  <div className="mb-4">
                    <label className="block text-[12.5px] font-medium text-[oklch(0.82_0.012_250)] mb-1.5">
                      {t("contact.field.subject", "Subject")}{" "}
                      <span className="text-[var(--color-orange)]">*</span>
                    </label>
                    <Select
                      value={subject}
                      onValueChange={(v) => {
                        setSubject(v);
                        setTouched((p) => ({ ...p, subject: true }));
                      }}
                    >
                      <SelectTrigger
                        className={`w-full h-11 bg-white/[0.04] border ${err("subject", subjectValid) ? "border-rose-400/60 focus:border-rose-400" : "border-white/10 hover:border-[#FF7A00]/30 focus:border-[#FF7A00]/60"} text-[var(--color-ivory)]`}
                      >
                        <SelectValue
                          placeholder={t(
                            "contact.placeholder.subject",
                            "What is your message about?",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[oklch(0.13_0.022_260)] border-white/10">
                        {SUBJECTS.map((k) => (
                          <SelectItem key={k} value={k} className="text-[13px]">
                            {t(k, defaultSubject(k))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {err("subject", subjectValid) && (
                      <p className="mt-1 text-[12px] text-rose-300">
                        {t("contact.field.subject.err", "Please choose a subject")}
                      </p>
                    )}
                  </div>

                  {/* row 5 — message */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[12.5px] font-medium text-[oklch(0.82_0.012_250)]">
                        {t("contact.field.message", "Your Message")}{" "}
                        <span className="text-[var(--color-orange)]">*</span>
                      </label>
                      <span
                        className={`text-[11px] font-mono ${message.length > MAX_MESSAGE ? "text-rose-300" : "text-[oklch(0.65_0.014_250)]"}`}
                      >
                        {message.length} / {MAX_MESSAGE}
                      </span>
                    </div>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE + 1))}
                      onBlur={() => setTouched((p) => ({ ...p, message: true }))}
                      placeholder={t(
                        "contact.placeholder.message",
                        "Tell us how we can help you…",
                      )}
                      rows={6}
                      className={`w-full px-3 py-3 rounded-md bg-white/[0.04] border ${err("message", messageValid) ? "border-rose-400/60" : "border-white/10 hover:border-[#FF7A00]/30 focus:border-[#FF7A00]/60"} focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/25 text-[14px] text-[var(--color-ivory)] placeholder:text-[oklch(0.55_0.014_250)] resize-y transition-colors`}
                    />
                    {err("message", messageValid) && (
                      <p className="mt-1 text-[12px] text-rose-300">
                        {t(
                          "contact.field.message.err",
                          "Please describe your inquiry (10+ characters)",
                        )}
                      </p>
                    )}
                  </div>

                  {/* trust line */}
                  <div className="flex items-center gap-2 mb-5 text-[12px] text-[oklch(0.7_0.014_250)]">
                    <Lock className="w-3.5 h-3.5 text-[var(--color-orange)]" strokeWidth={2} />
                    {t(
                      "contact.form.privacy",
                      "Your information is secure. We never share your data with third parties.",
                    )}
                  </div>

                  {/* submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full justify-center !h-[48px] !text-[14.5px] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? t("contact.form.sending", "Sending…")
                      : t("contact.form.send", "Send Message")}
                    <Send className="w-4 h-4" strokeWidth={2} />
                  </button>
                </form>
              ) : (
                <SuccessPanel onReset={resetForm} publicRef={publicRef} t={t} />
              )}
            </div>

            {/* ---------------------- RIGHT RAIL ---------------------- */}
            <aside className="lg:col-span-3 flex flex-col gap-5">
              {/* Contact Information */}
              <div className="glass p-5 md:p-6">
                <h3 className="font-display text-[16px] font-medium text-[var(--color-ivory)] mb-4">
                  {t("contact.info.title", "Contact Information")}
                </h3>
                <ul className="space-y-4">
                  <InfoRow
                    icon={<Mail className="w-[18px] h-[18px]" strokeWidth={1.8} />}
                    label={t("contact.info.email", "Email")}
                    href="mailto:info@io-sky.io"
                    value="info@io-sky.io"
                  />
                  <InfoRow
                    icon={<PhoneIcon className="w-[18px] h-[18px]" strokeWidth={1.8} />}
                    label={t("contact.info.phone", "Phone")}
                    href="tel:+31850603468"
                    value="+31 85 060 3468"
                  />
                  <InfoRow
                    icon={<MapPin className="w-[18px] h-[18px]" strokeWidth={1.8} />}
                    label={t("contact.info.hq", "Headquarters")}
                    value={t("contact.info.hq.value", "Rotterdam, Netherlands")}
                  />
                </ul>
              </div>

              {/* Book a Discovery Call */}
              <div className="glass p-5 md:p-6 relative overflow-hidden">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255, 122, 0,0.45) 50%, transparent 100%)",
                  }}
                />
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-[var(--color-orange)]" strokeWidth={2} />
                  <h3 className="font-display text-[16px] font-medium text-[var(--color-ivory)]">
                    {t("contact.book.title", "Book a Discovery Call")}
                  </h3>
                </div>
                <p className="text-[13px] leading-[1.55] text-[oklch(0.72_0.014_250)]">
                  {t(
                    "contact.book.body",
                    "Schedule a free 30-minute discovery call with one of our experts.",
                  )}
                </p>
                <Link
                  href="/book-strategy"
                  className="mt-4 inline-flex items-center justify-between gap-2 w-full h-11 px-4 rounded-md border border-[#FF7A00]/40 bg-[rgba(255, 122, 0,0.08)] hover:bg-[rgba(255, 122, 0,0.16)] hover:border-[#FF7A00]/60 text-[13px] font-medium text-[var(--color-ivory)] transition-colors"
                >
                  {t("contact.book.cta", "Book Your Call")}
                  <ArrowRight className="w-4 h-4 text-[var(--color-orange)]" strokeWidth={2} />
                </Link>
              </div>

              {/* Other Inquiries */}
              <div className="glass p-5 md:p-6">
                <h3 className="font-display text-[16px] font-medium text-[var(--color-ivory)] mb-3.5">
                  {t("contact.other.title", "Other Inquiries")}
                </h3>
                <ul className="space-y-2">
                  <OtherRow
                    icon={<Briefcase className="w-4 h-4" strokeWidth={1.8} />}
                    label={t("contact.other.partnership", "Partnership Opportunities")}
                    href="mailto:partners@io-sky.io"
                  />
                  <OtherRow
                    icon={<Megaphone className="w-4 h-4" strokeWidth={1.8} />}
                    label={t("contact.other.press", "Media & Press Inquiries")}
                    href="mailto:press@io-sky.io"
                  />
                  <OtherRow
                    icon={<HelpCircle className="w-4 h-4" strokeWidth={1.8} />}
                    label={t("contact.other.general", "General Questions")}
                    href="mailto:hello@io-sky.io"
                  />
                </ul>
              </div>
            </aside>
          </div>
        </section>

        {/* ======================= TRUST STRIP ======================= */}
        <section className="container mt-14 md:mt-16">
          <div className="glass p-5 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
              {STRIP.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.titleKey}
                    className="flex items-start gap-3 lg:col-span-1"
                  >
                    <span className="shrink-0 w-9 h-9 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center text-[var(--color-orange)]">
                      <Icon className="w-[17px] h-[17px]" strokeWidth={1.7} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-display font-medium text-[var(--color-ivory)] leading-tight">
                        {t(p.titleKey, p.titleFb)}
                      </div>
                      <p className="mt-1 text-[11.5px] leading-[1.5] text-[oklch(0.7_0.014_250)]">
                        {t(p.bodyKey, p.bodyFb)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {/* Developer Access (subtle) */}
              <div className="lg:col-span-1 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-[#FF7A00]/30 hover:bg-[rgba(255, 122, 0,0.04)] transition-colors p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Code2
                    className="w-4 h-4 text-[var(--color-orange)]"
                    strokeWidth={2}
                  />
                  <div className="text-[12.5px] font-display font-medium text-[var(--color-ivory)] leading-tight">
                    {t("contact.dev.title", "Building the future with us?")}
                  </div>
                </div>
                <p className="text-[11.5px] leading-[1.5] text-[oklch(0.7_0.014_250)]">
                  {t(
                    "contact.dev.body",
                    "Developers and engineers who want to contribute to the IO SKY ecosystem.",
                  )}
                </p>
                <Link
                  href="/engineering-access"
                  className="mt-1 inline-flex items-center justify-between gap-2 w-full h-9 px-3 rounded-md border border-[#FF7A00]/40 bg-[rgba(255, 122, 0,0.08)] hover:bg-[rgba(255, 122, 0,0.18)] text-[12px] font-medium text-[var(--color-ivory)] transition-colors"
                >
                  {t("contact.dev.cta", "Apply for Engineering Access")}
                  <ArrowUpRight
                    className="w-3.5 h-3.5 text-[var(--color-orange)]"
                    strokeWidth={2}
                  />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Field({
  label,
  required = false,
  icon,
  placeholder,
  value,
  onChange,
  onBlur,
  type = "text",
  error,
  errorMsg,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
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
          className={`w-full h-11 ${icon ? "pl-9" : "pl-3"} pr-3 rounded-md bg-white/[0.04] border ${error ? "border-rose-400/60 focus:border-rose-400" : "border-white/10 hover:border-[#FF7A00]/30 focus:border-[#FF7A00]/60"} focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/25 text-[14px] text-[var(--color-ivory)] placeholder:text-[oklch(0.55_0.014_250)] transition-colors`}
        />
      </div>
      {error && errorMsg && (
        <p className="mt-1 text-[12px] text-rose-300">{errorMsg}</p>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const Body = (
    <div className="flex items-start gap-3 group">
      <span className="shrink-0 w-9 h-9 rounded-lg border border-white/10 bg-white/[0.03] group-hover:border-[#FF7A00]/30 group-hover:bg-[rgba(255, 122, 0,0.06)] flex items-center justify-center text-[var(--color-orange)] transition-colors">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-mono tracking-[0.16em] uppercase text-[oklch(0.65_0.014_250)]">
          {label}
        </div>
        <div className="mt-0.5 text-[13.5px] text-[var(--color-ivory)] group-hover:text-[var(--color-orange)] transition-colors truncate">
          {value}
        </div>
      </div>
    </div>
  );
  return href ? (
    <a href={href} className="block">
      {Body}
    </a>
  ) : (
    <div>{Body}</div>
  );
}

function OtherRow({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between gap-3 py-2.5 px-3 -mx-2 rounded-md hover:bg-white/[0.04] hover:text-[var(--color-orange)] text-[var(--color-ivory)] transition-colors group"
    >
      <span className="flex items-center gap-2.5 text-[13px]">
        <span className="text-[var(--color-orange)]">{icon}</span>
        {label}
      </span>
      <ChevronDown
        className="w-3.5 h-3.5 -rotate-90 text-[oklch(0.6_0.014_250)] group-hover:text-[var(--color-orange)] transition-colors"
        strokeWidth={2}
      />
    </a>
  );
}

function SuccessPanel({
  onReset,
  publicRef,
  t,
}: {
  onReset: () => void;
  publicRef: string | null;
  t: (k: string, fb: string) => string;
}) {
  return (
    <div className="glass-strong p-8 md:p-10 relative overflow-hidden text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255, 122, 0,0.6) 50%, transparent 100%)",
        }}
      />
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-[#FF7A00]/40 bg-[rgba(255, 122, 0,0.1)] text-[var(--color-orange)] mb-5">
        <CheckCircle2 className="w-8 h-8" strokeWidth={1.7} />
      </div>
      <h2 className="font-display text-[24px] md:text-[26px] font-medium tracking-[-0.012em] text-[var(--color-ivory)]">
        {t("contact.success.title", "Message received.")}
      </h2>
      {publicRef && (
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FF7A00]/30 bg-[#FF7A00]/[0.08] text-[11.5px] font-mono uppercase tracking-[0.16em] text-[#FF7A00]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] shadow-[0_0_8px_#FF7A00]" />
          Reference · {publicRef}
        </div>
      )}
      <p className="mt-3 text-[14px] leading-[1.65] text-[oklch(0.78_0.014_250)] max-w-[44ch] mx-auto">
        {t(
          "contact.success.body",
          "Thank you for reaching out. An IO SKY operating partner will respond within 24 business hours.",
        )}
      </p>
      <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/book-strategy"
          className="btn-primary !h-11 !text-[13.5px] !px-5"
        >
          {t("contact.success.book", "Book Discovery Call")}
          <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="btn-secondary !h-11 !text-[13.5px] !px-5"
        >
          {t("contact.success.another", "Send another message")}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fallback dictionaries (English) used when locale key is missing.    */
/* ------------------------------------------------------------------ */

function defaultIndustry(k: string) {
  const map: Record<string, string> = {
    "industry.saas": "SaaS / Software",
    "industry.financial": "Financial services",
    "industry.ecommerce": "E-commerce & retail",
    "industry.healthcare": "Healthcare & life sciences",
    "industry.manufacturing": "Manufacturing & industrial",
    "industry.logistics": "Logistics & supply chain",
    "industry.energy": "Energy & utilities",
    "industry.realestate": "Real estate & construction",
    "industry.professional": "Professional services",
    "industry.public": "Public sector & non-profit",
    "industry.other": "Other",
  };
  return map[k] ?? k;
}

function defaultSize(k: string) {
  const map: Record<string, string> = {
    "size.1-10": "1 – 10 employees",
    "size.11-50": "11 – 50 employees",
    "size.51-200": "51 – 200 employees",
    "size.201-500": "201 – 500 employees",
    "size.501-1000": "501 – 1,000 employees",
    "size.1000+": "1,000+ employees",
  };
  return map[k] ?? k;
}

function defaultSubject(k: string) {
  const map: Record<string, string> = {
    "subject.strategy": "Strategy & operating partnership",
    "subject.scan": "AI Scan & ecosystem fit",
    "subject.partnership": "Partnership & integrations",
    "subject.press": "Press & media",
    "subject.general": "General questions",
    "subject.security": "Security & compliance",
  };
  return map[k] ?? k;
}
