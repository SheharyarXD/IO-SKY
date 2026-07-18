#!/usr/bin/env node
/**
 * Inject cookie-banner i18n keys into every locale file.
 * Each locale gets the same key set with translated copy.
 * Idempotent: skips if the key already exists.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "client", "src", "lib", "i18n");

/** All 18 keys per locale */
const COPY = {
  en: {
    "cookie.eyebrow": "Cookie consent",
    "cookie.title": "We respect your data sovereignty",
    "cookie.body.1":
      "IO SKY uses strictly necessary cookies to keep your session secure and load-balanced. Analytics and marketing cookies are",
    "cookie.body.optin": "opt-in only",
    "cookie.body.2":
      "and never shared with third-party advertisers. Read our",
    "cookie.body.3": "for the full versioned record.",
    "cookie.and": "and",
    "cookie.link.cookies": "Cookie Policy",
    "cookie.link.privacy": "Privacy Notice",
    "cookie.btn.acceptAll": "Accept all",
    "cookie.btn.rejectNonEssential": "Reject non-essential",
    "cookie.btn.customise": "Customise",
    "cookie.btn.back": "Back",
    "cookie.btn.save": "Save preferences",
    "cookie.toggle.required": "Required",
    "cookie.cat.strict.title": "Strictly necessary",
    "cookie.cat.strict.body":
      "Session security, load balancing and consent persistence. Required for the platform to operate.",
    "cookie.cat.analytics.title": "Analytics",
    "cookie.cat.analytics.body":
      "First-party, server-side analytics that help us improve the platform. No cross-site tracking.",
    "cookie.cat.marketing.title": "Marketing",
    "cookie.cat.marketing.body":
      "Used only to remember if you arrived from a campaign. Disabled by default. We never run advertising pixels.",
  },
  nl: {
    "cookie.eyebrow": "Cookie-toestemming",
    "cookie.title": "We respecteren je gegevenssoevereiniteit",
    "cookie.body.1":
      "IO SKY gebruikt strikt noodzakelijke cookies om je sessie veilig en load-balanced te houden. Analytics- en marketingcookies zijn",
    "cookie.body.optin": "alleen na toestemming",
    "cookie.body.2":
      "en worden nooit gedeeld met externe adverteerders. Lees ons",
    "cookie.body.3": "voor het volledige geversioneerde overzicht.",
    "cookie.and": "en onze",
    "cookie.link.cookies": "cookiebeleid",
    "cookie.link.privacy": "privacyverklaring",
    "cookie.btn.acceptAll": "Alles accepteren",
    "cookie.btn.rejectNonEssential": "Niet-essentieel weigeren",
    "cookie.btn.customise": "Aanpassen",
    "cookie.btn.back": "Terug",
    "cookie.btn.save": "Voorkeuren opslaan",
    "cookie.toggle.required": "Verplicht",
    "cookie.cat.strict.title": "Strikt noodzakelijk",
    "cookie.cat.strict.body":
      "Sessiebeveiliging, load balancing en het bewaren van toestemming. Vereist voor de werking van het platform.",
    "cookie.cat.analytics.title": "Analyse",
    "cookie.cat.analytics.body":
      "First-party analytics aan de serverzijde die ons helpen het platform te verbeteren. Geen cross-site tracking.",
    "cookie.cat.marketing.title": "Marketing",
    "cookie.cat.marketing.body":
      "Wordt alleen gebruikt om te onthouden via welke campagne je hier gekomen bent. Standaard uit. We gebruiken geen advertentiepixels.",
  },
  de: {
    "cookie.eyebrow": "Cookie-Einwilligung",
    "cookie.title": "Wir respektieren Ihre Datensouveränität",
    "cookie.body.1":
      "IO SKY verwendet ausschließlich notwendige Cookies, um Ihre Sitzung sicher und lastausgeglichen zu halten. Analyse- und Marketing-Cookies sind",
    "cookie.body.optin": "nur nach Zustimmung",
    "cookie.body.2":
      "und werden niemals an Dritte weitergegeben. Lesen Sie unsere",
    "cookie.body.3": "für die vollständige versionierte Übersicht.",
    "cookie.and": "und unsere",
    "cookie.link.cookies": "Cookie-Richtlinie",
    "cookie.link.privacy": "Datenschutzerklärung",
    "cookie.btn.acceptAll": "Alle akzeptieren",
    "cookie.btn.rejectNonEssential": "Nicht notwendige ablehnen",
    "cookie.btn.customise": "Anpassen",
    "cookie.btn.back": "Zurück",
    "cookie.btn.save": "Einstellungen speichern",
    "cookie.toggle.required": "Erforderlich",
    "cookie.cat.strict.title": "Unbedingt erforderlich",
    "cookie.cat.strict.body":
      "Sitzungssicherheit, Lastverteilung und Speicherung der Einwilligung. Für den Betrieb der Plattform erforderlich.",
    "cookie.cat.analytics.title": "Analyse",
    "cookie.cat.analytics.body":
      "Serverseitige First-Party-Analyse, die uns hilft, die Plattform zu verbessern. Kein seitenübergreifendes Tracking.",
    "cookie.cat.marketing.title": "Marketing",
    "cookie.cat.marketing.body":
      "Wird nur verwendet, um zu erkennen, ob Sie über eine Kampagne kamen. Standardmäßig deaktiviert. Wir setzen keine Werbe-Pixel ein.",
  },
  fr: {
    "cookie.eyebrow": "Consentement aux cookies",
    "cookie.title": "Nous respectons votre souveraineté des données",
    "cookie.body.1":
      "IO SKY utilise des cookies strictement nécessaires pour sécuriser votre session. Les cookies analytiques et marketing sont",
    "cookie.body.optin": "uniquement avec consentement",
    "cookie.body.2":
      "et ne sont jamais partagés avec des annonceurs tiers. Consultez notre",
    "cookie.body.3": "pour l’enregistrement versionné complet.",
    "cookie.and": "et notre",
    "cookie.link.cookies": "politique de cookies",
    "cookie.link.privacy": "déclaration de confidentialité",
    "cookie.btn.acceptAll": "Tout accepter",
    "cookie.btn.rejectNonEssential": "Refuser le non essentiel",
    "cookie.btn.customise": "Personnaliser",
    "cookie.btn.back": "Retour",
    "cookie.btn.save": "Enregistrer les préférences",
    "cookie.toggle.required": "Requis",
    "cookie.cat.strict.title": "Strictement nécessaire",
    "cookie.cat.strict.body":
      "Sécurité de session, équilibrage de charge et persistance du consentement. Requis pour le fonctionnement de la plateforme.",
    "cookie.cat.analytics.title": "Analyse",
    "cookie.cat.analytics.body":
      "Analyses côté serveur de première partie pour améliorer la plateforme. Aucun pistage inter-sites.",
    "cookie.cat.marketing.title": "Marketing",
    "cookie.cat.marketing.body":
      "Utilisé uniquement pour mémoriser une arrivée via une campagne. Désactivé par défaut. Aucun pixel publicitaire.",
  },
  es: {
    "cookie.eyebrow": "Consentimiento de cookies",
    "cookie.title": "Respetamos tu soberanía de datos",
    "cookie.body.1":
      "IO SKY utiliza cookies estrictamente necesarias para mantener tu sesión segura. Las cookies analíticas y de marketing son",
    "cookie.body.optin": "solo con consentimiento",
    "cookie.body.2":
      "y nunca se comparten con anunciantes externos. Consulta nuestra",
    "cookie.body.3": "para el registro versionado completo.",
    "cookie.and": "y nuestro",
    "cookie.link.cookies": "Política de cookies",
    "cookie.link.privacy": "Aviso de privacidad",
    "cookie.btn.acceptAll": "Aceptar todo",
    "cookie.btn.rejectNonEssential": "Rechazar no esenciales",
    "cookie.btn.customise": "Personalizar",
    "cookie.btn.back": "Atrás",
    "cookie.btn.save": "Guardar preferencias",
    "cookie.toggle.required": "Obligatorio",
    "cookie.cat.strict.title": "Estrictamente necesarias",
    "cookie.cat.strict.body":
      "Seguridad de sesión, balanceo de carga y persistencia del consentimiento. Requeridas para el funcionamiento de la plataforma.",
    "cookie.cat.analytics.title": "Análisis",
    "cookie.cat.analytics.body":
      "Analítica propia del lado del servidor que nos ayuda a mejorar la plataforma. Sin rastreo entre sitios.",
    "cookie.cat.marketing.title": "Marketing",
    "cookie.cat.marketing.body":
      "Se usa solo para recordar si llegaste desde una campaña. Desactivado por defecto. Nunca usamos píxeles publicitarios.",
  },
  it: {
    "cookie.eyebrow": "Consenso ai cookie",
    "cookie.title": "Rispettiamo la sovranità dei tuoi dati",
    "cookie.body.1":
      "IO SKY utilizza cookie strettamente necessari per mantenere la tua sessione sicura. I cookie di analisi e marketing sono",
    "cookie.body.optin": "solo previo consenso",
    "cookie.body.2":
      "e non vengono mai condivisi con inserzionisti di terze parti. Consulta la nostra",
    "cookie.body.3": "per il registro versionato completo.",
    "cookie.and": "e la nostra",
    "cookie.link.cookies": "Politica sui cookie",
    "cookie.link.privacy": "Informativa sulla privacy",
    "cookie.btn.acceptAll": "Accetta tutti",
    "cookie.btn.rejectNonEssential": "Rifiuta non essenziali",
    "cookie.btn.customise": "Personalizza",
    "cookie.btn.back": "Indietro",
    "cookie.btn.save": "Salva preferenze",
    "cookie.toggle.required": "Obbligatorio",
    "cookie.cat.strict.title": "Strettamente necessari",
    "cookie.cat.strict.body":
      "Sicurezza della sessione, bilanciamento del carico e persistenza del consenso. Necessari per il funzionamento della piattaforma.",
    "cookie.cat.analytics.title": "Analisi",
    "cookie.cat.analytics.body":
      "Analytics first-party lato server che ci aiutano a migliorare la piattaforma. Nessun tracciamento tra siti.",
    "cookie.cat.marketing.title": "Marketing",
    "cookie.cat.marketing.body":
      "Usato solo per ricordare se sei arrivato da una campagna. Disattivato di default. Nessun pixel pubblicitario.",
  },
  ar: {
    "cookie.eyebrow": "موافقة ملفات تعريف الارتباط",
    "cookie.title": "نحن نحترم سيادتك على بياناتك",
    "cookie.body.1":
      "تستخدم IO SKY ملفات تعريف الارتباط الضرورية للحفاظ على أمان جلستك. ملفات التحليلات والتسويق",
    "cookie.body.optin": "اختيارية فقط",
    "cookie.body.2":
      "ولا تتم مشاركتها أبدًا مع جهات إعلانية خارجية. اطّلع على",
    "cookie.body.3": "للسجل الإصداري الكامل.",
    "cookie.and": "و",
    "cookie.link.cookies": "سياسة ملفات تعريف الارتباط",
    "cookie.link.privacy": "إشعار الخصوصية",
    "cookie.btn.acceptAll": "قبول الكل",
    "cookie.btn.rejectNonEssential": "رفض غير الضرورية",
    "cookie.btn.customise": "تخصيص",
    "cookie.btn.back": "رجوع",
    "cookie.btn.save": "حفظ التفضيلات",
    "cookie.toggle.required": "إلزامي",
    "cookie.cat.strict.title": "ضروري للغاية",
    "cookie.cat.strict.body":
      "أمان الجلسة وموازنة التحميل واستمرارية الموافقة. مطلوبة لتشغيل المنصة.",
    "cookie.cat.analytics.title": "التحليلات",
    "cookie.cat.analytics.body":
      "تحليلات على الخادم من الطرف الأول لمساعدتنا على تحسين المنصة. لا تتبع بين المواقع.",
    "cookie.cat.marketing.title": "التسويق",
    "cookie.cat.marketing.body":
      "تُستخدم فقط لمعرفة ما إذا وصلت من حملة تسويقية. معطلة افتراضيًا. لا نستخدم بكسلات إعلانية.",
  },
  ja: {
    "cookie.eyebrow": "Cookie の同意",
    "cookie.title": "あなたのデータ主権を尊重します",
    "cookie.body.1":
      "IO SKY はセッションの安全性と負荷分散のため、厳密に必要な Cookie のみを使用します。分析および マーケティング Cookie は",
    "cookie.body.optin": "オプトイン のみ",
    "cookie.body.2":
      "で、第三者の広告主と共有されることはありません。完全なバージョン管理記録については",
    "cookie.body.3": "をご覧ください。",
    "cookie.and": "および",
    "cookie.link.cookies": "Cookie ポリシー",
    "cookie.link.privacy": "プライバシー通知",
    "cookie.btn.acceptAll": "すべて受け入れる",
    "cookie.btn.rejectNonEssential": "必須以外を拒否",
    "cookie.btn.customise": "カスタマイズ",
    "cookie.btn.back": "戻る",
    "cookie.btn.save": "設定を保存",
    "cookie.toggle.required": "必須",
    "cookie.cat.strict.title": "厳密に必要",
    "cookie.cat.strict.body":
      "セッションのセキュリティ、ロードバランシング、および同意の永続化。プラットフォームの動作に必要です。",
    "cookie.cat.analytics.title": "分析",
    "cookie.cat.analytics.body":
      "プラットフォーム改善のためのファーストパーティーのサーバーサイド分析。クロスサイト追跡はありません。",
    "cookie.cat.marketing.title": "マーケティング",
    "cookie.cat.marketing.body":
      "キャンペーン経由の到達のみを記録します。デフォルトでは無効。広告ピクセルは使用しません。",
  },
  zh: {
    "cookie.eyebrow": "Cookie 同意",
    "cookie.title": "我们尊重您的数据主权",
    "cookie.body.1":
      "IO SKY 仅使用严格必要的 Cookie 来保持您的会话安全与负载均衡。分析与营销类 Cookie",
    "cookie.body.optin": "仅在同意后启用",
    "cookie.body.2":
      "且绝不与任何第三方广告商共享。请阅读我们的",
    "cookie.body.3": "以查看完整版本化记录。",
    "cookie.and": "和",
    "cookie.link.cookies": "Cookie 政策",
    "cookie.link.privacy": "隐私声明",
    "cookie.btn.acceptAll": "全部接受",
    "cookie.btn.rejectNonEssential": "拒绝非必要",
    "cookie.btn.customise": "自定义",
    "cookie.btn.back": "返回",
    "cookie.btn.save": "保存偏好",
    "cookie.toggle.required": "必需",
    "cookie.cat.strict.title": "严格必要",
    "cookie.cat.strict.body":
      "会话安全、负载均衡和同意持久化。平台运行所必需。",
    "cookie.cat.analytics.title": "分析",
    "cookie.cat.analytics.body":
      "第一方服务端分析,帮助我们改进平台。无跨站追踪。",
    "cookie.cat.marketing.title": "营销",
    "cookie.cat.marketing.body":
      "仅用于记录是否来自营销活动。默认关闭。我们从不使用广告像素。",
  },
};

