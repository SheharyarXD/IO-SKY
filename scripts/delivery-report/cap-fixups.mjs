import { launch, newContext, unlockStaging, login, scene, tab, creds, go, BASE } from "./lib.mjs";

const c = creds();
const browser = await launch();

// Developer: open the thread on the task that actually has notes
{
  const ctx = await newContext(browser);
  await unlockStaging(ctx);
  const page = await ctx.newPage();
  await login(page, c.developer.email, c.developer.password);
  const card = (p) => p.locator("div", { has: p.getByText("Design the slot scheduling API", { exact: true }) }).last();
  await scene(page, "dv-task-thread", { role: "developer", route: "/developer-workspace/tasks", title: "Progress note, clarification request and the answer on a task", act: async (p) => {
    await p.waitForTimeout(1500);
    const title = p.getByText("Design the slot scheduling API", { exact: true });
    await title.scrollIntoViewIfNeeded();
    const wrapper = title.locator("xpath=ancestor::div[contains(@class,'grid')]//div[.//button[contains(., 'Notes and questions')]]").first();
    await p.locator("div:has(> div:has-text('Design the slot scheduling API'))").getByRole("button", { name: /notes and questions/i }).first().click({ timeout: 5000 }).catch(async () => {
      // fallback: the third task card's notes button
      await p.getByRole("button", { name: /notes and questions/i }).nth(2).click();
    });
    void wrapper; void card;
    await p.waitForTimeout(1800);
  }, wait: 900 });
  await scene(page, "dv-task-ask", { role: "developer", title: "Asking for clarification from the task thread", act: async (p) => {
    await p.locator("select").filter({ hasText: "Progress note" }).first().selectOption("clarification_request");
    await p.locator("textarea").first().fill("Is the pick-list format fixed, or can we add a barcode column?");
    await p.waitForTimeout(500);
  }, wait: 600 });
  await ctx.close();
}

// Client: opt out of a category (the checkbox is controlled, so click and wait for the save)
{
  const ctx = await newContext(browser);
  await unlockStaging(ctx);
  const page = await ctx.newPage();
  await login(page, c.client.email, c.client.password);
  await scene(page, "cl-account-prefs-off", { role: "client", route: "/client-portal/account", title: "Opting out of a category for in app delivery", act: async (p) => {
    await p.waitForTimeout(1800);
    const box = p.getByRole("checkbox", { name: /news and offers by in app/i });
    await box.scrollIntoViewIfNeeded();
    await box.click({ force: true });
    await p.waitForTimeout(1800);
  }, wait: 700 });
  await ctx.close();
}

// Admin: maintenance mode, set through the real settings form, seen by a public visitor, then switched off
{
  const ctx = await newContext(browser);
  await unlockStaging(ctx);
  const page = await ctx.newPage();
  await login(page, c.admin.email, c.admin.password, c.admin.totpSecret);
  await scene(page, "ad-maint-form", { role: "admin", route: "/admin/governance", title: "Setting maintenance mode through the validated settings form", act: async (p) => {
    await tab(p, "Configuration");
    await p.getByLabel(/^setting/i).selectOption("operations.maintenance_mode");
    await p.getByLabel(/new value/i).fill("on");
    await p.waitForTimeout(500);
  }, wait: 800 });
  await page.getByRole("button", { name: /apply change/i }).click();
  await page.waitForTimeout(1500);
  // A visitor with no session now sees the maintenance response (staging cookie not needed: the gate exempts nothing here, so use a fresh context with the staging unlock)
  const visitor = await newContext(browser);
  await unlockStaging(visitor);
  const vp = await visitor.newPage();
  await scene(vp, "ad-maint-public", { role: "public", route: "/about", title: "A visitor sees the maintenance page while it is on", wait: 1500 });
  const apiStatus = await visitor.request.get(`${BASE}/api/trpc/solutions.catalogue`, { failOnStatusCode: false }).then((r) => r.status()).catch(() => 0);
  console.log("api status during maintenance:", apiStatus);
  // The admin portal and sign in stay reachable so it can be switched off
  await scene(page, "ad-maint-admin-reachable", { role: "admin", route: "/admin/governance", title: "The admin portal stays reachable during maintenance", act: async (p) => { await tab(p, "Configuration"); }, wait: 1500 });
  await page.getByLabel(/^setting/i).selectOption("operations.maintenance_mode");
  await page.getByLabel(/new value/i).fill("off");
  await page.getByRole("button", { name: /apply change/i }).click();
  await page.waitForTimeout(1500);
  await scene(vp, "ad-maint-off", { role: "public", route: "/about", title: "After switching it off, the site is back", wait: 1800 });
  await visitor.close();
  await ctx.close();
}
await browser.close();
