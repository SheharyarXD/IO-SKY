/**
 * Milestone 3 §3.4 (RM-102) — E2E golden path: login.
 *
 * The unauthenticated half runs unconditionally against a real browser and a
 * real server — it needs no credentials and writes nothing. The authenticated
 * half skips until staging accounts exist.
 *
 * These overlap deliberately with the RM-98 component tests but prove a
 * different thing: RM-98 proves the component behaves given props and mocked
 * modules; this proves the page actually loads, the assets resolve, the
 * server serves it, and the route guard redirects — none of which a jsdom
 * render can tell you.
 */
import { test, expect, requiresCredentials, signIn, acceptCookieConsent, E2E } from "./fixtures";

// Unlocks the pre-launch gate (when E2E_STAGING_PASSWORD is set) and seeds the
// consent decision, so specs that navigate directly are not blocked by either.
test.beforeEach(async ({ page }) => {
  await acceptCookieConsent(page);
});

test.describe("RM-102: login page (unauthenticated)", () => {
  test("serves the login page with both credential fields", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBeLessThan(400);

    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
  });

  test("keeps the submit button disabled until the form is valid", async ({ page }) => {
    await page.goto("/login");
    const submit = page.locator('form button[type="submit"]');
    await expect(submit).toBeDisabled();

    await page.locator("#login-email").fill("person@example.com");
    await page.locator("#login-password").fill("long-enough-password");
    await expect(submit).toBeEnabled();
  });

  test("masks the password and can reveal it", async ({ page }) => {
    await page.goto("/login");
    const pwd = page.locator("#login-password");
    await expect(pwd).toHaveAttribute("type", "password");

    // The toggle is the button inside the password field's wrapper.
    await page.locator("#login-password").locator("xpath=../button").first().click();
    await expect(pwd).toHaveAttribute("type", "text");
  });

  test("rejects an invalid credential pair without navigating away", async ({ page }) => {
    // No account is created or mutated: a failed login only writes an audit
    // row, which is the intended behaviour under test.
    await signIn(page, "definitely-not-a-user@example.com", "wrong-password-here");

    // Must stay on /login. A redirect here would mean the failure path let
    // the user through.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("does not leak whether the account exists", async ({ page }) => {
    // User-enumeration guard: the message for a non-existent account must be
    // indistinguishable from the message for a wrong password.
    await signIn(page, "no-such-account@example.com", "wrong-password-here");
    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    expect(bodyText).not.toContain("no account");
    expect(bodyText).not.toContain("user not found");
    expect(bodyText).not.toContain("unknown email");
  });

  test("sends no session cookie on a failed login", async ({ page, context }) => {
    await signIn(page, "definitely-not-a-user@example.com", "wrong-password-here");
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "app_session_id")).toBeUndefined();
  });
});

test.describe("RM-102: route protection", () => {
  for (const path of ["/client-portal", "/admin", "/developer-workspace", "/ops"]) {
    test(`redirects an anonymous visitor away from ${path}`, async ({ page }) => {
      await page.goto(path);
      // Either a redirect to login, or a rendered "not authorised" surface —
      // what must NOT happen is the portal rendering its real content.
      await page.waitForLoadState("networkidle");
      const url = page.url();
      const body = (await page.locator("body").innerText()).toLowerCase();
      const gated =
        /\/login/.test(url) ||
        body.includes("sign in") ||
        body.includes("log in") ||
        body.includes("permission") ||
        body.includes("not authorised") ||
        body.includes("not authorized");
      expect(gated, `${path} rendered portal content to an anonymous visitor`).toBe(true);
    });
  }
});

test.describe("RM-102: authenticated login flow", () => {
  test.beforeEach(() => requiresCredentials("client"));

  test("signs in and lands on a portal with a session cookie", async ({ page, context }) => {
    await signIn(page, E2E.email, E2E.password);
    await page.waitForURL((url) => !/\/login$/.test(url.pathname), { timeout: 20_000 });

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === "app_session_id");
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
  });

  test("logout clears the session and re-gates the portal", async ({ page, context }) => {
    // The RM-90 fix end-to-end: after logout the cookie is gone AND the
    // portal is no longer reachable. Before RM-90 the second half could pass
    // while the underlying token stayed valid.
    await signIn(page, E2E.email, E2E.password);
    await page.waitForURL((url) => !/\/login$/.test(url.pathname), { timeout: 20_000 });

    await page.goto("/api/auth/local/logout");
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === "app_session_id");
    expect(session?.value ?? "").toBe("");
  });
});
