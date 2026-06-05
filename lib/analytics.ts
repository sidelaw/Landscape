import { getServiceClient } from "./supabase";

export type FunnelEvent =
  | "address_entered"
  | "property_confirmed"
  | "quote_shown"
  | "custom_quote_routed"
  | "lead_captured"
  | "regrid_fallback";

/**
 * Record a first-party funnel event (SPEC §10). Best-effort and non-blocking:
 * never throws into the request path, and no-ops when Supabase isn't configured.
 */
export async function recordEvent(
  businessId: string | null | undefined,
  event: FunnelEvent,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (!businessId) return;
  const supabase = getServiceClient();
  if (!supabase) return;
  try {
    await supabase.from("analytics_events").insert({ business_id: businessId, event, meta });
  } catch {
    /* analytics must never break the user flow */
  }
}

export interface Funnel {
  address_entered: number;
  property_confirmed: number;
  quote_shown: number;
  lead_captured: number;
}

/** Per-business funnel counts for the dashboard (owner-scoped via RLS). */
export async function getFunnel(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  businessId: string,
): Promise<Funnel> {
  const counts: Funnel = {
    address_entered: 0,
    property_confirmed: 0,
    quote_shown: 0,
    lead_captured: 0,
  };
  const { data } = await supabase
    .from("analytics_events")
    .select("event")
    .eq("business_id", businessId);
  for (const row of data ?? []) {
    const e = (row as { event: string }).event;
    if (e in counts) counts[e as keyof Funnel]++;
  }
  return counts;
}
