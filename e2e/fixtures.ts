/**
 * Milestone 3 §3.4 — shared E2E helpers and safety gates.
 *
 * Two gates exist here, and both are deliberate rather than defensive
 * boilerplate:
 *
 *   requiresCredentials — auth-gated flows need staging/test accounts, which
 *     do not exist yet (they are part of the staging environment still gated
 *     on the hosting decision, RM-74). Specs needing them skip with a message
 *     naming what is missing, rather than failing and looking like a defect.
 *
 *   requiresMutations — the only database currently configured is the
 *     client's live Supabase project. A booking, an uploaded document or a
 *     sent message written by a test run would be a real row in it. These
 *     specs therefore skip unless E2E_ALLOW_MUTATIONS is explicitly set,
 *     which should only ever be true against an isolated staging database.
 *
 * The effect is that `pnpm run test:e2e` is honest by default: it runs what
 * it can genuinely verify and tells you precisely what it did not.
 */
import { test as base, expect, type Page } from "@playwright/test";

export const E2E = {
  email: process.env.E2E_USER_EMAIL ?? "",
  password: process.env.E2E_USER_PASSWORD ?? "",
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? "",
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? "",
  allowMutations: process.env.E2E_ALLOW_MUTATIONS === "true",
};

export const hasClientCredentials = Boolean(E2E.email && E2E.password);
export const hasAdminCredentials = Boolean(E2E.adminEmail && E2E.adminPassword);

/** Skip a spec that needs a real signed-in session. */
export function requiresCredentials(kind: "client" | "admin" = "client") {
  const ok = kind === "admin" ? hasAdminCredentials : hasClientCredentials;
  const vars =
    kind === "admin"
      ? "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD"
      : "E2E_USER_EMAIL / E2E_USER_PASSWORD";
  base.skip(
    !ok,
    `Needs a staging ${kind} account (${vars}). Staging accounts are part of the ` +
      `environment still gated on the hosting decision (RM-74).`,
  );
}

/** Skip a spec that would write rows to whatever database is configured. */
export function requiresMutations() {
  base.skip(
    !E2E.allowMutations,
    "Skipped: this flow writes data. Set E2E_ALLOW_MUTATIONS=true only against " +
      "an isolated staging database — never the live project.",
  );
}

/**
 * Pre-accept cookie consent for the session.
 *
 * The consent banner is `fixed bottom-0 z-50` with pointer-events enabled on
 * its card. On a phone viewport it is tall enough to sit directly over primary
 * actions further down the page — it was covering the client portal's "Send
 * message" button, so the tap never reached it and the E2E click timed out
 * while the button sat there visible and enabled.
 *
 * A real user dismisses the banner before doing anything else, so seeding the
 * decision is the faithful setup rather than a workaround. It is written
 * before navigation so the banner never renders at all.
 *
 * NOTE this is also a genuine mobile finding in its own right: until consent is
 * given, the banner overlays portal content on small viewports. See the
 * Milestone 3 checklist entry for RM-105-a.
 */
export async function acceptCookieConsent(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        "iosky.consent.v1",
        JSON.stringify({
          subjectKey: "e2e-subject",
          decision: "accepted-all",
          categories: { functional: true, analytics: true, marketing: true },
          recordedAt: new Date().toISOString(),
        }),
      );
      window.localStorage.setItem("iosky.consent.subject", "e2e-subject");
    } catch {
      /* private-mode browsers throw; the banner simply stays visible */
    }
  });
}

/**
 * Sign in through the real form.
 *
 * Deliberately drives the UI rather than seeding a session cookie: the login
 * form carries a 1.5s mount gate and a honeypot, and an E2E test that bypasses
 * them stops covering the thing most likely to break.
 */
export async function signIn(page: Page, email: string, password: string) {
  await acceptCookieConsent(page);
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);

  // Wait out the anti-automation mount gate rather than defeating it.
  await page.waitForTimeout(1700);

  await page.locator('form button[type="submit"]').click();
}

export const test = base;
export { expect };
