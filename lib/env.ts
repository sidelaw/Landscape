/**
 * Centralized, server-side-only env access.
 *
 * TIER 1: these are secrets. They are read here and used only inside server
 * route handlers / server modules — never imported into client components.
 * When a credential is missing, the relevant `*Configured` flag is false and
 * callers fall back to dev mock behavior so the flow stays runnable.
 */

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  regridToken: read("REGRID_API_TOKEN"),
  googleMapsKey: read("GOOGLE_MAPS_API_KEY"),
  supabaseUrl: read("SUPABASE_URL"),
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  resendKey: read("RESEND_API_KEY"),
  stripeKey: read("STRIPE_SECRET_KEY"),
};

export const isRegridConfigured = () => Boolean(env.regridToken);
export const isMapsConfigured = () => Boolean(env.googleMapsKey);
export const isSupabaseConfigured = () =>
  Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
