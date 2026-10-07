import { launch, newContext, unlockStaging, scene, go, creds, BASE, login, shot } from "./lib.mjs";
import fs from "node:fs";

const c = creds();
const seed = JSON.parse(fs.readFileSync(process.env.EVIDENCE_CREDS.replace(/creds\.json$/, "seed-out.json"), "utf8"));
const browser = await launch();
const ctx = await newContext(browser);
await unlockStaging(ctx);
const page = await ctx.newPage();

// All public pages
for (const [id, route, title] of [
  ["pub-home", "/", "Home"],
  ["pub-intelligence", "/intelligence", "Intelligence"],
  ["pub-solutions", "/solutions", "Solutions"],
  ["pub-ai-scan", "/ai-scan", "AI Scan"],
  ["pub-custom-software", "/custom-software", "Custom Software"],
  ["pub-about", "/about", "About"],
  ["pub-contact", "/contact", "Contact"],
  ["pub-book", "/book-strategy", "Book a Discovery Call"],
  ["pub-enterprise", "/enterprise", "Enterprise"],
  ["pub-infrastructure", "/infrastructure", "Infrastructure"],
  ["pub-security", "/security", "Security"],
  ["pub-login", "/login", "Sign in"],
  ["pub-legal-privacy", "/privacy", "Privacy policy"],
  ["pub-legal-terms", "/terms", "Terms of service"],
  ["pub-legal-cookies", "/cookies", "Cookie policy"],
  ["pub-legal-ai", "/ai-disclaimer", "AI disclaimer"],
  ["pub-legal-dpa", "/dpa", "Data processing agreement"],
  ["pub-legal-trust", "/trust", "Trust centre"],
]) await scene(page, id, { role: "public", route, title });

// Form validation: contact form empty submit, invalid email
await scene(page, "val-contact-empty", { role: "public", route: "/contact", title: "Contact form refuses an empty submission", act: async (p) => {
  await p.waitForTimeout(1800);
  const btn = p.locator('form button[type="submit"]').first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true }).catch(() => {});
  await p.waitForTimeout(600);
} });
await scene(page, "val-contact-email", { role: "public", route: "/contact", title: "Contact form rejects an invalid email address", act: async (p) => {
  await p.waitForTimeout(1800);
  const email = p.locator('input[type="email"]').first();
  await email.fill("not-an-email");
  await p.locator('input[name="fullName"], input[name="name"], input[autocomplete="name"]').first().fill("Test Person").catch(() => {});
  await email.blur();
  const btn = p.locator('form button[type="submit"]').first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true }).catch(() => {});
  await p.waitForTimeout(600);
} });
// Login validation and a wrong password
await scene(page, "val-login-disabled", { role: "public", route: "/login", title: "Sign in stays disabled until the form is valid", act: async (p) => {
  await p.locator("#login-email").fill("person@example.com");
  await p.waitForTimeout(500);
} });
await scene(page, "auth-wrong-password", { role: "public", route: "/login", title: "A wrong password gives one generic message", act: async (p) => {
  await p.locator("#login-email").fill(c.client.email);
  await p.locator("#login-password").fill("Definitely-Wrong-Password-1");
  await p.waitForTimeout(1900);
  await p.locator('form button[type="submit"]').click();
  await p.waitForTimeout(2500);
} });

// Registration disabled: the login page offers no sign up
await scene(page, "auth-no-signup", { role: "public", route: "/login", title: "The sign in page has no public registration", full: true });

// Password recovery
await scene(page, "auth-forgot", { role: "public", route: "/login", title: "Password recovery entry point", act: async (p) => {
  const link = p.getByText(/forgot/i).first();
  await link.click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(800);
} });
await scene(page, "auth-reset-invalid", { role: "public", route: "/reset-password", title: "A reset link that is invalid or expired is refused", wait: 4600 });

// Unauthenticated access to protected routes
for (const [id, route, title] of [["auth-anon-admin", "/admin", "Anonymous visitor sent to sign in (admin)"], ["auth-anon-client", "/client-portal", "Anonymous visitor sent to sign in (client portal)"], ["auth-anon-dev", "/developer-workspace", "Anonymous visitor sent to sign in (developer workspace)"]]) {
  await scene(page, id, { role: "public", route, title, wait: 2200 });
}

// Activation: invalid link, valid link with a weak password, then success
await scene(page, "act-invalid", { role: "public", route: "/activate?token=this-is-not-a-real-invitation-token-123", title: "An invalid activation link gives one generic message", wait: 1500 });
if (seed.activationToken) {
  const actPage = await ctx.newPage();
  await scene(actPage, "act-form", { role: "public", route: `/activate?token=${seed.activationToken}`, title: "Activation page for a valid invitation", wait: 1500 });
  await scene(actPage, "act-weak", { role: "public", title: "A weak password is refused with a reason", act: async (p) => {
    await p.locator("#act-name").fill("Evidence Invitee (demo)");
    await p.locator("#act-pw").fill("short1");
    await p.locator("#act-pw2").fill("short1");
    await p.locator('input[type="checkbox"]').first().check();
    await p.getByRole("button", { name: /activate account/i }).click();
    await p.waitForTimeout(800);
  } });
  const strong = "Harbour-Lantern-" + Math.random().toString(36).slice(2, 8) + "7";
  fs.writeFileSync(process.env.EVIDENCE_CREDS.replace(/creds\.json$/, "invitee.json"), JSON.stringify({ email: "evidence.invitee@demo.invalid", password: strong }));
  await scene(actPage, "act-success", { role: "client", title: "Activation signs the new user in and routes them to the client portal", act: async (p) => {
    await p.locator("#act-pw").fill(strong);
    await p.locator("#act-pw2").fill(strong);
    await p.getByRole("button", { name: /activate account/i }).click();
    await p.waitForURL(/client-portal/, { timeout: 25000 });
  }, wait: 2500 });
  await actPage.close();
}
await browser.close();
