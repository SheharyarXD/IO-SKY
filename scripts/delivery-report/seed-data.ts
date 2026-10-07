/**
 * Delivery report, step 2: a realistic demonstration scenario.
 *
 * Every record is created by calling the platform's own tRPC routers as the
 * demo accounts, so validation, permissions, audit rows and notifications are
 * exactly what the client's staff would produce. Records are prefixed "DEMO".
 *
 *   JWT_SECRET=<prod> EVIDENCE_CREDS=<path> npx tsx scripts/delivery-report/seed-data.ts
 */
import "dotenv/config";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { aiScans, users } from "../../drizzle/schema";
import { getDb } from "../../server/db/connection";
import { createAiScan, updateAiScanStatus } from "../../server/db/aiScans";
import { createInvitation } from "../../server/db/accounts";
import { appRouter } from "../../server/routers";
import type { TrpcContext } from "../../server/_core/context";

const credsPath = process.env.EVIDENCE_CREDS!;
const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const db = (await getDb())!;
const out: Record<string, unknown> = {};
const day = 86_400_000;

async function ctxFor(email: string): Promise<TrpcContext> {
  const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0]!;
  return {
    user: user as never,
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "delivery-report-seed", "x-forwarded-for": "203.0.113.10" }, socket: { remoteAddress: "203.0.113.10" } } as never,
    res: { clearCookie: () => {}, cookie: () => {} } as never,
  };
}
const admin = appRouter.createCaller(await ctxFor(creds.admin.email));
const client = appRouter.createCaller(await ctxFor(creds.client.email));
const developer = appRouter.createCaller(await ctxFor(creds.developer.email));

async function step<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn();
    console.log("ok  ", label);
    return r;
  } catch (e: any) {
    console.log("FAIL", label, "->", (e.message ?? String(e)).split("\n")[0].slice(0, 160));
    return undefined;
  }
}

const orgId: number = creds.orgId;
const devProfileId: number = creds.devProfileId;

// ---- client side projects, milestones, invoices, reports -----------------------------------
const p1: any = await step("project 1", () => admin.admin.createProject({ organizationId: orgId, name: "DEMO Warehouse Operations Automation", phase: "Pilot", status: "active", progress: 62, startMs: Date.now() - 60 * day, targetMs: Date.now() + 75 * day, summary: "Automating inbound scheduling and pick-list generation across two warehouses." }));
const p2: any = await step("project 2", () => admin.admin.createProject({ organizationId: orgId, name: "DEMO Customer Portal Rebuild", phase: "Planning", status: "planning", progress: 10, startMs: Date.now() + 10 * day, targetMs: Date.now() + 160 * day, summary: "A self-service portal for shippers to book slots and track consignments." }));
out.projectId = p1?.id;
out.project2Id = p2?.id;
if (p1) {
  const m: any[] = [];
  for (const [title, status, off] of [["Discovery and baseline", "completed", -40], ["Process mapping workshops", "completed", -15], ["Pilot automation in warehouse A", "in_progress", 20], ["Rollout to warehouse B", "pending", 60]] as const) {
    m.push(await step(`milestone ${title}`, () => admin.admin.createMilestone({ organizationId: orgId, projectId: p1.id, title, status, dueMs: Date.now() + off * day, body: "Created for the delivery report demonstration." })));
  }
  out.milestoneIds = m.map((x) => x?.id);
}
const inv: any[] = [];
for (const [d, amt, due] of [["DEMO Discovery phase", 120000, 14], ["DEMO Process mapping workshops", 240000, -6], ["DEMO AI Scan (Elite)", 95000, 30]] as const) {
  inv.push(await step(`invoice ${d}`, () => admin.admin.createInvoice({ organizationId: orgId, description: d, amountCents: amt, currency: "EUR", dueMs: Date.now() + due * day })));
}
out.invoiceIds = inv.map((i) => i?.id);
await step("client report", () => admin.admin.createReport({ organizationId: orgId, title: "DEMO Operational maturity baseline", score: 68, delta: 4, summary: "Baseline assessment completed ahead of the pilot.", status: "delivered" }));

