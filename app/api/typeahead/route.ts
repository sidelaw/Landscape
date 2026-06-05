import { NextResponse } from "next/server";
import { typeahead, RegridError } from "@/lib/regrid";
import { isRegridConfigured } from "@/lib/env";
import { guard } from "@/lib/access";
import { getAllowedDomains } from "@/lib/business";

export const runtime = "nodejs";

/**
 * GET /api/typeahead?q=<address fragment>&businessId=<id>
 * Proxies Regrid Typeahead. The Regrid token stays server-side.
 * Protected by per-IP rate limiting + the per-business Origin allowlist.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const businessId = params.get("businessId");

  const blocked = await guard(req, { businessId, getAllowedDomains });
  if (blocked) return blocked;

  if (q.trim().length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await typeahead(q);
    return NextResponse.json({ suggestions, mock: !isRegridConfigured() });
  } catch (err) {
    const status = err instanceof RegridError && err.kind === "rate_limited" ? 429 : 502;
    return NextResponse.json(
      { suggestions: [], error: "lookup_failed", canManualEntry: true },
      { status },
    );
  }
}
