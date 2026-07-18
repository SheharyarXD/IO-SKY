/*
 * IO SKY — Legal & supporting pages.
 *
 * Two render paths:
 *
 *   1. Versioned legal documents (privacy, terms, cookies, ai-disclaimer,
 *      developer-agreement, nda, access-agreement, dpa) — fetched live from
 *      the database via `trpc.legal.getDocument`, rendered as markdown using
 *      Streamdown, and accompanied by an integrity footer (version, effective
 *      date, hash prefix) that auditors can compare against the seed file.
 *
 *   2. Static company surfaces (trust, status, careers, press, partners) —
 *      keep the original hardcoded content because they are editorial in
 *      nature, not legally versioned.
 *
 * The slug → kind map below is the canonical mapping used by both the URL
 * router and the database. Adding a new document is a 3-line change:
 *   a) seed the kind in `legal_documents`
 *   b) publish a version in `agreement_versions`
 *   c) add the slug → kind alias here.
 */
import { Link, useLocation, useParams } from "wouter";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import PageShell from "@/components/PageShell";
import { Skeleton } from "@/components/ui/skeleton";

/** URL slug → canonical legal_documents.kind */
const SLUG_TO_KIND: Record<string, string> = {
  privacy: "privacy-policy",
  "privacy-policy": "privacy-policy",
  terms: "terms-of-service",
  "terms-of-service": "terms-of-service",
  cookies: "cookie-policy",
  "cookie-policy": "cookie-policy",
  "ai-disclaimer": "ai-disclaimer",
  ai: "ai-disclaimer",
  "developer-agreement": "developer-agreement",
  nda: "nda",
  "access-agreement": "access-agreement",
  dpa: "dpa",
};

const STATIC_DOCS: Record<
  string,
  {
    title: string;
    intro: string;
    sections: { heading: string; body: string }[];
  }
> = {
  trust: {
    title: "Trust centre",
    intro:
      "Auditors, security reviewers and procurement teams: this is your starting point.",
    sections: [
      {
        heading: "Certifications",
        body: "Security and privacy controls. Documentation available under NDA.",
      },
      {
        heading: "Sub-processors",
        body: "Region-pinned, contractually bound, and listed in the trust portal with 30-day change notice.",
      },
      {
        heading: "Vulnerability disclosure",
        body: "Coordinated disclosure via security@io-sky.io. PGP fingerprint on /security.",
      },
    ],
  },
  status: {
    title: "System status",
    intro:
      "All IO SKY operational surfaces are running normally. Historical incidents are published with full root-cause analysis within 72 hours of resolution.",
    sections: [
      {
        heading: "Operational surfaces",
        body: "Cockpit · Risk continuum · Telemetry mesh · Intelligence calibration — all green.",
      },
      {
        heading: "Recent incidents",
        body: "No incidents in the past 30 days.",
      },
      {
        heading: "Subscribe",
        body: "Subscribe to status updates via RSS or webhook in the trust portal.",
      },
    ],
  },
  careers: {
    title: "Careers",
    intro:
      "We hire slowly and on principle. Most positions are filled by referral; a small number are open at any time.",
    sections: [
      {
        heading: "Who we look for",
        body: "Operators with audit instincts, engineers with executive temperament, and writers who think in evidence.",
      },
      {
        heading: "Where we work",
        body: "Amsterdam-anchored with a small distributed remote team. We meet quarterly in person.",
      },
      {
        heading: "How to reach us",
        body: "careers@io-sky.io — please include a one-page operating brief on yourself rather than a CV.",
      },
    ],
  },
  press: {
    title: "Press",
    intro:
      "We are deliberately quiet. Press enquiries are answered case-by-case by the founding team.",
    sections: [
      {
        heading: "Press contact",
        body: "press@io-sky.io · Response within two business days.",
      },
      {
        heading: "Brand",
        body: "Logo and colour assets available on request under our usage guidelines.",
      },
    ],
  },
  security: {
    title: "Security & governance",
    intro:
      "How IO SKY protects operational data, infrastructure and access. Detailed control documentation is available to customers and auditors under NDA.",
    sections: [
      {
        heading: "Data protection",
        body: "Encryption in transit and at rest, region-pinned storage and least-privilege access across all operational surfaces.",
      },
      {
        heading: "Access & identity",
        body: "Role-based access control, audit logging and scoped service credentials for every integration we operate.",
      },
      {
        heading: "Governance",
        body: "Change management, sub-processor oversight with 30-day change notice, and documented incident-response procedures.",
      },
      {
        heading: "Vulnerability disclosure",
        body: "Coordinated disclosure via security@io-sky.io. We acknowledge reports within two business days.",
      },
    ],
  },
  partners: {
    title: "Partners",
    intro:
      "IO SKY partners with a small set of advisory firms, infrastructure providers and audit specialists — never on resale, always on outcome.",
    sections: [
      {
        heading: "How partnership works",
        body: "Joint engagements with shared accountability. We do not run a reseller programme.",
      },
      { heading: "Partner contact", body: "partners@io-sky.io" },
    ],
  },
};

/**
 * Renders a versioned legal document fetched from the database.
 */
