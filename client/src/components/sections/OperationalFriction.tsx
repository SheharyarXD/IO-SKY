/*
 * IO SKY — "The Real Problem" section, fully localized.
 */
import { Zap, Gauge, Eye, TrendingUp } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function OperationalFriction() {
  const { t } = useT();
  const PROBLEMS = [
    { icon: Zap,        title: t("problem.card1.title"), body: t("problem.card1.body") },
    { icon: Gauge,      title: t("problem.card2.title"), body: t("problem.card2.body") },
    { icon: Eye,        title: t("problem.card3.title"), body: t("problem.card3.body") },
    { icon: TrendingUp, title: t("problem.card4.title"), body: t("problem.card4.body") },
  ];

  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
          <div className="lg:col-span-4">
            <div className="eyebrow">{t("problem.eyebrow")}</div>
            <h2 className="mt-5 font-display font-semibold text-[28px] md:text-[34px] leading-[1.15] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("problem.title.part1")}{" "}
              <span className="text-[var(--color-orange)]" style={{ textShadow: "0 0 22px oklch(0.72 0.205 45 / 0.4)" }}>
                {t("problem.title.accent")}
              </span>
              {t("problem.title.part2")}
            </h2>
            <p className="mt-5 text-[14px] leading-[1.75] text-[oklch(0.74_0.014_250)] max-w-md">
              {t("problem.body")}
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="feature-card glass p-5 flex flex-col gap-4">
                  <span className="icon-chip">
                    <p.icon className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-[15.5px] font-display font-semibold text-[var(--color-ivory)] leading-snug">
                      {p.title}
                    </h3>
                    <p className="mt-2 text-[13px] text-[oklch(0.74_0.014_250)] leading-[1.6]">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
