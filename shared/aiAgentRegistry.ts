/**
 * AI Agent Registry fields (task G02, SRS 19.17 "Each AI Agent shall include, at
 * a minimum: ...", 19.18, 19.20; 29 Oct Doc 1 ACC-36).
 *
 * Pure rules shared by the admin API, the admin page and the runtime. They
 * validate what a Super Admin enters and report which of the SRS minimum fields
 * an agent is still missing. They do not decide what any agent may do: that is
 * the permission check (19.18) and, for tools, the runtime (G03).
 */

/** SRS 19.20 "Knowledge sources may include". Stored as these stable keys. */
export const KNOWLEDGE_SOURCES = [
  "ai_scan_reports",
  "client_documentation",
  "project_documentation",
  "technical_documentation",
  "internal_procedures",
  "knowledge_base_articles",
  "product_documentation",
  "business_rules",
  "operational_data",
  "platform_configuration",
] as const;
export type KnowledgeSource = (typeof KNOWLEDGE_SOURCES)[number];

/**
 * SRS 19.18 "Maximum Operational Authority". Ordered from least to most:
 *   read_only          reads permitted data, produces no stored output
 *   draft_only         produces drafts or recommendations that a person uses
 *   act_with_approval  may act, but each action waits for a human decision
 *   act_autonomously   may act without a human decision
 */
export const AUTHORITY_LEVELS = ["read_only", "draft_only", "act_with_approval", "act_autonomously"] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

export const REGISTRY_LIMITS = { slug: 64, modules: 30, tools: 50, capabilities: 30, businessFunction: 160, escalation: 2000 } as const;

const SLUG = /^[a-z][a-z0-9_]{1,63}$/;

export type RegistryFieldsInput = {
  businessFunction?: string | null;
  capabilities?: string[];
  supportedModules?: string[];
  tools?: string[];
  knowledgeSources?: string[];
  escalationRules?: string | null;
  maxAuthority?: string;
  requiresHumanApproval?: boolean;
  responsibleAdminUserId?: number | null;
};

export type RegistryValidation = { ok: true } | { ok: false; errors: string[] };

function slugListErrors(label: string, list: string[] | undefined, max: number): string[] {
  if (!list) return [];
  const errors: string[] = [];
  if (list.length > max) errors.push(`${label}: at most ${max} entries.`);
  const seen = new Set<string>();
  for (const item of list) {
    if (!SLUG.test(item)) errors.push(`${label}: "${item.slice(0, 40)}" must be lower case letters, digits and underscores, starting with a letter.`);
    if (seen.has(item)) errors.push(`${label}: "${item}" is listed twice.`);
    seen.add(item);
  }
  return errors;
}

export function validateRegistryFields(input: RegistryFieldsInput): RegistryValidation {
  const errors: string[] = [];
  if (input.businessFunction && input.businessFunction.length > REGISTRY_LIMITS.businessFunction) errors.push(`Business function: at most ${REGISTRY_LIMITS.businessFunction} characters.`);
  if (input.escalationRules && input.escalationRules.length > REGISTRY_LIMITS.escalation) errors.push(`Escalation rules: at most ${REGISTRY_LIMITS.escalation} characters.`);
  errors.push(...slugListErrors("Supported modules", input.supportedModules, REGISTRY_LIMITS.modules));
  errors.push(...slugListErrors("Available tools", input.tools, REGISTRY_LIMITS.tools));
  errors.push(...slugListErrors("Authorized capabilities", input.capabilities, REGISTRY_LIMITS.capabilities));
  for (const k of input.knowledgeSources ?? []) {
    if (!(KNOWLEDGE_SOURCES as readonly string[]).includes(k)) errors.push(`Knowledge sources: "${k.slice(0, 40)}" is not a known source (${KNOWLEDGE_SOURCES.join(", ")}).`);
  }
  if ((input.knowledgeSources ?? []).length !== new Set(input.knowledgeSources ?? []).size) errors.push("Knowledge sources: a source is listed twice.");
  if (input.maxAuthority !== undefined && !(AUTHORITY_LEVELS as readonly string[]).includes(input.maxAuthority)) {
    errors.push(`Maximum authority must be one of ${AUTHORITY_LEVELS.join(", ")}.`);
  }
  // An agent that must wait for a person cannot also be allowed to act without one.
  if (input.maxAuthority === "act_autonomously" && input.requiresHumanApproval === true) {
    errors.push("An agent that requires human approval cannot have autonomous authority. Change one of the two.");
  }
  if (input.responsibleAdminUserId !== undefined && input.responsibleAdminUserId !== null && (!Number.isInteger(input.responsibleAdminUserId) || input.responsibleAdminUserId <= 0)) {
    errors.push("Responsible admin must be a valid user.");
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** Parse a stored JSON list of strings; anything else is an empty list. */
export function parseStringList(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export type RegistryRowLike = {
  key: string;
  name: string;
  purpose: string | null;
  businessFunction: string | null;
  supportedModules: string[];
  capabilities: string[];
  permissions: string[];
  escalationRules: string | null;
  responsibleAdminUserId: number | null;
  activePromptVersion: number | null;
  status: string;
};

/**
 * Which SRS 19.17 minimum fields are still empty for this agent. Tools and
 * knowledge sources may legitimately be empty (an agent can need neither), so
 * they are not "missing"; the rest must be filled in for the registry entry to
 * be complete.
 */
export function missingRegistryFields(a: RegistryRowLike): string[] {
  const missing: string[] = [];
  if (!a.name.trim()) missing.push("name");
  if (!(a.purpose ?? "").trim()) missing.push("description");
  if (!(a.businessFunction ?? "").trim()) missing.push("business function");
  if (a.supportedModules.length === 0) missing.push("supported modules");
  if (a.capabilities.length === 0) missing.push("authorized capabilities");
  if (a.permissions.length === 0) missing.push("assigned permissions");
  if (!(a.escalationRules ?? "").trim()) missing.push("escalation rules");
  if (a.responsibleAdminUserId === null) missing.push("responsible admin");
  if (a.activePromptVersion === null) missing.push("active prompt (version information)");
  return missing;
}

// ---------------------------------------------------------------------------
// Authority (SRS 19.18 "Maximum Operational Authority", G03)
// ---------------------------------------------------------------------------

/** What a tool does: read data, produce a draft a person uses, or act (change state outside the agent). */
export type ToolEffect = "read" | "draft" | "act";

export type AuthorityDecision = "execute" | "needs_approval" | "deny";

/**
 * May an agent with this maximum authority run a tool with this effect?
 *
 *   read   any level: reading permitted data changes nothing
 *   draft  needs draft_only or more: the output is a draft a person uses
 *   act    only act_autonomously executes, and only if the agent does not also
 *          require human approval. act_with_approval (or an agent that requires
 *          approval) is not executed: it becomes a request for a human decision.
 *          Below that the action is refused.
 *
 * Unknown values are refused, never treated as permissive.
 */
export function authorityDecision(maxAuthority: string, requiresHumanApproval: boolean, effect: ToolEffect): AuthorityDecision {
  const level = (AUTHORITY_LEVELS as readonly string[]).indexOf(maxAuthority);
  if (level < 0) return "deny";
  if (effect === "read") return "execute";
  if (effect === "draft") return level >= 1 ? "execute" : "deny";
  if (effect === "act") {
    if (level === 3) return requiresHumanApproval ? "needs_approval" : "execute";
    if (level === 2) return "needs_approval";
    return "deny";
  }
  return "deny";
}

