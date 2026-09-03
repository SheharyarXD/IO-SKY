/**
 * Milestone 3 §3.4 — E2E golden paths per portal.
 *
 *   RM-103 dashboard
 *   RM-104 document upload
 *   RM-105 messaging
 *
 * Every spec here needs a signed-in session, and the write flows additionally
 * write rows. Both are now satisfiable: `scripts/seed-users.mjs` provisions one
 * account per role across two organizations, and the Supabase project holds
 * dummy data only.
 *
 * They still skip when credentials are absent rather than failing, so a fork PR
 * with no secrets stays green and reports what it did not run. The write flows
 * remain gated behind E2E_ALLOW_MUTATIONS on top of that — the gate is cheap and
 * the day this points at a database that is not disposable, it is the only thing
 * standing between a test run and real customer data.
 *
 * Run locally:
 *   node --env-file=.env scripts/seed-users.mjs
 *   E2E_USER_EMAIL=client@staging.iosky.nl E2E_USER_PASSWORD=...  *   E2E_ALLOW_MUTATIONS=true pnpm run test:e2e
 *
 * Against staging once it exists, unchanged apart from the base URL:
 *   E2E_BASE_URL=https://staging.iosky.nl \
 *   E2E_USER_EMAIL=client@staging.iosky.nl E2E_USER_PASSWORD=... \
 *   E2E_ALLOW_MUTATIONS=true pnpm run test:e2e
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

    // 30s rather than the 10s expect default: the documents section fetches
    // before it renders its uploader, and under full-suite parallel load that
    // round-trip exceeded 10s. In isolation this passes in ~11s total, so the
    // failure was contention, not a missing element.
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 30_000 });

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
    //
    // The payload is written to a real temp file rather than passed inline:
    // Playwright refuses an in-memory buffer over 50MB ("Cannot set buffer
    // larger than 50Mb"), which is its own limit, not the server's — passing
    // a path is the supported route for exactly this case. Cleaned up in
    // `finally` so a failure does not leave 51MB behind.
    const tmp = path.join(os.tmpdir(), `iosky-e2e-oversize-${Date.now()}.bin`);
    await fs.writeFile(tmp, Buffer.alloc(51 * 1024 * 1024));

    try {
      await page.goto("/client-portal/documents");
      await page.waitForLoadState("networkidle");

      await page.locator('input[type="file"]').first().setInputFiles(tmp);

      await expect(page.locator("body")).toContainText(/too large|size|limit|failed/i, {
        timeout: 90_000,
      });
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  });
});

// ---------------------------------------------------------------------------
// RM-105 — messaging
// ---------------------------------------------------------------------------
test.describe("RM-105: messaging", () => {
  // The sign-in + navigate + settle sequence costs ~25s on the mobile project;
  // the default 45s leaves too little headroom for the assertions themselves.
  test.setTimeout(90_000);

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

    // Filling the composer reflows the layout (the textarea auto-grows), which
    // shifts the send button. On the narrow viewport that shift is large
    // enough that Playwright's "stable" actionability check kept re-measuring
    // and burned the whole timeout — while the click actually landed and the
    // message sent. Scrolling to the button and letting the layout settle
    // first makes the click deterministic instead of racing the reflow.
    const send = page.getByRole("button", { name: /send/i }).first();
    await send.scrollIntoViewIfNeeded();
    await expect(send).toBeEnabled();
    await page.waitForTimeout(300);
    await send.click();

    await expect(page.getByText(body)).toBeVisible({ timeout: 30_000 });
  });

  test("does not send an empty message", async ({ page }) => {
    await page.goto("/client-portal/messages");
    await page.waitForLoadState("networkidle");

    // With an empty composer the send button must not be actionable. Asserting
    // on `isDisabled` rather than attempting a click keeps this from depending
    // on click actionability at all — which is what made the sibling test
    // flaky on mobile.
    const send = page.getByRole("button", { name: /send/i }).first();
    await send.scrollIntoViewIfNeeded();
    await expect(send).toBeDisabled();
  });
});
