#!/usr/bin/env node
// 2026-05-26 — Remove unsubstantiated certification claims and replace with neutral, truthful language.
// We never claim certifications IO SKY has not obtained.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Per-locale replacements. Keys are EN source phrases; values map per-locale to honest replacements.
// We use simple regex-like literal replacements with `String.prototype.replaceAll`.

const REPLACEMENTS = {
  en: [
    ["ISO 27001 Certified", "Security-First Architecture"],
    ["ISO 27001 Ready", "Audit-Ready Architecture"],
    ["ISO 27001 ready", "audit-ready architecture"],
    ["ISO 27001 aligned", "audit-ready architecture"],
    ["ISO 27001 Aligned", "Audit-Ready Architecture"],
    ["ISO 27001 Compliance", "Comprehensive Security Controls"],
    ["ISO 27001 / GDPR documentation requests", "Security documentation requests"],
    ["ISO 27001 and more", "GDPR-aligned by design"],
    ["ISO 27001, SOC 2, and NIS2 alignment by default", "Security and privacy by design"],
    ["ISO 27001, SOC 2 Type II, NIS2 alignment. Reports available under NDA", "Security and privacy controls. Documentation available under NDA"],
    ["ISO 27001, SOC 2 Type II, NIS2 alignment. Reports available under NDA via the trust portal", "Security and privacy controls. Documentation available under NDA via the trust portal"],
    ["Enterprise security & ISO 27001 ready", "Enterprise-grade security architecture"],
    ["Enterprise Security", "Built-in Security"],
    ["GDPR, ISO 27001 and more", "GDPR-aligned by design"],
    ["IO SKY B.V.", "IO SKY"],
    ["IO SKY B.V", "IO SKY"],
  ],
  nl: [
    ["ISO 27001 gecertificeerd", "Beveiliging als fundament"],
    ["ISO 27001 ready", "Audit-ready architectuur"],
    ["ISO 27001-compliance", "Uitgebreide beveiligingsmaatregelen"],
    ["ISO 27001", "audit-ready beveiliging"],
    ["IO SKY B.V.", "IO SKY"],
  ],
  de: [
    ["ISO 27001 zertifiziert", "Security-First Architektur"],
    ["ISO 27001 ready", "Audit-bereite Architektur"],
    ["ISO 27001-Compliance", "Umfassende Sicherheitskontrollen"],
    ["ISO 27001", "audit-bereite Sicherheit"],
    ["IO SKY B.V.", "IO SKY"],
  ],
  fr: [
    ["Certifié ISO 27001", "Architecture orientée sécurité"],
    ["ISO 27001 ready", "Architecture prête pour audit"],
    ["Conformité ISO 27001", "Contrôles de sécurité complets"],
    ["ISO 27001", "sécurité prête pour audit"],
    ["IO SKY B.V.", "IO SKY"],
  ],
  es: [
    ["Certificado ISO 27001", "Arquitectura orientada a la seguridad"],
    ["ISO 27001 ready", "Arquitectura lista para auditoría"],
    ["Cumplimiento ISO 27001", "Controles de seguridad integrales"],
    ["ISO 27001", "seguridad lista para auditoría"],
    ["IO SKY B.V.", "IO SKY"],
  ],
  it: [
    ["Certificato ISO 27001", "Architettura orientata alla sicurezza"],
    ["ISO 27001 ready", "Architettura pronta per audit"],
    ["Conformità ISO 27001", "Controlli di sicurezza completi"],
    ["ISO 27001", "sicurezza pronta per audit"],
    ["IO SKY B.V.", "IO SKY"],
  ],
  ar: [
    ["معتمد وفق ISO 27001", "بنية تركز على الأمان"],
    ["جاهز ISO 27001", "بنية جاهزة للتدقيق"],
    ["امتثال ISO 27001", "ضوابط أمان شاملة"],
    ["حاصل على ISO 27001", "بنية تركز على الأمان"],
    ["ISO 27001", "أمان جاهز للتدقيق"],
    ["IO SKY B.V.", "IO SKY"],
  ],
  ja: [
    ["ISO 27001 認証取得", "セキュリティファースト設計"],
    ["ISO 27001 ready", "監査対応アーキテクチャ"],
    ["ISO 27001 準拠", "包括的なセキュリティ制御"],
    ["ISO 27001", "監査対応セキュリティ"],
    ["IO SKY B.V.", "IO SKY"],
  ],
  zh: [
    ["ISO 27001 认证", "安全优先架构"],
    ["ISO 27001 ready", "审计就绪架构"],
    ["ISO 27001 合规", "全面安全控制"],
    ["ISO 27001", "审计就绪安全性"],
    ["IO SKY B.V.", "IO SKY"],
  ],
};

