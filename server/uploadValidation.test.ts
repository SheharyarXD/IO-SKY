/*
 * J08 (SRS 10.17; 29 Oct Doc 1 Ch10.1, ACC-31): upload validation. The file's
 * content must match its name and type, from an allow-list. This is NOT a malware
 * scan engine, and nothing here claims a file is virus-free.
 */
import { describe, expect, it } from "vitest";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, safeFileName, validateUpload } from "../shared/uploadValidation";

const bytes = (...parts: Array<string | number[]>) => {
  const out: number[] = [];
  for (const p of parts) typeof p === "string" ? out.push(...[...p].map((c) => c.charCodeAt(0) & 0xff)) : out.push(...p);
  return Uint8Array.from(out);
};
const PDF = bytes("%PDF-1.7\n1 0 obj\n<< /Type /Catalog /OpenAction [3 0 R /Fit] >>\nendobj\n%%EOF");
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "....IHDR");
const JPG = bytes([0xff, 0xd8, 0xff, 0xe0], "....JFIF");
const GIF = bytes("GIF89a....");
const WEBP = bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ");
const OOXML = bytes([0x50, 0x4b, 0x03, 0x04], "..........[Content_Types].xml.....");
const ZIP_PLAIN = bytes([0x50, 0x4b, 0x03, 0x04], "..........some.exe.....");
const TEXT = bytes("Name,Amount\nCafé,10\n");

const ok = (name: string, b: Uint8Array, mime?: string) => validateUpload({ name, mimeType: mime, bytes: b });

