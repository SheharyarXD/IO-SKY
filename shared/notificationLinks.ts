/**
 * Notification deep links are revalidated when they are opened (task N13,
 * 29 Oct Doc 1 F-28). A link is stored when the notification is created; by the
 * time it is clicked the person may have lost the role, the link may have been
 * tampered with, or it may point outside the portal that owns the notification.
 * The server decides again at open time with these pure rules, and the
 * destination page still enforces its own data permissions.
 *
 * Safe by construction: only a same-origin portal path is ever returned, so a
 * stored external URL, a protocol-relative URL or a script URL is refused.
 */

export type NotificationPortal = "admin" | "client" | "developer";
type Area = "admin" | "ops" | "client" | "developer";

const AREA_BY_SEGMENT: Record<string, Area> = {
  admin: "admin",
  ops: "ops",
  "client-portal": "client",
  "developer-workspace": "developer",
};

/** Which areas a notification feed may link into. A client feed never links into /admin. */
const AREAS_FOR_PORTAL: Record<NotificationPortal, readonly Area[]> = {
  admin: ["admin", "ops"],
  client: ["client"],
  developer: ["developer"],
};

/** Roles that may open each area right now. Staff keep access to the portals they support. */
const ROLES_FOR_AREA: Record<Area, readonly string[]> = {
  admin: ["admin", "super_admin"],
  ops: ["technical_operator", "admin", "super_admin"],
  client: ["client", "admin", "super_admin"],
  developer: ["developer", "admin", "super_admin"],
};

export const PORTAL_HOME: Record<NotificationPortal, string> = {
  admin: "/admin",
  client: "/client-portal",
  developer: "/developer-workspace",
};

const BASE = "http://internal.invalid";

/** Normalised path+query+hash for a same-origin absolute path, or null when the value is not one. */
export function safeInternalPath(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const v = href.trim();
  if (v.length === 0 || v.length > 512) return null;
  if (v[0] !== "/" || v[1] === "/" || v[1] === "\\") return null;
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return null;
  // Dot segments are checked on the RAW path: URL parsing would silently
  // rewrite "/client-portal/../admin" to "/admin" and hide the traversal.
  let rawPath: string;
  try {
    rawPath = decodeURIComponent(v.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (rawPath.split("/").some((seg) => seg === ".." || seg === ".")) return null;
  let u: URL;
  try {
    u = new URL(v, BASE);
  } catch {
    return null;
  }
  if (u.origin !== BASE) return null;
  return u.pathname + u.search + u.hash;
}

export type NotificationLinkDecision =
  | { allowed: true; href: string }
  | { allowed: false; reason: "no_link" | "unsafe_link" | "wrong_area" | "role_denied"; home: string };

export function resolveNotificationLink(input: { href: string | null | undefined; portal: NotificationPortal; role: string | null | undefined }): NotificationLinkDecision {
  const home = PORTAL_HOME[input.portal];
  if (input.href === null || input.href === undefined || String(input.href).trim() === "") return { allowed: false, reason: "no_link", home };
  const path = safeInternalPath(input.href);
  if (!path) return { allowed: false, reason: "unsafe_link", home };
  const segment = path.split(/[/?#]/)[1] ?? "";
  const area = AREA_BY_SEGMENT[segment];
  if (!area || !AREAS_FOR_PORTAL[input.portal].includes(area)) return { allowed: false, reason: "wrong_area", home };
  if (!input.role || !ROLES_FOR_AREA[area].includes(input.role)) return { allowed: false, reason: "role_denied", home };
  return { allowed: true, href: path };
}
