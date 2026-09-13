/**
 * Mobile navigation drawer, and the fixed-positioning bug underneath it.
 *
 * These assertions need a real browser and cannot be moved into the jsdom
 * suite. The defect they cover was a containing-block problem: the route
 * transition wrapper left `transform` and `will-change` applied at rest,
 * which makes an element the containing block for every `position: fixed`
 * descendant. jsdom has no layout, so it cannot observe either symptom.
 *
 * Measured before the fix, on a 375x667 viewport:
 *   - header top was -1200px after scrolling 1200px, so the "fixed" header
 *     scrolled away with the page on every screen size, desktop included;
 *   - the drawer was 9669px tall on a 667px viewport, because its `bottom-0`
 *     resolved against the ~9700px page wrapper, leaving the language
 *     buttons and both calls to action unreachable.
 *
 * Writes nothing, so these run unconditionally.
 */
import { test, expect, acceptCookieConsent } from "./fixtures";

// The drawer is the one whose aria-hidden flips to false when it opens.
const OPEN_DRAWER =
  'div[aria-hidden="false"][class*="lg:hidden"][class*="fixed"]';

test.describe("mobile navigation drawer", () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    // The consent banner is fixed to the viewport with a higher z-index than
    // the drawer, so it covers the menu until it is dismissed.
    await acceptCookieConsent(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("the header stays fixed when the page scrolls", async ({ page }) => {
    // The broadest symptom of the containing-block bug, and the one that
    // affected every visitor on every device rather than only the menu.
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(300);

    const top = await page.evaluate(
      () => document.querySelector("header")!.getBoundingClientRect().top,
    );
    expect(Math.abs(top), "the header scrolled away with the page").toBeLessThan(2);
  });

  test("the drawer fits the viewport rather than the document", async ({ page }) => {
    await page.locator('button[aria-label="Open menu"]').click();
    const drawer = page.locator(OPEN_DRAWER).first();
    await expect(drawer).toBeVisible();

    const box = await drawer.boundingBox();
    const vh = await page.evaluate(() => window.innerHeight);

    expect(box!.height).toBeLessThanOrEqual(vh);
    // Guards the specific regression: 9669px on a 667px screen.
    expect(box!.height).toBeGreaterThan(vh * 0.5);
  });

  test("both calls to action can be reached by scrolling the drawer", async ({ page }) => {
    // The user-visible complaint: "it has buttons not visible on some mobile
    // screens". Reaching them by scrolling is the pass condition, not having
    // them fit without scrolling, which ten languages make impossible on a
    // short screen.
    await page.locator('button[aria-label="Open menu"]').click();
    await expect(page.locator(OPEN_DRAWER).first()).toBeVisible();

    const cta = page.locator(`${OPEN_DRAWER} a.btn-primary`).first();
    const login = page.locator(`${OPEN_DRAWER} a.btn-secondary`).first();

    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeInViewport();
    await expect(login).toBeVisible();
  });

  test("the drawer is opaque, so the page behind does not read through it", async ({ page }) => {
    // It was 0.92 alpha over a backdrop blur, and the hero headline showed
    // straight through on the dark home page. `backdrop-filter` is also the
    // first thing a browser drops under load, so the opaque layer is what
    // has to carry this.
    await page.locator('button[aria-label="Open menu"]').click();
    await expect(page.locator(OPEN_DRAWER).first()).toBeVisible();

    const bg = await page.evaluate((sel) => {
      const backdrop = document.querySelector(`${sel} > div`) as HTMLElement;
      return getComputedStyle(backdrop).backgroundColor;
    }, OPEN_DRAWER);

    // rgb(...) rather than rgba(... , <1) is the whole assertion.
    expect(bg, `drawer backdrop is translucent: ${bg}`).toMatch(/^rgb\(\s*\d+,\s*\d+,\s*\d+\s*\)$/);
  });

  test("does not scroll horizontally with the drawer open", async ({ page }) => {
    await page.locator('button[aria-label="Open menu"]').click();
    await expect(page.locator(OPEN_DRAWER).first()).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});
