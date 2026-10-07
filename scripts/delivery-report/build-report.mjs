/**
 * Delivery report, step 4: builds the PDF.
 *
 * Inputs (all in EVIDENCE_OUT): done.json, manifest.json, shots/*.png, vitest.json,
 * evidence-data.json. Output: the path given as argv[2].
 * One section per completed SRS criterion; partial, blocked and not started items are not included.
 */
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { CRITERIA, MODULE_INTRO } from "./criteria-content.mjs";

const E = process.env.EVIDENCE_OUT;
const OUT = process.argv[2];
const read = (f) => JSON.parse(fs.readFileSync(path.join(E, f), "utf8"));
const done = read("done.json");
const manifest = read("manifest.json");
const vitest = read("vitest.json");
const ev = read("evidence-data.json");
const BASE = "https://io-sky-production.up.railway.app";

// ---- text safety: no dashes of the em or en kind, nothing outside WinAnsi ---------------------------------
const T = (s) =>
  String(s ?? "")
    .replace(/[—–−]/g, "-")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, "");

// ---- test index ---------------------------------------------------------------------------------------------------
const files = vitest.testResults.map((r) => ({
  file: r.name.replace(/\\/g, "/").replace(/.*IO Sky\//, ""),
  tests: r.assertionResults.map((a) => ({ name: a.fullName, status: a.status })),
}));
const passedOf = (fs_) => fs_.flatMap((f) => f.tests.filter((t) => t.status === "passed").map((t) => ({ file: f.file, name: t.name })));
function testsFor(keys) {
  const hit = files.filter((f) => keys.some((k) => f.file.includes(k)));
  return { hit, list: passedOf(hit) };
}
const totalPassed = passedOf(files).length;

// ---- palette -----------------------------------------------------------------------------------------------------------
const NAVY = "#0b1f3a", ACCENT = "#1d6fd1", GREY = "#5b6675", LIGHT = "#eef2f7", GREEN = "#1a7f4b", RULE = "#cfd7e2";

const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, size: "A4", margins: { top: 50, bottom: 50, left: 48, right: 48 }, info: { Title: "IO SKY Delivery Report: Completed SRS Acceptance Criteria", Author: "IO SKY Platform Engineering", Subject: "Master SRS v1.1 completed criteria with live evidence" } });
doc.pipe(fs.createWriteStream(OUT));

const toc = []; // {level, label, page}
const pageTag = new Map(); // page index -> running header label
let curTag = "";
function portrait(tag) { doc.addPage({ size: "A4", layout: "portrait", margins: { top: 50, bottom: 50, left: 48, right: 48 } }); pageTag.set(doc.bufferedPageRange().count - 1, tag ?? curTag); }
function landscape(tag) { doc.addPage({ size: "A4", layout: "landscape", margins: { top: 50, bottom: 40, left: 36, right: 36 } }); pageTag.set(doc.bufferedPageRange().count - 1, tag ?? curTag); }
const pageNo = () => doc.bufferedPageRange().count;
function addToc(level, label) { toc.push({ level, label: T(label), page: pageNo() }); }

function h1(s, color = NAVY) { doc.font("Helvetica-Bold").fontSize(20).fillColor(color).text(T(s)); doc.moveDown(0.4); }
function h2(s) { doc.moveDown(0.5).font("Helvetica-Bold").fontSize(11.5).fillColor(ACCENT).text(T(s).toUpperCase(), { characterSpacing: 0.4 }); doc.moveDown(0.15); }
function body(s, o = {}) { doc.font("Helvetica").fontSize(o.size ?? 10.5).fillColor(o.color ?? "#1c2430").text(T(s), { lineGap: 2.2, ...o }); }
function rule() { const y = doc.y + 2; doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor(RULE).lineWidth(0.7).stroke(); doc.moveDown(0.6); }
function pill(x, y, label, color) { const w = doc.font("Helvetica-Bold").fontSize(9).widthOfString(label) + 16; doc.roundedRect(x, y, w, 16, 8).fill(color); doc.fillColor("#fff").text(label, x + 8, y + 4, { lineBreak: false }); return w; }

