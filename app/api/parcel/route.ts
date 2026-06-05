import { NextResponse } from "next/server";
import { parcelByPoint, RegridError } from "@/lib/regrid";
import { parcelQuerySchema } from "@/lib/schemas";
import { guard } from "@/lib/access";
import { getAllowedDomains } from "@/lib/business";

export const runtime = "nodejs";

/**
 * GET /api/parcel?lat=&lon=&address=
 * Queries the Regrid Parcel API by the Typeahead centroid (no separate
 * geocoder). Returns normalized parcel facts for the estimate engine.
 * On no-match or error, returns a `verified:false` parcel so the UI routes to
 * manual lot-size entry rather than blocking the quote.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const blocked = await guard(req, {
    businessId: sp.get("businessId"),
    getAllowedDomains,
  });
  if (blocked) return blocked;

  const params = Object.fromEntries(sp);
  const parsed = parcelQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { lat, lon, address } = parsed.data;
  try {
    const parcel = await parcelByPoint(lat, lon, address);
    return NextResponse.json({ parcel });
  } catch (err) {
    const rateLimited = err instanceof RegridError && err.kind === "rate_limited";
    // Graceful fallback: hand back an unverified parcel for manual entry.
    return NextResponse.json(
      {
        parcel: {
          parcelId: null,
          lat,
          lon,
          address: address ?? null,
          lotSqft: null,
          hasStructure: null,
          polygon: null,
          lotSource: "manual",
          verified: false,
        },
        error: rateLimited ? "rate_limited" : "lookup_failed",
      },
      { status: rateLimited ? 429 : 200 },
    );
  }
}
