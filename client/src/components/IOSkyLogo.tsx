/*
 * IO SKY — Official logo component.
 *
 * Milestone 2 §2.1 update: the original brand assets only ever existed as
 * remote objects in the old Forge storage (no copy anywhere in this repo),
 * which blocked migrating off the `/manus-storage/*` proxy — see
 * MILESTONE2_PROGRESS.md's §2.1 section for the full history. The client
 * has now supplied the real official logo file directly; it was
 * transparency-keyed (solid dark-navy/black background removed, content
 * tightly trimmed) and uploaded to the Supabase `branding` bucket this
 * migration already provisioned (drizzle/0007_storage_buckets.sql), so
 * branding assets are finally served from real project storage instead of
 * the legacy Forge proxy.
 *
 *   • PRIMARY  — mark + "IO SKY" wordmark (no tagline). Use across navbar,
 *                footer, hero and any horizontal lockup. Min wordmark width: 120px.
 *   • MARK     — Icon Only. Use for compact UI (avatars, app cards). Min: 24px.
 *   • FAVICON  — square mark, padded for browser tab and app icons.
 *
 * Trimmed transparent dimensions:
 *   primary 1473×414 px (≈ 3.558:1)  ·  mark 840×781 px (≈ 1.076:1)
 *
 * Assets are fully transparent PNGs and render correctly on BOTH light and
 * dark surfaces. They contain the orange #FF7A00 swoosh + white ink —
 * #FF7A00 is the real brand orange sampled directly from this logo file
 * (see client/src/index.css's `--orange` token and
 * server/designLanguage.test.ts for where that value is pinned).
 */
import { cn } from "@/lib/utils";

// Public Supabase Storage URLs for the real official assets (uploaded via
// server/storage.ts's storagePut, same `branding` bucket / hashed-key
// convention every other upload in this app already uses). Built from
// VITE_SUPABASE_URL (already required client-side for Supabase Auth) with a
// hardcoded fallback to the current project so a missing env var degrades
// to "logo doesn't load" rather than crashing the app.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://rhgzcgcqlypuvislwjlf.supabase.co";
const BRANDING_BASE = `${SUPABASE_URL}/storage/v1/object/public/branding`;

// Exported so LogoLoader.tsx and EcosystemOverview.tsx (the two other
// direct-<img>-src consumers of the master lockup/mark) share the exact
// same URLs rather than re-deriving them — one source of truth for the
// hashed storage keys.
export const PRIMARY_SRC = `${BRANDING_BASE}/iosky-logo-transparent_80bb9d7a.png`;
export const MARK_SRC    = `${BRANDING_BASE}/iosky-mark-transparent_7be4140c.png`;
export const FAVICON_SRC = `${BRANDING_BASE}/iosky-favicon-transparent_195f8316.png`;

const PRIMARY_RATIO = 1473 / 414; // ≈ 3.558 (transparent trimmed lockup)
const MARK_RATIO    = 840 / 781;  // ≈ 1.076 (transparent trimmed mark)

type Variant = "primary" | "mark" | "favicon";

interface IOSkyLogoProps {
  className?: string;
  /**
   * Pre-canned size scales. Calibrated for the wider 3.57:1 transparent
   * lockup so the rendered WIDTH stays close to the previous brand sizing
   * (the new lockup is wider per unit height, so heights are reduced).
   *
   *   • sm — 24 px tall → ≈ 86 px wide (navbar, dense UI).
   *   • md — 30 px tall → ≈ 107 px wide (default navbar / footer).
   *   • lg — 40 px tall → ≈ 143 px wide (hero / auth surfaces).
   *   • xl — 56 px tall → ≈ 200 px wide (marketing modules).
   */
  size?: "sm" | "md" | "lg" | "xl";
  /** Override the rendered *height* in pixels (overrides `size`). */
  height?: number;
  /** Choose which official lockup to render. */
  variant?: Variant;
  /** Legacy alias — `markOnly` maps to variant="mark". */
  markOnly?: boolean;
}

// Sizes calibrated for the 3.57:1 transparent lockup so the rendered WIDTH
// (not height) matches the previous brand footprint and never overflows the navbar.
const sizeMap: Record<NonNullable<IOSkyLogoProps["size"]>, number> = {
  sm: 24,
  md: 30,
  lg: 40,
  xl: 56,
};

export function IOSkyLogo({
  className,
  size = "md",
  height,
  variant,
  markOnly,
}: IOSkyLogoProps) {
  const v: Variant = variant ?? (markOnly ? "mark" : "primary");
  const src = v === "favicon" ? FAVICON_SRC : v === "mark" ? MARK_SRC : PRIMARY_SRC;
  const ratio = v === "primary" ? PRIMARY_RATIO : MARK_RATIO;

  // Enforce minimum-sizing rules calibrated for the 3.57:1 transparent lockup:
  //   • mark    ≥ 22 px tall
  //   • primary ≥ 20 px tall (so the wordmark stays ≥ ~72 px wide)
  const requested = height ?? sizeMap[size];
  const minH = v === "primary" ? 20 : 22;
  const px = Math.max(requested, minH);
  const widthPx = Math.round(px * ratio);

  return (
    <img
      src={src}
      alt="IO SKY"
      draggable={false}
      width={widthPx}
      height={px}
      style={{ height: `${px}px`, width: `${widthPx}px` }}
      className={cn("block select-none pointer-events-none", className)}
    />
  );
}

export default IOSkyLogo;
