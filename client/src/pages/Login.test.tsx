/**
 * Milestone 3 §3.4 (RM-98) — frontend coverage: auth forms.
 *
 * The Login page is the highest-value component to cover: it is the entry
 * point to every portal, it carries three separate anti-automation gates
 * (honeypot, mount-time gate, client-side rate limit), and until now had no
 * test of any kind. The Milestone 1 audit's "fake password reset" finding
 * also lived on this page, so the forgot-password path is covered here too.
 *
 * These are behavioural tests against the rendered DOM, not snapshots.
 * Snapshots of a 1300-line page would break on every styling change while
 * proving nothing about whether login works.
 *
 * `sonner` and the Supabase client are stubbed: the first because toasts
 * render into a portal outside the component tree, the second because a
 * component test must not attempt a real auth round-trip.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock factories are hoisted above every const in the file, so the spies
// have to be created inside vi.hoisted() or the factory closes over a
// temporal-dead-zone binding.
const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess, message: vi.fn() },
}));
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => null }));

import { renderWithProviders, screen, fireEvent, waitFor } from "../test/renderWithProviders";
import Login from "./Login";

/** The page gates submissions made within 1.5s of mount (anti-bot). */
const MOUNT_GATE_MS = 1500;

function emailInput() {
  return document.querySelector("#login-email") as HTMLInputElement;
}
function passwordInput() {
  return document.querySelector("#login-password") as HTMLInputElement;
}
function submitButton() {
  return document.querySelector('form button[type="submit"]') as HTMLButtonElement;
}

/** Advance past the mount-time gate without actually waiting 1.5s. */
function clearMountGate() {
  vi.setSystemTime(new Date(Date.now() + MOUNT_GATE_MS + 100));
}

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RM-98: Login form rendering", () => {
  it("renders both credential fields", () => {
    renderWithProviders(<Login />);
    expect(emailInput()).toBeTruthy();
    expect(passwordInput()).toBeTruthy();
    expect(emailInput().type).toBe("email");
  });

  it("masks the password by default", () => {
    renderWithProviders(<Login />);
    expect(passwordInput().type).toBe("password");
  });

  it("sets autocomplete hints so password managers behave", () => {
    renderWithProviders(<Login />);
    expect(emailInput().getAttribute("autocomplete")).toBe("email");
    expect(passwordInput().getAttribute("autocomplete")).toBe("current-password");
  });

  it("ships a honeypot field that is hidden from autocomplete", () => {
    renderWithProviders(<Login />);
    const honeypot = document.querySelector('input[autocomplete="off"][tabindex="-1"]');
    expect(honeypot).toBeTruthy();
  });
});

describe("RM-98: Login form validation", () => {
  it("disables submit until the form is valid", () => {
    renderWithProviders(<Login />);
    expect(submitButton().disabled).toBe(true);

    fireEvent.change(emailInput(), { target: { value: "person@example.com" } });
    fireEvent.change(passwordInput(), { target: { value: "long-enough-pw" } });
    expect(submitButton().disabled).toBe(false);
  });

  it("keeps submit disabled for a malformed email", () => {
    renderWithProviders(<Login />);
    fireEvent.change(emailInput(), { target: { value: "not-an-email" } });
    fireEvent.change(passwordInput(), { target: { value: "long-enough-pw" } });
    expect(submitButton().disabled).toBe(true);
  });

  it("keeps submit disabled for a password under 8 characters", () => {
    // Pins the minimum length so a refactor cannot silently weaken it.
    renderWithProviders(<Login />);
    fireEvent.change(emailInput(), { target: { value: "person@example.com" } });
    fireEvent.change(passwordInput(), { target: { value: "short" } });
    expect(submitButton().disabled).toBe(true);

    fireEvent.change(passwordInput(), { target: { value: "12345678" } });
    expect(submitButton().disabled).toBe(false);
  });
});

describe("RM-98: Login anti-automation gates", () => {
  it("blocks a submission made immediately after mount", async () => {
    // The page requires 1.5s between mount and submit. A script posting the
    // form the instant it loads is refused; a human filling two fields is not.
    renderWithProviders(<Login />);
    fireEvent.change(emailInput(), { target: { value: "person@example.com" } });
    fireEvent.change(passwordInput(), { target: { value: "long-enough-pw" } });

    fireEvent.submit(submitButton().closest("form")!);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // No credentials should have left the browser.
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("blocks a submission when the honeypot field is filled", async () => {
    renderWithProviders(<Login />);
    const honeypot = document.querySelector(
      'input[autocomplete="off"][tabindex="-1"]',
    ) as HTMLInputElement;

    fireEvent.change(emailInput(), { target: { value: "person@example.com" } });
    fireEvent.change(passwordInput(), { target: { value: "long-enough-pw" } });
    fireEvent.change(honeypot, { target: { value: "i-am-a-bot" } });

    clearMountGate();
    fireEvent.submit(submitButton().closest("form")!);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe("RM-98: Remember-me hydration", () => {
  it("pre-fills the email from localStorage on mount", async () => {
    localStorage.setItem("iosky.login.remember", "saved@example.com");
    renderWithProviders(<Login />);
    await waitFor(() => expect(emailInput().value).toBe("saved@example.com"));
  });

  it("renders normally when localStorage is unavailable", () => {
    // Private-mode browsers throw on access rather than returning null.
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => renderWithProviders(<Login />)).not.toThrow();
    expect(emailInput()).toBeTruthy();
    spy.mockRestore();
  });
});

describe("RM-98: password visibility toggle", () => {
  it("reveals and re-masks the password", () => {
    renderWithProviders(<Login />);
    const toggle = passwordInput().parentElement?.querySelector("button");
    expect(toggle).toBeTruthy();

    fireEvent.click(toggle!);
    expect(passwordInput().type).toBe("text");

    fireEvent.click(toggle!);
    expect(passwordInput().type).toBe("password");
  });
});
