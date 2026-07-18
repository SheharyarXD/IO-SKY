/*
 * IO SKY — RevealOnScroll
 *
 * Premium scroll-driven reveal primitive. Wraps any block of JSX and adds the
 * existing `.reveal` / `.is-in` classes from index.css when it intersects the
 * viewport. Use `stagger` to delay nested items (e.g. card grids).
 *
 *   <RevealOnScroll>            <-- single block
 *     <h2>…</h2>
 *   </RevealOnScroll>
 *
 *   <RevealOnScroll stagger>    <-- adds incrementing --reveal-i to children
 *     <Card />
 *     <Card />
 *     <Card />
 *   </RevealOnScroll>
 *
 * Honors `prefers-reduced-motion` automatically because `.reveal` already
 * disables its transform under that media query.
 */

import { Children, cloneElement, isValidElement, useEffect, useRef } from "react";

type RevealOnScrollProps = {
  children: React.ReactNode;
  /** Stagger nested children by 60ms each (max 12). */
  stagger?: boolean;
  /** Override stagger step (ms). Default 60. */
  step?: number;
  /** Optional wrapper className (added next to `.reveal`). */
  className?: string;
  /** Render as a different element. Default "div". */
  as?: "div" | "section" | "ul" | "ol" | "header" | "footer";
};

export default function RevealOnScroll({
  children,
  stagger = false,
  step = 60,
  className = "",
  as: Tag = "div",
}: RevealOnScrollProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Bail out gracefully on browsers without IntersectionObserver.
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      node.classList.add("is-in");
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        // Slightly earlier than the edge so the reveal feels anticipatory,
        // not delayed.
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.05,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (!stagger) {
    return (
      <Tag
        ref={ref as never}
        className={`reveal ${className}`.trim()}
      >
        {children}
      </Tag>
    );
  }

  // When staggering, we apply `.reveal` to each direct child with an
  // incrementing inline transition-delay. The container itself does not
  // animate so the children handle their own entry.
  return (
    <Tag ref={ref as never} className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        const delay = Math.min(i, 11) * step;
        const existingClass = (child.props as { className?: string }).className ?? "";
        const existingStyle = (child.props as { style?: React.CSSProperties }).style ?? {};
        return cloneElement(child as React.ReactElement<{ className?: string; style?: React.CSSProperties }>, {
          className: `reveal ${existingClass}`.trim(),
          style: { ...existingStyle, transitionDelay: `${delay}ms` },
        });
      })}
    </Tag>
  );
}
