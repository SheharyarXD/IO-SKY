/**
 * Combinable CRM lead filters (task C01; SRS 14.16; 29 Oct Ch8). Pure rules: one
 * function decides whether a lead matches, so the same behaviour backs the server
 * query and the tests.
 *
 * Every condition that is given must hold (AND). A list condition (status, source)
 * holds when the lead has ANY of the listed values. An empty or missing condition
 * is not a constraint. Text conditions are case-insensitive. Dates are whole UTC
 * days, inclusive at both ends.
 *
 * Attributes covered are the ones a lead actually has: status, source, interest,
 * company, name/email text, phone present, campaign attribution (UTM), the date
 * it was created and its owner (a separate record; a lead with none is unowned).
 */
import { z } from "zod";

export const LEAD_STATUSES = ["new", "qualified", "engaged", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

export const leadFilterSchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    statuses: z.array(z.enum(LEAD_STATUSES)).max(5).optional(),
    sources: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
    interest: z.string().trim().max(64).optional(),
    company: z.string().trim().max(120).optional(),
    utmSource: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    hasPhone: z.boolean().optional(),
    /** A user id, or "none" for leads nobody owns. */
    owner: z.union([z.number().int().positive(), z.literal("none")]).optional(),
    createdFrom: day.optional(),
    createdTo: day.optional(),
  })
  .strict()
  .refine((f) => !f.createdFrom || !f.createdTo || f.createdFrom <= f.createdTo, { message: "createdFrom must not be after createdTo" });

export type LeadFilter = z.infer<typeof leadFilterSchema>;

export type FilterableLead = {
  fullName: string;
  email: string;
  company: string | null;
  phone: string | null;
  source: string;
  interest: string | null;
  status: string;
  utmSource: string | null;
  utmCampaign: string | null;
  createdAt: Date | string | number;
  /** Absent or null means the lead has no owner. */
  ownerUserId?: number | null;
};

const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().trim();
const has = (hay: string | null | undefined, needle: string) => norm(hay).includes(norm(needle));

function dayStartMs(d: string): number {
  return Date.parse(`${d}T00:00:00.000Z`);
}

export function leadMatches(lead: FilterableLead, f: LeadFilter): boolean {
  if (f.statuses?.length && !f.statuses.includes(lead.status as LeadStatus)) return false;
  if (f.sources?.length && !f.sources.some((s) => norm(s) === norm(lead.source))) return false;
  if (f.q?.trim()) {
    const q = f.q;
    if (!(has(lead.fullName, q) || has(lead.email, q) || has(lead.company, q) || has(lead.interest, q))) return false;
  }
  if (f.interest?.trim() && !has(lead.interest, f.interest)) return false;
  if (f.company?.trim() && !has(lead.company, f.company)) return false;
  if (f.utmSource?.trim() && norm(lead.utmSource) !== norm(f.utmSource)) return false;
  if (f.utmCampaign?.trim() && norm(lead.utmCampaign) !== norm(f.utmCampaign)) return false;
  if (f.hasPhone !== undefined) {
    const present = norm(lead.phone).length > 0;
    if (present !== f.hasPhone) return false;
  }
  if (f.owner !== undefined) {
    const owner = lead.ownerUserId ?? null;
    if (f.owner === "none" ? owner !== null : owner !== f.owner) return false;
  }
  if (f.createdFrom || f.createdTo) {
    const t = new Date(lead.createdAt).getTime();
    if (Number.isNaN(t)) return false;
    if (f.createdFrom && t < dayStartMs(f.createdFrom)) return false;
    if (f.createdTo && t >= dayStartMs(f.createdTo) + 86_400_000) return false;
  }
  return true;
}

export function filterLeads<T extends FilterableLead>(leads: T[], f: LeadFilter): T[] {
  return leads.filter((l) => leadMatches(l, f));
}

/** How many conditions are active, for a "3 filters applied" label. */
export function activeFilterCount(f: LeadFilter): number {
  let n = 0;
  if (f.q?.trim()) n++;
  if (f.statuses?.length) n++;
  if (f.sources?.length) n++;
  if (f.interest?.trim()) n++;
  if (f.company?.trim()) n++;
  if (f.utmSource?.trim()) n++;
  if (f.utmCampaign?.trim()) n++;
  if (f.hasPhone !== undefined) n++;
  if (f.owner !== undefined) n++;
  if (f.createdFrom) n++;
  if (f.createdTo) n++;
  return n;
}

/** Rows scanned per query and rows returned, so a large CRM cannot make one request unbounded. */
export const LEAD_QUERY = { scan: 2000, return: 200 } as const;
