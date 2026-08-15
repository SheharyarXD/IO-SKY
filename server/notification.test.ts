/**
 * server/_core/notification.ts — owner-alert email/Slack channel
 * (Milestone 2 §2.2, replacing the Manus WebDevService push call).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./email")>();
  return {
    ...actual,
    dispatchSimpleEmail: vi.fn(),
  };
});

import { notifyOwner } from "./_core/notification";
import { dispatchSimpleEmail } from "./email";

const ORIGINAL_ENV = { ...process.env };

describe("notifyOwner (Milestone 2 §2.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OWNER_NOTIFY_EMAIL;
    delete process.env.OWNER_NOTIFY_SLACK_WEBHOOK_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("rejects an empty title/content before touching config or the transport", async () => {
    await expect(notifyOwner({ title: "", content: "x" })).rejects.toThrow(
      /title is required/i,
    );
    await expect(notifyOwner({ title: "x", content: "" })).rejects.toThrow(
      /content is required/i,
    );
    expect(dispatchSimpleEmail).not.toHaveBeenCalled();
  });

  it("throws a clear config error when OWNER_NOTIFY_EMAIL is unset — no silent Manus-style fallback", async () => {
    await expect(
      notifyOwner({ title: "New booking", content: "details" }),
    ).rejects.toThrow(/OWNER_NOTIFY_EMAIL/);
    expect(dispatchSimpleEmail).not.toHaveBeenCalled();
  });

  it("sends via the shared email transport and returns true on success", async () => {
    process.env.OWNER_NOTIFY_EMAIL = "owner@iosky.nl";
    (dispatchSimpleEmail as any).mockResolvedValueOnce({ ok: true, transport: "resend", messageId: "abc" });

    const delivered = await notifyOwner({ title: "New lead", content: "Acme Corp submitted the form." });

    expect(delivered).toBe(true);
    expect(dispatchSimpleEmail).toHaveBeenCalledTimes(1);
    const call = (dispatchSimpleEmail as any).mock.calls[0][0];
    expect(call.to).toBe("owner@iosky.nl");
    expect(call.subject).toContain("New lead");
    expect(call.html).toContain("Acme Corp submitted the form.");
    expect(call.text).toContain("New lead");
  });

  it("returns false (does not throw) when the email transport reports failure", async () => {
    process.env.OWNER_NOTIFY_EMAIL = "owner@iosky.nl";
    (dispatchSimpleEmail as any).mockResolvedValueOnce({ ok: false, transport: "resend", error: "Resend 500" });

    const delivered = await notifyOwner({ title: "New lead", content: "details" });

    expect(delivered).toBe(false);
  });

  it("escapes HTML in title/content so a hostile submission can't inject markup into the owner-alert email", async () => {
    process.env.OWNER_NOTIFY_EMAIL = "owner@iosky.nl";
    (dispatchSimpleEmail as any).mockResolvedValueOnce({ ok: true, transport: "console" });

    await notifyOwner({
      title: "New contact form",
      content: '<img src=x onerror=alert(1)> from "attacker"',
    });

    const call = (dispatchSimpleEmail as any).mock.calls[0][0];
    expect(call.html).not.toContain("<img src=x onerror=alert(1)>");
    expect(call.html).toContain("&lt;img");
  });

  it("posts to Slack when a webhook is configured, without blocking or failing the email path", async () => {
    process.env.OWNER_NOTIFY_EMAIL = "owner@iosky.nl";
    process.env.OWNER_NOTIFY_SLACK_WEBHOOK_URL = "https://hooks.slack.example/T000/B000/xxx";
    (dispatchSimpleEmail as any).mockResolvedValueOnce({ ok: true, transport: "resend" });

    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const delivered = await notifyOwner({ title: "New booking", content: "Discovery Call at 3pm" });

    expect(delivered).toBe(true);
    // Slack POST is fire-and-forget (not awaited by notifyOwner) — flush
    // microtasks so the fetch call has actually happened before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.example/T000/B000/xxx",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not call Slack when no webhook is configured", async () => {
    process.env.OWNER_NOTIFY_EMAIL = "owner@iosky.nl";
    (dispatchSimpleEmail as any).mockResolvedValueOnce({ ok: true, transport: "console" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await notifyOwner({ title: "New booking", content: "details" });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
