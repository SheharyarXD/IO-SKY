#!/usr/bin/env node
/**
 * Milestone 3 §3.4 (RM-107) — the permanent auth / RBAC / tenant-isolation
 * regression suite.
 *
 * The Milestone 1 negative-test patterns (RM-55 auth-origin RBAC parity,
 * RM-60 RLS cross-tenant denial) already existed as ordinary test files. What
 * they lacked was a guarantee that they actually *run*: several of them skip
 * cleanly when live Supabase credentials are absent, which is correct
 * behaviour but means "green" can mean "nothing was checked".
 *
 * This runner exists to close that gap. It:
 *   1. runs the named suite explicitly, so the highest-risk files are a
 *      distinct CI job rather than lines in a 600-test scroll;
 *   2. fails if the suite collects zero tests — a renamed or moved file would
 *      otherwise silently reduce coverage to nothing while CI stayed green;
 *   3. reports how many of the live-infrastructure tests were skipped, so a
 *      run that proved less than it appears to says so out loud.
 *
 * It deliberately does NOT fail merely because live tests skipped: fork PRs
 * legitimately have no secrets. Making that fatal would push people to disable
 * the job. Instead the skip count is printed and the deployed-environment
 * re-verification stays an explicit Milestone 3 exit-gate item (RM-84/RM-85).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * The suite. Ordered roughly by blast radius: identity, then authorisation,
 * then tenant isolation, then the hardening layer around them.
 */
const SUITE = [
  // --- identity / session ---
  "server/sessionRevocation.test.ts", // RM-90 logout actually revokes
  "server/auth.logout.test.ts",
  "server/auth.recordAttempt.test.ts",
  "server/localAuth.errors.test.ts",
  "server/supabaseAuth.test.ts",
  "server/oauth.redirect.test.ts",
  // --- multi-factor ---
  "server/mfa.test.ts",
  "server/mfaChallenge.test.ts",
  "server/mfaCrypto.test.ts",
  "server/mfaTotp.test.ts",
  "server/admin.mfaPosture.test.ts",
  // --- authorisation / RBAC ---
  "server/rbac.authOrigin.test.ts", // RM-55 parity across auth origins
  "server/contact-engineering-auth.test.ts",
  "client/src/_core/hooks/useRouteGuard.test.ts",
  // --- tenant isolation ---
  "server/rls.negative.test.ts", // RM-60 cross-tenant denial, live Supabase
  // --- API hardening ---
  "server/apiHardening.test.ts", // RM-86/87/88/89
  "server/inputValidationCoverage.test.ts", // RM-91/93
];

const repoRoot = path.resolve(import.meta.dirname, "..");

// A file listed here but missing means the suite silently shrank. Catch it
// before vitest turns it into a no-op glob.
const missing = SUITE.filter((f) => !fs.existsSync(path.join(repoRoot, f)));
if (missing.length > 0) {
  console.error("[RM-107] Suite files are missing — coverage has silently shrunk:");
  for (const f of missing) console.error(`  - ${f}`);
  console.error(
    "\nIf a file was intentionally renamed, update SUITE in scripts/run-security-suite.mjs.",
  );
  process.exit(1);
}

console.log(`[RM-107] Running the auth/RBAC/tenant suite — ${SUITE.length} files.\n`);

// Spawn vitest's own entrypoint with the current Node binary rather than
// going through `npx`. Using a shell on Windows to resolve `npx.cmd` triggers
// DEP0190 (unescaped, concatenated args) and would break on a repo path
// containing spaces — which this one has.
const vitestBin = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");
if (!fs.existsSync(vitestBin)) {
  console.error(
    `[RM-107] Cannot find vitest at ${vitestBin}. Run "pnpm install" first.`,
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [vitestBin, "run", "--reporter=verbose", ...SUITE],
  { cwd: repoRoot, encoding: "utf8" },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);

// Vitest summary lines look like:  "Tests  123 passed | 4 skipped (127)"
const testLine = /Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?/.exec(
  // Strip ANSI so the parse does not depend on colour support.
  output.replace(/\[[0-9;]*m/g, ""),
);

const passed = testLine ? Number(testLine[2]) : 0;
const skipped = testLine && testLine[3] ? Number(testLine[3]) : 0;

console.log("\n" + "-".repeat(64));
if (result.status !== 0) {
  console.error("[RM-107] FAILED — the auth/RBAC/tenant suite did not pass.");
  process.exit(result.status ?? 1);
}

if (passed === 0) {
  // The failure mode this runner exists for: a green run that checked nothing.
  console.error(
    "[RM-107] FAILED — the suite ran but collected zero passing tests. " +
      "A green result here would be a false assurance.",
  );
  process.exit(1);
}

console.log(`[RM-107] PASS — ${passed} security tests passed.`);
if (skipped > 0) {
  console.log(
    `[RM-107] NOTE: ${skipped} test(s) skipped — these need live Supabase\n` +
      "         credentials and did not run here. Tenant isolation is therefore\n" +
      "         NOT re-verified by this run; that remains RM-84/RM-85, which must\n" +
      "         be executed against the deployed environment before sign-off.",
  );
}
