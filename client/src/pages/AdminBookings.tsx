/*
 * IO SKY — Admin · Recent Discovery Call bookings.
 *
 * Lists the most recent bookings persisted via trpc.bookings.create.
 * Gated by adminProcedure — only the owner (or users with role=admin) can load.
 * Non-admins are redirected through the standard Manus OAuth login flow.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { isAdminRole } from "@/_core/hooks/useRouteGuard";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { useMemo } from "react";

function formatDateTime(d: Date | string | number | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "confirmed"
      ? "border-[#FF6A00]/40 text-[#FF6A00] bg-[#FF6A00]/[0.08]"
      : value === "cancelled"
      ? "border-red-500/40 text-red-300 bg-red-500/[0.08]"
      : "border-white/15 text-white/70 bg-white/[0.04]";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10.5px] font-mono uppercase tracking-[0.16em] ${tone}`}
    >
      {value}
    </span>
  );
}

interface AdminBookingsProps {
  /** When true, render only the page body (no Navbar/Footer); used inside AdminLayout. */
  embedded?: boolean;
}

export default function AdminBookings({ embedded = false }: AdminBookingsProps = {}) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = isAdminRole(user?.role);

  const enabled = isAuthenticated && isAdmin;
  const recent = trpc.bookings.listRecent.useQuery(undefined, {
    enabled,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => recent.data ?? [], [recent.data]);

  const Body = (
    <>
        <div className={embedded ? "" : "container max-w-6xl"}>
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-soft font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#E6EAF0]/70 self-start">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shadow-[0_0_8px_#FF6A00]" />
              ADMIN · STRATEGY CALL BOOKINGS
            </div>
            <h1 className="font-display font-semibold text-[34px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-[#E6EAF0] mt-3">
              Recent <span className="text-[#FF6A00]">bookings</span>
            </h1>
            <p className="text-[14.5px] leading-[1.65] text-[#E6EAF0]/65 max-w-[640px]">
              The 100 most recent discovery call requests captured by the
              public booking endpoint. Emails and owner notifications are
              dispatched automatically — this view is for verification and
              follow-up.
            </p>
          </div>

          {/* Access states */}
          {authLoading && (
            <div className="mt-12 flex items-center gap-3 text-white/70">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking session…
            </div>
          )}

          {!authLoading && !isAuthenticated && (
            <div className="mt-12 p-6 rounded-[16px] border border-white/[0.07] bg-[#0E121B]/85 max-w-[520px]">
              <div className="flex items-center gap-2 text-[#FF6A00]">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                  Authentication required
                </span>
              </div>
              <p className="mt-2 text-[14px] text-white/70">
                Sign in with the owner account to view recent bookings.
              </p>
              <a
                href={getLoginUrl()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF6A00] hover:bg-[#FF5500] text-[#0A0B10] text-[13px] font-semibold transition-colors"
              >
                Sign in
              </a>
            </div>
          )}

          {!authLoading && isAuthenticated && !isAdmin && (
            <div className="mt-12 p-6 rounded-[16px] border border-red-500/25 bg-red-500/[0.04] max-w-[520px]">
              <div className="flex items-center gap-2 text-red-300">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                  Insufficient privileges
                </span>
              </div>
              <p className="mt-2 text-[14px] text-white/70">
                Your account is signed in, but does not have admin access to
                this resource.
              </p>
            </div>
          )}

          {enabled && (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[12.5px] font-mono uppercase tracking-[0.18em] text-white/55">
                  {recent.isLoading
                    ? "Loading…"
                    : `${rows.length} booking${rows.length === 1 ? "" : "s"}`}
                </div>
                <button
                  type="button"
                  onClick={() => recent.refetch()}
                  disabled={recent.isFetching}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/12 hover:border-[#FF6A00]/40 text-white/80 hover:text-[#FF6A00] text-[12.5px] transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      recent.isFetching ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </button>
              </div>

              {recent.isError && (
                <div className="p-4 rounded-[14px] border border-red-500/30 bg-red-500/[0.05] text-[13px] text-red-300">
                  Failed to load bookings:{" "}
                  {recent.error?.message ?? "Unknown error."}
                </div>
              )}

              {!recent.isLoading && !recent.isError && rows.length === 0 && (
                <div className="p-8 rounded-[16px] border border-dashed border-white/12 text-center text-white/60 text-[14px]">
                  No bookings yet. New requests will appear here in real time.
                </div>
              )}

              {rows.length > 0 && (
                <div className="overflow-x-auto rounded-[16px] border border-white/[0.07] bg-[#0E121B]/85">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-white/[0.03] text-[11px] font-mono uppercase tracking-[0.16em] text-white/55">
                      <tr>
                        <th className="px-4 py-3">Ref</th>
                        <th className="px-4 py-3">Tier</th>
                        <th className="px-4 py-3">Attendee</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">When</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {rows.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-[11.5px] text-[#FF6A00]">
                            {b.publicRef}
                          </td>
                          <td className="px-4 py-3 text-white/85 capitalize">
                            {b.serviceId}
                            <span className="text-white/40 ml-1">
                              · {b.durationMin}m
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/85">
                            <div>{b.fullName}</div>
                            <div className="text-white/45 text-[11.5px]">
                              {b.email}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-white/75">
                            {b.company ?? "—"}
                            {b.role && (
                              <div className="text-white/45 text-[11.5px]">
                                {b.role}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-white/75">
                            <div>{formatDateTime(b.slotStartMs)}</div>
                            <div className="text-white/45 text-[11.5px]">
                              {b.timezone}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill value={b.status} />
                          </td>
                          <td className="px-4 py-3 text-white/70">
                            {b.emailSent ? "Sent" : "Pending"}
                          </td>
                          <td className="px-4 py-3 text-white/55 font-mono text-[11.5px]">
                            {formatDateTime(b.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
    </>
  );

  if (embedded) return Body;

  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar />
      <main className="relative z-[1] pt-32 pb-24">
        {Body}
      </main>
      <Footer />
    </div>
  );
}
