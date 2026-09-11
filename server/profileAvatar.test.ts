/**
 * Profile photo upload — validation.
 *
 * The two helpers under test are the whole security boundary for this
 * feature. `decodeBoundedBase64` is what stops an arbitrarily large
 * allocation, and `sniffImageType` is what stops a document that merely
 * claims to be an image. Both are exported precisely so they can be tested
 * without standing up storage: the storage call itself is Supabase's, and a
 * test of it would be testing Supabase.
 */
import { describe, expect, it } from "vitest";
import { decodeBoundedBase64, sniffImageType } from "./routers/profile";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

/** Pad to at least 12 bytes, the minimum the sniffer will look at. */
function padded(head: Buffer): Buffer {
  return Buffer.concat([head, Buffer.alloc(16)]);
}

describe("sniffImageType", () => {
  it("identifies PNG, JPEG and WebP from their leading bytes", () => {
    expect(sniffImageType(padded(PNG_MAGIC))).toBe("image/png");
    expect(sniffImageType(padded(JPEG_MAGIC))).toBe("image/jpeg");

    const webp = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.alloc(4),
      Buffer.from("WEBP", "ascii"),
      Buffer.alloc(8),
    ]);
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("rejects an SVG even though browsers render it", () => {
    // An SVG is a document that can carry script. Served from our own origin
    // it would be a stored-XSS primitive handed to every uploader, so it is
    // excluded deliberately rather than by oversight.
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
    expect(sniffImageType(svg)).toBeNull();
  });

  it("rejects HTML dressed up with an image extension", () => {
    const html = Buffer.from("<!doctype html><script>alert(1)</script>", "utf8");
    expect(sniffImageType(html)).toBeNull();
  });

  it("rejects a RIFF container that is not WebP", () => {
    // A WAV file also starts "RIFF". Matching on the prefix alone would
    // accept it.
    const wav = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.alloc(4),
      Buffer.from("WAVE", "ascii"),
      Buffer.alloc(8),
    ]);
    expect(sniffImageType(wav)).toBeNull();
  });

  it("rejects a payload too short to identify", () => {
    expect(sniffImageType(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});

describe("decodeBoundedBase64", () => {
  it("decodes a payload within the limit", () => {
    const encoded = padded(PNG_MAGIC).toString("base64");
    expect(decodeBoundedBase64(encoded).length).toBe(24);
  });

  it("refuses an oversize payload before allocating it", () => {
    // 3 MB of base64 characters. The check that matters is on the ENCODED
    // length: bounding only the decoded size would still mean materialising
    // the whole buffer first.
    const encoded = "A".repeat(3 * 1024 * 1024);
    expect(() => decodeBoundedBase64(encoded)).toThrow(/2 MB or smaller/);
  });

  it("refuses an empty payload", () => {
    expect(() => decodeBoundedBase64("====")).toThrow(/empty/);
  });
});
