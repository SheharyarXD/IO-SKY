/**
 * CRM, commercial and financial write paths required by Master SRS v1.1:
 * opportunities (14.8), proposals (14.11), activities and follow ups
 * (14.9, 14.10), customer timelines (14.9), quotations (16.6),
 * subscriptions (16.10) and financial summaries (16.12).
 *
 * No authorisation opinion here. The lifecycle rules themselves live in
 * shared/srsRules.ts so they are tested without a database.
 */
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  clientInvoices,
  clientProjects,
  crmActivities,
  crmOpportunities,
  crmProposals,
  leads,
  quotes,
  subscriptions,
  type CrmActivity,
  type CrmOpportunity,
  type CrmProposal,
  type Quote,
  type Subscription,
} from "../../drizzle/schema";
import {
  canMoveDocument,
  canMoveOpportunity,
  checkCanClose,
  computeQuoteTotal,
  type DocumentStatus,
  type OpportunityStage,
  type QuoteLine,
} from "../../shared/srsRules";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

export async function createOpportunity(args: {
  title: string;
  leadId: number | null;
  organizationId: number | null;
  valueCents: number;
  currency: string;
  ownerUserId: number | null;
  expectedCloseDate: string | null;
}): Promise<CrmOpportunity | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(crmOpportunities).values(args).returning();
  return rows[0] ?? null;
}

export async function listOpportunities(stage?: OpportunityStage): Promise<CrmOpportunity[]> {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(crmOpportunities);
  return (stage ? q.where(eq(crmOpportunities.stage, stage)) : q).orderBy(desc(crmOpportunities.updatedAt)).limit(500);
}

export type MoveOpportunityResult =
  | { ok: true; opportunity: CrmOpportunity; handoverProjectId: number | null }
  | { ok: false; reason: string; code: "NOT_FOUND" | "PRECONDITION_FAILED" };

/**
 * Move an opportunity along its lifecycle. Winning creates the project handover
 * (SRS 14.15) in the same transaction as the stage change, so a won deal can
 * never exist without its project, and a failed insert rolls the stage back.
 */
export async function moveOpportunity(args: {
  id: number;
  to: OpportunityStage;
  lostReason: string | null;
}): Promise<MoveOpportunityResult | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx): Promise<MoveOpportunityResult> => {
    // Row lock: two admins closing the same deal must not both create a project.
    const row = (
      await tx.select().from(crmOpportunities).where(eq(crmOpportunities.id, args.id)).for("update").limit(1)
    )[0];
    if (!row) return { ok: false, code: "NOT_FOUND", reason: "Opportunity not found." };
    if (!canMoveOpportunity(row.stage as OpportunityStage, args.to)) {
      return { ok: false, code: "PRECONDITION_FAILED", reason: `Cannot move from ${row.stage} to ${args.to}.` };
    }
    let handoverProjectId: number | null = null;
    if (args.to === "won" || args.to === "lost") {
      const verdict = checkCanClose(args.to, { organizationId: row.organizationId, lostReason: args.lostReason });
      if (!verdict.ok) return { ok: false, code: "PRECONDITION_FAILED", reason: verdict.reason };
    }
    if (args.to === "won") {
      const project = await tx
        .insert(clientProjects)
        .values({
          organizationId: row.organizationId!,
          name: row.title,
          phase: "Discovery",
          status: "planning",
          summary: `Created from won opportunity #${row.id}.`,
        })
        .returning({ id: clientProjects.id });
      handoverProjectId = project[0]?.id ?? null;
    }
    const updated = await tx
      .update(crmOpportunities)
      .set({
        stage: args.to,
        lostReason: args.to === "lost" ? args.lostReason?.trim() ?? null : row.lostReason,
        handoverClientProjectId: handoverProjectId ?? row.handoverClientProjectId,
        closedAt: args.to === "won" || args.to === "lost" ? new Date() : null,
      })
      .where(eq(crmOpportunities.id, args.id))
      .returning();
    return { ok: true, opportunity: updated[0]!, handoverProjectId };
  });
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export async function createProposal(args: {
  opportunityId: number;
  title: string;
  amountCents: number;
  currency: string;
  validUntil: string | null;
  body: string | null;
  createdByUserId: number;
}): Promise<CrmProposal | "opportunity_not_found" | null> {
  const db = await getDb();
  if (!db) return null;
  const opp = (await db.select({ id: crmOpportunities.id }).from(crmOpportunities).where(eq(crmOpportunities.id, args.opportunityId)).limit(1))[0];
  if (!opp) return "opportunity_not_found";
  const rows = await db.insert(crmProposals).values(args).returning();
  return rows[0] ?? null;
}

export async function listProposals(opportunityId?: number): Promise<CrmProposal[]> {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(crmProposals);
  return (opportunityId ? q.where(eq(crmProposals.opportunityId, opportunityId)) : q).orderBy(desc(crmProposals.updatedAt)).limit(500);
}

