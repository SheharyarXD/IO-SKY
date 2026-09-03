/**
 * Milestone 3 §3.2 — the production bundle must not import dev-only packages.
 *
 * Written after the first real Railway deploy crash-looped:
 *
 *     Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite'
 *         imported from /app/dist/index.js
 *
 * `server/_core/vite.ts` exported both `setupVite` (development) and
 * `serveStatic` (production) from a module that imports `vite` and
 * `vite.config` at module scope. Production imported the module for
 * `serveStatic` and inherited a hard dependency on `vite`, which
 * `pnpm prune --prod` correctly strips from the image.
 *
 * Nothing local caught it. `pnpm run build` and `node dist/index.js` both run
 * against a full node_modules tree, so the missing package only surfaces in an
 * environment where devDependencies are actually absent.
 *
 * This test closes that gap without needing a container: it inspects the built
 * bundle for imports of packages that are devDependencies. If the bundle
 * references one, the deploy would crash — and this fails first.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const bundlePath = path.join(repoRoot, "dist", "index.js");
const built = fs.existsSync(bundlePath);

if (!built) {
  console.warn(
    "[productionBundle.test] Skipping — dist/index.js not present. Run `pnpm run build` first; " +
      "CI's artifact-scan job builds before testing.",
  );
}

describe.skipIf(!built)("production server bundle", () => {
  const source = built ? fs.readFileSync(bundlePath, "utf8") : "";
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const devDeps = Object.keys(pkg.devDependencies ?? {});

  /** Bare package specifiers the bundle imports at module scope. */
  function staticImports(src: string): string[] {
    const found = new Set<string>();
    const re = /(?:^|\n)\s*import\s[^;]*?from\s*["']([^"'.][^"']*)["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) found.add(m[1]);
    // Bare side-effect imports, e.g. `import "dotenv/config"`.
    const re2 = /(?:^|\n)\s*import\s*["']([^"'.][^"']*)["']/g;
    while ((m = re2.exec(src))) found.add(m[1]);
    return [...found];
  }

  it("never statically imports vite", () => {
    // The specific regression. Kept as its own case so a failure names the
    // actual historical bug rather than a generic list.
    expect(source).not.toMatch(/from\s*["']vite["']/);
  });

  it("imports no devDependency at module scope", () => {
    const imported = staticImports(source);
    const offenders = imported.filter((spec) => {
      const pkgName = spec.startsWith("@")
        ? spec.split("/").slice(0, 2).join("/")
        : spec.split("/")[0];
      return devDeps.includes(pkgName);
    });

    expect(
      offenders,
      "These are devDependencies and are removed by `pnpm prune --prod`, so the " +
        "production container would crash on startup with ERR_MODULE_NOT_FOUND.",
    ).toEqual([]);
  });

  it("still imports the runtime dependencies it needs", () => {
    // Guards the parser: if the regex stopped matching anything, the check
    // above would pass trivially on an empty list.
    const imported = staticImports(source);
    expect(imported).toContain("express");
    expect(imported.length).toBeGreaterThan(5);
  });
});
