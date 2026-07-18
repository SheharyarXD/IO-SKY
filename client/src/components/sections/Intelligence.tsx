/*
 * IO SKY — "AI Intelligence Layer" section (master design).
 * Left column: eyebrow + headline + body + "Explore AI Systems →".
 * Right column: 4 horizontal feature cards each with icon-chip + title + body.
 */
import { Link } from "wouter";
import { ArrowRight, AudioLines, ListChecks, Zap, BellRing } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function Intelligence() {
  const { t } = useT();
  const FEATURES = [
    { icon: AudioLines, title: t("intel.voice.title"),    body: t("intel.voice.body") },
    { icon: ListChecks, title: t("intel.workflow.title"), body: t("intel.workflow.body") },
    { icon: Zap,        title: t("intel.opIntel.title"),  body: t("intel.opIntel.body") },
    { icon: BellRing,   title: t("intel.followUp.title"), body: t("intel.followUp.body") },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
          <div className="lg:col-span-4">
            <div className="eyebrow">{t("intel.eyebrow")}</div>
            <h2 className="mt-5 font-display font-semibold text-[30px] md:text-[36px] leading-[1.12] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("intel.title")}
            </h2>
            <p className="mt-5 text-[14.5px] leading-[1.75] text-[oklch(0.74_0.014_250)] max-w-md">
              {t("intel.body")}
            </p>
            <Link href="/intelligence" className="mt-7 link-orange">
              {t("intel.link")}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>

          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
              {FEATURES.map((f) => (
                <div key={f.title} className="feature-card glass p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="icon-chip-lg">
                      <f.icon className="w-5 h-5" strokeWidth={1.75} />
                    </span>
                    <h3 className="text-[16px] font-display font-semibold text-[var(--color-ivory)] leading-snug">
                      {f.title}
                    </h3>
                  </div>
                  <p className="text-[13.5px] text-[oklch(0.74_0.014_250)] leading-[1.65]">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
