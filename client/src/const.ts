export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Generate the IO SKY identity portal login URL.
 *
 * The redirect URI always reflects the current browser origin so the same
 * frontend bundle works in dev, sandbox preview and production. When a
 * `returnPath` is provided, it is encoded into the OAuth `state` parameter
 * and read back by `server/_core/oauth.ts` so the user lands exactly where
 * they intended after authentication completes.
 */
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL as string;
  const appId = import.meta.env.VITE_APP_ID as string;
  const origin = window.location.origin;
  const redirectUri = `${origin}/api/oauth/callback`;

  const statePayload = JSON.stringify({
    redirectUri,
    origin,
    returnPath: returnPath ?? "/",
  });
  const state = btoa(statePayload);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
