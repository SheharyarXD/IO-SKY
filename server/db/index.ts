/**
 * server/db/index.ts
 *
 * Barrel re-export for all domain-specific database modules.
 *
 * This file is the single entry point for the server/db/ directory.
 * All existing code that imports from "server/db" continues to work
 * unchanged because server/db.ts re-exports everything from here.
 *
 * Domain modules:
 *   connection         — getDb() shared helper
 *   users              — user CRUD, display name, MFA method
 *   auth               — login audit log
 *   mfa                — MFA factors, recovery codes, challenges
 *   crm                — leads, contact submissions, dev applications
 *   bookings           — native booking system (slots, reminders, events)
 *   clientPortal       — client portal (projects, recommendations, reports, billing, documents)
 *   developerWorkspace — developer workspace (profiles, agreements, tasks, files, messages)
 *   aiScans            — AI scan create/read/update
 *   solutions          — ecosystem clicks, proposals, custom discovery
 *   legal              — legal documents, agreement versions, acceptances, cookie consent
 */

export { getDb } from "./connection";
export * from "./users";
export * from "./auth";
export * from "./mfa";
export * from "./crm";
export * from "./bookings";
export * from "./clientPortal";
export * from "./developerWorkspace";
export * from "./aiScans";
export * from "./solutions";
export * from "./legal";
