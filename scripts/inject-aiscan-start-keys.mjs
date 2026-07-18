/**
 * Fix: AI Scan questionnaire page rendered raw i18n keys (aiscan.start.*)
 * because those keys were never added to any locale dictionary, and the
 * translate() helper returns the key itself (a truthy string) for missing
 * keys — so the `t("k") || "fallback"` pattern in AIScanStart.tsx never hit
 * its fallback.
 *
 * This injects the 18 keys into EN (source of truth) + all 9 other locales
 * with translated copy, keeping i18n completeness + parity tests green.
 *
 * Idempotent: existing keys are left untouched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const I18N_DIR = join(__dirname, "..", "client", "src", "lib", "i18n");

// key -> per-locale value (en included)
const T = {
  "aiscan.start.eyebrow": {
    en: "AI SCAN", nl: "AI SCAN", de: "AI SCAN", fr: "AI SCAN", es: "AI SCAN",
    it: "AI SCAN", ar: "فحص الذكاء الاصطناعي", ja: "AIスキャン", zh: "AI 扫描", pt: "AI SCAN",
  },
  "aiscan.start.title": {
    en: "Operational diagnostic", nl: "Operationele diagnose", de: "Operative Diagnose",
    fr: "Diagnostic opérationnel", es: "Diagnóstico operativo", it: "Diagnosi operativa",
    ar: "تشخيص تشغيلي", ja: "オペレーション診断", zh: "运营诊断", pt: "Diagnóstico operacional",
  },
  "aiscan.start.subtitle": {
    en: "Answer a few focused questions to map your operational maturity across key dimensions.",
    nl: "Beantwoord enkele gerichte vragen om uw operationele volwassenheid over de belangrijkste dimensies in kaart te brengen.",
    de: "Beantworten Sie einige gezielte Fragen, um Ihre operative Reife über die wichtigsten Dimensionen abzubilden.",
    fr: "Répondez à quelques questions ciblées pour cartographier votre maturité opérationnelle selon les dimensions clés.",
    es: "Responda algunas preguntas concretas para mapear su madurez operativa en las dimensiones clave.",
    it: "Rispondi ad alcune domande mirate per mappare la tua maturità operativa nelle dimensioni chiave.",
    ar: "أجب عن بعض الأسئلة المركزة لرسم خريطة نضجك التشغيلي عبر الأبعاد الرئيسية.",
    ja: "いくつかの的を絞った質問に答えて、主要な側面における業務成熟度を可視化します。",
    zh: "回答几个有针对性的问题，以绘制您在关键维度上的运营成熟度。",
    pt: "Responda a algumas perguntas objetivas para mapear sua maturidade operacional nas principais dimensões.",
  },
  "aiscan.start.stepLabel": {
    en: "Step", nl: "Stap", de: "Schritt", fr: "Étape", es: "Paso",
    it: "Passaggio", ar: "خطوة", ja: "ステップ", zh: "步骤", pt: "Etapa",
  },
  "aiscan.start.identity": {
    en: "Your details", nl: "Uw gegevens", de: "Ihre Angaben", fr: "Vos coordonnées",
    es: "Sus datos", it: "I tuoi dati", ar: "بياناتك", ja: "あなたの情報",
    zh: "您的信息", pt: "Seus dados",
  },
  "aiscan.start.loading": {
    en: "Loading questionnaire…", nl: "Vragenlijst laden…", de: "Fragebogen wird geladen…",
    fr: "Chargement du questionnaire…", es: "Cargando cuestionario…", it: "Caricamento del questionario…",
    ar: "جارٍ تحميل الاستبيان…", ja: "アンケートを読み込み中…", zh: "正在加载问卷…",
    pt: "Carregando questionário…",
  },
  "aiscan.start.back": {
    en: "Back", nl: "Terug", de: "Zurück", fr: "Retour", es: "Atrás",
    it: "Indietro", ar: "رجوع", ja: "戻る", zh: "返回", pt: "Voltar",
  },
  "aiscan.start.next": {
    en: "Next", nl: "Volgende", de: "Weiter", fr: "Suivant", es: "Siguiente",
    it: "Avanti", ar: "التالي", ja: "次へ", zh: "下一步", pt: "Próximo",
  },
  "aiscan.start.submit": {
    en: "Generate report", nl: "Rapport genereren", de: "Bericht erstellen",
    fr: "Générer le rapport", es: "Generar informe", it: "Genera report",
    ar: "إنشاء التقرير", ja: "レポートを生成", zh: "生成报告", pt: "Gerar relatório",
  },
  "aiscan.start.submitting": {
    en: "Generating report…", nl: "Rapport genereren…", de: "Bericht wird erstellt…",
    fr: "Génération du rapport…", es: "Generando informe…", it: "Generazione del report…",
    ar: "جارٍ إنشاء التقرير…", ja: "レポートを生成中…", zh: "正在生成报告…",
    pt: "Gerando relatório…",
  },
  "aiscan.start.identityTitle": {
    en: "Where should we send your report?",
    nl: "Waar mogen we uw rapport naartoe sturen?",
    de: "Wohin sollen wir Ihren Bericht senden?",
    fr: "Où devons-nous envoyer votre rapport ?",
    es: "¿A dónde enviamos su informe?",
    it: "Dove inviamo il tuo report?",
    ar: "إلى أين نرسل تقريرك؟",
    ja: "レポートの送付先を教えてください。",
    zh: "我们应将报告发送到哪里？",
    pt: "Para onde devemos enviar seu relatório?",
  },
  "aiscan.start.identitySubtitle": {
    en: "Your report will be ready in a few seconds. We never sell or share your data.",
    nl: "Uw rapport is binnen enkele seconden klaar. We verkopen of delen uw gegevens nooit.",
    de: "Ihr Bericht ist in wenigen Sekunden fertig. Wir verkaufen oder teilen Ihre Daten niemals.",
    fr: "Votre rapport sera prêt en quelques secondes. Nous ne vendons ni ne partageons jamais vos données.",
    es: "Su informe estará listo en unos segundos. Nunca vendemos ni compartimos sus datos.",
    it: "Il tuo report sarà pronto in pochi secondi. Non vendiamo né condividiamo mai i tuoi dati.",
    ar: "سيكون تقريرك جاهزًا خلال ثوانٍ. نحن لا نبيع بياناتك أو نشاركها أبدًا.",
    ja: "レポートは数秒で準備できます。お客様のデータを販売・共有することは一切ありません。",
    zh: "您的报告将在几秒内准备就绪。我们绝不会出售或分享您的数据。",
    pt: "Seu relatório estará pronto em segundos. Nunca vendemos ou compartilhamos seus dados.",
  },
  "aiscan.start.fullName": {
    en: "Full name", nl: "Volledige naam", de: "Vollständiger Name", fr: "Nom complet",
    es: "Nombre completo", it: "Nome completo", ar: "الاسم الكامل", ja: "氏名",
    zh: "全名", pt: "Nome completo",
  },
  "aiscan.start.email": {
    en: "Work email", nl: "Zakelijk e-mailadres", de: "Geschäftliche E-Mail",
    fr: "E-mail professionnel", es: "Correo de trabajo", it: "Email di lavoro",
    ar: "البريد الإلكتروني للعمل", ja: "勤務先メール", zh: "工作邮箱", pt: "E-mail profissional",
  },
  "aiscan.start.company": {
    en: "Company", nl: "Bedrijf", de: "Unternehmen", fr: "Entreprise", es: "Empresa",
    it: "Azienda", ar: "الشركة", ja: "会社名", zh: "公司", pt: "Empresa",
  },
  "aiscan.start.context": {
    en: "Anything specific we should keep in mind? (optional)",
    nl: "Iets specifieks waar we rekening mee moeten houden? (optioneel)",
    de: "Gibt es etwas Bestimmtes, das wir beachten sollten? (optional)",
    fr: "Quelque chose de précis à prendre en compte ? (facultatif)",
    es: "¿Algo específico que debamos tener en cuenta? (opcional)",
    it: "Qualcosa di specifico da tenere a mente? (facoltativo)",
    ar: "هل هناك شيء محدد يجب أن نأخذه في الاعتبار؟ (اختياري)",
    ja: "特に考慮すべき点はありますか？（任意）",
    zh: "有什么需要我们特别注意的吗？（可选）",
    pt: "Algo específico que devemos considerar? (opcional)",
  },
  "aiscan.start.disclaimer": {
    en: "I understand the IO SKY AI Disclaimer: AI-assisted output is indicative and not a substitute for professional advisory.",
    nl: "Ik begrijp de IO SKY AI-disclaimer: AI-ondersteunde output is indicatief en geen vervanging voor professioneel advies.",
    de: "Ich verstehe den IO SKY KI-Haftungsausschluss: KI-gestützte Ergebnisse sind richtungsweisend und ersetzen keine professionelle Beratung.",
    fr: "Je comprends l'avertissement IA d'IO SKY : les résultats assistés par IA sont indicatifs et ne remplacent pas un conseil professionnel.",
    es: "Entiendo el aviso de IA de IO SKY: los resultados asistidos por IA son indicativos y no sustituyen el asesoramiento profesional.",
    it: "Comprendo il disclaimer IA di IO SKY: l'output assistito dall'IA è indicativo e non sostituisce la consulenza professionale.",
    ar: "أفهم إخلاء المسؤولية الخاص بالذكاء الاصطناعي في IO SKY: النتائج المدعومة بالذكاء الاصطناعي إرشادية وليست بديلاً عن الاستشارة المهنية.",
    ja: "IO SKY AI 免責事項を理解しています：AI 支援による出力は参考であり、専門的な助言の代替ではありません。",
    zh: "我理解 IO SKY AI 免责声明：AI 辅助生成的结果仅供参考，不能替代专业咨询。",
    pt: "Entendo o aviso de IA da IO SKY: o resultado assistido por IA é indicativo e não substitui a consultoria profissional.",
  },
  "aiscan.start.errorGeneric": {
    en: "Something went wrong. Please try again.",
    nl: "Er ging iets mis. Probeer het opnieuw.",
    de: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    fr: "Une erreur s'est produite. Veuillez réessayer.",
    es: "Algo salió mal. Inténtelo de nuevo.",
    it: "Qualcosa è andato storto. Riprova.",
    ar: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    ja: "問題が発生しました。もう一度お試しください。",
    zh: "出了点问题。请重试。",
    pt: "Algo deu errado. Tente novamente.",
  },
};

const ALL = ["en", "nl", "de", "fr", "es", "it", "ar", "ja", "zh", "pt"];

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

let total = 0;
for (const code of ALL) {
  const path = join(I18N_DIR, `${code}.ts`);
  let src = readFileSync(path, "utf8");
  const existing = new Set([...src.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]));

  const additions = [];
  for (const [key, byLocale] of Object.entries(T)) {
    if (existing.has(key)) continue;
    const val = byLocale[code] ?? byLocale.en;
    additions.push(`  "${key}": "${esc(val)}",`);
  }
  if (additions.length === 0) {
    console.log(`${code}: nothing to add`);
    continue;
  }
  const lastBrace = src.lastIndexOf("};");
  if (lastBrace === -1) {
    console.error(`${code}: no closing brace, skipped`);
    continue;
  }
  src = src.slice(0, lastBrace) + additions.join("\n") + "\n" + src.slice(lastBrace);
  writeFileSync(path, src, "utf8");
  total += additions.length;
  console.log(`${code}: added ${additions.length} key(s)`);
}
console.log(`\nDone. Added ${total} aiscan.start.* key(s).`);
