/**
 * IO SKY — OAuth callback role-based redirect specs.
 *
 * The only behaviour that has to remain stable here is the
 * `roleBasedDestination` mapping that decides where each authenticated
 * role lands after a successful OAuth callback. We test the pure
 * function directly so the spec stays fast and deterministic and does
 * not depend on the Manus SDK or Express runtime.
 */
import { describe, expect, it } from "vitest";
import { roleBasedDestination } from "./_core/oauth";

describe("OAuth callback — role-based redirect", () => {
  it("routes role=developer to /developer-workspace", () => {
    expect(roleBasedDestination("developer", "/")).toBe("/developer-workspace");
  });

  it("routes role=client (and client_member) to /client-portal", () => {
    expect(roleBasedDestination("client", "/")).toBe("/client-portal");
    expect(roleBasedDestination("client_member", "/")).toBe("/client-portal");
  });

  it("routes role=admin to /admin/bookings", () => {
    expect(roleBasedDestination("admin", "/")).toBe("/admin/bookings");
  });

  it("falls back to the requested returnPath for role=user", () => {
    expect(roleBasedDestination("user", "/account")).toBe("/account");
  });

  it("falls back to / when role is unknown and no returnPath given", () => {
    expect(roleBasedDestination("ghost", "/")).toBe("/");
    expect(roleBasedDestination(null, "/")).toBe("/");
    expect(roleBasedDestination(undefined, "/")).toBe("/");
  });
});
