import { env } from "./env";

/**
 * Optional deposit via Stripe Checkout, created through the Stripe REST API
 * (no SDK dependency). Off by default; only used when a contractor enables the
 * deposit and STRIPE_SECRET_KEY is configured.
 */
export interface CheckoutParams {
  amountCents: number;
  businessName: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
}

export async function createDepositCheckout(
  params: CheckoutParams,
): Promise<{ url: string } | { error: string }> {
  if (!env.stripeKey) return { error: "not_configured" };
  if (!params.amountCents || params.amountCents < 50) return { error: "invalid_amount" };

  // Stripe expects application/x-www-form-urlencoded with bracketed keys.
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", params.successUrl);
  form.set("cancel_url", params.cancelUrl);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(params.amountCents));
  form.set(
    "line_items[0][price_data][product_data][name]",
    `${params.businessName} — service deposit`,
  );
  if (params.customerEmail) form.set("customer_email", params.customerEmail);
  for (const [k, v] of Object.entries(params.metadata ?? {})) {
    form.set(`metadata[${k}]`, v);
  }

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const json = (await res.json()) as { url?: string; error?: { message: string } };
    if (!res.ok || !json.url) return { error: json.error?.message ?? "stripe_error" };
    return { url: json.url };
  } catch {
    return { error: "stripe_error" };
  }
}