// ---- generic table (monospace-ish small) -------------------------------------------------------------------------------
function table(cols, rows, { x = doc.page.margins.left, width = doc.page.width - doc.page.margins.left - doc.page.margins.right, size = 8, rowH = 13, maxRows = 9999 } = {}) {
  const total = cols.reduce((a, c) => a + c.w, 0);
  const scale = width / total;
  let y = doc.y;
  const drawHead = () => {
    doc.rect(x, y, width, rowH + 2).fill(NAVY);
    let cx = x;
    for (const c of cols) { doc.fillColor("#fff").font("Helvetica-Bold").fontSize(size).text(T(c.h), cx + 3, y + 3.5, { width: c.w * scale - 6, lineBreak: false, ellipsis: true }); cx += c.w * scale; }
    y += rowH + 2;
  };
  drawHead();
  let n = 0;
  for (const r of rows.slice(0, maxRows)) {
    if (y + rowH > doc.page.height - doc.page.margins.bottom) { return rows.length - n; }
    if (n % 2 === 0) doc.rect(x, y, width, rowH).fill(LIGHT);
    let cx = x;
    for (const c of cols) { doc.fillColor("#1c2430").font("Helvetica").fontSize(size).text(T(c.f(r)), cx + 3, y + 3, { width: c.w * scale - 6, lineBreak: false, ellipsis: true }); cx += c.w * scale; }
    y += rowH; n++;
  }
  doc.y = y + 6;
  doc.x = doc.page.margins.left;
  return 0;
}

// ---- cover ----------------------------------------------------------------------------------------------------------------
portrait("Cover");
doc.rect(0, 0, doc.page.width, doc.page.height).fill(NAVY);
doc.fillColor("#7fb2ff").font("Helvetica-Bold").fontSize(12).text("IO SKY PLATFORM", 56, 150, { characterSpacing: 3 });
doc.fillColor("#fff").fontSize(34).text("Delivery Report", 56, 180);
doc.fontSize(34).text("Completed SRS Acceptance Criteria", 56, 222, { width: 480 });
doc.font("Helvetica").fontSize(14).fillColor("#c8d6ee").text("Master SRS v1.1 (Release Candidate, Developer Baseline)", 56, 330, { width: 470 });
doc.fontSize(12).text(`${done.done.length} of 155 acceptance criteria shown as complete, each with a statement of how it is met and screenshots captured from the live deployed application.`, 56, 372, { width: 470, lineGap: 3 });
doc.fontSize(11).fillColor("#9fb4d8").text(`Live application: ${BASE}`, 56, 470);
doc.text(`Evidence captured: ${manifest["pub-home"].capturedAt.slice(0, 10)}   |   Report generated: ${new Date().toISOString().slice(0, 10)}`, 56, 488);
doc.text("All data shown in the screenshots is dummy data created for this verification.", 56, 506);
doc.fontSize(10).fillColor("#7f94b8").text("Prepared by the IO SKY engineering team for client review.", 56, 760);

// ---- reserved table of contents -----------------------------------------------------------------------------------
const TOC_PAGES = 8;
const tocStart = pageNo();
for (let i = 0; i < TOC_PAGES; i++) portrait("Contents");

// ---- front matter -----------------------------------------------------------------------------------------------------
portrait("About this report");
addToc(0, "About this report");
h1("About this report");
body("This document lists the acceptance criteria of the Master SRS v1.1 that the IO SKY platform meets today. For each criterion it states which SRS requirement is covered, how the platform meets it, where in the live application it can be seen, and shows the evidence.");
h2("What counts as a criterion");
body("The SRS states 155 acceptance criteria across 20 modules (sections 7.13 to 26.18). The SRS does not number them, so they are referenced here as SRS-MM.N, where MM is the module and N is the position in that module's acceptance list. This is the same convention used in the SRS checklist that accompanies the platform.");
h2("What is included");
body(`Only criteria that are complete are included: ${done.done.length} of 155. Criteria that are partial, that wait for a client decision or credential, or that are not started are deliberately left out of this report. They are tracked separately in the SRS checklist.`);
h2("Kinds of evidence");
body("1. Live screenshots. Every screenshot was taken from the deployed application in a real browser session after a real sign in, including the real time based one time code for the administrator. Nothing is mocked or composited. The role used and the page address are printed under each image.\n2. Automated tests. Test names are taken verbatim from the project's test run. At the time of capture the run contained " + vitest.numTotalTests + " tests, " + totalPassed + " passed, " + vitest.numFailedTests + " failed, and the remainder are skipped tests that are not used as evidence here.\n3. Database evidence. Where a screenshot cannot show the property (for example that an audit table refuses changes), the result of a real query or statement run against the live database is printed.");
h2("About the data");
body("All records visible in the screenshots are dummy data. Demo accounts were created only for the capture and are retired afterwards. Customer names, invoices, scans and messages are fictional.");
h2("How to read a criterion section");
body("Each section starts with a page that gives the requirement, its status, how it is met, where to see it and the matching automated tests. Landscape pages follow with the screenshots. For every screenshot a full page view is given first. Where useful, an enlarged detail view of the upper left of the content area follows for legibility.");
h2("Reading order");
body("Module sections follow SRS order. At the end are appendices: traceability matrix, full list of passing tests, database schema, procedure inventory, notification catalogue, migration list, live database verification and an index of every screenshot.");

