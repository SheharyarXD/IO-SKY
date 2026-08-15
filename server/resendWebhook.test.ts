/**
 * server/_core/resendWebhookRoute.ts — Resend delivery-status webhook
 * (Milestone 2 §2.3). Verifies real Svix signature checking (not stubbed
 * out) against server/db/emailDelivery.ts's update path.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Request, Response } from "express";
import { Webhook } from "svix";

vi.mock("./db/emailDelivery", () => ({
  updateEmailDeliveryStatusByProviderMessageId: vi.fn(async () => 1),
}));

import { updateEmailDeliveryStatusByProviderMessageId } from "./db/emailDelivery";
import { registerResendWebhookRoutes } from "./_core/resendWebhookRoute";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"; // test-only, not a real credential

type Capture = { status: number; body: any };

function post(
  rawBody: Buffer,
  headers: Record<string, string>,
): Promise<Capture> {
  return new Promise((resolve) => {
    const app = express();
    registerResendWebhookRoutes(app);

    const cap: Capture = { status: 0, body: undefined };
    const req = {
      body: JSON.parse(rawBody.toString()),
      rawBody,
      headers,
      header(name: string) {
        return headers[name.toLowerCase()];
      },
      method: "POST",
      url: "/api/webhooks/resend",
    } as unknown as Request;

    const res = {
      status(code: number) {
        cap.status = code;
        return this;
      },
      json(payload: any) {
        cap.body = payload;
        resolve(cap);
        return this;
      },
    } as unknown as Response;

    const stack = (app as any)._router.stack as Array<any>;
    const layer = stack.find(
      (l) => l.route && l.route.path === "/api/webhooks/resend",
    );
    const handler = layer.route.stack[0].handle as (
      r: Request,
      s: Response,
    ) => Promise<void> | void;
    void Promise.resolve(handler(req, res));
  });
}

function signedHeaders(payload: string, secret = SECRET) {
  const wh = new Webhook(secret);
  const msgId = "msg_test123";
  const timestamp = new Date();
  const signature = wh.sign(msgId, timestamp, payload);
  return {
    "svix-id": msgId,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  };
}

describe("Resend webhook route (Milestone 2 §2.3)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("rejects with 500 when RESEND_WEBHOOK_SECRET is not configured — fails closed, not silently", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "em_1" } });
    const res = await post(Buffer.from(payload), signedHeaders(payload));
    expect(res.status).toBe(500);
    expect(updateEmailDeliveryStatusByProviderMessageId).not.toHaveBeenCalled();
  });

  it("rejects an unsigned/tampered payload with 401", async () => {
    const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "em_1" } });
    const badHeaders = signedHeaders(payload);
    const tamperedPayload = JSON.stringify({ type: "email.delivered", data: { email_id: "em_EVIL" } });
    const res = await post(Buffer.from(tamperedPayload), badHeaders);
    expect(res.status).toBe(401);
    expect(updateEmailDeliveryStatusByProviderMessageId).not.toHaveBeenCalled();
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "em_1" } });
    const res = await post(Buffer.from(payload), signedHeaders(payload, "whsec_wrongSecretWrongSecretWrong1"));
    expect(res.status).toBe(401);
  });

  it("applies a valid email.delivered event to the matching log row", async () => {
    const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "em_abc123" } });
    const res = await post(Buffer.from(payload), signedHeaders(payload));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(updateEmailDeliveryStatusByProviderMessageId).toHaveBeenCalledWith(
      "em_abc123",
      "delivered",
      expect.stringContaining("em_abc123"),
    );
  });

  it("maps email.bounced and email.complained to the right status", async () => {
    for (const [type, expected] of [
      ["email.bounced", "bounced"],
      ["email.complained", "complained"],
    ] as const) {
      vi.clearAllMocks();
      const payload = JSON.stringify({ type, data: { email_id: "em_xyz" } });
      const res = await post(Buffer.from(payload), signedHeaders(payload));
      expect(res.status).toBe(200);
      expect(updateEmailDeliveryStatusByProviderMessageId).toHaveBeenCalledWith(
        "em_xyz",
        expected,
        expect.any(String),
      );
    }
  });

  it("acknowledges but ignores event types it doesn't track (e.g. email.opened)", async () => {
    const payload = JSON.stringify({ type: "email.opened", data: { email_id: "em_1" } });
    const res = await post(Buffer.from(payload), signedHeaders(payload));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ignored: true });
    expect(updateEmailDeliveryStatusByProviderMessageId).not.toHaveBeenCalled();
  });
});
