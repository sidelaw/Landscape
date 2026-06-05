import { NextResponse } from "next/server";
import { typeahead, RegridError } from "@/lib/regrid";
import { isRegridConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * GET /api/typeahead?q=<address fragment>
 * Proxies Regrid Typeahead. The Regrid token stays server-side.
 * Note (Milestone 5): add Origin allowlist + rate limiting per business-id.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await typeahead(q);
    return NextResponse.json({
      suggestions,
      mock: !isRegridConfigured(),
    });
  } catch (err) {
    const status = err instanceof RegridError && err.kind === "rate_limited" ? 429 : 502;
    // Don't dead-end the user: empty suggestions + a flag so the UI can offer
    // manual address/lot entry.
    return NextResponse.json(
      { suggestions: [], error: "lookup_failed", canManualEntry: true },
      { status },
    );
  }
}