portrait("Summary");
addToc(0, "Summary by module");
h1("Summary by module");
body("Completed criteria per module. The rest of each module is tracked in the SRS checklist and is out of scope of this report.");
doc.moveDown(0.5);
table([{ h: "Module", w: 34, f: (m) => String(m.n) }, { h: "Title", w: 240, f: (m) => m.title }, { h: "SRS section", w: 60, f: (m) => m.sec }, { h: "Criteria", w: 40, f: (m) => String(m.total) }, { h: "Shown here", w: 50, f: (m) => String(m.done) }], done.mods.filter((m) => m.done > 0), { size: 9, rowH: 17 });
const sumDone = done.mods.reduce((a, m) => a + m.done, 0);
body(`Total shown in this report: ${sumDone} of ${done.mods.reduce((a, m) => a + m.total, 0)} criteria.`, { size: 10 });

// ---- criteria sections ------------------------------------------------------------------------------------------------
let figNo = 0;
const shotsUsed = new Set();
const zoomed = new Set();
const traceRows = [];
const SHOT_DIR = path.join(E, "shots");

function figurePage(crit, k, id, extraNote, mode) {
  const m = manifest[id];
  const file = path.join(SHOT_DIR, id + ".png");
  if (!m || !fs.existsSync(file)) return false;
  landscape(`${crit.id}`);
  figNo++;
  const L = doc.page.margins.left, W = doc.page.width - 72;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(T(`Figure ${figNo}  |  ${crit.id}  |  ${m.title}`), L, 36, { width: W, lineBreak: false, ellipsis: true });
  doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text(T(`Live app, role: ${m.role}, page: ${m.url && m.url !== "" ? m.url : m.route}, captured ${m.capturedAt.replace("T", " ").slice(0, 16)} UTC${mode === "zoom" ? "  |  enlarged detail view" : ""}`), L, 50, { width: W, lineBreak: false, ellipsis: true });
  const top = 66, availH = doc.page.height - top - 56;
  if (mode === "zoom") {
    const pub = m.role === "public";
    const cx = pub ? 180 : 220, cy = pub ? 60 : 50, cw = pub ? 1080 : 780, ch = pub ? 675 : 480;
    const sc = Math.min(W / cw, availH / ch);
    const dw = cw * sc, dh = ch * sc, x0 = L + (W - dw) / 2;
    doc.save(); doc.rect(x0, top, dw, dh).clip(); doc.image(file, x0 - cx * sc, top - cy * sc, { width: 1440 * sc }); doc.restore();
    doc.rect(x0, top, dw, dh).lineWidth(0.8).stroke(RULE);
    doc.y = top + dh + 6;
  } else {
    const sc = Math.min(W / 1440, availH / 900);
    const dw = 1440 * sc, dh = 900 * sc, x0 = L + (W - dw) / 2;
    doc.image(file, x0, top, { width: dw });
    doc.rect(x0, top, dw, dh).lineWidth(0.8).stroke(RULE);
    doc.y = top + dh + 6;
  }
  doc.font("Helvetica").fontSize(9).fillColor("#1c2430").text(T(extraNote), L, doc.y, { width: W, height: 34, ellipsis: true });
  return true;
}

