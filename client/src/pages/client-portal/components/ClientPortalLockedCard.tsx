/*
 * IO SKY — Client Portal Locked Card.
 * Shown when the authenticated user does not have a client role + linked
 * organization. Keeps the portal layout chrome but blocks data display.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Building2, Mail } from "lucide-react";

interface Props {
  role: string;
  email: string | null;
}

export default function ClientPortalLockedCard({ role, email }: Props) {
  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0c1424]/80 to-[#0a1020]/80 p-10 md:p-14 max-w-3xl mx-auto">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/30">
        <ShieldAlert className="h-5 w-5 text-orange-300" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">
        Your client workspace isn’t provisioned yet
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-white/65 max-w-xl">
        We confirmed your identity (<span className="text-white/80">{email ?? "—"}</span>), but your
        account isn’t yet linked to an IO SKY client organization. This usually
        means your onboarding is in flight or you’re signed in with a profile
        we use for a different surface.
      </p>

      <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.02] px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Detected role</p>
        <p className="mt-1 font-mono text-sm text-orange-200">{role}</p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Link href="/contact">
          <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
            <Mail className="h-4 w-4 mr-2" />
            Contact onboarding desk
          </Button>
        </Link>
        <Link href="/book-strategy">
          <Button
            variant="outline"
            className="border-white/15 bg-white/[0.02] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Book Discovery Call
          </Button>
        </Link>
      </div>

      <p className="mt-8 text-[11px] text-white/40">
        If you believe this is an error, our team can re-provision your client
        workspace within one business day. All access events are logged.
      </p>
    </div>
  );
}
