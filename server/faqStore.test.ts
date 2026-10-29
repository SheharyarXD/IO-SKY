/*
 * R17 (SRS 19.12; 29 Oct Ch6.1): the assistants answer general questions only from
 * approved FAQ content. Database-free: the FAQ rows are injected.
 */
import { describe, expect, it } from "vitest";
import { answerFromFaq, reviewWarnings, statusAfterEdit, transitionFaq, usableEntries, validateFaqDraft, words, type FaqEntry } from "../shared/faqRules";
import { parseKeywords } from "./db/faq";
import { ANSWER_INSTRUCTION, faqProvider, faqTools, NO_MATCH_INSTRUCTION, type FaqDeps } from "./faqStore";
import { runAgent, ToolRegistry, type AgentDefinition, type AgentModel, type ModelTurn, type RuntimeDeps } from "./agentRuntime";

const entry = (over: Partial<FaqEntry> & { id: number; question: string; answer: string }): FaqEntry => ({ keywords: [], audience: "public", status: "approved", version: 1, lastEditedByUserId: 1, approvedByUserId: 2, ...over });

const HOURS = entry({ id: 1, question: "What are your opening hours?", answer: "We are open Monday to Friday, 9am to 5pm UK time.", keywords: ["office hours", "open", "what time"] });
const PAYMENT = entry({ id: 2, question: "Which payment methods do you accept?", answer: "We accept card payments and bank transfer.", keywords: ["pay", "invoice"] });
const SECURITY = entry({ id: 3, question: "Are my files kept private?", answer: "Client files are only visible to your organisation and the staff working on your project.", audience: "client" });

describe("workflow", () => {
  const base = { actorUserId: 9, actorRole: "admin", lastEditedByUserId: 1 };
  it("moves draft to in_review to approved, and only staff may decide", () => {
    expect(transitionFaq({ ...base, status: "draft", action: "submit" })).toMatchObject({ ok: true, to: "in_review" });
    expect(transitionFaq({ ...base, status: "in_review", action: "approve" })).toMatchObject({ ok: true, to: "approved", audit: "faq.approve:in_review->approved" });
    for (const role of ["client", "developer", "technical_operator", null, undefined]) expect(transitionFaq({ ...base, actorRole: role, status: "in_review", action: "approve" })).toEqual({ ok: false, reason: "not_staff" });
  });

  it("cannot skip review: a draft cannot be approved and an approved entry cannot be re-approved", () => {
    expect(transitionFaq({ ...base, status: "draft", action: "approve" })).toEqual({ ok: false, reason: "invalid_transition" });
    expect(transitionFaq({ ...base, status: "approved", action: "approve" })).toEqual({ ok: false, reason: "invalid_transition" });
    expect(transitionFaq({ ...base, status: "retired", action: "approve" })).toEqual({ ok: false, reason: "invalid_transition" });
  });

  it("the person who wrote or last changed the wording cannot approve it", () => {
    expect(transitionFaq({ ...base, actorUserId: 1, status: "in_review", action: "approve" })).toEqual({ ok: false, reason: "self_approval" });
    // but may still send it back or retire it
    expect(transitionFaq({ ...base, actorUserId: 1, status: "in_review", action: "reject" })).toMatchObject({ ok: true, to: "draft" });
    expect(transitionFaq({ ...base, actorUserId: 1, status: "approved", action: "retire" })).toMatchObject({ ok: true, to: "retired" });
  });

  it("retired entries come back only as drafts that must be reviewed again", () => {
    expect(transitionFaq({ ...base, status: "retired", action: "restore" })).toMatchObject({ ok: true, to: "draft" });
  });

  it("changing an approved or in-review entry takes it out of service until re-approved", () => {
    expect(statusAfterEdit("approved", true)).toEqual({ status: "draft", bumpVersion: true });
    expect(statusAfterEdit("in_review", true)).toEqual({ status: "draft", bumpVersion: true });
    expect(statusAfterEdit("approved", false)).toEqual({ status: "approved", bumpVersion: false });
    expect(statusAfterEdit("retired", true).status).toBe("retired");
  });
});