function evidencePage(crit, key) {
  landscape(crit.id);
  const L = doc.page.margins.left, W = doc.page.width - 72;
  const titles = {
    counts: "Record counts in the live database", emissions: "Latest notification emissions (append only event log)", auditSample: "Latest sign in audit rows", scanEvents: "Latest AI Scan status transitions (append only)", immutability: "Immutability attempts run against the live database", policies: "Row level security policies on client facing tables", aiExecutions: "Latest AI executions (append only)", alertRules: "Configured alert rules", configHistory: "Latest configuration changes and refusals", emailLog: "Latest email delivery log rows", rls: "Row level security status of every public table", catalogue: "Notification event catalogue (first rows)", deployments: "Recorded releases", auditTriggers: "Tables protected by the append only trigger",
  };
  figNo++;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(T(`Figure ${figNo}  |  ${crit.id}  |  ${titles[key] ?? key}`), L, 36, { width: W, lineBreak: false, ellipsis: true });
  doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text(`Captured from the live database on ${ev.collectedAt.replace("T", " ").slice(0, 16)} UTC. Printed as returned.`, L, 50, { width: W, lineBreak: false });
  doc.y = 70;
  const d = ev[key];
  const iso = (v) => (v ? String(v).replace("T", " ").slice(0, 19) : "");
  if (key === "counts") {
    table([{ h: "Table", w: 200, f: (r) => r[0] }, { h: "Rows", w: 100, f: (r) => String(r[1]) }], Object.entries(d), { size: 10, rowH: 18 });
  } else if (key === "immutability") {
    table([{ h: "Statement tried", w: 260, f: (r) => r.action }, { h: "Result from the database", w: 460, f: (r) => r.result }], d, { size: 8.5, rowH: 16 });
    body("Each statement ran inside a transaction that was rolled back, so nothing was changed or kept. An INSERT is allowed because audit tables are append only. UPDATE and DELETE are refused by a database trigger, not by application code, so they are refused even for a direct database connection. A cascading delete from a parent record is still allowed so that data subject erasure remains possible.", { size: 9 });
  } else if (key === "auditTriggers") {
    table([{ h: "Table with the append only trigger", w: 300, f: (r) => r }], d.map((x) => x), { size: 9, rowH: 14, maxRows: 30 });
  } else if (key === "rls") {
    body(`Public tables: ${d.tables}. Row level security enabled: ${d.enabled}. Forced: ${d.forced}. Policies: ${d.policies}.`, { size: 10 });
    doc.moveDown(0.3);
    table([{ h: "Table", w: 220, f: (r) => r.name }, { h: "RLS enabled", w: 80, f: (r) => (r.rls ? "yes" : "NO") }, { h: "Forced", w: 70, f: (r) => (r.forced ? "yes" : "no") }, { h: "Policies", w: 70, f: (r) => String(r.policies) }], d.list, { size: 8, rowH: 11.5, maxRows: 32 });
  } else if (key === "policies") {
    table([{ h: "Table", w: 150, f: (r) => r.tablename }, { h: "Policy", w: 330, f: (r) => r.policyname }, { h: "Command", w: 70, f: (r) => r.cmd }], d, { size: 8.5, rowH: 14, maxRows: 30 });
  } else if (key === "emissions") {
    table([{ h: "When (UTC)", w: 100, f: (r) => iso(r.createdAt) }, { h: "Event", w: 190, f: (r) => r.eventName }, { h: "Audience", w: 60, f: (r) => r.audience }, { h: "Priority", w: 60, f: (r) => r.priority }, { h: "Email", w: 40, f: (r) => (r.emailRequested ? "yes" : "no") }, { h: "Title", w: 260, f: (r) => r.title }], d, { size: 7.5, rowH: 12.5, maxRows: 30 });
  } else if (key === "auditSample") {
    table([{ h: "When (UTC)", w: 110, f: (r) => iso(r.createdAt) }, { h: "Provider", w: 90, f: (r) => r.provider }, { h: "Outcome", w: 100, f: (r) => r.outcome }, { h: "Reason", w: 340, f: (r) => r.reason ?? "" }], d, { size: 7.5, rowH: 12.5, maxRows: 30 });
  } else if (key === "scanEvents") {
    table([{ h: "When (UTC)", w: 110, f: (r) => iso(r.createdAt) }, { h: "Scan", w: 40, f: (r) => String(r.scanId) }, { h: "From", w: 110, f: (r) => r.fromStatus ?? "(new)" }, { h: "To", w: 110, f: (r) => r.toStatus }, { h: "Actor", w: 40, f: (r) => String(r.actorUserId ?? "") }, { h: "Note", w: 300, f: (r) => r.note ?? "" }], d, { size: 7.5, rowH: 12.5, maxRows: 30 });
  } else if (key === "aiExecutions") {
    table([{ h: "When (UTC)", w: 105, f: (r) => iso(r.createdAt) }, { h: "Agent", w: 110, f: (r) => r.agentKey }, { h: "Prompt version", w: 70, f: (r) => String(r.promptVersion ?? "") }, { h: "Action", w: 110, f: (r) => r.action }, { h: "Outcome", w: 70, f: (r) => r.outcome }, { h: "Detail", w: 260, f: (r) => (typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail ?? "")) }], d, { size: 7.5, rowH: 12.5, maxRows: 30 });
  } else if (key === "alertRules") {
    table([{ h: "Key", w: 140, f: (r) => r.key }, { h: "Title", w: 200, f: (r) => r.title }, { h: "Metric", w: 110, f: (r) => r.metric }, { h: "Threshold", w: 50, f: (r) => String(r.threshold) }, { h: "Window min", w: 55, f: (r) => String(r.windowMinutes) }, { h: "Severity", w: 55, f: (r) => r.severity }, { h: "On", w: 30, f: (r) => (r.enabled ? "yes" : "no") }], d, { size: 7.5, rowH: 12.5, maxRows: 30 });
  } else if (key === "configHistory") {
    table([{ h: "When (UTC)", w: 110, f: (r) => iso(r.createdAt) }, { h: "Setting", w: 170, f: (r) => r.settingKey }, { h: "Old", w: 60, f: (r) => String(r.oldValue ?? "") }, { h: "New", w: 60, f: (r) => String(r.newValue ?? "") }, { h: "Outcome", w: 60, f: (r) => r.outcome }, { h: "Reason", w: 260, f: (r) => r.reason ?? "" }], d, { size: 7.5, rowH: 12.5, maxRows: 30 });
  } else if (key === "emailLog") {
    table([{ h: "When (UTC)", w: 105, f: (r) => iso(r.createdAt) }, { h: "Type", w: 130, f: (r) => r.messageType }, { h: "Transport", w: 60, f: (r) => r.transport }, { h: "Status", w: 60, f: (r) => r.status }, { h: "Subject", w: 280, f: (r) => r.subject }], d, { size: 7.5, rowH: 12.5, maxRows: 30 });
  } else if (key === "catalogue") {
    table([{ h: "Id", w: 40, f: (r) => String(r.id) }, { h: "Event", w: 190, f: (r) => r.name }, { h: "Family", w: 90, f: (r) => r.family }, { h: "Priority", w: 60, f: (r) => String(r.priority) }, { h: "Floor", w: 50, f: (r) => String(r.priorityFloor ?? "") }, { h: "Email", w: 60, f: (r) => String(r.emailDelivery) }], d, { size: 7.5, rowH: 12.5, maxRows: 30 });
  } else if (key === "deployments") {
    table([{ h: "Commit", w: 150, f: (r) => r.commitSha }, { h: "Environment", w: 100, f: (r) => r.environment }, { h: "Node", w: 70, f: (r) => r.nodeVersion }, { h: "Started (UTC)", w: 140, f: (r) => iso(r.startedAt) }], d, { size: 9, rowH: 15 });
  }
}

