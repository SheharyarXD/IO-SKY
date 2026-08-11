/**
 * IO SKY — Supabase browser client (RM-50..54).
 *
 * NEW, additive infrastructure for the Path A migration (Supabase Auth as
 * the primary auth system). Not yet wired into the live login flow — see
 * server/_core/supabaseAuth.ts's file header for why (blocked on a live
 * Postgres connection to verify the full signup/login round-trip end to
 * end). Uses only the publishable key, which is safe to ship to the
 * browser by design (Supabase's anon/publishable key is not a secret —
 * access control is enforced by RLS, see drizzle/0004_rls_policies.sql).
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

let _supabase: ReturnType<typeof createClient> | null = null;

/**
 * Lazily-created Supabase browser client. Returns null when the app isn't
 * configured with Supabase env vars yet (keeps the rest of the app usable
 * during the migration window rather than crashing on import).
 */
export function getSupabaseClient() {
  if (_supabase) return _supabase;
  if (!supabaseUrl || !supabasePublishableKey) return null;
  _supabase = createClient(supabaseUrl, supabasePublishableKey);
  return _supabase;
}
