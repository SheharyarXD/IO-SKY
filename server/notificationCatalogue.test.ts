/*
 * Milestone 3 §3.1 — Notification Event Catalogue integrity.
 *
 * These tests assert that the generated catalogue still matches the client's
 * "IO_SKY_Notification_Event_Catalogue_v1.0.pdf" (84 events, 9 families) and
 * that the structural guarantees the Notification Center Functional
 * Specification depends on actually hold in the data.
 *
 * They are deliberately strict about counts. The catalogue is generated from a
 * client-supplied specification, so a silent change in totals means either the
 * source document moved or the generator regressed, and both need a human.
 */
import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_FAMILIES,
  type NotificationFamily,
  getNotificationEvent,
  getNotificationEventByName,
  eventsInFamily,
  actionRequiredEvents,
} from "@shared/notificationCatalogue";

/** Per-family totals taken directly from the catalogue document. */
const EXPECTED_FAMILY_COUNTS: Record<NotificationFamily, number> = {
  discovery_calls: 10,
  ai_scans: 13,
  clients_accounts: 6,
  projects_delivery: 17,
  payments_billing: 8,
  ai_operations: 6,
  platform_integrations: 8,
  security_access: 10,
  governance_system: 6,
};

describe("Notification Event Catalogue — structure", () => {
  it("carries all 84 events from the v1.0 catalogue", () => {
    expect(NOTIFICATION_EVENTS).toHaveLength(84);
  });

  it("matches the per-family counts in the source document", () => {
    for (const family of NOTIFICATION_FAMILIES) {
      expect(
        eventsInFamily(family).length,
        `family ${family} should match the catalogue`,
      ).toBe(EXPECTED_FAMILY_COUNTS[family]);
    }
    const summed = Object.values(EXPECTED_FAMILY_COUNTS).reduce((a, b) => a + b, 0);
    expect(summed).toBe(NOTIFICATION_EVENTS.length);
  });

  it("gives every event a unique catalogue id and a unique machine name", () => {
    const ids = NOTIFICATION_EVENTS.map((e) => e.id);
    const names = NOTIFICATION_EVENTS.map((e) => e.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses only the nine declared families", () => {
    for (const e of NOTIFICATION_EVENTS) {
      expect(NOTIFICATION_FAMILIES).toContain(e.family);
    }
  });

  it("gives every event the fields routing and delivery depend on", () => {
    for (const e of NOTIFICATION_EVENTS) {
      expect(e.trigger, `${e.id} trigger`).not.toBe("");
      expect(e.recipients, `${e.id} recipients`).not.toBe("");
      expect(e.deduplication, `${e.id} deduplication`).not.toBe("");
      expect(e.deepLink, `${e.id} deep link`).not.toBe("");
      expect(e.actionType, `${e.id} action type`).not.toBe("");
    }
  });

  it("resolves every conditional priority to a concrete floor", () => {
    for (const e of NOTIFICATION_EVENTS) {
      expect(["P1", "P2", "P3", "P4"], `${e.id} priorityFloor`).toContain(e.priorityFloor);
      // The floor must be the most urgent level the spec text allows.
      const mentioned = e.priority.match(/P[1-4]/g);
      if (mentioned && mentioned.length) {
        expect(e.priorityFloor).toBe([...mentioned].sort()[0]);
      }
    }
  });
});

describe("Notification Event Catalogue — lookups", () => {
  it("finds an event by catalogue id", () => {
    const e = getNotificationEvent("AS-05");
    expect(e?.name).toBe("AI_SCAN_READY_FOR_REVIEW");
    expect(e?.family).toBe("ai_scans");
  });

  it("finds an event by machine name", () => {
    expect(getNotificationEventByName("DISCOVERY_CALL_REQUESTED")?.id).toBe("DC-01");
  });

  it("returns undefined rather than throwing for unknown keys", () => {
    expect(getNotificationEvent("ZZ-99")).toBeUndefined();
    expect(getNotificationEventByName("NOT_AN_EVENT")).toBeUndefined();
  });

  it("reports the events that require the recipient to act", () => {
    const acting = actionRequiredEvents();
    expect(acting.length).toBeGreaterThan(0);
    expect(acting.every((e) => e.actionType.toUpperCase().includes("ACTION_REQUIRED"))).toBe(true);
  });
});

describe("Notification Event Catalogue — specification invariants", () => {
  /*
   * Functional Specification §12: "Generated Scan output must never
   * automatically become visible to the Client." The review-stage events must
   * therefore not be marked Client-facing.
   */
  it("keeps pre-publication AI Scan review events away from the Client", () => {
    const reviewStage = ["AS-05", "AS-06", "AS-07", "AS-08", "AS-09"];
    for (const id of reviewStage) {
      const e = getNotificationEvent(id);
      expect(e, `${id} should exist`).toBeDefined();
      expect(
        /^no\b/i.test(e!.clientFacing.trim()),
        `${id} clientFacing should start with "No" but was "${e!.clientFacing}"`,
      ).toBe(true);
    }
  });

  it("declares a published AI Scan event, which is the Client-facing boundary", () => {
    const published = getNotificationEventByName("AI_SCAN_PUBLISHED");
    expect(published).toBeDefined();
    expect(published!.family).toBe("ai_scans");
  });

  /*
   * Functional Specification §29: credentials, passwords, secrets and tokens
   * must never appear in notification content. Nothing in the catalogue should
   * describe a preview that carries them.
   */
  it("never describes a notification preview containing secrets", () => {
    const forbidden = /\b(password|secret|token|credential)s?\b/i;
    for (const e of NOTIFICATION_EVENTS) {
      const describesExposure =
        forbidden.test(e.sensitiveContent) && !/\bno\b|\bnever\b|\bwithout\b/i.test(e.sensitiveContent);
      expect(describesExposure, `${e.id} sensitiveContent: ${e.sensitiveContent}`).toBe(false);
    }
  });

  /*
   * Functional Specification §35: deduplication needs a composite key that
   * accounts for who is receiving the notification, so two people watching the
   * same resource each still get their own row rather than one suppressing the
   * other. The catalogue names that actor in several ways depending on the
   * event ("recipient", "reviewer", "publisher", "users"), so the assertion
   * accepts any of them rather than insisting on one spelling.
   */
  it("scopes every deduplication key to whoever receives it", () => {
    const namesAnActor = /recipient|reviewer|publisher|assignee|user/i;
    for (const e of NOTIFICATION_EVENTS) {
      expect(
        namesAnActor.test(e.deduplication),
        `${e.id} deduplication should name the receiving actor: ${e.deduplication}`,
      ).toBe(true);
    }
  });
});
