/**
 * Production static-file serving.
 *
 * Milestone 3 §3.2: split out of `./vite.ts`, which imports `vite` and
 * `vite.config` at module scope. Both `setupVite` (development) and
 * `serveStatic` (production) used to live there, so the production path
 * imported the module and, with it, a *static* dependency on `vite`.
 *
 * That is invisible locally, because devDependencies are installed. It is
 * fatal in a production image: `pnpm prune --prod` correctly removes `vite`,
 * and the container then dies at boot with
 *
 *     Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite'
 *         imported from /app/dist/index.js
 *
 * Found by the first real Railway deploy — the build succeeded, the image
 * pushed, and the container crash-looped. No local check would have caught
 * it, because `pnpm run build` and `node dist/index.js` both run against a
 * full node_modules tree.
 *
 * Keeping this module free of any build-tool import is the actual fix; the
 * dev-only `./vite.ts` is now loaded through a dynamic import that never
 * executes in production.
 */
import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html so client-side routing handles deep links.
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
