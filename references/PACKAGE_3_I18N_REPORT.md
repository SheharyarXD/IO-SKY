# Pakket 3 — 7-language i18n + RTL + ZH-CN

## Scope delivered

| Language | Code | Native | Direction | BCP47 |
| --- | --- | --- | --- | --- |
| English | EN | English | LTR | en-US |
| Nederlands | NL | Nederlands | LTR | nl-NL |
| Deutsch | DE | Deutsch | LTR | de-DE |
| Français | FR | Français | LTR | fr-FR |
| Español | ES | Español | LTR | es-ES |
| العربية | AR | العربية | **RTL** | ar-SA |
| 中文简体 | ZH | 中文简体 | LTR | zh-CN |
| 日本語 | JA | 日本語 | LTR | ja-JP |

Portuguese was retired from the active switcher (the `pt.ts` file is kept on disk so prior translations are not lost).

## What changed

- **New `client/src/lib/i18n/zh.ts`** with ~160 hand-translated keys covering nav, hero, problem, solution, pillars, ticker, footer, auth/MFA, and UI primitives. Falls back to EN for any remaining string.
- **`client/src/lib/i18n.ts` rewritten** to:
  - Register the 8 active locales with `bcp47` + `rtl` metadata
  - Detect both prefixed (`zh`) and full (`zh-cn`, `zh-hans`) navigator tags
  - Expose locale-aware formatters: `formatNumber`, `formatCurrency`, `formatDate`, `formatRelative`
  - Expose `isRTL(code)` and `bcp47For(code)` helpers
  - Provide an `allKeys()` audit helper for the parity test
- **EN parity pass** — 68 keys that were only present in other locales (auth.*, footer.bottom.*, hero.dash.*, hero.headline.*, pillars.*, problem.subtitle/title, scan.cta) now have professional English defaults so the `translate()` fallback always lands on real copy instead of the raw key.
- **`LanguageContext.tsx`** already sets `<html lang dir>` on every language change. Verified end-to-end with the AR locale.

## Tests

| File | Specs | Status |
| --- | --- | --- |
| `server/i18n.locale.test.ts` | 15 | ✅ |
| Full suite | 246 | ✅ |

The new specs cover:

1. The exact 8-language registry (catch accidental additions/removals)
2. AR is the only RTL locale
3. Every language exposes a BCP47 tag
4. `translate()` returns localized values, falls back to EN, then to key
5. Variable substitution mechanic
6. ZH dictionary contains the core nav / hero / ticker / problem / footer / auth keys
7. Every ZH value contains CJK characters (catches accidental copy-paste of EN)
8. Locale-aware number/currency/date/relative formatting
9. Defensive fallback when an invalid locale tag is supplied
10. **Dictionary parity** — every key in any locale must exist in EN, so the fallback path never returns the raw key in production

## Known issues / non-blocking debt

- NL/DE/FR/ES/AR/JA still inherit ~340 keys from EN (the new ticker.*, ui.*, solution.bullet.*, auth.*, hero.dash.*, hero.headline.*, pillars.*). The `translate()` fallback covers them silently in production, but tone-perfect copy still needs a native-speaker review per locale. These are tracked separately from this checkpoint.
- The legacy `client/src/lib/i18n/pt.ts` file remains for reference but is no longer wired into the switcher.

## Performance / security notes

- All formatters are thin `Intl.*` wrappers — no global memoisation, so switching language never returns stale formatters.
- The detection helper uses `navigator.languages` (not the IP address) — matches the existing privacy disclosure.
- The dictionary is loaded synchronously to avoid a flash of English on first paint.
- `translate()` is O(1) per key and resolves on the same tick as render.
