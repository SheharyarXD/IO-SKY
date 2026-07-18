/**
 * IO SKY — Language context.
 *
 * Wraps the entire app and exposes the current language code, a setter, and
 * a memoised `t(key)` translation function via the `useT()` hook.
 *
 * Also writes `lang` + `dir` on `<html>` so RTL languages (Arabic) flip the
 * page direction without needing component-level changes.
 */
import {
  createContext, useContext, useEffect, useMemo, useState, ReactNode,
} from "react";
import {
  LangCode, detectInitialLanguage, isRTL, persistLanguage, translate,
} from "@/lib/i18n";

interface LanguageContextValue {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => detectInitialLanguage());

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.setAttribute("lang", lang.toLowerCase());
    html.setAttribute("dir", isRTL(lang) ? "rtl" : "ltr");
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    setLang: (code) => {
      persistLanguage(code);
      setLangState(code);
    },
    t: (key, vars) => translate(lang, key, vars),
    dir: isRTL(lang) ? "rtl" : "ltr",
  }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useT must be used inside <LanguageProvider>");
  }
  return ctx;
}
