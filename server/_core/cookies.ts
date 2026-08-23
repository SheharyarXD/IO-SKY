import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  // `SameSite=None` cookies MUST also carry `Secure`, or browsers silently
  // refuse to set them at all (not a server-side error — the Set-Cookie
  // header goes out fine, the browser just drops it). That's exactly what
  // was happening on any plain-HTTP request (local dev, or any deployment
  // without TLS/a proxy setting X-Forwarded-Proto) — isSecureRequest(req)
  // returns false there, so every login "succeeded" server-side while the
  // browser silently discarded the session cookie, leaving the user stuck
  // bouncing back to logged-out on the very next request. `None` is only
  // actually needed for the cross-site leg of the Manus OAuth redirect
  // dance; the local email/password POST and every same-origin request
  // this app makes work fine under `Lax`, which doesn't require Secure.
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  };
}
