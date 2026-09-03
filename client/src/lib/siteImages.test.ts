/**
 * Guards the editorial-visual registry.
 *
 * Eleven visuals were hardcoded across seven pages pointing at the Manus/Forge
 * CDN, which now returns 403 for every asset. Nothing caught it because a dead
 * external image fails in the browser, not in a build or a test — the site
 * simply rendered broken-image icons in front of the client.
 *
 * These tests make two things impossible to reintroduce quietly: a hardcoded
 * image URL in a page, and a reference to the known-dead host anywhere.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SITE_IMAGE_LABELS, envKeyFor, missingSiteImages, resolveSiteImage } from "./siteImages";

const repoRoot = path.resolve(__dirname, "..", "..", "..");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(full));
    else if (/\.(tsx?|html)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

const clientFiles = [
  ...sources(path.join(repoRoot, "client", "src")),
  path.join(repoRoot, "client", "index.html"),
].filter((f) => fs.existsSync(f));

describe("dead asset host", () => {
  it("is referenced nowhere in the client", () => {
    // d2xsxph8kpxj0f.cloudfront.net is the decommissioned Manus/Forge CDN.
    // Every asset on it 403s. Milestone 1 §1.3 warned the assets needed
    // archiving "while the Forge proxy still resolves"; it no longer does.
    const offenders = clientFiles
      // The registry documents the host by name in its header, explaining why
      // it must never be used. Naming it in prose is the point, not a lapse.
      .filter((f) => !f.endsWith(path.join("lib", "siteImages.ts")))
      .filter((f) => fs.readFileSync(f, "utf8").includes("d2xsxph8kpxj0f"));
    expect(offenders.map((f) => path.relative(repoRoot, f))).toEqual([]);
  });
});

describe("no hardcoded image URLs in pages", () => {
  it("routes every remote image through the registry", () => {
    // A page that hardcodes a URL bypasses the placeholder fallback, so a dead
    // link there renders as a broken icon again. Storage/branding URLs are
    // allowed: those are the logo and favicon, which are client-owned, live,
    // and referenced from index.html by necessity.
    const pageDir = path.join(repoRoot, "client", "src", "pages");
    const offenders: string[] = [];
    for (const f of sources(pageDir)) {
      const src = fs.readFileSync(f, "utf8");
      const urls = src.match(/["'`]https:\/\/[^"'`]+\.(webp|png|jpe?g|avif|gif|svg)[^"'`]*["'`]/gi) ?? [];
      for (const u of urls) {
        if (u.includes("supabase.co/storage/v1/object/public/branding")) continue;
        offenders.push(`${path.relative(repoRoot, f)} -> ${u.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("registry", () => {
  it("derives a sensible env var name for each key", () => {
    expect(envKeyFor("aiScan.hero")).toBe("VITE_IMG_AI_SCAN_HERO");
    expect(envKeyFor("about.founders")).toBe("VITE_IMG_ABOUT_FOUNDERS");
  });

  it("returns null for an unsupplied visual rather than a placeholder URL", () => {
    // Null is what triggers the placeholder. Returning a stand-in URL would
    // reintroduce the original failure mode in a new location.
    expect(resolveSiteImage("about.founders")).toBeNull();
  });

  it("labels every key, so a placeholder always names what belongs there", () => {
    const unlabelled = Object.entries(SITE_IMAGE_LABELS).filter(([, v]) => !v || !v.trim());
    expect(unlabelled).toEqual([]);
  });

  it("reports the current gap honestly", () => {
    // All eleven are outstanding. This asserts the count so that supplying one
    // — or silently losing another — shows up as a deliberate change here
    // rather than passing unnoticed.
    expect(missingSiteImages()).toHaveLength(11);
  });
});
