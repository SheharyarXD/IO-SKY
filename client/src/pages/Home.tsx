/*
 * IO SKY — Homepage (premium master design).
 *
 * Section order (top → bottom):
 *   1. Hero (with embedded Overview dashboard + trust strip)
 *   2. Live Ops Ticker (operational telemetry strip)
 *   3. The Real Problem (4 friction cards)
 *   4. The Solution (hub diagram + 6 connector pills)
 *   5. Four Pillars (Infrastructure · Intelligence · Growth · Enterprise)
 *   6. AI Intelligence Layer (4 capability cards)
 *   7. Everything Connected (3 dashboard portals)
 *   8. Results that Matter (4 stat tiles)
 *   9. Discover Opportunities — AI Scan Preview
 *
 * Every non-hero section is wrapped in <RevealOnScroll> for cinematic, taste-
 * forward reveals as the visitor scrolls.
 */
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Hero from "@/components/sections/Hero";
import LiveOpsTicker from "@/components/sections/LiveOpsTicker";
import OperationalFriction from "@/components/sections/OperationalFriction";
import EcosystemOverview from "@/components/sections/EcosystemOverview";
import FourPillars from "@/components/sections/FourPillars";
import IntelligenceSection from "@/components/sections/Intelligence";
import InfrastructureSection from "@/components/sections/Infrastructure";
import ResultsThatMatter from "@/components/sections/ResultsThatMatter";
import AIScanSection from "@/components/sections/AIScanSection";
import RevealOnScroll from "@/components/RevealOnScroll";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar />
      <main className="relative z-[1] page-enter">
        <Hero />
        <LiveOpsTicker />
        <RevealOnScroll><OperationalFriction /></RevealOnScroll>
        <RevealOnScroll><EcosystemOverview /></RevealOnScroll>
        <RevealOnScroll><FourPillars /></RevealOnScroll>
        <RevealOnScroll><IntelligenceSection /></RevealOnScroll>
        <RevealOnScroll><InfrastructureSection /></RevealOnScroll>
        <RevealOnScroll><ResultsThatMatter /></RevealOnScroll>
        <RevealOnScroll><AIScanSection /></RevealOnScroll>
      </main>
      <Footer />
    </div>
  );
}
