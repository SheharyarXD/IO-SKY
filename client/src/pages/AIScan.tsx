/**
 * IO SKY — AI Scan Landing Page.
 *
 * Rebuilt per IO_SKY_AI_Scan_Landing_Page_FINAL_COMPLETE_v2 spec. Customer-
 * facing structure (locked, do not rewrite/shorten/paraphrase without
 * Product Owner approval):
 *   01 Hero · 02 Why a Scan · 03 The Right Question First · 04 Expert Review
 *   05 What You Receive (+ preview) · Decision Value · 06 Choose Your Scan
 *   (3 Signature Glass cards) · 07 What Happens Next · Help Me Choose
 *
 * Orange (#F58A1F) is semantic: eyebrows, the three primary Start Scan CTAs,
 * functional focus/active states. Preview the Assessment and Help Me Choose
 * are secondary soft CTAs (restrained orange outline, off-white text).
 *
 * Backend reality check, so this isn't overclaimed: there is no Stripe
 * integration in this codebase and no credentials for one (see
 * MILESTONE3_CHECKLIST.md addendum + docs/client/IO_SKY_Scope_Position.pdf —
 * "no payment processor is integrated anywhere in this app"). The spec's
 * backend-verified-payment-gated account creation is therefore NOT built.
 * "Start X Scan" opens the existing lead-capture flow (trpc.aiScans.submitLead,
 * already live and tested) so the funnel keeps working end-to-end; preferred
 * language and primary audience are captured and stored on the lead. Wiring
 * real payment/checkout in front of this is a separate, credentialed piece
 * of work.
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  ChevronDown,
  Lock,
  User,
  Mail,
  Phone,
  Building2,
  X,
} from "lucide-react";

type Tier = "free" | "growth" | "elite";
/** Backend tier enum (server/routers/aiScans.ts) predates this redesign and
 * is deeply wired into a working, tested 35-question/5-dimension/3-tier
 * scoring system — renaming it is a data-model change, not a restyle, so
 * the new Operations/Cyber/Elite names are a display-layer mapping only. */
const TIER_DISPLAY: Record<Tier, "operations" | "cyber" | "elite"> = {
  free: "operations",
  growth: "cyber",
  elite: "elite",
};

const AUDIENCE_OPTIONS = ["leadership", "technical", "investors"] as const;
const LANGUAGE_OPTIONS = ["en", "nl", "de", "fr", "es", "it", "pt", "ja", "zh", "ar"] as const;

/** Spec: "Direct telephone action... the centrally configured official IO
 * SKY number." No such number has ever been configured anywhere in this
 * codebase — rather than show a placeholder that looks real, the CTA
 * degrades to informational-only text when it's unset. */
const IOSKY_PHONE_NUMBER = (import.meta.env.VITE_IOSKY_PHONE_NUMBER as string | undefined) || "";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow justify-center">{children}</div>;
}

/** Open, editorial text section — sections 02–04 per spec (not boxes/cards/grids). */
function EditorialSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="py-16 md:py-20">
      <div className="container max-w-[820px] mx-auto text-center">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-5 font-display font-semibold text-[26px] md:text-[34px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
          {title}
        </h2>
        <div className="mt-6 space-y-4 text-[15px] md:text-[16px] leading-[1.7] text-[var(--io-text-secondary)] text-left">
          {children}
        </div>
      </div>
    </section>
  );
}