export async function moveProposal(
  id: number,
  to: DocumentStatus,
): Promise<{ ok: true; proposal: CrmProposal } | { ok: false; reason: string; code: "NOT_FOUND" | "PRECONDITION_FAILED" } | null> {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(crmProposals).where(eq(crmProposals.id, id)).limit(1))[0];
  if (!row) return { ok: false, code: "NOT_FOUND", reason: "Proposal not found." };
  if (!canMoveDocument(row.status as DocumentStatus, to)) {
    return { ok: false, code: "PRECONDITION_FAILED", reason: `Cannot move a ${row.status} proposal to ${to}.` };
  }
  const now = new Date();
  const updated = await db
    .update(crmProposals)
    .set({ status: to, sentAt: to === "sent" ? now : row.sentAt, decidedAt: to === "sent" ? null : now })
    .where(and(eq(crmProposals.id, id), eq(crmProposals.status, row.status)))
    .returning();
  if (!updated[0]) return { ok: false, code: "PRECONDITION_FAILED", reason: "Proposal changed; reload and retry." };
  return { ok: true, proposal: updated[0] };
}

// ---------------------------------------------------------------------------
// Activities and follow ups
// ---------------------------------------------------------------------------

export async function createActivity(args: {
  kind: "call" | "email" | "meeting" | "note" | "follow_up";
  subject: string;
  body: string | null;
  leadId: number | null;
  opportunityId: number | null;
  organizationId: number | null;
  dueAt: Date | null;
  createdByUserId: number;
}): Promise<CrmActivity | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(crmActivities).values(args).returning();
  return rows[0] ?? null;
}

export async function completeActivity(id: number): Promise<CrmActivity | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(crmActivities)
    .set({ completedAt: new Date() })
    .where(and(eq(crmActivities.id, id), isNull(crmActivities.completedAt)))
    .returning();
  return rows[0] ?? null;
}

/** Open follow ups, oldest due date first, so overdue ones are at the top. */
export async function listOpenFollowUps(limit = 100): Promise<CrmActivity[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(crmActivities)
    .where(and(eq(crmActivities.kind, "follow_up"), isNull(crmActivities.completedAt)))
    .orderBy(asc(crmActivities.dueAt))
    .limit(limit);
}

export type TimelineEntry = {
  at: Date;
  type: "activity" | "opportunity" | "proposal" | "lead";
  title: string;
  detail: string | null;
  ref: string;
};

/**
 * The complete history for one customer (SRS 14.9). Pass the lead, the
 * organization, or both; everything is merged and sorted newest first.
 */
