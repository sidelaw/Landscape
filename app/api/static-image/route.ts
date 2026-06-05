import { NextResponse } from "next/server";
import { googleStaticUrl, placeholderSvg } from "@/lib/maps";
import { guard } from "@/lib/access";
import { getAllowedDomains } from "@/lib/business";

export const runtime = "nodejs";

/**
 * GET /api/static-image?lat=&lon=&zoom=
 * Streams the Google Maps Static satellite thumbnail through our server so the
 * Maps API key never reaches the client. Falls back to an inline SVG
 * placeholder when the key is unset or the upstream image fails.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;

  const blocked = await guard(req, {
    businessId: sp.get("businessId"),
    getAllowedDomains,
  });
  if (blocked) return blocked;

  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  const zoom = sp.get("zoom") ? Number(sp.get("zoom")) : undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
  }

  const url = googleStaticUrl({ lat, lon, zoom });
  if (!url) return svgResponse();

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return svgResponse();
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return svgResponse();
  }
}

function svgResponse() {
  return new NextResponse(placeholderSvg(), {
    status: 200,
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
}
