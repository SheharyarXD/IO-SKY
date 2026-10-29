/**
 * Input schemas for the public booking API. They live beside the router (and are
 * imported by the booking service) so the validator-coverage test can see that
 * every procedure input is a zod schema.
 */
import { z } from "zod";

export const consultationEnum = z.enum(["discovery", "growth", "elite"]);

export const createInputSchema = z.object({
  serviceId: consultationEnum,
  slotStartMs: z
    .number()
    .int()
    .min(Date.now() - 24 * 3600_000, "Slot must not be in the past.")
    .max(Date.now() + 365 * 24 * 3600_000, "Slot must be within one year."),
  timezone: z.string().min(2).max(64),
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(120).optional().nullable(),
  /**
   * Required, not optional. A discovery call is a scheduled telephone or
   * video conversation, so the number is operationally necessary to deliver
   * what is being booked. Validated on digit count rather than shape so
   * international formats ("+31 6 12 34 56 78", "0031 6 12345678") all pass
   * while a placeholder such as "n/a" does not. The Contact form
   * deliberately collects no telephone number at all.
   */
  phone: z
    .string()
    .max(64)
    .refine(v => v.replace(/[^0-9]/g, "").length >= 7, {
      message: "A telephone number is required for a discovery call.",
    }),
  preparation: z.record(z.string(), z.string().max(2000)).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
  utmSource: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  /** Optional hold token returned by bookings.hold. If present we treat the
   *  existing held slot as authoritative; if absent we attempt to hold then
   *  immediately confirm (legacy create path). */
  holdToken: z.string().max(128).optional().nullable(),
  slotId: z.number().int().positive().optional().nullable(),
  /** Honeypot — must be empty. */
  website: z.string().max(0).optional().nullable(),
  /** Recipient UI locale for the localised confirmation email (e.g. "NL"). */
  locale: z.string().max(16).optional().nullable(),
});
