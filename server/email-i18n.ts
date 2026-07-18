/**
 * IO SKY — transactional email localisation.
 *
 * Provides translated copy for the three transactional emails:
 *   1. booking  — Discovery Call confirmation
 *   2. contact  — contact-form acknowledgement
 *   3. devapp   — Engineering Access application acknowledgement
 *
 * Nine production locales: EN, NL, DE, FR, ES, IT, AR (RTL), ZH, JA.
 * English is the canonical fallback. Each string set is intentionally flat so
 * server/email.ts can interpolate dynamic values (name, ref, etc.) at render
 * time. We keep copy concise and avoid any unverifiable legal/marketing claims.
 */

export type EmailLocale =
  | "EN" | "NL" | "DE" | "FR" | "ES" | "IT" | "AR" | "ZH" | "JA";

export const EMAIL_LOCALES: EmailLocale[] = [
  "EN", "NL", "DE", "FR", "ES", "IT", "AR", "ZH", "JA",
];

/** BCP-47 tag used by Intl.DateTimeFormat for the human-readable date line. */
export const BCP47: Record<EmailLocale, string> = {
  EN: "en-GB",
  NL: "nl-NL",
  DE: "de-DE",
  FR: "fr-FR",
  ES: "es-ES",
  IT: "it-IT",
  AR: "ar-SA",
  ZH: "zh-CN",
  JA: "ja-JP",
};

export function isRtl(locale: EmailLocale): boolean {
  return locale === "AR";
}

/**
 * Normalise an arbitrary locale-ish string (e.g. "nl", "nl-NL", "NL",
 * "zh-Hans") to one of our supported EmailLocale codes. Falls back to EN.
 */
export function normaliseLocale(raw: string | null | undefined): EmailLocale {
  if (!raw) return "EN";
  const head = raw.trim().toLowerCase().split(/[-_]/)[0];
  switch (head) {
    case "nl": return "NL";
    case "de": return "DE";
    case "fr": return "FR";
    case "es": return "ES";
    case "it": return "IT";
    case "ar": return "AR";
    case "zh": return "ZH";
    case "ja": return "JA";
    case "en": return "EN";
    default: return "EN";
  }
}

// ---------------------------------------------------------------------------
// Booking confirmation copy
// ---------------------------------------------------------------------------

export interface BookingStrings {
  eyebrow: string;
  heading: string;
  /** `{name}` and `{service}` placeholders. */
  intro: string;
  whenLabel: string;
  /** `{duration}` and `{tz}` placeholders. */
  durationTz: string;
  refLabel: string;
  operatorNote: string;
  reschedule: string;
  cancel: string;
  footerNote: string;
  subject: string; // `{ref}` placeholder
  textTitle: string;
}

const BOOKING_EN: BookingStrings = {
  eyebrow: "IO SKY · OPERATIONAL INTELLIGENCE",
  heading: "Your Discovery Call is booked.",
  intro:
    "Hi {name}, this is your confirmation for the {service}. A .ics calendar invite is attached to this email.",
  whenLabel: "When",
  durationTz: "Duration: {duration} minutes · Timezone: {tz}",
  refLabel: "Confirmation reference",
  operatorNote:
    "A senior operator from IO SKY will reach out 24 hours before the call with a secure meeting link and a short pre-read tailored to your context.",
  reschedule: "Reschedule",
  cancel: "Cancel",
  footerNote:
    "Need to reschedule? Use the secure link above, or reply to this email — we'll handle it.",
  subject: "IO SKY · Discovery Call confirmed ({ref})",
  textTitle: "Your IO SKY Discovery Call is booked.",
};

