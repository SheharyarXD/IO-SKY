/**
 * Mediated messaging (task J07; SRS 15.10, 17.x; 29 Oct Ch10.1). Pure rules.
 *
 * DECISION (engineering, to be matched against the client document): developers
 * and clients never talk to each other directly. IO SKY staff sit in the middle:
 *   - RELAY: staff carry a point from one side to the other. The message that
 *     arrives is written and sent by staff as "IO SKY"; it is never a copy under
 *     the original sender's name. The system refuses a relay whose text reveals who
 *     is on the other side (full name, email, phone, company), so the confidentiality
 *     of SRS 15.10 does not depend on staff remembering.
 *   - BROADCAST to developers: staff message one developer, a team, or everyone
 *     active on a project. Each recipient gets their own staff message in their own
 *     thread; nobody sees who else received it.
 *   - Internal notes stay in the staff tools and are not messages to anyone.
 * Every relay and broadcast is recorded, with who sent it and how many received it.
 */

export const MESSAGE_LIMITS = { subject: 200, body: 8000, recipients: 100 } as const;

export type HiddenIdentity = { kind: "name" | "email" | "phone" | "company"; value: string };

export type LeakReport = { blocking: Array<{ kind: HiddenIdentity["kind"] }>; warnings: Array<{ kind: "first_name" }> };

const squash = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
const digits = (s: string) => s.replace(/\D/g, "");

/**
 * What in a message would tell the reader who is on the other side. Full name, email, phone and company are
 * blocking: staff must reword. A bare first name is only a warning, because common given names are also
 * ordinary words and refusing them would make relays unusable.
 */
export function findIdentityLeaks(text: string, identities: HiddenIdentity[]): LeakReport {
  const hay = squash(text);
  const hayDigits = digits(text);
  const blocking: LeakReport["blocking"] = [];
  const warnings: LeakReport["warnings"] = [];
  const seen = new Set<string>();
  for (const id of identities) {
    const v = squash(id.value);
    if (v.length < 2) continue;
    let hit = false;
    if (id.kind === "phone") {
      const d = digits(id.value);
      hit = d.length >= 7 && hayDigits.includes(d.slice(-9));
    } else if (id.kind === "email") {
      hit = hay.includes(v);
    } else {
      hit = new RegExp(`(^|[^\\p{L}\\p{N}])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(hay);
      if (!hit && id.kind === "name") {
        const first = v.split(" ")[0];
        if (first.length >= 3 && new RegExp(`(^|[^\\p{L}\\p{N}])${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(hay) && !seen.has("first_name")) {
          seen.add("first_name");
          warnings.push({ kind: "first_name" });
        }
      }
    }
    if (hit && !seen.has(id.kind)) {
      seen.add(id.kind);
      blocking.push({ kind: id.kind });
    }
  }
  return { blocking, warnings };
}

export const LEAK_TEXT: Record<HiddenIdentity["kind"], string> = {
  name: "the other party's name",
  email: "the other party's email address",
  phone: "the other party's phone number",
  company: "the other party's company name",
};

export function describeLeaks(r: LeakReport): string {
  return `This message reveals ${r.blocking.map((b) => LEAK_TEXT[b.kind]).join(", ")}. Reword it so the other side stays anonymous.`;
}

export type MessageCheck = { ok: true; subject: string | null; body: string } | { ok: false; reason: "empty_body" | "body_too_long" | "subject_too_long" };

export function checkMessage(a: { subject?: string | null; body: string }): MessageCheck {
  const body = a.body.replace(/\r\n/g, "\n").trim();
  const subject = a.subject?.replace(/\s+/g, " ").trim() || null;
  if (body.length === 0) return { ok: false, reason: "empty_body" };
  if (body.length > MESSAGE_LIMITS.body) return { ok: false, reason: "body_too_long" };
  if (subject && subject.length > MESSAGE_LIMITS.subject) return { ok: false, reason: "subject_too_long" };
  return { ok: true, subject, body };
}

export type Recipients = { ok: true; ids: number[] } | { ok: false; reason: "no_recipients" | "too_many" };

/** De-duplicate, drop invalid ids, and refuse an empty or oversized audience. */
export function planRecipients(ids: number[]): Recipients {
  const unique = [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))];
  if (unique.length === 0) return { ok: false, reason: "no_recipients" };
  if (unique.length > MESSAGE_LIMITS.recipients) return { ok: false, reason: "too_many" };
  return { ok: true, ids: unique };
}

export type RelayDirection = "developer_to_client" | "client_to_developer";

/** The name staff messages carry on both sides. */
export const STAFF_SENDER_NAME = "IO SKY";

export const MESSAGE_REFUSAL_TEXT = {
  empty_body: "Write the message first.",
  body_too_long: "That message is too long.",
  subject_too_long: "That subject is too long.",
  no_recipients: "There is nobody to send this to.",
  too_many: "That audience is too large. Send it in smaller groups.",
} as const;
