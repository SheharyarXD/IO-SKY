/**
 * Pure rules for notification templates (OPD-001), the document matrix
 * (OPD-003, SRS 18.19 to 18.21) and Technical Operator scopes (SRS 15.4, 07.3).
 */

// ---- Notification templates -------------------------------------------------------------------------------------

export const TEMPLATE_CHANNELS = ["in_app", "email"] as const;
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number];
/** Dutch and English, English as the fallback (OPD-001). */
export const TEMPLATE_LOCALES = ["en", "nl"] as const;
export type TemplateLocale = (typeof TEMPLATE_LOCALES)[number];
export const FALLBACK_LOCALE: TemplateLocale = "en";

/** Only values the backend derives itself may appear in a template. Free form input is never a placeholder. */
export const TEMPLATE_PLACEHOLDERS = ["recipientName", "organizationName", "reference", "link", "date", "amount", "projectName"] as const;

export function templateVariantId(event: string, channel: string, locale: string, version: number): string {
  return `${event}:${channel}:${locale}:v${version}`;
}

export function placeholdersIn(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)).map((m) => m[1])));
}

export function validateTemplate(input: { subject: string; body: string }): { ok: true } | { ok: false; reason: string } {
  if (!input.subject.trim()) return { ok: false, reason: "A subject is required." };
  if (!input.body.trim()) return { ok: false, reason: "A body is required." };
  const unknown = placeholdersIn(`${input.subject}\n${input.body}`).filter((p) => !(TEMPLATE_PLACEHOLDERS as readonly string[]).includes(p));
  if (unknown.length) return { ok: false, reason: `Unknown placeholder: ${unknown.join(", ")}. Allowed: ${TEMPLATE_PLACEHOLDERS.join(", ")}.` };
  // Template text is plain text; markup would be an injection path into the email shell.
  if (/<\s*\/?\s*(script|iframe|object|embed|style|link|meta)\b/i.test(input.body)) return { ok: false, reason: "Markup is not allowed in template text." };
  return { ok: true };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Replaces placeholders. Missing values render empty. With html=true every value is escaped. */
export function renderTemplate(text: string, vars: Partial<Record<(typeof TEMPLATE_PLACEHOLDERS)[number], string>>, html = false): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key] ?? "";
    return html ? escapeHtml(v) : v;
  });
}

export function pickLocale(preferred: string | null | undefined, available: string[]): TemplateLocale {
  const p = (preferred ?? "").toLowerCase().slice(0, 2);
  if ((TEMPLATE_LOCALES as readonly string[]).includes(p) && available.includes(p)) return p as TemplateLocale;
  return FALLBACK_LOCALE;
}

// ---- Document matrix ---------------------------------------------------------------------------------------------

export const DOCUMENT_CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"] as const;

export function parseRoles(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function roleMayAccessDocumentType(role: string, row: { authorizedRoles: string; clientVisible: boolean } | null): boolean {
  if (!row) return role === "super_admin" || role === "admin";
  if (role === "client" && !row.clientVisible) return false;
  return parseRoles(row.authorizedRoles).includes(role);
}

// ---- Technical Operator scopes -----------------------------------------------------------------------------------

export const OPERATOR_SCOPES = ["frontend", "backend", "full_stack", "ui_ux", "infrastructure", "security", "database"] as const;
export type OperatorScope = (typeof OPERATOR_SCOPES)[number];

export type ScopeGrant = { scope: string; expiresAt: Date | null; revokedAt: Date | null };

export function scopeIsActive(g: ScopeGrant, now = new Date()): boolean {
  if (g.revokedAt) return false;
  if (g.expiresAt && g.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

/** Security Center access is never implied by the role: it needs an active security scope. Admins keep it. */
export function mayUseSecurityCenter(role: string, grants: ScopeGrant[], now = new Date()): boolean {
  if (role === "super_admin" || role === "admin") return true;
  if (role !== "technical_operator") return false;
  return grants.some((g) => g.scope === "security" && scopeIsActive(g, now));
}
