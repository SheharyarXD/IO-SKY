/**
 * Campaign attribution (SRS 14.3, 14.16, 21.5).
 *
 * Real data only: every row is derived from the leads the platform captured and
 * the UTM tags they arrived with, plus the workflows that are actually running.
 * Nothing is estimated. Outbound campaign sending is a separate workstream and
 * has no data here yet, which the page says.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { leads, workflowDefinitions, workflowRuns } from "../../drizzle/schema";
import { getDb } from "./connection";

export type CampaignRow = {
  campaign: string;
  source: string;
  leads: number;
  last30Days: number;
  qualified: number;
  won: number;
  firstSeen: Date | null;
  lastSeen: Date | null;
};

export type CampaignOverview = {
  generatedAt: number;
  totals: { leads: number; attributed: number; unattributed: number; campaigns: number; sources: number; won: number; last30Days: number };
  rows: CampaignRow[];
  automations: { active: number; runs30Days: number; succeeded30Days: number; successRate: number | null };
};

export async function readCampaignOverview(now = Date.now()): Promise<CampaignOverview | null> {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(now - 30 * 86_400_000);
  const campaign = sql<string>`coalesce(nullif(trim(${leads.utmCampaign}), ''), '(no campaign tag)')`;
  const source = sql<string>`coalesce(nullif(trim(${leads.utmSource}), ''), ${leads.source})`;
  const rows = await db
    .select({
      campaign,
      source,
      leads: sql<number>`count(*)::int`,
      last30Days: sql<number>`count(*) filter (where ${leads.createdAt} >= ${since.toISOString()}::timestamp)::int`,
      qualified: sql<number>`count(*) filter (where ${leads.status} in ('qualified','engaged','won'))::int`,
      won: sql<number>`count(*) filter (where ${leads.status} = 'won')::int`,
      firstSeen: sql<Date | null>`min(${leads.createdAt})`,
      lastSeen: sql<Date | null>`max(${leads.createdAt})`,
    })
    .from(leads)
    .groupBy(campaign, source)
    .orderBy(sql`count(*) desc`)
    .limit(100);

  const total = rows.reduce((a, r) => a + r.leads, 0);
  const attributed = rows.filter((r) => r.campaign !== "(no campaign tag)").reduce((a, r) => a + r.leads, 0);
  const wf = await db.select({ n: sql<number>`count(*)::int` }).from(workflowDefinitions).where(eq(workflowDefinitions.enabled, 1));
  const runs = await db
    .select({
      total: sql<number>`count(*)::int`,
      ok: sql<number>`count(*) filter (where ${workflowRuns.status} = 'succeeded')::int`,
    })
    .from(workflowRuns)
    .where(and(gte(workflowRuns.ranAt, since)));
  const runTotal = runs[0]?.total ?? 0;
  const runOk = runs[0]?.ok ?? 0;
  return {
    generatedAt: now,
    totals: {
      leads: total,
      attributed,
      unattributed: total - attributed,
      campaigns: new Set(rows.filter((r) => r.campaign !== "(no campaign tag)").map((r) => r.campaign)).size,
      sources: new Set(rows.map((r) => r.source)).size,
      won: rows.reduce((a, r) => a + r.won, 0),
      last30Days: rows.reduce((a, r) => a + r.last30Days, 0),
    },
    rows: rows.map((r) => ({ ...r, firstSeen: r.firstSeen ? new Date(r.firstSeen) : null, lastSeen: r.lastSeen ? new Date(r.lastSeen) : null })),
    automations: { active: wf[0]?.n ?? 0, runs30Days: runTotal, succeeded30Days: runOk, successRate: runTotal > 0 ? Math.round((runOk / runTotal) * 1000) / 10 : null },
  };
}
