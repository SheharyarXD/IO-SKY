import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

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
