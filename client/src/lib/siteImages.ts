/**
 * Central registry for the website's editorial visuals.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * Eleven hero/section images were hardcoded across seven pages, all pointing at
 * the Manus/Forge CDN (`d2xsxph8kpxj0f.cloudfront.net`). That host now returns
 * **403 for every asset** — the images are gone, and no archived copy exists in
 * the Supabase `branding` bucket (which holds only the logo, mark and favicon)
 * or anywhere in this repository.
 *
 * This is the exact risk Milestone 1 §1.3 flagged: "urgently archive branding
 * assets while the Forge proxy still resolves". The logo survived because the
 * client supplied it directly; these eleven did not.
 *
 * ── Why a registry rather than eleven replacement URLs ─────────────────────
 *
 * The Milestone 2 feedback (item 9) is explicit on two points:
 *
 *   "A number of visuals currently used on the website are from earlier
 *    iterations and should not be considered final approved visuals... please
 *    avoid spending unnecessary time polishing the existing legacy visuals."
 *
 *   "The implementation should ultimately allow those visuals to be replaced
 *    cleanly without disrupting the surrounding layout."
 *
 * So hunting for lookalike replacements would be wasted work, and scattering
 * URLs through page files is precisely what makes replacement disruptive.
 * Every visual is named here once. Supplying a real image is a one-line change
 * in this file — or an environment variable, with no code change at all.
 *
 * Until one is supplied, `resolveSiteImage` returns null and the consuming
 * component renders a deliberate placeholder rather than a broken-image icon.
 */

/** Every editorial visual the site references, by logical name. */
export type SiteImageKey =
  | "about.founders"
  | "about.workspace"
  | "aiScan.hero"
  | "aiScan.reportFree"
  | "aiScan.reportGrowth"
  | "aiScan.reportElite"
  | "booking.consultation"
  | "enterprise.systems"
  | "enterprise.architecture"
  | "intelligence.hero"
  | "login.globe";

/**
 * Human-readable labels. Used for the placeholder caption and `alt` text, so
 * an unsupplied visual still describes what belongs there — which is useful
 * both for accessibility and for whoever is producing the replacements.
 */
export const SITE_IMAGE_LABELS: Record<SiteImageKey, string> = {
  "about.founders": "IO SKY founding team",
  "about.workspace": "IO SKY operational workspace",
  "aiScan.hero": "AI Scan overview",
  "aiScan.reportFree": "AI Scan — Free report preview",
  "aiScan.reportGrowth": "AI Scan — Growth report preview",
  "aiScan.reportElite": "AI Scan — Elite report preview",
  "booking.consultation": "Strategic consultation session",
  "enterprise.systems": "Enterprise systems architecture",
  "enterprise.architecture": "Enterprise integration architecture",
  "intelligence.hero": "Operational intelligence layer",
  "login.globe": "IO SKY global operations",
};

/**
 * Supplied replacements.
 *
 * Deliberately empty. Every entry is currently unavailable, and inventing a
 * stand-in URL would reintroduce the same problem in a new place — a link that
 * looks configured but resolves to nothing.
 *
 * To supply one, either add it here:
 *
 *     "aiScan.hero": "https://<project>.supabase.co/storage/v1/object/public/site/ai-scan-hero.webp",
 *
 * or set the matching environment variable (see `envKeyFor`), which needs no
 * code change and is preferable while visuals are still being iterated on.
 *
 * Prefer the Supabase `branding` bucket over a third-party CDN — the CSP
 * already allows `*.supabase.co`, and it is storage the client owns. A new
 * host also needs adding to `imgSrc` in server/_core/securityHeaders.ts, or
 * the browser will block it in production.
 */
const SUPPLIED: Partial<Record<SiteImageKey, string>> = {};

/**
 * Environment-variable name for a given visual.
 * `aiScan.hero` -> `VITE_IMG_AISCAN_HERO`
 */
export function envKeyFor(key: SiteImageKey): string {
  return `VITE_IMG_${key.replace(/\./g, "_").replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`;
}

/**
 * Resolve a visual to a URL, or null when none has been supplied.
 *
 * Order: environment override, then the in-code registry. Returning null
 * rather than a fallback URL is the point — a caller that gets null renders a
 * placeholder, and the site never ships an <img> pointing at a dead host.
 */
export function resolveSiteImage(key: SiteImageKey): string | null {
  // Vite inlines import.meta.env at build time, so this is a static lookup
  // rather than a runtime environment read.
  const fromEnv = (import.meta.env as Record<string, string | undefined>)[envKeyFor(key)];
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();

  const supplied = SUPPLIED[key];
  if (supplied && supplied.trim().length > 0) return supplied.trim();

  return null;
}

/** Which visuals are still missing. Surfaced by a test so the count cannot drift silently. */
export function missingSiteImages(): SiteImageKey[] {
  return (Object.keys(SITE_IMAGE_LABELS) as SiteImageKey[]).filter(
    (k) => resolveSiteImage(k) === null,
  );
}
