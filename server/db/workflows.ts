/**
 * server/db/workflows.ts — Milestone 2 §2.6 workflow-definition engine.
 * See drizzle/schema.ts's workflowDefinitions/workflowRuns doc comment for
 * the deliberate scope boundary (closed trigger/action enums, not an
 * open-ended automation system).
 */
import { desc, eq } from "drizzle-orm";
import {
  workflowDefinitions,
  workflowRuns,
  type WorkflowDefinition,
  type WorkflowRun,
  type InsertWorkflowRun,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export async function listWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workflowDefinitions).orderBy(desc(workflowDefinitions.createdAt));
}

export async function listEnabledWorkflowDefinitionsForTrigger(
  triggerType: WorkflowDefinition["triggerType"],
): Promise<WorkflowDefinition[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.triggerType, triggerType));
  return rows.filter((r) => r.enabled === 1);
}

export async function createWorkflowDefinition(input: {
  name: string;
  triggerType: WorkflowDefinition["triggerType"];
  actionType: WorkflowDefinition["actionType"];
  actionConfig: string | null;
  createdByUserId: number;
}): Promise<WorkflowDefinition | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(workflowDefinitions).values(input).returning();
  return rows[0] ?? null;
}

export async function setWorkflowDefinitionEnabled(
  id: number,
  enabled: boolean,
): Promise<WorkflowDefinition | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(workflowDefinitions)
    .set({ enabled: enabled ? 1 : 0, updatedAt: new Date() })
    .where(eq(workflowDefinitions.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function recordWorkflowRun(input: InsertWorkflowRun): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(workflowRuns).values(input);
}

export async function listWorkflowRuns(limit = 100): Promise<WorkflowRun[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workflowRuns).orderBy(desc(workflowRuns.ranAt)).limit(limit);
}
