import { NextResponse } from "next/server";
import { eventSchema } from "@/lib/schemas";
import { guard } from "@/lib/access";
import { getAllowedDomains } from "@/lib/business";
import { recordEvent } from "@/lib/analytics";

export const runtime = "nodejs";

/**
 * POST /api/event — record a widget-fired funnel event (address_entered,
 * property_confirmed) for the business. Rate-limited + allowlisted like the
 * other embed endpoints. Best-effort; always returns ok.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const blocked = await guard(req, {
    businessId: parsed.data.businessId,
    getAllowedDomains,
  });
  if (blocked) return blocked;

  await recordEvent(parsed.data.businessId, parsed.data.event);
  return NextResponse.json({ ok: true });
}
