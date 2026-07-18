# Pakket 2 — Site-wide design language pass

Status: **delivered** · Tests: 231/231 green · TypeScript: clean

## Scope
Canonical primitives so every IO SKY surface (homepage, admin, client portal, developer workspace, auth, MFA) speaks the same visual language. No more ad-hoc utility stacks.

## What changed
1. **Canonical CSS tokens** added to `index.css`:
   - `.io-surface`, `.io-surface-glass`, `.io-card` (glass + hover-lift baked in)
   - `.io-section` (responsive vertical rhythm)
   - `.io-empty-state` + `.io-empty-icon` (uniform empty state)
   - `.io-icon-chip` + `.io-icon-chip-sm` (consistent icon containers)
   - `.io-divider` + `.io-divider-vertical`
   - `.io-pill`, `.io-pill-success`, `.io-pill-danger`, `.io-pill-warn`, `.io-pill-orange`
2. **RTL-safe motion** — explicit `[dir="rtl"] .reveal` rules so Arabic doesn't break the reveal transform.
3. **`<EmptyState>` React primitive** (`client/src/components/EmptyState.tsx`) wrapping the empty-state token.
4. **ModuleStateBoundary upgrade** — admin module empty/forbidden states now use `EmptyState`, error state uses the design token, all 18 modules inherit it instantly.

## Tests
- New: `server/designLanguage.test.ts` (+29 specs) asserting every canonical token, brand orange `#FF6A00`, reduced-motion compliance, RTL reveal hook
- Full suite: **231 / 231 green** (was 202)
- TypeScript: clean

## Performance / accessibility
- All hover transitions GPU-only (`transform` + `opacity` + `box-shadow`)
- `prefers-reduced-motion: reduce` disables the hover lift and ticker animation
- Empty states get `role="status" aria-live="polite"`; error states get `role="alert"`

## Known follow-ups
- The 19 module pages still use inline tailwind for their custom panels; subsequent passes can migrate them to `.io-card` for free hover-lift. Visual delta is minor.
- `client/src/components/EmptyState.tsx` is admin-friendly today; widening usage to client portal and developer workspace lists is part of Pakket 3 continuation.
