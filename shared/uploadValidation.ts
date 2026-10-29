/**
 * Upload validation for the client vault (task J08; SRS 10.17; 29 Oct Doc 1
 * Ch10.1 and ACC-31: "PDF, image, screenshot and approved business file uploads
 * require validation, access control, optional notes and security checks").
 *
 * Pure checks on a file's name, claimed type and bytes. The file's CONTENT must
 * match what its name and type claim, so a program renamed to .pdf is refused.
 * Allow-list, not block-list.
 *
 * THIS IS NOT A MALWARE SCANNER. It refuses executables and scripts by
 * signature, known active-content markers in PDFs, the EICAR test string and
 * disguised double extensions. An antivirus engine (the "scanner choice" the
 * client still has to make) would sit behind the `scan` hook in addition, and
 * nothing here claims a file is virus-free.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type UploadRefusal = "empty" | "too_large" | "bad_name" | "type_not_allowed" | "type_mismatch" | "executable" | "active_content" | "test_malware";

export type UploadCheck = { ok: true; extension: string; mimeType: string; safeName: string } | { ok: false; code: UploadRefusal; message: string };

type TypeRule = { mimes: string[]; matches: (b: Uint8Array) => boolean };

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
// latin1 maps every byte to one character, so byte offsets and markers line up; chunked decoding is not needed.
const ascii = (b: Uint8Array, from: number, to: number) => new TextDecoder("latin1").decode(b.subarray(from, Math.min(to, b.length)));
const OOXML_MIME = (sub: string) => `application/vnd.openxmlformats-officedocument.${sub}`;
const isZip = (b: Uint8Array) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);
const looksLikeText = (b: Uint8Array) => {
  const head = b.slice(0, 8192);
  if (head.includes(0)) return false;
  let control = 0;
  for (const v of head) if (v < 9 || (v > 13 && v < 32)) control++;
  return head.length === 0 || control / head.length < 0.01;
};

/** What each allowed extension must look like. Only these may be uploaded. */
export const ALLOWED_TYPES: Record<string, TypeRule> = {
  pdf: { mimes: ["application/pdf"], matches: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  png: { mimes: ["image/png"], matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  jpg: { mimes: ["image/jpeg"], matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  jpeg: { mimes: ["image/jpeg"], matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  gif: { mimes: ["image/gif"], matches: (b) => ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a" },
  webp: { mimes: ["image/webp"], matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
  docx: { mimes: [OOXML_MIME("wordprocessingml.document")], matches: (b) => isZip(b) && ascii(b, 0, 8192).includes("[Content_Types].xml") },
  xlsx: { mimes: [OOXML_MIME("spreadsheetml.sheet")], matches: (b) => isZip(b) && ascii(b, 0, 8192).includes("[Content_Types].xml") },
  pptx: { mimes: [OOXML_MIME("presentationml.presentation")], matches: (b) => isZip(b) && ascii(b, 0, 8192).includes("[Content_Types].xml") },
  txt: { mimes: ["text/plain"], matches: looksLikeText },
  csv: { mimes: ["text/csv", "text/plain", "application/vnd.ms-excel"], matches: looksLikeText },
};

/** Extensions that must never appear anywhere in a name, which catches "report.exe.pdf". */
const DANGEROUS = ["exe", "bat", "cmd", "com", "scr", "pif", "msi", "dll", "sh", "bash", "ps1", "vbs", "vbe", "js", "jse", "mjs", "wsf", "jar", "apk", "app", "hta", "lnk", "reg", "cpl", "html", "htm", "svg", "php", "py", "rb"];

/** Executable and script signatures, refused whatever the file is called. */
function executableKind(b: Uint8Array): string | null {
  if (ascii(b, 0, 2) === "MZ") return "a Windows program";
  if (startsWith(b, [0x7f, 0x45, 0x4c, 0x46])) return "a Linux program";
  if (startsWith(b, [0xcf, 0xfa, 0xed, 0xfe]) || startsWith(b, [0xce, 0xfa, 0xed, 0xfe]) || startsWith(b, [0xfe, 0xed, 0xfa, 0xce]) || startsWith(b, [0xfe, 0xed, 0xfa, 0xcf]) || startsWith(b, [0xca, 0xfe, 0xba, 0xbe])) return "a macOS or Java program";
  if (ascii(b, 0, 2) === "#!") return "a script";
  return null;
}

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/** Markers that make a PDF run code or open other programs. A flattened PDF has none of them. */
// A PDF name ends at a delimiter, so "/JS" must not match a longer harmless name such as "/JSONData".
const PDF_ACTIVE = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/RichMedia"].map((m) => ({ m, re: new RegExp(`${m.replace("/", "\/")}(?![A-Za-z0-9_])`) }));

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "").slice(0, 120) || "file";
}

const refuse = (code: UploadRefusal, message: string): UploadCheck => ({ ok: false, code, message });

export function validateUpload(input: { name: string; mimeType?: string | null; bytes: Uint8Array }): UploadCheck {
  const { name, bytes } = input;
  if (bytes.byteLength === 0) return refuse("empty", "The file is empty.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return refuse("too_large", "File must be between 1 byte and 15 MB.");

  if (!name || name.length > 200 || /[\u0000-\u001f\u007f/\\]/.test(name) || /^\.+$/.test(name) || name.endsWith(".") || name.endsWith(" ")) {
    return refuse("bad_name", "That file name is not allowed. Use a plain name such as report.pdf.");
  }
  const parts = name.toLowerCase().split(".");
  const extension = parts.length > 1 ? parts[parts.length - 1] : "";
  const inner = parts.slice(1, -1);
  if (inner.some((p) => DANGEROUS.includes(p)) || DANGEROUS.includes(extension)) {
    return refuse(DANGEROUS.includes(extension) ? "type_not_allowed" : "executable", "This file type is not allowed in the client vault.");
  }
  const rule = ALLOWED_TYPES[extension];
  if (!rule) return refuse("type_not_allowed", "This file type is not allowed in the client vault. Allowed: PDF, images (PNG, JPG, GIF, WebP), Word, Excel, PowerPoint, text and CSV.");

  const exe = executableKind(bytes);
  if (exe) return refuse("executable", `This file is ${exe} disguised as a document, so it was refused.`);

  const claimed = (input.mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (claimed && claimed !== "application/octet-stream" && !rule.mimes.includes(claimed)) {
    return refuse("type_mismatch", `The file says it is ${claimed}, which does not fit a .${extension} file.`);
  }
  if (!rule.matches(bytes)) return refuse("type_mismatch", `The content of this file is not a real .${extension} file.`);

  const sample = ascii(bytes, 0, 1024 * 1024);
  if (sample.includes(EICAR)) return refuse("test_malware", "This file was refused: it contains an antivirus test signature.");
  if (extension === "pdf") {
    const hit = PDF_ACTIVE.find(({ re }) => re.test(sample));
    if (hit) return refuse("active_content", "This PDF contains active content (scripts or embedded programs). Send a flattened copy instead.");
  }
  return { ok: true, extension, mimeType: rule.mimes[0], safeName: safeFileName(name) };
}
