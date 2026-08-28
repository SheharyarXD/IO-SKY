/*
 * IO SKY — Shared layout for every secondary route.
 * Enforces the homepage design language: navy #0B1020 background, controlled
 * orange eyebrow, Manrope display H1, ivory body, soft atmospheric glow.
 */
import { useEffect, type ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import SectionEyebrow from "./SectionEyebrow";

interface Props {
  eyebrowIndex: string;
  eyebrowLabel: string;
  title: ReactNode;
  intro?: ReactNode;
  /** Optional aside slot beside the title (e.g. a CTA cluster). */
  aside?: ReactNode;
  children: ReactNode;
}

export function PageShell({ eyebrowIndex, eyebrowLabel, title, intro, aside, children }: Props) {
  useEffect(() => {
    // HashScroll handles hash navigation; only reset to top when no hash.
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0B1020] text-[#E6EAF0]">
      {/* Atmospheric backdrop — same recipe as Home so every page sits in the same air */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          backgroundImage: `
            radial-gradient(58% 36% at 16% 14%, rgba(255, 122, 0,0.10), transparent 70%),
            radial-gradient(46% 32% at 92% 0%, rgba(80,140,255,0.08), transparent 70%),
            radial-gradient(80% 50% at 50% 100%, rgba(255, 122, 0,0.06), transparent 70%)
          `,
        }}
      />
      <Navbar />
      <main className="relative z-[1] pt-32 md:pt-40 pb-24 page-enter">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
            <div className="lg:col-span-8">
              <SectionEyebrow index={eyebrowIndex} label={eyebrowLabel} />
              <h1 className="mt-6 text-[40px] md:text-[56px] lg:text-[64px] leading-[1.04] font-display font-semibold tracking-[-0.022em] text-[#E6EAF0] text-balance">
                {title}
              </h1>
              {intro && (
                <p className="mt-6 text-[16.5px] leading-[1.65] text-[#E6EAF0]/65 max-w-[640px] text-pretty">
                  {intro}
                </p>
              )}
            </div>
            {aside && (
              <div className="lg:col-span-4 flex lg:justify-end">{aside}</div>
            )}
          </div>
          <div className="mt-12 md:mt-16">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default PageShell;
