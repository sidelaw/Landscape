import { getServiceClient } from "./supabase";

/**
 * Lookup cache for Regrid responses (Typeahead + Parcel).
 *
 * Parcel facts rarely change, and Regrid is billed per call, so we persist
 * responses in Postgres keyed by a stable string (normalized query / parcel id)
 * with a ~30 day TTL. This cuts API spend and adds resilience when Regrid is
 * slow or down. When Supabase isn't configured (local dev), we fall back to a
 * process-memory Map so the flow still works.
 *
 * Table: lookup_cache (see db/migrations/0001_lookup_cache.sql)
 *   key text primary key, value jsonb, expires_at timestamptz
 */

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days

const memory = new Map<string, { value: unknown; expiresAt: number }>();

export function cacheKey(kind: "typeahead" | "parcel", input: string): string {
  return `${kind}:${input.trim().toLowerCase()}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const supabase = getServiceClient();
  if (!supabase) {
    const hit = memory.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      memory.delete(key);
      return null;
    }
    return hit.value as T;
  }

  const { data, error } = await supabase
    .from("lookup_cache")
    .select("value, expires_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.value as T;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const expiresAt = Date.now() + TTL_MS;
  const supabase = getServiceClient();
  if (!supabase) {
    memory.set(key, { value, expiresAt });
    return;
  }
  await supabase
    .from("lookup_cache")
    .upsert({ key, value, expires_at: new Date(expiresAt).toISOString() });
}
