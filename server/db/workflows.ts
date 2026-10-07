/**
 * server/db/workflows.ts — Milestone 2 §2.6 workflow-definition engine.
 * See drizzle/schema.ts's workflowDefinitions/workflowRuns doc comment for
 * the deliberate scope boundary (closed trigger/action enums, not an
 * open-ended automation system).
 */
import { and, desc, eq, isNotNull, lte } from "drizzle-orm";
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
  scheduleCadence?: string | null;
  nextRunAt?: Date | null;
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

/**
 * Claim every scheduled workflow that is due and move its next run forward in
 * the same conditional update, so two app instances cannot both run it.
 */
export async function claimDueScheduledWorkflows(now: Date, nextAfter: (cadence: string, from: Date) => Date): Promise<WorkflowDefinition[]> {
  const db = await getDb();
  if (!db) return [];
  const due = await db
    .select()
    .from(workflowDefinitions)
    .where(and(eq(workflowDefinitions.triggerType, "schedule"), eq(workflowDefinitions.enabled, 1), isNotNull(workflowDefinitions.nextRunAt), lte(workflowDefinitions.nextRunAt, now)));
  const won: WorkflowDefinition[] = [];
  for (const d of due) {
    const claimed = await db
      .update(workflowDefinitions)
      .set({ nextRunAt: nextAfter(d.scheduleCadence ?? "daily", now) })
      .where(and(eq(workflowDefinitions.id, d.id), eq(workflowDefinitions.nextRunAt, d.nextRunAt!)))
      .returning({ id: workflowDefinitions.id });
    if (claimed.length > 0) won.push(d);
  }
  return won;
}
