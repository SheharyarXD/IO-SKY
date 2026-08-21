/**
 * server/workflowEngine.ts — Milestone 2 §2.6 workflow-definition engine
 * executor.
 *
 * Deliberately bounded: `runWorkflowsForTrigger` is the only entry point,
 * called from real event sites in the app (currently: document
 * approve/reject in server/routers/admin.ts). It looks up every enabled
 * `workflow_definitions` row matching the trigger, runs its fixed,
 * already-existing action (`notify_owner` via the Resend transport built
 * in §2.3, or `audit_log` via the existing login_audit trail), and writes
 * one `workflow_runs` row per execution — success or failure — so the
 * engine's behavior is always inspectable via `admin.listWorkflowRuns`.
 *
 * Adding a new trigger type is a two-step, low-risk change: add the value
 * to `workflowDefinitionsTriggerTypeEnum` (drizzle/schema.ts, its own
 * migration per the ALTER TYPE convention already established), then call
 * `runWorkflowsForTrigger(...)` at the real event site. This function
 * itself never needs to change for that.
 */
import {
  listEnabledWorkflowDefinitionsForTrigger,
  recordWorkflowRun,
  appendLoginAudit,
} from "./db";
import { notifyOwner } from "./_core/notification";
import type { WorkflowDefinition } from "../drizzle/schema";

/** Substitutes {{field}} tokens in an actionConfig template from a flat context object. */
function renderTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => context[key] ?? "");
}

export async function runWorkflowsForTrigger(
  triggerType: WorkflowDefinition["triggerType"],
  context: Record<string, string>,
  triggerEntityRef?: string | null,
): Promise<void> {
  const definitions = await listEnabledWorkflowDefinitionsForTrigger(triggerType);

  for (const def of definitions) {
    try {
      if (def.actionType === "notify_owner") {
        const template = def.actionConfig || `Workflow "${def.name}" fired for {{triggerType}} ({{ref}}).`;
        const content = renderTemplate(template, {
          ...context,
          triggerType,
          ref: triggerEntityRef ?? "",
        });
        await notifyOwner({ title: `Workflow: ${def.name}`, content });
      } else if (def.actionType === "audit_log") {
        await appendLoginAudit({
          userId: null,
          identifier: null,
          provider: "workflow",
          outcome: "success",
          reason: `workflow:${def.name}:${triggerType}:${triggerEntityRef ?? ""}`.slice(0, 200),
          ip: null,
          userAgent: null,
        });
      }
      await recordWorkflowRun({
        workflowDefinitionId: def.id,
        triggerType,
        triggerEntityRef: triggerEntityRef ?? null,
        status: "succeeded",
        resultMessage: null,
      });
    } catch (err) {
      // A workflow failure must never break the real operation that fired
      // it (approving a document must still succeed even if the owner
      // notification email isn't configured) — logged, not thrown.
      console.error(`[workflowEngine] definition ${def.id} (${def.name}) failed:`, err);
      await recordWorkflowRun({
        workflowDefinitionId: def.id,
        triggerType,
        triggerEntityRef: triggerEntityRef ?? null,
        status: "failed",
        resultMessage: err instanceof Error ? err.message.slice(0, 500) : "Unknown error",
      });
    }
  }
}
