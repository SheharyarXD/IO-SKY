import { launch, newContext, unlockStaging, login, scene, creds } from "./lib.mjs";

const c = creds();
const browser = await launch();
const ctx = await newContext(browser);
await unlockStaging(ctx);
const page = await ctx.newPage();
await login(page, c.admin.email, c.admin.password, c.admin.totpSecret);
await scene(page, "ad-campaigns", { role: "admin", route: "/admin/campaigns", title: "Campaign attribution from real lead data", wait: 2500 });
await scene(page, "ad-overview-campaigns", { role: "admin", route: "/admin", title: "Executive overview with the live campaign attribution panel", act: async (p) => {
  await p.waitForTimeout(4000);
  // Scroll in steps so every lazily mounted panel is revealed and its queries have time to answer.
  for (const y of [500, 900, 1100]) {
    await p.evaluate((yy) => { const m = document.querySelector("main"); m?.scrollTo?.(0, yy); window.scrollTo(0, yy); }, y);
    await p.waitForTimeout(2500);
  }
  await p.waitForTimeout(6000);
}, wait: 1500 });
await browser.close();