describe("what an assistant may use", () => {
  it("only approved entries, never drafts, in-review or retired", () => {
    const all = (["draft", "in_review", "approved", "retired"] as const).map((status, i) => entry({ id: i + 1, question: "q", answer: "a", status }));
    expect(usableEntries(all, "public").map((e) => e.status)).toEqual(["approved"]);
  });
  it("client-only entries are not offered to a public caller", () => {
    expect(usableEntries([HOURS, SECURITY], "public").map((e) => e.id)).toEqual([1]);
    expect(usableEntries([HOURS, SECURITY], "client").map((e) => e.id)).toEqual([1, 3]);
    expect(usableEntries([HOURS, SECURITY], "internal").map((e) => e.id)).toEqual([1, 3]);
    expect(usableEntries([HOURS, SECURITY], "something_else").map((e) => e.id)).toEqual([1]);
  });
});

describe("answering", () => {
  it("returns the stored answer verbatim with its id and version", () => {
    const r = answerFromFaq("what time are you open?", [HOURS, PAYMENT]);
    expect(r).toMatchObject({ status: "answer", faqId: 1, version: 1, answer: HOURS.answer });
  });
  it("matches different phrasing, plurals and keywords", () => {
    expect(answerFromFaq("do you accept card payments", [HOURS, PAYMENT])).toMatchObject({ status: "answer", faqId: 2 });
    expect(answerFromFaq("what are your office hours", [HOURS, PAYMENT])).toMatchObject({ status: "answer", faqId: 1 });
  });
  it("is deterministic", () => {
    const a = answerFromFaq("opening hours", [HOURS, PAYMENT]);
    for (let i = 0; i < 5; i++) expect(answerFromFaq("opening hours", [HOURS, PAYMENT])).toEqual(a);
  });
  it("declines rather than inventing: no entries, no overlap, weak overlap, empty question", () => {
    expect(answerFromFaq("opening hours", [])).toEqual({ status: "no_match", reason: "no_entries" });
    expect(answerFromFaq("do you build mobile games for consoles", [HOURS, PAYMENT])).toEqual({ status: "no_match", reason: "no_overlap" });
    expect(answerFromFaq("what is the price of hours of training courses abroad", [HOURS, PAYMENT])).toMatchObject({ status: "no_match", reason: "weak_match" });
    expect(answerFromFaq("the and of", [HOURS])).toEqual({ status: "no_match", reason: "empty_question" });
    expect(answerFromFaq("", [HOURS])).toEqual({ status: "no_match", reason: "empty_question" });
  });
  it("a single shared word is not enough for a multi-word question", () => {
    expect(answerFromFaq("hours", [HOURS])).toMatchObject({ status: "answer" }); // the question really is one word
    expect(answerFromFaq("how many hours does a website take", [HOURS])).toMatchObject({ status: "no_match" });
  });
  it("two different answers that fit equally well are declined, not guessed", () => {
    const a = entry({ id: 10, question: "How do I contact support?", answer: "Email support." });
    const b = entry({ id: 11, question: "How do I contact sales?", answer: "Email sales." });
    expect(answerFromFaq("how do I contact", [a, b])).toEqual({ status: "no_match", reason: "ambiguous" });
    expect(answerFromFaq("contact support", [a, b])).toMatchObject({ status: "answer", faqId: 10 });
  });
  it("words() normalises case, punctuation, accents and stop words", () => {
    expect(words("What are YOUR Opening-Hours?!")).toEqual(["open", "hour"]);
    expect(words("Café payments")).toContain("payment");
  });
});

