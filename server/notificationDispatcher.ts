/**
 * Notification dispatcher (SRS 17, Notification Event Catalogue v1.0).
 *
 * One entry point for every catalogue event. A caller names the event and says
 * who it is for; the dispatcher validates the event against the catalogue,
 * de-duplicates, records the emission, applies the catalogue's priority and
 * email policy, honours the recipient's preferences (security is never
 * optional) and routes to the right surface.
 *
 * The catalogue's `recipients` field is prose and is NEVER evaluated here.
 * Functional Specification section 37 requires routing to be enforced
 * server side from concrete recipients, so callers pass them explicitly.
 *
 * A notification is a side effect of a business event, so nothing in here is
 * allowed to throw into the caller: a failure is logged and reported in the
 * return value.
 */
import { FALLBACK_LOCALE, renderTemplate } from "../shared/platformRules";
import { getActiveTemplate } from "./db/platformGovernance";
import { getNotificationEventByName } from "../shared/notificationCatalogue";
import { buildDedupKey, catalogueWantsEmail, inAppPriority, kindForFamily } from "../shared/srsRules";
import { createAdminNotification, recordNotificationEvent } from "./db";
import { notifyClient, notifyDeveloper } from "./notifications";

export type Audience =
  | { type: "admin" }
  | { type: "client"; organizationId: number }
  | { type: "developer"; developerId: number };

export type EmitResult =
  | { delivered: true; eventId: string }
  | { delivered: false; reason: "unknown_event" | "duplicate" | "error" };

function humanize(name: string): string {
  const s = name.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function recipientRef(a: Audience): string {
  return a.type === "admin" ? "admin" : a.type === "client" ? `org:${a.organizationId}` : `dev:${a.developerId}`;
}

export async function emitNotification(args: {
  /** Catalogue name, e.g. "AI_SCAN_READY_FOR_REVIEW". */
  event: string;
  audience: Audience;
  /** What counts as the same occurrence, e.g. "scan:12" or "invoice:9:2026-10-07". */
  dedupeRef: string;
  title?: string;
  body?: string | null;
  href?: string | null;
  /**
   * Set when the caller already raises an admin bell entry for this occurrence
   * (notifyOwner does), so the bell is not filled twice. The emission is still
   * recorded for history and de-duplication.
   */
  skipAdminFeed?: boolean;
}): Promise<EmitResult> {
  const event = getNotificationEventByName(args.event);
  if (!event) {
    console.error(`[notifications] unknown catalogue event "${args.event}"`);
    return { delivered: false, reason: "unknown_event" };
  }
  try {
    const ref = recipientRef(args.audience);
    const wantsEmail = catalogueWantsEmail(event.emailDelivery);
    let title = (args.title ?? humanize(event.name)).slice(0, 200);
    let bodyText = args.body ?? null;
    // An active template for this event (OPD-001) replaces the built in wording. Placeholders
    // are filled only from values this call already holds; nothing is looked up from user input.
    try {
      const tpl = await getActiveTemplate(event.name, "in_app", FALLBACK_LOCALE);
      if (tpl) {
        const vars = { reference: args.dedupeRef, link: args.href ?? "" };
        title = renderTemplate(tpl.subject, vars).slice(0, 200) || title;
        bodyText = renderTemplate(tpl.body, vars) || bodyText;
      }
    } catch {
      /* a template problem must never stop a notification */
    }
    const first = await recordNotificationEvent({
      eventId: event.id,
      eventName: event.name,
      audience: args.audience.type,
      recipientRef: ref,
      dedupKey: buildDedupKey({ eventId: event.id, audience: args.audience.type, recipientRef: ref, ref: args.dedupeRef }),
      priority: event.priorityFloor,
      title,
      emailRequested: wantsEmail && args.audience.type !== "admin",
    });
    if (!first) return { delivered: false, reason: "duplicate" };

    const priority = inAppPriority(event.priorityFloor);
    const kind = kindForFamily(event.family);
    const channel = wantsEmail ? ("in_app_and_email" as const) : ("in_app" as const);
    const href = args.href ?? null;

    if (args.audience.type === "admin") {
      if (!args.skipAdminFeed) {
        await createAdminNotification({ kind: event.id, title, body: bodyText, href, priority });
      }
    } else if (args.audience.type === "client") {
      await notifyClient({ organizationId: args.audience.organizationId, kind, title, body: bodyText, href, priority, channel });
    } else {
      await notifyDeveloper({ developerId: args.audience.developerId, kind, title, body: bodyText, href, priority, channel });
    }
    return { delivered: true, eventId: event.id };
  } catch (err) {
    console.error(`[notifications] could not emit ${args.event}:`, err);
    return { delivered: false, reason: "error" };
  }
}
