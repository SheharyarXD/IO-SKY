/**
 * IO SKY — Booking adapter (port + native implementation).
 *
 * The native adapter is the source of truth today. The interface is
 * deliberately shaped so we can later plug GoogleCalendarAdapter,
 * MicrosoftCalendarAdapter, or CalComAdapter without changing the public
 * booking UX, the tRPC router, or the admin portal.
 *
 * All times are passed and returned in UTC milliseconds. Conversion to a
 * user's IANA timezone happens at the edges (UI and reminder dispatch).
 */
import { randomBytes } from "crypto";
import {
  cancelBookingSlot,
  confirmBookingSlot,
  insertBookingAnswers,
  listAdminAvailability,
  listAvailabilityWindows,
  listCalendarBlocks,
  listTakenBookingSlots,
  scheduleBookingReminders,
  tryHoldBookingSlot,
} from "../../db";

/**
 * Consultation catalogue. The booking flow surfaces these labels + durations
 * to the public booking page and to the admin availability editor.
 */
export const CONSULTATION_CATALOG: Record<
  string,
  { label: string; durationMin: number }
> = {
  discovery: { label: "Executive Discovery Call", durationMin: 30 },
  growth: { label: "Strategic Growth Session", durationMin: 60 },
  elite: { label: "Elite Strategy Workshop", durationMin: 90 },
};

export type ConsultationId = keyof typeof CONSULTATION_CATALOG;

export interface SlotSuggestion {
  startMs: number;
  endMs: number;
  available: boolean;
}

export interface AvailabilityQuery {
  consultationType: string;
  rangeStartMs: number;
  rangeEndMs: number;
  /** Step granularity in minutes (defaults to the consultation duration). */
  stepMin?: number;
}

export interface HoldRequest {
  consultationType: string;
  slotStartMs: number;
}

export interface ConfirmRequest {
  slotId: number;
  holdToken: string;
  bookingId: number;
  slotStartMs: number;
  consultationType: string;
}

