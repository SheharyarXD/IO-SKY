import { launch, newContext, unlockStaging, scene, go, creds, BASE } from "./lib.mjs";
import fs from "node:fs";

const seed = JSON.parse(fs.readFileSync(process.env.EVIDENCE_CREDS.replace(/creds\.json$/, "seed-out.json"), "utf8"));
const browser = await launch();
const ctx = await newContext(browser);
await unlockStaging(ctx);
const page = await ctx.newPage();

// Questionnaire: answer three questions, save for later, show the resume link
let resumeUrl = null;
await scene(page, "scan-q-start", { role: "public", route: "/ai-scan/start?tier=free", title: "AI Scan questionnaire, first question", wait: 1800 });
await scene(page, "scan-q-save", { role: "public", title: "Save and continue later gives a link that works for 14 days", act: async (p) => {
  for (let i = 0; i < 3; i++) {
    await p.locator('[role="radio"]').first().click();
    await p.getByRole("button", { name: /^next$/i }).click();
    await p.waitForTimeout(500);
  }
  await p.getByRole("button", { name: /save and continue later/i }).click();
  await p.waitForSelector("a[href*='resume=']", { timeout: 15000 });
  resumeUrl = await p.locator("a[href*='resume=']").first().getAttribute("href");
}, wait: 1200 });

// Resume in a brand new browser context: no local storage, only the link
if (resumeUrl) {
  const ctx2 = await newContext(browser);
  await unlockStaging(ctx2);
  const p2 = await ctx2.newPage();
  await scene(p2, "scan-q-resumed", { role: "public", route: resumeUrl.replace(BASE, ""), title: "Opening the link in a fresh browser restores the saved progress", wait: 2500 });
  await ctx2.close();
}

// Report states for a customer holding the link
const [s1, s2, s3] = seed.scans;
await scene(page, "scan-result-review", { role: "public", route: `/ai-scan/result/${s1.token}`, title: "Generated report held back: awaiting expert review", wait: 1800 });
await scene(page, "scan-result-revision", { role: "public", route: `/ai-scan/result/${s2.token}`, title: "Report sent back for revision stays hidden", wait: 1800 });
await scene(page, "scan-result-published", { role: "public", route: `/ai-scan/result/${s3.token}`, title: "Published report visible to the customer", wait: 2500 });
await scene(page, "scan-result-published-2", { role: "public", title: "Published report, dimensions and opportunities", act: async (p) => { await p.evaluate(() => window.scrollTo(0, 900)); }, wait: 1000 });
await scene(page, "scan-result-published-3", { role: "public", title: "Published report, roadmap and disclaimers", act: async (p) => { await p.evaluate(() => window.scrollTo(0, 1900)); }, wait: 1000 });
await browser.close();
