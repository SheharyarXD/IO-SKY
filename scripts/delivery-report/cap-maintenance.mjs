import { launch, newContext, unlockStaging, login, scene, tab, creds, BASE } from "./lib.mjs";

const c = creds();
const browser = await launch();
// Both contexts are unlocked and signed in BEFORE maintenance mode goes on, because
// the staging unlock endpoint is itself blocked while maintenance is active.
const adminCtx = await newContext(browser);
await unlockStaging(adminCtx);
const page = await adminCtx.newPage();
await login(page, c.admin.email, c.admin.password, c.admin.totpSecret);
const visitor = await newContext(browser);
await unlockStaging(visitor);
const vp = await visitor.newPage();
await vp.goto(`${BASE}/about`);

async function setMaintenance(value) {
  await page.goto(`${BASE}/admin/governance`, { waitUntil: "domcontentloaded" });
  await tab(page, "Configuration");
  await page.getByLabel(/^setting/i).selectOption("operations.maintenance_mode");
  await page.getByLabel(/new value/i).fill(value);
  await page.getByRole("button", { name: /apply change/i }).click();
  await page.waitForTimeout(1800);
}

let turnedOn = false;
try {
  await scene(page, "ad-maint-form", { role: "admin", route: "/admin/governance", title: "Setting maintenance mode through the validated settings form", act: async (p) => {
    await tab(p, "Configuration");
    await p.getByLabel(/^setting/i).selectOption("operations.maintenance_mode");
    await p.getByLabel(/new value/i).fill("on");
    await p.waitForTimeout(500);
  }, wait: 800 });
  await page.getByRole("button", { name: /apply change/i }).click();
  turnedOn = true;
  await page.waitForTimeout(2500);
  await scene(vp, "ad-maint-public", { role: "public", route: "/about", title: "A visitor sees the maintenance page while it is on", wait: 1500 });
  const health = await visitor.request.get(`${BASE}/health`, { failOnStatusCode: false }).then((r) => r.status());
  console.log("health during maintenance:", health);
  await scene(page, "ad-maint-admin-reachable", { role: "admin", route: "/admin/governance", title: "The admin portal stays reachable during maintenance", act: async (p) => { await tab(p, "Configuration"); }, wait: 1500 });
} finally {
  if (turnedOn) {
    await setMaintenance("off");
    console.log("maintenance switched off");
  }
}
await scene(vp, "ad-maint-off", { role: "public", route: "/about", title: "After switching it off, the site is back", wait: 2200 });
await browser.close();