const critByMod = new Map();
for (const c of done.done) { if (!critByMod.has(c.module)) critByMod.set(c.module, []); critByMod.get(c.module).push(c); }

for (const mod of done.mods) {
  const list = critByMod.get(mod.n) ?? [];
  if (!list.length) continue;
  curTag = `Module ${mod.n}: ${mod.title}`;
  portrait(curTag);
  addToc(0, `Module ${mod.n}: ${mod.title}`);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(ACCENT).text(`MODULE ${mod.n}  |  SRS SECTION ${mod.sec}`, { characterSpacing: 1 });
  doc.moveDown(0.3);
  h1(mod.title);
  body(MODULE_INTRO[mod.n] ?? "");
  doc.moveDown(0.6);
  h2("Criteria shown for this module");
  table([{ h: "Id", w: 60, f: (c) => c.id }, { h: "Acceptance criterion", w: 330, f: (c) => c.text }, { h: "Status", w: 50, f: () => "Complete" }], list, { size: 9, rowH: 16 });
  body(`${mod.done} of ${mod.total} criteria of this module are shown. The others are tracked in the SRS checklist.`, { size: 9, color: GREY });

  for (const c of list) {
    const cc = CRITERIA[c.id];
    if (!cc) throw new Error("no content for " + c.id);
    const { hit, list: tlist } = testsFor(cc.tests);
    const shots = cc.shots.filter((s) => manifest[s] && fs.existsSync(path.join(SHOT_DIR, s + ".png")));
    if (!shots.length && !(cc.ev ?? []).length) throw new Error("no evidence for " + c.id);

    // text page
    portrait(c.id);
    addToc(1, `${c.id}  ${c.text}`);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(GREY).text(T(`MODULE ${mod.n}: ${mod.title}   |   SRS SECTION ${mod.sec}`), { characterSpacing: 0.5 });
    doc.moveDown(0.25);
    const idY = doc.y;
    doc.font("Helvetica-Bold").fontSize(24).fillColor(NAVY).text(c.id, 48, idY, { lineBreak: false });
    pill(doc.page.width - 48 - 84, idY + 6, "COMPLETE", GREEN);
    doc.y = idY + 34;
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#1c2430").text(T(c.text), 48, doc.y, { width: doc.page.width - 96, lineGap: 2 });
    doc.moveDown(0.4); rule();
    h2("What the SRS requires");
    body(`${c.text}. This is acceptance criterion ${c.id.split("-")[1].split(".")[1]} of module ${mod.n} (${mod.title}) in SRS section ${mod.sec}.`);
    h2("How the platform meets it");
    body(cc.text);
    if (c.note && c.note.length > 25 && c.note.includes(" ")) { doc.moveDown(0.3); body("Status note from the SRS checklist: " + c.note, { size: 9.5, color: GREY }); }
    h2("Where to see it in the live application");
    for (const s of shots) { const m = manifest[s]; body(`${m.title} (${m.role === "public" ? "no sign in needed" : "signed in as " + m.role}, page ${m.url || m.route})`, { size: 9.5 }); }
    if ((cc.ev ?? []).length) body("Database evidence is also included: " + cc.ev.join(", ") + ".", { size: 9.5 });
    h2("Evidence in this report");
    const nFig = shots.length * 2 + (cc.ev ?? []).length;
    body(`Screenshots from the live application: ${shots.length}. ${tlist.length ? `Automated tests that cover it: ${tlist.length} in ${hit.length} test files, all passing.` : ""}`, { size: 9.5 });
    void nFig;

    // tests: per file counts and a sample of names; the full list is in Appendix B
    if (tlist.length) {
      h2(`Automated tests (${tlist.length} passing)`);
      table([{ h: "Test file", w: 330, f: (r) => r.file }, { h: "Passing", w: 50, f: (r) => String(r.n) }], hit.map((f) => ({ file: f.file, n: f.tests.filter((t) => t.status === "passed").length })), { size: 8, rowH: 12.5, maxRows: 12 });
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GREY).text("Examples of what the tests assert:", 48, doc.y);
      doc.moveDown(0.2);
      const step = Math.max(1, Math.floor(tlist.length / 7));
      for (let i = 0, n = 0; i < tlist.length && n < 7; i += step, n++) {
        if (doc.y > doc.page.height - 70) break;
        doc.font("Helvetica").fontSize(7.8).fillColor("#1c2430").text(T("[pass] " + tlist[i].name), 54, doc.y, { width: doc.page.width - 108, lineGap: 0.8, height: 22, ellipsis: true });
      }
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text("Every passing test name is listed in Appendix B.", 48, doc.y);
    }

    // figures
    let nShots = 0;
    for (const s of shots) {
      figurePage(c, nShots, s, `${manifest[s].title}. This is a real capture of the deployed application, role ${manifest[s].role}.`, "full");
      shotsUsed.add(s);
      if (!zoomed.has(s)) { figurePage(c, nShots, s, `Enlarged detail of the content area of the previous figure, for legibility. ${manifest[s].title}.`, "zoom"); zoomed.add(s); }
      nShots++;
    }
    for (const k of cc.ev ?? []) evidencePage(c, k);
    traceRows.push({ id: c.id, text: c.text, shots: shots.length, tests: tlist.length, ev: (cc.ev ?? []).length, mod: mod.n });
  }
}

