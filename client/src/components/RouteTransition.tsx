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
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { debugLog } from "@/lib/debugLog";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

export default function RouteTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
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
      debugLog.log("route_transition_reduced_motion");
      return;
    }
    // Start hidden, then reveal on the next frame so the transition runs.
    setVisible(false);
    let frameId: number | null = null;
    let isMounted = true;
    
    frameId = requestAnimationFrame(() => {
      if (isMounted) {
        debugLog.log("route_transition_frame_animate");
        setVisible(true);
      }
    });
    
    return () => {
      isMounted = false;
      if (frameId !== null) {
        debugLog.log("route_transition_cleanup");
        cancelAnimationFrame(frameId);
      }
    };
  }, [location]);

  const reduce = reduceRef.current;

  return (
    <div
      style={{
        opacity: reduce || visible ? 1 : 0,
        transform: reduce || visible ? "translateY(0)" : "translateY(8px)",
        transition: reduce
          ? undefined
          : `opacity 260ms ${EASE_OUT}, transform 260ms ${EASE_OUT}`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
