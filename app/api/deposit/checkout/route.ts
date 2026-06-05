import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/access";
import { getAllowedDomains, getPublicConfig } from "@/lib/business";
import { createDepositCheckout } from "@/lib/stripe";

export const runtime = "nodejs";

const schema = z.object({
  businessId: z.string().min(1),
  email: z.string().email().optional(),
});

/**
 * POST /api/deposit/checkout — create a Stripe Checkout session for the
 * optional deposit. Only works when the contractor has enabled the deposit and
 * STRIPE_SECRET_KEY is configured; otherwise returns not_configured.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const blocked = await guard(req, {
    businessId: parsed.data.businessId,
    getAllowedDomains,
  });
  if (blocked) return blocked;

  const config = await getPublicConfig(parsed.data.businessId);
  if (!config.depositEnabled || config.depositAmountCents <= 0) {
    return NextResponse.json({ error: "deposit_disabled" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const session = await createDepositCheckout({
    amountCents: config.depositAmountCents,
    businessName: config.name,
    successUrl: `${origin}/deposit/success`,
    cancelUrl: `${origin}/deposit/cancelled`,
    customerEmail: parsed.data.email ?? null,
    metadata: { businessId: parsed.data.businessId },
  });

  if ("error" in session) {
    const status = session.error === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: session.error }, { status });
  }
  return NextResponse.json({ url: session.url });
}