// ---- appendices ----------------------------------------------------------------------------------------------------------
function appendixTitle(t, sub) { portrait(t); curTag = t; addToc(0, t); h1(t); if (sub) body(sub, { color: GREY }); doc.moveDown(0.4); }

appendixTitle("Appendix A: Traceability matrix", "Each completed criterion, the number of live screenshots, the number of passing automated tests that cover it, and the number of database evidence pages.");
{
  let rows = traceRows.slice();
  while (rows.length) {
    const left = table([{ h: "Id", w: 55, f: (r) => r.id }, { h: "Criterion", w: 300, f: (r) => r.text }, { h: "Shots", w: 38, f: (r) => String(r.shots) }, { h: "Tests", w: 38, f: (r) => String(r.tests) }, { h: "DB", w: 28, f: (r) => String(r.ev) }], rows, { size: 8, rowH: 13.5 });
    if (!left) break;
    rows = rows.slice(rows.length - left);
    portrait("Appendix A (continued)"); doc.y = 50;
  }
}

appendixTitle("Appendix B: Automated test inventory", `Every passing test from the test run used as evidence (${totalPassed} tests), grouped by test file.`);
{
  doc.fontSize(7.5);
  for (const f of files) {
    const ps = f.tests.filter((t) => t.status === "passed");
    if (!ps.length) continue;
    if (doc.y > doc.page.height - 90) { portrait("Appendix B (continued)"); doc.y = 50; }
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(NAVY).text(T(`${f.file}  (${ps.length} passing)`), 48, doc.y, { width: doc.page.width - 96 });
    doc.moveDown(0.1);
    for (const t of ps) {
      if (doc.y > doc.page.height - 56) { portrait("Appendix B (continued)"); doc.y = 50; }
      doc.font("Helvetica").fontSize(7.2).fillColor("#1c2430").text(T("[pass] " + t.name), 54, doc.y, { width: doc.page.width - 108, lineGap: 0.6 });
    }
    doc.moveDown(0.3);
  }
}

