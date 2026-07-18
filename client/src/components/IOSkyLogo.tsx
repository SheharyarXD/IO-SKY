/*
 * IO SKY — Official logo component.
 * Sources the assets cropped from the official Brand Sheet:
 *
 *   • PRIMARY  — mark + "IO SKY" wordmark (no tagline). Use across navbar,
 *                footer, hero and any horizontal lockup. Min wordmark width: 120px.
 *   • MARK     — Icon Only. Use for compact UI (avatars, app cards). Min: 24px.
 *   • FAVICON  — square mark, padded for browser tab and app icons.
 *
 * Trimmed transparent dimensions:
 *   primary 1386×388 px (≈ 3.57:1)  ·  mark 399×388 px (≈ 1.03:1)
 *
 * Assets are fully transparent PNGs (black background removed 2026-06-02) and
 * render correctly on BOTH light and dark surfaces. They contain the orange
 * #FF6A00 swoosh + ivory #E6EAF0 ink.
 */
import { cn } from "@/lib/utils";

// 2026-06-02: transparent-background master logo (black background removed at
// the founder's request). Tightly trimmed transparent PNGs derived from the
// uploaded master mark — safe to render on light OR dark surfaces.
const PRIMARY_SRC = "/manus-storage/iosky-logo-transparent_6a55c203.png";
// Official IO symbol mark (transparent) — used across operational surfaces.
const MARK_SRC    = "/manus-storage/iosky-mark-transparent_9aba89cd.png";
const FAVICON_SRC = "/manus-storage/iosky-favicon-transparent_403fabca.png";

const PRIMARY_RATIO = 1386 / 388; // ≈ 3.57 (transparent trimmed lockup)
const MARK_RATIO    = 399 / 388;  // ≈ 1.03 (transparent trimmed mark)

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
