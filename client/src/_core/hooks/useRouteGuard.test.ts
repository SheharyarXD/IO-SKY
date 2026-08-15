/**
 * RM-58/59 — pure-logic coverage for the shared route-guard helpers.
 * Deliberately does not test `useRouteGuard()` itself (that's a React hook
 * wrapping `useAuth()`/trpc and needs a jsdom + React Testing Library setup
 * this project doesn't have yet) — only the three plain functions it
 * exports, which have no React/DOM dependency.
 */
import { describe, expect, it } from "vitest";
import { isAdminRole, isImpersonatingTarget, recordAttemptProvider, roleHome } from "./useRouteGuard";

describe("roleHome", () => {
  it("maps every known role to its portal", () => {
    expect(roleHome("admin")).toBe("/admin");
    expect(roleHome("super_admin")).toBe("/admin");
    expect(roleHome("client")).toBe("/client-portal");
    expect(roleHome("client_member")).toBe("/client-portal");
    expect(roleHome("developer")).toBe("/developer-workspace");
  });

  it("falls back to / for user role and unknown/missing values", () => {
    expect(roleHome("user")).toBe("/");
    expect(roleHome("something-unexpected")).toBe("/");
    expect(roleHome(null)).toBe("/");
    expect(roleHome(undefined)).toBe("/");
  });
});

describe("isAdminRole (RM-57)", () => {
  it("is true for admin and super_admin (strict superset)", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
  });

  it("is false for every non-admin role and missing values", () => {
    expect(isAdminRole("client")).toBe(false);
    expect(isAdminRole("developer")).toBe(false);
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe("isImpersonatingTarget", () => {
  it("is true only when impersonation is active AND targets the given role", () => {
    expect(
      isImpersonatingTarget({ impersonation: { active: true, target: "client" } }, "client"),
    ).toBe(true);
    expect(
      isImpersonatingTarget({ impersonation: { active: true, target: "developer" } }, "client"),
    ).toBe(false);
    expect(
      isImpersonatingTarget({ impersonation: { active: false, target: "client" } }, "client"),
    ).toBe(false);
  });

  it("is false for null/undefined user or missing impersonation", () => {
    expect(isImpersonatingTarget(null, "client")).toBe(false);
    expect(isImpersonatingTarget(undefined, "client")).toBe(false);
    expect(isImpersonatingTarget({}, "client")).toBe(false);
    expect(isImpersonatingTarget({ impersonation: null }, "client")).toBe(false);
  });
});

describe("recordAttemptProvider", () => {
  it("passes through every valid non-manus/credentials provider value", () => {
    expect(recordAttemptProvider("supabase")).toBe("supabase");
    expect(recordAttemptProvider("google")).toBe("google");
    expect(recordAttemptProvider("microsoft")).toBe("microsoft");
    expect(recordAttemptProvider("apple")).toBe("apple");
    expect(recordAttemptProvider("magic-link")).toBe("magic-link");
  });

  it("falls back to credentials for unknown values, including the ones deriveLoginMethod() can actually produce", () => {
    expect(recordAttemptProvider("email")).toBe("credentials");
    expect(recordAttemptProvider("github")).toBe("credentials");
    expect(recordAttemptProvider(null)).toBe("credentials");
    expect(recordAttemptProvider(undefined)).toBe("credentials");
  });
});