// ---- CRM and sales ------------------------------------------------------------------------------
const opp1: any = await step("opportunity 1", () => admin.adminOps.createOpportunity({ title: "DEMO Meridian: warehouse automation", organizationId: orgId, valueCents: 4200000, currency: "EUR", expectedCloseDate: new Date(Date.now() + 30 * day).toISOString().slice(0, 10) }));
const opp2: any = await step("opportunity 2", () => admin.adminOps.createOpportunity({ title: "DEMO Harbour Freight: AI Scan follow-up", organizationId: orgId, valueCents: 1800000, currency: "EUR" }));
const opp3: any = await step("opportunity 3", () => admin.adminOps.createOpportunity({ title: "DEMO Northwind Retail: portal rebuild", organizationId: orgId, valueCents: 8500000, currency: "EUR" }));
const opp4: any = await step("opportunity 4 (to be won)", () => admin.adminOps.createOpportunity({ title: "DEMO Delta Foods: reporting suite", organizationId: orgId, valueCents: 3100000, currency: "EUR" }));
out.oppIds = [opp1?.id, opp2?.id, opp3?.id, opp4?.id];
if (opp1) await step("opp1 -> discovery", () => admin.adminOps.moveOpportunity({ id: opp1.id, to: "discovery" }));
if (opp1) await step("opp1 -> proposal", () => admin.adminOps.moveOpportunity({ id: opp1.id, to: "proposal" }));
if (opp3) await step("opp3 -> discovery", () => admin.adminOps.moveOpportunity({ id: opp3.id, to: "discovery" }));
if (opp3) await step("opp3 -> negotiation", () => admin.adminOps.moveOpportunity({ id: opp3.id, to: "negotiation" }));
const won: any = opp4 ? await step("opp4 -> won (creates project handover)", () => admin.adminOps.moveOpportunity({ id: opp4.id, to: "won" })) : undefined;
out.handoverProjectId = won?.handoverProjectId;
if (opp2) await step("opp2 -> lost", () => admin.adminOps.moveOpportunity({ id: opp2.id, to: "lost", lostReason: "Budget moved to next financial year." }));
const prop: any = opp1 ? await step("proposal", () => admin.adminOps.createProposal({ opportunityId: opp1.id, title: "DEMO Warehouse automation proposal v1", amountCents: 4200000, currency: "EUR", validUntil: new Date(Date.now() + 21 * day).toISOString().slice(0, 10), body: "Scope, timeline and commercial terms." })) : undefined;
if (prop) await step("proposal -> sent", () => admin.adminOps.moveProposal({ id: prop.id, to: "sent" }));
if (opp1) {
  await step("activity call", () => admin.adminOps.createActivity({ kind: "call", subject: "Intro call with the operations director", body: "Walked through the pilot scope.", opportunityId: opp1.id, organizationId: orgId }));
  await step("activity meeting", () => admin.adminOps.createActivity({ kind: "meeting", subject: "Warehouse walkthrough", organizationId: orgId, opportunityId: opp1.id }));
  await step("follow up", () => admin.adminOps.createActivity({ kind: "follow_up", subject: "Send revised timeline", opportunityId: opp1.id, organizationId: orgId, dueAt: Date.now() + 3 * day }));
}
await step("quote", () => admin.adminOps.createQuote({ title: "DEMO Pilot extension quotation", organizationId: orgId, opportunityId: opp1?.id, currency: "EUR", validUntil: new Date(Date.now() + 30 * day).toISOString().slice(0, 10), lines: [{ description: "Automation engineering, 40 days", quantity: 40, unitCents: 85000 }, { description: "Project management", quantity: 10, unitCents: 70000 }] }));
const sub: any = await step("subscription", () => admin.adminOps.createSubscription({ organizationId: orgId, plan: "DEMO Managed platform support", amountCents: 150000, currency: "EUR", billingInterval: "monthly" }));
out.subscriptionId = sub?.id;

