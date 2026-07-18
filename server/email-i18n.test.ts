import { describe, it, expect } from "vitest";
import {
  EMAIL_LOCALES,
  normaliseLocale,
  isRtl,
  bookingStrings,
  contactStrings,
  devAppStrings,
  fill,
} from "./email-i18n";
import {
  sendBookingConfirmation,
  sendContactConfirmation,
  sendDevApplicationAck,
} from "./email";

describe("email-i18n locale normalisation", () => {
  it("maps common locale-ish inputs to supported codes", () => {
    expect(normaliseLocale("nl")).toBe("NL");
    expect(normaliseLocale("nl-NL")).toBe("NL");
    expect(normaliseLocale("NL")).toBe("NL");
    expect(normaliseLocale("de-DE")).toBe("DE");
    expect(normaliseLocale("fr_FR")).toBe("FR");
    expect(normaliseLocale("zh-Hans")).toBe("ZH");
    expect(normaliseLocale("ja")).toBe("JA");
    expect(normaliseLocale("ar")).toBe("AR");
  });

  it("falls back to EN for unknown or empty input", () => {
    expect(normaliseLocale(null)).toBe("EN");
    expect(normaliseLocale(undefined)).toBe("EN");
    expect(normaliseLocale("")).toBe("EN");
    expect(normaliseLocale("xx-YY")).toBe("EN");
    expect(normaliseLocale("klingon")).toBe("EN");
  });

  it("flags only Arabic as RTL", () => {
    expect(isRtl("AR")).toBe(true);
    for (const l of EMAIL_LOCALES.filter((x) => x !== "AR")) {
      expect(isRtl(l)).toBe(false);
    }
  });
});

describe("email-i18n string completeness", () => {
  it("provides non-empty strings for every locale and email type", () => {
    for (const l of EMAIL_LOCALES) {
      const b = bookingStrings(l);
      const c = contactStrings(l);
      const d = devAppStrings(l);
      for (const v of Object.values(b)) expect(String(v).length).toBeGreaterThan(0);
      for (const v of Object.values(c)) expect(String(v).length).toBeGreaterThan(0);
      for (const v of Object.values(d)) expect(String(v).length).toBeGreaterThan(0);
    }
  });

  it("keeps placeholder tokens intact in templated strings", () => {
    for (const l of EMAIL_LOCALES) {
      expect(bookingStrings(l).intro).toContain("{name}");
      expect(bookingStrings(l).intro).toContain("{service}");
      expect(bookingStrings(l).subject).toContain("{ref}");
      expect(contactStrings(l).intro).toContain("{name}");
      expect(contactStrings(l).subject).toContain("{ref}");
      expect(devAppStrings(l).intro).toContain("{name}");
      expect(devAppStrings(l).subject).toContain("{ref}");
      expect(devAppStrings(l).textBody).toContain("{ref}");
    }
  });

  it("fill() substitutes tokens and leaves unknown tokens visible", () => {
    expect(fill("Hi {name}", { name: "Sam" })).toBe("Hi Sam");
    expect(fill("Ref {ref}", { ref: "AB-12" })).toBe("Ref AB-12");
    expect(fill("{a}-{b}", { a: 1 })).toBe("1-{b}");
  });
});

describe("localised email rendering (console transport)", () => {
  const base = { publicRef: "IO-TEST-001", fullName: "Jan de Vries", email: "jan@example.com" };

  it("renders Dutch booking subject and RTL Arabic markup", async () => {
    const nl = await sendBookingConfirmation({
      ...base,
      serviceId: "discovery",
      serviceLabel: "Discovery Discovery Call",
      slotStartMs: Date.now() + 3 * 86_400_000,
      durationMin: 30,
      timezone: "Europe/Amsterdam",
      cancelToken: null,
      rescheduleToken: null,
      locale: "nl",
    });
    expect(nl.ok).toBe(true);

    const ar = await sendBookingConfirmation({
      ...base,
      serviceId: "discovery",
      serviceLabel: "Discovery Discovery Call",
      slotStartMs: Date.now() + 3 * 86_400_000,
      durationMin: 30,
      timezone: "Asia/Riyadh",
      cancelToken: null,
      rescheduleToken: null,
      locale: "ar",
    });
    expect(ar.ok).toBe(true);
  });

  it("renders contact + devapp confirmations for a non-EN locale", async () => {
    const c = await sendContactConfirmation({
      ...base,
      subject: "Partnership",
      message: "We would like to talk.",
      locale: "de",
    });
    expect(c.ok).toBe(true);

    const d = await sendDevApplicationAck({ ...base, locale: "ja" });
    expect(d.ok).toBe(true);
  });

  it("defaults to EN when locale is omitted", async () => {
    const c = await sendContactConfirmation({
      ...base,
      subject: "General",
      message: "Hello there.",
    });
    expect(c.ok).toBe(true);
    expect(contactStrings(normaliseLocale(undefined)).subject).toContain("We received");
  });
});
