/**
 * Milestone 3 §3.4 (RM-109) — a test suite per converted workflow.
 *
 * Milestone 2 §2.4/§2.5 converted a set of admin surfaces from mockups into
 * real features, and each conversion landed with its own test file. The plan's
 * requirement is "coverage matching every new or converted capability" — which
 * is a statement about the *set*, not about any one file.
 *
 * So rather than adding a nineteenth near-duplicate suite, this pins the set
 * itself: every converted capability is listed here against the file that
 * covers it, and the test fails if a file disappears or is renamed without the
 * manifest being updated.
 *
 * That closes a real gap. Individual suites already fail loudly when the code
 * breaks. Nothing previously failed when a suite was *deleted* — coverage
 * would silently drop and CI would stay green, which is the same class of
 * false assurance RM-107's zero-test guard exists to prevent.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");

/**
 * Converted capability → the suite that covers it.
 *
 * Sources: Milestone 2 §2.4 (admin mockup conversion) and §2.5/§2.6
 * (enterprise Super Admin, document lifecycle, workflow engine, integration
 * registry, notification infrastructure).
 */
const WORKFLOW_COVERAGE: Record<string, string> = {
  // --- §2.4 mockup conversions ---
  "CRM / leads pipeline": "server/admin.createLead.test.ts",
  "Billing / invoice creation": "server/admin.createInvoice.test.ts",
  "Support ticketing": "server/admin.createSupportTicket.test.ts",
  "Reports & projects bridge": "server/admin.reportsProjects.test.ts",
  "Executive overview summary": "server/admin.summary.test.ts",
  "Admin action / audited buttons": "server/admin.modules.test.ts",
  "Developer access granting": "server/admin.grantDeveloperAccess.test.ts",
  "AI Scan retrigger": "server/admin.retriggerAiScan.test.ts",

  // --- §2.5 enterprise governance ---
  "Super Admin & role management": "server/admin.superAdmin.test.ts",
  "Platform configuration store": "server/admin.platformSettings.test.ts",
  "Business intelligence / analytics": "server/admin.analytics.test.ts",
  "MFA compliance posture": "server/admin.mfaPosture.test.ts",

  // --- §2.6 lifecycle / workflow / integration ---
  "Document lifecycle": "server/admin.documentLifecycle.test.ts",
  "Workflow definition engine": "server/admin.workflows.test.ts",
  "Integration & webhook registry": "server/admin.webhooks.test.ts",

  // --- core workflows ported as-is (§2.4) ---
  "Client portal": "server/clientPortal.test.ts",
  "Developer portal": "server/developer.test.ts",
  "Booking engine": "server/bookings.test.ts",
  "Booking administration": "server/bookingAdmin.test.ts",
  "Email delivery tracking": "server/emailDeliveryLogging.test.ts",
};

describe("RM-109: every converted workflow has a test suite", () => {
  it.each(Object.entries(WORKFLOW_COVERAGE))(
    "%s is covered by its suite",
    (_capability, file) => {
      expect(
        fs.existsSync(path.join(repoRoot, file)),
        `${file} is missing. If it was renamed, update WORKFLOW_COVERAGE in ` +
          `server/workflowCoverage.test.ts — do not delete the entry, or the ` +
          `capability loses its coverage guarantee silently.`,
      ).toBe(true);
    },
  );

  it("each suite actually contains assertions", () => {
    // A file that exists but has been emptied out satisfies the check above
    // while covering nothing.
    const empty: string[] = [];
    for (const [capability, file] of Object.entries(WORKFLOW_COVERAGE)) {
      const src = fs.readFileSync(path.join(repoRoot, file), "utf8");
      const assertions = (src.match(/expect\s*\(/g) ?? []).length;
      if (assertions < 3) empty.push(`${capability} (${file}): ${assertions} assertions`);
    }
    expect(empty).toEqual([]);
  });

  it("covers every admin router test file that exists", () => {
    // The reverse direction: if someone adds a new admin.*.test.ts, it should
    // be registered here too, so the manifest stays an accurate inventory
    // rather than drifting into a stale subset.
    const onDisk = fs
      .readdirSync(path.join(repoRoot, "server"))
      .filter((f) => /^admin\..*\.test\.ts$/.test(f))
      .map((f) => `server/${f}`);

    const registered = new Set(Object.values(WORKFLOW_COVERAGE));
    const unregistered = onDisk.filter((f) => !registered.has(f));

    expect(
      unregistered,
      "New admin suites found that are not in WORKFLOW_COVERAGE. Add them so " +
        "the manifest keeps reflecting what is actually covered.",
    ).toEqual([]);
  });
});
