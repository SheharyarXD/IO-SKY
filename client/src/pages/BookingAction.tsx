/**
 * Booking action landing page for `/booking/cancel?token=...` and
 * `/booking/reschedule?token=...`. Backs the secure HMAC-signed token flow
 * generated server-side and rendered in the confirmation email.
 *
 * Cancel — confirms and calls `bookings.cancelByToken`.
 * Reschedule — prompts a new slot pick using the same availability list as
 * the public booking page, then calls `bookings.rescheduleByToken`.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Loader2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useT } from "@/contexts/LanguageContext";

type Mode = "cancel" | "reschedule";

export default function BookingAction() {
  const [matchCancel] = useRoute("/booking/cancel");
  const [matchReschedule] = useRoute("/booking/reschedule");
  const [, navigate] = useLocation();

  const mode: Mode = matchCancel ? "cancel" : matchReschedule ? "reschedule" : "cancel";

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search);
    return q.get("token");
  }, []);

  if (!matchCancel && !matchReschedule) {
    // Wouter wouldn't usually route here, but stay defensive.
    useEffect(() => {
      navigate("/", { replace: true });
    }, [navigate]);
    return null;
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <Navbar />
      <div className="container pt-24 pb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-[var(--orange)] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Home
        </Link>
      </div>
      <section className="container pt-6 pb-16">
        {!token ? (
          <InvalidToken />
        ) : mode === "cancel" ? (
          <CancelFlow token={token} />
        ) : (
          <RescheduleFlow token={token} />
        )}
      </section>
      <Footer />
    </div>
  );
}

function InvalidToken() {
  return (
    <div className="max-w-xl rounded-2xl glass-soft p-10 ring-1 ring-rose-400/30">
      <XCircle className="size-9 text-rose-300" />
      <h1 className="mt-4 text-2xl font-semibold">Invalid or missing token</h1>
      <p className="mt-3 text-[14px] text-white/65">
        The link in your email appears incomplete. If this is unexpected,
        contact our team and we'll resolve it within minutes.
      </p>
      <Link
        href="/contact"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/12 text-white/85 text-[13px] hover:border-[var(--orange)]/45 hover:text-[var(--orange)] transition-colors"
      >
        Contact IO SKY
      </Link>
    </div>
  );
}

function CancelFlow({ token }: { token: string }) {
  const m = trpc.bookings.cancelByToken.useMutation();
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    try {
      await m.mutateAsync({ token, reason: reason.trim() || undefined });
      setDone(true);
      toast.success("Booking cancelled");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not cancel. Please retry.",
      );
    }
  };

  if (done) {
    return (
      <div className="max-w-xl rounded-2xl glass-soft p-10 ring-1 ring-emerald-400/30">
        <CheckCircle2 className="size-9 text-emerald-300" />
        <h1 className="mt-4 text-2xl font-semibold">Booking cancelled</h1>
        <p className="mt-3 text-[14px] text-white/65">
          Your discovery call has been cancelled. You're welcome back anytime —
          we keep slots warm for when timing is right.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/book-strategy"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13px] font-semibold hover:bg-[var(--orange-hover)] transition-colors"
          >
            <CalendarDays className="size-4" />
            Book a new slot
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/12 text-white/85 text-[13px] hover:border-[var(--orange)]/45 hover:text-[var(--orange)] transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl rounded-2xl glass-soft p-10 ring-1 ring-white/8">
      <p className="text-[10.5px] uppercase tracking-[0.24em] text-[var(--orange)] font-semibold">
        CANCEL BOOKING
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Cancel your discovery call?
      </h1>
      <p className="mt-4 text-[14px] text-white/65">
        We'll release the slot and let our team know. If you'd like to share a
        quick reason, it helps us serve you better next time.
      </p>
      <label className="block mt-6">
        <span className="block text-[12px] uppercase tracking-[0.18em] text-white/55 mb-2">
          Reason (optional)
        </span>
        <textarea
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[14px] text-white outline-none focus:border-[var(--orange)]/55 transition-colors"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional — anything we should know?"
        />
      </label>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="text-[13px] text-white/55 hover:text-white/85 underline-offset-4 hover:underline"
        >
          Keep my booking
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={m.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500/85 hover:bg-rose-500 text-white text-[13px] font-semibold disabled:opacity-40 transition-colors active:scale-[0.98]"
        >
          {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
          Cancel booking
        </button>
      </div>
    </div>
  );
}

function RescheduleFlow({ token }: { token: string }) {
  const { lang } = useT();
  const [tz] = useState(() =>
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  );
  // Build 14-day horizon
  const [weekStartMs] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const days = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => weekStartMs + i * 86_400_000);
  }, [weekStartMs]);

  const [pageStart, setPageStart] = useState(0); // 7-day window cursor

  const [selectedDayMs, setSelectedDayMs] = useState<number | null>(null);

  // Default: first day with slots (lazy fetched)
  useEffect(() => {
    if (selectedDayMs == null && days.length > 0) {
      setSelectedDayMs(days[0]);
    }
  }, [days, selectedDayMs]);

  const slots = trpc.bookings.listSlots.useQuery(
    {
      consultationType: "discovery" as const,
      rangeStartMs: selectedDayMs ?? weekStartMs,
      rangeEndMs: (selectedDayMs ?? weekStartMs) + 86_400_000,
      timezone: tz,
    },
    { enabled: selectedDayMs != null },
  );

  const [selectedSlotMs, setSelectedSlotMs] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const m = trpc.bookings.rescheduleByToken.useMutation();

  const submit = async () => {
    if (!selectedSlotMs) return;
    try {
      await m.mutateAsync({
        token,
        newSlotStartMs: selectedSlotMs,
        timezone: tz,
      });
      setDone(true);
      toast.success("Booking rescheduled");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not reschedule. Try again.",
      );
    }
  };

  if (done) {
    return (
      <div className="max-w-xl rounded-2xl glass-soft p-10 ring-1 ring-emerald-400/30">
        <CheckCircle2 className="size-9 text-emerald-300" />
        <h1 className="mt-4 text-2xl font-semibold">Booking rescheduled</h1>
        <p className="mt-3 text-[14px] text-white/65">
          Your discovery call has been moved. A fresh confirmation email is on
          its way.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13px] font-semibold hover:bg-[var(--orange-hover)] transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  const dayList = days.slice(pageStart, pageStart + 7);

  return (
    <div className="max-w-3xl">
      <p className="text-[10.5px] uppercase tracking-[0.24em] text-[var(--orange)] font-semibold">
        RESCHEDULE BOOKING
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Pick a new time for your discovery call
      </h1>
      <p className="mt-4 text-[14px] text-white/65">
        Times shown in <span className="text-white">{tz}</span>. Your old slot
        is released the moment you confirm the new one.
      </p>

      <div className="mt-8 rounded-2xl glass-soft p-6 ring-1 ring-white/8">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setPageStart((p) => Math.max(0, p - 7))}
            disabled={pageStart === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[12px] text-white/72 hover:border-[var(--orange)]/40 hover:text-[var(--orange)] disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Earlier
          </button>
          <p className="text-[12px] uppercase tracking-[0.18em] text-white/55">
            Next 14 days
          </p>
          <button
            type="button"
            onClick={() => setPageStart((p) => Math.min(days.length - 7, p + 7))}
            disabled={pageStart + 7 >= days.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[12px] text-white/72 hover:border-[var(--orange)]/40 hover:text-[var(--orange)] disabled:opacity-40 transition-colors"
          >
            Later
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {dayList.map((d) => {
            const date = new Date(d);
            const active = d === selectedDayMs;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSelectedDayMs(d);
                  setSelectedSlotMs(null);
                }}
                className={[
                  "rounded-xl border p-3 text-center transition-all duration-150",
                  active
                    ? "border-[var(--orange)]/55 bg-[var(--orange)]/12 text-[var(--orange)]"
                    : "border-white/10 text-white/72 hover:border-[var(--orange)]/30 hover:text-[var(--orange)]",
                ].join(" ")}
              >
                <p className="text-[10.5px] uppercase tracking-[0.18em]">
                  {date.toLocaleDateString(lang, { weekday: "short" })}
                </p>
                <p className="text-[16px] mt-1 font-semibold">
                  {date.toLocaleDateString(lang, { day: "2-digit" })}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl glass-soft p-6 ring-1 ring-white/8">
        <p className="text-[12px] uppercase tracking-[0.18em] text-white/55 mb-3">
          Available slots
        </p>
        {slots.isLoading ? (
          <p className="text-[13px] text-white/55">Loading availability…</p>
        ) : slots.data && slots.data.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {slots.data.map((s: { startMs: number }) => {
              const active = s.startMs === selectedSlotMs;
              return (
                <button
                  key={s.startMs}
                  type="button"
                  onClick={() => setSelectedSlotMs(s.startMs)}
                  className={[
                    "px-3 py-2 rounded-lg border text-[12.5px] transition-all duration-150",
                    active
                      ? "border-[var(--orange)]/55 bg-[var(--orange)]/15 text-[var(--orange)]"
                      : "border-white/12 text-white/82 hover:border-[var(--orange)]/30 hover:text-[var(--orange)]",
                  ].join(" ")}
                >
                  {new Date(s.startMs).toLocaleTimeString(lang, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-white/55">
            No availability on this day. Try a different one.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="text-[13px] text-white/55 hover:text-white/85 underline-offset-4 hover:underline"
        >
          Keep my booking
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={m.isPending || !selectedSlotMs}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold disabled:opacity-40 hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
        >
          {m.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarDays className="size-4" />
          )}
          Confirm new time
        </button>
      </div>
    </div>
  );
}
