/**
 * Per-agent Technical Operator scopes (task G09; SRS 5.7, 13.8; 29 Oct Doc 1
 * Ch3.3 and F-26 "Per-agent Technical Operator scope enforcement at tool, data
 * and API layers").
 *
 * An operator's access to one AI agent is a grant in the existing
 * `operator_scopes` table, with the scope written as
 *
 *     agent:<agent key>:<action>        action = view | run | approve
 *
 * so expiry, revocation and the grant audit trail are the ones that already
 * exist. Access to Agent A never implies Agent B, and `view` never implies
 * `run` or `approve`: each is its own grant. Admins and Super Admins are not
 * limited by these grants. Pure rules, no I/O.
 */
import { scopeIsActive, type ScopeGrant } from "./platformRules";

export const AGENT_OPERATOR_ACTIONS = ["view", "run", "approve"] as const;
export type AgentOperatorAction = (typeof AGENT_OPERATOR_ACTIONS)[number];

const AGENT_SCOPE = /^agent:([a-z][a-z0-9_]{1,63}):(view|run|approve)$/;

export function agentScope(agentKey: string, action: AgentOperatorAction): string {
  return `agent:${agentKey}:${action}`;
}

export function parseAgentScope(scope: string): { agentKey: string; action: AgentOperatorAction } | null {
  const m = AGENT_SCOPE.exec(scope);
  return m ? { agentKey: m[1], action: m[2] as AgentOperatorAction } : null;
}

/**
 * May this user perform this action on this agent right now?
 *  - Admin and Super Admin: yes.
 *  - Technical Operator: only with an ACTIVE grant (not revoked, not expired) for
 *    exactly this agent and exactly this action.
 *  - Anyone else: no.
 */
export function operatorMayOnAgent(role: string | null | undefined, grants: ScopeGrant[], agentKey: string, action: AgentOperatorAction, now = new Date()): boolean {
  if (role === "admin" || role === "super_admin") return true;
  if (role !== "technical_operator") return false;
  const wanted = agentScope(agentKey, action);
  return grants.some((g) => g.scope === wanted && scopeIsActive(g, now));
}

/** The agents and actions an operator holds at the moment, for display. */
export function activeAgentGrants(grants: ScopeGrant[], now = new Date()): Array<{ agentKey: string; actions: AgentOperatorAction[] }> {
  const byAgent = new Map<string, Set<AgentOperatorAction>>();
  for (const g of grants) {
    const p = parseAgentScope(g.scope);
    if (!p || !scopeIsActive(g, now)) continue;
    if (!byAgent.has(p.agentKey)) byAgent.set(p.agentKey, new Set());
    byAgent.get(p.agentKey)!.add(p.action);
  }
  return [...byAgent.entries()].map(([agentKey, set]) => ({ agentKey, actions: AGENT_OPERATOR_ACTIONS.filter((a) => set.has(a)) })).sort((a, b) => a.agentKey.localeCompare(b.agentKey));
}

/** A scope string a Super Admin may grant: one of the platform scopes, or a well formed agent scope. */
export function isGrantableAgentScope(scope: string): boolean {
  return AGENT_SCOPE.test(scope);
}
