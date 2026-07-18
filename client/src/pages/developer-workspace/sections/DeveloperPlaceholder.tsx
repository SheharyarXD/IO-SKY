/*
 * IO SKY — Developer Workspace · Section placeholder.
 *
 * Phase 3 ships every sidebar route as a navigable surface so the rail
 * never dead-ends. Each section that hasn't been fully wired yet renders
 * this calm "coming next" card so the visual language stays intact.
 * Phase 5 replaces these with real data + mutation flows.
 */
import {
  SectionHeader,
  GlassCard,
} from "@/pages/client-portal/components/PortalUI";
import { Construction } from "lucide-react";

interface PlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  /** Short bullet list explaining what *will* live here in Phase 5. */
  upcoming: string[];
}

export default function DeveloperPlaceholder({
  eyebrow,
  title,
  description,
  upcoming,
}: PlaceholderProps) {
  return (
    <div>
      <SectionHeader eyebrow={eyebrow} title={title} description={description} />
      <GlassCard className="p-8 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-300">
            <Construction className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-orange-300/90 font-semibold">
              In progress
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-white">
              Wiring this surface to real data
            </h3>
          </div>
        </div>
        <p className="mt-4 text-sm text-white/55 max-w-xl">
          The backend for this section is already deployed and scoped to your
          assignments. The interactive UI is being landed in the next phase so
          we can ship one polished, tested feature at a time.
        </p>
        <ul className="mt-5 space-y-2">
          {upcoming.map((item, i) => (
            <li
              key={i}
              className="text-sm text-white/70 flex items-start gap-2 leading-relaxed"
            >
              <span className="mt-2 h-1 w-1 rounded-full bg-orange-400/70 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
