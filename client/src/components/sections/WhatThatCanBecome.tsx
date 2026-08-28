/*
 * IO SKY — Homepage · "What That Can Become" section (master design spec §2.6).
 * Three cards: Foundation, Intelligence, Solutions.
 */
import { Link } from "wouter";
import { ArrowRight, Layers, BrainCog, Blocks } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function WhatThatCanBecome() {
  const { t } = useT();
  const CARDS = [
    { icon: Layers, titleKey: "home.become.card1.title", bodyKey: "home.become.card1.body", linkKey: "home.become.card1.link", href: "/infrastructure" },
    { icon: BrainCog, titleKey: "home.become.card2.title", bodyKey: "home.become.card2.body", linkKey: "home.become.card2.link", href: "/intelligence" },
    { icon: Blocks, titleKey: "home.become.card3.title", bodyKey: "home.become.card3.body", linkKey: "home.become.card3.link", href: "/solutions" },
  ];

  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="max-w-[680px] mx-auto text-center">
          <h2 className="font-display font-semibold text-[28px] md:text-[36px] leading-[1.16] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
            {t("home.become.title")}
          </h2>
          <p className="mt-5 text-[15px] md:text-[16px] leading-[1.75] text-[oklch(0.78_0.014_250)]">
            {t("home.become.body")}
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {CARDS.map((c) => (
            <Link key={c.titleKey} href={c.href} className="feature-card glass p-7 flex flex-col gap-4 group">
              <span className="icon-chip">
                <c.icon className="w-5 h-5" strokeWidth={1.75} />
              </span>
              <div className="flex-1">
                <h3 className="text-[19px] font-display font-semibold text-[var(--color-ivory)] leading-snug">
                  {t(c.titleKey)}
                </h3>
                <p className="mt-3 text-[13.5px] text-[oklch(0.74_0.014_250)] leading-[1.65]">
                  {t(c.bodyKey)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-orange)] group-hover:gap-2.5 transition-all">
                {t(c.linkKey)}
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
