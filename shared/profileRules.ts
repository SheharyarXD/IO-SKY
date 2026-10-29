/**
 * Contextual customer profile (task C03; SRS 14.16; 29 Oct Ch8). Pure rules that
 * turn the records the platform holds about one customer into timeline entries and
 * a summary: CRM activity, opportunities and proposals (already there), plus the
 * discovery calls, AI Scans, projects and files that belong to the same customer.
 *
 * The profile is for staff and shows what each record IS, never what is IN it:
 * a file appears with its name, category, version and status, never its content or
 * a link to it; a scan appears with its tier and status, never its answers or
 * report. Every entry carries a stable ref so the same record is never listed twice.
 */

export const TIMELINE_TYPES = ["lead", "activity", "opportunity", "proposal", "call", "scan", "project", "file"] as const;
export type TimelineType = (typeof TIMELINE_TYPES)[number];

export type TimelineEntry = {
  at: Date;
  type: TimelineType;
  title: string;
  detail: string | null;
  ref: string;
};

const label = (s: string) => s.replace(/_/g, " ");
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function callEntry(b: { id: number; serviceId: string; slotStartMs: number; status: string; createdAt: Date }): TimelineEntry {
  return { at: new Date(b.slotStartMs), type: "call", title: `Discovery call: ${label(b.serviceId)} on ${day(b.slotStartMs)} (${label(b.status)})`, detail: null, ref: `booking:${b.id}` };
}

export function scanEntry(s: { id: number; tier: string; status: string; createdAt: Date }): TimelineEntry {
  return { at: s.createdAt, type: "scan", title: `AI Scan: ${label(s.tier)} (${label(s.status)})`, detail: null, ref: `scan:${s.id}` };
}

export function projectEntry(p: { id: number; name: string; phase: string; status: string; createdAt: Date }): TimelineEntry {
  return { at: p.createdAt, type: "project", title: `Project: ${p.name} (${label(p.status)}, ${p.phase})`, detail: null, ref: `project:${p.id}` };
}

export function fileEntry(f: { id: number; name: string; category: string; version: number; status: string; createdAt: Date }): TimelineEntry {
  return { at: f.createdAt, type: "file", title: `File: ${f.name} (${label(f.category)}, version ${f.version}, ${label(f.status)})`, detail: null, ref: `file:${f.id}` };
}

/** Newest first; entries with the same time keep a stable order by ref. Duplicate refs are dropped. */
export function sortTimeline(entries: TimelineEntry[], limit = 500): TimelineEntry[] {
  const seen = new Set<string>();
  const unique = entries.filter((e) => (seen.has(e.ref) ? false : (seen.add(e.ref), true)));
  return unique.sort((a, b) => b.at.getTime() - a.at.getTime() || a.ref.localeCompare(b.ref)).slice(0, limit);
}

export type ProfileSummary = {
  total: number;
  byType: Record<TimelineType, number>;
  firstAt: Date | null;
  lastAt: Date | null;
  /** Whole days since the most recent entry that is not in the future; null when there is none. */
  daysSinceLastActivity: number | null;
  upcomingCalls: number;
};

export function summarizeProfile(entries: TimelineEntry[], now: Date): ProfileSummary {
  const byType = Object.fromEntries(TIMELINE_TYPES.map((t) => [t, 0])) as Record<TimelineType, number>;
  for (const e of entries) byType[e.type]++;
  const times = entries.map((e) => e.at.getTime());
  const past = times.filter((t) => t <= now.getTime());
  return {
    total: entries.length,
    byType,
    firstAt: times.length ? new Date(Math.min(...times)) : null,
    lastAt: times.length ? new Date(Math.max(...times)) : null,
    daysSinceLastActivity: past.length ? Math.floor((now.getTime() - Math.max(...past)) / 86_400_000) : null,
    upcomingCalls: entries.filter((e) => e.type === "call" && e.at.getTime() > now.getTime() && !/\((cancelled|completed)\)$/.test(e.title)).length,
  };
}