appendixTitle("Appendix C: Database schema", `The live database has ${ev.schema.length} tables. Each is listed with its row count, columns, indexes and foreign keys at capture time.`);
{
  for (const t of ev.schema) {
    const need = 24 + Math.min(t.columns.length, 60) * 8.6;
    if (doc.y + need > doc.page.height - 56) { portrait("Appendix C (continued)"); doc.y = 50; }
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text(T(`${t.name}   (rows: ${t.rows ?? "?"}, indexes: ${t.indexes ?? 0}, foreign keys: ${t.foreignKeys ?? 0})`), 48, doc.y, { width: doc.page.width - 96 });
    const cols = t.columns.map((c) => `${c.name} ${c.type}${c.nullable ? "" : " not null"}`).join(",  ");
    doc.font("Helvetica").fontSize(6.8).fillColor("#2b3646").text(T(cols), 54, doc.y + 1, { width: doc.page.width - 108, lineGap: 0.8 });
    doc.moveDown(0.5);
  }
}

appendixTitle("Appendix D: Procedure inventory", `${ev.procedures.length} typed API procedures, with the access level that guards each one.`);
{
  let rows = ev.procedures.slice().sort((a, b) => (a.router + a.name).localeCompare(b.router + b.name));
  while (rows.length) {
    const left = table([{ h: "Router", w: 110, f: (r) => r.router }, { h: "Procedure", w: 200, f: (r) => r.name }, { h: "Access", w: 80, f: (r) => r.access }, { h: "Kind", w: 60, f: (r) => r.kind }], rows, { size: 7.5, rowH: 11.5 });
    if (!left) break;
    rows = rows.slice(rows.length - left);
    portrait("Appendix D (continued)"); doc.y = 50;
  }
}

appendixTitle("Appendix E: Notification event catalogue", `${ev.catalogue.length} notification events with family, priority and email delivery rule.`);
{
  let rows = ev.catalogue.slice();
  while (rows.length) {
    const left = table([{ h: "Id", w: 30, f: (r) => String(r.id) }, { h: "Event", w: 190, f: (r) => r.name }, { h: "Family", w: 80, f: (r) => String(r.family) }, { h: "Priority", w: 50, f: (r) => String(r.priority) }, { h: "Email", w: 60, f: (r) => String(r.emailDelivery) }, { h: "Deep link", w: 120, f: (r) => String(r.deepLink ?? "") }], rows, { size: 7.2, rowH: 11.5 });
    if (!left) break;
    rows = rows.slice(rows.length - left);
    portrait("Appendix E (continued)"); doc.y = 50;
  }
}

appendixTitle("Appendix F: Database migrations", `${ev.migrations.length} migration files, applied to the live database.`);
{
  let rows = ev.migrations.slice();
  while (rows.length) {
    const left = table([{ h: "File", w: 190, f: (r) => r.file }, { h: "Stmts", w: 30, f: (r) => String(r.statements) }, { h: "Summary", w: 300, f: (r) => r.summary }], rows, { size: 7, rowH: 12 });
    if (!left) break;
    rows = rows.slice(rows.length - left);
    portrait("Appendix F (continued)"); doc.y = 50;
  }
}

appendixTitle("Appendix G: Live database verification", "Results of real statements and queries run against the live database for this report.");
{
  h2("Append only audit tables");
  table([{ h: "Statement tried", w: 230, f: (r) => r.action }, { h: "Result", w: 290, f: (r) => r.result }], ev.immutability, { size: 7.5, rowH: 14 });
  h2("Row level security");
  body(`${ev.rls.enabled} of ${ev.rls.tables} public tables have row level security enabled, ${ev.rls.forced} are forced, with ${ev.rls.policies} policies.`, { size: 9 });
  h2("Tables with the append only trigger");
  body(ev.auditTriggers.join(", "), { size: 8 });
  h2("Record counts");
  body(Object.entries(ev.counts).map(([k, v]) => `${k}: ${v}`).join("    "), { size: 9 });
}

