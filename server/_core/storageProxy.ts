import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";

/**
 * The site's own branding assets are the only things served through this
 * proxy that are genuinely meant to be publicly readable by anonymous
 * visitors (logo/favicon/mark, rendered on public marketing pages before
 * login). Every other key served through /manus-storage/* is a private,
 * tenant-owned document (client documents/invoices, AI Scan reports,
 * developer project files) and must not be reachable by an unauthenticated
 * caller who happens to know or guess the key.
 *
 * Exact-match allowlist rather than a prefix/folder convention, because the
 * real branding keys are flat filenames with no distinguishing folder (see
 * IOSkyLogo.tsx, LogoLoader.tsx, EcosystemOverview.tsx, client/index.html).
 * Update this list if branding assets are ever re-uploaded under new keys.
 */
const PUBLIC_KEYS = new Set([
  "iosky-logo-transparent_6a55c203.png",
  "iosky-mark-transparent_9aba89cd.png",
  "iosky-favicon-transparent_403fabca.png",
]);

function isPublicKey(key: string): boolean {
  return PUBLIC_KEYS.has(key);
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // This proxy has no per-object ownership model today (that's tracked
    // separately as part of the Supabase Storage migration, which brings
    // real bucket-level RLS policies). Until then, require at least a
    // valid authenticated session for anything outside the public-asset
    // prefixes — this closes the "any anonymous caller who guesses a key"
    // exposure, which was the most severe part of the finding, even though
    // it does not yet enforce full per-tenant scoping between two
    // authenticated users.
    if (!isPublicKey(key)) {
      try {
        await sdk.authenticateRequest(req);
      } catch {
        res.status(401).send("Authentication required");
        return;
      }
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
