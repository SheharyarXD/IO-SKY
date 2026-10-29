/**
 * Pure CRM matching helpers for the AI receptionist tools (task R18; SRS 14.16;
 * 29 Oct Doc 1 Ch6 "search and deduplicate existing CRM records ... do not
 * disclose existing-client protected data without verification"). No I/O.
 */

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * A phone number reduced to the digits that identify the line, so
 * "+31 6 12 34 56 78", "0031612345678" and "06-12345678" compare equal. The last
 * nine digits are used when there are more, which drops country and trunk
 * prefixes. Null when there are too few digits to be a number.
 */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length > 9 ? digits.slice(-9) : digits;
}

export type MatchedOn = "email" | "phone";

export function matchedOn(lead: { email: string; phone: string | null }, probe: { email?: string | null; phone?: string | null }): MatchedOn[] {
  const out: MatchedOn[] = [];
  const pe = normalizeEmail(probe.email);
  if (pe && normalizeEmail(lead.email) === pe) out.push("email");
  const pk = phoneKey(probe.phone);
  if (pk && phoneKey(lead.phone) === pk) out.push("phone");
  return out;
}

/** Structured qualification (29 Oct Doc 1 Ch6): why they called, in the fields staff look for. */
export type Qualification = {
  businessChallenge?: string;
  desiredOutcome?: string;
  organisationContext?: string;
  constraints?: string;
  schedulingPreference?: string;
};

const QUAL_LABELS: Array<[keyof Qualification, string]> = [
  ["businessChallenge", "Business challenge"],
  ["desiredOutcome", "Desired outcome"],
  ["organisationContext", "Organisational context"],
  ["constraints", "Constraints"],
  ["schedulingPreference", "Scheduling preference"],
];

/** A note body staff can read at a glance. The first line always says an assistant wrote it. */
export function composeNoteBody(a: { text?: string; reason?: string; qualification?: Qualification }): string {
  const lines = ["[Recorded by the AI assistant during a conversation; not yet reviewed by a person.]"];
  if (a.reason?.trim()) lines.push(`Reason for contact: ${a.reason.trim()}`);
  for (const [k, label] of QUAL_LABELS) {
    const v = a.qualification?.[k]?.trim();
    if (v) lines.push(`${label}: ${v}`);
  }
  if (a.text?.trim()) lines.push(a.text.trim());
  return lines.join("\n");
}