/** Collapsed-by-default add-on disclosure inside a Scan card. */
function AddonDisclosure({
  note,
  items,
}: {
  note: string;
  items: { title: string; body: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-[12.5px] font-medium text-[var(--color-ivory)]/85"
        aria-expanded={open}
      >
        <span>Optional ways to review or present your results</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[12px] leading-[1.6] text-[var(--io-text-secondary)]">{note}</p>
          {items.map((it) => (
            <div key={it.title}>
              <div className="text-[12.5px] font-semibold text-[var(--color-ivory)]">{it.title}</div>
              <p className="mt-0.5 text-[12px] leading-[1.6] text-[var(--io-text-secondary)]">{it.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScanCard({
  tier,
  title,
  paragraphs,
  questions,
  receives,
  delivery,
  price,
  cta,
  addonNote,
  addons,
  connections,
  onStart,
}: {
  tier: Tier;
  title: string;
  paragraphs: string[];
  questions: string[];
  receives: string[];
  delivery: string;
  price: string;
  cta: string;
  addonNote: string;
  addons: { title: string; body: string }[];
  connections?: { title: string; items: { title: string; body: string }[] };
  onStart: () => void;
}) {
  return (
    <div className="io-signature-glass io-signature-glass--card flex flex-col h-full">
      <div className="io-signature-glass__content flex flex-col h-full">
        <h3 className="font-display font-semibold text-[19px] leading-[1.3] text-[var(--color-ivory)]">
          {title}
        </h3>
        <div className="mt-4 space-y-3 text-[13.5px] leading-[1.6] text-[var(--io-text-secondary)]">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {connections && (
          <div className="mt-5">
            <div className="text-[12.5px] font-semibold text-[var(--color-ivory)]">{connections.title}</div>
            <div className="mt-3 space-y-3">
              {connections.items.map((it) => (
                <div key={it.title}>
                  <div className="text-[12.5px] font-medium text-[var(--color-orange)]">{it.title}</div>
                  <p className="mt-0.5 text-[12.5px] leading-[1.6] text-[var(--io-text-secondary)]">{it.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ivory)]/70">
            Questions this Scan helps answer
          </div>
          <ul className="mt-2 space-y-1.5">
            {questions.map((q) => (
              <li key={q} className="text-[13px] leading-[1.55] text-[var(--io-text-secondary)] flex gap-2">
                <span aria-hidden className="text-[var(--color-orange)]">•</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ivory)]/70">
            What you receive
          </div>
          <ul className="mt-2 space-y-1.5">
            {receives.map((r) => (
              <li key={r} className="text-[13px] leading-[1.55] text-[var(--color-ivory)] flex gap-2">
                <span aria-hidden className="text-[var(--color-orange)]">✓</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <AddonDisclosure note={addonNote} items={addons} />

        <div className="mt-auto pt-6">
          <div className="text-[12px] text-[var(--io-text-secondary)]">{delivery}</div>
          <div className="mt-1 text-[22px] font-display font-semibold text-[var(--color-ivory)]">{price}</div>
          <button type="button" onClick={onStart} className="btn-primary mt-4 w-full justify-center">
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AIScan() {
  const { t } = useT();
  const [, navigate] = useLocation();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<Tier>("free");
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });
  const [language, setLanguage] = useState("en");
  const [audience, setAudience] = useState("");
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [submitState, setSubmitState] = useState<
    { kind: "idle" } | { kind: "success" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const acknowledgeAi = trpc.legal.acknowledgeAi.useMutation();
  const submitLead = trpc.aiScans.submitLead.useMutation({
    onSuccess: (data) => {
      setSubmitState({ kind: "success" });
      acknowledgeAi.mutate({ context: `ai-scan:${data.tier}` });
      // No payment gate exists yet (see file header), so the working path
      // is straight into the existing, tested questionnaire flow.
      window.setTimeout(() => navigate(`/ai-scan/start?tier=${data.tier}`), 900);
    },
    onError: (err) => {
      setSubmitState({
        kind: "error",
        message: err.message || "Something went wrong submitting your request. Please try again.",
      });
    },
  });

  const openPurchase = (tier: Tier) => {
    setSelectedTier(tier);
    setSubmitState({ kind: "idle" });
    setPurchaseOpen(true);
  };

  const scrollToChoose = () => {
    document.getElementById("choose-scan")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <Navbar />
      <main className="page-enter">
        {/* 01 — HERO */}
        <section className="pt-32 md:pt-40 pb-16 md:pb-20">
          <div className="container max-w-[760px] mx-auto text-center">
            <h1 className="font-display font-semibold text-[32px] md:text-[44px] leading-[1.15] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("aiscan2.hero.title")}
            </h1>
            <p className="mt-6 text-[16px] leading-[1.7] text-[var(--io-text-secondary)]">
              {t("aiscan2.hero.body1")}
            </p>
            <p className="mt-4 text-[16px] leading-[1.7] text-[var(--io-text-secondary)]">
              {t("aiscan2.hero.body2")}
            </p>
            <button type="button" onClick={scrollToChoose} className="btn-primary mt-8">
              {t("aiscan2.hero.cta")}
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </section>

        {/* 02 — WHY A SCAN */}
        <EditorialSection eyebrow={t("aiscan2.why.eyebrow")} title={t("aiscan2.why.title")}>
          <p>{t("aiscan2.why.body1")}</p>
          <p>{t("aiscan2.why.body2")}</p>
          <p className="text-[var(--color-ivory)] font-medium">{t("aiscan2.why.body3")}</p>
        </EditorialSection>

        {/* 03 — THE RIGHT QUESTION FIRST */}
        <EditorialSection eyebrow={t("aiscan2.right.eyebrow")} title={t("aiscan2.right.title")}>
          <p className="font-medium text-[var(--color-ivory)]">{t("aiscan2.right.body1")}</p>
          <p>{t("aiscan2.right.body2")}</p>
          <p>{t("aiscan2.right.body3")}</p>
          <p>{t("aiscan2.right.body4")}</p>
        </EditorialSection>

        {/* 04 — EXPERT REVIEW */}
        <EditorialSection eyebrow={t("aiscan2.expert.eyebrow")} title={t("aiscan2.expert.title")}>
          <p>{t("aiscan2.expert.body1")}</p>
          <p>{t("aiscan2.expert.body2")}</p>
          <p>{t("aiscan2.expert.body3")}</p>
          <p className="font-medium text-[var(--color-ivory)]">{t("aiscan2.expert.body4")}</p>
        </EditorialSection>

        {/* 05 — WHAT YOU RECEIVE */}
        <section className="py-16 md:py-20">
          <div className="container max-w-[820px] mx-auto text-center">
            <Eyebrow>{t("aiscan2.receive.eyebrow")}</Eyebrow>
            <h2 className="mt-5 font-display font-semibold text-[26px] md:text-[34px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("aiscan2.receive.title")}
            </h2>
            <p className="mt-6 text-[15px] md:text-[16px] leading-[1.7] text-[var(--io-text-secondary)]">
              {t("aiscan2.receive.body")}
            </p>
            <div className="mt-8 text-left space-y-5 max-w-[560px] mx-auto">
              {[
                ["report", t("aiscan2.receive.report.title"), t("aiscan2.receive.report.body")],
                ["roadmap", t("aiscan2.receive.roadmap.title"), t("aiscan2.receive.roadmap.body")],
                ["summary", t("aiscan2.receive.summary.title"), t("aiscan2.receive.summary.body")],
              ].map(([key, title, body]) => (
                <div key={key}>
                  <div className="font-display font-semibold text-[15px] text-[var(--color-ivory)]">{title}</div>
                  <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--io-text-secondary)]">{body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="container max-w-[900px] mx-auto mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div>
              <div className="font-medium text-[14px] text-[var(--color-ivory)]">{t("aiscan2.receive.audience.title")}</div>
              <p className="mt-2 text-[13px] leading-[1.6] text-[var(--io-text-secondary)]">{t("aiscan2.receive.audience.body")}</p>
              <p className="mt-3 text-[13px] font-medium text-[var(--color-ivory)]">{t("aiscan2.receive.language")}</p>
            </div>
            <div>
              <div className="font-medium text-[14px] text-[var(--color-ivory)]">{t("aiscan2.receive.preview.title")}</div>
              <p className="mt-2 text-[13px] leading-[1.6] text-[var(--io-text-secondary)]">{t("aiscan2.receive.preview.body")}</p>
              <button type="button" onClick={() => setPreviewOpen(true)} className="btn-secondary mt-3">
                {t("aiscan2.receive.preview.cta")}
              </button>
            </div>
          </div>
        </section>

        {/* DECISION VALUE */}
        <EditorialSection eyebrow={t("aiscan2.decision.eyebrow")} title={t("aiscan2.decision.title")}>
          <p>{t("aiscan2.decision.body1")}</p>
          <p className="font-medium text-[var(--color-ivory)]">{t("aiscan2.decision.body2")}</p>
        </EditorialSection>

        {/* 06 — CHOOSE YOUR SCAN (deliberate exception: 3 equal Signature Glass cards) */}
        <section id="choose-scan" className="py-16 md:py-20 scroll-mt-24">
          <div className="container max-w-[820px] mx-auto text-center">
            <Eyebrow>{t("aiscan2.choose.eyebrow")}</Eyebrow>
            <h2 className="mt-5 font-display font-semibold text-[26px] md:text-[34px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("aiscan2.choose.title")}
            </h2>
            <p className="mt-6 text-[15px] leading-[1.7] text-[var(--io-text-secondary)]">
              {t("aiscan2.choose.body")}
            </p>
          </div>

          <div className="container mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <ScanCard
              tier="free"
              title={t("aiscan2.tier.operations.title")}
              paragraphs={[t("aiscan2.tier.operations.body1"), t("aiscan2.tier.operations.body2"), t("aiscan2.tier.operations.body3")]}
              questions={[t("aiscan2.tier.operations.q1"), t("aiscan2.tier.operations.q2"), t("aiscan2.tier.operations.q3"), t("aiscan2.tier.operations.q4")]}
              receives={[t("aiscan2.tier.operations.receive1"), t("aiscan2.tier.operations.receive2"), t("aiscan2.tier.operations.receive3")]}
              delivery={t("aiscan2.tier.operations.delivery")}
              price={t("aiscan2.tier.operations.price")}
              cta={t("aiscan2.tier.operations.cta")}
              addonNote={t("aiscan2.tier.operations.addonNote")}
              addons={[
                { title: t("aiscan2.tier.operations.addon1.title"), body: t("aiscan2.tier.operations.addon1.body") },
                { title: t("aiscan2.tier.operations.addon2.title"), body: t("aiscan2.tier.operations.addon2.body") },
                { title: t("aiscan2.tier.operations.addon3.title"), body: t("aiscan2.tier.operations.addon3.body") },
              ]}
              onStart={() => openPurchase("free")}
            />
            <ScanCard
              tier="growth"
              title={t("aiscan2.tier.cyber.title")}
              paragraphs={[t("aiscan2.tier.cyber.body1"), t("aiscan2.tier.cyber.body2"), t("aiscan2.tier.cyber.body3"), t("aiscan2.tier.cyber.body4")]}
              questions={[t("aiscan2.tier.cyber.q1"), t("aiscan2.tier.cyber.q2"), t("aiscan2.tier.cyber.q3"), t("aiscan2.tier.cyber.q4")]}
              receives={[t("aiscan2.tier.cyber.receive1"), t("aiscan2.tier.cyber.receive2"), t("aiscan2.tier.cyber.receive3")]}
              delivery={t("aiscan2.tier.cyber.delivery")}
              price={t("aiscan2.tier.cyber.price")}
              cta={t("aiscan2.tier.cyber.cta")}
              addonNote={t("aiscan2.tier.cyber.addonNote")}
              addons={[
                { title: t("aiscan2.tier.cyber.addon1.title"), body: t("aiscan2.tier.cyber.addon1.body") },
                { title: t("aiscan2.tier.cyber.addon2.title"), body: t("aiscan2.tier.cyber.addon2.body") },
                { title: t("aiscan2.tier.cyber.addon3.title"), body: t("aiscan2.tier.cyber.addon3.body") },
              ]}
              onStart={() => openPurchase("growth")}
            />
            <ScanCard
              tier="elite"
              title={t("aiscan2.tier.elite.title")}
              paragraphs={[t("aiscan2.tier.elite.body1"), t("aiscan2.tier.elite.body2"), t("aiscan2.tier.elite.body3")]}
              connections={{
                title: t("aiscan2.tier.elite.connections.title"),
                items: [
                  { title: t("aiscan2.tier.elite.connections1.title"), body: t("aiscan2.tier.elite.connections1.body") },
                  { title: t("aiscan2.tier.elite.connections2.title"), body: t("aiscan2.tier.elite.connections2.body") },
                  { title: t("aiscan2.tier.elite.connections3.title"), body: t("aiscan2.tier.elite.connections3.body") },
                ],
              }}
              questions={[t("aiscan2.tier.elite.q1"), t("aiscan2.tier.elite.q2"), t("aiscan2.tier.elite.q3"), t("aiscan2.tier.elite.q4")]}
              receives={[t("aiscan2.tier.elite.receive1"), t("aiscan2.tier.elite.receive2"), t("aiscan2.tier.elite.receive3"), t("aiscan2.tier.elite.receive4")]}
              delivery={t("aiscan2.tier.elite.delivery")}
              price={t("aiscan2.tier.elite.price")}
              cta={t("aiscan2.tier.elite.cta")}
              addonNote={t("aiscan2.tier.elite.addonNote")}
              addons={[{ title: t("aiscan2.tier.elite.addon1.title"), body: t("aiscan2.tier.elite.addon1.body") }]}
              onStart={() => openPurchase("elite")}
            />
          </div>
        </section>

        {/* 07 — WHAT HAPPENS NEXT */}
        <section className="py-16 md:py-20">
          <div className="container max-w-[760px] mx-auto">
            <div className="text-center">
              <Eyebrow>{t("aiscan2.next.eyebrow")}</Eyebrow>
              <h2 className="mt-5 font-display font-semibold text-[26px] md:text-[34px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
                {t("aiscan2.next.title")}
              </h2>
            </div>
            <ol className="mt-12 relative border-l border-white/10 ml-4 space-y-9">
              {[
                { n: "01", title: t("aiscan2.next.step1.title"), body: t("aiscan2.next.step1.body") },
                { n: "02", title: t("aiscan2.next.step2.title"), body: t("aiscan2.next.step2.body") },
                { n: "03", title: t("aiscan2.next.step3.title"), lead: t("aiscan2.next.step3.lead"), body: t("aiscan2.next.step3.body") },
                { n: "04", title: t("aiscan2.next.step4.title"), body: t("aiscan2.next.step4.body") },
                { n: "05", title: t("aiscan2.next.step5.title"), body: t("aiscan2.next.step5.body") },
                { n: "06", title: t("aiscan2.next.step6.title"), body: t("aiscan2.next.step6.body") },
              ].map((s) => (
                <li key={s.n} className="pl-8 relative">
                  <span className="absolute -left-[13px] top-0 grid h-6 w-6 place-items-center rounded-full border border-[var(--color-orange)]/50 bg-[var(--io-bg)] text-[11px] font-semibold text-[var(--color-orange)]">
                    {s.n}
                  </span>
                  <div className="font-display font-semibold text-[15px] text-[var(--color-ivory)]">{s.title}</div>
                  {s.lead && <p className="mt-1 text-[13.5px] font-medium text-[var(--color-ivory)]">{s.lead}</p>}
                  <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--io-text-secondary)]">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* HELP ME CHOOSE */}
        <section className="py-16 md:py-24">
          <div className="container max-w-[600px] mx-auto text-center">
            <Eyebrow>{t("aiscan2.helpChoose.eyebrow")}</Eyebrow>
            <h2 className="mt-5 font-display font-semibold text-[24px] md:text-[30px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("aiscan2.helpChoose.title")}
            </h2>
            <p className="mt-4 text-[14.5px] leading-[1.7] text-[var(--io-text-secondary)]">
              {t("aiscan2.helpChoose.body")}
            </p>
            {IOSKY_PHONE_NUMBER ? (
              <a href={`tel:${IOSKY_PHONE_NUMBER.replace(/[^+\d]/g, "")}`} className="btn-secondary mt-6 inline-flex">
                <Phone className="w-4 h-4" strokeWidth={2} />
                {IOSKY_PHONE_NUMBER}
              </a>
            ) : (
              <p className="mt-6 text-[12.5px] text-[var(--io-text-secondary)]/70 italic">
                {t("aiscan2.helpChoose.cta")} — official number not yet configured (VITE_IOSKY_PHONE_NUMBER).
              </p>
            )}
          </div>
        </section>
      </main>
      <Footer />

      {/* Preview the Assessment — generic illustrative excerpt, not real client data */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg border border-white/10 bg-[var(--card)] text-[var(--color-ivory)] backdrop-blur">
          <DialogHeader>
            <DialogTitle className="font-display text-[18px]">{t("aiscan2.preview.title")}</DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--io-text-secondary)]">
              {t("aiscan2.preview.intro")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-orange)] font-medium">
                {t("aiscan2.preview.finding.label")}
              </div>
              <div className="mt-1 text-[14px] font-semibold text-[var(--color-ivory)]">{t("aiscan2.preview.finding.title")}</div>
              <p className="mt-1 text-[13px] leading-[1.6] text-[var(--io-text-secondary)]">{t("aiscan2.preview.finding.body")}</p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-orange)] font-medium">
                {t("aiscan2.preview.recommendation.label")}
              </div>
              <div className="mt-1 text-[14px] font-semibold text-[var(--color-ivory)]">{t("aiscan2.preview.recommendation.title")}</div>
              <p className="mt-1 text-[13px] leading-[1.6] text-[var(--io-text-secondary)]">{t("aiscan2.preview.recommendation.body")}</p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-orange)] font-medium">
                {t("aiscan2.preview.priority.label")}
              </div>
              <p className="mt-1 text-[13px] text-[var(--color-ivory)]">{t("aiscan2.preview.priority.value")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="btn-secondary mt-5 w-full justify-center"
          >
            <X className="w-4 h-4" strokeWidth={2} />
            {t("aiscan2.preview.close")}
          </button>
        </DialogContent>
      </Dialog>

      {/* Purchase configuration — general info + language + audience, then the
          existing (tested) lead-capture path. See file header re: no Stripe. */}
      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="max-w-md border border-white/10 bg-[var(--card)] text-[var(--color-ivory)] backdrop-blur">
          <DialogHeader>
            <DialogTitle className="text-xs font-semibold tracking-[0.18em] text-[var(--color-orange)]">
              {TIER_DISPLAY[selectedTier].toUpperCase()} SCAN
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--io-text-secondary)]">
              Tell us a little about you before we set up your Scan.
            </DialogDescription>
          </DialogHeader>
          {submitState.kind === "success" ? (
            <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <div className="font-semibold mb-1">Thank you — request received.</div>
              <p className="text-emerald-200/80 text-xs leading-relaxed">
                Our team will be in touch to plan the engagement.
              </p>
              <button
                type="button"
                onClick={() => setPurchaseOpen(false)}
                className="btn-secondary mt-3"
              >
                Close
              </button>
            </div>
          ) : (
            <form
              className="mt-2 space-y-3"
              onSubmit={(e) => {
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
                  preferredLanguage: language,
                  primaryAudience: audience || null,
                });
              }}
            >
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-[var(--io-text-secondary)]/70">Full Name</span>
                <div className="io-control-surface mt-1 flex items-center gap-2 rounded-md px-3 py-2">
                  <User className="h-3.5 w-3.5 opacity-60" />
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-transparent text-sm outline-none placeholder:opacity-40"
                    placeholder="Enter your name"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-[var(--io-text-secondary)]/70">Work Email</span>
                <div className="io-control-surface mt-1 flex items-center gap-2 rounded-md px-3 py-2">
                  <Mail className="h-3.5 w-3.5 opacity-60" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-transparent text-sm outline-none placeholder:opacity-40"
                    placeholder="name@company.com"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-[var(--io-text-secondary)]/70">Company</span>
                <div className="io-control-surface mt-1 flex items-center gap-2 rounded-md px-3 py-2">
                  <Building2 className="h-3.5 w-3.5 opacity-60" />
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full bg-transparent text-sm outline-none placeholder:opacity-40"
                    placeholder="Company name"
                  />
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--io-text-secondary)]/70">Preferred language</span>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="io-control-surface mt-1 h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((l) => (
                        <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--io-text-secondary)]/70">Primary audience</span>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger className="io-control-surface mt-1 h-9 text-[13px]">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_OPTIONS.map((a) => (
                        <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <label className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={acceptedDisclaimer}
                  onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-orange)]"
                />
                <span className="text-[11px] leading-[1.55] text-[var(--io-text-secondary)]">
                  I understand this is an AI-assisted assessment with inherent limitations and accept the{" "}
                  <Link href="/ai-disclaimer" className="text-[var(--color-orange)] hover:underline">AI Disclaimer</Link>{" "}
                  &amp;{" "}
                  <Link href="/privacy" className="text-[var(--color-orange)] hover:underline">Privacy Notice</Link>.
                </span>
              </label>
              {submitState.kind === "error" && (
                <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  {submitState.message}
                </div>
              )}
              <button
                type="submit"
                disabled={!acceptedDisclaimer || submitLead.isPending}
                className="btn-primary mt-2 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock className="h-4 w-4" strokeWidth={2} />
                {submitLead.isPending ? "Submitting…" : "Continue"}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
