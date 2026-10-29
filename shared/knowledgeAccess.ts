/**
 * Permission rules for agent knowledge retrieval (task G05; SRS 19.17 "Accessible
 * Knowledge Sources", 19.20 "AI Agents shall only retrieve information that the
 * requesting user or AI Agent is authorized to access ... comply with
 * authorization, organization isolation, and security requirements").
 *
 * Three independent checks must all pass, and each is re-applied to what a
 * source returns, because a source can be wrong:
 *   1. the agent's registry entry lists the source;
 *   2. the audience of the run is high enough for the source (a caller on the
 *      phone is "public", a signed-in client "client", platform staff "internal");
 *   3. organisation isolation: an organisation-scoped source needs the run's
 *      organisation, and an item belonging to any other organisation is dropped.
 * Pure rules, no I/O.
 */
import type { KnowledgeSource } from "./aiAgentRegistry";

export const AUDIENCES = ["public", "client", "internal"] as const;
export type Audience = (typeof AUDIENCES)[number];

const rank = (a: string): number => (AUDIENCES as readonly string[]).indexOf(a);

export type SourcePolicy = {
  /** True when the source holds one organisation's data. */
  organizationScoped: boolean;
  /** The lowest audience that may read anything from the source at all. */
  minAudience: Audience;
};

/**
 * Defaults are strict: where the SRS does not say who may read a source, it is
 * not offered to a lower audience. Individual items can be stricter still.
 */
export const SOURCE_POLICY: Record<KnowledgeSource, SourcePolicy> = {
  ai_scan_reports: { organizationScoped: true, minAudience: "client" },
  client_documentation: { organizationScoped: true, minAudience: "client" },
  project_documentation: { organizationScoped: true, minAudience: "client" },
  operational_data: { organizationScoped: true, minAudience: "internal" },
  technical_documentation: { organizationScoped: false, minAudience: "internal" },
  internal_procedures: { organizationScoped: false, minAudience: "internal" },
  business_rules: { organizationScoped: false, minAudience: "internal" },
  platform_configuration: { organizationScoped: false, minAudience: "internal" },
  knowledge_base_articles: { organizationScoped: false, minAudience: "public" },
  product_documentation: { organizationScoped: false, minAudience: "public" },
};

/**
 * Audience for a person acting on the platform. Unknown, missing and developer
 * roles get the lowest: a developer's access to client material is by project
 * assignment, which this module does not model, so they are not given a client's.
 */
export function audienceForRole(role: string | null | undefined): Audience {
  if (role === "admin" || role === "super_admin" || role === "technical_operator") return "internal";
  if (role === "client") return "client";
  return "public";
}

export type RetrievalDenial = "unknown_source" | "source_not_granted" | "audience_too_low" | "organization_required" | "agent_unavailable";

export function authorizeRetrieval(a: {
  source: string;
  agentSources: readonly string[];
  audience: string;
  organizationId: number | null;
}): { allowed: true; policy: SourcePolicy } | { allowed: false; reason: RetrievalDenial } {
  const policy = (SOURCE_POLICY as Record<string, SourcePolicy | undefined>)[a.source];
  if (!policy) return { allowed: false, reason: "unknown_source" };
  if (!a.agentSources.includes(a.source)) return { allowed: false, reason: "source_not_granted" };
  if (rank(a.audience) < 0 || rank(a.audience) < rank(policy.minAudience)) return { allowed: false, reason: "audience_too_low" };
  if (policy.organizationScoped && a.organizationId === null) return { allowed: false, reason: "organization_required" };
  return { allowed: true, policy };
}

export type KnowledgeItemLike = { visibility: string; organizationId: number | null };

/**
 * Apply the item-level checks to whatever a source returned.
 *  - withheld: the item is above the run's audience;
 *  - crossOrganization: the item belongs to another organisation (or an
 *    organisation-scoped source returned an item with no organisation). It is
 *    dropped and counted separately because it means a source misbehaved.
 */
export function filterRetrieved<T extends KnowledgeItemLike>(
  items: T[],
  scope: { audience: string; organizationId: number | null; organizationScoped: boolean },
): { kept: T[]; withheld: number; crossOrganization: number } {
  const kept: T[] = [];
  let withheld = 0;
  let crossOrganization = 0;
  for (const item of items) {
    const sameOrg = item.organizationId === scope.organizationId;
    if (scope.organizationScoped ? !sameOrg : item.organizationId !== null && !sameOrg) {
      crossOrganization++;
      continue;
    }
    if (rank(item.visibility) < 0 || rank(item.visibility) > rank(scope.audience)) {
      withheld++;
      continue;
    }
    kept.push(item);
  }
  return { kept, withheld, crossOrganization };
}
