/**
 * IO SKY — Localization core.
 *
 * Enterprise-first language strategy:
 *  1. If the user has previously selected a language, that wins. Stored in
 *     localStorage under "iosky.lang".
 *  2. Otherwise, detect from `navigator.language` (e.g. "ja-JP" → "JA",
 *     "zh-Hans" → "ZH").
 *  3. If no supported language is detected, default to English.
 *
 * Active languages: EN, NL, DE, FR, ES, IT, PT, AR (RTL), ZH-CN, JA.
 *
 * Translations are loaded synchronously so first paint is always in the right
 * language and there is no flash of English.
 */
import { en } from "./i18n/en";
import { nl } from "./i18n/nl";
import { de } from "./i18n/de";
import { fr } from "./i18n/fr";
import { es } from "./i18n/es";
import { ar } from "./i18n/ar";
import { ja } from "./i18n/ja";
import { zh } from "./i18n/zh";
import { it } from "./i18n/it";
import { pt } from "./i18n/pt";

export type LangCode = "EN" | "NL" | "DE" | "FR" | "ES" | "IT" | "PT" | "AR" | "JA" | "ZH";

export interface LangMeta {
  code: LangCode;
  native: string;
  english: string;
  rtl?: boolean;
  /** ISO 639-1 / BCP47 prefixes used by navigator.language */
  detect: string[];
  /** BCP47 tag used for Intl.NumberFormat / Intl.DateTimeFormat */
  bcp47: string;
}

export const LANGUAGES: LangMeta[] = [
  { code: "EN", native: "English",    english: "English",     detect: ["en"],          bcp47: "en-US" },
  { code: "NL", native: "Nederlands", english: "Dutch",       detect: ["nl"],          bcp47: "nl-NL" },
  { code: "DE", native: "Deutsch",    english: "German",      detect: ["de"],          bcp47: "de-DE" },
  { code: "FR", native: "Français",   english: "French",      detect: ["fr"],          bcp47: "fr-FR" },
  { code: "ES", native: "Español",    english: "Spanish",     detect: ["es"],          bcp47: "es-ES" },
  { code: "IT", native: "Italiano",   english: "Italian",     detect: ["it"],          bcp47: "it-IT" },
  { code: "PT", native: "Português",  english: "Portuguese",  detect: ["pt", "pt-br", "pt-pt"], bcp47: "pt-PT" },
  { code: "AR", native: "العربية",     english: "Arabic",      detect: ["ar"], rtl: true, bcp47: "ar-SA" },
  { code: "ZH", native: "中文简体",     english: "Chinese",     detect: ["zh", "zh-cn", "zh-hans"], bcp47: "zh-CN" },
  { code: "JA", native: "日本語",       english: "Japanese",    detect: ["ja"],          bcp47: "ja-JP" },
];

const DICTS: Record<LangCode, Record<string, string>> = {
  EN: en, NL: nl, DE: de, FR: fr, ES: es, IT: it, PT: pt, AR: ar, JA: ja, ZH: zh,
};

const STORAGE_KEY = "iosky.lang";

export function detectInitialLanguage(): LangCode {
  if (typeof window === "undefined") return "EN";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as LangCode | null;
    if (saved && DICTS[saved]) return saved;
  } catch {
    /* ignore */
  }
  const candidates = (
    (navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || "en"]) as string[]
  ).map((l) => l.toLowerCase());
  for (const cand of candidates) {
    // Try full match first (e.g. zh-hans), then prefix (e.g. zh)
    const full = cand;
    const prefix = cand.split("-")[0];
    const hit = LANGUAGES.find((lang) =>
      lang.detect.some((p) => p === full || p === prefix),
    );
    if (hit) return hit.code;
  }
  return "EN";
}

export function persistLanguage(code: LangCode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

/**
 * Translate a key. Falls back to English, then to the key itself, so the UI
 * never shows blank labels even if a key is missing in a locale.
 *
 * Supports simple `{name}` placeholder substitution:
 *   t("hero.greeting", { name: "Alex" })
 */
export function translate(
  lang: LangCode,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTS[lang] || DICTS.EN;
  const raw = dict[key] ?? DICTS.EN[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/** Return the union of all keys across every language — used by /translations. */
export function allKeys(): string[] {
  const keys = new Set<string>();
  Object.values(DICTS).forEach((d) => Object.keys(d).forEach((k) => keys.add(k)));
  return Array.from(keys).sort();
}

export function dictFor(code: LangCode): Record<string, string> {
  return DICTS[code];
}

export function isRTL(code: LangCode): boolean {
  return Boolean(LANGUAGES.find((l) => l.code === code)?.rtl);
}

export function bcp47For(code: LangCode): string {
  return LANGUAGES.find((l) => l.code === code)?.bcp47 ?? "en-US";
}

// ─── Locale-aware formatters ──────────────────────────────────────────────
// Every formatter is a thin Intl wrapper that keeps the BCP47 mapping in
// one place. We deliberately don't memoize the formatters — modern V8 caches
// Intl.* objects internally, and we'd rather not hold onto stale tags after
// the user switches language.

export function formatNumber(
  lang: LangCode,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(bcp47For(lang), options).format(value);
  } catch {
    return String(value);
  }
}

export function formatCurrency(
  lang: LangCode,
  value: number,
  currency: string = "EUR",
): string {
  return formatNumber(lang, value, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

export function formatDate(
  lang: LangCode,
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(bcp47For(lang), options ?? {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(value);
  } catch {
    return new Date(value).toISOString();
  }
}

export function formatRelative(
  lang: LangCode,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
): string {
  try {
    return new Intl.RelativeTimeFormat(bcp47For(lang), {
      numeric: "auto",
    }).format(value, unit);
  } catch {
    return `${value} ${unit}`;
  }
}
