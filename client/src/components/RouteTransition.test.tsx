/**
 * RouteTransition must not be a containing block at rest.
 *
 * This component wraps the entire routed tree. A `transform` (even an
 * identity one) or a non-auto `will-change` makes an element the containing
 * block for every `position: fixed` DESCENDANT, so leaving either applied at
 * rest re-anchors every fixed element in the app to this wrapper instead of
 * the viewport.
 *
 * What that actually caused, measured in a real browser before the fix:
 *   - the site header stopped being fixed and scrolled away with the page
 *     (its top was at -1200px after scrolling 1200px, on every viewport);
 *   - the mobile nav drawer, sized `top-[68px] bottom-0`, resolved `bottom`
 *     against a ~9700px page wrapper and became 9669px tall on a 667px
 *     screen, putting its language buttons and both calls to action below
 *     the fold with no way to scroll to them.
 *
 * Both were reported as separate visual bugs. They were the same two CSS
 * properties. This test exists so neither can come back quietly.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/lib/debugLog", () => ({
  debugLog: { log: vi.fn() },
}));

import RouteTransition from "./RouteTransition";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function wrapperOf(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe("RouteTransition", () => {
  it("carries no transform and no will-change once settled", () => {
    vi.useFakeTimers();
    const { container } = render(
      <RouteTransition>
        <div>page</div>
      </RouteTransition>,
    );

    // Let the entrance run to completion.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const el = wrapperOf(container);
    // Asserting on the inline style rather than getComputedStyle: jsdom does
    // not compute a used value for transform, and the inline declaration is
    // what actually reaches the browser here.
    expect(el.style.transform, "a transform at rest re-anchors every fixed child").toBe("");
    expect(el.style.willChange, "will-change at rest does the same").toBe("");
    expect(el.style.transition).toBe("");
  });

  it("is fully opaque once settled, so content is never left invisible", () => {
    vi.useFakeTimers();
    const { container } = render(
      <RouteTransition>
        <div>page</div>
      </RouteTransition>,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(wrapperOf(container).style.opacity).toBe("1");
  });

  it("settles even if the transition never fires", () => {
    // The settle is driven by a timer rather than `transitionend`, because
    // that event does not fire when a transition is interrupted or never
    // starts. A wrapper stuck in the transformed state would silently break
    // the header again, which is precisely the failure mode being guarded.
    vi.useFakeTimers();
    const { container } = render(
      <RouteTransition>
        <div>page</div>
      </RouteTransition>,
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(wrapperOf(container).style.transform).toBe("");
  });

  it("renders its children", () => {
    const { getByText } = render(
      <RouteTransition>
        <div>page content</div>
      </RouteTransition>,
    );
    expect(getByText("page content")).toBeTruthy();
  });
});
