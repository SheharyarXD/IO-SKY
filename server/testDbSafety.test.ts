/*
 * M4-05: a normal test run is database-free, and database tests can only
 * target a deliberately configured isolated database that is not production.
 * Every URL below is fabricated (.invalid / .test hosts); nothing connects.
 */
import { describe, expect, it } from "vitest";
import {
  assertWorkerEnvironmentSafe,
  dbIdentity,
  GUARDED_VARIABLES,
  resolveTestDatabaseEnv,
  sameDatabase,
  UnsafeTestDatabaseError,
} from "../shared/testDbSafety";

const PROD = "postgresql://postgres.abcdefghij0123456789:s3cret@aws-0-eu-west-1.pooler.example.invalid:6543/postgres";
const TEST = "postgresql://postgres.zzzzzzzzzz9876543210:t3st@aws-0-eu-west-1.pooler.example.invalid:6543/postgres";

describe("default: database-free", () => {
  it("blanks every guarded variable, even when the shell and .env hold production values", () => {
    const r = resolveTestDatabaseEnv(
      { DATABASE_URL: PROD, SUPABASE_URL: "https://abcdefghij0123456789.supabase.test", SUPABASE_SECRET_KEY: "x", TEST_DATABASE_URL: TEST },
      { DATABASE_URL: PROD },
    );
    expect(r.mode).toBe("database-free");
    for (const k of GUARDED_VARIABLES) expect(r.env[k]).toBe("");
  });

  it("is database-free when ALLOW_DB_TESTS is anything but exactly 1", () => {
    for (const v of ["", "0", "true", "yes", "2", " "]) {
      expect(resolveTestDatabaseEnv({ ALLOW_DB_TESTS: v, TEST_DATABASE_URL: TEST }).mode).toBe("database-free");
    }
  });

  it("does not need any configuration", () => {
    expect(resolveTestDatabaseEnv({}).mode).toBe("database-free");
  });
});

describe("opt-in: isolated test database", () => {
  it("uses TEST_DATABASE_URL and nothing else", () => {
    const r = resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: TEST, DATABASE_URL: PROD }, { DATABASE_URL: PROD });
    expect(r.mode).toBe("isolated-test-database");
    expect(r.env.DATABASE_URL).toBe(TEST);
    expect(r.env.SUPABASE_URL).toBe("");
    expect(r.env.SUPABASE_SECRET_KEY).toBe("");
  });

  it("refuses to run when the opt-in has no test database", () => {
    expect(() => resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1" })).toThrow(UnsafeTestDatabaseError);
    expect(() => resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: "  " })).toThrow(/TEST_DATABASE_URL is empty/);
  });

  it("refuses a malformed or non-postgres URL", () => {
    expect(() => resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: "not a url" })).toThrow(/valid postgres/);
    expect(() => resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: "https://example.test/db" })).toThrow(/valid postgres/);
  });

  it("refuses a test URL equal to the production URL from the shell, .env or PRODUCTION_DATABASE_URL", () => {
    expect(() => resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: PROD, DATABASE_URL: PROD })).toThrow(/production database/);
    expect(() => resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: PROD }, { DATABASE_URL: PROD })).toThrow(/production database/);
    expect(() => resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: PROD, PRODUCTION_DATABASE_URL: PROD })).toThrow(/production database/);
  });

  it("refuses the same Supabase project reached through a different URL form or password", () => {
    const sameProjectOtherPassword = "postgresql://postgres.abcdefghij0123456789:different@other-host.example.invalid:5432/postgres";
    expect(() => resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: sameProjectOtherPassword }, { DATABASE_URL: PROD })).toThrow(/production database/);
    const direct = "postgresql://postgres:pw@db.abcdefghij0123456789.supabase.co:5432/postgres";
    expect(() => resolveTestDatabaseEnv({ ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: direct }, { DATABASE_URL: "postgresql://postgres.abcdefghij0123456789:x@pooler.example.invalid:6543/postgres" })).toThrow(/production database/);
  });

  it("accepts Supabase API test settings only for a different project host", () => {
    const base = { ALLOW_DB_TESTS: "1", TEST_DATABASE_URL: TEST, TEST_SUPABASE_PUBLISHABLE_KEY: "pk", TEST_SUPABASE_SECRET_KEY: "sk" };
    const ok = resolveTestDatabaseEnv({ ...base, TEST_SUPABASE_URL: "https://zzzzzzzzzz9876543210.supabase.test" }, { SUPABASE_URL: "https://abcdefghij0123456789.supabase.test" });
    expect(ok.env.SUPABASE_URL).toBe("https://zzzzzzzzzz9876543210.supabase.test");
    expect(ok.env.SUPABASE_SECRET_KEY).toBe("sk");
    expect(() => resolveTestDatabaseEnv({ ...base, TEST_SUPABASE_URL: "https://abcdefghij0123456789.supabase.test" }, { SUPABASE_URL: "https://abcdefghij0123456789.supabase.test" })).toThrow(/production Supabase/);
  });
});

describe("identity helpers never expose the password", () => {
  it("reads host, database and project reference only", () => {
    const id = dbIdentity(PROD)!;
    expect(id.projectRef).toBe("abcdefghij0123456789");
    expect(id.endpoint).not.toContain("s3cret");
    expect(JSON.stringify(id)).not.toContain("s3cret");
  });
  it("treats unparseable input as no database", () => {
    expect(dbIdentity("")).toBeNull();
    expect(dbIdentity(undefined)).toBeNull();
    expect(sameDatabase("garbage", PROD)).toBe(false);
  });
});

describe("worker last line of defence", () => {
  it("passes when no database URL is present", () => {
    expect(() => assertWorkerEnvironmentSafe({})).not.toThrow();
    expect(() => assertWorkerEnvironmentSafe({ DATABASE_URL: "" })).not.toThrow();
  });
  it("fails a worker that holds a database URL without the opt-in", () => {
    expect(() => assertWorkerEnvironmentSafe({ DATABASE_URL: PROD })).toThrow(UnsafeTestDatabaseError);
    expect(() => assertWorkerEnvironmentSafe({ DATABASE_URL: PROD, TEST_DATABASE_URL: TEST, ALLOW_DB_TESTS: "1" })).toThrow(UnsafeTestDatabaseError);
    expect(() => assertWorkerEnvironmentSafe({ DATABASE_URL: TEST, TEST_DATABASE_URL: TEST })).toThrow(UnsafeTestDatabaseError);
  });
  it("allows exactly the opted-in test URL", () => {
    expect(() => assertWorkerEnvironmentSafe({ DATABASE_URL: TEST, TEST_DATABASE_URL: TEST, ALLOW_DB_TESTS: "1" })).not.toThrow();
  });
});

describe("this very run", () => {
  it("has no database URL in its environment unless an isolated test database was deliberately configured", () => {
    if (process.env.TEST_DB_MODE === "isolated-test-database") {
      expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
    } else {
      expect(process.env.TEST_DB_MODE).toBe("database-free");
      for (const k of GUARDED_VARIABLES) expect(process.env[k] ?? "").toBe("");
    }
  });
});