let total = 0;
for (const [locale, kv] of Object.entries(COPY)) {
  const file = resolve(ROOT, `${locale}.ts`);
  let src;
  try {
    src = readFileSync(file, "utf-8");
  } catch {
    console.log(`skip ${locale}: no file`);
    continue;
  }
  const existingKeys = new Set();
  for (const m of src.matchAll(/"(cookie\.[^"]+)":/g)) existingKeys.add(m[1]);

  const lines = [];
  for (const [k, v] of Object.entries(kv)) {
    if (existingKeys.has(k)) continue;
    const escaped = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push(`  "${k}": "${escaped}",`);
  }
  if (lines.length === 0) {
    console.log(`${locale}: nothing to add`);
    continue;
  }
  const block = `\n  /* Cookie consent banner */\n${lines.join("\n")}\n`;
  // Insert before the final closing brace of the exported object
  const lastBraceIdx = src.lastIndexOf("};");
  if (lastBraceIdx === -1) {
    console.log(`skip ${locale}: cannot find closing brace`);
    continue;
  }
  const next = src.slice(0, lastBraceIdx) + block + src.slice(lastBraceIdx);
  writeFileSync(file, next);
  console.log(`${locale}: added ${lines.length} keys`);
  total += lines.length;
}
console.log(`\nDone. ${total} keys added across all locales.`);
