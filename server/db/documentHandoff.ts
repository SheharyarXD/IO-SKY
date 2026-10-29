/**
 * server/db/documentHandoff.ts (tasks J09, J10). Persistence for the controlled
 * document handoff. The rules that decide are in shared/documentHandoff.ts; this
 * file only reads the facts and writes the records.
 *
 * Fails closed: a developer-facing read that errors (including because migration
 * 0041 is not applied yet) returns nothing, never a document.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  clientDocuments,
  clientProjects,
  developerProjectAssignments,
  developerProjectLinks,
  developerProjects,
  documentReleaseEvents,
  documentReleases,
  projectDocuments,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { isUniqueViolation } from "./bookings";

// ---- client side: file a document under the client's own project (J09) --------------------------------------------

export async function associateDocumentWithProject(a: { documentId: number; clientProjectId: number; organizationId: number; userId: number }): Promise<"ok" | "document_not_found" | "project_not_found" | "unavailable"> {
  const db = await getDb();
  if (!db) return "unavailable";
  // Both must belong to the caller's organisation; another organisation's id is simply "not found".
  const doc = (await db.select({ id: clientDocuments.id }).from(clientDocuments).where(and(eq(clientDocuments.id, a.documentId), eq(clientDocuments.organizationId, a.organizationId))).limit(1))[0];
  if (!doc) return "document_not_found";
  const project = (await db.select({ id: clientProjects.id }).from(clientProjects).where(and(eq(clientProjects.id, a.clientProjectId), eq(clientProjects.organizationId, a.organizationId))).limit(1))[0];
  if (!project) return "project_not_found";
  await db.insert(projectDocuments).values({ documentId: a.documentId, clientProjectId: a.clientProjectId, associatedByUserId: a.userId }).onConflictDoNothing();
  return "ok";
}

export async function listDocumentsForClientProject(organizationId: number, clientProjectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: clientDocuments.id, name: clientDocuments.name, category: clientDocuments.category, status: clientDocuments.status, version: clientDocuments.version, createdAt: clientDocuments.createdAt })
    .from(projectDocuments)
    .innerJoin(clientDocuments, eq(clientDocuments.id, projectDocuments.documentId))
    .innerJoin(clientProjects, eq(clientProjects.id, projectDocuments.clientProjectId))
    .where(and(eq(projectDocuments.clientProjectId, clientProjectId), eq(clientProjects.organizationId, organizationId), eq(clientDocuments.organizationId, organizationId)))
    .orderBy(desc(clientDocuments.createdAt));
}

// ---- staff side: the link, the release, the revocation ----------------------------------------------------------

export async function linkDeveloperProject(a: { developerProjectId: number; clientProjectId: number; userId: number }): Promise<"ok" | "developer_project_not_found" | "client_project_not_found" | "unavailable"> {
  const db = await getDb();
  if (!db) return "unavailable";
  if (!(await db.select({ id: developerProjects.id }).from(developerProjects).where(eq(developerProjects.id, a.developerProjectId)).limit(1))[0]) return "developer_project_not_found";
  if (!(await db.select({ id: clientProjects.id }).from(clientProjects).where(eq(clientProjects.id, a.clientProjectId)).limit(1))[0]) return "client_project_not_found";
  await db.insert(developerProjectLinks).values({ developerProjectId: a.developerProjectId, clientProjectId: a.clientProjectId, linkedByUserId: a.userId }).onConflictDoNothing();
  return "ok";
}

/**
 * Remove a link. Releases that depended on it stop being allowed: every active
 * release into the developer project of a document from the unlinked project's
 * organisation is revoked, unless another remaining link still covers that organisation.
 */
