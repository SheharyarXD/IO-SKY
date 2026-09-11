/**
 * IO SKY — Book Discovery Call (10/10 Refinement)
 *
 * Premium 3-column executive booking environment with a 4-step wizard
 * (Service → Date & Time → Details → Confirm). Built to feel like a strategic
 * operational onboarding flow, NOT a Calendly clone.
 *
 * Design language: deep navy-black, restrained orange (#FF7A00), cinematic
 * spacing, JetBrains Mono eyebrows, Space Grotesk display, Inter body.
 * Globe asset reused from the Login Portal to keep atmospheric consistency.
 *
 * Functional behaviour:
 *  - Multi-step wizard with localStorage persistence
 *  - Smart preparation questions adapt to consultation type
 *  - Cinematic confirmation state with .ics download + optional AI Scan CTA
 *  - Honeypot + 8s rate-limit (anti-spam)
 *  - Future-ready: dispatches `iosky:booking.created` CustomEvent so a backend
 *    upgrade can pick it up later.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  Clock,
  Download,
  Sparkles,
  ShieldCheck,
  Lock,
  Crown,
  Star,
  UserRound,
  Target,
  Lightbulb,
  Rocket,
  Compass,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCheck,
  Quote,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { resolveSiteImage } from "@/lib/siteImages";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";
import { useT as useLanguageContext } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

/* ------------------------------------------------------------------ */
/* Static asset URLs                                                  */
/* ------------------------------------------------------------------ */
/*
 * Decorative background visual. Resolved through the central registry
 * (client/src/lib/siteImages.ts) and null until a replacement is supplied —
 * the original pointed at the Manus/Forge CDN, which now 403s for every asset.
 *
 * Null is handled at the use site by omitting backgroundImage entirely, rather
 * than emitting url(null) and having the browser fetch a URL that cannot load.
 */
const GLOBE_IMG = resolveSiteImage("login.globe");

/* ------------------------------------------------------------------ */
/* Localised label helper                                              */
/* ------------------------------------------------------------------ */
function useT() {
  const ctx = useLanguageContext();
  return (key: string, fallback: string) => {
    const v = ctx.t(key);
    return v === key ? fallback : v;
  };
}

/* ------------------------------------------------------------------ */
/* Consultation types                                                  */
/* ------------------------------------------------------------------ */
type ServiceId = "discovery" | "growth" | "elite";

interface Service {
  id: ServiceId;
  icon: typeof UserRound;
  title: string;
  duration: string;
  body: string;
  highlighted?: boolean;
}

const SERVICES: Service[] = [
  {
    id: "discovery",
    icon: UserRound,
    title: "Executive Discovery Call",
    duration: "30 min",
    body: "High-level insights & strategic direction.",
  },
  {
    id: "growth",
    icon: Star,
    title: "Strategic Growth Session",
    duration: "60 min",
    body: "Deep-dive into growth, risks & opportunities.",
    highlighted: true,
  },
  {
    id: "elite",
    icon: Crown,
    title: "Elite Strategy Workshop",
    duration: "90 min",
    body: "Executive-level planning & custom roadmap.",
  },
];

/* ------------------------------------------------------------------ */
/* Time slots                                                          */
/* ------------------------------------------------------------------ */
/**
 * Fallback time grid used only before the backend has responded with the
 * authoritative list of available slots. Once the native booking adapter
 * returns `listSlots`, the UI switches to those (timezone-localised) values.
 */
const FALLBACK_SLOTS = ["09:00", "10:30", "13:00", "14:30", "16:00", "17:30"] as const;