// ---- developer delivery ---------------------------------------------------------------------------
const dp: any = await step("developer project", () => admin.admin.createDeveloperProject({ code: "DEMO-WH-1", name: "Warehouse automation pilot", brief: "Sanitised brief: build the scheduling service and pick-list generator.", track: "backend", startMs: Date.now() - 20 * day, targetMs: Date.now() + 60 * day }));
out.devProjectId = dp?.id;
if (dp) {
  await step("assign developer", () => admin.admin.assignDeveloperToProject({ projectId: dp.id, developerId: devProfileId, assignmentRole: "lead" }));
  const tasks: any[] = [];
  for (const [title, priority] of [["Design the slot scheduling API", "high"], ["Implement pick-list generation", "normal"], ["Write integration tests for the pilot", "normal"]] as const) {
    tasks.push(await step(`task ${title}`, () => admin.admin.createDeveloperTask({ projectId: dp.id, title, priority, body: "Created for the delivery report demonstration." })));
  }
  out.taskIds = tasks.map((t) => t?.id);
  for (const t of tasks) if (t) await step(`assign task ${t.id}`, () => admin.admin.assignDeveloperTask({ taskId: t.id, developerId: devProfileId }));
  if (tasks[0]) {
    await step("dev progress note", () => developer.developer.addTaskComment({ taskId: tasks[0].id, kind: "progress_note", body: "Endpoint contracts drafted. Starting the availability calculation next." }));
    await step("dev clarification", () => developer.developer.addTaskComment({ taskId: tasks[0].id, kind: "clarification_request", body: "Should dock slots be 30 or 60 minutes at warehouse B?" }));
    await step("admin answer", () => admin.adminOps.commentOnTask({ taskId: tasks[0].id, body: "Use 30 minute slots at both warehouses." }));
  }
  const d = (n: number) => new Date(Date.now() - n * day).toISOString().slice(0, 10);
  await step("time entry 1", () => developer.developer.logTime({ projectId: dp.id, workDate: d(1), minutes: 240, note: "API contract design and review" }));
  await step("time entry 2", () => developer.developer.logTime({ projectId: dp.id, workDate: d(2), minutes: 180, note: "Scheduling service skeleton" }));
  await step("time entry 3", () => developer.developer.logTime({ projectId: dp.id, workDate: d(3), minutes: 90, note: "Code review" }));
  await step("message to developer", () => admin.admin.replyToDeveloper({ developerId: devProfileId, subject: "Welcome to the pilot", body: "Thanks for joining. The sanitised brief and first tasks are in your workspace." }));
}

// ---- customer approval, documents, messages, ticket -----------------------------------------------
if (p1) await step("approval request", () => admin.adminOps.requestProjectApproval({ projectId: p1.id, title: "Approve the pilot acceptance criteria", description: "Please confirm the criteria before warehouse A goes live." }));
await step("client message", () => client.clientPortal.sendMessage({ threadKey: "general", subject: "Pilot go-live date", body: "Could we confirm the go-live date for warehouse A?" }));
await step("client ticket", () => client.clientPortal.createTicket({ subject: "Question about the invoice schedule", body: "Could you send the payment schedule for the next two phases?", category: "billing", priority: "normal" }));
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF").toString("base64");
const doc: any = await step("client document", () => client.clientPortal.uploadDocument({ name: "DEMO Master Services Agreement.pdf", category: "contract", mimeType: "application/pdf", contentBase64: pdf }));
out.documentId = doc?.id;
await step("client document 2", () => client.clientPortal.uploadDocument({ name: "DEMO Warehouse process map.pdf", category: "design", mimeType: "application/pdf", contentBase64: pdf }));

// ---- AI Scans: three reports at different points of the review workflow -------------------------------
const reportFor = (company: string, score: number) => ({
  overallScore: score,
  overallGrade: score >= 70 ? "mature" : "established",
  scoredAt: Date.now(),
  tier: "growth" as const,
  dimensions: [
    { dimension: "operationalMaturity", score: score + 4, grade: "established", rationale: `${company} runs repeatable core processes, with some documentation gaps at the handoff between inbound and dispatch.` },
    { dimension: "automationReadiness", score: score - 3, grade: "established", rationale: "Master data is mostly clean and ownership is clear, which makes scheduling and pick-list generation good first candidates." },
    { dimension: "infrastructureMaturity", score: score + 1, grade: "established", rationale: "Core systems are stable; observability and access reviews are the main areas to strengthen." },
    { dimension: "scalabilityReadiness", score: score - 6, grade: "developing", rationale: "Growth beyond the current volume would stress manual dock planning and exception handling." },
    { dimension: "aiOpportunityPotential", score: score + 6, grade: "mature", rationale: "Several high-leverage opportunities exist in demand forecasting and exception triage." },
  ],
  executiveSummary: `${company} shows a solid operational base with clear opportunities to automate planning work.\n\nThe priority is to stabilise handoffs, then automate dock scheduling and pick-list generation before adding forecasting.`,
  opportunities: [
    { id: "op-1", title: "Automate dock slot scheduling", category: "automationReadiness", impact: "high", effort: "medium", horizon: "30-90d", summary: "Replace manual slot planning with rule-based scheduling." },
    { id: "op-2", title: "Exception triage assistant", category: "aiOpportunityPotential", impact: "transformational", effort: "medium", horizon: "90-180d", summary: "Classify and route inbound exceptions automatically." },
  ],
  roadmap: [
    { horizon: "0-30d", items: ["Document the inbound to dispatch handoff", "Agree owners for master data"] },
    { horizon: "30-90d", items: ["Pilot automated dock scheduling"] },
  ],
  charts: { radar: true, bar: true, timeline: true },
  disclaimers: ["Demonstration data created for the delivery report. Indicative output, not advisory."],
});
const scans: Array<{ label: string; state: "awaiting_expert_review" | "revision_required" | "published" }> = [
  { label: "DEMO Meridian Logistics", state: "awaiting_expert_review" },
  { label: "DEMO Harbour Freight", state: "revision_required" },
  { label: "DEMO Northwind Retail", state: "published" },
];
out.scans = [];
for (const s of scans) {
  const created: any = await step(`scan ${s.label}`, async () =>
    createAiScan({ reportToken: `demo${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`.padEnd(48, "0"), tier: "growth", fullName: "Evidence Client (demo)", email: creds.client.email, company: s.label, locale: "en", responses: JSON.stringify({ answers: {}, contextNote: null }), status: "ready", reportPayload: JSON.stringify(reportFor(s.label, 66)), overallScore: 66, scoredAt: new Date(), reportStatus: "awaiting_expert_review" } as never),
  );
  if (!created) continue;
  await updateAiScanStatus(created.id, { reportStatus: "awaiting_expert_review" });
  (out.scans as any[]).push({ id: created.id, token: created.reportToken, label: s.label, target: s.state });
}
const sc = out.scans as any[];
if (sc[1]) {
  await step("scan 2 -> revision required", () => admin.adminOps.moveAiScanReport({ scanId: sc[1].id, to: "revision_required", note: "Please expand the rationale for scalability readiness and cite the dock volume figures." }));
}
if (sc[2]) {
  await step("scan 3 -> approved", () => admin.adminOps.moveAiScanReport({ scanId: sc[2].id, to: "approved", note: "Reviewed against the questionnaire answers." }));
  await step("scan 3 -> published", () => admin.adminOps.moveAiScanReport({ scanId: sc[2].id, to: "published" }));
}
if (sc[0]) await step("scan 1 reviewer", () => admin.adminOps.assignAiScanReviewer({ scanId: sc[0].id, reviewerUserId: creds.admin.id }));

