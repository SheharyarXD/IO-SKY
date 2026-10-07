import { launch, newContext, unlockStaging, login, scene, creds } from "./lib.mjs";

const c = creds();
const browser = await launch();
const ctx = await newContext(browser);
await unlockStaging(ctx);
const page = await ctx.newPage();
await login(page, c.client.email, c.client.password);
const R = "client";

await scene(page, "cl-dashboard", { role: R, route: "/client-portal", title: "Client portal dashboard after sign in", wait: 2200 });
await scene(page, "cl-reports", { role: R, route: "/client-portal/reports", title: "Published reports", wait: 1800 });
await scene(page, "cl-ai-scans", { role: R, route: "/client-portal/ai-scans", title: "AI Scan history with the review progress card", wait: 2200 });
await scene(page, "cl-recommendations", { role: R, route: "/client-portal/recommendations", title: "Recommendations", wait: 1500 });
await scene(page, "cl-strategy-calls", { role: R, route: "/client-portal/strategy-calls", title: "Discovery Calls", wait: 1500 });
await scene(page, "cl-projects", { role: R, route: "/client-portal/projects", title: "Project progress and milestones", wait: 2000 });
await scene(page, "cl-billing", { role: R, route: "/client-portal/billing", title: "Invoices and billing", wait: 1800 });
await scene(page, "cl-documents", { role: R, route: "/client-portal/documents", title: "Document vault", wait: 2000 });
await scene(page, "cl-documents-search", { role: R, title: "Document search, scoped to this organization", act: async (p) => {
  await p.locator("#doc-search").fill("agreement");
  await p.waitForTimeout(1800);
}, wait: 800 });
await scene(page, "cl-documents-search-none", { role: R, title: "A search with no match says so", act: async (p) => {
  await p.locator("#doc-search").fill("zzzz-nothing");
  await p.waitForTimeout(1600);
}, wait: 800 });
await scene(page, "cl-messages", { role: R, route: "/client-portal/messages", title: "Secure messaging", wait: 1800 });
await scene(page, "cl-support", { role: R, route: "/client-portal/support", title: "Support tickets", wait: 1800 });
await scene(page, "cl-security", { role: R, route: "/client-portal/security", title: "Security centre", wait: 1800 });
await scene(page, "cl-account", { role: R, route: "/client-portal/account", title: "Account settings", wait: 1800 });
await scene(page, "cl-account-prefs", { role: R, title: "Notification preferences, security locked on", act: async (p) => {
  await p.getByText("Notification preferences").first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
}, wait: 800 });
await scene(page, "cl-account-prefs-off", { role: R, title: "Opting out of a category for in app delivery", act: async (p) => {
  const box = p.getByRole("checkbox", { name: /news and offers by in app/i });
  await box.uncheck();
  await p.waitForTimeout(1200);
}, wait: 800 });
await scene(page, "cl-bell", { role: R, route: "/client-portal", title: "Notification bell with recent events", act: async (p) => {
  await p.waitForTimeout(1500);
  await p.locator("button[aria-label*='otification']").first().click({ timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(900);
}, wait: 1000 });

// Approvals: pending, then decided through the real button
await scene(page, "cl-approvals-pending", { role: R, route: "/client-portal/approvals", title: "A project phase waiting for the customer's approval", wait: 1800 });
await scene(page, "cl-approvals-reject-needs-note", { role: R, title: "Requesting changes requires saying what to change", act: async (p) => {
  await p.getByRole("button", { name: /request changes/i }).first().click();
  await p.waitForTimeout(700);
}, wait: 600 });
await scene(page, "cl-approvals-decided", { role: R, title: "After the customer approves, the decision is recorded", act: async (p) => {
  await p.locator("textarea").first().fill("Criteria confirmed by operations.");
  await p.getByRole("button", { name: /^approve$/i }).first().click();
  await p.waitForTimeout(2200);
}, wait: 1200 });

// Authorization: a client cannot open the admin portal
await scene(page, "cl-forbidden-admin", { role: R, route: "/admin", title: "A client who opens the admin address is sent to their own portal", wait: 2500 });
await scene(page, "cl-forbidden-dev", { role: R, route: "/developer-workspace", title: "A client cannot open the developer workspace", wait: 2500 });
await browser.close();
