/*
 * IO SKY — Homepage.
 *
 * Section order (top → bottom), per IO_SKY_Master_Design_Spec.md §2:
 *   1. Hero
 *   2. Growth & Dependency
 *   3. Look Beyond the Visible Problem
 *   4. Our Starting Point
 *   5. Designing the Relationships
 *   6. What That Can Become (Foundation · Intelligence · Solutions)
 *   7. Why IO SKY
 *   8. Built for Change
 *   9. Final CTA
 *
 * Every non-hero section is wrapped in <RevealOnScroll> for cinematic, taste-
 * forward reveals as the visitor scrolls.
 */
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Hero from "@/components/sections/Hero";
import GrowthDependency from "@/components/sections/GrowthDependency";
import LookBeyond from "@/components/sections/LookBeyond";
import OurStartingPoint from "@/components/sections/OurStartingPoint";
import DesigningRelationships from "@/components/sections/DesigningRelationships";
import WhatThatCanBecome from "@/components/sections/WhatThatCanBecome";
import WhyIOSKY from "@/components/sections/WhyIOSKY";
import BuiltForChange from "@/components/sections/BuiltForChange";
import HomeFinalCta from "@/components/sections/HomeFinalCta";
import RevealOnScroll from "@/components/RevealOnScroll";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar />
      <main className="relative z-[1] page-enter">
        <Hero />
        <RevealOnScroll><GrowthDependency /></RevealOnScroll>
        <RevealOnScroll><LookBeyond /></RevealOnScroll>
        <RevealOnScroll><OurStartingPoint /></RevealOnScroll>
        <RevealOnScroll><DesigningRelationships /></RevealOnScroll>
        <RevealOnScroll><WhatThatCanBecome /></RevealOnScroll>
        <RevealOnScroll><WhyIOSKY /></RevealOnScroll>
        <RevealOnScroll><BuiltForChange /></RevealOnScroll>
        <RevealOnScroll><HomeFinalCta /></RevealOnScroll>
      </main>
      <Footer />
    </div>
  );
}