function VersionedDocument({ kind }: { kind: string }) {
  const { data, isLoading, error } = trpc.legal.getDocument.useQuery({
    kindOrSlug: kind,
    language: "en",
  });

  if (isLoading) {
    return (
      <PageShell
        eyebrowIndex="10"
        eyebrowLabel="LEGAL"
        title="Loading"
        intro="Fetching the latest published version of this document."
      >
        <div className="space-y-4 max-w-3xl">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell
        eyebrowIndex="10"
        eyebrowLabel="LEGAL"
        title="Document unavailable"
        intro="We could not load this legal document right now. Please try again in a moment, or contact privacy@io-sky.io."
      >
        <div className="max-w-3xl">
          <Link
            href="/legal/privacy"
            className="text-[14px] font-mono uppercase tracking-[0.18em] text-[#E6EAF080] hover:text-[#E6EAF0]"
          >
            ← Back to Privacy notice
          </Link>
        </div>
      </PageShell>
    );
  }

  const { document: doc, version } = data;
  const effectiveDate = version.effectiveFrom
    ? new Date(version.effectiveFrom).toISOString().slice(0, 10)
    : "—";
  const hashPrefix = version.bodyHash.slice(0, 16);

  return (
    <PageShell
      eyebrowIndex="10"
      eyebrowLabel={doc.title.toUpperCase()}
      title={doc.title}
      intro={`Version ${version.version} · Effective ${effectiveDate} · Jurisdiction ${(doc.jurisdiction ?? "NL").toUpperCase()}.`}
    >
      <div className="space-y-6 max-w-3xl">
        <article className="glass p-7 sm:p-9 prose prose-invert max-w-none [&_h1]:hidden [&_h2]:text-[20px] [&_h2]:font-display [&_h2]:font-medium [&_h2]:text-[#E6EAF0] [&_h3]:text-[16px] [&_h3]:font-display [&_h3]:font-medium [&_h3]:text-[#E6EAF0] [&_p]:text-[14.5px] [&_p]:text-[#E6EAF0B3] [&_p]:leading-[1.7] [&_li]:text-[14.5px] [&_li]:text-[#E6EAF0B3] [&_li]:leading-[1.7] [&_a]:text-[#FF7A1A] [&_strong]:text-[#E6EAF0] [&_blockquote]:border-l-2 [&_blockquote]:border-[#FF7A1A]/40 [&_blockquote]:pl-4 [&_blockquote]:text-[#E6EAF0CC] [&_hr]:border-[#E6EAF015] [&_table]:text-[13px] [&_th]:text-left [&_th]:py-2 [&_th]:pr-4 [&_th]:text-[#E6EAF0] [&_td]:py-2 [&_td]:pr-4 [&_td]:text-[#E6EAF0B3] [&_th]:border-b [&_th]:border-[#E6EAF020] [&_td]:border-b [&_td]:border-[#E6EAF010] [&_code]:bg-[#FFFFFF08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px]">
          <Streamdown>{version.bodyMd}</Streamdown>
        </article>

        <div className="border-t border-[#E6EAF015] pt-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E6EAF080]">
            [ Integrity footer ]
          </p>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[12px] font-mono text-[#E6EAF0B3]">
            <div>
              <dt className="text-[#E6EAF080] uppercase tracking-[0.16em]">
                Document
              </dt>
              <dd>{doc.kind}</dd>
            </div>
            <div>
              <dt className="text-[#E6EAF080] uppercase tracking-[0.16em]">
                Version
              </dt>
              <dd>{version.version}</dd>
            </div>
            <div>
              <dt className="text-[#E6EAF080] uppercase tracking-[0.16em]">
                Effective from
              </dt>
              <dd>{effectiveDate}</dd>
            </div>
            <div>
              <dt className="text-[#E6EAF080] uppercase tracking-[0.16em]">
                Body hash (sha-256)
              </dt>
              <dd className="break-all">{hashPrefix}…</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] text-[#E6EAF080] leading-relaxed">
            This footer is rendered server-side so auditors can verify the
            content they are reading matches the version recorded against
            their organisation's acceptance log. To request the original
            markdown source, email{" "}
            <a
              href="mailto:privacy@io-sky.io"
              className="text-[#FF7A1A] hover:underline"
            >
              privacy@io-sky.io
            </a>
            .
          </p>
        </div>
      </div>
    </PageShell>
  );
}

function StaticDocument({ slug }: { slug: string }) {
  const meta = STATIC_DOCS[slug] ?? {
    title: "Document not found",
    intro:
      "The legal document you requested is not available. Visit the trust centre for an index.",
    sections: [],
  };

  return (
    <PageShell
      eyebrowIndex="10"
      eyebrowLabel={meta.title.toUpperCase()}
      title={meta.title}
      intro={meta.intro}
    >
      <div className="space-y-6 max-w-3xl">
        {meta.sections.map((s) => (
          <section key={s.heading} className="glass p-6">
            <h2 className="text-[20px] font-display font-medium text-[#E6EAF0]">
              {s.heading}
            </h2>
            <p className="mt-2 text-[14.5px] text-[#E6EAF0B3] leading-[1.7]">
              {s.body}
            </p>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

export default function Legal() {
  const params = useParams<{ doc?: string }>();
  const [location] = useLocation();

  // Resolve the slug from either:
  //   /legal/:doc       → params.doc
  //   /privacy etc.     → first path segment of location
  const fromParam = (params.doc || "").toLowerCase().trim();
  const fromLocation = (location || "")
    .replace(/^\/+/, "")
    .split("/")[0]
    ?.toLowerCase()
    .trim();
  const slug = fromParam || fromLocation || "";
  const versionedKind = SLUG_TO_KIND[slug];

  if (versionedKind) {
    return <VersionedDocument kind={versionedKind} />;
  }
  return <StaticDocument slug={slug} />;
}
