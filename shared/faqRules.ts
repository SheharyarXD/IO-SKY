/**
 * Approved FAQ store rules (task R17; SRS 19.12, 29 Oct Ch6.1 "answers only from
 * approved FAQ content, no invention"). Pure rules, no I/O.
 *
 *  - An entry is usable by an agent only when it is APPROVED and not retired.
 *  - Changing an approved entry's question, answer or audience takes it out of
 *    service until it is approved again, so an unreviewed wording is never spoken.
 *  - The person who last changed an entry cannot be the one who approves it.
 *  - An answer is the stored text verbatim with its id and version. When nothing
 *    matches well enough the result is "no_match": the agent must say it does not
 *    have that information and offer a human, never improvise one.
 *
 * Matching is deliberately simple and deterministic (normalised word overlap),
 * so the same question always gives the same answer and a test can pin it.
 */

export const FAQ_STATUSES = ["draft", "in_review", "approved", "retired"] as const;
export type FaqStatus = (typeof FAQ_STATUSES)[number];

export const FAQ_AUDIENCES = ["public", "client"] as const;
export type FaqAudience = (typeof FAQ_AUDIENCES)[number];

export const FAQ_LIMITS = { question: 300, answer: 2000, keywords: 20, keywordLength: 40 } as const;

/** Share of a question's meaningful words that must be covered, and the minimum number of shared words. */
export const FAQ_MATCH = { minScore: 0.6, minSharedWords: 2, ambiguityMargin: 0.1 } as const;

export type FaqEntry = {
  id: number;
  question: string;
  answer: string;
  keywords: string[];
  audience: FaqAudience;
  status: FaqStatus;
  version: number;
  lastEditedByUserId: number | null;
  approvedByUserId: number | null;
};

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export type FaqAction = "submit" | "approve" | "reject" | "retire" | "restore";

export type FaqTransition = { ok: true; to: FaqStatus; audit: string } | { ok: false; reason: "invalid_transition" | "self_approval" | "not_staff" };

const NEXT: Record<FaqStatus, Partial<Record<FaqAction, FaqStatus>>> = {
  draft: { submit: "in_review", retire: "retired" },
  in_review: { approve: "approved", reject: "draft", retire: "retired" },
  approved: { retire: "retired" },
  retired: { restore: "draft" },
};

export function transitionFaq(a: { status: FaqStatus; action: FaqAction; actorUserId: number; actorRole: string | null | undefined; lastEditedByUserId: number | null }): FaqTransition {
  if (a.actorRole !== "admin" && a.actorRole !== "super_admin") return { ok: false, reason: "not_staff" };
  const to = NEXT[a.status]?.[a.action];
  if (!to) return { ok: false, reason: "invalid_transition" };
  // Separation of duties: whoever wrote or last changed the wording cannot be the one who makes it speakable.
  if (a.action === "approve" && a.lastEditedByUserId !== null && a.lastEditedByUserId === a.actorUserId) return { ok: false, reason: "self_approval" };
  return { ok: true, to, audit: `faq.${a.action}:${a.status}->${to}` };
}

/**
 * What an edit does to the entry's status. Wording, audience and keywords all
 * change what the assistant may say or to whom, so any change to an approved or
 * in-review entry returns it to draft and bumps the version.
 */
export function statusAfterEdit(current: FaqStatus, changed: boolean): { status: FaqStatus; bumpVersion: boolean } {
  if (!changed) return { status: current, bumpVersion: false };
  if (current === "retired") return { status: "retired", bumpVersion: true };
  return { status: "draft", bumpVersion: true };
}