const BOOKING: Record<EmailLocale, BookingStrings> = {
  EN: BOOKING_EN,
  NL: {
    eyebrow: "IO SKY · OPERATIONELE INTELLIGENTIE",
    heading: "Je Discovery Call is ingepland.",
    intro:
      "Hoi {name}, dit is je bevestiging voor de {service}. Een .ics-agenda-uitnodiging is bijgevoegd.",
    whenLabel: "Wanneer",
    durationTz: "Duur: {duration} minuten · Tijdzone: {tz}",
    refLabel: "Bevestigingsreferentie",
    operatorNote:
      "Een senior operator van IO SKY neemt 24 uur voor het gesprek contact op met een beveiligde vergaderlink en een korte voorbereiding op maat.",
    reschedule: "Verzetten",
    cancel: "Annuleren",
    footerNote:
      "Wil je verzetten? Gebruik de beveiligde link hierboven of beantwoord deze e-mail — wij regelen het.",
    subject: "IO SKY · Discovery Call bevestigd ({ref})",
    textTitle: "Je IO SKY Discovery Call is ingepland.",
  },
  DE: {
    eyebrow: "IO SKY · OPERATIVE INTELLIGENZ",
    heading: "Ihr Strategiegespräch ist gebucht.",
    intro:
      "Hallo {name}, dies ist Ihre Bestätigung für das {service}. Eine .ics-Kalendereinladung ist beigefügt.",
    whenLabel: "Wann",
    durationTz: "Dauer: {duration} Minuten · Zeitzone: {tz}",
    refLabel: "Bestätigungsreferenz",
    operatorNote:
      "Ein leitender Mitarbeiter von IO SKY meldet sich 24 Stunden vor dem Gespräch mit einem sicheren Meeting-Link und einer kurzen, auf Ihren Kontext zugeschnittenen Vorbereitung.",
    reschedule: "Verschieben",
    cancel: "Stornieren",
    footerNote:
      "Müssen Sie verschieben? Nutzen Sie den sicheren Link oben oder antworten Sie auf diese E-Mail — wir kümmern uns darum.",
    subject: "IO SKY · Strategiegespräch bestätigt ({ref})",
    textTitle: "Ihr IO SKY Strategiegespräch ist gebucht.",
  },
  FR: {
    eyebrow: "IO SKY · INTELLIGENCE OPÉRATIONNELLE",
    heading: "Votre appel stratégique est réservé.",
    intro:
      "Bonjour {name}, voici votre confirmation pour le {service}. Une invitation calendrier .ics est jointe à cet e-mail.",
    whenLabel: "Quand",
    durationTz: "Durée : {duration} minutes · Fuseau horaire : {tz}",
    refLabel: "Référence de confirmation",
    operatorNote:
      "Un opérateur senior d'IO SKY vous contactera 24 heures avant l'appel avec un lien de réunion sécurisé et une courte préparation adaptée à votre contexte.",
    reschedule: "Reprogrammer",
    cancel: "Annuler",
    footerNote:
      "Besoin de reprogrammer ? Utilisez le lien sécurisé ci-dessus ou répondez à cet e-mail — nous nous en occupons.",
    subject: "IO SKY · Appel stratégique confirmé ({ref})",
    textTitle: "Votre appel stratégique IO SKY est réservé.",
  },
  ES: {
    eyebrow: "IO SKY · INTELIGENCIA OPERATIVA",
    heading: "Tu llamada estratégica está reservada.",
    intro:
      "Hola {name}, esta es tu confirmación para la {service}. Se adjunta una invitación de calendario .ics a este correo.",
    whenLabel: "Cuándo",
    durationTz: "Duración: {duration} minutos · Zona horaria: {tz}",
    refLabel: "Referencia de confirmación",
    operatorNote:
      "Un operador sénior de IO SKY se pondrá en contacto 24 horas antes de la llamada con un enlace de reunión seguro y una breve preparación adaptada a tu contexto.",
    reschedule: "Reprogramar",
    cancel: "Cancelar",
    footerNote:
      "¿Necesitas reprogramar? Usa el enlace seguro de arriba o responde a este correo — nos encargamos.",
    subject: "IO SKY · Llamada estratégica confirmada ({ref})",
    textTitle: "Tu llamada estratégica de IO SKY está reservada.",
  },
  IT: {
    eyebrow: "IO SKY · INTELLIGENZA OPERATIVA",
    heading: "La tua call strategica è prenotata.",
    intro:
      "Ciao {name}, questa è la conferma per la {service}. A questa email è allegato un invito al calendario .ics.",
    whenLabel: "Quando",
    durationTz: "Durata: {duration} minuti · Fuso orario: {tz}",
    refLabel: "Riferimento di conferma",
    operatorNote:
      "Un operatore senior di IO SKY ti contatterà 24 ore prima della call con un link sicuro alla riunione e una breve preparazione su misura per il tuo contesto.",
    reschedule: "Riprogramma",
    cancel: "Annulla",
    footerNote:
      "Devi riprogrammare? Usa il link sicuro qui sopra o rispondi a questa email — ci pensiamo noi.",
    subject: "IO SKY · Call strategica confermata ({ref})",
    textTitle: "La tua call strategica IO SKY è prenotata.",
  },
  AR: {
    eyebrow: "IO SKY · الذكاء التشغيلي",
    heading: "تم حجز مكالمتك الاستراتيجية.",
    intro:
      "مرحبًا {name}، هذا تأكيد حجزك لـ {service}. تم إرفاق دعوة تقويم .ics بهذا البريد.",
    whenLabel: "الموعد",
    durationTz: "المدة: {duration} دقيقة · المنطقة الزمنية: {tz}",
    refLabel: "مرجع التأكيد",
    operatorNote:
      "سيتواصل معك أحد كبار المختصين في IO SKY قبل المكالمة بـ 24 ساعة مع رابط اجتماع آمن وملخص قصير مخصّص لسياقك.",
    reschedule: "إعادة الجدولة",
    cancel: "إلغاء",
    footerNote:
      "بحاجة لإعادة الجدولة؟ استخدم الرابط الآمن أعلاه أو ردّ على هذا البريد — وسنتولى الأمر.",
    subject: "IO SKY · تم تأكيد المكالمة الاستراتيجية ({ref})",
    textTitle: "تم حجز مكالمتك الاستراتيجية مع IO SKY.",
  },
  ZH: {
    eyebrow: "IO SKY · 运营智能",
    heading: "您的战略通话已预约。",
    intro:
      "您好 {name}，这是您 {service} 的预约确认。本邮件已附带 .ics 日历邀请。",
    whenLabel: "时间",
    durationTz: "时长：{duration} 分钟 · 时区：{tz}",
    refLabel: "确认编号",
    operatorNote:
      "IO SKY 的资深顾问将在通话前 24 小时与您联系，提供安全的会议链接以及针对您情况的简要预读材料。",
    reschedule: "改期",
    cancel: "取消",
    footerNote:
      "需要改期？请使用上方的安全链接，或直接回复本邮件——我们会为您处理。",
    subject: "IO SKY · 战略通话已确认（{ref}）",
    textTitle: "您的 IO SKY 战略通话已预约。",
  },
  JA: {
    eyebrow: "IO SKY · オペレーショナルインテリジェンス",
    heading: "戦略コールのご予約が完了しました。",
    intro:
      "{name} 様、{service} のご予約確認です。本メールに .ics カレンダー招待を添付しています。",
    whenLabel: "日時",
    durationTz: "所要時間：{duration} 分 · タイムゾーン：{tz}",
    refLabel: "確認番号",
    operatorNote:
      "IO SKY のシニア担当者が、コールの24時間前に安全なミーティングリンクと、お客様の状況に合わせた簡単な事前資料をお送りします。",
    reschedule: "日程変更",
    cancel: "キャンセル",
    footerNote:
      "日程変更が必要ですか？上記の安全なリンクをご利用いただくか、本メールにご返信ください。こちらで対応いたします。",
    subject: "IO SKY · 戦略コール確定（{ref}）",
    textTitle: "IO SKY 戦略コールのご予約が完了しました。",
  },
};

