/**
 * IO SKY — owner-alert notifications (Milestone 2 §2.2).
 *
 * Replaces the Manus push-notification call (WebDevService/SendNotification,
 * a genuine external API call to Manus's own backend, not just an internal
 * name — see MILESTONE1_SUPABASE_MIGRATION_REPORT.md §8) with a real
 * email/Slack owner-alert channel, per the Milestone 2 requirement. Email
 * reuses the same Resend/SMTP/console transport every other transactional
 * email in this app already goes through (server/email.ts's
 * dispatchSimpleEmail) rather than a new, separate integration. Slack is
 * optional and additive.
 *
 * Deliberately NOT the general-purpose "central notification service"
 * Milestone 2 §2.7 calls for (typed write path, schema, delivery queue,
 * Notification Center) — that is separate, later, spec-independent
 * groundwork for in-app + email notifications to platform users. This
 * module is specifically the operator/owner alert channel: "someone
 * outside the app needs to know this happened right now," used by ~12
 * call sites across bookings/contact/engineering/AI Scan/client
 * portal/developer workspace. Kept as its own focused module rather than
 * folded into §2.7's build so callers here don't need to change at all —
 * the exported `notifyOwner(payload)` signature and boolean return
 * contract are unchanged.
 */
import { TRPCError } from "@trpc/server";
import { getOwnerNotifyConfig } from "./env";
import { dispatchSimpleEmail, escapeHtml } from "../email";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

function renderOwnerAlertHtml(title: string, content: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0A0E14;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#E6EAF0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E14;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#0F141B;border:1px solid rgba(255, 122, 0,0.18);border-radius:16px;padding:32px">
        <tr><td>
          <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#FF7A00">IO SKY · Owner Alert</div>
          <h1 style="margin:18px 0 16px;font-size:22px;line-height:1.3;color:#E6EAF0;font-weight:600">${escapeHtml(title)}</h1>
          <pre style="margin:0;white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.65;color:rgba(230,234,240,0.85)">${escapeHtml(content)}</pre>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function postSlackAlert(webhookUrl: string, title: string, content: string): Promise<void> {
  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `*${title}*\n${content}` }),
    });
    if (!resp.ok) {
      console.warn(`[Notification] Slack alert failed (${resp.status} ${resp.statusText})`);
    }
  } catch (error) {
    console.warn("[Notification] Error posting Slack alert:", error);
  }
}

/**
 * Dispatches a project-owner notification via email (required) and Slack
 * (optional, if OWNER_NOTIFY_SLACK_WEBHOOK_URL is configured). Returns
 * `true` if the email was accepted by its transport, `false` if delivery
 * failed — callers already treat this as best-effort (try/catch or
 * .catch() at nearly every call site). Validation errors and missing
 * configuration bubble up as TRPC errors, matching the Manus-backed
 * implementation's prior fail-fast-on-config behavior.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);
  const { email: ownerNotifyEmail, slackWebhookUrl } = getOwnerNotifyConfig();

  if (!ownerNotifyEmail) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Owner notification email is not configured (OWNER_NOTIFY_EMAIL).",
    });
  }

  // Slack is additive — fire in parallel, never let it affect the email
  // result or throw past this function.
  if (slackWebhookUrl) {
    void postSlackAlert(slackWebhookUrl, title, content);
  }

  const result = await dispatchSimpleEmail({
    to: ownerNotifyEmail,
    subject: `[IO SKY] ${title}`,
    html: renderOwnerAlertHtml(title, content),
    text: `${title}\n\n${content}`,
    refHeader: "owner-alert",
    messageType: "owner-alert",
  });

  if (!result.ok) {
    console.warn(
      `[Notification] Failed to email owner alert (transport=${result.transport}): ${result.error ?? "unknown error"}`,
    );
    return false;
  }

  return true;
}
