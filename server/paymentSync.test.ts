import { afterEach, describe, expect, it, vi } from "vitest";
import { reminderEventFor } from "../shared/paymentRules";
import { brandedEmail } from "./emailShell";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 11, 12, 0, 0);

describe("payment reminder staging", () => {
  it("is quiet until a week before the due date", () => {
    expect(reminderEventFor(now + 10 * DAY, now)).toBeNull();
  });
  it("picks the closest applicable stage", () => {
    expect(reminderEventFor(now + 7 * DAY, now)).toBe("PAYMENT_DUE_7D");
    expect(reminderEventFor(now + 3 * DAY, now)).toBe("PAYMENT_DUE_7D");
    expect(reminderEventFor(now + 1 * DAY, now)).toBe("PAYMENT_DUE_1D");
    expect(reminderEventFor(now, now)).toBe("PAYMENT_DUE_TODAY");
    expect(reminderEventFor(now - 1 * DAY, now)).toBe("PAYMENT_OVERDUE");
  });
  it("compares calendar days, not hours", () => {
    const lateEvening = Date.UTC(2026, 9, 11, 23, 59, 0);
    const earlyMorning = Date.UTC(2026, 9, 12, 0, 1, 0);
    expect(reminderEventFor(earlyMorning, lateEvening)).toBe("PAYMENT_DUE_1D");
  });
});

describe("branded email shell", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("links the logo to the homepage and carries the same header and footer", () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://iosky.example");
    const { html, text } = brandedEmail({ title: "Hello", paragraphs: ["One", "Two"], cta: { label: "Open", url: "https://iosky.example/x" } });
    expect(html).toContain('<a href="https://iosky.example"');
    expect(html).toContain("#F58A1F");
    expect(html).toContain("#0D2D2E");
    expect(html).toContain("Open");
    expect(text).toContain("Open: https://iosky.example/x");
  });
  it("escapes message text so a name cannot inject markup", () => {
    const { html } = brandedEmail({ title: "T", paragraphs: ['<img src=x onerror="alert(1)">'] });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
