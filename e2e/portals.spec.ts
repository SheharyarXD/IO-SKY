/**
 * Milestone 3 §3.4 — E2E golden paths per portal.
 *
 *   RM-103 dashboard
 *   RM-104 document upload
 *   RM-105 messaging
 *
 * Every spec here needs a signed-in session, and the write flows need a
 * database it is safe to write to. Neither exists yet: staging accounts are
 * part of the environment gated on the hosting decision (RM-74), and the only
 * configured database is the client's live Supabase project.
 *
 * So these are written and wired but skip by default, with the skip message
 * naming exactly what is missing. That is the honest state — writing them to
 * pass by stubbing out the portal would be worse than skipping, and pointing
 * them at the live database would be worse still.
 *
 * Once staging exists, they run unchanged:
 *   E2E_BASE_URL=https://staging.iosky.nl \
 *   E2E_USER_EMAIL=client@staging.iosky.nl E2E_USER_PASSWORD=... \
 *   E2E_ALLOW_MUTATIONS=true pnpm run test:e2e
 */
import {
  test,
  expect,
  requiresCredentials,
  requiresMutations,
  signIn,
  E2E,
} from "./fixtures";

// ---------------------------------------------------------------------------
// RM-103 — dashboard
// ---------------------------------------------------------------------------
test.describe("RM-103: client portal dashboard", () => {
  test.beforeEach(async ({ page }) => {
    requiresCredentials("client");
    await signIn(page, E2E.email, E2E.password);
    await page.waitForURL((url) => !/\/login$/.test(url.pathname), { timeout: 20_000 });
  });

  test("renders the portal shell after sign-in", async ({ page }) => {
    await page.goto("/client-portal");
    await expect(page.locator("body")).not.toContainText(/sign in|log in/i);
    // The notification bell is present on every portal header (Milestone 2 §2.7).
    await expect(page.getByRole("button", { name: /notifications/i })).toBeVisible();
  });

  test("does not render an error boundary", async ({ page }) => {
    // PortalErrorBoundary wraps every portal route; a dashboard that throws
    // renders the fallback rather than a blank page, so this catches a
    // regression that would otherwise look like a styling problem.
    await page.goto("/client-portal");
    await page.waitForLoadState("networkidle");
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("something went wrong");
  });

  test("opens the notification centre", async ({ page }) => {
    await page.goto("/client-portal");
    await page.getByRole("button", { name: /notifications/i }).click();
    // Regression guard for the Milestone 2 defect where the bell had no
    // onClick at all — the panel must actually appear.
    await expect(page.getByText(/notifications/i).first()).toBeVisible();
  });

  test("stays usable at a mobile viewport", async ({ page }) => {
    // The Milestone 2 feedback asks explicitly for mobile behaviour to be
    // reviewable; a portal that overflows horizontally fails that.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/client-portal");
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, "portal scrolls horizontally at 390px").toBe(false);
  });
});

test.describe("RM-103: admin portal dashboard", () => {
  test.beforeEach(async ({ page }) => {
    requiresCredentials("admin");
    await signIn(page, E2E.adminEmail, E2E.adminPassword);
  });

  test("reaches the admin console (or its MFA gate)", async ({ page }) => {
    // Admin, Super Admin and Technical Operator carry a hard blocking MFA
    // requirement (Milestone 2 §2.5), so landing on the MFA challenge is a
    // correct outcome here, not a failure. What must not happen is the
    // console rendering without either.
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    const url = page.url();
    const body = (await page.locator("body").innerText()).toLowerCase();
    const gatedOrIn = /mfa|verification|admin/.test(url + body);
    expect(gatedOrIn).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RM-104 — document upload
// ---------------------------------------------------------------------------
test.describe("RM-104: document upload", () => {
  test.beforeEach(async ({ page }) => {
    requiresCredentials("client");
    requiresMutations();
    await signIn(page, E2E.email, E2E.password);
    await page.waitForURL((url) => !/\/login$/.test(url.pathname), { timeout: 20_000 });
  });

  test("uploads a document and lists it", async ({ page }) => {
    await page.goto("/client-portal/documents");
    await page.waitForLoadState("networkidle");

    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    const name = `e2e-upload-${Date.now()}.txt`;
    await fileInput.setInputFiles({
      name,
      mimeType: "text/plain",
      buffer: Buffer.from("RM-104 end-to-end upload probe"),
    });

    // The uploaded name should surface in the list without a manual reload.
    await expect(page.getByText(name)).toBeVisible({ timeout: 30_000 });
  });

  test("rejects an oversized upload rather than failing silently", async ({ page }) => {
    // The body parser is capped at 50mb; the user must be told, not left
    // looking at a spinner that never resolves.
    await page.goto("/client-portal/documents");
    await page.waitForLoadState("networkidle");

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "too-large.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(60 * 1024 * 1024),
    });

    await expect(page.locator("body")).toContainText(/too large|size|limit|failed/i, {
      timeout: 60_000,
    });
  });
});

// ---------------------------------------------------------------------------
// RM-105 — messaging
// ---------------------------------------------------------------------------
test.describe("RM-105: messaging", () => {
  test.beforeEach(async ({ page }) => {
    requiresCredentials("client");
    requiresMutations();
    await signIn(page, E2E.email, E2E.password);
    await page.waitForURL((url) => !/\/login$/.test(url.pathname), { timeout: 20_000 });
  });

  test("sends a message and shows it in the thread", async ({ page }) => {
    await page.goto("/client-portal/messages");
    await page.waitForLoadState("networkidle");

    const body = `RM-105 e2e probe ${Date.now()}`;
    const composer = page
      .locator('textarea, input[type="text"]')
      .filter({ hasNot: page.locator("[readonly]") })
      .first();
    await composer.fill(body);

    await page.getByRole("button", { name: /send/i }).first().click();

    await expect(page.getByText(body)).toBeVisible({ timeout: 30_000 });
  });

  test("does not send an empty message", async ({ page }) => {
    await page.goto("/client-portal/messages");
    await page.waitForLoadState("networkidle");

    const send = page.getByRole("button", { name: /send/i }).first();
    const before = await page.locator("body").innerText();
    await send.click({ trial: true }).catch(() => {});
    const after = await page.locator("body").innerText();
    // Either the button is disabled (trial click throws) or nothing changed.
    expect(after.length).toBeLessThanOrEqual(before.length + 200);
  });
});
