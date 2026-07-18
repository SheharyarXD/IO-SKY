/**
 * IO SKY — Premium logo loading animation.
 *
 * Two render modes:
 *   • inline  — small (32–48px) inline spinner replacement; pairs with submit buttons.
 *   • overlay — full-viewport blurred backdrop with centered master logo, for route
 *               transitions and async heavy work.
 *
 * Animation language:
 *   • Master logo is rendered desaturated at low opacity as a base layer.
 *   • A second clipped copy is animated from left → right with a 1.6s ease-out,
 *     reaching full opacity and the brand orange accent. This produces the
 *     "gradual orange fill" motion the brand sheet specifies.
 *   • Respects `prefers-reduced-motion` (animation disabled, static state shown).
 *
 * FIX (2026-06-22): Removed the inline <style> tag that used Math.random() to generate
 * unique animation names. React 18 concurrent rendering + window.location.href hard
 * navigation caused a removeChild crash because the browser destroyed the DOM before
 * React could unmount the <style> node. All keyframes are now in index.css under
 * stable class names (iosky-loader-*), eliminating the crash entirely.
 */

const PRIMARY_SRC = "/manus-storage/iosky-logo-transparent_6a55c203.png";
const RATIO = 1386 / 388; // ≈ 3.57 transparent trimmed lockup width:height

type Props = {
  /** Render mode. Default `inline`. */
  mode?: "inline" | "overlay";
  /** Pixel height for inline mode. Default 32. */
  size?: number;
  /** Optional message rendered under the logo in overlay mode. */
  message?: string;
  /** Optional className for the root element. */
  className?: string;
};

export default function LogoLoader({
  mode = "inline",
  size = 32,
  message,
  className,
}: Props) {
  const width = Math.round(size * RATIO);

  // Use static CSS class names defined in index.css — no inline <style> tags.
  // This prevents the React 18 removeChild crash caused by hard navigation
  // (window.location.href) destroying the DOM before React can unmount.
  const logoBlock = (
    <div
      className={"relative inline-block " + (className ?? "")}
      style={{ width, height: size }}
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
    >
      <img
        src={PRIMARY_SRC}
        alt=""
        width={width}
        height={size}
        draggable={false}
        className="iosky-loader-base select-none pointer-events-none absolute inset-0"
        style={{ width, height: size }}
      />
      <img
        src={PRIMARY_SRC}
        alt=""
        width={width}
        height={size}
        draggable={false}
        className="iosky-loader-sweep select-none pointer-events-none"
        style={{ width, height: size }}
      />
    </div>
  );

  if (mode === "inline") return logoBlock;

  // Overlay mode
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center backdrop-blur-md bg-[rgba(8,10,14,0.72)]"
    >
      {logoBlock}
      {message ? (
        <div className="mt-5 text-[12px] uppercase tracking-[0.24em] text-neutral-300/80">
          {message}
        </div>
      ) : null}
    </div>
  );
}
