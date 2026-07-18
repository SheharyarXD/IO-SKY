/*
 * IO SKY — Admin Portal · OperationalPage shell.
 *
 * Reusable rich shell rendered by every sidebar module. Provides:
 *   - Eyebrow tag + module title + tagline.
 *   - KPI strip (3-5 tiles) with sparklines and deltas.
 *   - Optional toolbar (filters + primary action).
 *   - Two-column body slot — main column (table or content) + side column
 *     (operational facts, activity, queue).
 *
 * Designed to be data-driven so every module page is a 50-line config file
 * rather than a copy/pasted layout.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Search,
  Filter,
  Plus,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  type LucideIcon,
} from "lucide-react";

// ---------- Types -----------------------------------------------------------

export interface KpiTile {
  id: string;
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  hint?: string;
  accent?: "orange" | "green" | "red" | "violet" | "blue";
  icon?: LucideIcon;
  spark?: number[];
}

export interface OperationalPageProps {
  eyebrow?: string;
  title: string;
  tagline: string;
  kpis?: KpiTile[];
  toolbar?: ReactNode;
  /** Big content slot (usually a table or grid) — fills the left column. */
  primary: ReactNode;
  /** Side column slot — usually a stack of small cards. */
  aside?: ReactNode;
  /**
   * When true, renders a clearly-visible "Sample data" badge in the header.
   * Use for modules whose figures are illustrative placeholders rather than
   * live operational data, so reviewers never mistake them for real metrics.
   */
  sampleData?: boolean;
}

// ---------- Visual primitives ----------------------------------------------

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke="rgba(255,106,0,0.85)"
        strokeWidth={1.5}
        points={points}
      />
    </svg>
  );
}

const ACCENT_BORDER: Record<NonNullable<KpiTile["accent"]>, string> = {
  orange: "border-[#FF6A00]/25",
  green: "border-emerald-500/25",
  red: "border-red-500/25",
  violet: "border-violet-500/25",
  blue: "border-sky-500/25",
};

const ACCENT_ICON_BG: Record<NonNullable<KpiTile["accent"]>, string> = {
  orange: "bg-[#FF6A00]/12 text-[#FF6A00]",
  green: "bg-emerald-500/12 text-emerald-400",
  red: "bg-red-500/12 text-red-400",
  violet: "bg-violet-500/12 text-violet-400",
  blue: "bg-sky-500/12 text-sky-400",
};

function KpiCard({ tile }: { tile: KpiTile }) {
  const Icon = tile.icon ?? Activity;
  const accent = tile.accent ?? "orange";
  return (
    <div
      className={cn(
        "rounded-[14px] border bg-[#0B1020]/70 px-4 py-3.5",
        ACCENT_BORDER[accent],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-mono uppercase tracking-[0.2em] text-white/55">
            {tile.label}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <div className="font-display text-[26px] leading-none text-white">
              {tile.value}
            </div>
            {tile.delta ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[11px] font-mono",
                  tile.delta.positive ? "text-emerald-400" : "text-red-400",
                )}
              >
                {tile.delta.positive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {tile.delta.value}
              </span>
            ) : null}
          </div>
          {tile.hint ? (
            <div className="mt-1 text-[11px] text-white/45">{tile.hint}</div>
          ) : null}
        </div>
        <div
          className={cn(
            "shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center",
            ACCENT_ICON_BG[accent],
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {tile.spark && tile.spark.length > 0 ? (
        <div className="mt-2.5 -mx-1 opacity-90">
          <Sparkline values={tile.spark} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- Public component -----------------------------------------------

export default function OperationalPage({
  eyebrow,
  title,
  tagline,
  kpis,
  toolbar,
  primary,
  aside,
  sampleData,
}: OperationalPageProps) {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <header>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#FF6A00]/30 bg-[#FF6A00]/10 font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#FF6A00]">
          <Sparkles className="w-3 h-3" />
          {eyebrow ?? "Operational module"}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="font-display text-[28px] leading-tight tracking-tight text-white">
            {title}
          </h1>
          {sampleData ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/40 bg-amber-400/10 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300"
              title="Figures in this module are illustrative placeholders, not live data."
            >
              <Activity className="w-3 h-3" />
              Sample data · module preview
            </span>
          ) : null}
        </div>
        <p className="mt-1 max-w-[760px] text-[13.5px] text-white/65 leading-relaxed">
          {tagline}
        </p>
      </header>

      {/* KPI strip */}
      {kpis && kpis.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((tile) => (
            <KpiCard key={tile.id} tile={tile} />
          ))}
        </div>
      ) : null}

      {/* Toolbar */}
      {toolbar ? (
        <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
          {toolbar}
        </div>
      ) : null}

      {/* Body */}
      <div
        className={cn(
          "grid gap-4",
          aside ? "grid-cols-1 xl:grid-cols-[1fr_340px]" : "grid-cols-1",
        )}
      >
        <div className="rounded-[14px] border border-white/[0.06] bg-[#0B1020]/60 p-4">
          {primary}
        </div>
        {aside ? <div className="space-y-4">{aside}</div> : null}
      </div>
    </div>
  );
}

// ---------- Helper: a default search/filter toolbar -----------------------

export function DefaultToolbar({
  primaryAction,
  searchPlaceholder = "Search…",
  filters,
}: {
  primaryAction?: { label: string; onClick?: () => void };
  searchPlaceholder?: string;
  filters?: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
        <input
          type="search"
          placeholder={searchPlaceholder}
          className="w-full pl-8 pr-3 py-2 rounded-[10px] bg-[#070A14] border border-white/[0.08] text-[12.5px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#FF6A00]/40"
        />
      </div>
      {filters?.map((f) => (
        <button
          key={f}
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.02] text-[12px] text-white/80 hover:bg-white/[0.05]"
        >
          <Filter className="w-3 h-3" />
          {f}
        </button>
      ))}
      {primaryAction ? (
        <button
          type="button"
          onClick={primaryAction.onClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#FF6A00] text-[12.5px] font-medium text-black hover:bg-[#FF7A1A]"
        >
          <Plus className="w-3.5 h-3.5" />
          {primaryAction.label}
        </button>
      ) : null}
    </div>
  );
}

// ---------- Helper: little side-column card --------------------------------

export function SideCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[#0B1020]/60 p-4">
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/55">
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

// ---------- Helper: simple data table --------------------------------------

export interface DataColumn<T> {
  key: keyof T | string;
  header: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
  width?: string;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  emptyLabel = "No records yet.",
}: {
  columns: DataColumn<T>[];
  rows: T[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-[12.5px] text-white/55">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columns.map((c) => (
              <th
                key={String(c.key)}
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  "py-2 px-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  !c.align && "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors"
            >
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className={cn(
                    "py-2.5 px-2 text-white/85",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                  )}
                >
                  {c.render
                    ? c.render(r)
                    : ((r as any)[c.key] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusPill({
  tone,
  label,
}: {
  tone: "ok" | "warn" | "err" | "info" | "muted";
  label: string;
}) {
  const cls: Record<typeof tone, string> = {
    ok: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
    warn: "bg-amber-500/12 text-amber-300 border-amber-500/25",
    err: "bg-red-500/12 text-red-300 border-red-500/25",
    info: "bg-sky-500/12 text-sky-300 border-sky-500/25",
    muted: "bg-white/[0.04] text-white/65 border-white/[0.08]",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] border text-[10.5px] font-mono uppercase tracking-[0.14em]",
        cls[tone],
      )}
    >
      {label}
    </span>
  );
}
