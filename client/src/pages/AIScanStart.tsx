/**
 * IO SKY — AI Scan questionnaire intake.
 *
 * Multi-step diagnostic that conforms to shared/aiScanQuestionnaire.ts and
 * shared/aiScanModel.ts. Tier (free | growth | elite) is read from the URL
 * query param `?tier=free|growth|elite` (defaults to free).
 *
 * Flow: tier-aware question count → identity capture → submit. On success,
 * redirects to /ai-scan/result/:token where the result page polls for the
 * scored payload.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { useT } from "@/contexts/LanguageContext";
import {
  AI_SCAN_DIMENSION_LABELS,
  AI_SCAN_TIER_PROFILE,
} from "@shared/aiScanModel";
import type { AiScanQuestion } from "@shared/aiScanQuestionnaire";

type Tier = "free" | "growth" | "elite";

function readTierFromQuery(): Tier {
  if (typeof window === "undefined") return "free";
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tier");
  if (t === "growth" || t === "elite" || t === "free") return t;
  return "free";
}

export default function AIScanStart() {
  const { t } = useT();
  const [, navigate] = useLocation();
  const [tier] = useState<Tier>(readTierFromQuery());
  const profile = AI_SCAN_TIER_PROFILE[tier];

  // Step 0..(questions.length-1) for questions; final step is identity.
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [identity, setIdentity] = useState({
    fullName: "",
    email: "",
    company: "",
    contextNote: "",
    acceptedAiDisclaimer: false,
    website: "", // honeypot
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: questionnaireData, isLoading } =
    trpc.aiScans.getQuestionnaire.useQuery({ tier });
  const questions: AiScanQuestion[] = questionnaireData?.questions ?? [];
  const totalSteps = questions.length + 1; // +1 identity

  const submit = trpc.aiScans.submitQuestionnaire.useMutation();

  const progressValue = useMemo(() => {
    if (totalSteps <= 1) return 0;
    return Math.round((step / (totalSteps - 1)) * 100);
  }, [step, totalSteps]);

  const isQuestionStep = step < questions.length;
  const currentQ = isQuestionStep ? questions[step] : null;
  const currentAnswer = currentQ ? answers[currentQ.id] : null;

  const canAdvance = useMemo(() => {
    if (isQuestionStep) return Boolean(currentAnswer);
    // identity step
    return (
      identity.fullName.trim().length >= 2 &&
      /\S+@\S+\.\S+/.test(identity.email) &&
      identity.company.trim().length > 0 &&
      identity.acceptedAiDisclaimer
    );
  }, [isQuestionStep, currentAnswer, identity]);

  // Persist intermediate progress so an accidental refresh doesn't lose work.
  useEffect(() => {
    try {
      const draft = localStorage.getItem(`iosky.aiScan.draft.${tier}`);
      if (draft) {
        const parsed = JSON.parse(draft) as {
          answers?: Record<string, string>;
          identity?: typeof identity;
          step?: number;
        };
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.identity) setIdentity((prev) => ({ ...prev, ...parsed.identity }));
        if (typeof parsed.step === "number") setStep(parsed.step);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        `iosky.aiScan.draft.${tier}`,
        JSON.stringify({ answers, identity, step }),
      );
    } catch {
      /* ignore */
    }
  }, [tier, answers, identity, step]);

  function handleAnswer(value: string) {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: value }));
  }

  function handleBack() {
    setSubmitError(null);
    if (step > 0) setStep(step - 1);
  }

  function handleNext() {
    setSubmitError(null);
    if (canAdvance) setStep(step + 1);
  }

  async function handleSubmit() {
    setSubmitError(null);
    try {
      const res = await submit.mutateAsync({
        tier,
        fullName: identity.fullName.trim(),
        email: identity.email.trim().toLowerCase(),
        company: identity.company.trim(),
        locale: typeof navigator !== "undefined" ? navigator.language.slice(0, 5) : "en",
        acceptedAiDisclaimer: identity.acceptedAiDisclaimer,
        contextNote: identity.contextNote.trim() || undefined,
        website: identity.website || undefined,
        answers,
      });
      if (res.reportToken) {
        try {
          localStorage.removeItem(`iosky.aiScan.draft.${tier}`);
        } catch {
          /* ignore */
        }
        navigate(`/ai-scan/result/${res.reportToken}`);
      } else {
        setSubmitError(
          t("aiscan.start.errorGeneric") || "Something went wrong. Please try again.",
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t("aiscan.start.errorGeneric") || "Something went wrong. Please try again.";
      setSubmitError(msg);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="container max-w-3xl py-12 md:py-16">
        <header className="mb-8">
          <p className="text-xs font-mono tracking-[0.3em] text-orange-400/80 uppercase">
            {t("aiscan.start.eyebrow") || "AI SCAN"} · {tier.toUpperCase()}
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
            {t("aiscan.start.title") || "Operational diagnostic"}
          </h1>
          <p className="mt-3 text-muted-foreground max-w-prose">
            {t("aiscan.start.subtitle") ||
              `${profile.questionCount} questions · ${profile.dimensionsCovered.length} dimensions · approx. ${
                tier === "elite" ? "12" : tier === "growth" ? "7" : "3"
              } minutes.`}
          </p>
        </header>

        <div className="mb-8">
          <Progress value={progressValue} className="h-1.5" />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("aiscan.start.stepLabel") || "Step"} {Math.min(step + 1, totalSteps)} / {totalSteps}
            </span>
            {isQuestionStep && currentQ ? (
              <span>{AI_SCAN_DIMENSION_LABELS[currentQ.dimension]}</span>
            ) : (
              <span>{t("aiscan.start.identity") || "Your details"}</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-border/60 p-8 text-center text-muted-foreground">
            {t("aiscan.start.loading") || "Loading questionnaire…"}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-xl border border-border/60 bg-card/40 p-6 md:p-8"
            >
              {isQuestionStep && currentQ ? (
                <QuestionStep
                  question={currentQ}
                  value={currentAnswer ?? ""}
                  onChange={handleAnswer}
                />
              ) : (
                <IdentityStep
                  tier={tier}
                  state={identity}
                  onChange={setIdentity}
                />
              )}

              {submitError ? (
                <Alert variant="destructive" className="mt-6">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="mt-8 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={step === 0 || submit.isPending}
                >
                  {t("aiscan.start.back") || "Back"}
                </Button>

                {isQuestionStep ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canAdvance}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {t("aiscan.start.next") || "Next"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canAdvance || submit.isPending}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {submit.isPending
                      ? t("aiscan.start.submitting") || "Generating report…"
                      : t("aiscan.start.submit") || "Generate report"}
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <Footer />
    </div>
  );
}

// ── Step components ─────────────────────────────────────────────────────────

function QuestionStep({
  question,
  value,
  onChange,
}: {
  question: AiScanQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useT();
  const localizedPrompt = t(`aiscan.q.${question.id}`) || question.prompt;
  const helper = question.helper
    ? t(`aiscan.q.${question.id}.helper`) || question.helper
    : null;

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-semibold leading-snug">
        {localizedPrompt}
      </h2>
      {helper ? (
        <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
      ) : null}

      <RadioGroup value={value} onValueChange={onChange} className="mt-6 space-y-3">
        {question.options.map((opt) => {
          const id = `q-${question.id}-${opt.value}`;
          const selected = value === opt.value;
          return (
            <Label
              key={opt.value}
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                selected
                  ? "border-orange-500/70 bg-orange-500/10"
                  : "border-border/60 hover:border-orange-500/40 hover:bg-muted/40"
              }`}
            >
              <RadioGroupItem id={id} value={opt.value} />
              <span className="text-sm md:text-base">{opt.label}</span>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

function IdentityStep({
  tier,
  state,
  onChange,
}: {
  tier: Tier;
  state: {
    fullName: string;
    email: string;
    company: string;
    contextNote: string;
    acceptedAiDisclaimer: boolean;
    website: string;
  };
  onChange: (next: typeof state) => void;
}) {
  const { t } = useT();
  return (
    <div>
      <h2 className="text-xl md:text-2xl font-semibold leading-snug">
        {t("aiscan.start.identityTitle") || "Where should we send your report?"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("aiscan.start.identitySubtitle") ||
          `Your ${tier} report will be ready in a few seconds. We never sell or share your data.`}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ai-fullname">
            {t("aiscan.start.fullName") || "Full name"}
          </Label>
          <Input
            id="ai-fullname"
            value={state.fullName}
            onChange={(e) => onChange({ ...state, fullName: e.target.value })}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-email">{t("aiscan.start.email") || "Work email"}</Label>
          <Input
            id="ai-email"
            type="email"
            value={state.email}
            onChange={(e) => onChange({ ...state, email: e.target.value })}
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="ai-company">{t("aiscan.start.company") || "Company"}</Label>
          <Input
            id="ai-company"
            value={state.company}
            onChange={(e) => onChange({ ...state, company: e.target.value })}
            autoComplete="organization"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="ai-context">
            {t("aiscan.start.context") || "Anything specific we should keep in mind? (optional)"}
          </Label>
          <Textarea
            id="ai-context"
            value={state.contextNote}
            onChange={(e) =>
              onChange({ ...state, contextNote: e.target.value.slice(0, 1500) })
            }
            rows={3}
          />
        </div>
        {/* honeypot — hidden from real users */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={state.website}
          onChange={(e) => onChange({ ...state, website: e.target.value })}
          aria-hidden="true"
          style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0 }}
        />
        <div className="md:col-span-2 flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
          <Checkbox
            id="ai-disclaimer"
            checked={state.acceptedAiDisclaimer}
            onCheckedChange={(v) =>
              onChange({ ...state, acceptedAiDisclaimer: Boolean(v) })
            }
          />
          <Label htmlFor="ai-disclaimer" className="text-sm leading-snug cursor-pointer">
            {t("aiscan.start.disclaimer") ||
              "I understand the IO SKY AI Disclaimer: AI-assisted output is indicative and not a substitute for professional advisory."}
          </Label>
        </div>
      </div>
    </div>
  );
}
