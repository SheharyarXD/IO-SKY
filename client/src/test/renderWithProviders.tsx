/**
 * Milestone 3 §3.4 (RM-97) — shared render harness for component tests.
 *
 * Every page in this app expects three ambient providers: the language
 * context (`useT`), a tRPC client, and a react-query client. Rendering a page
 * without them throws inside the provider hook rather than failing on the
 * assertion, which makes the failure look like a component bug when it is
 * really a harness gap. This wraps all three once.
 *
 * The tRPC client points at a URL nothing serves. That is deliberate: these
 * are component tests, and a test that quietly reached a real API would be
 * neither hermetic nor fast. Tests that need a specific server response stub
 * the individual hook (see loginForm.test.tsx) rather than standing up a
 * transport.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { LanguageProvider } from "@/contexts/LanguageContext";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // No retries: a failing query should surface immediately as a failed
        // assertion, not after three silent backoffs and a test timeout.
        retry: false,
        gcTime: 0,
      },
      mutations: { retry: false },
    },
  });
}

export function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: "http://localhost/api/trpc", transformer: superjson })],
  });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>{children}</LanguageProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, { wrapper: TestProviders, ...options });
}

export * from "@testing-library/react";
