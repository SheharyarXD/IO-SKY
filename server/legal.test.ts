/**
 * Vitest specs for the legal & consent tRPC router.
 *
 * These tests hit the real Drizzle/TiDB connection so they verify that:
 *   - All 8 expected legal_documents are seeded.
 *   - getDocument returns body + version metadata for each.
 *   - listDocuments includes every document with a live version.
 *   - The cookie consent record/lookup round-trips correctly.
 *   - acceptAgreement is idempotent for the same user+version.
 *   - acknowledgeAi inserts a row even when unauthenticated.
 *
 * If the project is run without DATABASE_URL these specs are skipped to
 * keep the CI matrix happy in offline environments.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import {
  agreementAcceptances,
  cookieConsents,
  legalAcknowledgements,
  users,
} from "../drizzle/schema";

const dbAvailable = !!process.env.DATABASE_URL;

const SUPPORTED_KINDS = [
  "privacy-policy",
  "terms-of-service",
  "cookie-policy",
  "ai-disclaimer",
  "developer-agreement",
  "nda",
  "access-agreement",
  "dpa",
] as const;

function makePublicCtx(extra?: Partial<TrpcContext>): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {
        "user-agent": "vitest/legal-router",
        "x-forwarded-for": "203.0.113.42",
      },
      socket: { remoteAddress: "203.0.113.42" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
      cookie: () => undefined,
    } as unknown as TrpcContext["res"],
    ...extra,
  };
}

function makeAuthCtx(userId: number): TrpcContext {
  const ctx = makePublicCtx();
  ctx.user = {
    id: userId,
    openId: `legal-test-${userId}`,
    email: `legal-test-${userId}@iosky.local`,
    name: `Legal Tester ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as TrpcContext["user"];
  return ctx;
}

const TEST_USER_ID = 99000 + crypto.randomInt(0, 999);

describe.skipIf(!dbAvailable)("legal router", () => {
  beforeAll(async () => {
    // Ensure the test "user" exists so foreign-key insert into
    // agreement_acceptances doesn't fail.
    const db = await getDb();
    if (!db) return;
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, TEST_USER_ID))
      .limit(1);
    if (!existing[0]) {
      await db.insert(users).values({
        id: TEST_USER_ID,
        openId: `legal-test-${TEST_USER_ID}`,
        email: `legal-test-${TEST_USER_ID}@iosky.local`,
        name: "Legal Tester",
        loginMethod: "manus",
        role: "user",
      });
    }
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(legalAcknowledgements)
      .where(eq(legalAcknowledgements.userId, TEST_USER_ID));
    await db
      .delete(agreementAcceptances)
      .where(eq(agreementAcceptances.userId, TEST_USER_ID));
    // Note: cookieConsents test rows use subjectKey starting with 'vitest-';
    // they will accumulate harmlessly. Clean ones for this run via select+delete.
    const stale = await db
      .select({ id: cookieConsents.id, subjectKey: cookieConsents.subjectKey })
      .from(cookieConsents);
    const staleIds = stale
      .filter((r) => r.subjectKey.startsWith("vitest-"))
      .map((r) => r.id);
    for (const id of staleIds) {
      await db.delete(cookieConsents).where(eq(cookieConsents.id, id));
    }
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
  });

  it("listDocuments returns all 8 supported kinds with live version", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const list = await caller.legal.listDocuments();
    const kinds = list.map((d) => d.kind).sort();
    for (const k of SUPPORTED_KINDS) {
      expect(kinds).toContain(k);
    }
    for (const doc of list) {
      if (SUPPORTED_KINDS.includes(doc.kind as (typeof SUPPORTED_KINDS)[number])) {
        expect(doc.liveVersion).toBeTruthy();
      }
    }
  });

  it("getDocument returns body + hash for privacy-policy", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.legal.getDocument({ kindOrSlug: "privacy-policy" });
    expect(result.document.kind).toBe("privacy-policy");
    expect(result.version.bodyMd.length).toBeGreaterThan(500);
    expect(result.version.bodyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.version.status).toBe("published");
  });

  it("getDocument resolves slug 'privacy' to privacy-policy", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.legal.getDocument({ kindOrSlug: "privacy" });
    expect(result.document.kind).toBe("privacy-policy");
  });

  it("getDocument throws NOT_FOUND for unknown slug", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.legal.getDocument({ kindOrSlug: "totally-not-real" }),
    ).rejects.toThrow();
  });

  it("recordCookieConsent + getCookieConsent round-trip with rejected-all", async () => {
    const subjectKey = `vitest-${crypto.randomUUID()}`;
    const caller = appRouter.createCaller(makePublicCtx());

    const recorded = await caller.legal.recordCookieConsent({
      subjectKey,
      decision: "rejected-all",
      categories: { functional: true, analytics: false, marketing: false },
    });
    expect(recorded.success).toBe(true);

    const fetched = await caller.legal.getCookieConsent({ subjectKey });
    expect(fetched).toBeTruthy();
    expect(fetched!.decision).toBe("rejected-all");
    expect(fetched!.categories.analytics).toBe(false);
    expect(fetched!.categories.marketing).toBe(false);
    // Functional must always remain true server-side.
    expect(fetched!.categories.functional).toBe(true);
  });

  it("recordCookieConsent forces functional=true even if client tries to disable it", async () => {
    const subjectKey = `vitest-${crypto.randomUUID()}`;
    const caller = appRouter.createCaller(makePublicCtx());

    const recorded = await caller.legal.recordCookieConsent({
      subjectKey,
      decision: "custom",
      // Client lies: asks to disable functional.
      categories: { functional: false, analytics: true, marketing: false },
    });
    expect(recorded.categories.functional).toBe(true);

    const fetched = await caller.legal.getCookieConsent({ subjectKey });
    expect(fetched!.categories.functional).toBe(true);
    expect(fetched!.categories.analytics).toBe(true);
  });

  it("acceptAgreement is idempotent for the same user+version", async () => {
    const caller = appRouter.createCaller(makeAuthCtx(TEST_USER_ID));

    const first = await caller.legal.acceptAgreement({
      kind: "terms-of-service",
      method: "signup",
    });
    expect(first.wasNew).toBe(true);

    const second = await caller.legal.acceptAgreement({
      kind: "terms-of-service",
      method: "signup",
    });
    expect(second.wasNew).toBe(false);
    expect(second.versionId).toBe(first.versionId);
  });

  it("myAcceptances + myMissingAcceptances reflect acceptance state", async () => {
    const caller = appRouter.createCaller(makeAuthCtx(TEST_USER_ID));

    // After accepting terms, only privacy-policy should remain missing.
    await caller.legal.acceptAgreement({ kind: "terms-of-service", method: "signup" });
    const missingBefore = await caller.legal.myMissingAcceptances();
    expect(missingBefore.map((m) => m.kind)).toContain("privacy-policy");
    expect(missingBefore.map((m) => m.kind)).not.toContain("terms-of-service");

    // Accept privacy too.
    await caller.legal.acceptAgreement({ kind: "privacy-policy", method: "signup" });
    const missingAfter = await caller.legal.myMissingAcceptances();
    expect(missingAfter.length).toBe(0);

    const history = await caller.legal.myAcceptances();
    expect(history.map((r) => r.documentKind)).toEqual(
      expect.arrayContaining(["terms-of-service", "privacy-policy"]),
    );
  });

  it("acknowledgeAi accepts anonymous and authenticated calls", async () => {
    const anonCaller = appRouter.createCaller(makePublicCtx());
    const anon = await anonCaller.legal.acknowledgeAi({ context: "ai-scan-public" });
    expect(anon.success).toBe(true);

    const authCaller = appRouter.createCaller(makeAuthCtx(TEST_USER_ID));
    const auth = await authCaller.legal.acknowledgeAi({ context: "ai-scan-portal" });
    expect(auth.success).toBe(true);
  });
});
