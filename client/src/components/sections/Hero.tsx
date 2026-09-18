/*
 * IO SKY — Hero.
 * Per IO_SKY_Homepage_Developer_Orange_Emphasis PDF §01: a single open
 * editorial column — headline, body, two CTAs. No dashboard mockup, trust
 * strip or decorative graphic; the PDF's hero has none of those, and orange
 * is reserved for the one meaning-bearing line ("business works.").
 * Every visible string is read through useT() so the entire hero re-renders
 * when the user changes language.
 */
import { Link } from "wouter";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function Hero() {
  const { t } = useT();
  const accent = t("hero.title.accent");

  return (
    <section className="relative pt-32 md:pt-36 lg:pt-40 pb-20 md:pb-28 overflow-hidden">
      <div className="container relative">
        <div className="max-w-[820px]">
          <h1 className="font-display font-semibold text-[34px] sm:text-[44px] md:text-[56px] lg:text-[64px] leading-[1.04] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
            {t("hero.title.part1")}
            {accent && (
              <>
                <br />
                <span className="text-[var(--color-orange)]">{accent}</span>
              </>
            )}
            <br />
            {t("hero.title.part2")}
          </h1>

          <p className="mt-8 max-w-[660px] text-[18px] md:text-[20px] leading-[1.6] text-[var(--io-text-secondary,oklch(0.78_0.014_250))]">
            {t("hero.body")}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/book-strategy" className="btn-primary">
              {t("hero.cta.book")}
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </Link>
            <Link href="/ai-scan" className="btn-secondary">
              {t("hero.cta.scan")}
              <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
