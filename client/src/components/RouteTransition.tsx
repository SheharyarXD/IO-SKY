/*
 * IO SKY — RouteTransition
 *
 * Wraps the routed page tree and applies a subtle, GPU-friendly entrance
 * (opacity + small upward translate) every time the top-level route path
 * changes. This gives navigation a deliberate, "crafted" feel without
 * animating layout-affecting properties.
 *
 * Design notes:
 *   • Only `opacity` and `transform` are animated (compositor-only).
 *   • Hash-only changes (e.g. /infrastructure#crm) do NOT retrigger the
 *     transition — we key on pathname, so in-page anchor jumps stay instant.
 *   • Respects `prefers-reduced-motion`: the wrapper renders fully visible
 *     with no transform and no transition.
 *   • Duration is kept under 300ms with a snappy ease-out, per the motion
 *     guidelines.
 *   • CRITICAL: the wrapper clears `transform` and `will-change` once the
 *     entrance finishes, and must keep doing so. A transform (even an
 *     identity one) or a non-auto `will-change` on an element makes it the
 *     containing block for every `position: fixed` DESCENDANT. Because this
 *     wrapper contains the whole routed tree, leaving them applied at rest
 *     re-anchored every fixed element in the app to a ~9700px page wrapper
 *     instead of the viewport. The site header stopped being fixed and
 *     scrolled away with the page, and the mobile nav drawer, sized
 *     `top-[68px] bottom-0`, became as tall as the document, which pushed its
 *     language buttons and its two calls to action below the fold with no way
 *     to reach them. Both were reported as separate visual bugs; they were
 *     the same line of CSS.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { debugLog } from "@/lib/debugLog";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const TRANSITION_MS = 260;

export default function RouteTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  /**
   * True once the entrance has finished and the wrapper is back to being a
   * plain, untransformed box. See the containing-block note in the header.
   */
  const [settled, setSettled] = useState(true);
  const reduceRef = useRef<boolean>(false);

  useEffect(() => {
    reduceRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useEffect(() => {
    debugLog.log("route_transition_change", { pathname: location });
    if (reduceRef.current) {
      setVisible(true);
      setSettled(true);
      debugLog.log("route_transition_reduced_motion");
      return;
    }
    // Start hidden, then reveal on the next frame so the transition runs.
    setVisible(false);
    setSettled(false);
    let frameId: number | null = null;
    let settleId: number | null = null;
    let isMounted = true;

    frameId = requestAnimationFrame(() => {
      if (isMounted) {
        debugLog.log("route_transition_frame_animate");
        setVisible(true);
      }
    });

    // Drop the transform and will-change once the entrance is over, so the
    // wrapper stops being the containing block for the app's fixed elements.
    // A timer rather than `transitionend`: that event does not fire if the
    // transition is interrupted or never starts, and a wrapper stuck in the
    // transformed state would silently break the header again.
    settleId = window.setTimeout(() => {
      if (isMounted) setSettled(true);
    }, TRANSITION_MS + 60);

    return () => {
      isMounted = false;
      if (frameId !== null) {
        debugLog.log("route_transition_cleanup");
        cancelAnimationFrame(frameId);
      }
      if (settleId !== null) window.clearTimeout(settleId);
    };
  }, [location]);

  const reduce = reduceRef.current;

  // At rest the wrapper must be a completely plain box: no transform, no
  // will-change, no transition. `undefined` rather than "none" for transform
  // so React removes the declaration entirely.
  const atRest = reduce || settled;

  return (
    <div
      style={{
        opacity: reduce || visible ? 1 : 0,
        transform: atRest ? undefined : visible ? "translateY(0)" : "translateY(8px)",
        transition: atRest
          ? undefined
          : `opacity ${TRANSITION_MS}ms ${EASE_OUT}, transform ${TRANSITION_MS}ms ${EASE_OUT}`,
        willChange: atRest ? undefined : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
