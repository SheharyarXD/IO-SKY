/**
 * Delivery report, step 2b: a few states the admin screens need to show.
 * Run after seed-data.ts and after the client has decided the first approval.
 */
import "dotenv/config";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { bookings, users } from "../../drizzle/schema";
import { getDb } from "../../server/db/connection";
import { appRouter } from "../../server/routers";
import type { TrpcContext } from "../../server/_core/context";

const credsPath = process.env.EVIDENCE_CREDS!;
const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const seed = JSON.parse(fs.readFileSync(credsPath.replace(/creds\.json$/, "seed-out.json"), "utf8"));
const db = (await getDb())!;
const day = 86_400_000;

async function ctxFor(email: string): Promise<TrpcContext> {
  const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0]!;
  return {
    user: user as never,
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "delivery-report-seed", "x-forwarded-for": "203.0.113.20" }, socket: { remoteAddress: "203.0.113.20" } } as never,
    res: { clearCookie: () => {}, cookie: () => {} } as never,
  };
}
const admin = appRouter.createCaller(await ctxFor(creds.admin.email));
const client = appRouter.createCaller(await ctxFor(creds.client.email));
const developer = appRouter.createCaller(await ctxFor(creds.developer.email));
const step = async (label: string, fn: () => Promise<unknown>) => {
  try {
    const r = await fn();
    console.log("ok  ", label);
    return r as any;
  } catch (e: any) {
    console.log("note", label, "->", (e.message ?? "").split("\n")[0].slice(0, 120));
  }
};

// A second approval request, left pending for the admin screens
await step("second approval", () => admin.adminOps.requestProjectApproval({ projectId: seed.projectId, title: "Approve the warehouse B rollout plan", description: "Rollout sequence, cut-over window and rollback plan." }));

// A Discovery Call outcome with a follow up
const booking = (await db.select().from(bookings).where(eq(bookings.status, "confirmed")).limit(1))[0];
if (booking) {
  seed.bookingId = booking.id;
  await step("call outcome", () => admin.adminOps.recordCallOutcome({ bookingId: booking.id, outcome: "needs_follow_up", notes: "Interested in the pilot; wants a revised timeline before deciding.", followUpAt: Date.now() + 4 * day }));
}

// Denied access, recorded: a client and a developer try admin-only calls
await step("client denied", () => client.adminOps.opportunities({}));
await step("developer denied", () => developer.adminOps.invitations());
await step("client denied (platform health)", () => client.adminOps.platformHealth());

// An alert that genuinely fires: lower the threshold, evaluate, restore
const rules: any[] = (await step("alert rules", () => admin.adminOps.alertRules())) ?? [];
const failed = rules.find((r) => r.key === "failed_logins_burst");
if (failed) {
  await step("threshold to 1", () => admin.adminOps.updateAlertRule({ id: failed.id, threshold: 1, windowMinutes: 1440 }));
  const res = await step("evaluate alerts", () => admin.adminOps.evaluateAlerts());
  seed.alertFired = (res ?? []).some((r: any) => r.fired);
  await step("threshold restored", () => admin.adminOps.updateAlertRule({ id: failed.id, threshold: failed.threshold, windowMinutes: failed.windowMinutes }));
}

await new Promise((r) => setTimeout(r, 1500)); // let the fire and forget audit writes land
fs.writeFileSync(credsPath.replace(/creds\.json$/, "seed-out.json"), JSON.stringify(seed, null, 2));
console.log("extra seed complete", { bookingId: seed.bookingId, alertFired: seed.alertFired });
process.exit(0);
