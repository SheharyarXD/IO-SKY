/*
 * IO SKY — CTA band.
 * Calm, high-contrast cap for any secondary page. Renders the brand mark on
 * the left as a watermark, an editorial headline, and the two primary CTAs.
 */
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import IOSkyLogo from "./IOSkyLogo";

interface Props {
  eyebrow?: string;
  title?: string;
  body?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function CTABand({
  eyebrow = "READY WHEN YOU ARE",
  title = "Make operational intelligence the default.",
  body = "Book a 30-minute discovery session with an IO SKY operator, or run a free AI Scan to see exactly where your operation can compound.",
  primaryHref = "/book-strategy",
  primaryLabel = "Book Discovery Call",
  secondaryHref = "/ai-scan",
  secondaryLabel = "Start Free AI Scan",
}: Props) {
  return (
    <section className="relative mt-24 md:mt-32">
      <div className="glass-strong relative overflow-hidden p-8 md:p-12 lg:p-14">
        {/* watermark mark */}
        <div className="pointer-events-none absolute -right-8 -bottom-10 opacity-[0.07]">
          <IOSkyLogo variant="mark" size="xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-[1]">
          <div className="lg:col-span-7">
            <div className="eyebrow">
              <span className="text-[#FF6A00]">99</span>
              <span className="opacity-50">/</span>
              <span>{eyebrow}</span>
            </div>
            <h2 className="mt-5 font-display font-semibold text-[28px] md:text-[36px] lg:text-[40px] leading-[1.08] tracking-[-0.02em] text-[#E6EAF0] text-balance">
              {title}
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[#E6EAF0]/65 max-w-[540px]">
              {body}
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:justify-end gap-3">
            <Link href={primaryHref} className="btn-primary">
              {primaryLabel}
              <ArrowUpRight size={16} strokeWidth={2.2} />
            </Link>
            <Link href={secondaryHref} className="btn-secondary">
              <Sparkles size={15} strokeWidth={2} />
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CTABand;
