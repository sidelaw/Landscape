import { NextResponse } from "next/server";
import { leadInputSchema } from "@/lib/schemas";
import { guard } from "@/lib/access";
import { getAllowedDomains, getPublicConfig } from "@/lib/business";
import { createLead } from "@/lib/leads";
import { recordEvent } from "@/lib/analytics";
import { sendLeadNotification } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/lead — capture a homeowner lead (SPEC §6).
 * Requires at least one of email/phone; TCPA SMS consent is re-validated
 * server-side when a phone is present. Stores the lead + quote + inputs,
 * notifies the contractor (Resend), and records the lead_captured funnel event.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const blocked = await guard(req, { businessId: input.businessId, getAllowedDomains });
  if (blocked) return blocked;

  const result = await createLead(input);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "store_failed" }, { status: 502 });
  }

  await recordEvent(input.businessId, "lead_captured", {
    kind: input.quote.kind,
    stored: result.stored,
  });

  // Notify the contractor (best-effort; never blocks the homeowner).
  if (result.stored && getServiceClient()) {
    try {
      const cfg = await getPublicConfig(input.businessId);
      const supabase = getServiceClient()!;
      const { data: biz } = await supabase
        .from("businesses")
        .select("notification_email")
        .eq("id", input.businessId)
        .maybeSingle();
      const to = (biz as { notification_email?: string } | null)?.notification_email;
      if (to) {
        await sendLeadNotification({
          to,
          businessName: cfg.name,
          contact: { name: input.name, email: input.email, phone: input.phone },
          quoteDisplay: input.quote.display ?? "Custom quote",
          address: (input.inputs as { address?: string }).address ?? null,
          smsConsent: input.smsConsent,
        });
      }
    } catch {
      /* email failure must not fail the lead */
    }
  }

  return NextResponse.json({ ok: true, stored: result.stored });
}