describe("authoring checks", () => {
  it("rejects too short, too long, too generic, too many keywords", () => {
    expect(validateFaqDraft({ question: "Hi", answer: "x".repeat(10), keywords: [] })).toContain("question_length");
    expect(validateFaqDraft({ question: "How much?", answer: "Hi", keywords: [] })).toContain("answer_length");
    expect(validateFaqDraft({ question: "Is it?", answer: "Yes it is.", keywords: [] })).toContain("question_too_generic");
    expect(validateFaqDraft({ question: "What are your hours?", answer: "x".repeat(2001), keywords: [] })).toContain("answer_length");
    expect(validateFaqDraft({ question: "What are your hours?", answer: "Nine to five.", keywords: Array(21).fill("k") })).toContain("keywords");
    expect(validateFaqDraft({ question: "What are your hours?", answer: "Nine to five.", keywords: ["hours"] })).toEqual([]);
  });
  it("warns the reviewer about guarantees, advice and prices without blocking", () => {
    expect(reviewWarnings("We guarantee delivery in a week.")).toContain("contains_guarantee");
    expect(reviewWarnings("This is not legal advice.")).toContain("contains_advice");
    expect(reviewWarnings("It costs £500.")).toContain("contains_price");
    expect(reviewWarnings("We are open nine to five.")).toEqual([]);
  });
  it("parseKeywords survives corrupt stored values", () => {
    expect(parseKeywords('["a","b"]')).toEqual(["a", "b"]);
    expect(parseKeywords("not json")).toEqual([]);
    expect(parseKeywords('{"a":1}')).toEqual([]);
    expect(parseKeywords('["a",1,null]')).toEqual(["a"]);
    expect(parseKeywords(null)).toEqual([]);
  });
});

describe("the answer_faq tool", () => {
  type Rec = { action: string; detail: string };
  function setup(over: { entries?: FaqEntry[]; sources?: string[]; status?: string; loadThrows?: boolean; audience?: "public" | "client" | "internal" } = {}) {
    const recorded: Rec[] = [];
    const deps: FaqDeps = {
      loadAgent: async () => {
        if (over.loadThrows) throw new Error("registry down");
        return { status: over.status ?? "active", knowledgeSources: over.sources ?? ["knowledge_base_articles"] };
      },
      record: async (a) => (recorded.push({ action: a.action, detail: a.detail }), 1),
      listApproved: async () => over.entries ?? [HOURS, PAYMENT, SECURITY],
    };
    const tool = faqTools(deps)[0];
    const ctx = { agentKey: "reception", subjectRef: "call:1", organizationId: null, actorUserId: null, audience: over.audience };
    return { tool, ctx, recorded, call: (question: string) => tool.execute({ question }, ctx as never) as Promise<{ status: string; [k: string]: unknown }> };
  }

  it("answers from an approved entry and records the entry id and version, not the question", async () => {
    const s = setup();
    const r = await s.call("what are your opening hours");
    expect(r).toMatchObject({ status: "answer", faqId: 1, version: 1, answer: HOURS.answer, instruction: ANSWER_INSTRUCTION });
    expect(s.recorded).toHaveLength(1);
    expect(s.recorded[0].action).toBe("faq_answered");
    expect(JSON.stringify(s.recorded)).not.toContain("opening hours");
  });

  it("declines with an instruction not to guess, and records the gap without the question text", async () => {
    const s = setup();
    const r = await s.call("can you build a rocket");
    expect(r).toEqual({ status: "no_match", instruction: NO_MATCH_INSTRUCTION });
    expect(s.recorded[0]).toMatchObject({ action: "faq_no_match" });
    expect(JSON.stringify(s.recorded)).not.toContain("rocket");
  });

  it("never answers from a draft or retired entry, even if the data layer returned one", async () => {
    const s = setup({ entries: [{ ...HOURS, status: "draft" }, { ...PAYMENT, status: "retired" }] });
    expect((await s.call("opening hours")).status).toBe("no_match");
    expect((await s.call("payment methods")).status).toBe("no_match");
  });

  it("a public caller is not given a client-only answer; a client is", async () => {
    expect((await setup({ audience: "public" }).call("are my files kept private")).status).toBe("no_match");
    expect(await setup({ audience: "client" }).call("are my files kept private")).toMatchObject({ status: "answer", faqId: 3 });
    expect((await setup().call("are my files kept private")).status).toBe("no_match"); // audience not stated = public
  });

  it("fails closed when the agent does not list the source, is disabled, or its registry cannot be read", async () => {
    expect(await setup({ sources: ["client_documentation"] }).call("opening hours")).toMatchObject({ status: "denied", reason: "source_not_granted" });
    expect(await setup({ status: "disabled" }).call("opening hours")).toMatchObject({ status: "denied", reason: "agent_unavailable" });
    expect(await setup({ loadThrows: true }).call("opening hours")).toMatchObject({ status: "denied", reason: "agent_unavailable" });
  });

  it("an empty store (for example migration 0042 not applied) is a no_match, never an invented answer", async () => {
    expect((await setup({ entries: [] }).call("opening hours")).status).toBe("no_match");
  });

  it("is a Level 1 read tool gated by the search permission and the knowledge source", () => {
    const t = faqTools({} as FaqDeps)[0];
    expect(t).toMatchObject({ name: "answer_faq", effect: "read", requiredPermission: "search_knowledge", knowledgeSource: "knowledge_base_articles", organizationScoped: false });
    expect(t.identityRequirement).toBeUndefined();
    expect(t.inputSchema.safeParse({ question: "ok?", extra: 1 }).success).toBe(false);
  });
});

