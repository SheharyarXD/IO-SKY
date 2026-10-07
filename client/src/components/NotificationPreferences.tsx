/*
 * IO SKY — notification preferences (SRS 17.11, 17.13).
 *
 * One component for every role, because the preferences belong to the person
 * and not to a portal. Security notifications are shown as locked: they are
 * always delivered, and offering a switch that does nothing would be a lie.
 */
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Lock } from "lucide-react";

const LABELS: Record<string, string> = {
  account: "Account",
  project: "Projects and delivery",
  billing: "Billing and quotations",
  support: "Support",
  marketing: "News and offers",
  security: "Security",
};

export default function NotificationPreferences() {
  const utils = trpc.useUtils();
  const q = trpc.profile.notificationPreferences.useQuery();
  const set = trpc.profile.setNotificationPreference.useMutation({
    onSuccess: () => utils.profile.notificationPreferences.invalidate(),
    onError: (e) => toast.error(e.message || "Could not save that preference."),
  });
  const rows = q.data ?? [];
  const categories = [...new Set(rows.map((r) => r.category))];
  const cell = (category: string, channel: "email" | "in_app") => rows.find((r) => r.category === category && r.channel === channel);

  return (
    <section aria-labelledby="notif-prefs-h" className="space-y-3">
      <div>
        <h3 id="notif-prefs-h" className="text-[15px] font-medium text-white">Notification preferences</h3>
        <p className="text-[12.5px] text-white/55">Choose how you hear about each kind of event. Security notifications are always delivered.</p>
      </div>
      {q.isLoading ? (
        <div className="text-[12.5px] text-white/50">Loading…</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/45">
              <th className="py-2 font-normal">Category</th>
              <th className="py-2 font-normal text-center">In app</th>
              <th className="py-2 font-normal text-center">Email</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c} className="border-t border-white/[0.06]">
                <td className="py-2 text-white/85">{LABELS[c] ?? c}</td>
                {(["in_app", "email"] as const).map((ch) => {
                  const r = cell(c, ch);
                  return (
                    <td key={ch} className="py-2 text-center">
                      {r?.locked ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-white/50" title="Always delivered">
                          <Lock className="w-3 h-3" aria-hidden /> Always on
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`${LABELS[c] ?? c} by ${ch === "email" ? "email" : "in app"}`}
                          checked={r?.enabled ?? true}
                          disabled={set.isPending}
                          onChange={(e) => set.mutate({ category: c as never, channel: ch, enabled: e.target.checked })}
                          className="h-4 w-4 accent-[#F58A1F]"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
