/**
 * server/db/webhooks.ts — Milestone 2 §2.6 integration/webhook registry.
 * See drizzle/schema.ts's webhookRegistrations/webhookDeliveries doc
 * comment for the deliberate scope boundary (subscribes to the same
 * closed trigger-type set the workflow engine uses).
 */
import { desc, eq } from "drizzle-orm";
import {
  webhookRegistrations,
  webhookDeliveries,
  type WebhookRegistration,
  type WebhookDelivery,
  type InsertWebhookDelivery,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export async function listWebhookRegistrations(): Promise<WebhookRegistration[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webhookRegistrations).orderBy(desc(webhookRegistrations.createdAt));
}

export async function listEnabledWebhookRegistrationsForTrigger(
  triggerType: WebhookRegistration["triggerType"],
): Promise<WebhookRegistration[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(webhookRegistrations)
    .where(eq(webhookRegistrations.triggerType, triggerType));
  return rows.filter((r) => r.enabled === 1);
}

export async function createWebhookRegistration(input: {
  name: string;
  url: string;
  secret: string | null;
  triggerType: WebhookRegistration["triggerType"];
  createdByUserId: number;
}): Promise<WebhookRegistration | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(webhookRegistrations).values(input).returning();
  return rows[0] ?? null;
}

export async function setWebhookRegistrationEnabled(
  id: number,
  enabled: boolean,
): Promise<WebhookRegistration | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(webhookRegistrations)
    .set({ enabled: enabled ? 1 : 0, updatedAt: new Date() })
    .where(eq(webhookRegistrations.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function recordWebhookDelivery(input: InsertWebhookDelivery): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(webhookDeliveries).values(input);
}

export async function listWebhookDeliveries(limit = 100): Promise<WebhookDelivery[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webhookDeliveries).orderBy(desc(webhookDeliveries.requestedAt)).limit(limit);
}