// ---------------------------------------------------------------------------
// Contact acknowledgement copy
// ---------------------------------------------------------------------------

export interface ContactStrings {
  eyebrow: string;
  heading: string;
  intro: string; // `{name}` placeholder
  refLabel: string;
  subjectLabel: string;
  textTitle: string;
  textBody: string;
  subject: string; // `{ref}` placeholder
}

const CONTACT: Record<EmailLocale, ContactStrings> = {
  EN: {
    eyebrow: "IO SKY · OPERATIONAL INTELLIGENCE",
    heading: "We received your message.",
    intro:
      "Hi {name} — thank you for reaching out to IO SKY. A senior operator will respond within one business day with concrete next steps tailored to your context.",
    refLabel: "Reference",
    subjectLabel: "Subject",
    textTitle: "We received your message at IO SKY.",
    textBody: "A senior operator will respond within one business day.",
    subject: "IO SKY · We received your message ({ref})",
  },
  NL: {
    eyebrow: "IO SKY · OPERATIONELE INTELLIGENTIE",
    heading: "We hebben je bericht ontvangen.",
    intro:
      "Hoi {name} — bedankt voor je bericht aan IO SKY. Een senior operator reageert binnen één werkdag met concrete vervolgstappen op maat.",
    refLabel: "Referentie",
    subjectLabel: "Onderwerp",
    textTitle: "We hebben je bericht bij IO SKY ontvangen.",
    textBody: "Een senior operator reageert binnen één werkdag.",
    subject: "IO SKY · We hebben je bericht ontvangen ({ref})",
  },
  DE: {
    eyebrow: "IO SKY · OPERATIVE INTELLIGENZ",
    heading: "Wir haben Ihre Nachricht erhalten.",
    intro:
      "Hallo {name} — danke für Ihre Nachricht an IO SKY. Ein leitender Mitarbeiter antwortet innerhalb eines Werktags mit konkreten, auf Ihren Kontext zugeschnittenen nächsten Schritten.",
    refLabel: "Referenz",
    subjectLabel: "Betreff",
    textTitle: "Wir haben Ihre Nachricht bei IO SKY erhalten.",
    textBody: "Ein leitender Mitarbeiter antwortet innerhalb eines Werktags.",
    subject: "IO SKY · Wir haben Ihre Nachricht erhalten ({ref})",
  },
  FR: {
    eyebrow: "IO SKY · INTELLIGENCE OPÉRATIONNELLE",
    heading: "Nous avons bien reçu votre message.",
    intro:
      "Bonjour {name} — merci d'avoir contacté IO SKY. Un opérateur senior vous répondra sous un jour ouvré avec des prochaines étapes concrètes adaptées à votre contexte.",
    refLabel: "Référence",
    subjectLabel: "Objet",
    textTitle: "Nous avons bien reçu votre message chez IO SKY.",
    textBody: "Un opérateur senior vous répondra sous un jour ouvré.",
    subject: "IO SKY · Nous avons reçu votre message ({ref})",
  },
  ES: {
    eyebrow: "IO SKY · INTELIGENCIA OPERATIVA",
    heading: "Hemos recibido tu mensaje.",
    intro:
      "Hola {name} — gracias por contactar con IO SKY. Un operador sénior responderá en un día hábil con próximos pasos concretos adaptados a tu contexto.",
    refLabel: "Referencia",
    subjectLabel: "Asunto",
    textTitle: "Hemos recibido tu mensaje en IO SKY.",
    textBody: "Un operador sénior responderá en un día hábil.",
    subject: "IO SKY · Hemos recibido tu mensaje ({ref})",
  },
  IT: {
    eyebrow: "IO SKY · INTELLIGENZA OPERATIVA",
    heading: "Abbiamo ricevuto il tuo messaggio.",
    intro:
      "Ciao {name} — grazie per aver contattato IO SKY. Un operatore senior ti risponderà entro un giorno lavorativo con prossimi passi concreti su misura per il tuo contesto.",
    refLabel: "Riferimento",
    subjectLabel: "Oggetto",
    textTitle: "Abbiamo ricevuto il tuo messaggio in IO SKY.",
    textBody: "Un operatore senior ti risponderà entro un giorno lavorativo.",
    subject: "IO SKY · Abbiamo ricevuto il tuo messaggio ({ref})",
  },
  AR: {
    eyebrow: "IO SKY · الذكاء التشغيلي",
    heading: "لقد استلمنا رسالتك.",
    intro:
      "مرحبًا {name} — شكرًا لتواصلك مع IO SKY. سيردّ عليك أحد كبار المختصين خلال يوم عمل واحد بخطوات تالية ملموسة مخصّصة لسياقك.",
    refLabel: "المرجع",
    subjectLabel: "الموضوع",
    textTitle: "لقد استلمنا رسالتك في IO SKY.",
    textBody: "سيردّ عليك أحد كبار المختصين خلال يوم عمل واحد.",
    subject: "IO SKY · لقد استلمنا رسالتك ({ref})",
  },
  ZH: {
    eyebrow: "IO SKY · 运营智能",
    heading: "我们已收到您的留言。",
    intro:
      "您好 {name}——感谢您联系 IO SKY。资深顾问将在一个工作日内回复，并提供针对您情况的具体后续步骤。",
    refLabel: "编号",
    subjectLabel: "主题",
    textTitle: "我们已在 IO SKY 收到您的留言。",
    textBody: "资深顾问将在一个工作日内回复。",
    subject: "IO SKY · 我们已收到您的留言（{ref}）",
  },
  JA: {
    eyebrow: "IO SKY · オペレーショナルインテリジェンス",
    heading: "メッセージを受け取りました。",
    intro:
      "{name} 様 — IO SKY へお問い合わせいただきありがとうございます。シニア担当者が1営業日以内に、お客様の状況に合わせた具体的な次のステップとともにご返信します。",
    refLabel: "参照番号",
    subjectLabel: "件名",
    textTitle: "IO SKY にてメッセージを受け取りました。",
    textBody: "シニア担当者が1営業日以内にご返信します。",
    subject: "IO SKY · メッセージを受け取りました（{ref}）",
  },
};