export interface BookingAdapter {
  readonly id: string;
  listAvailableSlots(q: AvailabilityQuery): Promise<SlotSuggestion[]>;
  hold(
    req: HoldRequest,
  ): Promise<
    | { ok: true; slotId: number; holdToken: string; holdExpiresAtMs: number }
    | { ok: false; reason: "taken" | "invalid_slot" | "closed" | "db" }
  >;
  confirm(
    req: ConfirmRequest,
  ): Promise<
    | { ok: true }
    | { ok: false; reason: "lost" | "db" }
  >;
  cancel(bookingId: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_AVAILABILITY: Array<{
  weekday: number;
  startMinute: number;
  endMinute: number;
  timezone: string;
}> = [
  // Mon..Fri 09:00 - 18:00 Europe/Amsterdam
  { weekday: 1, startMinute: 9 * 60, endMinute: 18 * 60, timezone: "Europe/Amsterdam" },
  { weekday: 2, startMinute: 9 * 60, endMinute: 18 * 60, timezone: "Europe/Amsterdam" },
  { weekday: 3, startMinute: 9 * 60, endMinute: 18 * 60, timezone: "Europe/Amsterdam" },
  { weekday: 4, startMinute: 9 * 60, endMinute: 18 * 60, timezone: "Europe/Amsterdam" },
  { weekday: 5, startMinute: 9 * 60, endMinute: 18 * 60, timezone: "Europe/Amsterdam" },
];

/**
 * Convert a wall-clock (weekday + minute-of-day) in a given IANA timezone to
 * the equivalent UTC ms for a specific calendar date. Uses Intl to introspect
 * the offset so DST is respected.
 */
export function wallClockToUtcMs(input: {
  year: number;
  month: number; // 1..12
  day: number;
  minuteOfDay: number;
  timezone: string;
}): number {
  const utcGuess = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    Math.floor(input.minuteOfDay / 60),
    input.minuteOfDay % 60,
    0,
    0,
  );
  // Compute offset of `timezone` at the guessed instant.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(utcGuess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  const offset = asUtc - utcGuess;
  return utcGuess - offset;
}

/**
 * Decompose a UTC ms instant into civil time in a given IANA timezone.
 */
export function utcMsToWallClock(ms: number, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

// ---------------------------------------------------------------------------
// Native adapter
// ---------------------------------------------------------------------------

export class NativeBookingAdapter implements BookingAdapter {
  readonly id = "native";

  async listAvailableSlots(q: AvailabilityQuery): Promise<SlotSuggestion[]> {
    const tier = CONSULTATION_CATALOG[q.consultationType];
    if (!tier) return [];
    const stepMin = q.stepMin ?? tier.durationMin;
    const durationMs = tier.durationMin * 60_000;

    const adminRows = await listAdminAvailability(q.consultationType);
    const effectiveAvailability = adminRows.length
      ? adminRows.map((r) => ({
          weekday: r.weekday,
          startMinute: r.startMinute,
          endMinute: r.endMinute,
          timezone: r.timezone,
        }))
      : DEFAULT_AVAILABILITY;

    const [blocks, windows, taken] = await Promise.all([
      listCalendarBlocks(q.rangeStartMs, q.rangeEndMs),
      listAvailabilityWindows(q.rangeStartMs, q.rangeEndMs),
      listTakenBookingSlots(q.consultationType, q.rangeStartMs, q.rangeEndMs),
    ]);

    const takenStarts = new Set(taken.map((t) => t.slotStartMs));
    const blockedRanges = blocks.map((b) => [b.startMs, b.endMs] as const);
    const closeWindows = windows.filter((w) => w.kind === "close" && (w.consultationType == null || w.consultationType === q.consultationType));
    const openWindows = windows.filter((w) => w.kind === "open" && (w.consultationType == null || w.consultationType === q.consultationType));

    const slots: SlotSuggestion[] = [];
    const now = Date.now();
    const earliestMs = now + 30 * 60_000; // never offer something < 30min from now

    // Iterate each day in the range across the canonical timezone of the
    // first availability row (so DST is handled per row's tz).
    const dayMs = 24 * 3600_000;
    const startDay = new Date(q.rangeStartMs);
    startDay.setUTCHours(0, 0, 0, 0);

    for (let dayCursor = startDay.getTime(); dayCursor < q.rangeEndMs; dayCursor += dayMs) {
      for (const rule of effectiveAvailability) {
        const wall = utcMsToWallClock(dayCursor + 12 * 3600_000, rule.timezone);
        const weekdayHere = new Date(
          Date.UTC(wall.year, wall.month - 1, wall.day),
        ).getUTCDay();
        if (weekdayHere !== rule.weekday) continue;

        for (let m = rule.startMinute; m + tier.durationMin <= rule.endMinute; m += stepMin) {
          const startMs = wallClockToUtcMs({
            year: wall.year,
            month: wall.month,
            day: wall.day,
            minuteOfDay: m,
            timezone: rule.timezone,
          });
          const endMs = startMs + durationMs;
          if (startMs < q.rangeStartMs || endMs > q.rangeEndMs) continue;
          if (startMs < earliestMs) continue;

          let available = !takenStarts.has(startMs);
          if (available) {
            for (const [bs, be] of blockedRanges) {
              if (startMs < be && endMs > bs) { available = false; break; }
            }
          }
          if (available) {
            for (const w of closeWindows) {
              if (startMs < w.endMs && endMs > w.startMs) { available = false; break; }
            }
          }
          slots.push({ startMs, endMs, available });
        }
      }

      // "open" windows add slots outside the recurring availability.
      for (const w of openWindows) {
        if (w.endMs <= dayCursor || w.startMs >= dayCursor + dayMs) continue;
        const firstStart = Math.max(w.startMs, dayCursor);
        const lastStart = Math.min(w.endMs, dayCursor + dayMs) - durationMs;
        for (let s = firstStart; s <= lastStart; s += stepMin * 60_000) {
          if (s < earliestMs) continue;
          const e = s + durationMs;
          let available = !takenStarts.has(s);
          if (available) {
            for (const [bs, be] of blockedRanges) {
              if (s < be && e > bs) { available = false; break; }
            }
          }
          slots.push({ startMs: s, endMs: e, available });
        }
      }
    }

    // Deduplicate by startMs (close windows + admin rules might overlap).
    const seen = new Set<number>();
    const unique = slots.filter((s) => {
      if (seen.has(s.startMs)) return false;
      seen.add(s.startMs);
      return true;
    });
    unique.sort((a, b) => a.startMs - b.startMs);
    return unique;
  }

  async hold(req: HoldRequest) {
    const tier = CONSULTATION_CATALOG[req.consultationType];
    if (!tier) return { ok: false as const, reason: "invalid_slot" as const };
    const durationMs = tier.durationMin * 60_000;
    const holdToken = randomToken(32);
    const result = await tryHoldBookingSlot({
      consultationType: req.consultationType,
      slotStartMs: req.slotStartMs,
      slotEndMs: req.slotStartMs + durationMs,
      holdToken,
      holdTtlMs: 10 * 60_000,
    });
    if (!result.ok) return { ok: false as const, reason: result.reason } as const;
    return {
      ok: true as const,
      slotId: result.id,
      holdToken,
      holdExpiresAtMs: Date.now() + 10 * 60_000,
    };
  }

  async confirm(req: ConfirmRequest) {
    const ok = await confirmBookingSlot({
      slotId: req.slotId,
      holdToken: req.holdToken,
      bookingId: req.bookingId,
    });
    return ok ? { ok: true as const } : { ok: false as const, reason: "lost" as const };
  }

  async cancel(bookingId: number) {
    await cancelBookingSlot(bookingId);
  }
}

export const nativeBookingAdapter = new NativeBookingAdapter();

/**
 * Future calendar adapters can replace this resolver. For now everything
 * routes through the native adapter; we keep the indirection so the router
 * never imports the concrete class.
 */
export function getBookingAdapter(): BookingAdapter {
  return nativeBookingAdapter;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/**
 * Used for booking-slot hold tokens (server/_core/booking/index.ts's
 * holdToken) — a capability token that gates who can claim/confirm a held
 * slot, not just a display label, so this must be a CSPRNG. Previously had
 * a Math.random() fallback for environments lacking `globalThis.crypto`;
 * removed it — Node.js (this app's only server runtime) has guaranteed
 * `crypto.randomBytes` support, so the fallback was both dead in practice
 * and a latent security weakening if it ever *did* trigger.
 */
function randomToken(len: number): string {
  // ceil(len/2) bytes -> hex-encodes to at least `len` characters (2 hex
  // chars per byte) before the slice, so every requested character is
  // backed by real random-byte entropy rather than being truncated away.
  return randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);
}

export { randomToken };

/** Re-export the answer insertion + reminder scheduling helpers so the router
 * only needs to import from this module. */
export { insertBookingAnswers, scheduleBookingReminders };
