/**
 * Renders an editorial visual, or a deliberate placeholder when none has been
 * supplied yet.
 *
 * The eleven legacy visuals all pointed at the dead Manus/Forge CDN and now
 * return 403. Left as plain <img> tags they render as broken-image icons —
 * which looks like a bug in the site rather than a known, tracked gap, and is
 * a poor thing to put in front of a client mid-review.
 *
 * The placeholder holds the exact layout the real image will occupy, so
 * dropping in a replacement changes nothing around it. That is the property
 * the Milestone 2 feedback asked for: "the implementation should ultimately
 * allow those visuals to be replaced cleanly without disrupting the
 * surrounding layout."
 *
 * It also handles the case where a *supplied* URL fails at runtime — a broken
 * link in a later batch degrades to the same placeholder rather than to a
 * broken icon.
 */
import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveSiteImage,
  SITE_IMAGE_LABELS,
  type SiteImageKey,
} from "@/lib/siteImages";

export function SiteImage({
  image,
  alt,
  className,
  imgClassName,
  loading = "lazy",
  width,
  height,
  decoding,
  fetchPriority,
}: {
  image: SiteImageKey;
  /** Overrides the registry label when the surrounding copy needs something specific. */
  alt?: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  /**
   * Intrinsic dimensions. Passed through to the <img> and mirrored onto the
   * placeholder's aspect ratio, so the box reserves the same space either way —
   * without them a supplied image would shift the layout on load, which is the
   * disruption the whole registry exists to avoid.
   */
  width?: number;
  height?: number;
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const src = resolveSiteImage(image);
  const label = alt ?? SITE_IMAGE_LABELS[image];
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2",
          "bg-white/[0.02] border border-white/[0.06]",
          className,
        )}
        // Not aria-hidden: the caption names what belongs here, which is
        // genuinely useful to a screen-reader user and to whoever is
        // producing the replacement visuals.
        role="img"
        aria-label={`${label} — visual pending`}
        data-site-image={image}
        data-state="placeholder"
        style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
      >
        <ImageIcon className="h-5 w-5 text-white/20" strokeWidth={1.5} aria-hidden="true" />
        <span className="px-4 text-center text-[11px] leading-snug text-white/30">{label}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      loading={loading}
      onError={() => setFailed(true)}
      width={width}
      height={height}
      decoding={decoding}
      fetchPriority={fetchPriority}
      data-site-image={image}
      data-state="loaded"
      className={cn("h-full w-full object-cover", imgClassName, className)}
    />
  );
}

export default SiteImage;
