/**
 * Discovery qualification capture rules (task R19; SRS 14.7, 29 Oct Doc 1 Ch6.1).
 * What a caller says about why they want a discovery call is recorded in the
 * fields staff look for, on the CRM record AND on the appointment, so the person
 * taking the call has it in front of them. Pure rules, no I/O.
 *
 *  - Captured text is untrusted caller speech: trimmed, control characters
 *    removed, capped, and scrubbed of card numbers and credentials a caller may
 *    read out. Scrubbed categories are reported so the assistant can tell the
 *    caller not to share them; the sensitive text itself is never stored.
 *  - Completeness is explicit: the assistant is told which fields are missing and
 *    the next question to ask, instead of deciding for itself that it has enough.
 *  - The appointment note holds ONE delimited block that is replaced on each
 *    capture, so repeated calls never grow the note, and the guest's own note
 *    outside the block is left alone.
 */
import type { Qualification } from "./crmRules";

export const QUALIFICATION_FIELDS = ["businessChallenge", "desiredOutcome", "organisationContext", "constraints", "schedulingPreference"] as const;
export type QualificationField = (typeof QUALIFICATION_FIELDS)[number];

/** The two that say why they called. The call can be booked without the rest, but these are always asked for. */
export const REQUIRED_FIELDS: readonly QualificationField[] = ["businessChallenge", "desiredOutcome"];

export const FIELD_LIMITS: Record<QualificationField, number> = { businessChallenge: 500, desiredOutcome: 500, organisationContext: 500, constraints: 500, schedulingPreference: 300 };

export const QUESTION_FOR: Record<QualificationField, string> = {
  businessChallenge: "What is the main challenge or problem you want help with?",
  desiredOutcome: "What would a good outcome look like for you?",
  organisationContext: "Can you tell me a little about your organisation and who is involved?",
  constraints: "Are there any constraints we should know about, such as budget, deadline or existing systems?",
  schedulingPreference: "Is there a time of day or day of the week that suits you best?",
};

export type Redaction = "card_number" | "credential";

// ---------------------------------------------------------------------------
// Sanitising
// ---------------------------------------------------------------------------

function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const CREDENTIAL = /\b(?:password|passcode|passphrase|pin(?:\s+(?:code|number))?|cvv|cvc|security\s+code|one[-\s]?time\s+code|otp)\b\s*(?:(?:is|was|:|=)\s*\S+|\S*\d\S*)/gi;

/** Remove card numbers (13 to 19 digits passing the Luhn check) and "password is ..." style statements. */
export function scrubSensitive(text: string): { text: string; redactions: Redaction[] } {
  const found = new Set<Redaction>();
  let out = text.replace(/(?<![\d])(?:\d[ -]?){12,18}\d(?![\d])/g, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      found.add("card_number");
      return "[card number removed]";
    }
    return m;
  });
  out = out.replace(CREDENTIAL, () => {
    found.add("credential");
    return "[credential removed]";
  });
  return { text: out, redactions: [...found] };
}

/** One captured value: control characters out, whitespace collapsed, sensitive text removed, length capped. */
export function sanitizeValue(field: QualificationField, raw: unknown): { value: string | undefined; redactions: Redaction[] } {
  if (typeof raw !== "string") return { value: undefined, redactions: [] };
  const cleaned = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
  const { text, redactions } = scrubSensitive(cleaned);
  const value = text.trim().slice(0, FIELD_LIMITS[field]).trim();
  // Nothing but a removal marker is not an answer.
  if (value.replace(/\[(?:card number|credential) removed\]/g, "").replace(/[^A-Za-z0-9]/g, "").length < 2) return { value: undefined, redactions };
  return { value: value.length >= 2 ? value : undefined, redactions };
}

export function sanitizeQualification(input: Partial<Record<QualificationField, unknown>>): { qualification: Qualification; redactions: Redaction[] } {
  const qualification: Qualification = {};
  const all = new Set<Redaction>();
  for (const f of QUALIFICATION_FIELDS) {
    const { value, redactions } = sanitizeValue(f, input[f]);
    redactions.forEach((r) => all.add(r));
    if (value) qualification[f] = value;
  }
  return { qualification, redactions: [...all] };
}

/** Newly captured fields replace earlier ones; fields not mentioned this time are kept. */
export function mergeQualification(existing: Qualification, incoming: Qualification): Qualification {
  const out: Qualification = { ...existing };
  for (const f of QUALIFICATION_FIELDS) if (incoming[f]) out[f] = incoming[f];
  return out;
}

export type Assessment = { complete: boolean; captured: QualificationField[]; missing: QualificationField[]; nextField: QualificationField | null; nextQuestion: string | null };

/** Which fields are on record and what to ask next (required fields first, in a natural order). */
export function assessQualification(q: Qualification): Assessment {
  const captured = QUALIFICATION_FIELDS.filter((f) => Boolean(q[f]));
  const missing = QUALIFICATION_FIELDS.filter((f) => !q[f]);
  const missingRequired = REQUIRED_FIELDS.filter((f) => !q[f]);
  const nextField = missingRequired[0] ?? missing[0] ?? null;
  return { complete: missingRequired.length === 0, captured, missing, nextField, nextQuestion: nextField ? QUESTION_FOR[nextField] : null };
}

// ---------------------------------------------------------------------------
// The appointment note
// ---------------------------------------------------------------------------

export const BLOCK_START = "--- Discovery qualification (recorded by the AI assistant; not yet reviewed by a person) ---";
export const BLOCK_END = "--- end of qualification ---";
export const NOTE_MAX = 4000;

const LABEL: Record<QualificationField, string> = { businessChallenge: "Business challenge", desiredOutcome: "Desired outcome", organisationContext: "Organisational context", constraints: "Constraints", schedulingPreference: "Scheduling preference" };

export function composeQualificationBlock(q: Qualification): string {
  const lines = QUALIFICATION_FIELDS.filter((f) => q[f]).map((f) => `${LABEL[f]}: ${q[f]}`);
  return [BLOCK_START, ...lines, BLOCK_END].join("\n");
}

function blockRange(note: string): { start: number; end: number } | null {
  const start = note.indexOf(BLOCK_START);
  if (start < 0) return null;
  const endAt = note.indexOf(BLOCK_END, start);
  if (endAt < 0) return null;
  return { start, end: endAt + BLOCK_END.length };
}

/** Read back the qualification an earlier capture stored on the appointment. */
export function parseQualificationBlock(note: string | null | undefined): Qualification {
  const q: Qualification = {};
  if (!note) return q;
  const r = blockRange(note);
  if (!r) return q;
  for (const line of note.slice(r.start, r.end).split("\n")) {
    for (const f of QUALIFICATION_FIELDS) {
      const prefix = `${LABEL[f]}: `;
      if (line.startsWith(prefix)) q[f] = line.slice(prefix.length).trim();
    }
  }
  return q;
}

/** Put the block into a note: replace the earlier block if there is one, otherwise append. The guest's own text is kept. */
export function applyQualificationBlock(note: string | null | undefined, q: Qualification): string {
  const block = composeQualificationBlock(q);
  const current = note ?? "";
  const r = blockRange(current);
  const rest = r ? (current.slice(0, r.start).trimEnd() + (current.slice(r.end).trim() ? "\n" + current.slice(r.end).trim() : "")).trim() : current.trim();
  const own = rest.slice(0, Math.max(0, NOTE_MAX - block.length - 2));
  return own ? `${own}\n\n${block}` : block;
}
