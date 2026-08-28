/*
 * IO SKY — Contact page.
 *
 * Rebuilt per IO_SKY_Master_Design_Spec.md §7. Deliberately minimal — the
 * spec is explicit that Contact "routes an enquiry clearly without turning
 * the page into a second sales or About page": no testimonials, FAQ, case
 * studies, trust strip, budget/phone/company-size fields, or extra CTAs.
 *
 * Layout: two-column on desktop — context copy left, form right. Single
 * column, stacked, on mobile.
 *
 * Real backend integration preserved: trpc.contact.submit, honeypot + time
 * gate + rate-limit anti-spam guards, success/failure states in place.
 */
import { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
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

const MAX_MESSAGE = 2000;

const SUBJECT_OPTIONS = [
  "contact2.subject.general",
  "contact2.subject.partnership",
  "contact2.subject.media",
  "contact2.subject.careers",
  "contact2.subject.existing",
] as const;

export default function Contact() {
  const { t } = useT();
  const submitMutation = trpc.contact.submit.useMutation();

  const formMountedAt = useRef(Date.now());
  const lastSubmitAt = useRef<number | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const nameValid = name.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const subjectValid = subject.trim().length > 0;
  const messageValid = message.trim().length > 0 && message.length <= MAX_MESSAGE;
  const formValid = nameValid && emailValid && subjectValid && messageValid;

  const err = (field: string, valid: boolean) => touched[field] && !valid;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, subject: true, message: true });
    if (!formValid) return;

    if (honeypot.trim().length > 0) return; // silent bot trap
    if (Date.now() - formMountedAt.current < 1500) return; // time gate
    if (lastSubmitAt.current && Date.now() - lastSubmitAt.current < 8000) return; // rate limit
    lastSubmitAt.current = Date.now();

    try {
      await submitMutation.mutateAsync({
        fullName: name.trim(),
        email: email.trim(),
        company: company.trim() || null,
        subject: subject.trim(),
        message: message.trim(),
        website: honeypot,
      });
      setStatus("success");
    } catch (error) {
      console.warn("[contact.submit] failed:", error);
      setStatus("error");
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar />
      <main className="relative z-[1] page-enter">
        <section className="relative pt-32 md:pt-40 pb-20 md:pb-28">
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              {/* Left — context */}
              <div className="lg:col-span-5">
                <div className="eyebrow">{t("contact2.eyebrow")}</div>
                <h1 className="mt-5 font-display font-semibold text-[30px] md:text-[38px] leading-[1.18] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                  {t("contact2.title")}
                </h1>
                <div className="mt-6 space-y-4 text-[15px] leading-[1.7] text-[oklch(0.78_0.014_250)]">
                  <p>{t("contact2.body1")}</p>
                  <p>{t("contact2.body2")}</p>
                </div>
                <Link
                  href="/book-strategy"
                  className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-orange)] hover:gap-2.5 transition-all"
                >
                  {t("contact2.discoveryLink")}
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                </Link>
              </div>

              {/* Right — form */}
              <div className="lg:col-span-7">
                <div className="glass rounded-[24px] p-6 md:p-10">
                  {status === "success" ? (
                    <div className="text-center py-8">
                      <h2 className="font-display font-semibold text-[22px] text-[var(--color-ivory)]">
                        {t("contact2.success.title")}
                      </h2>
                      <p className="mt-3 max-w-[440px] mx-auto text-[14.5px] leading-[1.65] text-[oklch(0.78_0.014_250)]">
                        {t("contact2.success.body")}
                      </p>
                      <Link href="/" className="btn-secondary mt-6 inline-flex">
                        {t("contact2.success.cta")}
                      </Link>
                    </div>
                  ) : (
                    <form onSubmit={onSubmit} noValidate>
                      {/* Honeypot */}
                      <input
                        type="text"
                        name="website"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        className="absolute -left-[9999px] w-px h-px opacity-0"
                        aria-hidden="true"
                      />

                      {status === "error" && (
                        <div className="mb-5 rounded-lg border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3">
                          <p className="text-[13.5px] font-medium text-rose-300">{t("contact2.failure.title")}</p>
                          <p className="mt-1 text-[12.5px] text-rose-200/80">{t("contact2.failure.body")}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="text-[12.5px] font-medium text-[var(--color-ivory)]/85 mb-1.5 block">
                            {t("contact2.field.name")} *
                          </label>
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                            placeholder={t("contact2.field.name.ph")}
                            className={`w-full h-11 px-3.5 rounded-md bg-white/[0.04] border text-[14px] text-[var(--color-ivory)] placeholder:text-white/35 outline-none transition-colors ${
                              err("name", nameValid) ? "border-rose-400/60" : "border-white/10 focus:border-[var(--color-orange)]/60"
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[12.5px] font-medium text-[var(--color-ivory)]/85 mb-1.5 block">
                            {t("contact2.field.email")} *
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                            placeholder={t("contact2.field.email.ph")}
                            className={`w-full h-11 px-3.5 rounded-md bg-white/[0.04] border text-[14px] text-[var(--color-ivory)] placeholder:text-white/35 outline-none transition-colors ${
                              err("email", emailValid) ? "border-rose-400/60" : "border-white/10 focus:border-[var(--color-orange)]/60"
                            }`}
                          />
                        </div>
                      </div>

                      <div className="mt-5">
                        <label className="text-[12.5px] font-medium text-[var(--color-ivory)]/85 mb-1.5 block">
                          {t("contact2.field.company")}
                        </label>
                        <input
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder={t("contact2.field.company.ph")}
                          className="w-full h-11 px-3.5 rounded-md bg-white/[0.04] border border-white/10 focus:border-[var(--color-orange)]/60 text-[14px] text-[var(--color-ivory)] placeholder:text-white/35 outline-none transition-colors"
                        />
                      </div>

                      <div className="mt-5">
                        <label className="text-[12.5px] font-medium text-[var(--color-ivory)]/85 mb-1.5 block">
                          {t("contact2.field.subject")} *
                        </label>
                        <Select
                          value={subject}
                          onValueChange={(v) => {
                            setSubject(v);
                            setTouched((p) => ({ ...p, subject: true }));
                          }}
                        >
                          <SelectTrigger
                            className={`w-full h-11 bg-white/[0.04] border text-[var(--color-ivory)] ${
                              err("subject", subjectValid) ? "border-rose-400/60" : "border-white/10 hover:border-[var(--color-orange)]/30"
                            }`}
                          >
                            <SelectValue placeholder={t("contact2.field.subject.ph")} />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBJECT_OPTIONS.map((k) => (
                              <SelectItem key={k} value={k} className="text-[13px]">
                                {t(k)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="mt-5">
                        <label className="text-[12.5px] font-medium text-[var(--color-ivory)]/85 mb-1.5 block">
                          {t("contact2.field.message")} *
                        </label>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onBlur={() => setTouched((p) => ({ ...p, message: true }))}
                          placeholder={t("contact2.field.message.ph")}
                          rows={6}
                          maxLength={MAX_MESSAGE}
                          className={`w-full px-3.5 py-3 rounded-md bg-white/[0.04] border text-[14px] leading-[1.6] text-[var(--color-ivory)] placeholder:text-white/35 outline-none transition-colors resize-none ${
                            err("message", messageValid) ? "border-rose-400/60" : "border-white/10 focus:border-[var(--color-orange)]/60"
                          }`}
                        />
                        <div className="mt-1 text-right text-[11px] text-white/40">
                          {message.length} / {MAX_MESSAGE}
                        </div>
                      </div>

                      <p className="mt-4 text-[11.5px] leading-[1.6] text-white/40">
                        {t("contact2.privacy")}
                      </p>

                      <button
                        type="submit"
                        disabled={submitMutation.isPending}
                        className="btn-primary mt-6 w-full sm:w-auto justify-center disabled:opacity-60"
                      >
                        {submitMutation.isPending ? "…" : t("contact2.submit")}
                        <Send className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
