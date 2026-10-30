/**
 * AI Scan report versions: comparison and approval evidence (task P06; SRS 9.7,
 * BR-017; 29 Oct Doc 2 s10). Pure rules.
 *
 * Every time the engine produces a report, that version is kept. A reviewer can
 * then see exactly what changed between two versions (scores, summary wording,
 * opportunities, roadmap, disclaimers) and which version each approval and
 * publication applied to, so "what did we approve?" has a factual answer.
 * Versions are never edited or removed.
 */
import type { AiScanReportPayload } from "./aiScanModel";
import { diffPrompts, type PromptDiff } from "./promptTools";

/** Read a stored payload; null when it is missing or not the shape the engine writes. */
export function parseReportPayload(json: string | null | undefined): AiScanReportPayload | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Partial<AiScanReportPayload>;
    if (!v || typeof v.overallScore !== "number" || !Array.isArray(v.dimensions) || typeof v.executiveSummary !== "string" || !Array.isArray(v.opportunities) || !Array.isArray(v.roadmap)) return null;
    return { ...v, disclaimers: Array.isArray(v.disclaimers) ? v.disclaimers : [] } as AiScanReportPayload;
  } catch {
    return null;
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export type DimensionChange = { dimension: string; from: number | null; to: number | null; delta: number | null; gradeFrom: string | null; gradeTo: string | null; rationaleChanged: boolean };
export type OpportunityChange = { title: string; fields: string[] };
export type RoadmapChange = { horizon: string; added: string[]; removed: string[] };

export type ReportComparison = {
  identical: boolean;
  score: { from: number; to: number; delta: number };
  grade: { from: string; to: string; changed: boolean };
  dimensions: DimensionChange[];
  summary: PromptDiff;
  opportunities: { added: string[]; removed: string[]; changed: OpportunityChange[] };
  roadmap: RoadmapChange[];
  disclaimersChanged: boolean;
  /** Number of distinct things that differ, for a one-line summary. */
  changes: number;
};

export function compareReports(from: AiScanReportPayload, to: AiScanReportPayload): ReportComparison {
  const byDim = (p: AiScanReportPayload) => new Map(p.dimensions.map((d) => [d.dimension as string, d]));
  const a = byDim(from);
  const b = byDim(to);
  const dimensions: DimensionChange[] = [...new Set([...a.keys(), ...b.keys()])]
    .map((k) => {
      const x = a.get(k);
      const y = b.get(k);
      return {
        dimension: k,
        from: x?.score ?? null,
        to: y?.score ?? null,
        delta: x && y ? y.score - x.score : null,
        gradeFrom: x?.grade ?? null,
        gradeTo: y?.grade ?? null,
        rationaleChanged: Boolean(x && y && norm(x.rationale) !== norm(y.rationale)),
      };
    })
    .filter((d) => d.from === null || d.to === null || d.delta !== 0 || d.gradeFrom !== d.gradeTo || d.rationaleChanged);

  const summary = diffPrompts(from.executiveSummary, to.executiveSummary);

  // Opportunities are matched by title: ids are not stable across regenerations.
  const oa = new Map(from.opportunities.map((o) => [norm(o.title), o]));
  const ob = new Map(to.opportunities.map((o) => [norm(o.title), o]));
  const added = [...ob.keys()].filter((k) => !oa.has(k)).map((k) => ob.get(k)!.title);
  const removed = [...oa.keys()].filter((k) => !ob.has(k)).map((k) => oa.get(k)!.title);
  const changed: OpportunityChange[] = [];
  for (const [k, y] of ob) {
    const x = oa.get(k);
    if (!x) continue;
    const fields = (["impact", "effort", "horizon", "category"] as const).filter((f) => x[f] !== y[f]).map((f) => f as string);
    if (norm(x.summary) !== norm(y.summary)) fields.push("summary");
    if (fields.length) changed.push({ title: y.title, fields });
  }

  const ra = new Map(from.roadmap.map((r) => [r.horizon as string, r.items.map(norm)]));
  const rb = new Map(to.roadmap.map((r) => [r.horizon as string, r.items]));
  const roadmap: RoadmapChange[] = [];
  for (const h of new Set([...ra.keys(), ...rb.keys()])) {
    const before = new Set(ra.get(h) ?? []);
    const afterItems = rb.get(h) ?? [];
    const afterSet = new Set(afterItems.map(norm));
    const addedItems = afterItems.filter((i) => !before.has(norm(i)));
    const removedItems = [...before].filter((i) => !afterSet.has(i));
    if (addedItems.length || removedItems.length) roadmap.push({ horizon: h, added: addedItems, removed: removedItems });
  }

  const disclaimersChanged = JSON.stringify(from.disclaimers.map(norm)) !== JSON.stringify(to.disclaimers.map(norm));
  const score = { from: from.overallScore, to: to.overallScore, delta: to.overallScore - from.overallScore };
  const grade = { from: from.overallGrade, to: to.overallGrade, changed: from.overallGrade !== to.overallGrade };
  const changes = (score.delta !== 0 ? 1 : 0) + (grade.changed ? 1 : 0) + dimensions.length + (summary.identical ? 0 : 1) + added.length + removed.length + changed.length + roadmap.length + (disclaimersChanged ? 1 : 0);
  return { identical: changes === 0, score, grade, dimensions, summary, opportunities: { added, removed, changed }, roadmap, disclaimersChanged, changes };
}

// ---------------------------------------------------------------------------
// approval evidence
// ---------------------------------------------------------------------------

export type VersionRow = { version: number; createdAt: Date; overallScore: number | null };
export type StatusEventRow = { toStatus: string; createdAt: Date; actorUserId: number | null; note: string | null };

export type VersionEvidence = VersionRow & {
  approvals: Array<{ at: Date; byUserId: number | null }>;
  publications: Array<{ at: Date; byUserId: number | null }>;
  revisionRequests: Array<{ at: Date; byUserId: number | null; note: string | null }>;
  /** True when this is the version the customer sees: the last one produced before the latest publication. */
  published: boolean;
};

/**
 * Attach each decision to the version it applied to: the newest version produced at or before the decision.
 * A decision before any version exists is attached to nothing.
 */
export function attachDecisions(versions: VersionRow[], events: StatusEventRow[]): VersionEvidence[] {
  const sorted = [...versions].sort((x, y) => x.version - y.version);
  const out: VersionEvidence[] = sorted.map((v) => ({ ...v, approvals: [], publications: [], revisionRequests: [], published: false }));
  const owner = (at: Date) => {
    let found: VersionEvidence | null = null;
    for (const v of out) if (v.createdAt.getTime() <= at.getTime()) found = v;
    return found;
  };
  for (const e of [...events].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
    const v = owner(e.createdAt);
    if (!v) continue;
    if (e.toStatus === "approved") v.approvals.push({ at: e.createdAt, byUserId: e.actorUserId });
    else if (e.toStatus === "published") v.publications.push({ at: e.createdAt, byUserId: e.actorUserId });
    else if (e.toStatus === "revision_required") v.revisionRequests.push({ at: e.createdAt, byUserId: e.actorUserId, note: e.note });
  }
  const lastPublished = [...out].reverse().find((v) => v.publications.length > 0);
  if (lastPublished) lastPublished.published = true;
  return out;
}
