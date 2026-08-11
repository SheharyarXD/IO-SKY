import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // client/src/**/*.test.ts is scoped to pure, DOM-free logic only (e.g.
    // client/src/_core/hooks/useRouteGuard.test.ts) - there is no
    // jsdom/@testing-library setup in this project yet, so component/hook
    // rendering tests still don't belong here. Broadening this further to
    // cover component tests is a separate decision (new test environment,
    // new dependency), not made as part of this change.
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/src/**/*.test.ts",
    ],
  },
});
