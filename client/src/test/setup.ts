/**
 * Milestone 3 §3.4 (RM-97) — shared test setup.
 *
 * Loaded by every test file via vitest.config.ts `setupFiles`. It must stay
 * safe to import under the `node` environment as well as `jsdom`, because the
 * server suite shares the same setup entry — hence the `typeof document`
 * guards rather than unconditional DOM work.
 */
import { afterEach, expect, vi } from "vitest";

const isDom = typeof document !== "undefined";

if (isDom) {
  // jest-dom matchers (toBeInTheDocument, toBeDisabled, ...). Imported
  // dynamically so the server suite never pulls in a DOM-only package.
  const matchers = await import("@testing-library/jest-dom/matchers");
  expect.extend(matchers.default ?? matchers);

  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });

  // jsdom implements neither of these, and Radix/framer-motion touch both on
  // mount. Without the stubs, component tests fail on the render rather than
  // on anything the test is actually asserting.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      root = null;
      rootMargin = "";
      thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}
