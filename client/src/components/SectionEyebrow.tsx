/*
 * IO SKY — Section eyebrow (telemetry tag).
 * Reads like a control-panel label: `[ 03 / OPERATIONAL FRICTION ]`.
 * Anchored by the orange tick to reinforce the calm operational hierarchy.
 */
import { cn } from "@/lib/utils";

interface Props {
  index: string;
  label: string;
  className?: string;
}

export function SectionEyebrow({ index, label, className }: Props) {
  return (
    <div className={cn("eyebrow", className)}>
      <span className="text-[var(--color-orange)]">{index}</span>
      <span className="opacity-50">/</span>
      <span>{label}</span>
    </div>
  );
}

export default SectionEyebrow;