export async function customerTimeline(args: { leadId?: number; organizationId?: number }): Promise<TimelineEntry[]> {
  const db = await getDb();
  if (!db) return [];
  const out: TimelineEntry[] = [];

  const actWhere = args.leadId
    ? eq(crmActivities.leadId, args.leadId)
    : args.organizationId
      ? eq(crmActivities.organizationId, args.organizationId)
      : null;
  const oppWhere = args.leadId
    ? eq(crmOpportunities.leadId, args.leadId)
    : args.organizationId
      ? eq(crmOpportunities.organizationId, args.organizationId)
      : null;
  if (!actWhere || !oppWhere) return [];

  const [acts, opps] = await Promise.all([
    db.select().from(crmActivities).where(actWhere).limit(500),
    db.select().from(crmOpportunities).where(oppWhere).limit(200),
  ]);
  for (const a of acts) {
    out.push({ at: a.completedAt ?? a.createdAt, type: "activity", title: `${a.kind.replace("_", " ")}: ${a.subject}`, detail: a.body, ref: `activity:${a.id}` });
  }
  for (const o of opps) {
    out.push({ at: o.createdAt, type: "opportunity", title: `Opportunity: ${o.title} (${o.stage})`, detail: null, ref: `opportunity:${o.id}` });
    const props = await db.select().from(crmProposals).where(eq(crmProposals.opportunityId, o.id));
    for (const p of props) {
      out.push({ at: p.decidedAt ?? p.sentAt ?? p.createdAt, type: "proposal", title: `Proposal: ${p.title} (${p.status})`, detail: null, ref: `proposal:${p.id}` });
    }
  }
  if (args.leadId) {
    const lead = (await db.select().from(leads).where(eq(leads.id, args.leadId)).limit(1))[0];
    if (lead) out.push({ at: lead.createdAt, type: "lead", title: "Lead captured", detail: null, ref: `lead:${lead.id}` });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

function newQuoteRef(): string {
  return `Q-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createQuote(args: {
  organizationId: number | null;
  opportunityId: number | null;
  title: string;
  lines: QuoteLine[];
  currency: string;
  validUntil: string | null;
  createdByUserId: number;
}): Promise<Quote | null> {
  const db = await getDb();
  if (!db) return null;
  const totalCents = computeQuoteTotal(args.lines);
  const rows = await db
    .insert(quotes)
    .values({
      publicRef: newQuoteRef(),
      organizationId: args.organizationId,
      opportunityId: args.opportunityId,
      title: args.title,
      linesJson: JSON.stringify(args.lines),
      totalCents,
      currency: args.currency,
      validUntil: args.validUntil,
      createdByUserId: args.createdByUserId,
    })
    .returning();
  return rows[0] ?? null;
}

export async function listQuotes(): Promise<Quote[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quotes).orderBy(desc(quotes.updatedAt)).limit(500);
}

export async function moveQuote(
  id: number,
  to: DocumentStatus,
): Promise<{ ok: true; quote: Quote } | { ok: false; reason: string; code: "NOT_FOUND" | "PRECONDITION_FAILED" } | null> {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(quotes).where(eq(quotes.id, id)).limit(1))[0];
  if (!row) return { ok: false, code: "NOT_FOUND", reason: "Quotation not found." };
  if (!canMoveDocument(row.status as DocumentStatus, to)) {
    return { ok: false, code: "PRECONDITION_FAILED", reason: `Cannot move a ${row.status} quotation to ${to}.` };
  }
  const updated = await db.update(quotes).set({ status: to }).where(and(eq(quotes.id, id), eq(quotes.status, row.status))).returning();
  if (!updated[0]) return { ok: false, code: "PRECONDITION_FAILED", reason: "Quotation changed; reload and retry." };
  return { ok: true, quote: updated[0] };
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function createSubscription(args: {
  organizationId: number;
  plan: string;
  amountCents: number;
  currency: string;
  billingInterval: "monthly" | "quarterly" | "yearly";
  renewsAt: Date | null;
}): Promise<Subscription | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(subscriptions).values(args).returning();
  return rows[0] ?? null;
}

export async function listSubscriptions(organizationId?: number): Promise<Subscription[]> {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(subscriptions);
  return (organizationId ? q.where(eq(subscriptions.organizationId, organizationId)) : q).orderBy(desc(subscriptions.updatedAt)).limit(500);
}

export async function setSubscriptionStatus(
  id: number,
  status: "active" | "paused" | "past_due" | "cancelled",
): Promise<Subscription | null> {
  const db = await getDb();
  if (!db) return null;
  const current = (await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1))[0];
  // Cancellation is final: reactivating would silently resume billing.
  if (!current || current.status === "cancelled") return null;
  const rows = await db
    .update(subscriptions)
    .set({ status, cancelledAt: status === "cancelled" ? new Date() : null })
    .where(eq(subscriptions.id, id))
    .returning();
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Financial summary (SRS 16.12)
// ---------------------------------------------------------------------------

const MONTHS_PER_INTERVAL: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

export type FinancialSummary = {
  currency: string;
  outstandingCents: number;
  overdueCents: number;
  paidLast30DaysCents: number;
  paidLast90DaysCents: number;
  openInvoices: number;
  overdueInvoices: number;
  /** Active subscriptions normalised to a monthly amount. */
  monthlyRecurringCents: number;
  activeSubscriptions: number;
};

export async function readFinancialSummary(now = Date.now()): Promise<FinancialSummary | null> {
  const db = await getDb();
  if (!db) return null;
  const sum = (cond: ReturnType<typeof sql>) => sql<number>`coalesce(sum(${clientInvoices.amountCents}) filter (where ${cond}), 0)::bigint`;
  const cnt = (cond: ReturnType<typeof sql>) => sql<number>`count(*) filter (where ${cond})::int`;
  const d30 = now - 30 * 86_400_000;
  const d90 = now - 90 * 86_400_000;
  const inv = (
    await db
      .select({
        outstanding: sum(sql`${clientInvoices.status} in ('open','overdue')`),
        overdue: sum(sql`${clientInvoices.status} = 'overdue'`),
        paid30: sum(sql`${clientInvoices.status} = 'paid' and ${clientInvoices.paidMs} >= ${d30}`),
        paid90: sum(sql`${clientInvoices.status} = 'paid' and ${clientInvoices.paidMs} >= ${d90}`),
        openCount: cnt(sql`${clientInvoices.status} in ('open','overdue')`),
        overdueCount: cnt(sql`${clientInvoices.status} = 'overdue'`),
      })
      .from(clientInvoices)
  )[0];
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.status, "active"));
  const mrr = subs.reduce((acc, s) => acc + Math.round(Number(s.amountCents) / (MONTHS_PER_INTERVAL[s.billingInterval] ?? 1)), 0);
  return {
    currency: "EUR",
    outstandingCents: Number(inv?.outstanding ?? 0),
    overdueCents: Number(inv?.overdue ?? 0),
    paidLast30DaysCents: Number(inv?.paid30 ?? 0),
    paidLast90DaysCents: Number(inv?.paid90 ?? 0),
    openInvoices: Number(inv?.openCount ?? 0),
    overdueInvoices: Number(inv?.overdueCount ?? 0),
    monthlyRecurringCents: mrr,
    activeSubscriptions: subs.length,
  };
}

/** Pipeline roll-up used by dashboards and the scheduled pipeline report. */
export async function readPipelineSummary() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      stage: crmOpportunities.stage,
      n: sql<number>`count(*)::int`,
      valueCents: sql<number>`coalesce(sum(${crmOpportunities.valueCents}), 0)::bigint`,
    })
    .from(crmOpportunities)
    .groupBy(crmOpportunities.stage);
  return rows.map((r) => ({ stage: r.stage, count: Number(r.n), valueCents: Number(r.valueCents) }));
}