// ---------------------------------------------------------------------------
// Engineering Access acknowledgement copy
// ---------------------------------------------------------------------------

export interface DevAppStrings {
  eyebrow: string;
  heading: string;
  intro: string; // `{name}` placeholder
  refLabel: string;
  ndaNote: string;
  subject: string; // `{ref}` placeholder
  textBody: string; // `{ref}` placeholder
}

const DEVAPP: Record<EmailLocale, DevAppStrings> = {
  EN: {
    eyebrow: "IO SKY · ENGINEERING ACCESS",
    heading: "Application received.",
    intro:
      "Hi {name} — your application to the IO SKY Engineering Access programme has been received. The principal engineering team reviews every application personally; you'll hear back within 5 business days.",
    refLabel: "Reference",
    ndaNote:
      "Your NDA, confidentiality, and non-solicitation acknowledgements are on file under this reference.",
    subject: "IO SKY · Engineering Access application received ({ref})",
    textBody:
      "IO SKY Engineering Access — application received.\n\nReference: {ref}\n\nThe principal engineering team will respond within 5 business days.",
  },
  NL: {
    eyebrow: "IO SKY · ENGINEERING ACCESS",
    heading: "Aanvraag ontvangen.",
    intro:
      "Hoi {name} — je aanvraag voor het IO SKY Engineering Access-programma is ontvangen. Het hoofd-engineeringteam beoordeelt elke aanvraag persoonlijk; je hoort binnen 5 werkdagen van ons.",
    refLabel: "Referentie",
    ndaNote:
      "Je NDA-, vertrouwelijkheids- en non-solicitatieverklaringen zijn onder deze referentie vastgelegd.",
    subject: "IO SKY · Engineering Access-aanvraag ontvangen ({ref})",
    textBody:
      "IO SKY Engineering Access — aanvraag ontvangen.\n\nReferentie: {ref}\n\nHet hoofd-engineeringteam reageert binnen 5 werkdagen.",
  },
  DE: {
    eyebrow: "IO SKY · ENGINEERING ACCESS",
    heading: "Bewerbung erhalten.",
    intro:
      "Hallo {name} — Ihre Bewerbung für das IO SKY Engineering-Access-Programm ist eingegangen. Das leitende Engineering-Team prüft jede Bewerbung persönlich; Sie hören innerhalb von 5 Werktagen von uns.",
    refLabel: "Referenz",
    ndaNote:
      "Ihre NDA-, Vertraulichkeits- und Abwerbeverbots-Erklärungen sind unter dieser Referenz hinterlegt.",
    subject: "IO SKY · Engineering-Access-Bewerbung erhalten ({ref})",
    textBody:
      "IO SKY Engineering Access — Bewerbung erhalten.\n\nReferenz: {ref}\n\nDas leitende Engineering-Team antwortet innerhalb von 5 Werktagen.",
  },
  FR: {
    eyebrow: "IO SKY · ACCÈS INGÉNIERIE",
    heading: "Candidature reçue.",
    intro:
      "Bonjour {name} — votre candidature au programme IO SKY Engineering Access a été reçue. L'équipe d'ingénierie principale examine personnellement chaque candidature ; vous aurez une réponse sous 5 jours ouvrés.",
    refLabel: "Référence",
    ndaNote:
      "Vos engagements de NDA, de confidentialité et de non-sollicitation sont enregistrés sous cette référence.",
    subject: "IO SKY · Candidature Engineering Access reçue ({ref})",
    textBody:
      "IO SKY Engineering Access — candidature reçue.\n\nRéférence : {ref}\n\nL'équipe d'ingénierie principale répondra sous 5 jours ouvrés.",
  },
  ES: {
    eyebrow: "IO SKY · ACCESO DE INGENIERÍA",
    heading: "Solicitud recibida.",
    intro:
      "Hola {name} — tu solicitud al programa IO SKY Engineering Access ha sido recibida. El equipo principal de ingeniería revisa cada solicitud personalmente; tendrás respuesta en un plazo de 5 días hábiles.",
    refLabel: "Referencia",
    ndaNote:
      "Tus acuerdos de NDA, confidencialidad y no captación quedan registrados bajo esta referencia.",
    subject: "IO SKY · Solicitud de Engineering Access recibida ({ref})",
    textBody:
      "IO SKY Engineering Access — solicitud recibida.\n\nReferencia: {ref}\n\nEl equipo principal de ingeniería responderá en 5 días hábiles.",
  },
  IT: {
    eyebrow: "IO SKY · ACCESSO INGEGNERIA",
    heading: "Candidatura ricevuta.",
    intro:
      "Ciao {name} — la tua candidatura al programma IO SKY Engineering Access è stata ricevuta. Il team di ingegneria principale esamina personalmente ogni candidatura; riceverai una risposta entro 5 giorni lavorativi.",
    refLabel: "Riferimento",
    ndaNote:
      "I tuoi accordi di NDA, riservatezza e non sollecitazione sono registrati con questo riferimento.",
    subject: "IO SKY · Candidatura Engineering Access ricevuta ({ref})",
    textBody:
      "IO SKY Engineering Access — candidatura ricevuta.\n\nRiferimento: {ref}\n\nIl team di ingegneria principale risponderà entro 5 giorni lavorativi.",
  },
  AR: {
    eyebrow: "IO SKY · وصول الهندسة",
    heading: "تم استلام الطلب.",
    intro:
      "مرحبًا {name} — تم استلام طلبك للانضمام إلى برنامج IO SKY Engineering Access. يراجع فريق الهندسة الرئيسي كل طلب شخصيًا، وستصلك ردّنا خلال 5 أيام عمل.",
    refLabel: "المرجع",
    ndaNote:
      "تم تسجيل إقراراتك الخاصة باتفاقية عدم الإفشاء والسرية وعدم الاستقطاب تحت هذا المرجع.",
    subject: "IO SKY · تم استلام طلب Engineering Access ({ref})",
    textBody:
      "IO SKY Engineering Access — تم استلام الطلب.\n\nالمرجع: {ref}\n\nسيردّ فريق الهندسة الرئيسي خلال 5 أيام عمل.",
  },
  ZH: {
    eyebrow: "IO SKY · 工程访问",
    heading: "已收到申请。",
    intro:
      "您好 {name}——我们已收到您加入 IO SKY 工程访问计划的申请。首席工程团队会亲自审阅每一份申请，您将在 5 个工作日内收到回复。",
    refLabel: "编号",
    ndaNote:
      "您的保密协议、保密义务及不招揽承诺已在此编号下存档。",
    subject: "IO SKY · 已收到工程访问申请（{ref}）",
    textBody:
      "IO SKY 工程访问——已收到申请。\n\n编号：{ref}\n\n首席工程团队将在 5 个工作日内回复。",
  },
  JA: {
    eyebrow: "IO SKY · エンジニアリングアクセス",
    heading: "申請を受け付けました。",
    intro:
      "{name} 様 — IO SKY エンジニアリングアクセス プログラムへのお申し込みを受け付けました。主任エンジニアリングチームがすべての申請を直接確認し、5営業日以内にご連絡します。",
    refLabel: "参照番号",
    ndaNote:
      "お客様の NDA・秘密保持・非勧誘に関する同意は、この参照番号で記録されています。",
    subject: "IO SKY · エンジニアリングアクセス申請を受領（{ref}）",
    textBody:
      "IO SKY エンジニアリングアクセス — 申請を受領しました。\n\n参照番号：{ref}\n\n主任エンジニアリングチームが5営業日以内にご返信します。",
  },
};

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export function bookingStrings(locale: EmailLocale): BookingStrings {
  return BOOKING[locale] ?? BOOKING_EN;
}
export function contactStrings(locale: EmailLocale): ContactStrings {
  return CONTACT[locale] ?? CONTACT.EN;
}
export function devAppStrings(locale: EmailLocale): DevAppStrings {
  return DEVAPP[locale] ?? DEVAPP.EN;
}

/** Simple `{token}` interpolation. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}
