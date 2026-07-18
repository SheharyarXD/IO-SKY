/*
 * IO SKY — Admin Portal · operational module stub.
 *
 * Used as a transitional shell while individual sidebar modules are being
 * wired to their dedicated backend procedures. Renders a tasteful empty
 * state with the IO mark and a "module coming online" message — explicitly
 * not a generic placeholder card per the master spec.
 */
import IOSkyLogo from "@/components/IOSkyLogo";
import { Sparkles } from "lucide-react";

interface ModuleStubProps {
  title: string;
  description: string;
}

export default function ModuleStub({ title, description }: ModuleStubProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,0.3)_0%,transparent_70%)] blur-md" />
        <div className="relative w-[88px] h-[88px] rounded-[18px] border border-[#FF6A00]/25 bg-gradient-to-b from-[#0B1020] to-[#070A14] flex items-center justify-center">
          <IOSkyLogo variant="mark" height={52} />
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6A00]/12 border border-[#FF6A00]/30 font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#FF6A00] mb-3">
        <Sparkles className="w-3 h-3" /> Operational module
      </span>
      <h2 className="font-display font-semibold text-[24px] tracking-tight text-[#E6EAF0]">
        {title}
      </h2>
      <p className="mt-2 max-w-[520px] text-[14px] text-white/65 leading-relaxed">{description}</p>
      <div className="mt-5 grid grid-cols-3 gap-2 max-w-[480px] w-full">
        {["Backend wiring", "RBAC + audit", "UX polish"].map((step, i) => (
          <div
            key={step}
            className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3 text-left"
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
              Step {i + 1}
            </div>
            <div className="text-[12.5px] text-white/85 mt-0.5">{step}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
