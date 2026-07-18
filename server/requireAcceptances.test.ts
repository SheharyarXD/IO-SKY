/**
 * Vitest specs for the requireAcceptances middleware exported from
 * server/_core/trpc.ts. We exercise the middleware in isolation by
 * building a tiny tRPC router that uses `acceptedProcedure`, then we
 * hit it with three contexts:
 *
 *   1. Anonymous          -> middleware lets the call through.
 *   2. Authenticated, no  -> FORBIDDEN with code "acceptance_missing:..."
 *      acceptances yet
 *   3. Authenticated, all -> success.
 *      acceptances on file
 *
 * If the project is run without DATABASE_URL these specs are skipped.
 */
import crypto from "node:crypto";
import { initTRPC } from "@trpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptedProcedure,
  publicProcedure,
  requireAcceptances,
  router,
} from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { recordAgreementAcceptance, getLiveAgreementVersion } from "./legalDb";
import {
  agreementAcceptances,
  legalAcknowledgements,
  users,
} from "../drizzle/schema";

const dbAvailable = !!process.env.DATABASE_URL;
const TEST_USER_ID = 99500 + crypto.randomInt(0, 499);

function makeCtx(userId: number | null): TrpcContext {
  return {
    user: userId
      ? ({
          id: userId,
          openId: `acc-${userId}`,
          email: `acc-${userId}@iosky.local`,
          name: `Acc ${userId}`,
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"])
      : null,
    req: {
      protocol: "https",
      headers: { "user-agent": "vitest/require-acceptances" },
      socket: { remoteAddress: "203.0.113.99" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
      cookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

const tinyRouter = router({
  // Public probe — should always succeed regardless of acceptance.
  ping: publicProcedure.query(() => "pong"),
  // Gated probe — requires Privacy + ToS acceptance, but allows
  // anonymous fall-through (because it's composed on publicProcedure).
  publicGated: publicProcedure
    .use(requireAcceptances(["privacy-policy", "terms-of-service"]))
    .query(() => "ok"),
  // Strict gated probe — protectedProcedure + acceptance check, so
  // anonymous calls are blocked at the auth layer first.
  protectedPing: acceptedProcedure.query(() => "ok"),
});

describe.skipIf(!dbAvailable)("requireAcceptances middleware", () => {
  beforeAll(async () => {
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
        openId: `acc-${TEST_USER_ID}`,
        email: `acc-${TEST_USER_ID}@iosky.local`,
        name: "Acceptance Tester",
        loginMethod: "manus",
        role: "user",
      });
    }
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(agreementAcceptances)
      .where(eq(agreementAcceptances.userId, TEST_USER_ID));
    await db
      .delete(legalAcknowledgements)
      .where(eq(legalAcknowledgements.userId, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
  });

  it("anonymous callers pass through publicProcedure-based gate", async () => {
    const caller = tinyRouter.createCaller(makeCtx(null));
    const out = await caller.publicGated();
    expect(out).toBe("ok");
  });

  it("anonymous callers are blocked by acceptedProcedure (auth layer first)", async () => {
    const caller = tinyRouter.createCaller(makeCtx(null));
    await expect(caller.protectedPing()).rejects.toThrow();
  });

  it("authenticated user without any acceptance is blocked", async () => {
    const caller = tinyRouter.createCaller(makeCtx(TEST_USER_ID));
    await expect(caller.protectedPing()).rejects.toMatchObject({
      message: expect.stringContaining("acceptance_missing"),
    });
  });

  it("blocked error names exactly the missing kinds", async () => {
    const caller = tinyRouter.createCaller(makeCtx(TEST_USER_ID));
    await expect(caller.protectedPing()).rejects.toMatchObject({
      message: expect.stringContaining("privacy-policy"),
    });
    await expect(caller.protectedPing()).rejects.toMatchObject({
      message: expect.stringContaining("terms-of-service"),
    });
  });

  it("authenticated user with full acceptance set passes", async () => {
    // Record acceptances directly via the DB helper.
    const privacy = await getLiveAgreementVersion("privacy-policy");
    const terms = await getLiveAgreementVersion("terms-of-service");
    expect(privacy).toBeTruthy();
    expect(terms).toBeTruthy();
    if (!privacy || !terms) return;

    await recordAgreementAcceptance({
      userId: TEST_USER_ID,
      versionId: privacy.version.id,
      documentKind: "privacy-policy",
      method: "signup",
    });
    await recordAgreementAcceptance({
      userId: TEST_USER_ID,
      versionId: terms.version.id,
      documentKind: "terms-of-service",
      method: "signup",
    });

    const caller = tinyRouter.createCaller(makeCtx(TEST_USER_ID));
    const out = await caller.protectedPing();
    expect(out).toBe("ok");
  });

  it("requireAcceptances([]) is a no-op gate", async () => {
    const t = initTRPC.context<TrpcContext>().create();
    const noopRouter = t.router({
      probe: t.procedure.use(requireAcceptances([])).query(() => "ok"),
    });
    const caller = noopRouter.createCaller(makeCtx(TEST_USER_ID));
    const out = await caller.probe();
    expect(out).toBe("ok");
  });
});