// ---- governance, workflows, config, incidents --------------------------------------------------------
const agentVerdict = await step("agent registry + prompt", () => admin.adminOps.addPromptVersion({ agentKey: "ai_scan_analyst", body: "You are the IO SKY AI Scan analyst. Produce structured, accurate operational maturity reports. Stay grounded in the answers provided and never invent numerical evidence.", changeNote: "Tightened the grounding instruction.", activate: true }));
void agentVerdict;
await step("incident security", () => admin.adminOps.createIncident({ category: "security", title: "DEMO Burst of failed sign-ins from one network", description: "Detected during the evidence run.", severity: "high" }));
await step("incident operational", () => admin.adminOps.createIncident({ category: "operational", title: "DEMO Email provider key not configured", description: "No sending key is set in production yet.", severity: "medium" }));
await step("rejected setting (validation)", () => admin.admin.updateSetting({ key: "security.session_hours", value: "99" }));
await step("accepted setting", () => admin.admin.updateSetting({ key: "security.password_min_length", value: "12" }));
await step("workflow event", () => admin.admin.createWorkflowDefinition({ name: "DEMO Notify owner when an invoice is created", triggerType: "invoice_created", actionType: "notify_owner", actionConfig: "Invoice {{number}} was created for organization {{organizationId}}." }));
await step("workflow schedule", () => admin.admin.createWorkflowDefinition({ name: "DEMO Weekly audit digest", triggerType: "schedule", actionType: "audit_log", scheduleCadence: "weekly", firstRunAt: Date.now() + 2 * day }));
await step("webhook", () => admin.admin.createWebhookRegistration({ name: "DEMO Accounting webhook", url: "https://example.com/hooks/iosky", triggerType: "invoice_created" }));
await step("scheduled report", () => admin.adminOps.createScheduledReport({ name: "DEMO Weekly pipeline report", reportKind: "pipeline", cadence: "weekly", recipients: ["reports@example.com"], firstRunAt: Date.now() + 3 * day }));
await step("evaluate alerts", () => admin.adminOps.evaluateAlerts());

// ---- invitations: one to activate through the real page, one left pending ------------------------------
const inv1 = await createInvitation({ email: "evidence.invitee@demo.invalid", role: "client", organizationId: orgId, invitedByUserId: creds.admin.id });
if (inv1 && inv1 !== "user_exists") out.activationToken = inv1.token;
await step("pending invitation (through the router)", () => admin.adminOps.inviteUser({ email: "pending.person@demo.invalid", role: "developer" }));

fs.writeFileSync(credsPath.replace(/creds\.json$/, "seed-out.json"), JSON.stringify(out, null, 2));
console.log("seed complete");
process.exit(0);