/** The entries an agent may use: approved only, and only for audiences the run is allowed to serve. */
export function usableEntries<T extends Pick<FaqEntry, "status" | "audience">>(entries: T[], audience: string): T[] {
  return entries.filter((e) => e.status === "approved" && (e.audience === "public" || (e.audience === "client" && (audience === "client" || audience === "internal"))));
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const STOP = new Set(["a", "an", "the", "is", "are", "was", "were", "do", "does", "did", "can", "could", "i", "you", "we", "my", "your", "our", "me", "to", "of", "in", "on", "for", "and", "or", "it", "this", "that", "with", "at", "be", "how", "what", "when", "where", "who", "which", "please", "tell", "about", "have", "has", "will", "would", "there", "any", "get", "need", "want"]);

export function words(text: string): string[] {
  const out = (text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
  return [...new Set(out)];
}

/** Very light stemming so "payments" matches "payment" and "booking" matches "book". Deterministic, English only. */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export type FaqMatch = { entryId: number; score: number; shared: number };

export type FaqAnswer =
  | { status: "answer"; faqId: number; version: number; question: string; answer: string; score: number }
  | { status: "no_match"; reason: "no_entries" | "no_overlap" | "weak_match" | "ambiguous" | "empty_question" };

/**
 * Pick the stored answer for a question or decline. Score = share of the asker's
 * meaningful words found in the entry's question and keywords. A near tie between
 * two different answers is declined rather than guessed.
 */
export function answerFromFaq(question: string, entries: Array<Pick<FaqEntry, "id" | "question" | "answer" | "keywords" | "version">>): FaqAnswer {
  const asked = words(question);
  if (asked.length === 0) return { status: "no_match", reason: "empty_question" };
  if (entries.length === 0) return { status: "no_match", reason: "no_entries" };

  const scored = entries
    .map((e) => {
      const have = new Set([...words(e.question), ...e.keywords.flatMap((k) => words(k))]);
      const shared = asked.filter((w) => have.has(w)).length;
      return { e, shared, score: shared / asked.length };
    })
    .sort((x, y) => y.score - x.score || y.shared - x.shared || x.e.id - y.e.id);

  const top = scored[0];
  if (top.shared === 0) return { status: "no_match", reason: "no_overlap" };
  if (top.score < FAQ_MATCH.minScore || top.shared < Math.min(FAQ_MATCH.minSharedWords, asked.length)) return { status: "no_match", reason: "weak_match" };
  const runnerUp = scored[1];
  if (runnerUp && runnerUp.e.answer !== top.e.answer && top.score - runnerUp.score < FAQ_MATCH.ambiguityMargin && runnerUp.score >= FAQ_MATCH.minScore) return { status: "no_match", reason: "ambiguous" };
  return { status: "answer", faqId: top.e.id, version: top.e.version, question: top.e.question, answer: top.e.answer, score: Math.round(top.score * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Authoring checks
// ---------------------------------------------------------------------------

/** Wording that must not be written into an answer the assistant will speak: guarantees, prices, legal or medical advice. */
const RISKY = [/\bguarantee[sd]?\b/i, /\b(?:legal|medical|tax)\s+advice\b/i, /(?:£|\$|€)\s?\d/];

export function validateFaqDraft(d: { question: string; answer: string; keywords: string[] }): string[] {
  const problems: string[] = [];
  if (d.question.trim().length < 5 || d.question.length > FAQ_LIMITS.question) problems.push("question_length");
  if (d.answer.trim().length < 5 || d.answer.length > FAQ_LIMITS.answer) problems.push("answer_length");
  if (d.keywords.length > FAQ_LIMITS.keywords || d.keywords.some((k) => k.length > FAQ_LIMITS.keywordLength)) problems.push("keywords");
  if (words(d.question).length < 1) problems.push("question_too_generic");
  return problems;
}

/** Non-blocking warnings for the reviewer: phrases that commonly turn into commitments the business did not intend to make. */
export function reviewWarnings(answer: string): string[] {
  return RISKY.filter((r) => r.test(answer)).map((r) => (r.source.includes("guarantee") ? "contains_guarantee" : r.source.includes("advice") ? "contains_advice" : "contains_price"));
}
