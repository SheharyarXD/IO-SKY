import { defineConfig } from "drizzle-kit";

// Milestone 1 (RM-43): migrated from MySQL/TiDB to Supabase PostgreSQL.
// DATABASE_URL must now be the Supabase project's direct Postgres connection
// string (Project Settings -> Database), not the old TiDB connection string.
// The old MySQL migration history lives in drizzle/_archive_mysql_migrations/
// for reference; it is not compatible with this dialect.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
