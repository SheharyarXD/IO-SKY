/*
 * N01 (SRS 17.15; 29 Oct Ch11): the catalogue mapped to the nine notification
 * families, with display names and a lookup the Notification Center filters on.
 */
import { describe, expect, it } from "vitest";
import { NOTIFICATION_EVENTS, NOTIFICATION_FAMILIES } from "../shared/notificationCatalogue";
import { countByFamily, familyLabelOfKind, familyOfKind, FAMILY_LABELS, filterByFamily } from "../shared/notificationFamilies";

describe("the nine families", () => {
  it("there are nine, each with a distinct plain display name", () => {
    expect(NOTIFICATION_FAMILIES).toHaveLength(9);
    expect(Object.keys(FAMILY_LABELS).sort()).toEqual([...NOTIFICATION_FAMILIES].sort());
    expect(new Set(Object.values(FAMILY_LABELS)).size).toBe(9);
    for (const label of Object.values(FAMILY_LABELS)) expect(label).toMatch(/^[A-Z][A-Za-z ]+$/);
  });
  it("every catalogue event belongs to exactly one family, and its id prefix agrees with its family", () => {
    const prefixFamily = new Map<string, string>();
    for (const e of NOTIFICATION_EVENTS) {
      expect(NOTIFICATION_FAMILIES, e.id).toContain(e.family);
      const prefix = e.id.slice(0, 2);
      const seen = prefixFamily.get(prefix);
      if (seen) expect(seen, `${e.id} prefix ${prefix}`).toBe(e.family);
      else prefixFamily.set(prefix, e.family);
    }
    expect(prefixFamily.size).toBe(9);
  });
  it("every family has at least one event", () => {
    for (const f of NOTIFICATION_FAMILIES) expect(NOTIFICATION_EVENTS.some((e) => e.family === f), f).toBe(true);
  });
});

describe("reading a stored notification's family", () => {
  it("comes from the catalogue by event id", () => {
    expect(familyOfKind("AS-05")).toBe("ai_scans");
    expect(familyOfKind("DC-01")).toBe("discovery_calls");
    expect(familyOfKind("SA-01")).toBe("security_access");
    expect(familyLabelOfKind("PB-02")).toBe("Payments and Billing");
  });
  it("is null for anything that is not a catalogue event id", () => {
    for (const k of ["billing", "account", "owner_alert", "", null, undefined, "as-05", "AS-5", "AS-05 ", "ZZ-99", "AS-99"]) expect(familyOfKind(k as never), String(k)).toBeNull();
    expect(familyLabelOfKind("billing")).toBeNull();
  });
});

describe("filtering and counting", () => {
  const items = [{ kind: "AS-05", n: 1 }, { kind: "AS-01", n: 2 }, { kind: "PB-02", n: 3 }, { kind: "owner_alert", n: 4 }];
  it("keeps only the chosen family, and everything when none is chosen", () => {
    expect(filterByFamily(items, "ai_scans").map((i) => i.n)).toEqual([1, 2]);
    expect(filterByFamily(items, "payments_billing").map((i) => i.n)).toEqual([3]);
    expect(filterByFamily(items, "governance_system")).toEqual([]);
    expect(filterByFamily(items, "")).toHaveLength(4);
    expect(filterByFamily(items, undefined)).toHaveLength(4);
  });
  it("counts every family, including empty ones, and puts the rest under other", () => {
    const c = countByFamily(items);
    expect(c.ai_scans).toBe(2);
    expect(c.payments_billing).toBe(1);
    expect(c.other).toBe(1);
    expect(c.governance_system).toBe(0);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(items.length);
    expect(Object.keys(c)).toHaveLength(10);
  });
});
