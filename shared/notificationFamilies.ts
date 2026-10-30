/**
 * The nine notification families (task N01; SRS 17.15; 29 Oct Ch11). The catalogue
 * already assigns every event to one family; this adds the human names and the
 * lookup the Notification Center needs to group and filter by family.
 *
 * DECISION (engineering, to be matched against the client document): the family
 * keys in the catalogue are adopted as they are, and the labels below are the
 * display names. A stored notification carries its catalogue event id as its
 * kind (for example "AS-05"), so its family is read from the catalogue and never
 * guessed; anything else (an owner alert, a legacy kind) belongs to no family.
 */
import { getNotificationEvent, NOTIFICATION_FAMILIES, type NotificationFamily } from "./notificationCatalogue";

export const FAMILY_LABELS: Record<NotificationFamily, string> = {
  discovery_calls: "Discovery Calls",
  ai_scans: "AI Scans",
  clients_accounts: "Clients and Accounts",
  projects_delivery: "Projects and Delivery",
  payments_billing: "Payments and Billing",
  ai_operations: "AI Operations",
  platform_integrations: "Platform and Integrations",
  security_access: "Security and Access",
  governance_system: "Governance and System",
};

export { NOTIFICATION_FAMILIES };

/** The family of a stored notification, from its catalogue event id; null when the kind is not an event id. */
export function familyOfKind(kind: string | null | undefined): NotificationFamily | null {
  if (!kind || !/^[A-Z]{2}-\d{2}$/.test(kind)) return null;
  return getNotificationEvent(kind)?.family ?? null;
}

export function familyLabelOfKind(kind: string | null | undefined): string | null {
  const f = familyOfKind(kind);
  return f ? FAMILY_LABELS[f] : null;
}

/** Keep the notifications in a family; an empty or undefined filter keeps everything. */
export function filterByFamily<T extends { kind: string }>(items: T[], family: NotificationFamily | "" | undefined): T[] {
  return family ? items.filter((n) => familyOfKind(n.kind) === family) : items;
}

/** How many notifications each family has, including families with none. Notifications outside any family are counted under "other". */
export function countByFamily(items: Array<{ kind: string }>): Record<NotificationFamily | "other", number> {
  const out = Object.fromEntries([...NOTIFICATION_FAMILIES, "other"].map((f) => [f, 0])) as Record<NotificationFamily | "other", number>;
  for (const n of items) out[familyOfKind(n.kind) ?? "other"]++;
  return out;
}
