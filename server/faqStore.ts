/**
 * The approved FAQ source and the `answer_faq` agent tool (task R17).
 *
 * The FAQ store is the platform's `knowledge_base_articles` source: public
 * information the business has written and approved. Two things are built on the
 * same rows:
 *   - a KnowledgeProvider, so search_knowledge_base_articles lists approved
 *     entries like any other source (title = question, snippet = answer);
 *   - `answer_faq`, which returns ONE stored answer verbatim with its id and
 *     version, or "no_match" with an instruction to say the information is not
 *     available and offer a person. It never composes an answer.
 * Only approved entries are ever read (db layer) and they are filtered again here.
 */
import { z } from "zod";
import type { KnowledgeSource } from "../shared/aiAgentRegistry";
import { answerFromFaq, usableEntries, words, type FaqEntry } from "../shared/faqRules";
import { authorizeRetrieval, type Audience } from "../shared/knowledgeAccess";
import type { AgentTool, ToolContext } from "./agentRuntime";
import type { KnowledgeDeps, KnowledgeItem, KnowledgeProvider } from "./knowledgeStore";

export const FAQ_SOURCE: KnowledgeSource = "knowledge_base_articles";

export type FaqDeps = Pick<KnowledgeDeps, "loadAgent" | "record"> & { listApproved(): Promise<FaqEntry[]> };

export const NO_MATCH_INSTRUCTION = "Tell the caller you do not have that information and offer to take their details for a person to follow up. Do not guess and do not answer from general knowledge.";
export const ANSWER_INSTRUCTION = "Give this approved answer. You may shorten or read it aloud naturally, but add no facts, prices, dates or promises that are not in it.";

export function faqProvider(deps: Pick<FaqDeps, "listApproved">): KnowledgeProvider {
  return {
    source: FAQ_SOURCE,
    async search({ query, audience, limit }): Promise<KnowledgeItem[]> {
      const asked = words(query);
      if (asked.length === 0) return [];
      const entries = usableEntries(await deps.listApproved(), audience);
      return entries
        .map((e) => {
          const have = new Set([...words(e.question), ...e.keywords.flatMap(words)]);
          return { e, shared: asked.filter((w) => have.has(w)).length };
        })
        .filter((x) => x.shared > 0)
        .sort((a, b) => b.shared - a.shared || a.e.id - b.e.id)
        .slice(0, limit)
        .map(({ e }) => ({ id: `faq:${e.id}`, title: e.question, snippet: e.answer, sourceRef: `faq:${e.id}@v${e.version}`, visibility: e.audience as Audience, organizationId: null }));
    },
  };
}

export type FaqToolResult =
  | { status: "answer"; faqId: number; version: number; answer: string; instruction: string }
  | { status: "no_match"; instruction: string }
  | { status: "denied"; reason: string };

export function faqTools(deps: FaqDeps): AgentTool[] {
  return [
    {
      name: "answer_faq",
      description: "Look up the approved answer to a general question about IO SKY. Returns a stored answer or no_match. Use it before answering any general question about the business.",
      parameters: { type: "object", properties: { question: { type: "string", minLength: 3, maxLength: 300 } }, required: ["question"], additionalProperties: false },
      inputSchema: z.object({ question: z.string().min(3).max(300) }).strict(),
      effect: "read" as const,
      requiredPermission: "search_knowledge",
      knowledgeSource: FAQ_SOURCE,
      organizationScoped: false,
      execute: async (input: unknown, ctx: ToolContext): Promise<FaqToolResult> => {
        const { question } = input as { question: string };
        const audit = (action: string, detail: string) => deps.record({ agentKey: ctx.agentKey, action, subjectRef: ctx.subjectRef, detail }).catch(() => null);

        // The same checks the retrieval store applies, so the tool is safe if called outside the runtime too.
        let agent: Awaited<ReturnType<FaqDeps["loadAgent"]>>;
        try {
          agent = await deps.loadAgent(ctx.agentKey);
        } catch {
          return { status: "denied", reason: "agent_unavailable" };
        }
        if (!agent || agent.status !== "active") return { status: "denied", reason: "agent_unavailable" };
        const audience = ctx.audience ?? "public";
        const auth = authorizeRetrieval({ source: FAQ_SOURCE, agentSources: agent.knowledgeSources, audience, organizationId: ctx.organizationId });
        if (!auth.allowed) {
          await audit(`faq_denied`, auth.reason);
          return { status: "denied", reason: auth.reason };
        }

        const entries = usableEntries(await deps.listApproved(), audience);
        const r = answerFromFaq(question, entries);
        if (r.status === "no_match") {
          // Unanswered questions are the FAQ's gap list: count and reason only, never the question text.
          await audit("faq_no_match", `reason=${r.reason}; querylen=${question.length}`);
          return { status: "no_match", instruction: NO_MATCH_INSTRUCTION };
        }
        await audit("faq_answered", `faq=${r.faqId}; version=${r.version}; score=${r.score}`);
        return { status: "answer", faqId: r.faqId, version: r.version, answer: r.answer, instruction: ANSWER_INSTRUCTION };
      },
    },
  ] as AgentTool[];
}
