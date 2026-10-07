/**
 * Delivery report, step 3: evidence that is not a screenshot.
 *
 * Runs real checks against the live database and the codebase and writes the
 * output to EVIDENCE_OUT/evidence-data.json for the report builder. Everything
 * in the file is captured, not typed: the report prints it verbatim.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { NOTIFICATION_EVENTS } from "../../shared/notificationCatalogue";

const out = process.env.EVIDENCE_OUT!;
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
const data: Record<string, unknown> = { collectedAt: new Date().toISOString() };

// ---- 1. Audit immutability, tried for real inside a transaction that is rolled back ---------------
const attempts: Array<{ action: string; result: string }> = [];
async function attempt(action: string, fn: (tx: any) => Promise<void>) {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Error("__ROLLBACK__");
    });
  } catch (e: any) {
    attempts.push({ action, result: e.message === "__ROLLBACK__" ? "ALLOWED (rolled back, nothing kept)" : "REFUSED: " + e.message });
  }
}
await attempt("INSERT a row into login_audit", async (tx) => { await tx`insert into login_audit (provider, outcome, reason) values ('evidence', 'success', 'immutability check')`; });
await attempt("UPDATE a row in login_audit", async (tx) => { const [r] = await tx`insert into login_audit (provider, outcome) values ('evidence','success') returning id`; await tx`update login_audit set outcome='failed' where id=${r.id}`; });
await attempt("DELETE a row from login_audit", async (tx) => { const [r] = await tx`insert into login_audit (provider, outcome) values ('evidence','success') returning id`; await tx`delete from login_audit where id=${r.id}`; });
await attempt("UPDATE a row in config_history", async (tx) => { await tx`update config_history set outcome='applied' where id = (select min(id) from config_history)`; });
await attempt("DELETE a row from ai_executions", async (tx) => { await tx`delete from ai_executions where id = (select min(id) from ai_executions)`; });
await attempt("UPDATE a row in notification_events", async (tx) => { await tx`update notification_events set title='x' where id = (select min(id) from notification_events)`; });
await attempt("UPDATE a row in ai_scan_status_events", async (tx) => { await tx`update ai_scan_status_events set note='x' where id = (select min(id) from ai_scan_status_events)`; });
// a cascading delete from a parent row must still work
await sql.begin(async (tx) => {
  await tx`create temp table ev_parent (id int primary key)`;
  await tx`create temp table ev_child (id serial primary key, pid int references ev_parent(id) on delete cascade)`;
  await tx`create trigger audit_append_only before update or delete on ev_child for each row execute function audit_is_append_only()`;
  await tx`insert into ev_parent values (1)`;
  await tx`insert into ev_child (pid) values (1)`;
  await tx`delete from ev_parent where id = 1`;
  const [{ n }] = await tx`select count(*)::int n from ev_child`;
  attempts.push({ action: "DELETE the parent of an audited child (foreign key cascade)", result: n === 0 ? "ALLOWED: the child row was removed by the cascade" : "child remained" });
  try { await tx`savepoint s`; await tx`insert into ev_parent values (2)`; await tx`insert into ev_child (pid) values (2)`; await tx`delete from ev_child where pid = 2`; attempts.push({ action: "DELETE the audited child directly", result: "ALLOWED" }); }
  catch (e: any) { attempts.push({ action: "DELETE the audited child directly", result: "REFUSED: " + e.message }); }
  throw new Error("__ROLLBACK__");
}).catch(() => {});
data.immutability = attempts;
data.auditTriggers = (await sql`select event_object_table t from information_schema.triggers where trigger_name='audit_append_only' group by 1 order by 1`).map((r) => r.t);

// ---- 2. Row level security ---------------------------------------------------------------------------
const tables = await sql`select c.relname name, c.relrowsecurity rls, c.relforcerowsecurity forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1`;
const policies = await sql`select tablename t, count(*)::int n from pg_policies where schemaname='public' group by 1`;
const pol = new Map(policies.map((p) => [p.t, p.n]));
data.rls = { tables: tables.length, enabled: tables.filter((t) => t.rls).length, forced: tables.filter((t) => t.forced).length, policies: policies.reduce((a, p) => a + p.n, 0), list: tables.map((t) => ({ name: t.name, rls: t.rls, forced: t.forced, policies: pol.get(t.name) ?? 0 })) };

// ---- 3. Schema reference -----------------------------------------------------------------------------------
const cols = await sql`select table_name t, column_name c, data_type d, is_nullable n, column_default df from information_schema.columns where table_schema='public' order by table_name, ordinal_position`;
const idx = await sql`select tablename t, count(*)::int n from pg_indexes where schemaname='public' group by 1`;
const fks = await sql`select conrelid::regclass::text t, count(*)::int n from pg_constraint where contype='f' and connamespace='public'::regnamespace group by 1`;
const rowCounts: Record<string, number> = {};
for (const t of tables) {
  try { rowCounts[t.name] = Number((await sql.unsafe(`select count(*)::int n from "${t.name}"`))[0].n); } catch { rowCounts[t.name] = -1; }
}
const byTable: Record<string, any> = {};
for (const r of cols) (byTable[r.t] ??= { name: r.t, columns: [] }).columns.push({ name: r.c, type: r.d, nullable: r.n === "YES", default: r.df });
for (const i of idx) if (byTable[i.t]) byTable[i.t].indexes = i.n;
for (const f of fks) if (byTable[String(f.t)]) byTable[String(f.t)].foreignKeys = f.n;
for (const [k, v] of Object.entries(rowCounts)) if (byTable[k]) byTable[k].rows = v;
data.schema = Object.values(byTable);

// ---- 4. Migrations -----------------------------------------------------------------------------------------------
const migDir = path.resolve("drizzle");
data.migrations = fs.readdirSync(migDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort().map((f) => {
  const text = fs.readFileSync(path.join(migDir, f), "utf8");
  const first = text.split(/\r?\n/).filter((l) => l.startsWith("--")).slice(0, 4).map((l) => l.replace(/^--\s?/, "")).join(" ").trim();
  return { file: f, summary: first.slice(0, 260), statements: text.split("--> statement-breakpoint").filter((s) => s.trim()).length };
});

// ---- 5. Procedures -------------------------------------------------------------------------------------------------
const routerDir = path.resolve("server/routers");
const procs: any[] = [];
for (const f of fs.readdirSync(routerDir).filter((x) => x.endsWith(".ts"))) {
  const src = fs.readFileSync(path.join(routerDir, f), "utf8").replace(/\r\n/g, "\n");
  const re = /\n {2}(\w+): (\w+Procedure)\b/g;
  let m: RegExpExecArray | null;
  const starts: Array<{ name: string; proc: string; at: number }> = [];
  while ((m = re.exec(src))) starts.push({ name: m[1], proc: m[2], at: m.index });
  starts.forEach((s, i) => {
    const body = src.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : src.length);
    procs.push({ router: f.replace(".ts", ""), name: s.name, access: s.proc.replace("Procedure", ""), kind: body.includes(".mutation(") ? "mutation" : "query" });
  });
}
data.procedures = procs;

// ---- 6. Notification catalogue -----------------------------------------------------------------------------------------
data.catalogue = NOTIFICATION_EVENTS.map((e: any) => ({ id: e.id, name: e.name, family: e.family, priority: e.priority, priorityFloor: e.priorityFloor, trigger: e.trigger, emailDelivery: e.emailDelivery, deepLink: e.deepLink, deduplication: e.deduplication }));
data.emissions = await sql`select "eventId", "eventName", audience, "recipientRef", priority, title, "emailRequested", "createdAt" from notification_events order by id desc limit 40`;

// ---- 7. Live records that support specific criteria ----------------------------------------------------------------------
data.emailLog = await sql`select "messageType", transport, recipient, subject, status, "createdAt" from email_delivery_log order by id desc limit 25`;
data.auditSample = await sql`select provider, outcome, reason, "createdAt" from login_audit order by id desc limit 40`;
data.configHistory = await sql`select "settingKey", "oldValue", "newValue", outcome, reason, "createdAt" from config_history order by id desc limit 12`;
data.aiExecutions = await sql`select "agentKey", "promptVersion", action, "subjectRef", outcome, detail, "createdAt" from ai_executions order by id desc limit 15`;
data.scanEvents = await sql`select "scanId", "fromStatus", "toStatus", "actorUserId", note, "createdAt" from ai_scan_status_events order by id desc limit 20`;
data.policies = await sql`select tablename, policyname, cmd from pg_policies where schemaname='public' and tablename in ('quotes','subscriptions','project_approvals','notification_preferences','client_invoices') order by 1,2`;
data.alertRules = await sql`select key, title, metric, threshold, "windowMinutes", severity, enabled, "lastFiredAt" from alert_rules order by id`;
data.deployments = await sql`select "commitSha", environment, "nodeVersion", "startedAt" from deployments order by id desc limit 8`;
data.counts = {
  leads: Number((await sql`select count(*)::int n from leads`)[0].n),
  bookings: Number((await sql`select count(*)::int n from bookings`)[0].n),
  loginAudit: Number((await sql`select count(*)::int n from login_audit`)[0].n),
  notificationEvents: Number((await sql`select count(*)::int n from notification_events`)[0].n),
  incidents: Number((await sql`select count(*)::int n from incidents`)[0].n),
};

fs.writeFileSync(path.join(out, "evidence-data.json"), JSON.stringify(data, null, 1));
console.log("collected:", { tables: (data.schema as any[]).length, migrations: (data.migrations as any[]).length, procedures: procs.length, catalogue: (data.catalogue as any[]).length, immutability: attempts.length });
await sql.end();
