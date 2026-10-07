/*
 * IO SKY — Client Portal · document search (SRS 18.12).
 *
 * Results come from a server search that is scoped to the caller's own
 * organization, so the box can never surface another tenant's documents.
 */
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { GlassCard } from "./PortalUI";

export default function DocumentSearch() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  // Debounce so typing does not fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const enabled = q.length >= 2;
  const res = trpc.clientPortal.searchDocuments.useQuery({ q }, { enabled });

  return (
    <GlassCard className="p-4 mb-6">
      <label htmlFor="doc-search" className="sr-only">Search documents</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" aria-hidden />
        <Input id="doc-search" type="search" className="pl-9" placeholder="Search your documents by name, category or uploader" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {enabled ? (
        <div className="mt-3" aria-live="polite">
          {res.isLoading ? (
            <p className="text-[12.5px] text-white/50">Searching…</p>
          ) : (res.data?.length ?? 0) === 0 ? (
            <p className="text-[12.5px] text-white/50">No documents match "{q}".</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {res.data!.map((d) => (
                <li key={d.id} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-white/90 truncate">{d.name}</span>
                  <span className="text-white/45 shrink-0">{d.category} · v{d.version}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </GlassCard>
  );
}
