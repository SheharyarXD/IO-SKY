/*
 * IO SKY — Homepage · "Built for Change" section (master design spec §2.8).
 */
import { useT } from "@/contexts/LanguageContext";

export default function BuiltForChange() {
  const { t } = useT();
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="max-w-[680px] mx-auto text-center">
          <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
            {t("home.builtForChange.title1")}
            <br />
            <span className="text-[var(--color-orange)]">{t("home.builtForChange.title2")}</span>
          </h2>
          <div className="mt-8 space-y-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)] text-left">
            <p>{t("home.builtForChange.body1")}</p>
            <p>{t("home.builtForChange.body2")}</p>
            <p>{t("home.builtForChange.body3")}</p>
            <p>{t("home.builtForChange.body4")}</p>
            <p>{t("home.builtForChange.body5")}</p>
            <p className="text-[var(--color-ivory)]">{t("home.builtForChange.body6")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
