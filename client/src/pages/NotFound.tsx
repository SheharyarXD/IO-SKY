/*
 * IO SKY — 404. Same calm operating tone as the rest of the site.
 */
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowUpRight, Home, LifeBuoy } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar />
      <main className="relative z-[1] flex-1 flex items-center pt-32 pb-20">
        <div className="container max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-soft font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#E6EAF0]/70">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] shadow-[0_0_8px_#FF7A00]" />
            ROUTE NOT FOUND · 404
          </div>
          <h1 className="mt-6 font-display font-semibold text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.022em] text-[#E6EAF0]">
            That coordinate is <span className="text-[#FF7A00]">off-grid.</span>
          </h1>
          <p className="mt-5 text-[15.5px] leading-[1.7] text-[#E6EAF0]/65 max-w-[560px] mx-auto">
            The page you tried to reach is not part of the current operating
            surface. Use the controls below to return to a known-good state.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/" className="btn-primary">
              <Home size={16} strokeWidth={2.2} />
              Return home
              <ArrowUpRight size={16} strokeWidth={2.2} />
            </Link>
            <Link href="/contact" className="btn-secondary">
              <LifeBuoy size={16} strokeWidth={1.8} />
              Contact operations
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