export async function unlinkDeveloperProject(a: { developerProjectId: number; clientProjectId: number; userId: number }): Promise<{ removed: boolean; revoked: number }> {
  const db = await getDb();
  if (!db) return { removed: false, revoked: 0 };
  return db.transaction(async (tx) => {
    const org = (await tx.select({ organizationId: clientProjects.organizationId }).from(clientProjects).where(eq(clientProjects.id, a.clientProjectId)).limit(1))[0]?.organizationId;
    const removed = await tx.delete(developerProjectLinks).where(and(eq(developerProjectLinks.developerProjectId, a.developerProjectId), eq(developerProjectLinks.clientProjectId, a.clientProjectId))).returning({ id: developerProjectLinks.id });
    if (removed.length === 0 || org === undefined) return { removed: removed.length > 0, revoked: 0 };
    const stillCovered = await tx
      .select({ id: developerProjectLinks.id })
      .from(developerProjectLinks)
      .innerJoin(clientProjects, eq(clientProjects.id, developerProjectLinks.clientProjectId))
      .where(and(eq(developerProjectLinks.developerProjectId, a.developerProjectId), eq(clientProjects.organizationId, org)))
      .limit(1);
    if (stillCovered.length > 0) return { removed: true, revoked: 0 };
    const affected = await tx
      .select({ id: documentReleases.id, documentId: documentReleases.documentId })
      .from(documentReleases)
      .innerJoin(clientDocuments, eq(clientDocuments.id, documentReleases.documentId))
      .where(and(eq(documentReleases.developerProjectId, a.developerProjectId), eq(documentReleases.status, "released"), eq(clientDocuments.organizationId, org)));
    if (affected.length === 0) return { removed: true, revoked: 0 };
    await tx.update(documentReleases).set({ status: "revoked", revokedByUserId: a.userId, revokedAt: new Date() }).where(inArray(documentReleases.id, affected.map((r) => r.id)));
    await tx.insert(documentReleaseEvents).values(affected.map((r) => ({ documentId: r.documentId, developerProjectId: a.developerProjectId, event: "revoked", actorUserId: a.userId, note: "The project link was removed." })));
    return { removed: true, revoked: affected.length };
  });
}

/** Everything evaluateRelease needs, in one read. Null when the document or developer project does not exist. */
export async function getReleaseFacts(a: { documentId: number; developerProjectId: number }) {
  const db = await getDb();
  if (!db) return null;
  const doc = (await db.select({ id: clientDocuments.id, organizationId: clientDocuments.organizationId, status: clientDocuments.status, name: clientDocuments.name }).from(clientDocuments).where(eq(clientDocuments.id, a.documentId)).limit(1))[0];
  if (!doc) return null;
  if (!(await db.select({ id: developerProjects.id }).from(developerProjects).where(eq(developerProjects.id, a.developerProjectId)).limit(1))[0]) return null;
  const links = await db
    .select({ organizationId: clientProjects.organizationId })
    .from(developerProjectLinks)
    .innerJoin(clientProjects, eq(clientProjects.id, developerProjectLinks.clientProjectId))
    .where(eq(developerProjectLinks.developerProjectId, a.developerProjectId));
  const active = await db.select({ id: documentReleases.id }).from(documentReleases).where(and(eq(documentReleases.documentId, a.documentId), eq(documentReleases.developerProjectId, a.developerProjectId), eq(documentReleases.status, "released"))).limit(1);
  return { document: doc, linkedProjectOrganizationIds: [...new Set(links.map((l) => l.organizationId))], alreadyReleased: active.length > 0 };
}

export async function createRelease(a: { documentId: number; developerProjectId: number; userId: number; note: string | null }): Promise<{ id: number } | "already_released" | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx.insert(documentReleases).values({ documentId: a.documentId, developerProjectId: a.developerProjectId, releasedByUserId: a.userId, note: a.note }).returning({ id: documentReleases.id });
      await tx.insert(documentReleaseEvents).values({ documentId: a.documentId, developerProjectId: a.developerProjectId, event: "released", actorUserId: a.userId, note: a.note });
      return { id: rows[0]!.id };
    });
  } catch (err) {
    // The partial unique index allows one active release per document and project, even under a race.
    if (isUniqueViolation(err)) return "already_released";
    throw err;
  }
}

