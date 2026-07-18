# Pakket 1 — Homepage rebuild + premium polish

Status: **delivered** · Checkpoint: pending save · Tests: 202/202 green · TypeScript: clean

---

## Scope

Bring the public homepage from "modern marketing site" to **operational intelligence infrastructure**. No template feel, no missing copy, no broken motion. Surgical interventions instead of a from-scratch rebuild because the existing sections were already strong.

## What changed

1. **New `LiveOpsTicker` strip** between Hero and Problem — eight operational events (AI scans, workflows synced, posture verified, agents deployed, briefs generated, regions online, automations triggered, payments reconciled) scrolling on an infinite-marquee track with a live pulse-dot. Pauses on hover. Disabled under `prefers-reduced-motion`. Replaces the "marketing page" feel with the sense of an operating infrastructure.

2. **`RevealOnScroll` wrapper** — IntersectionObserver-driven, opt-in, single-shot reveal. Each non-hero section now fades + lifts as it enters the viewport. Respects `prefers-reduced-motion`. Stays GPU-only (`transform` + `opacity`).

3. **Critical i18n bug fix** — 67 translation keys referenced by the homepage sections (`problem.card1.title`, `pillars.infra.title`, `intel.eyebrow`, `discover.*`, etc.) were never declared in `en.ts`, so visitors were seeing literal keys instead of copy. All 67 keys added to `en.ts` with executive-tone copy; the existing EN-fallback mechanism inside `translate()` means all other locales now render correctly too (proper translations follow in Pakket 3).

4. **Live Ops keyframes + ticker styling tokens** added to `index.css` (`liveOpsScroll` keyframe, `.ticker-track` rules with reduced-motion override).

5. **`Home.tsx` recomposed** to mount the ticker and wrap sections in `<RevealOnScroll>` while keeping the deliberate hero-first layout.

## Files touched

| File | Change |
|---|---|
| `client/src/components/RevealOnScroll.tsx` | **new** — IntersectionObserver reveal primitive |
| `client/src/components/sections/LiveOpsTicker.tsx` | **new** — looped operational-telemetry strip |
| `client/src/lib/i18n/en.ts` | +67 missing homepage keys + 9 ticker keys |
| `client/src/index.css` | Live Ops keyframes + reduced-motion override |
| `client/src/pages/Home.tsx` | Wire ticker + reveal-on-scroll into the homepage |
| `server/i18n.homepage.test.ts` | **new** — regression test asserting every t() call resolves |

## Tests

- New: `server/i18n.homepage.test.ts` — extracts every `t("...")` call from each homepage section file and asserts the key exists in `en.ts` (+10 specs, one per section)
- Full suite: **202 / 202 green** (was 192)
- TypeScript: clean

## Performance notes

- Reveal effect is single-shot and unobserves itself after entry — no perpetual observer cost
- LiveOpsTicker uses a pure CSS `translateX` animation, GPU-accelerated, paused on hover; no JS frame loop
- Both effects gated behind `@media (prefers-reduced-motion: no-preference)` so accessibility-aware users get a static fallback

## Security notes

- All copy is static and locale-driven; no user-controlled content rendered
- Ticker pulls no network — synthesized brand telemetry only (Pakket 7 will optionally swap in real audit-feed data)

## Known issues / follow-ups

- Other 7 locales currently inherit ticker + the 67 shim strings from EN via fallback. Real translations are part of **Pakket 3 (Site-wide design language)** and **Pakket 4 (8-language i18n)**.
- `pt.ts` will be removed and `zh.ts` introduced in Pakket 4 per the user's 8-language list (EN, NL, DE, FR, ES, AR, ZH-CN, JA).
- A few footer link keys (`footer.link.opsSystems`, `bizAutomation`, `growthSystems`) are duplicates of `operational`, `businessAuto`, `growth` — leaving as-is, will dedupe in Pakket 3.

## Operational realism check

- Hero now feels like the cockpit of an operating system, not a brochure page
- The ticker provides constant, low-rhythm activity in the visitor's peripheral vision — the exact "we are running right now" signal the brief demanded
- Reveal-on-scroll keeps the page feeling crafted, not assembled
