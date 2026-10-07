/*
 * Notification dispatcher (SRS 17): catalogue validation, de-duplication,
 * email policy, preferences via the notify services, and the rule that a
 * failure never throws into the business action that triggered it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  recordNotificationEvent: vi.fn(),
  createAdminNotification: vi.fn(async () => null),
  notifyClient: vi.fn(async () => {}),
  notifyDeveloper: vi.fn(async () => {}),
}));

vi.mock("./db", () => ({
  recordNotificationEvent: m.recordNotificationEvent,
  createAdminNotification: m.createAdminNotification,
}));
vi.mock("./notifications", () => ({ notifyClient: m.notifyClient, notifyDeveloper: m.notifyDeveloper }));

import { emitNotification } from "./notificationDispatcher";
import { NOTIFICATION_EVENTS } from "../shared/notificationCatalogue";
import { buildDedupKey, catalogueWantsEmail, inAppPriority, kindForFamily } from "../shared/srsRules";

beforeEach(() => {
  vi.clearAllMocks();
  m.recordNotificationEvent.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("emitNotification", () => {
  it("rejects a name that is not in the catalogue without delivering anything", async () => {
    const r = await emitNotification({ event: "NOT_A_REAL_EVENT", audience: { type: "admin" }, dedupeRef: "x" });
    expect(r).toEqual({ delivered: false, reason: "unknown_event" });
    expect(m.recordNotificationEvent).not.toHaveBeenCalled();
    expect(m.createAdminNotification).not.toHaveBeenCalled();
  });

  it("delivers a repeated occurrence only once", async () => {
    m.recordNotificationEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const a = await emitNotification({ event: "AI_SCAN_READY_FOR_REVIEW", audience: { type: "admin" }, dedupeRef: "scan:1" });
    const b = await emitNotification({ event: "AI_SCAN_READY_FOR_REVIEW", audience: { type: "admin" }, dedupeRef: "scan:1" });
    expect(a).toMatchObject({ delivered: true, eventId: "AS-05" });
    expect(b).toEqual({ delivered: false, reason: "duplicate" });
    expect(m.createAdminNotification).toHaveBeenCalledTimes(1);
  });

  it("records the catalogue id, priority and a key scoped to event, audience, recipient and occurrence", async () => {
    await emitNotification({ event: "AI_SCAN_READY_FOR_REVIEW", audience: { type: "admin" }, dedupeRef: "scan:7" });
    expect(m.recordNotificationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "AS-05", audience: "admin", recipientRef: "admin", priority: "P2", dedupKey: "AS-05|admin|admin|scan:7" }),
    );
  });

  it("maps priority onto the in app scale", async () => {
    await emitNotification({ event: "AI_SCAN_ANALYSIS_EXCEPTION", audience: { type: "admin" }, dedupeRef: "s" });
    expect(m.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({ priority: "critical", kind: "AS-04" }));
  });

  it("does not fill the admin bell twice when the caller already did", async () => {
    await emitNotification({ event: "DISCOVERY_CALL_REQUESTED", audience: { type: "admin" }, dedupeRef: "booking:1", skipAdminFeed: true });
    expect(m.recordNotificationEvent).toHaveBeenCalledTimes(1);
    expect(m.createAdminNotification).not.toHaveBeenCalled();
  });

  it("routes to a client organization with an email when the catalogue asks for one", async () => {
    await emitNotification({ event: "INVOICE_CREATED_ACTION_REQUIRED", audience: { type: "client", organizationId: 4 }, dedupeRef: "invoice:9", href: "/client-portal/billing" });
    const ev = NOTIFICATION_EVENTS.find((e) => e.name === "INVOICE_CREATED_ACTION_REQUIRED")!;
    expect(m.notifyClient).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 4, kind: "billing", channel: catalogueWantsEmail(ev.emailDelivery) ? "in_app_and_email" : "in_app" }),
    );
    expect(m.createAdminNotification).not.toHaveBeenCalled();
  });

  it("routes a developer event and sends a mandatory one by email", async () => {
    await emitNotification({ event: "PROJECT_ASSIGNED", audience: { type: "developer", developerId: 3 }, dedupeRef: "p:1:3" });
    expect(m.notifyDeveloper).toHaveBeenCalledWith(expect.objectContaining({ developerId: 3, kind: "project", channel: "in_app_and_email" }));
  });

  it("files a security event under the security category so it cannot be opted out of", async () => {
    await emitNotification({ event: "SECURITY_ALERT_CRITICAL", audience: { type: "client", organizationId: 1 }, dedupeRef: "a" });
    expect(m.notifyClient).toHaveBeenCalledWith(expect.objectContaining({ kind: "security" }));
  });

  it("never throws into the caller when delivery fails", async () => {
    m.createAdminNotification.mockRejectedValueOnce(new Error("db down"));
    await expect(emitNotification({ event: "AI_SCAN_SUBMITTED", audience: { type: "admin" }, dedupeRef: "s1" })).resolves.toEqual({ delivered: false, reason: "error" });
  });

  it("still delivers when the emission log cannot be written because there is no database", async () => {
    m.recordNotificationEvent.mockResolvedValueOnce(true);
    await expect(emitNotification({ event: "AI_SCAN_SUBMITTED", audience: { type: "admin" }, dedupeRef: "s2" })).resolves.toMatchObject({ delivered: true });
  });
});

describe("dispatch policy helpers", () => {
  it("reads only the leading keyword of the email policy", () => {
    expect(catalogueWantsEmail("IMMEDIATE")).toBe(true);
    expect(catalogueWantsEmail("MANDATORY")).toBe(true);
    expect(catalogueWantsEmail("IMMEDIATE where time-sensitive")).toBe(true);
    expect(catalogueWantsEmail("OPTIONAL internally; Client publication IMMEDIATE")).toBe(false);
    expect(catalogueWantsEmail("Context dependent")).toBe(false);
  });
  it("maps priorities and families", () => {
    expect(inAppPriority("P1")).toBe("critical");
    expect(inAppPriority("P4")).toBe("low");
    expect(kindForFamily("security_access")).toBe("security");
    expect(kindForFamily("governance_system")).toBe("account");
  });
  it("builds a bounded dedupe key", () => {
    expect(buildDedupKey({ eventId: "AS-05", audience: "admin", recipientRef: "admin", ref: " scan:1 " })).toBe("AS-05|admin|admin|scan:1");
    expect(buildDedupKey({ eventId: "A", audience: "b", recipientRef: "c", ref: "x".repeat(500) }).length).toBe(300);
  });
  it("resolves every catalogue event to a routable family and priority", () => {
    for (const e of NOTIFICATION_EVENTS) {
      expect(kindForFamily(e.family)).toBeTruthy();
      expect(["P1", "P2", "P3", "P4"]).toContain(e.priorityFloor);
    }
  });
});
