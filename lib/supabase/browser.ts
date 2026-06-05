import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client for the dashboard login UI (cookie-based auth).
 * Uses the public anon key only. Returns null when Supabase isn't configured
 * so the auth pages can show a "configure Supabase" notice instead of crashing.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createBrowserClient(url, anon);
}

export const isSupabasePublicConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