/** Convert a UTC ms instant to an `HH:MM` label in the visitor's timezone. */
function toLocalTimeLabel(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

/** Returns yyyy-mm-dd (in the supplied timezone) so we can group slots per day. */
function toLocalDateKey(ms: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isSameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function isPast(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}
function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}
function buildIcs(
  date: Date,
  time: string,
  durationMin: number,
  name: string,
  email: string,
  org: string,
  topic: string,
): string {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(date);
  start.setHours(h, m, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `iosky-${Date.now()}@io-sky.io`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IO SKY//Discovery Call//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    "SUMMARY:IO SKY Discovery Call",
    `DESCRIPTION:Strategic consultation with an IO SKY operating partner.\\n\\nAttendee: ${name} <${email}>\\nOrganisation: ${org}${topic ? `\\nFocus: ${topic}` : ""}`,
    "LOCATION:Secure online room — link sent by email.",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
function downloadIcs(content: string, name: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* localStorage helpers                                                */
/* ------------------------------------------------------------------ */
const QUEUE_KEY = "io-sky.booking.queue";
const DRAFT_KEY = "io-sky.booking.draft";

interface DraftState {
  serviceId: ServiceId;
  selectedISO: string | null;
  selectedTime: string;
  fullName: string;
  workEmail: string;
  organisation: string;
  role: string;
  /**
   * Required on the Discovery Call, deliberately absent from the Contact
   * form. A discovery call is a scheduled telephone or video conversation,
   * so a number is data we actually need to deliver the thing being booked;
   * a general contact enquiry is answered by email and collecting a number
   * there would be more data than the purpose justifies.
   */
  phone: string;
  challenge: string;
  maturity: string;
  goals: string;
  automation: string;
  scanId: string;
  companySize: string;
  systems: string;
  bottlenecks: string;
  consent: boolean;
}

const DEFAULT_DRAFT: DraftState = {
  serviceId: "growth",
  selectedISO: null,
  selectedTime: "10:30",
  fullName: "",
  workEmail: "",
  organisation: "",
  role: "",
  phone: "",
  challenge: "",
  maturity: "",
  goals: "",
  automation: "",
  scanId: "",
  companySize: "",
  systems: "",
  bottlenecks: "",
  consent: false,
};

/* ------------------------------------------------------------------ */
/* Reusable UI primitives                                              */
/* ------------------------------------------------------------------ */
function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[20px] border border-white/[0.07] bg-[#0B0E16]/85 backdrop-blur-sm",
        "shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StepDot({
  active,
  done,
  icon: Icon,
  label,
}: {
  active: boolean;
  done: boolean;
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center min-w-0 flex-1">
      <div
        className={cn(
          "h-11 w-11 rounded-full grid place-items-center border transition-colors duration-200",
          done && "border-[#FF7A00]/60 bg-[#FF7A00]/10 text-[#FF7A00]",
          active && !done && "border-[#FF7A00] bg-[#FF7A00] text-[#0A0B10] shadow-[0_0_24px_rgba(255, 122, 0,0.45)]",
          !active && !done && "border-white/10 bg-white/[0.02] text-white/45",
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div
        className={cn(
          "mt-2 text-[11px] tracking-[0.18em] uppercase font-mono",
          active ? "text-[#FF7A00]" : done ? "text-white/60" : "text-white/35",
        )}
      >
        {label}
      </div>
    </div>
  );
}

function StepConnector({ filled }: { filled: boolean }) {
  return (
    <div className="flex-1 h-px self-start mt-[22px] mx-1">
      <div
        className={cn(
          "h-px w-full transition-colors",
          filled ? "bg-[#FF7A00]/60" : "bg-white/10",
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export default function BookStrategy() {
  const t = useT();
  const { lang } = useLanguageContext();

  /* ---------- Smooth-scroll-friendly mount ---------- */
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, []);

  /* ---------- Optional ?topic= prefill (used by client portal
     recommendation “Discuss on Discovery Call” action) ---------- */
  const prefillTopic = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const topicParam = params.get("topic");
      return topicParam && topicParam.trim().length > 0 ? topicParam.trim() : null;
    } catch {
      return null;
    }
  }, []);

  /* ---------- Wizard step ---------- */
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const mountedAt = useRef(Date.now());

  /* ---------- Draft state (persists across reloads) ---------- */
  const [draft, setDraft] = useState<DraftState>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftState;
        return { ...DEFAULT_DRAFT, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_DRAFT;
  });

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);

  // If we arrived from the client portal with ?topic=..., seed the prep
  // “challenge” field so the call brief is already framed by the rec.
  // We only do this once on mount and only when the field is empty so we
  // never overwrite something the user typed previously.
  useEffect(() => {
    if (!prefillTopic) return;
    setDraft(p =>
      p.challenge.trim().length === 0 ? { ...p, challenge: prefillTopic } : p,
    );
  }, [prefillTopic]);

  /* ---------- Honeypot ---------- */
  const honeypotRef = useRef<HTMLInputElement | null>(null);

  /* ---------- Computed values ---------- */
  const service = useMemo(
    () => SERVICES.find((s) => s.id === draft.serviceId) ?? SERVICES[1],
    [draft.serviceId],
  );
  const durationMin = useMemo(() => {
    if (service.id === "discovery") return 30;
    if (service.id === "growth") return 60;
    return 90;
  }, [service.id]);

  const selectedDate = useMemo(
    () => (draft.selectedISO ? new Date(draft.selectedISO) : null),
    [draft.selectedISO],
  );

  /* ---------- Calendar state ---------- */
  const [calMonth, setCalMonth] = useState<Date>(() => startOfMonth(new Date()));

  function calendarCells(month: Date) {
    const first = startOfMonth(month);
    const firstDay = first.getDay() === 0 ? 6 : first.getDay() - 1; // Monday-first
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    for (let d = 1; d <= last.getDate(); d++) {
      days.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    while (days.length % 7 !== 0) days.push(null);
    while (days.length < 42) days.push(null);
    return days;
  }

  const monthLabel = useMemo(
    () =>
      calMonth.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      }),
    [calMonth],
  );

  const timezoneLabel = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";
    } catch {
      return "Europe/Amsterdam";
    }
  }, []);

  /* ---------- Live availability (native adapter) ---------- */
  const availabilityRange = useMemo(() => {
    const start = startOfMonth(calMonth).getTime();
    const end = startOfMonth(addMonths(calMonth, 1)).getTime();
    return { rangeStartMs: start, rangeEndMs: end };
  }, [calMonth]);

  const slotsQuery = trpc.bookings.listSlots.useQuery(
    {
      consultationType: service.id,
      rangeStartMs: availabilityRange.rangeStartMs,
      rangeEndMs: availabilityRange.rangeEndMs,
      timezone: timezoneLabel,
    },
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );

  /** All available start instants returned by the adapter for the visible month. */
  const availableStartsMs = useMemo(
    () => (slotsQuery.data ?? []).map((s) => s.startMs),
    [slotsQuery.data],
  );

  /** Available start times for the currently selected day, in the visitor TZ. */
  const slotsForSelectedDay = useMemo(() => {
    if (!draft.selectedISO) return [] as { ms: number; label: string }[];
    const dayKey = toLocalDateKey(new Date(draft.selectedISO).getTime(), timezoneLabel);
    return availableStartsMs
      .filter((ms) => toLocalDateKey(ms, timezoneLabel) === dayKey)
      .map((ms) => ({ ms, label: toLocalTimeLabel(ms, timezoneLabel) }));
  }, [availableStartsMs, draft.selectedISO, timezoneLabel]);

  /** Days in the visible month that have at least one available slot. */
  const availableDayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const ms of availableStartsMs) set.add(toLocalDateKey(ms, timezoneLabel));
    return set;
  }, [availableStartsMs, timezoneLabel]);

  // When the user changes the selected day, default selectedTime to the first
  // truly available time for that day so the wizard's "continue" gate works.
  useEffect(() => {
    if (!draft.selectedISO) return;
    if (slotsForSelectedDay.length === 0) return;
    const stillValid = slotsForSelectedDay.some((s) => s.label === draft.selectedTime);
    if (!stillValid) {
      setDraft((p) => ({ ...p, selectedTime: slotsForSelectedDay[0].label }));
    }
  }, [slotsForSelectedDay, draft.selectedISO, draft.selectedTime]);

  /* ---------- Validation per step ---------- */
  const canAdvance = useMemo(() => {
    if (step === 1) return Boolean(service);
    if (step === 2) return Boolean(draft.selectedISO && draft.selectedTime);
    if (step === 3) {
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.workEmail);
      return (
        draft.fullName.trim().length >= 2 &&
        validEmail &&
        draft.organisation.trim().length >= 2 &&
        draft.role.trim().length >= 2 &&
        // Digits only, so "+31 6 1234 5678" and "0031612345678" both pass but
        // a placeholder like "n/a" does not.
        draft.phone.replace(/[^0-9]/g, "").length >= 7 &&
        draft.challenge.trim().length >= 8 &&
        draft.consent
      );
    }
    return false;
  }, [step, draft, service]);

  /* ---------- Confirm ---------- */
  const createBooking = trpc.bookings.create.useMutation();
  const [publicRef, setPublicRef] = useState<string | null>(null);

  async function handleConfirm() {
    if (honeypotRef.current?.value) {
      toast.error("Submission blocked", {
        description: "Automated activity detected.",
      });
      return;
    }
    if (Date.now() - mountedAt.current < 8000) {
      toast.warning("Take a moment", {
        description: "Please review your details before confirming.",
      });
      return;
    }
    if (!draft.selectedISO) return;

    setSubmitting(true);
    try {
      // Prefer the authoritative slot ms returned by the backend; only fall
      // back to client-side composition if the live query hasn't responded.
      const authoritative = slotsForSelectedDay.find(
        (s) => s.label === draft.selectedTime,
      );
      let slotStartMs: number;
      if (authoritative) {
        slotStartMs = authoritative.ms;
      } else {
        const [hh, mm] = draft.selectedTime.split(":").map((n) => parseInt(n, 10));
        const slotStart = new Date(draft.selectedISO);
        slotStart.setHours(hh, mm, 0, 0);
        slotStartMs = slotStart.getTime();
      }

      // Local fallback payload (kept so an offline retry queue still works)
      const fallbackPayload = {
        id: `bk_${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        service: {
          id: service.id,
          title: service.title,
          durationMin,
        },
        scheduledFor: {
          dateISO: draft.selectedISO,
          time: draft.selectedTime,
          timezone: timezoneLabel,
        },
        attendee: {
          fullName: draft.fullName.trim(),
          workEmail: draft.workEmail.trim(),
          organisation: draft.organisation.trim(),
          role: draft.role.trim(),
          phone: draft.phone.trim(),
        },
        preparation: {
          challenge: draft.challenge.trim(),
          maturity: draft.maturity,
          goals: draft.goals.trim(),
          automation: draft.automation.trim(),
          scanId: draft.scanId.trim(),
          companySize: draft.companySize,
          systems: draft.systems.trim(),
          bottlenecks: draft.bottlenecks.trim(),
        },
        source: "io-sky.web.book-strategy",
      };

      try {
        const result = await createBooking.mutateAsync({
          serviceId: service.id as "discovery" | "growth" | "elite",
          slotStartMs,
          timezone: timezoneLabel,
          fullName: draft.fullName.trim(),
          email: draft.workEmail.trim(),
          company: draft.organisation.trim() || null,
          role: draft.role.trim() || null,
          phone: draft.phone.trim(),
          preparation: {
            challenge: draft.challenge.trim(),
            maturity: draft.maturity,
            goals: draft.goals.trim(),
            automation: draft.automation.trim(),
            scanId: draft.scanId.trim(),
            companySize: draft.companySize,
            systems: draft.systems.trim(),
            bottlenecks: draft.bottlenecks.trim(),
          },
          locale: lang,
        });
        setPublicRef(result.publicRef);
        toast.success("Strategy call confirmed", {
          description: `Reference ${result.publicRef} · A calendar invite is on its way to ${draft.workEmail.trim()}.`,
        });
      } catch (error) {
        // Backend unreachable → queue locally and still complete the UX so the
        // visitor isn't stranded. An admin-side reconciler can drain the queue.
        console.warn("[BookStrategy] Live booking failed, falling back:", error);
        try {
          const existing = JSON.parse(
            localStorage.getItem(QUEUE_KEY) || "[]",
          );
          existing.push(fallbackPayload);
          localStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
        } catch {
          // ignore
        }
        window.dispatchEvent(
          new CustomEvent("iosky:booking.created", { detail: fallbackPayload }),
        );
        toast.warning("Saved offline", {
          description:
            "We couldn't reach the server right now. Your booking is safely queued — our team will follow up by email.",
        });
      }

      setDone(true);
      setStep(4);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownloadIcs() {
    if (!selectedDate) return;
    const ics = buildIcs(
      selectedDate,
      draft.selectedTime,
      durationMin,
      draft.fullName,
      draft.workEmail,
      draft.organisation,
      service.title,
    );
    downloadIcs(ics, `io-sky-${service.id}-${selectedDate.toISOString().slice(0, 10)}-${draft.selectedTime.replace(":", "")}`);
  }

  function resetBooking() {
    setDone(false);
    setStep(1);
    setDraft(DEFAULT_DRAFT);
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <div className="relative min-h-screen bg-[#040508] text-[#E6EAF0] overflow-x-hidden">
      {/* Atmospheric backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(900px 600px at 12% 92%, rgba(255, 122, 0,0.07), transparent 60%), radial-gradient(700px 500px at 88% 18%, rgba(0,180,255,0.04), transparent 65%), #040508",
        }}
      />
      <Navbar />

      <main className="relative z-[1]">
        <div className="container pt-8 md:pt-12 pb-16">
          <div className="grid lg:grid-cols-[1fr_1.55fr_1fr] gap-7 xl:gap-9 items-start">
            {/* ============================================== */}
            {/* LEFT — hero, benefit pills, globe, quote        */}
            {/* ============================================== */}
            <section className="relative min-h-[560px]">
              {/* Globe — cinematic, anchored bottom-left */}
              <div
                aria-hidden
                className="pointer-events-none absolute hidden lg:block"
                style={{
                  left: "-30%",
                  bottom: "-12%",
                  width: "150%",
                  height: "78%",
                  ...(GLOBE_IMG ? { backgroundImage: `url(${GLOBE_IMG})` } : {}),
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "contain",
                  backgroundPosition: "left bottom",
                  opacity: 0.78,
                  maskImage:
                    "radial-gradient(ellipse 80% 70% at 22% 92%, #000 35%, rgba(0,0,0,0.55) 60%, transparent 88%)",
                  WebkitMaskImage:
                    "radial-gradient(ellipse 80% 70% at 22% 92%, #000 35%, rgba(0,0,0,0.55) 60%, transparent 88%)",
                  filter: "saturate(1.05) brightness(0.95)",
                }}
              />

              <div className="relative">
                <div className="font-mono text-[11px] tracking-[0.24em] uppercase text-[#FF7A00]">
                  {t("book.eyebrow", "Book your discovery call")}
                </div>
                <h1 className="mt-3 font-display font-semibold text-[34px] md:text-[44px] xl:text-[50px] leading-[1.05] tracking-[-0.022em]">
                  {t("book.hero.line1", "Let’s build your")}{" "}
                  <span className="block">{t("book.hero.line2", "operational")}</span>
                  <span className="text-[#FF7A00]">{t("book.hero.line3", "advantage.")}</span>
                </h1>
                <p className="mt-5 text-[15px] leading-[1.65] text-white/65 max-w-[460px]">
                  {t(
                    "book.hero.sub",
                    "A strategic consultation with our operating partners — uncover bottlenecks, validate AI opportunities and define the smartest next steps for your business.",
                  )}
                </p>

                {/* Benefit pills */}
                <div className="mt-7 grid grid-cols-4 gap-2.5 max-w-[460px]">
                  {[
                    { icon: Target, label: "Strategic\nClarity" },
                    { icon: Lightbulb, label: "Growth\nOpportunities" },
                    { icon: ShieldCheck, label: "Risk\nMitigation" },
                    { icon: Rocket, label: "Actionable\nRoadmap" },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="rounded-[14px] border border-white/[0.07] bg-white/[0.02] p-3 text-center hover:border-[#FF7A00]/30 transition-colors"
                    >
                      <div className="h-9 w-9 mx-auto rounded-full grid place-items-center border border-[#FF7A00]/40 bg-[#FF7A00]/10 text-[#FF7A00]">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="mt-2 text-[11px] leading-tight text-white/75 whitespace-pre-line">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quote */}
                <div className="mt-10 rounded-[16px] border border-white/[0.07] bg-[#0B0E16]/85 backdrop-blur-sm p-5 max-w-[460px]">
                  <Quote className="w-4 h-4 text-[#FF7A00]" />
                  <p className="mt-2 font-display text-[17px] leading-snug text-white/90">
                    {t(
                      "book.quote.line1",
                      "We don’t just advise. We architect operational excellence.",
                    )}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase font-mono text-[#FF7A00]">
                    <span className="h-px w-6 bg-[#FF7A00]" /> IO SKY
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================== */}
            {/* CENTER — booking wizard                          */}
            {/* ============================================== */}
            <section className="relative">
              <GlassCard className="p-6 md:p-8">
                {/* Step header */}
                <div className="flex items-center">
                  <StepDot
                    icon={CalendarDays}
                    label="1. Service"
                    active={step === 1}
                    done={step > 1}
                  />
                  <StepConnector filled={step > 1} />
                  <StepDot
                    icon={Clock}
                    label="2. Date & Time"
                    active={step === 2}
                    done={step > 2}
                  />
                  <StepConnector filled={step > 2} />
                  <StepDot
                    icon={ClipboardList}
                    label="3. Details"
                    active={step === 3}
                    done={step > 3}
                  />
                  <StepConnector filled={step > 3 || done} />
                  <StepDot
                    icon={CheckCheck}
                    label="4. Confirm"
                    active={step === 4}
                    done={done}
                  />
                </div>

                <div className="mt-6 min-h-[420px]">
                  {/* ============================================== */}
                  {/* STEP 1 — Choose discovery call                   */}
                  {/* ============================================== */}
                  {step === 1 && (
                    <div>
                      <h2 className="text-center font-display text-[22px] md:text-[26px] tracking-[-0.015em]">
                        1. Choose Your Discovery Call
                      </h2>
                      <p className="text-center text-[13px] text-white/55 mt-1.5">
                        Select the consultation that fits your goals.
                      </p>

                      <div className="mt-7 grid sm:grid-cols-3 gap-4">
                        {SERVICES.map((svc) => {
                          const Icon = svc.icon;
                          const active = draft.serviceId === svc.id;
                          return (
                            <button
                              key={svc.id}
                              type="button"
                              onClick={() =>
                                setDraft((p) => ({ ...p, serviceId: svc.id }))
                              }
                              className={cn(
                                "relative text-left rounded-[18px] border p-5 transition-all duration-200",
                                "bg-[#0E121B]/85 hover:-translate-y-0.5",
                                active
                                  ? "border-[#FF7A00]/80 shadow-[0_24px_80px_-30px_rgba(255, 122, 0,0.55),0_0_0_1px_rgba(255, 122, 0,0.45)_inset]"
                                  : "border-white/[0.07] hover:border-[#FF7A00]/35",
                              )}
                            >
                              {/* MOST CHOSEN ribbon for highlighted service */}
                              {svc.highlighted && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#FF7A00] text-[#0A0B10] text-[10px] tracking-[0.22em] uppercase font-semibold shadow-[0_8px_24px_rgba(255, 122, 0,0.45)]">
                                  Most chosen
                                </div>
                              )}
                              {/* Check tick */}
                              {active && (
                                <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-[#FF7A00] grid place-items-center">
                                  <CheckCircle2 className="w-4 h-4 text-[#0A0B10]" />
                                </div>
                              )}
                              <div className="h-12 w-12 rounded-full grid place-items-center border border-[#FF7A00]/40 bg-[#FF7A00]/10 text-[#FF7A00] mx-auto">
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="mt-3 text-center font-display text-[17px] tracking-[-0.01em]">
                                {svc.title}
                              </div>
                              <div className="mt-2 text-center text-[11px] tracking-[0.22em] uppercase font-mono text-white/55">
                                {svc.duration}
                              </div>
                              <p className="mt-3 text-center text-[13px] leading-relaxed text-white/65">
                                {svc.body}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-8 flex items-center justify-between">
                        <Link
                          to="/"
                          className="text-[13px] text-white/55 hover:text-[#FF7A00] transition-colors"
                        >
                          ← Cancel and return home
                        </Link>
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FF7A00] hover:bg-[#FF5500] text-[#0A0B10] font-semibold text-[14px] tracking-[-0.005em] transition-colors"
                        >
                          Continue
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ============================================== */}
                  {/* STEP 2 — Date & Time                            */}
                  {/* ============================================== */}
                  {step === 2 && (
                    <div>
                      <h2 className="text-center font-display text-[22px] md:text-[26px] tracking-[-0.015em]">
                        2. Select Date & Time
                      </h2>
                      <p className="text-center text-[12.5px] text-white/55 mt-1.5">
                        All times in your local timezone ({timezoneLabel}).
                      </p>

                      <div className="mt-6 grid md:grid-cols-[1.4fr_1fr] gap-5">
                        {/* Calendar */}
                        <div className="rounded-[18px] border border-white/[0.07] bg-[#0E121B]/85 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-display text-[16px]">
                              {monthLabel}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label="Previous month"
                                className="h-8 w-8 rounded-full border border-white/10 grid place-items-center hover:border-[#FF7A00]/40 hover:text-[#FF7A00] transition-colors"
                                onClick={() =>
                                  setCalMonth((m) => addMonths(m, -1))
                                }
                                disabled={
                                  calMonth.getFullYear() <= new Date().getFullYear() &&
                                  calMonth.getMonth() <= new Date().getMonth()
                                }
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Next month"
                                className="h-8 w-8 rounded-full border border-white/10 grid place-items-center hover:border-[#FF7A00]/40 hover:text-[#FF7A00] transition-colors"
                                onClick={() =>
                                  setCalMonth((m) => addMonths(m, 1))
                                }
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Day headers */}
                          <div className="grid grid-cols-7 text-[10px] font-mono tracking-[0.24em] uppercase text-white/40 text-center mb-2">
                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                              (d) => (
                                <div key={d}>{d}</div>
                              ),
                            )}
                          </div>

                          {/* Days */}
                          <div className="grid grid-cols-7 gap-1.5">
                            {calendarCells(calMonth).map((d, i) => {
                              if (!d)
                                return (
                                  <div
                                    key={`empty-${i}`}
                                    className="h-9 w-full"
                                  />
                                );
                              const dayKey = toLocalDateKey(d.getTime(), timezoneLabel);
                              const hasAvailability = availableDayKeys.has(dayKey);
                              const disabled = isPast(d) || isWeekend(d) || !hasAvailability;
                              const selected = isSameDay(d, selectedDate);
                              return (
                                <button
                                  key={d.toISOString()}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() =>
                                    setDraft((p) => ({
                                      ...p,
                                      selectedISO: d.toISOString(),
                                    }))
                                  }
                                  className={cn(
                                    "h-9 rounded-full text-[13px] tabular-nums transition-colors",
                                    selected &&
                                      "bg-[#FF7A00] text-[#0A0B10] font-semibold shadow-[0_0_24px_rgba(255, 122, 0,0.45)]",
                                    !selected && !disabled &&
                                      "text-white/80 hover:bg-white/[0.05] hover:text-[#FF7A00]",
                                    disabled && "text-white/20 cursor-not-allowed",
                                  )}
                                >
                                  {d.getDate()}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Time slots */}
                        <div className="rounded-[18px] border border-white/[0.07] bg-[#0E121B]/85 p-4">
                          <div className="font-mono text-[10px] tracking-[0.24em] uppercase text-white/45 mb-3">
                            Available slots
                          </div>
                          <div className="flex flex-col gap-2">
                            {slotsQuery.isLoading && (
                              <div className="text-[12px] text-white/40 font-mono">Loading availability…</div>
                            )}
                            {!slotsQuery.isLoading && slotsForSelectedDay.length === 0 && (
                              <div className="text-[12px] text-white/55 leading-relaxed">
                                No availability on this day. {!selectedDate ? "Pick a date to see open slots." : "Please choose another date."}
                              </div>
                            )}
                            {(slotsForSelectedDay.length > 0
                              ? slotsForSelectedDay
                              : []
                            ).map((slot) => {
                              const active = draft.selectedTime === slot.label;
                              return (
                                <button
                                  key={slot.ms}
                                  type="button"
                                  onClick={() =>
                                    setDraft((p) => ({
                                      ...p,
                                      selectedTime: slot.label,
                                    }))
                                  }
                                  className={cn(
                                    "flex items-center gap-3 px-4 h-11 rounded-full border transition-all duration-200",
                                    active
                                      ? "border-[#FF7A00] bg-[#FF7A00] text-[#0A0B10] font-semibold shadow-[0_12px_30px_-12px_rgba(255, 122, 0,0.6)]"
                                      : "border-white/10 bg-white/[0.02] text-white/80 hover:border-[#FF7A00]/40 hover:text-[#FF7A00]",
                                  )}
                                >
                                  <Clock
                                    className={cn(
                                      "w-4 h-4",
                                      active ? "text-[#0A0B10]" : "text-[#FF7A00]",
                                    )}
                                  />
                                  <span className="text-[14px] tabular-nums">
                                    {slot.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="inline-flex items-center gap-2 text-[13px] text-white/65 hover:text-[#FF7A00] transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                          type="button"
                          disabled={!canAdvance}
                          onClick={() => setStep(3)}
                          className={cn(
                            "inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold transition-colors",
                            canAdvance
                              ? "bg-[#FF7A00] hover:bg-[#FF5500] text-[#0A0B10]"
                              : "bg-white/[0.05] text-white/35 cursor-not-allowed",
                          )}
                        >
                          Continue
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ============================================== */}
                  {/* STEP 3 — Details                                */}
                  {/* ============================================== */}
                  {step === 3 && (
                    <div>
                      <h2 className="text-center font-display text-[22px] md:text-[26px] tracking-[-0.015em]">
                        3. Share Your Details
                      </h2>
                      <p className="text-center text-[12.5px] text-white/55 mt-1.5">
                        Operational context helps us prepare a focused conversation.
                      </p>

                      {/* Honeypot */}
                      <input
                        ref={honeypotRef}
                        type="text"
                        name="company_url"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="absolute opacity-0 -z-10 h-0 w-0"
                      />

                      <div className="mt-6 grid md:grid-cols-2 gap-4">
                        <Field
                          label="Full name *"
                          placeholder="Your full name"
                          value={draft.fullName}
                          onChange={(v) =>
                            setDraft((p) => ({ ...p, fullName: v }))
                          }
                        />
                        <Field
                          label="Work email *"
                          type="email"
                          placeholder="you@company.com"
                          value={draft.workEmail}
                          onChange={(v) =>
                            setDraft((p) => ({ ...p, workEmail: v }))
                          }
                        />
                        <Field
                          label="Organisation *"
                          placeholder="Your company"
                          value={draft.organisation}
                          onChange={(v) =>
                            setDraft((p) => ({ ...p, organisation: v }))
                          }
                        />
                        <Field
                          label="Role *"
                          placeholder="CEO, COO, Head of Ops…"
                          value={draft.role}
                          onChange={(v) => setDraft((p) => ({ ...p, role: v }))}
                        />
                        <Field
                          label="Telephone *"
                          type="tel"
                          placeholder="+31 6 12 34 56 78"
                          value={draft.phone}
                          onChange={(v) => setDraft((p) => ({ ...p, phone: v }))}
                        />
                      </div>

                      {/* Adaptive preparation questions */}
                      <div className="mt-7">
                        <div className="text-[11px] font-mono tracking-[0.24em] uppercase text-[#FF7A00] mb-3">
                          Preparation questions
                        </div>

                        <div className="grid gap-4">
                          <Textarea
                            label="Biggest operational challenge *"
                            placeholder="What slows your team down today?"
                            value={draft.challenge}
                            onChange={(v) =>
                              setDraft((p) => ({ ...p, challenge: v }))
                            }
                          />

                          {service.id === "growth" && (
                            <>
                              <Select
                                label="Current infrastructure maturity"
                                value={draft.maturity}
                                onChange={(v) =>
                                  setDraft((p) => ({ ...p, maturity: v }))
                                }
                                options={[
                                  { value: "", label: "Select level…" },
                                  { value: "early", label: "Early — mostly manual" },
                                  { value: "scaling", label: "Scaling — first automations" },
                                  { value: "mature", label: "Mature — multi-system stack" },
                                  { value: "advanced", label: "Advanced — integrated platform" },
                                ]}
                              />
                              <Textarea
                                label="Scalability goals"
                                placeholder="What outcome would success look like in 12 months?"
                                value={draft.goals}
                                onChange={(v) =>
                                  setDraft((p) => ({ ...p, goals: v }))
                                }
                              />
                              <Textarea
                                label="Automation goals"
                                placeholder="Which workflows should run themselves?"
                                value={draft.automation}
                                onChange={(v) =>
                                  setDraft((p) => ({ ...p, automation: v }))
                                }
                              />
                            </>
                          )}

                          {service.id === "discovery" && (
                            <Textarea
                              label="What operational bottlenecks should we focus on?"
                              placeholder="A few sentences are enough — we will dig in on the call."
                              value={draft.bottlenecks}
                              onChange={(v) =>
                                setDraft((p) => ({ ...p, bottlenecks: v }))
                              }
                            />
                          )}

                          {service.id === "elite" && (
                            <>
                              <Select
                                label="Company size"
                                value={draft.companySize}
                                onChange={(v) =>
                                  setDraft((p) => ({ ...p, companySize: v }))
                                }
                                options={[
                                  { value: "", label: "Select size…" },
                                  { value: "1-10", label: "1–10 employees" },
                                  { value: "11-50", label: "11–50 employees" },
                                  { value: "51-200", label: "51–200 employees" },
                                  { value: "201-1000", label: "201–1000 employees" },
                                  { value: "1000+", label: "1000+ employees" },
                                ]}
                              />
                              <Textarea
                                label="Current systems & stack"
                                placeholder="Briefly list CRM / ERP / data / automation tools you operate today."
                                value={draft.systems}
                                onChange={(v) =>
                                  setDraft((p) => ({ ...p, systems: v }))
                                }
                              />
                            </>
                          )}

                          <Field
                            label="AI Scan report ID (optional)"
                            placeholder="Paste your AI Scan reference if you already completed one."
                            value={draft.scanId}
                            onChange={(v) =>
                              setDraft((p) => ({ ...p, scanId: v }))
                            }
                          />
                        </div>
                      </div>

                      {/* Consent */}
                      <label className="mt-6 flex items-start gap-3 cursor-pointer select-none">
                        <span
                          className={cn(
                            "mt-0.5 h-5 w-5 rounded-md border grid place-items-center transition-colors",
                            draft.consent
                              ? "bg-[#FF7A00] border-[#FF7A00] text-[#0A0B10]"
                              : "border-white/15 bg-white/[0.03]",
                          )}
                        >
                          {draft.consent && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={draft.consent}
                          onChange={(e) =>
                            setDraft((p) => ({ ...p, consent: e.target.checked }))
                          }
                        />
                        <span className="text-[13px] leading-snug text-white/65">
                          I accept the{" "}
                          <Link to="/terms" className="text-[#FF7A00] hover:underline">
                            Terms of Service
                          </Link>{" "}
                          and consent to IO SKY processing this information to prepare and
                          deliver the discovery call, in line with the{" "}
                          <Link to="/privacy" className="text-[#FF7A00] hover:underline">
                            Privacy Notice
                          </Link>
                          .
                        </span>
                      </label>

                      <div className="mt-8 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="inline-flex items-center gap-2 text-[13px] text-white/65 hover:text-[#FF7A00] transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                          type="button"
                          disabled={!canAdvance || submitting}
                          onClick={handleConfirm}
                          className={cn(
                            "inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold transition-colors",
                            canAdvance && !submitting
                              ? "bg-[#FF7A00] hover:bg-[#FF5500] text-[#0A0B10]"
                              : "bg-white/[0.05] text-white/35 cursor-not-allowed",
                          )}
                        >
                          {submitting ? "Securing your slot…" : "Confirm & Book"}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ============================================== */}
                  {/* STEP 4 — Confirmation                            */}
                  {/* ============================================== */}
                  {step === 4 && (
                    <div className="text-center">
                      <div className="relative inline-grid place-items-center">
                        <div
                          aria-hidden
                          className="absolute inset-0 rounded-full blur-2xl"
                          style={{
                            background:
                              "radial-gradient(circle, rgba(255, 122, 0,0.45), transparent 70%)",
                          }}
                        />
                        <div className="relative h-20 w-20 rounded-full bg-[#FF7A00] grid place-items-center shadow-[0_30px_60px_-20px_rgba(255, 122, 0,0.6)]">
                          <CheckCircle2 className="w-10 h-10 text-[#0A0B10]" />
                        </div>
                      </div>
                      <h2 className="mt-6 font-display text-[26px] md:text-[30px] tracking-[-0.018em]">
                        Strategy call confirmed.
                      </h2>
                      <p className="mt-2 text-[14px] text-white/65 max-w-[460px] mx-auto">
                        A confirmation email is on its way to{" "}
                        <span className="text-[#FF7A00]">{draft.workEmail}</span>. The
                        calendar invite includes a secure room link and a short prep
                        brief.
                      </p>
                      {publicRef && (
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FF7A00]/30 bg-[#FF7A00]/[0.08] text-[11.5px] font-mono uppercase tracking-[0.16em] text-[#FF7A00]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] shadow-[0_0_8px_#FF7A00]" />
                          Confirmation · {publicRef}
                        </div>
                      )}

                      {/* Summary card */}
                      <div className="mt-7 inline-flex flex-col gap-3 p-5 rounded-[18px] border border-white/[0.07] bg-[#0E121B]/85 text-left max-w-[520px] w-full">
                        <SummaryRow
                          icon={Compass}
                          label="Consultation"
                          value={`${service.title} · ${durationMin} min`}
                        />
                        <SummaryRow
                          icon={CalendarDays}
                          label="Scheduled for"
                          value={
                            selectedDate
                              ? `${selectedDate.toLocaleDateString("en-GB", {
                                  weekday: "long",
                                  day: "2-digit",
                                  month: "long",
                                  year: "numeric",
                                })} · ${draft.selectedTime}`
                              : "—"
                          }
                        />
                        <SummaryRow
                          icon={UserRound}
                          label="Attendee"
                          value={`${draft.fullName} — ${draft.role}, ${draft.organisation}`}
                        />
                        <SummaryRow
                          icon={Clock}
                          label="Timezone"
                          value={timezoneLabel}
                        />
                      </div>

                      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={handleDownloadIcs}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF7A00] hover:bg-[#FF5500] text-[#0A0B10] text-[14px] font-semibold transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Add to calendar (.ics)
                        </button>
                        <Link
                          to="/ai-scan"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/12 hover:border-[#FF7A00]/45 text-white/85 hover:text-[#FF7A00] text-[14px] transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-[#FF7A00]" />
                          Get a head start with the AI Scan
                        </Link>
                        <button
                          type="button"
                          onClick={resetBooking}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white/55 hover:text-[#FF7A00] text-[13px] transition-colors"
                        >
                          Book another session
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Security note */}
                <div className="mt-7 flex items-center justify-center gap-2 text-[12px] text-white/45">
                  <Lock className="w-3.5 h-3.5 text-[#FF7A00]" />
                  Your information is secure and encrypted.
                </div>
              </GlassCard>
            </section>

            {/* ============================================== */}
            {/* RIGHT — What You'll Gain / Data safe / How It Works */}
            {/* ============================================== */}
            <aside className="relative space-y-5">
              {/* What You'll Gain */}
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div className="font-display text-[17px] tracking-[-0.01em]">
                    What You’ll Gain
                  </div>
                  <TrendingUp className="w-4 h-4 text-[#FF7A00]" />
                </div>
                <div className="mt-1 h-px w-12 bg-[#FF7A00]" />

                <div className="mt-5 space-y-4">
                  {[
                    {
                      icon: Compass,
                      title: "Operational Clarity",
                      body: "Understand your current position & key gaps.",
                    },
                    {
                      icon: Lightbulb,
                      title: "Growth Opportunities",
                      body: "Identify the biggest impact opportunities.",
                    },
                    {
                      icon: AlertTriangle,
                      title: "Risk & Bottlenecks",
                      body: "Uncover risks, inefficiencies & hidden costs.",
                    },
                    {
                      icon: Rocket,
                      title: "Strategic Roadmap",
                      body: "Receive a clear, actionable next-steps plan.",
                    },
                  ].map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full border border-[#FF7A00]/40 bg-[#FF7A00]/10 text-[#FF7A00] grid place-items-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[13.5px] font-semibold tracking-tight">
                          {title}
                        </div>
                        <div className="text-[12.5px] text-white/60 leading-snug mt-0.5">
                          {body}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Your data is safe */}
              <GlassCard className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-display text-[17px] tracking-[-0.01em]">
                      Your data is safe.
                    </div>
                    <p className="mt-2 text-[12.5px] text-white/60 leading-snug">
                      We treat your information with the highest level of security and
                      confidentiality.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Pill>GDPR Compliant</Pill>
                      <Pill>Audit-ready</Pill>
                      <Pill>Encrypted End-to-End</Pill>
                    </div>
                  </div>
                  <div className="relative h-14 w-14 shrink-0 rounded-2xl border border-[#FF7A00]/35 bg-gradient-to-br from-[#FF7A00]/20 to-[#FF7A00]/0 grid place-items-center">
                    <ShieldCheck className="w-7 h-7 text-[#FF7A00]" />
                  </div>
                </div>
              </GlassCard>

              {/* How It Works */}
              <GlassCard className="p-5">
                <div className="font-display text-[17px] tracking-[-0.01em]">
                  How It Works
                </div>
                <div className="mt-1 h-px w-12 bg-[#FF7A00]" />

                <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                  {[
                    { icon: UserRound, label: "Choose\nCall" },
                    { icon: CalendarDays, label: "Select\nTime" },
                    { icon: ClipboardList, label: "Share\nDetails" },
                    { icon: CheckCheck, label: "Confirm\n& Book" },
                  ].map(({ icon: Icon, label }, i) => (
                    <div key={label} className="flex flex-col items-center">
                      <div className="h-9 w-9 rounded-full border border-white/12 bg-white/[0.03] grid place-items-center text-white/75">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="mt-1.5 text-[10px] font-mono tracking-[0.16em] uppercase text-[#FF7A00]">
                        {i + 1}
                      </div>
                      <div className="text-[10.5px] text-white/60 leading-tight whitespace-pre-line">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </aside>
          </div>

          {/* ============================================== */}
          {/* Trust strip                                       */}
          {/* ============================================== */}
          <section className="mt-8">
            <GlassCard className="p-5 md:p-6">
              <div className="grid grid-cols-2 md:grid-cols-7 gap-4 items-center">
                <TrustItem
                  icon={ShieldCheck}
                  title="100% Confidential"
                  body="Your privacy is our priority."
                />
                <TrustItem
                  icon={CheckCheck}
                  title="No Commitment"
                  body="Just strategic insight."
                />
                <TrustItem
                  icon={Sparkles}
                  title="Experts, Not Sales"
                  body="We solve, not sell."
                />
                <div className="hidden md:flex justify-center font-display text-[#FF7A00] tracking-[0.18em] text-[15px]">
                  IO SKY
                  <span className="ml-2 text-[9px] font-mono tracking-[0.28em] uppercase text-white/45 self-center">
                    Operational
                    <br />
                    Intelligence
                  </span>
                </div>
                <TrustItem
                  icon={Crown}
                  title="Senior-led sessions"
                  body="Direct access to engineering leadership."
                />
                <TrustItem
                  icon={Clock}
                  title="Response Within 24h"
                  body="We prepare for your session."
                />
                <TrustItem
                  icon={ShieldCheck}
                  title="Confidential by default"
                  body="Your information stays private."
                />
              </div>
            </GlassCard>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small UI primitives                                                 */
/* ------------------------------------------------------------------ */
function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="text-[11.5px] font-mono tracking-[0.18em] uppercase text-white/55 mb-1.5">
        {label}
      </div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-xl border border-white/10 bg-white/[0.02] px-4 text-[14px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-[#FF7A00]/55 focus:bg-white/[0.04] transition-colors"
      />
    </label>
  );
}

function Textarea({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-[11.5px] font-mono tracking-[0.18em] uppercase text-white/55 mb-1.5">
        {label}
      </div>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[14px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-[#FF7A00]/55 focus:bg-white/[0.04] transition-colors resize-none"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="text-[11.5px] font-mono tracking-[0.18em] uppercase text-white/55 mb-1.5">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-xl border border-white/10 bg-white/[0.02] px-4 text-[14px] text-white/90 focus:outline-none focus:border-[#FF7A00]/55 focus:bg-white/[0.04] transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0B0E16] text-white">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#FF7A00]/30 bg-[#FF7A00]/10 text-[10.5px] font-mono tracking-[0.14em] uppercase text-[#FF7A00]">
      <CheckCircle2 className="w-3 h-3" />
      {children}
    </span>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Compass;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-full border border-[#FF7A00]/35 bg-[#FF7A00]/10 text-[#FF7A00] grid place-items-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-[10.5px] font-mono tracking-[0.22em] uppercase text-white/45">
          {label}
        </div>
        <div className="text-[13.5px] text-white/85">{value}</div>
      </div>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-full border border-[#FF7A00]/35 bg-[#FF7A00]/10 text-[#FF7A00] grid place-items-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-[13px] font-semibold tracking-tight">{title}</div>
        <div className="text-[11.5px] text-white/55 leading-snug mt-0.5">
          {body}
        </div>
      </div>
    </div>
  );
}
