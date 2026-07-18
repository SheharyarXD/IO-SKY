/**
 * server/db.ts
 *
 * ⚠️  BARREL SHIM — do not add logic here.
 *
 * This file exists solely for backward compatibility so that all existing
 * imports of the form:
 *
 *   import { ... } from "../db"          (from server/routers/*)
 *   import { ... } from "./db"           (from server/*)
 *   import * as db from "../db"          (from server/_core/*)
 *
 * continue to resolve without any changes to callers.
 *
 * All database logic now lives in domain-specific modules under server/db/:
 *
 *   server/db/connection.ts         — getDb() shared helper
 *   server/db/users.ts              — user CRUD, display name, MFA method
 *   server/db/auth.ts               — login audit log
 *   server/db/mfa.ts                — MFA factors, recovery codes, challenges
 *   server/db/crm.ts                — leads, contact submissions, dev applications
 *   server/db/bookings.ts           — native booking system
 *   server/db/clientPortal.ts       — client portal helpers
 *   server/db/developerWorkspace.ts — developer workspace helpers
 *   server/db/aiScans.ts            — AI scan helpers
 *   server/db/solutions.ts          — ecosystem clicks, proposals, discovery
 *   server/db/legal.ts              — legal documents, acceptances, cookie consent
 *
 * To add new database helpers, create or edit the appropriate domain module
 * above — never add code directly to this file.
 */
export * from "./db/index";
