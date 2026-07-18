/**
 * Email + .ics calendar invite helper for IO SKY Discovery Call bookings.
 *
 * Transport strategy (auto-selected at runtime, in priority order):
 *   1. Resend (preferred) — `RESEND_API_KEY` + `BOOKING_FROM_EMAIL` env vars
 *   2. SMTP (Postmark/Sendgrid/etc.) — `SMTP_URL` + `BOOKING_FROM_EMAIL`
 *   3. Console fallback — logs the rendered email so the booking flow keeps
 *      working in dev/preview even without credentials.
 *
 * Caller passes a structured BookingEmailInput; this module renders the
 * confirmation HTML, builds the .ics calendar invite as a base64 attachment,
 * and dispatches. It returns { ok, transport, messageId? } so the caller can
 * audit-log the outcome.
 */

import { createTransport, type Transporter } from "nodemailer";
import {
  type EmailLocale,
  BCP47,
  isRtl,
  normaliseLocale,
  bookingStrings,
  contactStrings,
  devAppStrings,
  fill,
} from "./email-i18n";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BookingEmailInput = {
  publicRef: string;
  fullName: string;
  email: string;
  company?: string | null;
  /** "discovery" | "growth" | "elite" */
  serviceId: string;
  serviceLabel: string;
  /** Slot start (UTC ms). */
  slotStartMs: number;
  durationMin: number;
  /** Visitor-facing timezone for the human-readable line. */
  timezone: string;
  /** Optional URL that visitors can click for the meeting (Cal.com, Zoom, etc.). */
  meetingUrl?: string | null;
  /** HMAC-signed token used in the cancel link. */
  cancelToken?: string | null;
  /** HMAC-signed token used in the reschedule link. */
  rescheduleToken?: string | null;
  /** Recipient locale (e.g. "NL", "de-DE"). Defaults to EN. */
  locale?: string | null;
};

