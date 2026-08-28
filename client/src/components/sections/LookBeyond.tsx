/*
 * IO SKY — Homepage · "Look Beyond the Visible Problem" section (master design spec §2.3).
 */
import { useT } from "@/contexts/LanguageContext";

export default function LookBeyond() {
  const { t } = useT();
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="max-w-[680px] mx-auto text-center">
          <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
            {t("home.lookBeyond.title")}
          </h2>
          <div className="mt-8 space-y-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)] text-left">
            <p>{t("home.lookBeyond.body1")}</p>
            <p>{t("home.lookBeyond.body2")}</p>
            <p>{t("home.lookBeyond.body3")}</p>
            <p>{t("home.lookBeyond.body4")}</p>
            <p className="text-[var(--color-ivory)]">{t("home.lookBeyond.body5")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
