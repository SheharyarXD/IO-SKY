/*
 * I07: /health/version and the deployment record must name the build that is
 * serving traffic. The Dockerfile defaults GIT_COMMIT_SHA to the literal
 * "unknown", which used to hide the commit Railway injects at runtime.
 */
import { describe, expect, it } from "vitest";
import { resolveBuildTimestamp, resolveReleaseCommit } from "./_core/releaseIdentity";

describe("resolveReleaseCommit", () => {
  it("uses GIT_COMMIT_SHA when the build set a real value", () => {
    expect(resolveReleaseCommit({ GIT_COMMIT_SHA: "abc1234", RAILWAY_GIT_COMMIT_SHA: "zzz" })).toBe("abc1234");
  });

  it("falls through the Dockerfile placeholder to the commit Railway injects", () => {
    expect(resolveReleaseCommit({ GIT_COMMIT_SHA: "unknown", RAILWAY_GIT_COMMIT_SHA: "def5678" })).toBe("def5678");
    expect(resolveReleaseCommit({ GIT_COMMIT_SHA: "UNKNOWN", RAILWAY_GIT_COMMIT_SHA: "def5678" })).toBe("def5678");
  });

  it("skips empty and whitespace values, then uses the later fallbacks in order", () => {
    expect(resolveReleaseCommit({ GIT_COMMIT_SHA: "  ", RAILWAY_GIT_COMMIT_SHA: "", GIT_COMMIT: "g1", SOURCE_COMMIT: "s1" })).toBe("g1");
    expect(resolveReleaseCommit({ SOURCE_COMMIT: "s1" })).toBe("s1");
  });

  it("returns null, never an invented value, when nothing real is set", () => {
    expect(resolveReleaseCommit({})).toBeNull();
    expect(resolveReleaseCommit({ GIT_COMMIT_SHA: "unknown", GIT_COMMIT: "unknown" })).toBeNull();
  });
});

describe("resolveBuildTimestamp", () => {
  it("treats the placeholder as unset", () => {
    expect(resolveBuildTimestamp({ BUILD_TIMESTAMP: "unknown" })).toBeNull();
    expect(resolveBuildTimestamp({ BUILD_TIMESTAMP: "2026-10-29T12:00:00Z" })).toBe("2026-10-29T12:00:00Z");
  });
});
