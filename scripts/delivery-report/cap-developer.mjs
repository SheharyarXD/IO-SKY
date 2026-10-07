import { launch, newContext, unlockStaging, login, scene, creds } from "./lib.mjs";

const c = creds();
const browser = await launch();
const ctx = await newContext(browser);
await unlockStaging(ctx);
const page = await ctx.newPage();
await login(page, c.developer.email, c.developer.password);
const R = "developer";

await scene(page, "dv-overview", { role: R, route: "/developer-workspace", title: "Developer workspace after sign in", wait: 2200 });
await scene(page, "dv-projects", { role: R, route: "/developer-workspace/projects", title: "Only the projects assigned to this developer", wait: 2000 });
await scene(page, "dv-tasks", { role: R, route: "/developer-workspace/tasks", title: "Personal task list", wait: 2000 });
await scene(page, "dv-task-thread", { role: R, title: "Progress notes, clarification request and the answer on a task", act: async (p) => {
  await p.getByRole("button", { name: /notes and questions/i }).first().click();
  await p.waitForTimeout(1800);
}, wait: 800 });
await scene(page, "dv-task-ask", { role: R, title: "Asking for clarification from the task thread", act: async (p) => {
  await p.locator("select").filter({ hasText: "Progress note" }).first().selectOption("clarification_request");
  await p.locator("textarea").last().fill("Is the pick-list format fixed, or can we add a barcode column?");
  await p.waitForTimeout(500);
}, wait: 600 });
await scene(page, "dv-time", { role: R, route: "/developer-workspace/time", title: "Time registration with review status", wait: 2000 });
await scene(page, "dv-time-form", { role: R, title: "Logging time against an assigned project", act: async (p) => {
  const sel = p.locator("#t-project");
  const opt = await sel.locator("option").nth(1).getAttribute("value");
  await sel.selectOption(opt);
  await p.locator("#t-h").fill("2");
  await p.locator("#t-m").fill("30");
  await p.locator("#t-note").fill("Pick-list generation, first implementation");
  await p.getByRole("button", { name: /log time/i }).click();
  await p.waitForTimeout(2000);
}, wait: 800 });
await scene(page, "dv-time-future", { role: R, title: "A future date cannot be registered", act: async (p) => {
  const sel = p.locator("#t-project");
  const opt = await sel.locator("option").nth(1).getAttribute("value");
  await sel.selectOption(opt);
  await p.locator("#t-date").evaluate((el) => { el.removeAttribute("max"); });
  await p.locator("#t-date").fill(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
  await p.locator("#t-h").fill("1");
  await p.getByRole("button", { name: /log time/i }).click();
  await p.waitForTimeout(1500);
}, wait: 800 });
await scene(page, "dv-messages", { role: R, route: "/developer-workspace/messages", title: "Messages from the engineering desk", wait: 2000 });
await scene(page, "dv-files", { role: R, route: "/developer-workspace/files", title: "Project files", wait: 1800 });
await scene(page, "dv-submissions", { role: R, route: "/developer-workspace/submissions", title: "Deliverable submissions", wait: 1800 });
await scene(page, "dv-access-scope", { role: R, route: "/developer-workspace/access-scope", title: "Access scope and expiry", wait: 1800 });
await scene(page, "dv-agreements", { role: R, route: "/developer-workspace/agreements", title: "Signed agreements", wait: 1800 });
await scene(page, "dv-profile", { role: R, route: "/developer-workspace/profile", title: "Profile and notification preferences", wait: 2000 });
await scene(page, "dv-profile-prefs", { role: R, title: "Notification preferences with security locked on", act: async (p) => {
  await p.getByText("Notification preferences").first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
}, wait: 700 });
await scene(page, "dv-security", { role: R, route: "/developer-workspace/security", title: "Security centre", wait: 1800 });
await scene(page, "dv-support", { role: R, route: "/developer-workspace/support", title: "Support", wait: 1800 });
await scene(page, "dv-bell", { role: R, route: "/developer-workspace", title: "Notification bell with assignment and task events", act: async (p) => {
  await p.waitForTimeout(1500);
  await p.locator("button[aria-label*='otification']").first().click({ timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(900);
}, wait: 1000 });
await scene(page, "dv-forbidden-admin", { role: R, route: "/admin", title: "A developer who opens the admin address is refused", wait: 2500 });
await scene(page, "dv-forbidden-client", { role: R, route: "/client-portal", title: "A developer cannot open the client portal", wait: 2500 });
await browser.close();
