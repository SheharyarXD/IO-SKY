/**
 * IO SKY — Resend delivery-status webhook (Milestone 2 §2.3).
 *
 * Resend signs webhook payloads using Svix (https://resend.com/docs/dashboard/webhooks/introduction).
 * Verification needs the exact raw request bytes, not a re-serialization
 * of the parsed JSON body — see server/_core/index.ts's express.json()
 * `verify` callback, which stashes those bytes on `req.rawBody`.
 *
 * Only bounce/complaint/delivery events are tracked (the ones
 * email_delivery_log's status enum models); email.sent/opened/clicked
 * events are acknowledged with 200 but otherwise ignored — Resend retries
 * a webhook endpoint that doesn't return 2xx, so every recognized event
 * type must be acked even when there's nothing to update.
 */
import type { Express, Request, Response } from "express";
import { Webhook } from "svix";
import { updateEmailDeliveryStatusByProviderMessageId } from "../db/emailDelivery";

type ResendWebhookEvent = {
  type: string;
  data: {
    email_id?: string;
    [key: string]: unknown;
  };
};

const EVENT_STATUS_MAP: Record<string, "delivered" | "bounced" | "complained"> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

export function registerResendWebhookRoutes(app: Express) {
  app.post("/api/webhooks/resend", async (req: Request, res: Response) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[ResendWebhook] RESEND_WEBHOOK_SECRET is not configured — rejecting webhook.");
      res.status(500).json({ ok: false, error: "Webhook not configured" });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ ok: false, error: "Missing raw body" });
      return;
    }

    let event: ResendWebhookEvent;
    try {
      const wh = new Webhook(secret);
      event = wh.verify(rawBody, {
        "svix-id": req.header("svix-id") ?? "",
        "svix-timestamp": req.header("svix-timestamp") ?? "",
        "svix-signature": req.header("svix-signature") ?? "",
      }) as ResendWebhookEvent;
    } catch (error) {
      console.warn("[ResendWebhook] Signature verification failed:", error);
      res.status(401).json({ ok: false, error: "Invalid signature" });
      return;
    }

    const status = EVENT_STATUS_MAP[event.type];
    const emailId = typeof event.data?.email_id === "string" ? event.data.email_id : undefined;

    if (!status || !emailId) {
      // Not a bounce/complaint/delivery event, or a malformed payload —
      // acknowledge so Resend doesn't retry, nothing to update.
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const updatedRows = await updateEmailDeliveryStatusByProviderMessageId(
      emailId,
      status,
      JSON.stringify(event.data).slice(0, 4000),
    );

    if (updatedRows === 0) {
      console.warn(
        `[ResendWebhook] No delivery-log row found for email_id=${emailId} (event=${event.type})`,
      );
    }

    res.status(200).json({ ok: true });
  });
}
