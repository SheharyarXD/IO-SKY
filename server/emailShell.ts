/**
 * Branded transactional email shell and template resolution (OPD-001, SRS 17.8).
 *
 * One consistent header and footer for every transactional email, the logo
 * linking to the public homepage, and message text that an administrator can
 * change as a versioned template without a developer. Template text is plain
 * text with safe placeholders; it is escaped here, never inserted as markup.
 */
import { FALLBACK_LOCALE, pickLocale, renderTemplate, TEMPLATE_LOCALES } from "../shared/platformRules";
import { getActiveTemplate } from "./db/platformGovernance";

const BRAND = { ground: "#0D2D2E", accent: "#F58A1F", text: "#F4F1EA" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function siteBase(): string {
  return (process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || "https://iosky.com").replace(/\/$/, "");
}

export function brandedEmail(args: { title: string; paragraphs: string[]; cta?: { label: string; url: string } | null; footerNote?: string }): { html: string; text: string } {
  const base = siteBase();
  const paras = args.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text}">${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
  const cta = args.cta
    ? `<p style="margin:22px 0"><a href="${esc(args.cta.url)}" style="display:inline-block;background:${BRAND.accent};color:#0D2D2E;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${esc(args.cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:${BRAND.ground}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.ground}"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Helvetica,Arial,sans-serif">
<tr><td style="padding:0 0 22px"><a href="${esc(base)}" style="text-decoration:none;color:${BRAND.text};font-size:22px;font-weight:700;letter-spacing:.04em">IO <span style="color:${BRAND.accent}">SKY</span></a></td></tr>
<tr><td><h1 style="margin:0 0 16px;font-size:20px;color:${BRAND.text}">${esc(args.title)}</h1>${paras}${cta}</td></tr>
<tr><td style="padding-top:24px;border-top:1px solid rgba(255,255,255,.12);font-size:12px;color:rgba(244,241,234,.6)">${esc(args.footerNote ?? "IO SKY. You receive this message because of activity on your IO SKY account.")}<br/><a href="${esc(base)}" style="color:${BRAND.accent}">${esc(base.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [args.title, "", ...args.paragraphs, ...(args.cta ? ["", `${args.cta.label}: ${args.cta.url}`] : []), "", args.footerNote ?? "IO SKY", base].join("\n");
  return { html, text };
}

export type ResolvedMessage = { subject: string; paragraphs: string[]; fromTemplate: boolean; locale: string; templateVersion: number | null };

/**
 * Uses the active email template for this event in the recipient language, then in English,
 * and falls back to the supplied built in wording when none is active.
 */
export async function resolveEventMessage(
  eventName: string,
  preferredLocale: string | null | undefined,
  vars: Parameters<typeof renderTemplate>[1],
  fallback: { subject: string; paragraphs: string[] },
): Promise<ResolvedMessage> {
  try {
    const wanted = pickLocale(preferredLocale, [...TEMPLATE_LOCALES]);
    for (const loc of wanted === FALLBACK_LOCALE ? [FALLBACK_LOCALE] : [wanted, FALLBACK_LOCALE]) {
      const tpl = await getActiveTemplate(eventName, "email", loc);
      if (tpl) {
        return {
          subject: renderTemplate(tpl.subject, vars).slice(0, 300),
          paragraphs: renderTemplate(tpl.body, vars).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
          fromTemplate: true,
          locale: loc,
          templateVersion: tpl.version,
        };
      }
    }
  } catch {
    /* a template lookup failure must not stop the email */
  }
  return { ...fallback, fromTemplate: false, locale: FALLBACK_LOCALE, templateVersion: null };
}
