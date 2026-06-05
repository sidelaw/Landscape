import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "./env";

/**
 * Server-side Supabase client using the service-role key.
 *
 * TIER 1: service-role bypasses RLS, so this must NEVER be imported into a
 * client component. Returns null when Supabase isn't configured, letting
 * callers fall back to their in-memory behavior in local dev.
 */
let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cached) return cached;
  cached = createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
