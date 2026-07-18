/*
 * IO SKY — Four-pillar feature row.
 * Cards: Infrastructure · Intelligence · Growth · Enterprise.
 * Each has a single coloured icon-chip, title, body, and "Learn more →" link.
 */
import { Link } from "wouter";
import { Box, BrainCircuit, TrendingUp, Star, ArrowRight } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function FourPillars() {
  const { t } = useT();
  const PILLARS = [
    { icon: Box,          title: t("pillars.infra.title"),      body: t("pillars.infra.body"),      href: "/infrastructure", cta: t("pillars.infra.cta") },
    { icon: BrainCircuit, title: t("pillars.intel.title"),      body: t("pillars.intel.body"),      href: "/intelligence",   cta: t("pillars.intel.cta") },
    { icon: TrendingUp,   title: t("pillars.growth.title"),     body: t("pillars.growth.body"),     href: "/solutions",      cta: t("pillars.solutions.cta") },
    { icon: Star,         title: t("pillars.enterprise.title"), body: t("pillars.enterprise.body"), href: "/enterprise",     cta: t("pillars.enterprise.cta") },
  ];
  return (
    <section className="pb-20 md:pb-28">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
          {PILLARS.map((p) => (
            <div key={p.title} className="feature-card glass p-6 flex flex-col gap-4 group">
              <span className="icon-chip-lg">
                <p.icon className="w-5 h-5" strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="text-[18px] font-display font-semibold text-[var(--color-ivory)] leading-snug">
                  {p.title}
                </h3>
                <p className="mt-2 text-[13.5px] text-[oklch(0.74_0.014_250)] leading-[1.65]">
                  {p.body}
                </p>
              </div>
              <Link href={p.href} className="link-orange mt-auto">
                {p.cta}
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
