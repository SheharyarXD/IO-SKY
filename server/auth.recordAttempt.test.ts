import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    impersonation: null,
    req: {
      headers: {},
      socket: {},
    } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.recordAttempt", () => {
  it("accepts 'supabase' as a valid provider (RM-50)", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.auth.recordAttempt({
        identifier: "person@example.com",
        provider: "supabase",
        outcome: "success",
        reason: "supabase-password",
      }),
    ).resolves.toBeDefined();
  });

  it("still accepts every pre-existing provider value", async () => {
    const caller = appRouter.createCaller(createContext());
    const providers = ["manus", "google", "microsoft", "apple", "magic-link", "credentials"] as const;
    for (const provider of providers) {
      await expect(
        caller.auth.recordAttempt({
          identifier: null,
          provider,
          outcome: "failed",
          reason: null,
        }),
      ).resolves.toBeDefined();
    }
  });

  it("rejects an unknown provider value", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.auth.recordAttempt({
        identifier: null,
        // @ts-expect-error - deliberately invalid provider for this test
        provider: "not-a-real-provider",
        outcome: "failed",
        reason: null,
      }),
    ).rejects.toThrow();
  });
});
