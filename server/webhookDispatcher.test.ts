/*
 * IO SKY — Milestone 2 §2.6 integration/webhook registry dispatcher
 * (server/webhookDispatcher.ts). Locks in: only enabled registrations
 * matching the trigger are dispatched, a successful 2xx response records
 * a success delivery, a non-2xx response records a failure delivery
 * (without throwing), a network/fetch error is caught and recorded rather
 * than propagating, and the HMAC signature header is only sent when the
 * registration has a secret.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { listEnabledMock, recordDeliveryMock } = vi.hoisted(() => ({
  listEnabledMock: vi.fn(async () => [] as any[]),
  recordDeliveryMock: vi.fn(async () => {}),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listEnabledWebhookRegistrationsForTrigger: listEnabledMock,
    recordWebhookDelivery: recordDeliveryMock,
  };
});

import { dispatchWebhooksForTrigger } from "./webhookDispatcher";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("dispatchWebhooksForTrigger", () => {
  it("does nothing when no enabled registrations match the trigger", async () => {
    listEnabledMock.mockResolvedValueOnce([]);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;
    await dispatchWebhooksForTrigger("document_approved", {}, "5");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(recordDeliveryMock).not.toHaveBeenCalled();
  });

  it("POSTs to the registered URL and records a successful delivery", async () => {
    listEnabledMock.mockResolvedValueOnce([
      { id: 1, name: "CRM sync", url: "https://example.com/hook", secret: null, triggerType: "document_approved", enabled: 1 },
    ]);
    const fetchSpy = vi.fn().mockResolvedValueOnce({ ok: true, status: 200 });
    global.fetch = fetchSpy as any;
    await dispatchWebhooksForTrigger("document_approved", { documentId: 5 }, "5");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers["X-IOSKY-Signature"]).toBeUndefined();
    expect(recordDeliveryMock).toHaveBeenCalledWith(
      expect.objectContaining({ webhookRegistrationId: 1, success: 1, statusCode: 200 }),
    );
  });

  it("signs the payload with HMAC-SHA256 when the registration has a secret", async () => {
    listEnabledMock.mockResolvedValueOnce([
      { id: 2, name: "Signed hook", url: "https://example.com/hook", secret: "topsecret1234", triggerType: "document_approved", enabled: 1 },
    ]);
    const fetchSpy = vi.fn().mockResolvedValueOnce({ ok: true, status: 200 });
    global.fetch = fetchSpy as any;
    await dispatchWebhooksForTrigger("document_approved", {}, "5");
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers["X-IOSKY-Signature"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("records a failed delivery (not a throw) on a non-2xx response", async () => {
    listEnabledMock.mockResolvedValueOnce([
      { id: 3, name: "Flaky hook", url: "https://example.com/hook", secret: null, triggerType: "document_rejected", enabled: 1 },
    ]);
    const fetchSpy = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    global.fetch = fetchSpy as any;
    await expect(dispatchWebhooksForTrigger("document_rejected", {}, "5")).resolves.toBeUndefined();
    expect(recordDeliveryMock).toHaveBeenCalledWith(
      expect.objectContaining({ webhookRegistrationId: 3, success: 0, statusCode: 500 }),
    );
  });

  it("catches a network error and records a failed delivery with statusCode null", async () => {
    listEnabledMock.mockResolvedValueOnce([
      { id: 4, name: "Unreachable hook", url: "https://example.com/hook", secret: null, triggerType: "document_approved", enabled: 1 },
    ]);
    const fetchSpy = vi.fn().mockRejectedValueOnce(new Error("fetch failed"));
    global.fetch = fetchSpy as any;
    await expect(dispatchWebhooksForTrigger("document_approved", {}, "5")).resolves.toBeUndefined();
    expect(recordDeliveryMock).toHaveBeenCalledWith(
      expect.objectContaining({ webhookRegistrationId: 4, success: 0, statusCode: null, errorMessage: expect.stringContaining("fetch failed") }),
    );
  });
});
