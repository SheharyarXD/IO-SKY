import { launch, newContext, unlockStaging, login, scene, tab, creds } from "./lib.mjs";
import fs from "node:fs";

const c = creds();
const seed = JSON.parse(fs.readFileSync(process.env.EVIDENCE_CREDS.replace(/creds\.json$/, "seed-out.json"), "utf8"));
const browser = await launch();
const ctx = await newContext(browser);
await unlockStaging(ctx);
const page = await ctx.newPage();
await login(page, c.admin.email, c.admin.password, c.admin.totpSecret);
const R = "admin";
const scroll = (y) => async (p) => { await p.evaluate((yy) => (document.querySelector("main")?.scrollTo?.(0, yy), window.scrollTo(0, yy)), y); };

// Landing and overview
await scene(page, "ad-landing", { role: R, title: "Admin portal after sign in and the MFA challenge", wait: 1800 });
await scene(page, "ad-overview", { role: R, route: "/admin", title: "Executive overview, top", wait: 3500 });
await scene(page, "ad-overview-2", { role: R, title: "Executive overview, compliance, alerts and automation", act: scroll(520), wait: 1200 });
await scene(page, "ad-overview-3", { role: R, title: "Executive overview, pipeline, access and system health", act: scroll(1100), wait: 1200 });
await scene(page, "ad-bell", { role: R, route: "/admin", title: "Admin notification bell", act: async (p) => {
  await p.waitForTimeout(2500);
  await p.locator("button[aria-label*='otification']").first().click({ timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(1200);
}, wait: 800 });

// Core modules
for (const [id, route, title] of [
  ["ad-crm", "/admin/crm", "CRM and leads"],
  ["ad-clients", "/admin/clients", "Clients"],
  ["ad-ai-scans", "/admin/ai-scans", "AI Scans"],
  ["ad-reports", "/admin/reports", "Reports"],
  ["ad-projects", "/admin/projects", "Projects and ecosystems"],
  ["ad-strategy-calls", "/admin/strategy-calls", "Discovery Calls"],
  ["ad-availability", "/admin/booking-availability", "Booking availability"],
  ["ad-billing", "/admin/billing", "Billing and payments"],
  ["ad-documents", "/admin/documents", "Documents and storage"],
  ["ad-developers", "/admin/developers", "Developer management"],
  ["ad-security", "/admin/security", "Security monitoring"],
  ["ad-agents", "/admin/agents", "AI agent registry"],
  ["ad-automations", "/admin/automations", "Notifications and automations (workflows and webhooks)"],
  ["ad-analytics", "/admin/analytics", "Analytics and insights"],
  ["ad-users", "/admin/users", "Users and permissions"],
  ["ad-audit", "/admin/audit", "Audit logs"],
  ["ad-settings", "/admin/settings", "System settings"],
  ["ad-support", "/admin/support", "Support desk"],
  ["ad-my-security", "/admin/my-security", "My security (MFA)"],
]) await scene(page, id, { role: R, route, title, wait: 2200 });

// Delivery
await scene(page, "ad-delivery-assign", { role: R, route: "/admin/delivery", title: "Delivery: projects and developer assignment", wait: 2200 });
await scene(page, "ad-delivery-assign-form", { role: R, title: "Delivery: assignment and project creation forms", act: scroll(700), wait: 900 });
for (const [id, name, title] of [["ad-delivery-tasks", "Tasks", "Delivery: tasks and assignees"], ["ad-delivery-time", "Time review", "Delivery: time entries awaiting review"], ["ad-delivery-approvals", "Customer approvals", "Delivery: approvals waiting on customers"], ["ad-delivery-messages", "Message a developer", "Delivery: message a developer"]]) {
  await scene(page, id, { role: R, title, act: async (p) => { await p.evaluate(() => window.scrollTo(0, 0)); await tab(p, name); }, wait: 1500 });
}

// Sales and finance
await scene(page, "ad-sales-pipeline", { role: R, route: "/admin/sales", title: "Sales: opportunities and the pipeline", wait: 2200 });
for (const [id, name, title] of [["ad-sales-proposals", "Proposals", "Sales: proposals"], ["ad-sales-activities", "Activities & follow ups", "Sales: activities, follow ups and call outcomes"], ["ad-sales-quotes", "Quotations", "Sales: quotations"], ["ad-sales-subs", "Subscriptions", "Sales: subscriptions"], ["ad-sales-finance", "Financial summary", "Sales: financial summary, twelve month history and exports"]]) {
  await scene(page, id, { role: R, title, act: async (p) => { await tab(p, name); }, wait: 1500 });
}
await scene(page, "ad-sales-timeline", { role: R, title: "Sales: customer timeline for the demo organization", act: async (p) => {
  await tab(p, "Activities & follow ups");
  const org = p.getByLabel(/organization id/i).last();
  await org.fill(String(c.orgId));
  await p.getByRole("button", { name: /show history/i }).click();
  await p.waitForTimeout(2000);
  await p.getByText("History").first().scrollIntoViewIfNeeded();
}, wait: 1200 });

// Governance
await scene(page, "ad-gov-scanreview", { role: R, route: "/admin/governance", title: "Governance: AI Scan review queue", wait: 2400 });
await scene(page, "ad-gov-scanreview-history", { role: R, title: "Governance: status history of a report (append only)", act: async (p) => {
  await p.getByRole("button", { name: /history/i }).first().click();
  await p.waitForTimeout(1500);
}, wait: 900 });
await scene(page, "ad-gov-scanreview-all", { role: R, title: "Governance: reports in every status", act: async (p) => {
  await p.getByLabel("Filter by status").selectOption("all");
  await p.waitForTimeout(1500);
}, wait: 900 });
for (const [id, name, title] of [["ad-gov-incidents", "Incidents", "Governance: incident register"], ["ad-gov-alerts", "Alert rules", "Governance: alert rules"], ["ad-gov-ai", "AI agents", "Governance: AI agents, prompts and execution history"], ["ad-gov-config", "Configuration", "Governance: configuration change and history"], ["ad-gov-reports", "Scheduled reports", "Governance: scheduled reports"], ["ad-gov-audit", "Audit search", "Governance: audit log search and export"], ["ad-gov-health", "Platform health", "Governance: platform health, capacity and release history"], ["ad-gov-comms", "Communication history", "Governance: communication history"], ["ad-gov-compliance", "Compliance", "Governance: compliance checks"], ["ad-gov-invites", "Invitations", "Governance: invitations"]]) {
  await scene(page, id, { role: R, title, act: async (p) => { await p.evaluate(() => window.scrollTo(0, 0)); await tab(p, name); }, wait: 2000 });
}
await scene(page, "ad-gov-ai-2", { role: R, title: "Governance: agent registration and prompt version forms", act: async (p) => { await tab(p, "AI agents"); await p.evaluate(() => (document.querySelector("main")?.scrollTo?.(0, 900), window.scrollTo(0, 900))); }, wait: 1000 });
await scene(page, "ad-gov-audit-blocked", { role: R, title: "Governance: audit log filtered to denied access attempts", act: async (p) => {
  await tab(p, "Audit search");
  await p.getByLabel("Outcome").selectOption("blocked");
  await p.getByRole("button", { name: /^search$/i }).first().click();
  await p.waitForTimeout(2200);
}, wait: 1000 });
await scene(page, "ad-gov-audit-mfa", { role: R, title: "Governance: audit log filtered to MFA challenges", act: async (p) => {
  await p.getByLabel("Outcome").selectOption("mfa_required");
  await p.getByRole("button", { name: /^search$/i }).first().click();
  await p.waitForTimeout(2200);
}, wait: 1000 });
await scene(page, "ad-gov-audit-failed", { role: R, title: "Governance: audit log filtered to failed sign ins", act: async (p) => {
  await p.getByLabel("Outcome").selectOption("failed");
  await p.getByRole("button", { name: /^search$/i }).first().click();
  await p.waitForTimeout(2200);
}, wait: 1000 });
await scene(page, "ad-gov-config-rejected", { role: R, title: "Governance: a refused configuration change is recorded", act: async (p) => {
  await tab(p, "Configuration");
  await p.evaluate(() => (document.querySelector("main")?.scrollTo?.(0, 520), window.scrollTo(0, 520)));
}, wait: 1000 });
await browser.close();
