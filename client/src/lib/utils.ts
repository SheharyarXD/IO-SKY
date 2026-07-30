import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shared date-display helper — was previously reimplemented inline as
 * `new Date(x).toLocaleDateString()` at 11 separate call sites across 8
 * files (admin/client-portal/developer-workspace sections), none of which
 * pass an explicit locale.
 *
 * Deliberately kept behavior-identical to those call sites (still uses the
 * browser's default locale) rather than switching to the app's real
 * locale-aware `formatDate()` in `@/lib/i18n` — none of these 8 files
 * currently participate in the i18n system (`useT()`) at all, so wiring
 * that in would be a separate, larger, behavior-changing task (adding a
 * new hook dependency to components that have none today), not a pure
 * dedup. This only removes the duplicated one-liner; it does not fix the
 * underlying "dates don't respect the active app language" gap. See
 * PHASE1_CHECKLIST.md.
 */
export function formatDate(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString();
}
