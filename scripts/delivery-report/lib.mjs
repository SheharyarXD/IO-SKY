/**
 * Shared browser helpers for the delivery report capture scripts.
 *
 * Everything drives the real deployed app through its real forms: the staging
 * gate is unlocked with its real password, sign in uses the real login form,
 * and the admin passes the real TOTP challenge. Nothing is forged.
 */
import { chromium } from "@playwright/test";
import { generateSync } from "otplib";
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.E2E_BASE_URL ?? "https://io-sky-production.up.railway.app";
export const OUT = process.env.EVIDENCE_OUT ?? path.resolve("evidence-out");
export const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

export const creds = () => JSON.parse(fs.readFileSync(process.env.EVIDENCE_CREDS, "utf8"));

export async function launch() {
  return chromium.launch({ headless: true });
}

export async function newContext(browser, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "en-GB", timezoneId: "Europe/Amsterdam", ...extra });
  // A real visitor dismisses the cookie banner first; seeding that decision keeps it from covering the evidence.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem(
        "iosky.consent.v1",
        JSON.stringify({ subjectKey: "evidence-subject", decision: "accepted-all", categories: { functional: true, analytics: true, marketing: true }, recordedAt: new Date().toISOString() }),
      );
      localStorage.setItem("iosky.consent.subject", "evidence-subject");
    } catch {}
  });
  return ctx;
}

export async function unlockStaging(ctx) {
  const pw = process.env.STAGING_PASSWORD;
  if (!pw) return;
  const res = await ctx.request.post(`${BASE}/api/staging/unlock`, { form: { password: pw }, maxRedirects: 0, failOnStatusCode: false });
  if (res.status() !== 302 && res.status() !== 200) throw new Error(`Staging gate refused the password (HTTP ${res.status()})`);
}

/** Sign in through the real form. Returns the landing URL. */
export async function login(page, email, password, totpSecret) {
  await page.goto(`${BASE}/login`);
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.waitForTimeout(1800); // the form's anti-automation mount gate; waited out, not bypassed
  await page.locator('form button[type="submit"]').click();
  if (totpSecret) {
    await page.waitForURL(/mfa-challenge/, { timeout: 20000 });
    await page.getByPlaceholder("000000").fill(generateSync({ secret: totpSecret }));
    await page.getByRole("button", { name: /verify/i }).click();
  }
  await page.waitForURL((u) => !/\/login|mfa-challenge/.test(u.pathname), { timeout: 25000 });
  return page.url();
}

let counter = 0;
/** Wait for the page to settle, then save a viewport screenshot. */
export async function shot(page, id, { full = false, wait = 900, clip } = {}) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(wait);
  const file = path.join(SHOTS, `${id}.png`);
  await page.screenshot({ path: file, fullPage: full, clip });
  counter++;
  return file;
}

export async function go(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
}

// ---- scene helper with a manifest -------------------------------------------------------------
const MANIFEST = path.join(OUT, "manifest.json");
export function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}
function record(id, meta) {
  const m = readManifest();
  m[id] = { ...meta, capturedAt: new Date().toISOString() };
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
}

/**
 * Capture one named scene. `route` is navigated first (skip with null),
 * `act` may interact with the page, and failures are logged without stopping
 * the run so a later pass can fill gaps.
 */
export async function scene(page, id, { role, route = null, title, act, full = false, wait = 900, clip } = {}) {
  try {
    if (route) await go(page, route);
    if (act) await act(page);
    await shot(page, id, { full, wait, clip });
    record(id, { role, route: route ?? "(interaction)", title, url: page.url().replace(BASE, "") });
    console.log("ok  ", id);
    return true;
  } catch (e) {
    console.log("FAIL", id, "->", String(e.message).split("\n")[0].slice(0, 140));
    return false;
  }
}

export async function tab(page, name) {
  await page.getByRole("tab", { name: new RegExp(`^${name}$`, "i") }).first().click();
  await page.waitForTimeout(700);
}
