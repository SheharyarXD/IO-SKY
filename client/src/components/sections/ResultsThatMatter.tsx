/*
 * IO SKY — "Results that Matter" section.
 *
 * Left column: eyebrow + headline. Right column: 4 qualitative indicator cards
 * (no fabricated metrics) describing where operational clarity creates value.
 */
import { Workflow, Gauge, BrainCircuit, Eye } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function ResultsThatMatter() {
  const { t } = useT();
  const STATS = [
    { icon: Workflow,     title: t("results.card1.title"), body: t("results.card1.body") },
    { icon: Gauge,        title: t("results.card2.title"), body: t("results.card2.body") },
    { icon: BrainCircuit, title: t("results.card3.title"), body: t("results.card3.body") },
    { icon: Eye,          title: t("results.card4.title"), body: t("results.card4.body") },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-4">
            <div className="eyebrow">{t("results.eyebrow")}</div>
            <h2 className="mt-5 font-display font-semibold text-[30px] md:text-[36px] leading-[1.12] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("results.title")}
            </h2>
          </div>

          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {STATS.map((s) => (
                <div key={s.title} className="feature-card glass p-5 md:p-6 flex flex-col gap-3">
                  <span className="icon-chip">
                    <s.icon className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-[16px] font-display font-semibold text-[var(--color-ivory)] leading-snug">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-[13px] text-[oklch(0.74_0.014_250)] leading-[1.6]">
                      {s.body}
                    </p>
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
