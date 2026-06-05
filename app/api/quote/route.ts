import { NextResponse } from "next/server";
import { quoteInputSchema } from "@/lib/schemas";
import { loadPricingConfig } from "@/lib/config";
import { estimate } from "@/lib/estimate";
import { guard } from "@/lib/access";
import { getAllowedDomains } from "@/lib/business";

export const runtime = "nodejs";

/**
 * POST /api/quote
 * Body: { lotSqft, hasStructure, lastCut, obstructions, terrain, recurring, businessId? }
 * Computes the estimate server-side (price math is never trusted to the client)
 * and returns either a price range or a custom-quote signal.
 * Protected by per-IP rate limiting + the per-business Origin allowlist.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = quoteInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { businessId, ...input } = parsed.data;

  const blocked = await guard(req, { businessId, getAllowedDomains });
  if (blocked) return blocked;
  const config = await loadPricingConfig(businessId);
  const result = estimate(input, config);

  if (result.kind === "custom_quote") {
    // Don't reveal a figure; the widget captures contact for human follow-up.
    return NextResponse.json({
      kind: "custom_quote",
      reason: result.reason,
      needsManualReview: result.needsManualReview,
    });
  }

  return NextResponse.json({
    kind: "range",
    low: result.low,
    high: result.high,
    display: result.display,
    needsManualReview: result.needsManualReview,
  });
}
