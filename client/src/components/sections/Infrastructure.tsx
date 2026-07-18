/*
 * IO SKY — "From analysis to execution" section (replaces the old internal
 * portal showcase). Public-facing: no client/admin/developer portal references.
 *
 * Left column: eyebrow + headline + body.
 * Right column: 2x2 grid of four pathway cards:
 *   · AI Scan                            → /ai-scan
 *   · Growth Ecosystem                   → /solutions/growth-ecosystem
 *   · Elite Ecosystem                    → /solutions/elite-ecosystem
 *   · Custom Intelligence Infrastructure → /solutions/custom-intelligence-infrastructure
 */
import { Link } from "wouter";
import { ArrowRight, ScanSearch, Rocket, Gem, Boxes } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function Infrastructure() {
  const { t } = useT();
  const CARDS = [
    { icon: ScanSearch, title: t("path.aiscan.title"), body: t("path.aiscan.body"), href: "/ai-scan", cta: t("path.aiscan.cta") },
    { icon: Rocket,     title: t("path.growth.title"), body: t("path.growth.body"), href: "/solutions/growth-ecosystem", cta: t("path.growth.cta") },
    { icon: Gem,        title: t("path.elite.title"),  body: t("path.elite.body"),  href: "/solutions/elite-ecosystem", cta: t("path.elite.cta") },
    { icon: Boxes,      title: t("path.custom.title"), body: t("path.custom.body"), href: "/solutions/custom-intelligence-infrastructure", cta: t("path.custom.cta") },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
          <div className="lg:col-span-4">
            <div className="eyebrow">{t("path.eyebrow")}</div>
            <h2 className="mt-5 font-display font-semibold text-[30px] md:text-[36px] leading-[1.12] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("path.title")}
            </h2>
            <p className="mt-5 text-[14.5px] leading-[1.75] text-[oklch(0.74_0.014_250)] max-w-md">
              {t("path.body")}
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
              {CARDS.map((c) => (
                <div key={c.title} className="feature-card glass p-6 flex flex-col gap-4 group">
                  <span className="icon-chip-lg">
                    <c.icon className="w-5 h-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-[17px] font-display font-semibold text-[var(--color-ivory)] leading-snug">
                      {c.title}
                    </h3>
                    <p className="mt-2 text-[13.5px] text-[oklch(0.74_0.014_250)] leading-[1.65]">
                      {c.body}
                    </p>
                  </div>
                  <Link href={c.href} className="link-orange mt-auto">
                    {c.cta}
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
