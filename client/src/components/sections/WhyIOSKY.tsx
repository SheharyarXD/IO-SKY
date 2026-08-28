/*
 * IO SKY — Homepage · "Why IO SKY" section (master design spec §2.7).
 */
import { useT } from "@/contexts/LanguageContext";

export default function WhyIOSKY() {
  const { t } = useT();
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="max-w-[680px] mx-auto text-center">
          <h2 className="font-display font-semibold text-[26px] md:text-[32px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
            {t("home.why.title1")}
            <br />
            <span className="text-[var(--color-orange)]">{t("home.why.title2")}</span>
          </h2>
          <div className="mt-8 space-y-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)] text-left">
            <p>{t("home.why.body1")}</p>
            <p>{t("home.why.body2")}</p>
            <p>{t("home.why.body3")}</p>
            <p>{t("home.why.body4")}</p>
            <p>{t("home.why.body5")}</p>
            <p className="text-[var(--color-ivory)]">{t("home.why.body6")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
