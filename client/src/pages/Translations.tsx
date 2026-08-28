/*
 * IO SKY — /translations
 *
 * Review page surfacing every UI string across all seven supported locales in
 * one auditable table. Built in the official IO SKY design language: dark navy
 * #0B1020 background, glass panels, ivory text, controlled orange interaction
 * states, mono eyebrow row.
 *
 * Capabilities:
 *  - Search across keys and values (case-insensitive, debounced via state)
 *  - Inline editing of any cell (changes held in client state — no backend yet)
 *  - One-click export of the edited dictionary per locale as JSON
 *  - Reset to source-of-truth (English baseline + bundled locale files)
 *  - Highlights missing translations (cell falls back to English with badge)
 *  - Fully responsive: horizontal scroll on narrow screens
 */
import { useMemo, useState } from "react";
import { Search, Download, RotateCcw, Languages } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { useT } from "@/contexts/LanguageContext";
import { LANGUAGES, allKeys, dictFor, type LangCode } from "@/lib/i18n";

type DictMap = Record<LangCode, Record<string, string>>;

function bundledDicts(): DictMap {
  const out = {} as DictMap;
  LANGUAGES.forEach((l) => {
    out[l.code] = { ...dictFor(l.code) };
  });
  return out;
}

export default function Translations() {
  const { t } = useT();
  const keys = useMemo(() => allKeys(), []);
  const [dicts, setDicts] = useState<DictMap>(() => bundledDicts());
  const [query, setQuery] = useState("");

  const filteredKeys = useMemo(() => {
    if (!query.trim()) return keys;
    const q = query.toLowerCase();
    return keys.filter((k) => {
      if (k.toLowerCase().includes(q)) return true;
      return LANGUAGES.some((l) =>
        (dicts[l.code][k] || "").toLowerCase().includes(q),
      );
    });
  }, [keys, query, dicts]);

  function setCell(code: LangCode, key: string, value: string) {
    setDicts((prev) => ({
      ...prev,
      [code]: { ...prev[code], [key]: value },
    }));
  }

  function resetAll() {
    setDicts(bundledDicts());
    toast.success("Reset to source-of-truth", {
      description: "All edits cleared. Bundled locale files restored.",
    });
  }

  function exportLocale(code: LangCode) {
    const payload = JSON.stringify(dicts[code], null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iosky-${code.toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${code}`, {
      description: `Downloaded iosky-${code.toLowerCase()}.json`,
    });
  }

  const totalKeys = keys.length;
  const completeness = useMemo(() => {
    return LANGUAGES.map((l) => {
      const dict = dicts[l.code];
      const filled = keys.filter((k) => dict[k] && dict[k].trim().length > 0).length;
      return {
        code: l.code,
        native: l.native,
        filled,
        pct: Math.round((filled / totalKeys) * 100),
      };
    });
  }, [dicts, keys, totalKeys]);

  return (
    <PageShell
      eyebrowIndex="07"
      eyebrowLabel={t("translations.eyebrow")}
      title={t("translations.title")}
      intro={t("translations.body")}
      aside={
        <div className="flex flex-col gap-3 items-end">
          <button
            onClick={resetAll}
            className="btn-secondary !text-[12.5px] !py-2 !px-3.5"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            Reset to source
          </button>
          <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#E6EAF0]/45">
            {totalKeys} keys · {LANGUAGES.length} locales
          </div>
        </div>
      }
    >
      {/* Completeness strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {completeness.map((c) => (
          <div
            key={c.code}
            className="glass-soft rounded-lg p-3.5 border border-white/[0.06]"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#E6EAF0]/55">
                {c.code}
              </span>
              <span
                className={[
                  "text-[11px] font-mono",
                  c.pct === 100 ? "text-emerald-300" : "text-[var(--color-orange)]",
                ].join(" ")}
              >
                {c.pct}%
              </span>
            </div>
            <div className="mt-1.5 text-[13px] font-display text-[#E6EAF0]">
              {c.native}
            </div>
            <div className="mt-2 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${c.pct}%`,
                  background:
                    c.pct === 100
                      ? "linear-gradient(90deg,#34D399,#10B981)"
                      : "linear-gradient(90deg,#FF7A00,#FFB347)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="glass-soft rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3 mb-6 border border-white/[0.06]">
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#E6EAF0]/40"
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("translations.search")}
            className="w-full bg-[#0B1020]/60 border border-white/[0.08] focus:border-[var(--color-orange)]/50 focus:outline-none rounded-lg pl-10 pr-3 py-2.5 text-[13.5px] text-[#E6EAF0] placeholder:text-[#E6EAF0]/35 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Languages className="w-4 h-4 text-[#E6EAF0]/45" strokeWidth={1.75} />
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => exportLocale(l.code)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] hover:border-[var(--color-orange)]/50 hover:bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] font-mono uppercase tracking-[0.12em] text-[#E6EAF0]/75 hover:text-[var(--color-ivory)] transition-colors"
              title={`Export ${l.native}`}
            >
              <Download className="w-3 h-3" strokeWidth={2} />
              {l.code}
            </button>
          ))}
        </div>
      </div>

      {/* Translations table */}
      <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.08]">
                <th className="text-left sticky left-0 z-[2] bg-[#0F1626] border-r border-white/[0.06] px-4 py-3 text-[10.5px] font-mono uppercase tracking-[0.16em] text-[#E6EAF0]/55 min-w-[220px]">
                  Key
                </th>
                {LANGUAGES.map((l) => (
                  <th
                    key={l.code}
                    className="text-left px-3 py-3 text-[10.5px] font-mono uppercase tracking-[0.16em] text-[#E6EAF0]/55 min-w-[220px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-orange)]">{l.code}</span>
                      <span className="text-[#E6EAF0]/40 normal-case tracking-normal text-[11px] font-sans">
                        {l.native}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredKeys.length === 0 && (
                <tr>
                  <td
                    colSpan={LANGUAGES.length + 1}
                    className="px-4 py-12 text-center text-[#E6EAF0]/45"
                  >
                    No keys match “{query}”.
                  </td>
                </tr>
              )}
              {filteredKeys.map((key, idx) => (
                <tr
                  key={key}
                  className={[
                    "border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors",
                    idx % 2 === 1 ? "bg-white/[0.008]" : "",
                  ].join(" ")}
                >
                  <td className="sticky left-0 z-[1] bg-[#0F1626] border-r border-white/[0.06] px-4 py-2.5 font-mono text-[11.5px] text-[#E6EAF0]/85 align-top">
                    {key}
                  </td>
                  {LANGUAGES.map((l) => {
                    const value = dicts[l.code][key] || "";
                    const isMissing = !value.trim();
                    return (
                      <td
                        key={l.code}
                        className="px-2.5 py-2 align-top"
                      >
                        <div className="relative">
                          <textarea
                            value={value}
                            onChange={(e) => setCell(l.code, key, e.target.value)}
                            dir={l.rtl ? "rtl" : "ltr"}
                            rows={1}
                            className={[
                              "w-full resize-y min-h-[36px] rounded-md px-2.5 py-1.5",
                              "bg-transparent border focus:outline-none transition-colors",
                              "text-[13px] leading-[1.5] text-[#E6EAF0]",
                              isMissing
                                ? "border-rose-400/40 bg-rose-400/[0.04]"
                                : "border-white/[0.06] focus:border-[var(--color-orange)]/45 focus:bg-white/[0.02]",
                            ].join(" ")}
                          />
                          {isMissing && (
                            <span className="absolute -top-1.5 right-1 text-[9px] font-mono uppercase tracking-[0.14em] text-rose-300/80 bg-[#0B1020] px-1 rounded">
                              missing
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-6 text-[12px] text-[#E6EAF0]/45 leading-[1.6] max-w-[720px]">
        Edits made on this page are held in the browser session only. Use the
        per-locale Download buttons to export the corrected dictionary as JSON,
        which can then be committed into{" "}
        <code className="font-mono text-[#E6EAF0]/65">
          client/src/lib/i18n/&lt;lang&gt;.ts
        </code>{" "}
        as the new source of truth.
      </p>
    </PageShell>
  );
}