export type BookingEmailResult = {
  ok: boolean;
  transport: "resend" | "smtp" | "console";
  messageId?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Lazy SMTP transporter
// ---------------------------------------------------------------------------

let _smtp: Transporter | null = null;
function getSmtpTransporter(): Transporter | null {
  if (_smtp) return _smtp;
  const url = process.env.SMTP_URL;
  if (!url) return null;
  try {
    _smtp = createTransport(url);
    return _smtp;
  } catch (error) {
    console.warn("[Email] Failed to create SMTP transporter:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// .ics builder
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIcsDate(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(input: BookingEmailInput): string {
  const start = new Date(input.slotStartMs);
  const end = new Date(input.slotStartMs + input.durationMin * 60_000);
  const uid = `iosky-${input.publicRef}@iosky.com`;
  const now = new Date();

  const summary = `IO SKY ${input.serviceLabel}`;
  const description =
    `Discovery Call with IO SKY (${input.serviceLabel}).\n\n` +
    `Confirmation reference: ${input.publicRef}\n` +
    (input.meetingUrl ? `Meeting link: ${input.meetingUrl}\n` : "") +
    `\nA member of our operating team will reach out 24h in advance with the secure meeting link.`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IO SKY//Discovery Call//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `ORGANIZER;CN=IO SKY Operations:MAILTO:${getFromEmail()}`,
    `ATTENDEE;CN=${escapeIcs(input.fullName)};RSVP=TRUE:MAILTO:${input.email}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT24H",
    `DESCRIPTION:${escapeIcs(summary)} starts in 24 hours.`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// Rendered HTML/text
// ---------------------------------------------------------------------------

function getPublicBase(): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.VITE_PUBLIC_BASE_URL ||
    "https://iosky.com"
  );
}

function getFromEmail(): string {
  return (
    process.env.BOOKING_FROM_EMAIL ||
    process.env.SMTP_FROM ||
    "noreply@iosky.com"
  );
}

function formatHumanDate(slotStartMs: number, tz: string, bcp47 = "en-GB"): string {
  try {
    return new Intl.DateTimeFormat(bcp47, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: tz,
    }).format(new Date(slotStartMs));
  } catch {
    return new Date(slotStartMs).toUTCString();
  }
}

function renderHtml(input: BookingEmailInput): string {
  const locale: EmailLocale = normaliseLocale(input.locale);
  const t = bookingStrings(locale);
  const when = formatHumanDate(input.slotStartMs, input.timezone, BCP47[locale]);
  const dir = isRtl(locale) ? "rtl" : "ltr";
  const align = isRtl(locale) ? "right" : "left";
  const firstName = escapeHtml(input.fullName.split(" ")[0] || input.fullName);
  return `<!doctype html>
<html dir="${dir}"><body style="margin:0;padding:0;background:#0A0E14;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#E6EAF0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E14;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" dir="${dir}" style="background:#0F141B;border:1px solid rgba(255,106,0,0.18);border-radius:16px;padding:32px;text-align:${align}">
        <tr><td>
          <div style="font-family:Inter,Segoe UI,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#FF6A00">${escapeHtml(t.eyebrow)}</div>
          <h1 style="margin:18px 0 8px;font-size:26px;line-height:1.2;color:#E6EAF0;font-weight:600">${escapeHtml(t.heading)}</h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:rgba(230,234,240,0.72)">${escapeHtml(fill(t.intro, { name: firstName, service: input.serviceLabel }))}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,106,0,0.06);border:1px solid rgba(255,106,0,0.22);border-radius:12px;padding:18px 20px;margin-bottom:18px">
            <tr><td>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(230,234,240,0.55)">${escapeHtml(t.whenLabel)}</div>
              <div style="font-size:16px;color:#E6EAF0;margin-top:4px;font-weight:500">${escapeHtml(when)}</div>
              <div style="font-size:12px;color:rgba(230,234,240,0.55);margin-top:2px">${escapeHtml(fill(t.durationTz, { duration: input.durationMin, tz: input.timezone }))}</div>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px 20px;margin-bottom:18px">
            <tr><td>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(230,234,240,0.55)">${escapeHtml(t.refLabel)}</div>
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;color:#FF6A00;margin-top:4px;letter-spacing:0.1em">${escapeHtml(input.publicRef)}</div>
            </td></tr>
          </table>

          <p style="margin:0 0 12px;font-size:13.5px;line-height:1.7;color:rgba(230,234,240,0.72)">
            ${escapeHtml(t.operatorNote)}
          </p>

          ${(input.cancelToken || input.rescheduleToken) ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tr><td align="${align}">${input.rescheduleToken ? `<a href="${getPublicBase()}/booking/reschedule?token=${encodeURIComponent(input.rescheduleToken)}" style="display:inline-block;padding:10px 16px;border:1px solid rgba(255,106,0,0.45);border-radius:8px;color:#FF6A00;font-size:13px;text-decoration:none;margin-right:8px">${escapeHtml(t.reschedule)}</a>` : ''}${input.cancelToken ? `<a href="${getPublicBase()}/booking/cancel?token=${encodeURIComponent(input.cancelToken)}" style="display:inline-block;padding:10px 16px;border:1px solid rgba(255,255,255,0.18);border-radius:8px;color:rgba(230,234,240,0.7);font-size:13px;text-decoration:none">${escapeHtml(t.cancel)}</a>` : ''}</td></tr></table>` : ''}
          <p style="margin:18px 0 0;font-size:12px;color:rgba(230,234,240,0.5)">
            ${escapeHtml(t.footerNote)}<br/>
            <span style="color:rgba(230,234,240,0.4)">IO SKY · Rotterdam, Netherlands · iosky.com</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(input: BookingEmailInput): string {
  const locale: EmailLocale = normaliseLocale(input.locale);
  const t = bookingStrings(locale);
  const when = formatHumanDate(input.slotStartMs, input.timezone, BCP47[locale]);
  return [
    t.textTitle,
    ``,
    `${t.refLabel}: ${input.publicRef}`,
    `${t.whenLabel}: ${when}`,
    fill(t.durationTz, { duration: input.durationMin, tz: input.timezone }),
    ``,
    t.operatorNote,
    ``,
    input.rescheduleToken ? `${t.reschedule}: ${getPublicBase()}/booking/reschedule?token=${input.rescheduleToken}` : null,
    input.cancelToken ? `${t.cancel}: ${getPublicBase()}/booking/cancel?token=${input.cancelToken}` : null,
    t.footerNote,
    ``,
    `IO SKY · Rotterdam, Netherlands · iosky.com`,
  ].filter(Boolean).join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export async function sendBookingConfirmation(
  input: BookingEmailInput
): Promise<BookingEmailResult> {
  const subject = fill(bookingStrings(normaliseLocale(input.locale)).subject, { ref: input.publicRef });
  const html = renderHtml(input);
  const text = renderText(input);
  const ics = buildIcs(input);
  const icsBase64 = Buffer.from(ics, "utf8").toString("base64");
  const from = getFromEmail();
  const to = input.email;

  // 1) Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          html,
          text,
          attachments: [
            {
              filename: `iosky-discovery-call-${input.publicRef}.ics`,
              content: icsBase64,
            },
          ],
          headers: {
            "X-IOSKY-Ref": input.publicRef,
          },
        }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        return {
          ok: false,
          transport: "resend",
          error: `Resend ${resp.status}: ${body.slice(0, 200)}`,
        };
      }
      const data = (await resp.json().catch(() => ({}))) as { id?: string };
      return { ok: true, transport: "resend", messageId: data.id };
    } catch (error) {
      return {
        ok: false,
        transport: "resend",
        error: (error as Error).message,
      };
    }
  }

  // 2) SMTP
  const smtp = getSmtpTransporter();
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from,
        to,
        subject,
        text,
        html,
        attachments: [
          {
            filename: `iosky-discovery-call-${input.publicRef}.ics`,
            content: ics,
            contentType: "text/calendar; method=REQUEST; charset=UTF-8",
          },
        ],
        headers: {
          "X-IOSKY-Ref": input.publicRef,
        },
      });
      return { ok: true, transport: "smtp", messageId: info.messageId };
    } catch (error) {
      return {
        ok: false,
        transport: "smtp",
        error: (error as Error).message,
      };
    }
  }

  // 3) Console fallback (dev/preview)
  console.info(
    "[Email] No transport configured — logging booking confirmation:\n",
    JSON.stringify(
      {
        to,
        subject,
        publicRef: input.publicRef,
        when: new Date(input.slotStartMs).toISOString(),
        durationMin: input.durationMin,
      },
      null,
      2
    )
  );
  return { ok: true, transport: "console" };
}


// ---------------------------------------------------------------------------
// Contact form confirmation email
// ---------------------------------------------------------------------------

export type ContactEmailInput = {
  publicRef: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
  /** Recipient locale (e.g. "NL", "de-DE"). Defaults to EN. */
  locale?: string | null;
};

export type GenericEmailResult = BookingEmailResult;

function renderContactHtml(input: ContactEmailInput): string {
  const locale: EmailLocale = normaliseLocale(input.locale);
  const t = contactStrings(locale);
  const dir = isRtl(locale) ? "rtl" : "ltr";
  const align = isRtl(locale) ? "right" : "left";
  const firstName = escapeHtml(input.fullName.split(" ")[0] || input.fullName);
  return `<!doctype html>
<html dir="${dir}"><body style="margin:0;padding:0;background:#0A0E14;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#E6EAF0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E14;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" dir="${dir}" style="background:#0F141B;border:1px solid rgba(255,106,0,0.18);border-radius:16px;padding:32px;text-align:${align}">
        <tr><td>
          <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#FF6A00">${escapeHtml(t.eyebrow)}</div>
          <h1 style="margin:18px 0 8px;font-size:26px;line-height:1.2;color:#E6EAF0;font-weight:600">${escapeHtml(t.heading)}</h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:rgba(230,234,240,0.72)">${escapeHtml(fill(t.intro, { name: firstName }))}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px 20px;margin-bottom:18px">
            <tr><td>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(230,234,240,0.55)">${escapeHtml(t.refLabel)}</div>
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;color:#FF6A00;margin-top:4px;letter-spacing:0.1em">${escapeHtml(input.publicRef)}</div>
              <div style="margin-top:14px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(230,234,240,0.55)">${escapeHtml(t.subjectLabel)}</div>
              <div style="font-size:14px;color:#E6EAF0;margin-top:4px">${escapeHtml(input.subject)}</div>
            </td></tr>
          </table>
          <p style="margin:18px 0 0;font-size:12px;color:rgba(230,234,240,0.5)">IO SKY · Rotterdam, Netherlands · iosky.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderContactText(input: ContactEmailInput): string {
  const t = contactStrings(normaliseLocale(input.locale));
  return [
    t.textTitle,
    ``,
    `${t.refLabel}: ${input.publicRef}`,
    `${t.subjectLabel}: ${input.subject}`,
    ``,
    t.textBody,
    ``,
    `IO SKY · Rotterdam, Netherlands · iosky.com`,
  ].join("\n");
}

export async function sendContactConfirmation(
  input: ContactEmailInput,
): Promise<GenericEmailResult> {
  const subject = fill(contactStrings(normaliseLocale(input.locale)).subject, { ref: input.publicRef });
  const html = renderContactHtml(input);
  const text = renderContactText(input);
  return dispatchSimpleEmail({
    to: input.email,
    subject,
    html,
    text,
    refHeader: input.publicRef,
  });
}

// ---------------------------------------------------------------------------
// Engineering Access acknowledgement email
// ---------------------------------------------------------------------------

export type DevAppEmailInput = {
  publicRef: string;
  fullName: string;
  email: string;
  /** Recipient locale (e.g. "NL", "de-DE"). Defaults to EN. */
  locale?: string | null;
};

function renderDevAppHtml(input: DevAppEmailInput): string {
  const locale: EmailLocale = normaliseLocale(input.locale);
  const t = devAppStrings(locale);
  const dir = isRtl(locale) ? "rtl" : "ltr";
  const align = isRtl(locale) ? "right" : "left";
  const firstName = escapeHtml(input.fullName.split(" ")[0] || input.fullName);
  return `<!doctype html>
<html dir="${dir}"><body style="margin:0;padding:0;background:#0A0E14;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#E6EAF0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E14;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" dir="${dir}" style="background:#0F141B;border:1px solid rgba(255,106,0,0.18);border-radius:16px;padding:32px;text-align:${align}">
        <tr><td>
          <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#FF6A00">${escapeHtml(t.eyebrow)}</div>
          <h1 style="margin:18px 0 8px;font-size:26px;line-height:1.2;color:#E6EAF0;font-weight:600">${escapeHtml(t.heading)}</h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:rgba(230,234,240,0.72)">${escapeHtml(fill(t.intro, { name: firstName }))}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px 20px;margin-bottom:18px">
            <tr><td>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(230,234,240,0.55)">${escapeHtml(t.refLabel)}</div>
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;color:#FF6A00;margin-top:4px;letter-spacing:0.1em">${escapeHtml(input.publicRef)}</div>
            </td></tr>
          </table>
          <p style="margin:0 0 0;font-size:13px;line-height:1.7;color:rgba(230,234,240,0.6)">${escapeHtml(t.ndaNote)}</p>
          <p style="margin:18px 0 0;font-size:12px;color:rgba(230,234,240,0.5)">IO SKY · Rotterdam, Netherlands · iosky.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendDevApplicationAck(
  input: DevAppEmailInput,
): Promise<GenericEmailResult> {
  const dt = devAppStrings(normaliseLocale(input.locale));
  const subject = fill(dt.subject, { ref: input.publicRef });
  const html = renderDevAppHtml(input);
  const text = `${fill(dt.textBody, { ref: input.publicRef })}\n\nIO SKY · Rotterdam, Netherlands · iosky.com`;
  return dispatchSimpleEmail({
    to: input.email,
    subject,
    html,
    text,
    refHeader: input.publicRef,
  });
}

// ---------------------------------------------------------------------------
// Shared simple-email dispatch (no attachments)
// ---------------------------------------------------------------------------

async function dispatchSimpleEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  refHeader: string;
}): Promise<GenericEmailResult> {
  const from = getFromEmail();
  const headers = { "X-IOSKY-Ref": args.refHeader };

  if (process.env.RESEND_API_KEY) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: args.to,
          subject: args.subject,
          html: args.html,
          text: args.text,
          headers,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        return {
          ok: false,
          transport: "resend",
          error: `Resend ${resp.status}: ${body.slice(0, 200)}`,
        };
      }
      const data = (await resp.json().catch(() => ({}))) as { id?: string };
      return { ok: true, transport: "resend", messageId: data.id };
    } catch (error) {
      return {
        ok: false,
        transport: "resend",
        error: (error as Error).message,
      };
    }
  }

  const smtp = getSmtpTransporter();
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from,
        to: args.to,
        subject: args.subject,
        text: args.text,
        html: args.html,
        headers,
      });
      return { ok: true, transport: "smtp", messageId: info.messageId };
    } catch (error) {
      return {
        ok: false,
        transport: "smtp",
        error: (error as Error).message,
      };
    }
  }

  console.info(
    "[Email] No transport configured — logging email:\n",
    JSON.stringify(
      { to: args.to, subject: args.subject, ref: args.refHeader },
      null,
      2,
    ),
  );
  return { ok: true, transport: "console" };
}