let totalChanges = 0;
for (const [lang, list] of Object.entries(REPLACEMENTS)) {
  const file = path.join(ROOT, "client", "src", "lib", "i18n", `${lang}.ts`);
  if (!fs.existsSync(file)) { console.log(`skip ${file}`); continue; }
  let txt = fs.readFileSync(file, "utf8");
  let before = txt;
  for (const [find, replace] of list) {
    txt = txt.split(find).join(replace);
  }
  if (txt !== before) {
    fs.writeFileSync(file, txt);
    const changes = list.filter(([f]) => before.includes(f)).length;
    totalChanges += changes;
    console.log(`updated ${lang}.ts (${changes} phrase classes touched)`);
  } else {
    console.log(`no changes ${lang}.ts`);
  }
}

// Also patch the page-level files that contain literal claims (Login footer "IO SKY B.V.", Enterprise large badge, Security page list, BookStrategy pill, Solutions text, Legal body).
const PAGE_PATCHES = [
  // Login: "IO SKY B.V." in footer + GDPR/ISO compliance trust block body
  { file: "client/src/pages/Login.tsx", finds: [
    ["IO SKY B.V.", "IO SKY"],
    ["\"GDPR, ISO 27001 and more.\"", "\"GDPR-aligned by design.\""],
  ] },
  // Enterprise page large ISO 27001 number tile
  { file: "client/src/pages/Enterprise.tsx", finds: [
    [">ISO 27001<", ">Audit-Ready<"],
  ] },
  // BookStrategy ISO 27001 pill
  { file: "client/src/pages/BookStrategy.tsx", finds: [
    ["<Pill>ISO 27001</Pill>", "<Pill>Audit-ready</Pill>"],
  ] },
  // Legal compliance body
  { file: "client/src/pages/Legal.tsx", finds: [
    ["\"ISO 27001, SOC 2 Type II, NIS2 alignment. Reports available under NDA.\"", "\"Security and privacy controls. Documentation available under NDA.\""],
  ] },
  // Security page list
  { file: "client/src/pages/Security.tsx", finds: [
    ["\"ISO 27001, SOC 2 Type II, NIS2 alignment. Reports available under NDA via the trust portal.\"", "\"Security and privacy controls. Documentation available under NDA via the trust portal.\""],
  ] },
  // Solutions trust strip body
  { file: "client/src/pages/Solutions.tsx", finds: [
    ["\"ISO 27001 aligned\"", "\"Security-first architecture\""],
  ] },
];

for (const p of PAGE_PATCHES) {
  const full = path.join(ROOT, p.file);
  if (!fs.existsSync(full)) { console.log(`skip ${p.file}`); continue; }
  let txt = fs.readFileSync(full, "utf8");
  const before = txt;
  for (const [find, replace] of p.finds) {
    txt = txt.split(find).join(replace);
  }
  if (txt !== before) {
    fs.writeFileSync(full, txt);
    totalChanges += p.finds.filter(([f]) => before.includes(f)).length;
    console.log(`updated ${p.file}`);
  } else {
    console.log(`no changes ${p.file}`);
  }
}

console.log(`\nTotal phrase classes replaced: ${totalChanges}`);
