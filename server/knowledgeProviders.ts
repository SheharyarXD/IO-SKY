/**
 * Knowledge providers backed by data the platform already holds (task G05).
 *
 * Only `client_documentation` exists today, and it searches document METADATA
 * (name, category, version, status), not file contents: no text is extracted
 * from stored files yet. Every other SRS 19.20 source has no data behind it and
 * is deliberately NOT registered, so retrieval reports it as unavailable.
 */
import { clientMayViewDocument } from "../shared/platformRules";
import type { KnowledgeItem, KnowledgeProvider } from "./knowledgeStore";

type DocRow = {
  id: number;
  organizationId: number;
  name: string;
  category: string;
  documentType: string | null;
  version: number;
  status: string;
};

/**
 * A document becomes a knowledge item. It is 'client' visible only if it is
 * approved AND the document matrix opens its type to clients (fail closed when
 * the matrix is unreadable); everything else is 'internal'.
 */
export function documentToKnowledgeItem(doc: DocRow, clientVisibleTypes: ReadonlySet<string> | null): KnowledgeItem {
  const clientVisible = doc.status === "approved" && clientMayViewDocument(doc, clientVisibleTypes);
  return {
    id: `doc:${doc.id}`,
    title: doc.name,
    snippet: `${doc.category} · version ${doc.version} · ${doc.status.replace(/_/g, " ")}`,
    sourceRef: `client_documents:${doc.id}`,
    visibility: clientVisible ? "client" : "internal",
    organizationId: doc.organizationId,
  };
}

export function clientDocumentationProvider(deps: {
  searchDocuments(a: { organizationId: number | null; q: string; limit?: number }): Promise<DocRow[]>;
  clientVisibleDocumentTypes(): Promise<Set<string> | null>;
}): KnowledgeProvider {
  return {
    source: "client_documentation",
    async search({ query, organizationId, limit }) {
      if (organizationId === null) return []; // never a platform-wide document search from an agent
      const [rows, allowed] = await Promise.all([deps.searchDocuments({ organizationId, q: query, limit: limit * 3 }), deps.clientVisibleDocumentTypes()]);
      return rows.map((r) => documentToKnowledgeItem(r, allowed));
    },
  };
}
