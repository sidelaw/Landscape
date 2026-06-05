import { createServerSupabase, getCurrentUser } from "./supabase/server";
import { getServiceClient } from "./supabase";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "./config";

export interface Business {
  id: string;
  name: string;
  notificationEmail: string | null;
  pricing: PricingConfig;
  allowedDomains: string[];
}

/** Merge a stored (possibly partial) pricing JSON over the SPEC defaults. */
export function mergePricing(stored: unknown): PricingConfig {
  if (!stored || typeof stored !== "object") return DEFAULT_PRICING_CONFIG;
  return { ...DEFAULT_PRICING_CONFIG, ...(stored as Partial<PricingConfig>) };
}

function mapRow(row: any): Business {
  return {
    id: row.id,
    name: row.name,
    notificationEmail: row.notification_email ?? null,
    pricing: mergePricing(row.pricing),
    allowedDomains: Array.isArray(row.allowed_domains) ? row.allowed_domains : [],
  };
}

/**
 * Get the current contractor's business, creating it (seeded with the SPEC
 * defaults) on first visit. Returns null when not authenticated / no Supabase.
 */
export async function getOrCreateBusinessForCurrentUser(): Promise<Business | null> {
  const supabase = createServerSupabase();
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existing) return mapRow(existing);

  const { data: created, error } = await supabase
    .from("businesses")
    .insert({
      owner_id: user.id,
      name: "My Lawn Care",
      notification_email: user.email ?? null,
      pricing: DEFAULT_PRICING_CONFIG,
      allowed_domains: [],
    })
    .select("*")
    .single();
  if (error || !created) return null;
  return mapRow(created);
}

export interface BusinessUpdate {
  name: string;
  notificationEmail: string | null;
  pricing: PricingConfig;
  allowedDomains: string[];
}

/** Update the current contractor's business (RLS enforces ownership). */
export async function updateBusinessForCurrentUser(
  update: BusinessUpdate,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerSupabase();
  if (!supabase) return { ok: false, error: "not_configured" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("businesses")
    .update({
      name: update.name,
      notification_email: update.notificationEmail,
      pricing: update.pricing,
      allowed_domains: update.allowedDomains,
    })
    .eq("owner_id", user.id);

  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Display-safe public config for the widget (no rates/multipliers — the engine
 * keeps those server-side). Read via the service-role client so the widget
 * never needs direct table access. Falls back to defaults when unavailable.
 */
export interface PublicConfig {
  name: string;
  recurringDiscountPct: number;
  currency: "USD";
}

export async function getPublicConfig(businessId: string): Promise<PublicConfig> {  const fallback: PublicConfig = {
    name: "Lawn Care",
    recurringDiscountPct: DEFAULT_PRICING_CONFIG.recurringDiscountPct,
    currency: "USD",
  };
  const supabase = getServiceClient();
  if (!supabase) return fallback;

  const { data } = await supabase
    .from("businesses")
    .select("name, pricing")
    .eq("id", businessId)
    .maybeSingle();
  if (!data) return fallback;

  const pricing = mergePricing(data.pricing);
  return {
    name: data.name ?? fallback.name,
    recurringDiscountPct: pricing.recurringDiscountPct,
    currency: "USD",
  };
}

/**
 * Allowed embed domains for a business (service-role read), used by the access
 * guard on metered endpoints. Returns null when unavailable/not found.
 */
export async function getAllowedDomains(businessId: string): Promise<string[] | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("businesses")
    .select("allowed_domains")
    .eq("id", businessId)
    .maybeSingle();
  if (!data) return null;
  return Array.isArray(data.allowed_domains) ? data.allowed_domains : [];
}
