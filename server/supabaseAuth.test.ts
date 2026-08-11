import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_JWKS_URL"] as const;
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("getSupabaseAdmin", () => {
  it("throws a clear config error when SUPABASE_URL/SECRET_KEY are unset", async () => {
    const { getSupabaseAdmin } = await import("./_core/supabaseAuth");
    expect(() => getSupabaseAdmin()).toThrow(/SUPABASE_URL and SUPABASE_SECRET_KEY/);
  });

  it("succeeds once both vars are set", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test_key";
    const { getSupabaseAdmin } = await import("./_core/supabaseAuth");
    expect(() => getSupabaseAdmin()).not.toThrow();
  });
});

describe("verifySupabaseAccessToken", () => {
  it("returns null for a missing token without touching config", async () => {
    const { verifySupabaseAccessToken } = await import("./_core/supabaseAuth");
    await expect(verifySupabaseAccessToken(null)).resolves.toBeNull();
    await expect(verifySupabaseAccessToken(undefined)).resolves.toBeNull();
    await expect(verifySupabaseAccessToken("")).resolves.toBeNull();
  });

  it("throws a clear config error when SUPABASE_JWKS_URL is unset, rather than silently returning null", async () => {
    const { verifySupabaseAccessToken } = await import("./_core/supabaseAuth");
    await expect(verifySupabaseAccessToken("not-a-real-jwt")).rejects.toThrow(
      /SUPABASE_JWKS_URL/,
    );
  });

  it("returns null (not a throw) for a malformed token once JWKS is configured", async () => {
    // A syntactically invalid JWT should fail signature verification and
    // resolve to null — it must not be confused with the "unconfigured"
    // case above, which throws instead.
    process.env.SUPABASE_JWKS_URL = "https://example.supabase.co/auth/v1/.well-known/jwks.json";
    const { verifySupabaseAccessToken } = await import("./_core/supabaseAuth");
    await expect(verifySupabaseAccessToken("not-a-real-jwt")).resolves.toBeNull();
  });
});
