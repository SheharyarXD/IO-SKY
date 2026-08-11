/**
 * server/db/solutions.ts
 *
 * Database helpers for the Solutions & Ecosystem domain.
 * Covers: ecosystem click events, proposal requests, and custom discovery sessions.
 *
 * Tables touched: ecosystem_click_events, ecosystem_proposal_requests,
 * custom_discovery_sessions.
 */
import { desc, eq } from "drizzle-orm";
import {
  customDiscoverySessions,
  ecosystemClickEvents,
  ecosystemProposalRequests,
  type CustomDiscoverySession,
  type EcosystemClickEvent,
  type EcosystemProposalRequest,
  type InsertCustomDiscoverySession,
  type InsertEcosystemClickEvent,
  type InsertEcosystemProposalRequest,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Ecosystem Click Events
// ---------------------------------------------------------------------------

export async function recordEcosystemClick(
  input: InsertEcosystemClickEvent,
): Promise<EcosystemClickEvent | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(ecosystemClickEvents).values(input).returning();
  return rows[0] ?? null;
}

export async function listRecentEcosystemClicks(
  limit = 100,
): Promise<EcosystemClickEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(ecosystemClickEvents)
    .orderBy(desc(ecosystemClickEvents.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Ecosystem Proposal Requests
// ---------------------------------------------------------------------------

export async function createEcosystemProposalRequest(
  input: InsertEcosystemProposalRequest,
): Promise<EcosystemProposalRequest | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(ecosystemProposalRequests).values(input).returning();
  return rows[0] ?? null;
}

export async function listEcosystemProposalRequests(
  limit = 100,
): Promise<EcosystemProposalRequest[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(ecosystemProposalRequests)
    .orderBy(desc(ecosystemProposalRequests.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Custom Discovery Sessions
// ---------------------------------------------------------------------------

export async function getCustomDiscoveryByToken(
  token: string,
): Promise<CustomDiscoverySession | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(customDiscoverySessions)
    .where(eq(customDiscoverySessions.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertCustomDiscoverySession(
  token: string,
  patch: Partial<InsertCustomDiscoverySession>,
): Promise<CustomDiscoverySession | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await getCustomDiscoveryByToken(token);
  if (existing) {
    await db
      .update(customDiscoverySessions)
      .set(patch)
      .where(eq(customDiscoverySessions.id, existing.id));
    return (await getCustomDiscoveryByToken(token)) ?? null;
  }
  await db
    .insert(customDiscoverySessions)
    .values({ ...patch, token } as InsertCustomDiscoverySession);
  return (await getCustomDiscoveryByToken(token)) ?? null;
}

export async function listCustomDiscoverySessions(
  limit = 100,
): Promise<CustomDiscoverySession[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customDiscoverySessions)
    .orderBy(desc(customDiscoverySessions.createdAt))
    .limit(limit);
}
