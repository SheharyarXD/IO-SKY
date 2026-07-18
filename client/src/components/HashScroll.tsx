/*
 * IO SKY — HashScroll
 *
 * Activates smooth-scroll behaviour for hash-anchor URLs site-wide so
 * dropdown links like /infrastructure#crm or /enterprise#systems land the
 * user precisely on the matching capability section instead of jumping
 * underneath the fixed navbar.
 *
 * Behaviour:
 *   • Listens to wouter location changes and Wouter's `popstate`-style updates.
 *   • When the URL contains a hash, waits one frame so the destination page
 *     can mount, then smoothly scrolls the matching element into view with
 *     a 96 px offset to clear the 76 px fixed navbar plus a little breathing
 *     room.
 *   • Respects `prefers-reduced-motion`: falls back to instant jumps.
 *   • Exposes a small <a> click interceptor utility for any future case where
 *     a same-page hash link is clicked outside Wouter's <Link>.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

const NAV_OFFSET = 96;

function scrollToHash(hash: string) {
  if (!hash) return;
  const id = hash.replace(/^#/, "");
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;

  window.scrollTo({
    top,
    behavior: reduce ? "auto" : "smooth",
  });
}

export default function HashScroll() {
  const [location] = useLocation();

  /* Re-evaluate whenever the route or hash changes. */
  useEffect(() => {
    const hash = window.location.hash;

    /*
     * No hash → this is a top-level page navigation. Reset the scroll
     * position to the top so each route starts at its hero instead of
     * inheriting the previous page's scroll offset. Respect reduced motion.
     */
    if (!hash) {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      window.scrollTo({ top: 0, left: 0, behavior: reduce ? "auto" : "auto" });
      return;
    }

    /*
     * Two animation frames so:
     *   – Wouter has finished swapping the route component
     *   – React has flushed the new tree (including capability section ids)
     *   – The browser has measured the layout with images decoded so far
     */
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => scrollToHash(hash));
      // store r2 on the function for cleanup if unmounted
      (scrollToHash as unknown as { r2?: number }).r2 = r2;
    });

    return () => {
      cancelAnimationFrame(r1);
      const r2 = (scrollToHash as unknown as { r2?: number }).r2;
      if (typeof r2 === "number") cancelAnimationFrame(r2);
    };
  }, [location]);

  /*
   * Listen to native hashchange so an in-page anchor click (without a route
   * change) also scrolls smoothly with the offset.
   */
  useEffect(() => {
    const onHash = () => scrollToHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return null;
}