describe("the FAQ as a knowledge provider", () => {
  const list = async () => [HOURS, PAYMENT, SECURITY, { ...entry({ id: 4, question: "Secret opening plans", answer: "x" }), status: "draft" as const }];
  it("lists only usable entries for the audience, with a source reference carrying the version", async () => {
    const p = faqProvider({ listApproved: list });
    const pub = await p.search({ query: "opening hours", organizationId: null, audience: "public", limit: 5 });
    expect(pub.map((i) => i.id)).toEqual(["faq:1"]);
    expect(pub[0]).toMatchObject({ title: HOURS.question, snippet: HOURS.answer, sourceRef: "faq:1@v1", visibility: "public", organizationId: null });
    expect((await p.search({ query: "files private", organizationId: null, audience: "public", limit: 5 })).length).toBe(0);
    expect((await p.search({ query: "files private", organizationId: null, audience: "client", limit: 5 })).map((i) => i.id)).toEqual(["faq:3"]);
  });
  it("returns nothing for a query with no meaningful words and respects the limit", async () => {
    const p = faqProvider({ listApproved: list });
    expect(await p.search({ query: "the and", organizationId: null, audience: "client", limit: 5 })).toEqual([]);
    expect((await p.search({ query: "payment hours files", organizationId: null, audience: "client", limit: 2 })).length).toBe(2);
  });
});

describe("inside the shared runtime", () => {
  it("an agent with the source answers from the FAQ, and one without it cannot call the tool", async () => {
    const deps: FaqDeps = { loadAgent: async () => ({ status: "active", knowledgeSources: ["knowledge_base_articles"] }), record: async () => 1, listApproved: async () => [HOURS] };
    const reg = new ToolRegistry();
    for (const t of faqTools(deps)) reg.register(t);
    const run = async (sources: string[]) => {
      const turns: ModelTurn[] = [{ kind: "tool_calls", calls: [{ id: "c", name: "answer_faq", arguments: JSON.stringify({ question: "opening hours" }) }] }, { kind: "final", content: "ok" }];
      let i = 0;
      const model: AgentModel = { complete: async () => turns[Math.min(i++, 1)] };
      const def: AgentDefinition = { key: "reception", status: "active", permissions: ["converse", "search_knowledge"], requiresHumanApproval: false, tools: ["answer_faq"], knowledgeSources: sources, maxAuthority: "read_only", escalationRules: null };
      const rd: RuntimeDeps = { loadAgent: async () => def, authorise: async () => ({ outcome: "completed" }), record: async () => 1, escalate: async () => undefined, actorGrants: async () => [], model, tools: reg };
      return runAgent({ agentKey: "reception", subjectRef: "call:1", runPermission: "converse", system: "s", userMessage: "u", ctx: { organizationId: null, actorUserId: null } }, rd);
    };
    const ok = await run(["knowledge_base_articles"]);
    expect(ok.status === "completed" && ok.toolCalls[0]).toMatchObject({ outcome: "executed" });
    const refused = await run([]);
    expect(refused.status === "completed" && refused.toolCalls[0]).toMatchObject({ outcome: "refused" });
  });
});
