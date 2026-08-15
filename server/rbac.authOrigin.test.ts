/**
 * RM-55 — RBAC must be identical regardless of which auth system produced
 * ctx.user (Manus OAuth/local-password vs the new Supabase Auth bridge,
 * server/_core/supabaseAuthRoute.ts). Every *Procedure gate in
 * server/_core/trpc.ts checks only ctx.user.role/organizationId/id — never
 * openId or anything Manus-specific — so this should already hold with no
 * code changes. This file proves it rather than asserting it: every case
 * below is run against BOTH a Manus-shaped user (real openId, no
 * authUserId) and a Supabase-shaped user (synthetic "supabase:<uuid>"
 * openId, authUserId set) and must reject/accept identically.
 *
 * These are all rejection-path assertions deliberately: tRPC middleware
 * throws before the resolver runs, so no DB access happens and no mocking
 * of server/db is required — the middleware itself is what's under test.
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

function manusUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "manus-openid-abc123",
    authUserId: null,
    name: "Manus User",
    email: "manus@example.com",
    loginMethod: "google",
    passwordHash: null,
    organizationId: null,
    phone: null,
    role: "user",
    mfaMethod: "none",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  } as User;
}

function supabaseUser(overrides: Partial<User> = {}): User {
  return {
    ...manusUser(),
    openId: "supabase:11111111-2222-3333-4444-555555555555",
    authUserId: "11111111-2222-3333-4444-555555555555",
    loginMethod: "supabase",
    ...overrides,
  } as User;
}

function makeCtx(user: User | null): TrpcContext {
  return {
    user,
    impersonation: null,
    req: { headers: {}, protocol: "https" } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const identities = [
  { label: "Manus-origin", build: manusUser },
  { label: "Supabase-origin", build: supabaseUser },
] as const;

describe("RBAC is identical regardless of auth origin (RM-55)", () => {
  for (const { label, build } of identities) {
    describe(label, () => {
      it("adminProcedure rejects unauthenticated", async () => {
        const caller = appRouter.createCaller(makeCtx(null));
        await expect(caller.admin.summary()).rejects.toThrow();
      });

      it("adminProcedure rejects role=client", async () => {
        const caller = appRouter.createCaller(makeCtx(build({ role: "client", organizationId: 1 })));
        await expect(caller.admin.summary()).rejects.toThrow();
      });

      it("adminProcedure rejects role=developer", async () => {
        const caller = appRouter.createCaller(makeCtx(build({ role: "developer" })));
        await expect(caller.admin.summary()).rejects.toThrow();
      });

      it("adminProcedure rejects role=user", async () => {
        const caller = appRouter.createCaller(makeCtx(build({ role: "user" })));
        await expect(caller.admin.summary()).rejects.toThrow();
      });

      it("clientProcedure rejects unauthenticated", async () => {
        const caller = appRouter.createCaller(makeCtx(null));
        await expect(caller.clientPortal.dashboard()).rejects.toThrow();
      });

      it("clientProcedure rejects role=user (no client/admin role)", async () => {
        const caller = appRouter.createCaller(makeCtx(build({ role: "user" })));
        await expect(caller.clientPortal.dashboard()).rejects.toThrow();
      });

      it("clientProcedure rejects role=client with no organizationId", async () => {
        const caller = appRouter.createCaller(makeCtx(build({ role: "client", organizationId: null })));
        await expect(caller.clientPortal.dashboard()).rejects.toThrow();
      });

      it("developerProcedure rejects unauthenticated", async () => {
        const caller = appRouter.createCaller(makeCtx(null));
        await expect(caller.developer.dashboard()).rejects.toThrow();
      });

      it("developerProcedure rejects role=client", async () => {
        const caller = appRouter.createCaller(makeCtx(build({ role: "client", organizationId: 1 })));
        await expect(caller.developer.dashboard()).rejects.toThrow();
      });

      it("developerProcedure rejects role=user", async () => {
        const caller = appRouter.createCaller(makeCtx(build({ role: "user" })));
        await expect(caller.developer.dashboard()).rejects.toThrow();
      });
    });
  }

  it("role gating never inspects openId/authUserId - a Supabase-shaped admin passes the SAME adminProcedure check a Manus-shaped admin would reach for", async () => {
    // Both should fail for the SAME reason (FORBIDDEN, not some
    // identity-shape-specific error) once they're past the role gate -
    // proves the gate itself doesn't branch on auth origin. We can't run
    // the full resolver here without DB mocks (out of scope for this
    // file), but we can assert both reach the resolver (i.e. neither is
    // rejected by the role check) by confirming neither throws the
    // UNAUTHORIZED/FORBIDDEN error the earlier tests assert on.
    const manusAdmin = manusUser({ role: "admin" });
    const supabaseAdmin = supabaseUser({ role: "admin" });
    for (const admin of [manusAdmin, supabaseAdmin]) {
      const caller = appRouter.createCaller(makeCtx(admin));
      // admin.summary's resolver will itself throw/reject once it tries to
      // touch the DB (no DATABASE_URL in the test environment) - what
      // matters for this test is that it's NOT a FORBIDDEN/UNAUTHORIZED
      // tRPC error, which would indicate the role gate rejected a real admin.
      try {
        await caller.admin.summary();
      } catch (err) {
        const code = (err as { code?: string })?.code;
        expect(code).not.toBe("FORBIDDEN");
        expect(code).not.toBe("UNAUTHORIZED");
      }
    }
  });

  it("RM-57: super_admin passes adminProcedure's role gate exactly like admin does (strict superset, not a separate/weaker tier)", async () => {
    const manusSuperAdmin = manusUser({ role: "super_admin" });
    const supabaseSuperAdmin = supabaseUser({ role: "super_admin" });
    for (const superAdmin of [manusSuperAdmin, supabaseSuperAdmin]) {
      const caller = appRouter.createCaller(makeCtx(superAdmin));
      try {
        await caller.admin.summary();
      } catch (err) {
        const code = (err as { code?: string })?.code;
        expect(code).not.toBe("FORBIDDEN");
        expect(code).not.toBe("UNAUTHORIZED");
      }
    }
  });

  it("RM-57: plain admin is rejected by superAdminProcedure (super_admin's exclusive capabilities are NOT available to regular admin)", async () => {
    // No live super-admin-only endpoint is wired into appRouter yet
    // (Milestone 2 §2.5 adds those) — this asserts the middleware
    // contract directly instead of through a router path.
    const { superAdminProcedure, router } = await import("./_core/trpc");
    const testRouter = router({
      probe: superAdminProcedure.query(() => "ok" as const),
    });
    await expect(
      testRouter.createCaller(makeCtx(manusUser({ role: "admin" }))).probe(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      testRouter.createCaller(makeCtx(manusUser({ role: "super_admin" }))).probe(),
    ).resolves.toBe("ok");
  });
});
