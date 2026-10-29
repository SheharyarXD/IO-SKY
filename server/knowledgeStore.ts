/**
 * Permission-aware knowledge retrieval for AI agents (task G05, SRS 19.17,
 * 19.20). A source is a provider that searches data the platform already holds;
 * nothing here needs a vector database or an external service.
 *
 * The store, not the provider, decides what comes back: the agent's registry
 * entry is read on every call (so a revoked source stops at once and a registry
 * that cannot be read denies), the run's audience and organisation are applied
 * before the provider is asked and again to what it returns, and every
 * retrieval is recorded with counts but never the query text or the content.
 * A source with no provider is reported as unavailable, not as an empty result,
 * so an agent can never mistake "no data source exists" for "nothing found".
 */
import { z } from "zod";
import type { KnowledgeSource } from "../shared/aiAgentRegistry";
import { authorizeRetrieval, filterRetrieved, SOURCE_POLICY, type Audience, type RetrievalDenial } from "../shared/knowledgeAccess";
import type { AgentTool, RunContext, ToolContext } from "./agentRuntime";

export type KnowledgeItem = {
  id: string;
  title: string;
  snippet: string;
  /** Where it came from, for the audit trail and for a person to open it. */
  sourceRef: string;
  /** The lowest audience allowed to read this item. */
  visibility: Audience;
  organizationId: number | null;
};

export interface KnowledgeProvider {
  source: KnowledgeSource;
  search(q: { query: string; organizationId: number | null; audience: Audience; limit: number }): Promise<KnowledgeItem[]>;
}

export type KnowledgeDeps = {
  loadAgent(key: string): Promise<{ status: string; knowledgeSources: string[] } | null>;
  record(a: { agentKey: string; action: string; subjectRef: string; detail: string }): Promise<number | null>;
  providers: ReadonlyMap<string, KnowledgeProvider>;
};

export type RetrievalRequest = {
  agentKey: string;
  source: string;
  query: string;
  subjectRef: string;
  ctx: Pick<RunContext, "organizationId"> & { audience?: Audience };
  limit?: number;
};

export type RetrievalResult =
  | { status: "ok"; items: Array<Omit<KnowledgeItem, "organizationId">>; withheld: number }
  | { status: "denied"; reason: RetrievalDenial | "invalid_query" }
  | { status: "unavailable" }
  | { status: "error" };

const MAX_LIMIT = 10;
const SNIPPET = 300;

export async function retrieveKnowledge(req: RetrievalRequest, deps: KnowledgeDeps): Promise<RetrievalResult> {
  const audit = (action: string, detail: string) => deps.record({ agentKey: req.agentKey, action: action.slice(0, 120), subjectRef: req.subjectRef, detail }).catch(() => null);
  const deny = async (reason: RetrievalDenial | "invalid_query"): Promise<RetrievalResult> => {
    await audit(`knowledge_denied:${req.source}`, reason);
    return { status: "denied", reason };
  };

  const query = (req.query ?? "").trim();
  if (query.length < 2 || query.length > 200) return deny("invalid_query");

  // Fail closed: an unreadable, missing or disabled agent retrieves nothing.
  let agent: Awaited<ReturnType<KnowledgeDeps["loadAgent"]>>;
  try {
    agent = await deps.loadAgent(req.agentKey);
  } catch {
    return deny("agent_unavailable");
  }
  if (!agent || agent.status !== "active") return deny("agent_unavailable");

  const audience = req.ctx.audience ?? "public"; // least privilege unless the caller says otherwise
  const auth = authorizeRetrieval({ source: req.source, agentSources: agent.knowledgeSources, audience, organizationId: req.ctx.organizationId });
  if (!auth.allowed) return deny(auth.reason);

  const provider = deps.providers.get(req.source);
  if (!provider) {
    await audit(`knowledge_unavailable:${req.source}`, "no data source");
    return { status: "unavailable" };
  }

  const limit = Math.min(Math.max(1, Math.floor(req.limit ?? 5)), MAX_LIMIT);
  let found: KnowledgeItem[];
  try {
    found = await provider.search({ query, organizationId: req.ctx.organizationId, audience, limit });
  } catch (err) {
    await audit(`knowledge_error:${req.source}`, (err as Error).message.slice(0, 200));
    return { status: "error" };
  }

  // The provider is not trusted: organisation and audience are applied again to what it returned.
  const { kept, withheld, crossOrganization } = filterRetrieved(found, { audience, organizationId: req.ctx.organizationId, organizationScoped: auth.policy.organizationScoped });
  if (crossOrganization > 0) await audit(`knowledge_cross_organization_blocked:${req.source}`, `blocked=${crossOrganization}`);
  await audit(`knowledge:${req.source}`, `returned=${Math.min(kept.length, limit)}; withheld=${withheld}; querylen=${query.length}`);
  return {
    status: "ok",
    withheld,
    items: kept.slice(0, limit).map(({ organizationId: _org, snippet, ...rest }) => ({ ...rest, snippet: snippet.slice(0, SNIPPET) })),
  };
}

// ---------------------------------------------------------------------------
// As agent tools
// ---------------------------------------------------------------------------

/**
 * One read-only tool per SRS 19.20 source. The runtime enforces that the agent
 * lists the tool, the knowledge source and the `search_knowledge` permission;
 * retrieveKnowledge enforces them again, so the same checks hold if a tool is
 * ever called outside the runtime.
 */
export function knowledgeTools(deps: KnowledgeDeps): AgentTool[] {
  return (Object.keys(SOURCE_POLICY) as KnowledgeSource[]).map((source) => ({
    name: `search_${source}`,
    description: `Search ${source.replace(/_/g, " ")} that this agent is allowed to read. Returns titles and short snippets only.`,
    parameters: {
      type: "object",
      properties: { query: { type: "string", minLength: 2, maxLength: 200 }, limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT } },
      required: ["query"],
      additionalProperties: false,
    },
    inputSchema: z.object({ query: z.string().min(2).max(200), limit: z.number().int().min(1).max(MAX_LIMIT).optional() }).strict(),
    effect: "read" as const,
    requiredPermission: "search_knowledge",
    knowledgeSource: source,
    organizationScoped: SOURCE_POLICY[source].organizationScoped,
    execute: async (input: unknown, ctx: ToolContext) => {
      const i = input as { query: string; limit?: number };
      return retrieveKnowledge({ agentKey: ctx.agentKey, source, query: i.query, limit: i.limit, subjectRef: ctx.subjectRef, ctx }, deps);
    },
  })) as AgentTool[];
}
