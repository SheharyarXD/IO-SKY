import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";
import { parse as parseDotenv } from "dotenv";
import { resolveTestDatabaseEnv } from "./shared/testDbSafety";

const templateRoot = path.resolve(import.meta.dirname);

// M4-05: a normal run must never reach a real database. The repository .env holds
// the production DATABASE_URL and several suites load it with "dotenv/config", so
// the variables are forced here, before any worker starts: blank by default, or
// an explicitly configured isolated TEST_DATABASE_URL (see shared/testDbSafety.ts).
// dotenv does not override a variable that is already defined, even when empty.
const dotenvValues = (() => {
  try {
    return parseDotenv(fs.readFileSync(path.join(templateRoot, ".env"), "utf8"));
  } catch {
    return {};
  }
})();
const testDb = resolveTestDatabaseEnv(process.env, dotenvValues);
if (testDb.mode === "isolated-test-database") {
  console.warn("[vitest] ALLOW_DB_TESTS=1: database tests will run against TEST_DATABASE_URL (verified not to be production).");
}

export default defineConfig({
  root: templateRoot,
  // Milestone 3 §3.4 (RM-97): the React plugin is needed so component test
  // files (.test.tsx) get JSX transformed. Server tests are unaffected — they
  // contain no JSX, so the plugin is a no-op for them.
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    // PRODUCTION_* exist only so the guard can refuse them; tests never see them.
    env: { ...testDb.env, PRODUCTION_DATABASE_URL: "", PRODUCTION_SUPABASE_URL: "", TEST_DB_MODE: testDb.mode },
    // Default stays `node`: the overwhelming majority of the suite is server
    // code, and running it under jsdom would be slower and would mask
    // accidental DOM dependencies in server modules.
    environment: "node",
    // RM-97 introduces React Testing Library. Component tests use the `.tsx`
    // extension and get jsdom; everything else keeps the node environment.
    //
    // The previous comment here said broadening this "is a separate decision
    // (new test environment, new dependency), not made as part of this
    // change". RM-97 is that decision.
    environmentMatchGlobs: [["client/src/**/*.test.tsx", "jsdom"]],
    setupFiles: ["client/src/test/setup.ts"],
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      // Pure, DOM-free client logic (e.g. _core/hooks/useRouteGuard.test.ts).
      "client/src/**/*.test.ts",
      // Component/hook rendering tests (RM-97..RM-100).
      "client/src/**/*.test.tsx",
    ],
  },
});
