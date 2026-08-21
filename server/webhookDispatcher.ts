/**
 * server/webhookDispatcher.ts — Milestone 2 §2.6 integration/webhook
 * registry dispatcher.
 *
 * Deliberately bounded, mirroring server/workflowEngine.ts's shape:
 * `dispatchWebhooksForTrigger` is the only entry point, called from the
 * same real event sites as the workflow engine (currently: document
 * approve/reject in server/routers/admin.ts). It POSTs a JSON payload to
 * every enabled `webhook_registrations` row matching the trigger, signs
 * the body with HMAC-SHA256 when the registration has a secret
 * (`X-IOSKY-Signature` header, same convention most webhook providers —
 * including Resend, already integrated in §2.3 — use), and records one
 * `webhook_deliveries` row per attempt so behavior is always inspectable.
 *
 * A dispatch failure (bad URL, timeout, non-2xx response, network error)
 * is caught and logged — never allowed to propagate and break the real
 * operation that fired it, same non-blocking guarantee the workflow
 * engine makes.
 */
import { createHmac } from "node:crypto";
import {
  listEnabledWebhookRegistrationsForTrigger,
  recordWebhookDelivery,
} from "./db";
import type { WebhookRegistration } from "../drizzle/schema";

const DISPATCH_TIMEOUT_MS = 8000;

export async function dispatchWebhooksForTrigger(
  triggerType: WebhookRegistration["triggerType"],
  payload: Record<string, unknown>,
  triggerEntityRef?: string | null,
): Promise<void> {
  const registrations = await listEnabledWebhookRegistrationsForTrigger(triggerType);
  if (registrations.length === 0) return;

  const body = JSON.stringify({
    event: triggerType,
    entityRef: triggerEntityRef ?? null,
    occurredAtMs: Date.now(),
    data: payload,
  });

  for (const reg of registrations) {
    let success = false;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (reg.secret) {
        headers["X-IOSKY-Signature"] = createHmac("sha256", reg.secret).update(body).digest("hex");
      }
      const response = await fetch(reg.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
      });
      statusCode = response.status;
      success = response.ok;
      if (!response.ok) {
        errorMessage = `Webhook endpoint returned ${response.status}`;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
      console.error(`[webhookDispatcher] registration ${reg.id} (${reg.name}) failed:`, err);
    }

    await recordWebhookDelivery({
      webhookRegistrationId: reg.id,
      triggerType,
      triggerEntityRef: triggerEntityRef ?? null,
      success: success ? 1 : 0,
      statusCode,
      errorMessage,
    });
  }
}
