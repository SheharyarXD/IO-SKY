/**
 * Pure helpers for the AI scheduling tools (task S02): time zone handling,
 * slot window limits and booking ownership. No I/O.
 */

/** True for a real IANA time zone such as "Europe/Amsterdam" or "UTC". */
export function isValidTimeZone(tz: string): boolean {
  if (typeof tz !== "string" || tz.length < 2 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A moment as wall-clock text in a time zone ("2026-11-05 14:30"), so a guest is told a time in THEIR zone. */
export function formatInTimeZone(ms: number, tz: string): string {
  const zone = isValidTimeZone(tz) ? tz : "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export const SLOT_SEARCH = { maxWindowMs: 14 * 86_400_000, minLeadMs: 30 * 60_000, maxResults: 20 } as const;

/** Validate and clamp an availability window. */
export function checkSlotWindow(fromMs: number, toMs: number, now: number): { ok: true; fromMs: number; toMs: number } | { ok: false; message: string } {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return { ok: false, message: "The time range is not valid." };
  if (toMs <= fromMs) return { ok: false, message: "The end of the range must be after the start." };
  if (toMs - fromMs > SLOT_SEARCH.maxWindowMs) return { ok: false, message: "Search at most 14 days at a time." };
  if (toMs < now) return { ok: false, message: "That range is in the past." };
  return { ok: true, fromMs: Math.max(fromMs, now + SLOT_SEARCH.minLeadMs), toMs };
}

/**
 * Does this booking belong to the person asking? A booking reference is not a
 * secret on its own, so the reference must come with the booking's email.
 */
export function bookingBelongsTo(booking: { email: string } | null | undefined, email: string): boolean {
  if (!booking) return false;
  const a = booking.email.trim().toLowerCase();
  const b = email.trim().toLowerCase();
  return a.length > 0 && a === b;
}
