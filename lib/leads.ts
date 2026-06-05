import { getServiceClient } from "./supabase";
import { createServerSupabase, getCurrentUser } from "./supabase/server";
import type { LeadInput } from "./schemas";

export interface StoredLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  smsConsent: boolean;
  quote: any;
  inputs: any;
  lotSource: string | null;
  status: string;
  createdAt: string;
}

/**
 * Persist a lead via the service-role client (the public widget is
 * unauthenticated). Returns { ok, stored }: in dev without Supabase we report
 * ok:true / stored:false so the widget flow still completes.
 */
export async function createLead(
  input: LeadInput,
): Promise<{ ok: boolean; stored: boolean; id?: string; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: true, stored: false };

  const email = input.email && input.email !== "" ? input.email : null;
  const phone = input.phone && input.phone !== "" ? input.phone : null;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      business_id: input.businessId,
      name: input.name || null,
      email,
      phone,
      sms_consent: input.smsConsent,
      consent_at: phone && input.smsConsent ? new Date().toISOString() : null,
      quote: input.quote,
      inputs: input.inputs,
      lot_source: input.lotSource ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, stored: false, error: error?.message };
  return { ok: true, stored: true, id: data.id };
}

/** Leads for the current contractor's business (owner-scoped via RLS). */
export async function listLeadsForCurrentUser(businessId: string): Promise<StoredLead[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    smsConsent: r.sms_consent,
    quote: r.quote,
    inputs: r.inputs,
    lotSource: r.lot_source,
    status: r.status,
    createdAt: r.created_at,
  }));
}
