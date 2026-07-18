// Fix rendered untranslated keys (non-PT) with complete locale-specific values.
// Brand/proper nouns (IO SKY, partner names, GitHub) are NOT touched here.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_DIR = path.resolve(__dirname, "../client/src/lib/i18n");

// Per-key, per-locale full translations. Locales: nl de fr es ar zh ja it
const T = {
  "path.growth.title": { nl:"Groei-ecosysteem", de:"Wachstums-Ökosystem", fr:"Écosystème de croissance", es:"Ecosistema de crecimiento", ar:"منظومة النمو", zh:"增长生态系统", ja:"グロース・エコシステム", it:"Ecosistema di crescita" },
  "path.elite.title": { nl:"Elite-ecosysteem", de:"Elite-Ökosystem", fr:"Écosystème Elite", es:"Ecosistema Elite", ar:"منظومة النخبة", zh:"精英生态系统", ja:"エリート・エコシステム", it:"Ecosistema Elite" },
  "path.custom.title": { nl:"Op maat gemaakte intelligentie-infrastructuur", de:"Maßgeschneiderte Intelligenz-Infrastruktur", fr:"Infrastructure d'intelligence sur mesure", es:"Infraestructura de inteligencia a medida", ar:"بنية الذكاء المخصصة", zh:"定制智能基础设施", ja:"カスタムインテリジェンス基盤", it:"Infrastruttura di intelligenza personalizzata" },
  "path.aiscan.title": { nl:"AI-Scan", de:"KI-Scan", fr:"Scan IA", es:"Escaneo con IA", it:"Scansione IA" },

  "footer.solutions.aiScan": { de:"KI-Scan", fr:"Scan IA", es:"Escaneo con IA", it:"Scansione IA" },
  "footer.solutions.growth": { nl:"Groei-ecosysteem", de:"Wachstums-Ökosystem", fr:"Écosystème de croissance", es:"Ecosistema de crecimiento", ar:"منظومة النمو", zh:"增长生态系统", ja:"グロース・エコシステム", it:"Ecosistema di crescita" },
  "footer.solutions.elite": { nl:"Elite-ecosysteem", de:"Elite-Ökosystem", fr:"Écosystème Elite", es:"Ecosistema Elite", ar:"منظومة النخبة", zh:"精英生态系统", ja:"エリート・エコシステム", it:"Ecosistema Elite" },
  "footer.solutions.custom": { nl:"Maatwerk-intelligentie", de:"Individuelle Intelligenz", fr:"Intelligence sur mesure", es:"Inteligencia a medida", ar:"الذكاء المخصص", zh:"定制智能", ja:"カスタムインテリジェンス", it:"Intelligenza personalizzata" },

  "nav.infrastructure": { fr:"Infrastructure" },
  "nav.intelligence": { fr:"Intelligence", it:"Intelligence" },
  "nav.solutions": { fr:"Solutions" },
  "nav.contact": { fr:"Contact" },
  "nav.enterprise": { de:"Unternehmen" },
  "nav.aiScan": { fr:"Scan IA", es:"Escaneo con IA", it:"Scansione IA" },

  "footer.col.infrastructure": { fr:"Infrastructure" },
  "footer.col.intelligence": { nl:"Intelligentie", fr:"Intelligence" },
  "footer.col.solutions": { fr:"Solutions" },
  "footer.nav.infra.security": { nl:"Beveiliging & governance" },
  "footer.nav.intel.executive": { nl:"Executive-analyses" },
  "footer.nav.intel.hub": { nl:"Intelligence-hub" },

  "hov.opp.tag.workflow": { nl:"Werkstroom", de:"Arbeitsablauf", fr:"Flux de travail", it:"Flusso di lavoro" },
  "ticker.cap.aiScan": { nl:"AI-Scan", fr:"Scan IA", es:"Escaneo con IA", it:"Scansione IA" },
  "ticker.cap.workflow": { nl:"Werkstroom", de:"Arbeitsablauf", fr:"Flux de travail", it:"Flusso di lavoro" },
  "ticker.cap.report": { de:"Berichtswesen", fr:"Rapports" },

  "discover.gain3": { de:"Konversion" },

  "infra.diagram.left.support": { nl:"Ondersteuning", de:"Support", fr:"Support", it:"Supporto" },
  "infra.diagram.right.dashboards": { nl:"Dashboards", de:"Dashboards", fr:"Tableaux de bord", it:"Dashboard" },
  "infra.diagram.right.analytics": { nl:"Analytics", de:"Analytik", fr:"Analytique", it:"Analisi" },
  "infra.diagram.left.title": { fr:"Sources" },
  "infra.diagram.left.comms": { fr:"Communication" },
  "infra.benefit.integration.title": { de:"Integration" },
  "infra.benefit.governance.title": { nl:"Governance", de:"Governance", it:"Governance" },
  "infra.cap.security.title": { de:"Sicherheit & Governance" },
  "infra.midcta.scan": { nl:"Start AI-Scan" },

  "intel.cap.executive.title": { nl:"Executive-analyses", de:"Executive-Analysen" },
  "intel.cap.hub.title": { nl:"Intelligence-hub", de:"Intelligence-Hub" },
  "intel.cap.operational.title": { it:"Intelligence operativa" },
  "intel.cap.data.title": { it:"Intelligence dei dati" },
  "intel.flow.intelligence.title": { fr:"Intelligence", it:"Intelligence" },
  "intel.flow.insights.title": { fr:"Analyses" },
  "intel.flow.impact.title": { nl:"Impact", fr:"Impact" },
  "intel.caps.title.accent": { fr:"intelligence", nl:"intelligentie" },
  "intel.caps.title.part2": { it:"capacità" },
  "intel.followUp.title": { de:"Intelligente Nachverfolgung" },

  "about.phil.p1.title": { nl:"Intelligentie eerst", de:"Intelligenz zuerst" },
  "about.impact.s1.value": { nl:"Eind-tot-eind", it:"End-to-end" },
  "about.impact.s2.value": { de:"Automatisierung zuerst" },
  "about.cta.secondary": { nl:"Start AI-Scan" },
  "contact.h1.accent": { fr:"l'excellence" },
  "contact.info.email": { it:"E-mail" },
  "contact.strip.intel.title": { it:"Intelligence operativa" },
  "login.field.password": { it:"Password" },
  "login.metric.monitoring": { nl:"Monitoring" },
  "pillars.infra.title": { fr:"Infrastructure" },
  "pillars.intel.title": { fr:"Intelligence" },
  "pillars.growth.title": { fr:"Solutions" },
  "pillars.enterprise.title": { nl:"Onderneming", it:"Enterprise" },
  "hero.trust.ai.note": { it:"Intelligence operativa" },
};

const LOCALES = ["nl","de","fr","es","ar","zh","ja","it"];
const files = {};
for (const c of LOCALES) files[c] = readFileSync(path.join(I18N_DIR, `${c}.ts`), "utf8");

function setKey(src, key, val) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`("${esc}"\\s*:\\s*")((?:[^"\\\\]|\\\\.)*)(")`);
  if (!re.test(src)) return { src, ok: false };
  return { src: src.replace(re, `$1${val}$3`), ok: true };
}

let applied = 0; const misses = [];
for (const [key, perLocale] of Object.entries(T)) {
  for (const [loc, val] of Object.entries(perLocale)) {
    if (!LOCALES.includes(loc)) continue;
    const r = setKey(files[loc], key, val);
    if (r.ok) { files[loc] = r.src; applied++; }
    else misses.push(`${loc}:${key}`);
  }
}
for (const c of LOCALES) writeFileSync(path.join(I18N_DIR, `${c}.ts`), files[c]);
console.log(`applied=${applied}`);
if (misses.length) console.log("MISSES:", misses.join(", "));
