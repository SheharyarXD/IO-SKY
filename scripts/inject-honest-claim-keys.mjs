/**
 * Launch-honesty i18n completion.
 *
 * After removing fabricated quantitative claims (uptime %, "delivered"
 * track-record numbers, 4.9/5), the revised EN source uses honest
 * capability/architecture language. This script injects translated versions
 * of those keys into every non-EN locale so the i18n completeness test stays
 * green AND every language stays honest.
 *
 * Idempotent: if a key already exists in a locale, it is left untouched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const I18N_DIR = join(__dirname, "..", "client", "src", "lib", "i18n");

// key -> { locale: value }
const T = {
  "infra.trust.uptime.title": {
    nl: "Hoge beschikbaarheid", de: "Hohe Verfügbarkeit", fr: "Haute disponibilité",
    es: "Alta disponibilidad", it: "Alta disponibilità", ar: "توافر عالٍ",
    ja: "高可用性", zh: "高可用性", pt: "Alta disponibilidade",
  },
  "infra.trust.uptime.sub": {
    nl: "Architectuur ontworpen voor betrouwbaarheid", de: "Architektur für Zuverlässigkeit konzipiert",
    fr: "Architecture conçue pour la fiabilité", es: "Arquitectura diseñada para la fiabilidad",
    it: "Architettura progettata per l'affidabilità", ar: "بنية مصممة للموثوقية",
    ja: "信頼性のために設計されたアーキテクチャ", zh: "为可靠性而设计的架构",
    pt: "Arquitetura projetada para confiabilidade",
  },
  "sol.trust.t4.title": {
    nl: "Hoge beschikbaarheid", de: "Hohe Verfügbarkeit", fr: "Haute disponibilité",
    es: "Alta disponibilidad", it: "Alta disponibilità", ar: "توافر عالٍ",
    ja: "高可用性", zh: "高可用性", pt: "Alta disponibilidade",
  },
  "hero.trust.uptime": {
    nl: "Hoge beschikbaarheid", de: "Hohe Verfügbarkeit", fr: "Haute disponibilité",
    es: "Alta disponibilidad", it: "Alta disponibilità", ar: "توافر عالٍ",
    ja: "高可用性", zh: "高可用性", pt: "Alta disponibilidade",
  },
  "login.metric.uptime.value": {
    nl: "Hoge beschikbaarheid", de: "Hohe Verfügbarkeit", fr: "Haute disponibilité",
    es: "Alta disponibilidad", it: "Alta disponibilità", ar: "توافر عالٍ",
    ja: "高可用性", zh: "高可用性", pt: "Alta disponibilidade",
  },
  "results.disclaimer": {
    nl: "Illustratieve doeluitkomsten op basis van typische operationele verbeteringen door intelligente infrastructuur en automatisering. Cijfers zijn indicatief, geen gegarandeerde resultaten, en de werkelijke impact verschilt per organisatie.",
    de: "Illustrative Zielergebnisse auf Basis typischer operativer Verbesserungen durch intelligente Infrastruktur und Automatisierung. Die Zahlen sind richtungsweisend, keine garantierten Ergebnisse, und die tatsächliche Wirkung variiert je nach Organisation.",
    fr: "Résultats cibles illustratifs basés sur les améliorations opérationnelles typiques de l'infrastructure intelligente et de l'automatisation. Les chiffres sont indicatifs, non garantis, et l'impact réel varie selon l'organisation.",
    es: "Resultados objetivo ilustrativos basados en mejoras operativas típicas de la infraestructura inteligente y la automatización. Las cifras son orientativas, no resultados garantizados, y el impacto real varía según la organización.",
    it: "Risultati target illustrativi basati sui tipici miglioramenti operativi derivanti da infrastruttura intelligente e automazione. Le cifre sono indicative, non risultati garantiti, e l'impatto effettivo varia in base all'organizzazione.",
    ar: "نتائج مستهدفة توضيحية تستند إلى تحسينات تشغيلية نموذجية من البنية الذكية والأتمتة. الأرقام إرشادية وليست نتائج مضمونة، ويختلف التأثير الفعلي حسب المؤسسة.",
    ja: "インテリジェントインフラと自動化による一般的な業務改善に基づく目標成果の例示です。数値は方向性を示すものであり、保証された結果ではなく、実際の効果は組織によって異なります。",
    zh: "基于智能基础设施和自动化带来的典型运营改善的示意性目标成果。数据仅供参考，并非保证结果，实际影响因组织而异。",
    pt: "Resultados-alvo ilustrativos baseados em melhorias operacionais típicas da infraestrutura inteligente e automação. Os números são indicativos, não resultados garantidos, e o impacto real varia conforme a organização.",
  },
  "about.impact.s1.value": {
    nl: "End-to-end", de: "End-to-End", fr: "De bout en bout", es: "Integral",
    it: "End-to-end", ar: "متكامل", ja: "エンドツーエンド", zh: "端到端", pt: "Ponta a ponta",
  },
  "about.impact.s1.label": {
    nl: "Operationele infrastructuur voor u gebouwd en beheerd",
    de: "Operative Infrastruktur, für Sie gebaut und betrieben",
    fr: "Infrastructure opérationnelle conçue et exploitée pour vous",
    es: "Infraestructura operativa creada y operada para usted",
    it: "Infrastruttura operativa costruita e gestita per te",
    ar: "بنية تشغيلية مبنية ومُدارة من أجلك",
    ja: "お客様のために構築・運用される業務インフラ",
    zh: "为您构建并运营的运营基础设施",
    pt: "Infraestrutura operacional construída e operada para você",
  },
  "about.impact.s2.value": {
    nl: "Automatisering-eerst", de: "Automation-first", fr: "Automatisation d'abord",
    es: "Automatización primero", it: "Automazione prima di tutto", ar: "الأتمتة أولاً",
    ja: "自動化ファースト", zh: "自动化优先", pt: "Automação em primeiro lugar",
  },
  "about.impact.s2.label": {
    nl: "Handmatige processen systematisch vervangen door intelligente workflows",
    de: "Manuelle Prozesse systematisch durch intelligente Workflows ersetzt",
    fr: "Processus manuels systématiquement remplacés par des flux intelligents",
    es: "Procesos manuales reemplazados sistemáticamente por flujos inteligentes",
    it: "Processi manuali sostituiti sistematicamente con flussi intelligenti",
    ar: "استبدال العمليات اليدوية بشكل منهجي بتدفقات عمل ذكية",
    ja: "手作業のプロセスを体系的にインテリジェントなワークフローへ置き換え",
    zh: "系统性地用智能工作流取代手动流程",
    pt: "Processos manuais substituídos sistematicamente por fluxos inteligentes",
  },
  "about.impact.s3.value": {
    nl: "Hoge beschikbaarheid", de: "Hohe Verfügbarkeit", fr: "Haute disponibilité",
    es: "Alta disponibilidad", it: "Alta disponibilità", ar: "توافر عالٍ",
    ja: "高可用性", zh: "高可用性", pt: "Alta disponibilidade",
  },
  "about.impact.s3.label": {
    nl: "Architectuur ontworpen voor betrouwbaarheid en redundantie",
    de: "Architektur für Zuverlässigkeit und Redundanz konzipiert",
    fr: "Architecture conçue pour la fiabilité et la redondance",
    es: "Arquitectura diseñada para la fiabilidad y la redundancia",
    it: "Architettura progettata per affidabilità e ridondanza",
    ar: "بنية مصممة للموثوقية والتكرار",
    ja: "信頼性と冗長性のために設計されたアーキテクチャ",
    zh: "为可靠性和冗余而设计的架构",
    pt: "Arquitetura projetada para confiabilidade e redundância",
  },
  "about.impact.s4.value": {
    nl: "Meetbaar", de: "Messbar", fr: "Mesurable", es: "Medible",
    it: "Misurabile", ar: "قابل للقياس", ja: "測定可能", zh: "可衡量", pt: "Mensurável",
  },
  "about.impact.s4.label": {
    nl: "Elke samenwerking afgezet tegen operationele efficiëntiedoelen",
    de: "Jede Zusammenarbeit an operativen Effizienzzielen gemessen",
    fr: "Chaque engagement mesuré par rapport à des objectifs d'efficacité opérationnelle",
    es: "Cada colaboración medida frente a objetivos de eficiencia operativa",
    it: "Ogni collaborazione misurata rispetto a obiettivi di efficienza operativa",
    ar: "كل تعاون يُقاس مقابل أهداف الكفاءة التشغيلية",
    ja: "すべての取り組みを業務効率の目標に対して測定",
    zh: "每一次合作均以运营效率目标进行衡量",
    pt: "Cada engajamento medido em relação a metas de eficiência operacional",
  },
};

const LOCALES = ["nl", "de", "fr", "es", "it", "ar", "ja", "zh", "pt"];

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

let totalAdded = 0;

for (const code of LOCALES) {
  const path = join(I18N_DIR, `${code}.ts`);
  let src = readFileSync(path, "utf8");
  const existing = new Set(
    [...src.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]),
  );

  const additions = [];
  for (const [key, byLocale] of Object.entries(T)) {
    if (existing.has(key)) continue;
    const val = byLocale[code];
    if (!val) continue;
    additions.push(`  "${key}": "${esc(val)}",`);
  }

  if (additions.length === 0) {
    console.log(`${code}: nothing to add`);
    continue;
  }

  // Insert just before the final closing brace of the exported object.
  const lastBrace = src.lastIndexOf("};");
  if (lastBrace === -1) {
    console.error(`${code}: could not find closing brace, skipping`);
    continue;
  }
  src = src.slice(0, lastBrace) + additions.join("\n") + "\n" + src.slice(lastBrace);
  writeFileSync(path, src, "utf8");
  totalAdded += additions.length;
  console.log(`${code}: added ${additions.length} key(s)`);
}

console.log(`\nDone. Added ${totalAdded} translated honest-claim key(s).`);
