/*
 * Security policy (SRS 24.12): administrator-set values that the platform
 * enforces, and the safe fallbacks that stop a bad value locking anyone out.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSessionTtlMs, setSessionPolicyHours, DEFAULT_SESSION_TTL_MS } from "@shared/const";

vi.mock("./db", () => ({ getDb: vi.fn(async () => null) }));

import { applyPolicyValues, getPasswordMinLength } from "./_core/policy";
import { MIN_PASSWORD_LENGTH } from "../shared/srsRules";

afterEach(() => {
  setSessionPolicyHours(null);
  applyPolicyValues({});
  delete process.env.SESSION_TTL_HOURS;
});

describe("session length policy", () => {
  it("uses the built in default when nothing is set", () => {
    expect(getSessionTtlMs()).toBe(DEFAULT_SESSION_TTL_MS);
  });

  it("uses the environment value when there is no policy", () => {
    process.env.SESSION_TTL_HOURS = "6";
    expect(getSessionTtlMs()).toBe(6 * 3_600_000);
  });

  it("lets the policy win over the environment", () => {
    process.env.SESSION_TTL_HOURS = "6";
    applyPolicyValues({ "security.session_hours": "2" });
    expect(getSessionTtlMs()).toBe(2 * 3_600_000);
  });

  it("ignores an out of range value instead of locking everyone out", () => {
    applyPolicyValues({ "security.session_hours": "0" });
    expect(getSessionTtlMs()).toBe(DEFAULT_SESSION_TTL_MS);
    applyPolicyValues({ "security.session_hours": "500" });
    expect(getSessionTtlMs()).toBe(DEFAULT_SESSION_TTL_MS);
    applyPolicyValues({ "security.session_hours": "abc" });
    expect(getSessionTtlMs()).toBe(DEFAULT_SESSION_TTL_MS);
  });

  it("returns to the fallback when the policy is cleared", () => {
    applyPolicyValues({ "security.session_hours": "3" });
    applyPolicyValues({});
    expect(getSessionTtlMs()).toBe(DEFAULT_SESSION_TTL_MS);
  });
});

describe("password length policy", () => {
  it("defaults to the platform minimum", () => {
    expect(getPasswordMinLength()).toBe(MIN_PASSWORD_LENGTH);
  });

  it("applies a valid configured minimum", () => {
    applyPolicyValues({ "security.password_min_length": "16" });
    expect(getPasswordMinLength()).toBe(16);
  });

  it("refuses a minimum below the safe floor", () => {
    applyPolicyValues({ "security.password_min_length": "4" });
    expect(getPasswordMinLength()).toBe(MIN_PASSWORD_LENGTH);
  });
});
