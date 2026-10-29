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

/**
 * SRS 18.8 / GOV-08: a client sees a document only when the matrix opens its
 * type to clients. `allowedTypes` is the allow-list of client-visible types, or
 * null when the matrix could not be read. The check fails closed: a typed
 * document whose type is missing from the matrix, or any typed document while
 * the matrix is unreadable, is hidden. Documents with no type are outside the
 * matrix and keep their existing organisation-scoped visibility.
 */
export function clientMayViewDocument(doc: { documentType: string | null | undefined }, allowedTypes: ReadonlySet<string> | null): boolean {
  if (!doc.documentType) return true;
  return allowedTypes !== null && allowedTypes.has(doc.documentType);
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

/**
 * Every Technical Operator operation and the scopes that open it (SRS 5.7,
 * 13.8, GOV-06, task Z09). An operator needs at least one ACTIVE (not revoked,
 * not expired) grant from the list; the role alone opens nothing. Admins and
 * Super Admins are not scope limited. A new operator endpoint must pick an
 * operation here, and an operation with no entry is refused.
 *
 * The mapping of operation to scope is an engineering reading of the seven
 * existing scopes and is listed in MILESTONE4_BLOCKERS.md for confirmation.
 */
export const OPS_OPERATION_SCOPES = {
  system_health: ["infrastructure", "backend", "full_stack"],
  email_log: ["infrastructure", "backend", "full_stack"],
  platform_health: ["infrastructure", "backend", "full_stack"],
  deployments: ["infrastructure", "backend", "full_stack"],
  incidents: ["infrastructure", "security"],
  alerts: ["infrastructure", "security"],
  compliance: ["security", "infrastructure"],
  security: ["security"],
} as const satisfies Record<string, readonly OperatorScope[]>;
export type OpsOperation = keyof typeof OPS_OPERATION_SCOPES;

export function operatorMayPerform(role: string, grants: ScopeGrant[], operation: OpsOperation, now = new Date()): boolean {
  if (role === "super_admin" || role === "admin") return true;
  if (role !== "technical_operator") return false;
  const allowed: readonly string[] | undefined = OPS_OPERATION_SCOPES[operation];
  if (!allowed) return false;
  return grants.some((g) => allowed.includes(g.scope) && scopeIsActive(g, now));
}

/** Security Center access is never implied by the role: it needs an active security scope. Admins keep it. */
export function mayUseSecurityCenter(role: string, grants: ScopeGrant[], now = new Date()): boolean {
  return operatorMayPerform(role, grants, "security", now);
}