describe("accepts real files of the allowed types", () => {
  it.each([
    ["brief.pdf", PDF, "application/pdf"],
    ["shot.png", PNG, "image/png"],
    ["photo.jpg", JPG, "image/jpeg"],
    ["photo.JPEG", JPG, "image/jpeg"],
    ["anim.gif", GIF, "image/gif"],
    ["pic.webp", WEBP, "image/webp"],
    ["spec.docx", OOXML, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["model.xlsx", OOXML, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["deck.pptx", OOXML, "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["notes.txt", TEXT, "text/plain"],
    ["data.csv", TEXT, "text/csv"],
  ])("%s", (name, b, mime) => {
    expect(ok(name, b, mime)).toMatchObject({ ok: true });
  });

  it("covers exactly the documented allow-list", () => {
    expect(Object.keys(ALLOWED_TYPES).sort()).toEqual(["csv", "docx", "gif", "jpeg", "jpg", "pdf", "png", "pptx", "txt", "webp", "xlsx"]);
  });

  it("accepts a generic or missing mime type (browsers often send octet-stream) and returns the canonical one", () => {
    expect(ok("brief.pdf", PDF, "application/octet-stream")).toMatchObject({ ok: true, mimeType: "application/pdf" });
    expect(ok("brief.pdf", PDF)).toMatchObject({ ok: true, mimeType: "application/pdf" });
    expect(ok("brief.pdf", PDF, "application/pdf; charset=binary")).toMatchObject({ ok: true });
  });

  it("accepts text with accents and a file of exactly the maximum size", () => {
    expect(ok("café.txt", bytes("Zoë says héllo")).ok).toBe(true);
    const big = new Uint8Array(MAX_UPLOAD_BYTES);
    big.set(PDF);
    expect(ok("big.pdf", big)).toMatchObject({ ok: true });
  });
});

describe("refuses a file whose content is not what it claims", () => {
  it("a PDF name on image or text bytes, an image name on text, a document on a plain zip", () => {
    for (const [name, b] of [["a.pdf", PNG], ["a.pdf", TEXT], ["a.png", TEXT], ["a.jpg", PNG], ["a.docx", ZIP_PLAIN], ["a.webp", GIF], ["a.gif", PDF]] as const) {
      expect(ok(name, b), name).toMatchObject({ ok: false, code: "type_mismatch" });
    }
  });
  it("binary content named .txt or .csv", () => {
    expect(ok("a.txt", bytes([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))).toMatchObject({ ok: false, code: "type_mismatch" });
  });
  it("a claimed mime type that does not fit the extension", () => {
    expect(ok("a.pdf", PDF, "text/html")).toMatchObject({ ok: false, code: "type_mismatch" });
    expect(ok("a.png", PNG, "application/pdf")).toMatchObject({ ok: false, code: "type_mismatch" });
  });
});

describe("refuses programs and scripts however they are named", () => {
  it.each([
    ["Windows program", bytes("MZ", [0x90, 0x00, 0x03])],
    ["Linux program", bytes([0x7f, 0x45, 0x4c, 0x46, 0x02])],
    ["macOS program", bytes([0xcf, 0xfa, 0xed, 0xfe, 0x07])],
    ["Java program", bytes([0xca, 0xfe, 0xba, 0xbe, 0x00])],
    ["shell script", bytes("#!/bin/sh\nrm -rf /\n")],
  ])("%s named brief.pdf, photo.png and notes.txt", (_label, b) => {
    for (const name of ["brief.pdf", "photo.png", "notes.txt", "data.csv"]) expect(ok(name, b), name).toMatchObject({ ok: false, code: "executable" });
  });

  it("dangerous extensions are refused by name", () => {
    for (const name of ["payload.exe", "run.bat", "x.cmd", "x.sh", "x.js", "x.msi", "x.ps1", "x.vbs", "x.jar", "page.html", "image.svg", "x.php", "x.lnk", "x.scr", "x.dll"]) {
      expect(ok(name, TEXT).ok, name).toBe(false);
    }
  });

  it("disguised double extensions are refused in either order", () => {
    expect(ok("report.exe.pdf", PDF)).toMatchObject({ ok: false, code: "executable" });
    expect(ok("invoice.pdf.exe", PDF)).toMatchObject({ ok: false });
    expect(ok("a.js.txt", TEXT)).toMatchObject({ ok: false, code: "executable" });
    expect(ok("report.final.v2.pdf", PDF)).toMatchObject({ ok: true }); // harmless inner dots are fine
  });

  it("unknown or missing extensions are not on the allow-list", () => {
    for (const name of ["archive.zip", "x.rar", "x.7z", "noextension", "x.bin", "x.iso", "x.doc", "x.xls"]) expect(ok(name, PDF), name).toMatchObject({ ok: false, code: "type_not_allowed" });
  });
});

describe("PDF active content and the antivirus test file", () => {
  const pdfWith = (marker: string) => bytes("%PDF-1.7\n1 0 obj\n<< ", marker, " >>\nendobj\n%%EOF");
  it.each(["/JavaScript", "/JS (app.alert(1))", "/Launch", "/EmbeddedFile", "/RichMedia"])("refuses a PDF containing %s", (marker) => {
    expect(ok("a.pdf", pdfWith(marker))).toMatchObject({ ok: false, code: "active_content" });
  });
  it("does not refuse a PDF for a longer harmless name or for /OpenAction", () => {
    expect(ok("a.pdf", pdfWith("/JSONData 1 /OpenAction [1 0 R /Fit]"))).toMatchObject({ ok: true });
  });
  it("refuses the EICAR test signature in any allowed type", () => {
    const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    expect(ok("a.txt", bytes(eicar))).toMatchObject({ ok: false, code: "test_malware" });
    expect(ok("a.pdf", bytes("%PDF-1.7\n", eicar))).toMatchObject({ ok: false, code: "test_malware" });
  });
});

describe("names and sizes", () => {
  it("refuses empty and oversize files", () => {
    expect(ok("a.pdf", new Uint8Array(0))).toMatchObject({ ok: false, code: "empty" });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(PDF);
    expect(ok("a.pdf", big)).toMatchObject({ ok: false, code: "too_large" });
  });

  it("refuses path separators, control characters, dot-only, trailing dot or space, empty and very long names", () => {
    for (const name of ["../a.pdf", "dir/a.pdf", "dir\\a.pdf", "a\u0000.pdf", "a\n.pdf", "..", "...", "a.pdf.", "a.pdf ", "", "x".repeat(210) + ".pdf"]) {
      expect(ok(name, PDF), JSON.stringify(name)).toMatchObject({ ok: false });
    }
  });

  it("produces a storage-safe name and never an empty one", () => {
    expect(safeFileName("My Report (final) v2.pdf")).toBe("My-Report-final-v2.pdf");
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileName("???")).toBe("file");
    expect(safeFileName("a".repeat(300)).length).toBe(120);
    expect((ok("My Report (final).pdf", PDF) as { safeName: string }).safeName).toBe("My-Report-final-.pdf");
  });
});
