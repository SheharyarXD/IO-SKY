import { launch, newContext, unlockStaging, login, shot, go, creds, BASE } from "./lib.mjs";

const c = creds();
const browser = await launch();
for (const [role, who, totp] of [["client", c.client], ["developer", c.developer], ["admin", c.admin, c.admin.totpSecret]]) {
  const ctx = await newContext(browser);
  await unlockStaging(ctx);
  const page = await ctx.newPage();
  try {
    const url = await login(page, who.email, who.password, totp);
    console.log(role, "->", new URL(url).pathname);
    await shot(page, `smoke-${role}`);
  } catch (e) {
    console.log(role, "FAILED:", e.message.split("\n")[0]);
    await page.screenshot({ path: `${process.env.EVIDENCE_OUT}/shots/smoke-${role}-fail.png` });
  }
  await ctx.close();
}
await browser.close();
console.log("base:", BASE);
