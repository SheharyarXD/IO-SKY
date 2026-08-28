/*
 * IO SKY — Security page.
 * Discoverable from the footer per spec. Holds posture, certifications and
 * disclosure contact in one calm executive document.
 */
import PageShell from "@/components/PageShell";
import { Lock, ShieldCheck, FileCheck2, KeyRound } from "lucide-react";

const POSTURE = [
  { icon: Lock, title: "Encryption", body: "AES-256 at rest, TLS 1.3 in transit. Per-tenant keys, hardware-isolated, rotated quarterly with published cadence." },
  { icon: ShieldCheck, title: "Tamper-evidence", body: "Append-only audit ledger across the data plane. Every signal has a verifiable chain of custody." },
  { icon: FileCheck2, title: "Compliance", body: "Security and privacy controls. Documentation available under NDA via the trust portal." },
  { icon: KeyRound, title: "Identity", body: "SAML 2.0 / OIDC SSO, SCIM provisioning, hardware key support. No shared credentials, ever." },
];

export default function Security() {
  return (
    <PageShell
      eyebrowIndex="11"
      eyebrowLabel="Security"
      title="Security as an operating principle, not a checklist."
      intro="IO SKY is built for organisations whose auditors, regulators and operators are in the room together. Our security posture is published, reviewable and contractually bound."
    >
      <div className="grid md:grid-cols-2 gap-5 max-w-4xl">
        {POSTURE.map((p) => (
          <div key={p.title} className="glass p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-md border border-white/10 bg-white/[0.02] flex items-center justify-center">
                <p.icon className="w-4.5 h-4.5 text-[#FF7A00]" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-[18px] font-display font-medium text-[#E6EAF0]">{p.title}</h3>
                <p className="mt-2 text-[13.5px] text-[#E6EAF0B3] leading-[1.65]">{p.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="glass p-7 mt-10 max-w-3xl">
        <h2 className="text-[22px] font-display font-medium text-[#E6EAF0]">Coordinated vulnerability disclosure</h2>
        <p className="mt-3 text-[14.5px] text-[#E6EAF0B3] leading-[1.7]">
          We welcome reports from the security community. Please disclose
          responsibly to <a href="mailto:security@io-sky.io" className="text-[#FF7A00] hover:underline">security@io-sky.io</a>.
          PGP fingerprint and rules of engagement are published in the trust portal.
        </p>
        <div className="mt-5 inline-block px-3 py-2 rounded-md border border-white/10 bg-white/[0.02] font-mono text-[12px] text-[#E6EAF0] tracking-wide">
          PGP · 9F2E 4A1B 7C3D 5E8F · A1B2 C3D4 E5F6 0789
        </div>
      </section>
    </PageShell>
  );
}
