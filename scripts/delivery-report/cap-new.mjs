import { launch, newContext, unlockStaging, login, scene, tab, creds, BASE } from "./lib.mjs";

const c = creds();
const browser = await launch();

// ---- Admin: the governance additions, the lifecycle control and the integration tests ------------
{
  const ctx = await newContext(browser);
  await unlockStaging(ctx);
  const page = await ctx.newPage();
  await login(page, c.admin.email, c.admin.password, c.admin.totpSecret);
  const R = "admin";
  const sub = async (p, name) => {
    await p.locator("button, [role=tab]").filter({ hasText: new RegExp(`^${name}$`, "i") }).first().click();
    await p.waitForTimeout(1500);
  };
  await scene(page, "ad-plat-templates", { role: R, route: "/admin/governance", title: "Governance: notification templates, versioned per event, channel and language", act: async (p) => { await tab(p, "Templates, matrix and scopes"); await p.waitForTimeout(1800); }, wait: 900 });
  await scene(page, "ad-plat-matrix", { role: R, title: "Governance: document matrix with the eleven document types", act: async (p) => { await sub(p, "Document matrix"); }, wait: 900 });
  await scene(page, "ad-plat-scopes", { role: R, title: "Governance: Technical Operator scopes with expiry and revocation", act: async (p) => { await sub(p, "Operator scopes"); }, wait: 900 });
  await scene(page, "ad-plat-aiusage", { role: R, title: "Governance: AI model routing, usage and lead evaluation", act: async (p) => { await sub(p, "AI routing and usage"); }, wait: 900 });
  await scene(page, "ad-plat-integrations", { role: R, title: "Governance: connected providers and their configured state", act: async (p) => { await sub(p, "Integrations"); }, wait: 900 });
  await scene(page, "ad-plat-integrations-test", { role: R, title: "Governance: a Super Admin connection test against Stripe", act: async (p) => {
    const row = p.locator("tr", { hasText: "Stripe" }).first();
    await row.getByRole("button", { name: /test connection/i }).click();
    await p.waitForTimeout(2500);
  }, wait: 600 });
  await scene(page, "ad-delivery-lifecycle", { role: R, route: "/admin/delivery", title: "Delivery: customer project stages from Created to Archived", act: async (p) => { await tab(p, "Customer approvals"); await p.waitForTimeout(1800); }, wait: 900 });
  await ctx.close();
}

// ---- Client: invoices after a Stripe payment -------------------------------------------------------
{
  const ctx = await newContext(browser);
  await unlockStaging(ctx);
  const page = await ctx.newPage();
  await login(page, c.client.email, c.client.password);
  await scene(page, "cl-billing-paid", { role: "client", route: "/client-portal/billing", title: "Invoices after a Stripe payment: one is paid, the others are open", wait: 2200 });
  await ctx.close();
}

// ---- Public: the Stripe hosted payment page for an AI Scan, and responsive views --------------------
{
  const ctx = await newContext(browser);
  await unlockStaging(ctx);
  const r = await ctx.request.post(`${BASE}/api/trpc/aiScans.startPurchase`, { data: { json: { tier: "growth", fullName: "Evidence Viewer", email: "evidence.viewer@demo.invalid", company: "DEMO Viewer BV", locale: "en" } } });
  const url = (await r.json())?.result?.data?.json?.url;
  if (url) {
    const p = await ctx.newPage();
    await scene(p, "pub-stripe-checkout", { role: "public", title: "The Stripe payment page for an AI Scan (test mode), EUR 1,595.00 excluding VAT", act: async (pg) => { await pg.goto(url, { waitUntil: "domcontentloaded" }); await pg.waitForTimeout(9000); }, wait: 500 });
    await p.close();
  } else console.log("FAIL stripe checkout url missing");
  await ctx.close();
}
for (const [w, h, tag] of [[390, 844, "mobile"], [768, 1024, "tablet"]]) {
  const ctx = await newContext(browser, { viewport: { width: w, height: h } });
  await unlockStaging(ctx);
  const p = await ctx.newPage();
  await scene(p, `pub-home-${tag}`, { role: "public", route: "/", title: `Home at ${w} px wide (${tag})`, wait: 2000 });
  await scene(p, `pub-solutions-${tag}`, { role: "public", route: "/solutions", title: `Solutions at ${w} px wide (${tag})`, wait: 2000 });
  await scene(p, `pub-aiscan-${tag}`, { role: "public", route: "/ai-scan", title: `AI Scan at ${w} px wide (${tag})`, wait: 2000 });
  await scene(p, `pub-menu-${tag}`, { role: "public", route: "/", title: `Navigation menu open at ${w} px wide (${tag})`, act: async (pg) => {
    await pg.waitForTimeout(1500);
    await pg.locator("header button[aria-label*='enu']").first().click();
    await pg.waitForTimeout(900);
  }, wait: 500 });
  await ctx.close();
}
await browser.close();