export async function revokeRelease(a: { releaseId: number; userId: number; note: string | null }): Promise<{ documentId: number; developerProjectId: number } | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(documentReleases)
      .set({ status: "revoked", revokedByUserId: a.userId, revokedAt: new Date() })
      .where(and(eq(documentReleases.id, a.releaseId), eq(documentReleases.status, "released")))
      .returning({ documentId: documentReleases.documentId, developerProjectId: documentReleases.developerProjectId });
    const r = rows[0];
    if (!r) return null;
    await tx.insert(documentReleaseEvents).values({ documentId: r.documentId, developerProjectId: r.developerProjectId, event: "revoked", actorUserId: a.userId, note: a.note });
    return r;
  });
}

export async function listReleases(filter: { developerProjectId?: number; documentId?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conds = [];
  if (filter.developerProjectId) conds.push(eq(documentReleases.developerProjectId, filter.developerProjectId));
  if (filter.documentId) conds.push(eq(documentReleases.documentId, filter.documentId));
  return db
    .select({
      id: documentReleases.id,
      documentId: documentReleases.documentId,
      documentName: clientDocuments.name,
      organizationId: clientDocuments.organizationId,
      developerProjectId: documentReleases.developerProjectId,
      status: documentReleases.status,
      note: documentReleases.note,
      releasedAt: documentReleases.releasedAt,
      revokedAt: documentReleases.revokedAt,
    })
    .from(documentReleases)
    .innerJoin(clientDocuments, eq(clientDocuments.id, documentReleases.documentId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(documentReleases.releasedAt))
    .limit(200);
}

/** The developers actively assigned to a developer project, to tell them a document arrived. */
export async function listActiveAssignedDeveloperIds(developerProjectId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ developerId: developerProjectAssignments.developerId }).from(developerProjectAssignments).where(and(eq(developerProjectAssignments.projectId, developerProjectId), eq(developerProjectAssignments.status, "active")));
  return rows.map((r) => r.developerId);
}

// ---- developer side: only what was released, only into projects they are on -------------------------------------

const developerVisibleDocuments = (developerId: number) => ({
  assigned: and(eq(developerProjectAssignments.developerId, developerId), eq(developerProjectAssignments.status, "active")),
  released: eq(documentReleases.status, "released"),
  approved: eq(clientDocuments.status, "approved"),
});

/** Released documents for a developer's active projects. No file keys and no organisation. Errors return nothing. */
export async function listReleasedDocumentsForDeveloper(developerId: number) {
  try {
    const db = await getDb();
    if (!db) return [];
    const w = developerVisibleDocuments(developerId);
    return await db
      .select({
        id: clientDocuments.id,
        name: clientDocuments.name,
        category: clientDocuments.category,
        mimeType: clientDocuments.mimeType,
        sizeBytes: clientDocuments.sizeBytes,
        version: clientDocuments.version,
        developerProjectId: documentReleases.developerProjectId,
        releasedAt: documentReleases.releasedAt,
      })
      .from(documentReleases)
      .innerJoin(developerProjectAssignments, and(eq(developerProjectAssignments.projectId, documentReleases.developerProjectId), w.assigned))
      .innerJoin(clientDocuments, eq(clientDocuments.id, documentReleases.documentId))
      .where(and(w.released, w.approved))
      .orderBy(desc(documentReleases.releasedAt))
      .limit(200);
  } catch (err) {
    console.error("[documentHandoff] could not list released documents, returning none:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** One released document with its storage key, only if the developer is actively on a project it was released into. */
export async function getReleasedDocumentForDeveloper(a: { developerId: number; documentId: number }) {
  try {
    const db = await getDb();
    if (!db) return null;
    const w = developerVisibleDocuments(a.developerId);
    const rows = await db
      .select({ id: clientDocuments.id, name: clientDocuments.name, mimeType: clientDocuments.mimeType, fileKey: clientDocuments.fileKey, developerProjectId: documentReleases.developerProjectId })
      .from(documentReleases)
      .innerJoin(developerProjectAssignments, and(eq(developerProjectAssignments.projectId, documentReleases.developerProjectId), w.assigned))
      .innerJoin(clientDocuments, eq(clientDocuments.id, documentReleases.documentId))
      .where(and(eq(documentReleases.documentId, a.documentId), w.released, w.approved))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error("[documentHandoff] could not check document access, denying:", err instanceof Error ? err.message : err);
    return null;
  }
}


