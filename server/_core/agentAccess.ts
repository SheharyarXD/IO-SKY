/**
 * API-layer enforcement of per-agent Technical Operator scopes (task G09).
 * Admins and Super Admins pass. A Technical Operator needs an active grant for
 * exactly this agent and this action. Anyone else, and any failure to read the
 * grants, is refused. A refusal is FORBIDDEN, which the audited wrapper records.
 */
import { TRPCError } from "@trpc/server";
import { operatorMayOnAgent, type AgentOperatorAction } from "../../shared/agentOperatorScopes";

export async function assertOperatorAgentAccess(user: { id: number; role: string }, agentKey: string, action: AgentOperatorAction): Promise<void> {
  if (user.role === "admin" || user.role === "super_admin") return;
  if (user.role !== "technical_operator") throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to AI agents." });
  let allowed = false;
  try {
    const { getScopeGrants } = await import("../db/platformGovernance");
    allowed = operatorMayOnAgent(user.role, await getScopeGrants(user.id), agentKey, action);
  } catch (err) {
    console.error("[agentAccess] operator grants could not be read, refusing:", err);
  }
  if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: `You have no active grant to ${action} this AI agent.` });
}
