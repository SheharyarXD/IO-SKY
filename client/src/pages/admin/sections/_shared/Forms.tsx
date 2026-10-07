/*
 * IO SKY — Admin Portal · small form and panel primitives.
 *
 * The SRS completion screens are mostly "list some records, add one, move one
 * along". These keep each of them to a field list and a mutation instead of a
 * hand written form per screen, and replace the window.prompt chains the older
 * sections used. Inputs are real controlled fields with labels, so they work
 * with a keyboard and a screen reader.
 */
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "textarea" | "select" | "email";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  /** Initial value. */
  initial?: string;
  hint?: string;
};

const inputCls =
  "w-full px-2.5 py-1.5 rounded-[8px] bg-[#103438] border border-white/[0.08] text-[12.5px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#F58A1F]/50";

function Field({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/55">
        {def.label}
        {def.required ? <span className="text-[#F58A1F]"> *</span> : null}
      </label>
      {def.type === "textarea" ? (
        <textarea id={id} className={cn(inputCls, "min-h-[72px]")} value={value} placeholder={def.placeholder} required={def.required} onChange={(e) => onChange(e.target.value)} />
      ) : def.type === "select" ? (
        <select id={id} className={inputCls} value={value} required={def.required} onChange={(e) => onChange(e.target.value)}>
          {!def.required ? <option value="">None</option> : null}
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input id={id} type={def.type ?? "text"} className={inputCls} value={value} placeholder={def.placeholder} required={def.required} onChange={(e) => onChange(e.target.value)} />
      )}
      {def.hint ? <span className="text-[11px] text-white/40">{def.hint}</span> : null}
    </div>
  );
}

/**
 * A card with a form. `onSubmit` receives the raw string values and returns a
 * promise; the form clears on success and reports the server's message on
 * failure, so each caller only maps strings to a typed mutation input.
 */
export function FormCard({
  title,
  fields,
  submitLabel,
  onSubmit,
  successMessage,
  columns = 2,
}: {
  title: string;
  fields: FieldDef[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<unknown>;
  successMessage?: string;
  columns?: 1 | 2 | 3;
}) {
  const initial = () => Object.fromEntries(fields.map((f) => [f.name, f.initial ?? ""]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="rounded-[14px] border border-white/[0.06] bg-[#0D2D2E]/60 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(values);
          toast.success(successMessage ?? "Saved.");
          setValues(initial());
        } catch (err) {
          toast.error((err as Error)?.message || "That did not work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/55">{title}</div>
      <div className={cn("mt-3 grid gap-3", columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2")}>
        {fields.map((f) => (
          <Field key={f.name} def={f} value={values[f.name] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
        ))}
      </div>
      <button type="submit" disabled={busy} className="mt-3 inline-flex items-center px-3 py-1.5 rounded-[10px] bg-[#F58A1F] text-[12.5px] font-medium text-black hover:bg-[#FF7A1A] disabled:opacity-50">
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-white/[0.06] bg-[#0D2D2E]/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/55">{title}</h3>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function SmallButton({ children, onClick, tone = "default", disabled }: { children: ReactNode; onClick: () => void; tone?: "default" | "danger"; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded-[7px] border text-[11.5px] disabled:opacity-40",
        tone === "danger" ? "border-red-500/30 text-red-300 hover:bg-red-500/10" : "border-white/[0.1] text-white/80 hover:bg-white/[0.06]",
      )}
    >
      {children}
    </button>
  );
}

export function TabBar<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string }>; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-white/[0.06] pb-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn("px-3 py-1.5 rounded-[8px] text-[12.5px]", value === t.id ? "bg-[#F58A1F] text-black font-medium" : "text-white/70 hover:bg-white/[0.05]")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const money = (cents: number | string | null | undefined, currency = "EUR") =>
  `${currency} ${(Number(cents ?? 0) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "2026-10-07" or a Date to a short local string. */
export const shortDate = (v: string | Date | number | null | undefined) => (v ? new Date(v).toLocaleDateString() : "n/a");
export const shortDateTime = (v: string | Date | number | null | undefined) => (v ? new Date(v).toLocaleString() : "n/a");