appendixTitle("Appendix H: Screenshot index", `All ${Object.keys(manifest).length} screenshots captured from the live application, with the role used and the page.`);
{
  let rows = Object.entries(manifest).map(([id, m]) => ({ id, ...m }));
  while (rows.length) {
    const left = table([{ h: "Scene", w: 130, f: (r) => r.id }, { h: "Role", w: 50, f: (r) => r.role }, { h: "Page", w: 150, f: (r) => r.url || r.route }, { h: "Title", w: 260, f: (r) => r.title }], rows, { size: 7, rowH: 11.5 });
    if (!left) break;
    rows = rows.slice(rows.length - left);
    portrait("Appendix H (continued)"); doc.y = 50;
  }
}

// contact sheets of every screenshot, 6 per landscape page
{
  const ids = Object.keys(manifest).filter((i) => fs.existsSync(path.join(SHOT_DIR, i + ".png")));
  let first = true;
  for (let i = 0; i < ids.length; i += 6) {
    landscape("Appendix I");
    if (first) { addToc(0, "Appendix I: Screenshot contact sheets"); first = false; }
    const L = 36, W = doc.page.width - 72;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text("Appendix I: Screenshot contact sheets", L, 30, { lineBreak: false });
    const cw = (W - 20) / 3, ch = cw * 0.625;
    ids.slice(i, i + 6).forEach((id, k) => {
      const x = L + (k % 3) * (cw + 10), y = 56 + Math.floor(k / 3) * (ch + 42);
      doc.image(path.join(SHOT_DIR, id + ".png"), x, y, { width: cw });
      doc.rect(x, y, cw, ch).lineWidth(0.5).stroke(RULE);
      doc.font("Helvetica").fontSize(7).fillColor("#1c2430").text(T(`${id}: ${manifest[id].title}`), x, y + ch + 3, { width: cw, height: 20, ellipsis: true });
    });
  }
}

// ---- fill the table of contents, then page chrome -----------------------------------------------------------------------
const total = pageNo();
{
  let idx = 0, pg = tocStart;
  doc.switchToPage(pg);
  const perPage = 44;
  const draw = (first) => {
    doc.y = 50; doc.x = 48;
    if (first) { doc.font("Helvetica-Bold").fontSize(20).fillColor(NAVY).text("Contents", 48, 50); doc.moveDown(0.5); }
  };
  draw(true);
  for (const e of toc) {
    if (doc.y > doc.page.height - 64) { pg++; if (pg >= tocStart + TOC_PAGES) throw new Error("TOC too long: " + toc.length); doc.switchToPage(pg); draw(false); }
    const y = doc.y;
    const isCrit = e.level === 1;
    doc.font(isCrit ? "Helvetica" : "Helvetica-Bold").fontSize(isCrit ? 8.3 : 9.5).fillColor(isCrit ? "#1c2430" : NAVY).text(e.label, 48 + (isCrit ? 14 : 0), y, { width: doc.page.width - 150, lineBreak: false, ellipsis: true });
    doc.text(String(e.page + 1), doc.page.width - 90, y, { width: 42, align: "right", lineBreak: false });
    doc.y = y + (isCrit ? 11.2 : 14);
    idx++;
  }
}
for (let i = 1; i < total; i++) {
  doc.switchToPage(i);
  const p = doc.page;
  const oldB = p.margins.bottom; p.margins.bottom = 0;
  const w = p.width, h = p.height;
  doc.font("Helvetica").fontSize(7.8).fillColor(GREY);
  doc.text(T(`IO SKY Delivery Report  |  ${pageTag.get(i) ?? ""}`), p.margins.left, 22, { width: w - p.margins.left - p.margins.right - 70, lineBreak: false, ellipsis: true });
  doc.text(`Page ${i + 1} of ${total}`, w - p.margins.right - 90, h - 28, { width: 90, align: "right", lineBreak: false });
  doc.text("Dummy data. Live application evidence.", p.margins.left, h - 28, { width: 300, lineBreak: false });
  p.margins.bottom = oldB;
}
doc.end();
doc.on?.("end", () => {});
await new Promise((r) => doc.once("end", r));
console.log("pages:", total, "criteria:", traceRows.length, "figures:", figNo, "toc entries:", toc.length);
