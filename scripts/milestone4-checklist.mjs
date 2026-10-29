#!/usr/bin/env node
/**
 * Milestone 4 tracker tool.
 *
 * The canonical task data is docs/milestone4/MILESTONE4_TASK_REGISTER.csv. The
 * root MILESTONE4_CHECKLIST.md is generated from it, so the totals cannot drift
 * from the tasks. Do not edit the Markdown by hand.
 *
 *   node scripts/milestone4-checklist.mjs build
 *   node scripts/milestone4-checklist.mjs check
 *   node scripts/milestone4-checklist.mjs set <ID> <STATUS> [--evidence "..."] [--files "..."]
 *                                                  [--tests "..."] [--notes "..."] [--date YYYY-MM-DD]
 *
 * `set` updates one row, stamps Last Updated, and rebuilds the checklist.
 * COMPLETED_VERIFIED needs completion evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTER = path.join(root, "docs", "milestone4", "MILESTONE4_TASK_REGISTER.csv");
const CHECKLIST = path.join(root, "MILESTONE4_CHECKLIST.md");

export const STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "IMPLEMENTED_TESTING_PENDING",
  "TESTED_LOCAL",
  "LIVE_VERIFICATION_PENDING",
  "COMPLETED_VERIFIED",
  "BLOCKED_EXTERNAL",
  "AWAITING_CLIENT_DECISION",
];
export const CLASSES = [
  "BASELINE",
  "PAID_M4_APPROVED",
  "PAID_M4_PROPOSED",
  "SCOPE_DISPUTED",
  "EXTERNAL_DEPENDENCY",
  "ALREADY_DELIVERED",
];
const SECTIONS = {
  1: "Production security and critical defects",
  2: "Authentication, MFA and permissions",
  3: "AI agents and orchestration",
  4: "AI Receptionist and IVR",
  5: "AI Scheduling",
  6: "AI Sales Outbound",
  7: "AI Scan baseline and advanced processing",
  8: "AI Scan reports and expert review",
  9: "Executive Briefing",
  10: "Notifications and email",
  11: "CRM, AI Advisor and dashboards",
  12: "Stripe, billing, quotations and invoices",
  13: "Projects, developer teams, messaging and documents",
  14: "Website, five portals and localization",
  15: "Infrastructure, staging, backup and deployment",
  16: "Integration tests, security tests, documentation and handover",
};

// ---- CSV -------------------------------------------------------------------------------------------------------------

export function parseCsv(text) {
  const src = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const head = rows.shift();
  return { head, records: rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""]))) };
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(head, records) {
  const lines = [head.map(csvCell).join(",")];
  for (const r of records) lines.push(head.map((h) => csvCell(r[h])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---- Validation and totals ---------------------------------------------------------------------------------------

export function validate(records) {
  const problems = [];
  const seen = new Set();
  for (const r of records) {
    const id = r["Task ID"];
    if (!id) problems.push("a row has no Task ID");
    if (seen.has(id)) problems.push(`duplicate Task ID ${id}`);
    seen.add(id);
    if (!STATUSES.includes(r.Status)) problems.push(`${id}: invalid status "${r.Status}"`);
    if (!CLASSES.includes(r["Commercial Classification"])) problems.push(`${id}: invalid classification "${r["Commercial Classification"]}"`);
    if (!SECTIONS[Number(r["Checklist Section"])]) problems.push(`${id}: invalid section "${r["Checklist Section"]}"`);
    if (r.Status === "COMPLETED_VERIFIED" && !r["Completion Evidence"].trim()) problems.push(`${id}: COMPLETED_VERIFIED needs completion evidence`);
  }
  return problems;
}

const count = (rows, pred) => rows.filter(pred).length;
const is = (...s) => (r) => s.includes(r.Status);
const cls = (...c) => (r) => c.includes(r["Commercial Classification"]);

export function totals(records) {
  const baseline = records.filter(cls("BASELINE", "ALREADY_DELIVERED"));
  const approved = records.filter(cls("PAID_M4_APPROVED"));
  const disputed = records.filter(cls("PAID_M4_PROPOSED", "SCOPE_DISPUTED"));
  const external = records.filter(cls("EXTERNAL_DEPENDENCY"));
  const remaining = (rows) => count(rows, (r) => !is("COMPLETED_VERIFIED", "BLOCKED_EXTERNAL", "AWAITING_CLIENT_DECISION")(r));
  return {
    all: records.length,
    verified: count(records, is("COMPLETED_VERIFIED")),
    local: count(records, is("TESTED_LOCAL", "IMPLEMENTED_TESTING_PENDING")),
    live: count(records, is("LIVE_VERIFICATION_PENDING")),
    inProgress: count(records, is("IN_PROGRESS")),
    notStarted: count(records, is("NOT_STARTED")),
    blocked: count(records, is("BLOCKED_EXTERNAL")),
    awaiting: count(records, is("AWAITING_CLIENT_DECISION")),
    baseline: { total: baseline.length, completed: count(baseline, is("COMPLETED_VERIFIED")), remaining: remaining(baseline), blocked: count(baseline, is("BLOCKED_EXTERNAL")), awaiting: count(baseline, is("AWAITING_CLIENT_DECISION")) },
    approved: { total: approved.length, completed: count(approved, is("COMPLETED_VERIFIED")), remaining: remaining(approved), blocked: count(approved, is("BLOCKED_EXTERNAL")) },
    disputed: { total: disputed.length, awaiting: count(disputed, is("AWAITING_CLIENT_DECISION")) },
    external: { total: external.length, blocked: count(external, is("BLOCKED_EXTERNAL")) },
  };
}

// ---- Markdown ----------------------------------------------------------------------------------------------------

const PRI = { P0: 0, P1: 1, P2: 2, P3: 3 };
const byPriorityThenId = (a, b) => (PRI[a.Priority] ?? 9) - (PRI[b.Priority] ?? 9) || a["Task ID"].localeCompare(b["Task ID"], "en", { numeric: true });

export function renderChecklist(records, generatedOn) {
  const t = totals(records);
  const L = [];
  L.push("# Milestone 4: Active Development Tracker", "");
  L.push(
    `Generated ${generatedOn} from \`docs/milestone4/MILESTONE4_TASK_REGISTER.csv\` by \`scripts/milestone4-checklist.mjs\`. The CSV is the canonical record; do not edit this file by hand. Record a task outcome with \`node scripts/milestone4-checklist.mjs set <ID> <STATUS> --evidence "..."\`.`,
    "",
    "This is a combined execution tracker, not a statement that every task is chargeable under Milestone 4. Baseline carry-over is kept apart from paid extensions by the commercial classification of each task. The September specification tracker (RM-120 to RM-437) is preserved unchanged at `docs/milestone4/archive/MILESTONE4_CHECKLIST_SPEC_BASELINE_2026-09.md`.",
    "",
  );
  L.push("A task is `COMPLETED_VERIFIED` only when its acceptance condition has been met with evidence. A local passing test is `TESTED_LOCAL`. Provider-dependent work stays `LIVE_VERIFICATION_PENDING` or `BLOCKED_EXTERNAL` until it has run against the real provider.", "");
  L.push("## Overall progress", "");
  L.push(`- Total unique tasks: ${t.all}`);
  L.push(`- Already verified (COMPLETED_VERIFIED): ${t.verified} of ${t.all} (${((t.verified / t.all) * 100).toFixed(1)}%)`);
  L.push(`- Locally implemented and tested (TESTED_LOCAL, IMPLEMENTED_TESTING_PENDING): ${t.local}`);
  L.push(`- Live verification pending: ${t.live}`);
  L.push(`- In progress: ${t.inProgress}`);
  L.push(`- Not started: ${t.notStarted}`);
  L.push(`- Externally blocked: ${t.blocked}`);
  L.push(`- Awaiting client decisions: ${t.awaiting}`, "");
  L.push("### Baseline carry-over progress", "");
  L.push("Tasks classified BASELINE or ALREADY_DELIVERED (no separate development charge).", "");
  L.push(`- Total baseline tasks: ${t.baseline.total}`);
  L.push(`- Completed (verified): ${t.baseline.completed}`);
  L.push(`- Remaining (not blocked): ${t.baseline.remaining}`);
  L.push(`- Blocked (external): ${t.baseline.blocked}`);
  L.push(`- Awaiting client decision: ${t.baseline.awaiting}`, "");
  L.push("### Approved paid Milestone 4 progress", "");
  L.push(`- Total approved additional tasks: ${t.approved.total}`);
  L.push(`- Completed: ${t.approved.completed}`);
  L.push(`- Remaining: ${t.approved.remaining}`);
  L.push(`- Blocked: ${t.approved.blocked}`);
  if (t.approved.total === 0) L.push("", "No task is classified PAID_M4_APPROVED: no verified written commercial approval for any extension has been located. Nothing below is started as a paid extension.");
  L.push("");
  L.push("### Proposed or disputed additional work", "");
  L.push(`- Total (PAID_M4_PROPOSED + SCOPE_DISPUTED): ${t.disputed.total}`);
  L.push(`- Awaiting approval or clarification: ${t.disputed.awaiting}`);
  L.push(`- External dependencies (client accounts, credentials, DNS, providers): ${t.external.total}, of which blocked: ${t.external.blocked}`, "");

  L.push("### Critical fixes", "");
  const fixes = records.filter((r) => r["Critical Fix ID"]).sort((a, b) => a["Critical Fix ID"].localeCompare(b["Critical Fix ID"]));
  const FIX_TITLE = {
    "P0-01": "AI permission gate",
    "P0-02": "Report ownership protection",
    "P0-03": "Document permission matrix",
    "P0-04": "Technical Operator authorization",
    "P0-05": "Admin revenue restriction",
    "P0-06": "Guest rescheduling",
  };
  for (const r of fixes) {
    L.push(`- [${r.Status === "COMPLETED_VERIFIED" ? "x" : " "}] ${r["Critical Fix ID"]}: ${FIX_TITLE[r["Critical Fix ID"]] ?? r["Task Name"]} (\`${r["Task ID"]}\`): ${r.Status}`);
  }
  L.push("", "A critical fix stays unchecked until it is COMPLETED_VERIFIED. TESTED_LOCAL means the code change and its automated tests pass on the local repository; it does not include verification against an isolated database or the live platform.", "");

  L.push("## Detailed workstream checklists", "");
  L.push("Format: checkbox, task ID, name, priority, commercial classification, status. Checked only when COMPLETED_VERIFIED. Full detail per task is in the CSV.", "");
  for (const n of Object.keys(SECTIONS).map(Number)) {
    const rows = records.filter((r) => Number(r["Checklist Section"]) === n).sort(byPriorityThenId);
    const done = count(rows, is("COMPLETED_VERIFIED"));
    L.push(`### ${n}. ${SECTIONS[n]} (${done} of ${rows.length} verified)`, "");
    for (const r of rows) {
      L.push(`- [${r.Status === "COMPLETED_VERIFIED" ? "x" : " "}] \`${r["Task ID"]}\`: ${r["Task Name"].replace(/\s+/g, " ").trim()} (${r.Priority}, ${r["Commercial Classification"]}, ${r.Status})`);
    }
    L.push("");
  }
  return L.join("\n");
}

// ---- CLI ---------------------------------------------------------------------------------------------------------------

function load() {
  return parseCsv(fs.readFileSync(REGISTER, "utf8"));
}

function build(date) {
  const { records } = load();
  const problems = validate(records);
  if (problems.length) {
    console.error("Register problems:\n - " + problems.join("\n - "));
    process.exit(1);
  }
  fs.writeFileSync(CHECKLIST, renderChecklist(records, date), "utf8");
  const t = totals(records);
  console.log(`MILESTONE4_CHECKLIST.md written: ${t.all} tasks, ${t.verified} verified, ${t.local} tested locally, ${t.live} live-pending, ${t.blocked} blocked, ${t.awaiting} awaiting decision.`);
}

function flag(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const today = flag(args, "date") ?? new Date().toISOString().slice(0, 10);
  if (cmd === "build") return build(today);
  if (cmd === "check") {
    const { records } = load();
    const problems = validate(records);
    console.log(problems.length ? "Problems:\n - " + problems.join("\n - ") : `Register OK: ${records.length} tasks.`);
    process.exit(problems.length ? 1 : 0);
  }
  if (cmd === "set") {
    const [id, status] = args;
    if (!id || !status) throw new Error("usage: set <ID> <STATUS> [--evidence ...] [--files ...] [--tests ...] [--notes ...]");
    const { head, records } = load();
    const row = records.find((r) => r["Task ID"] === id);
    if (!row) throw new Error(`no task ${id}`);
    if (!STATUSES.includes(status)) throw new Error(`invalid status ${status}; use one of ${STATUSES.join(", ")}`);
    const before = row.Status;
    row.Status = status;
    for (const [f, col] of [["evidence", "Completion Evidence"], ["files", "Implementation Files"], ["tests", "Tests Required"], ["notes", "Notes"]]) {
      const v = flag(args, f);
      if (v !== undefined) row[col] = v;
    }
    row["Last Updated"] = today;
    const problems = validate(records);
    if (problems.length) throw new Error(problems.join("; "));
    fs.writeFileSync(REGISTER, toCsv(head, records), "utf8");
    console.log(`${id}: ${before} -> ${status}`);
    return build(today);
  }
  console.error("usage: node scripts/milestone4-checklist.mjs build | check | set <ID> <STATUS> [flags]");
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
}
