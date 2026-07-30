/**
 * Shared public-reference-code generator.
 *
 * Previously reimplemented independently (same alphabet-block algorithm)
 * in bookings.ts ("IOSKY-XXXX-XXXX"), contact.ts ("IOSKY-MSG-XXXX-XXXX"),
 * engineering.ts ("IOSKY-DEV-XXXX-XXXX"), and clientPortal.ts
 * ("IOSKY-T-XXXX-XXXX", under the name randomRef) — each with the same
 * `IOSKY-{prefix-}XXXX-XXXX` shape but a different literal prefix.
 *
 * Note: clientPortal.ts's copy was missing the ambiguous-character
 * substitution (0/O/I/L/1 → X) that the other three had — standardized on
 * the safer version here (fewer characters humans can visually confuse
 * when reading a reference code aloud or off a screenshot) rather than
 * silently keeping the weaker variant.
 *
 * This is an identifying reference, not an authenticating secret — unlike
 * the Custom Discovery session bearer token (server/routers/solutions.ts),
 * which was switched to crypto.randomBytes separately because it *is* the
 * access control for PII, not just a display label.
 */

function block(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[0OIL1]/g, "X");
}

export function generatePublicRef(prefix?: string): string {
  const segment = prefix ? `${prefix}-` : "";
  return `IOSKY-${segment}${block()}-${block()}`;
}
