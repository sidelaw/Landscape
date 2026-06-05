import { NextResponse } from "next/server";
import { getPublicConfig } from "@/lib/business";

export const runtime = "nodejs";

/**
 * GET /api/config?businessId=...
 * Display-safe public config for the widget (business name, recurring discount
 * label). Rates and multipliers are deliberately NOT exposed — the estimate
 * engine keeps those server-side. Falls back to safe defaults. (This route does
 * no metered upstream call, so it is rate-limited only implicitly.)
 */
export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "missing_business_id" }, { status: 400 });
  }
  const config = await getPublicConfig(businessId);
  return NextResponse.json(
    { config },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
