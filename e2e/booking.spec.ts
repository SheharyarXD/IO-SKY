/**
 * Milestone 3 §3.4 (RM-106) — E2E golden path: booking.
 *
 * Unlike the portal flows, booking has a genuinely public half: /book-strategy
 * renders and lists slots without any authentication. That part runs for real
 * here, unconditionally, against a live browser and server.
 *
 * Only the final submit writes a row, so only that is gated behind
 * E2E_ALLOW_MUTATIONS. A booking created by a test run against the live
 * Supabase project would be a real appointment in the client's calendar —
 * hence the gate, and hence the honeypot check below, which verifies the
 * anti-spam field exists rather than filling it.
 */
import { test, expect, requiresMutations } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Drive the public wizard from step 1 (service) to step 3 (details).
 *
 * Steps 1 and 2 each gate their Continue button behind a selection, so this
 * picks the first available option at each stage. Writes nothing — the only
 * mutation in this flow is the step-3 submit.
 */
async function goToDetailsStep(page: Page) {
  await page.goto("/book-strategy");
  await page.waitForLoadState("networkidle");

  // Step 1 — a service ("growth") is pre-selected in the initial draft, so
  // Continue is already enabled and no card click is needed.
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 — needs BOTH a date and a time; the Continue button stays disabled
  // until both are set (canAdvance checks selectedISO && selectedTime).
  //
  // Enabled day cells are the calendar buttons that are not disabled: past
  // days, weekends and days with no availability are all disabled, so
  // ":not([disabled])" is what distinguishes a bookable day.
  const day = page.locator("button.h-9.rounded-full:not([disabled])").first();
  await expect(day).toBeVisible({ timeout: 20_000 });
  await day.click();

  // Time slots render as pill buttons carrying a clock icon and an HH:MM label.
  const timeSlot = page.locator("button.h-11.rounded-full").first();
  await expect(timeSlot).toBeVisible({ timeout: 20_000 });
  await timeSlot.click();

  const continueBtn = page.getByRole("button", { name: "Continue" });
  await expect(continueBtn).toBeEnabled({ timeout: 15_000 });
  await continueBtn.click();
}

test.describe("RM-106: booking page (public)", () => {
  test("serves the booking page", async ({ page }) => {
    const response = await page.goto("/book-strategy");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("advances the wizard from service to slot to details", async ({ page }) => {
    // /book-strategy is a 4-step wizard (service → slot → details →
    // confirmation), so the contact fields do not exist on load. Walking to
    // step 3 is itself the thing worth covering: a break anywhere in the
    // first two steps makes the whole public funnel unreachable, and no unit
    // test spans the transitions.
    //
    // Nothing is written until the step-3 submit, which this test does not do.
    await goToDetailsStep(page);
    await expect(page.getByPlaceholder("Your full name")).toBeAttached();
    await expect(page.getByPlaceholder("you@company.com")).toBeAttached();

    // Asserted in the same test rather than its own: reaching step 3 costs
    // ~18s (two network-idle waits plus the slot query), and repeating that
    // walk just to check one more attribute pushed the second test past the
    // 45s timeout for no additional coverage.
    //
    // The booking endpoint is public and rate-limited; the honeypot is the
    // other half of that defence. Checked without filling it — a tripped
    // honeypot is precisely what we do not want to submit.
    await expect(page.locator('input[name="company_url"]')).toBeAttached();
  });

  test("loads slot availability without an authenticated session", async ({ page }) => {
    // listSlots is a public procedure. If it started requiring auth, the
    // whole public funnel would break for exactly the visitors it targets.
    const slotResponses: number[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/trpc") && r.url().includes("listSlots")) {
        slotResponses.push(r.status());
      }
    });

    await page.goto("/book-strategy");
    await page.waitForLoadState("networkidle");

    // Either the query ran and succeeded, or the UI fell back to its static
    // slot rendering — both are acceptable. A 401/403 is not.
    expect(slotResponses.every((s) => s < 400)).toBe(true);
  });

  test("does not scroll horizontally on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/book-strategy");
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, "booking page scrolls horizontally at 390px").toBe(false);
  });
});

test.describe("RM-106: booking submission", () => {
  test.beforeEach(() => requiresMutations());

  test("creates a booking and confirms it", async ({ page }) => {
    await page.goto("/book-strategy");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("Your full name").fill("RM-106 E2E Probe");
    await page.getByPlaceholder("you@company.com").fill(`rm106+${Date.now()}@example.com`);
    await page.getByPlaceholder("Your company").fill("E2E Test Co");

    // Pick the first offered slot, then submit.
    const slot = page.locator("button").filter({ hasText: /\d{1,2}:\d{2}/ }).first();
    if (await slot.count()) await slot.click();

    await page.getByRole("button", { name: /confirm|book|submit/i }).last().click();

    await expect(page.locator("body")).toContainText(/confirmed|thank you|booked/i, {
      timeout: 30_000,
    });
  });
});
