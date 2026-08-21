/**
 * server/notifications.ts — Milestone 2 §2.7 central typed notification
 * write service.
 *
 * Before this file, every call site across the app wrote directly to
 * `client_notifications`/`developer_notifications` via
 * `appendClientNotification`/`appendDeveloperNotification` (still the
 * underlying DB write — this file doesn't replace them, it's the one
 * place that decides whether an email should ride along). `notifyClient`/
 * `notifyDeveloper` are the typed entry points: pass `channel:
 * "in_app_and_email"` and this bridges to the exact same Resend transport
 * built in §2.3 (`server/email.ts`'s `dispatchSimpleEmail`, which already
 * logs to `email_delivery_log` — no new send path, no new delivery log,
 * reusing what's proven). A dispatch failure never blocks the in-app
 * notification from existing — the DB row is written first,
 * unconditionally; email is best-effort on top.
 */
import { dispatchSimpleEmail } from "./email";
import {
  appendClientNotification,
  appendDeveloperNotification,
  listOrganizationMemberEmails,
  getDeveloperEmail,
} from "./db";

export type NotificationPriority = "low" | "normal" | "high" | "critical";

const GENERIC_TEMPLATE_KEY = "notification-generic";

function renderNotificationEmail(title: string, body: string | null | undefined) {
  const safeBody = body ?? "";
  const html = `<div style="font-family:sans-serif;max-width:520px"><h2 style="margin:0 0 12px">${title}</h2><p style="white-space:pre-wrap;color:#333">${safeBody}</p><p style="color:#888;font-size:12px;margin-top:24px">— IO SKY</p></div>`;
  const text = `${title}\n\n${safeBody}\n\n— IO SKY`;
  return { html, text };
}

export async function notifyClient(args: {
  organizationId: number;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  priority?: NotificationPriority;
  channel?: "in_app" | "in_app_and_email";
}): Promise<void> {
  const templateKey = args.channel === "in_app_and_email" ? GENERIC_TEMPLATE_KEY : null;

  await appendClientNotification({
    organizationId: args.organizationId,
    kind: args.kind,
    title: args.title,
    body: args.body ?? null,
    href: args.href ?? null,
    priority: args.priority ?? "normal",
    channel: args.channel ?? "in_app",
    templateKey,
  });

  if (args.channel !== "in_app_and_email") return;

  try {
    const recipients = await listOrganizationMemberEmails(args.organizationId);
    const { html, text } = renderNotificationEmail(args.title, args.body);
    for (const to of recipients) {
      await dispatchSimpleEmail({
        to,
        subject: args.title,
        html,
        text,
        refHeader: `notification:org:${args.organizationId}`,
        messageType: "notification",
        relatedRef: `org:${args.organizationId}`,
      });
    }
  } catch (err) {
    console.error("[notifications] notifyClient email bridge failed:", err);
  }
}

export async function notifyDeveloper(args: {
  developerId: number;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  priority?: NotificationPriority;
  channel?: "in_app" | "in_app_and_email";
}): Promise<void> {
  const templateKey = args.channel === "in_app_and_email" ? GENERIC_TEMPLATE_KEY : null;

  await appendDeveloperNotification({
    developerId: args.developerId,
    kind: args.kind,
    title: args.title,
    body: args.body ?? null,
    href: args.href ?? null,
    priority: args.priority ?? "normal",
    channel: args.channel ?? "in_app",
    templateKey,
  });

  if (args.channel !== "in_app_and_email") return;

  try {
    const email = await getDeveloperEmail(args.developerId);
    if (!email) return;
    const { html, text } = renderNotificationEmail(args.title, args.body);
    await dispatchSimpleEmail({
      to: email,
      subject: args.title,
      html,
      text,
      refHeader: `notification:developer:${args.developerId}`,
      messageType: "notification",
      relatedRef: `developer:${args.developerId}`,
    });
  } catch (err) {
    console.error("[notifications] notifyDeveloper email bridge failed:", err);
  }
}
