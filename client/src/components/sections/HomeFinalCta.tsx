/*
 * IO SKY — Homepage · Final CTA section (master design spec §2.9).
 */
import { Link } from "wouter";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function HomeFinalCta() {
  const { t } = useT();
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="max-w-[680px] mx-auto text-center">
          <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
            {t("home.finalCta.title")}
          </h2>
          <div className="mt-8 space-y-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)] text-left">
            <p>{t("home.finalCta.body1")}</p>
            <p>{t("home.finalCta.body2")}</p>
            <p className="text-[var(--color-ivory)]">{t("home.finalCta.body3")}</p>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
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
