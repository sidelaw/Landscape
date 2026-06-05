import { NextResponse } from "next/server";

/**
 * Abuse protection for the metered proxy endpoints (Regrid / Google Maps cost
 * money, and business-id is public in the embed snippet):
 *
 *  1. Per-IP rate limiting (sliding fixed window).
 *  2. Origin/Referer allowlist per business — a leaked business-id can't be
 *     embedded on another domain to run up the owner's API bill.
 *
 * Notes:
 *  - Same-origin requests (our hosted /q page, the demo page) are always
 *    allowed. Requests with no Origin/Referer (server-to-server, curl) are
 *    allowed — the rate limit still applies.
 *  - A business with an empty allowed_domains list is treated as unconfigured
 *    (no Origin restriction yet), so contractors aren't locked out before they
 *    set it up.
 *  - The rate-limit store is in-process: best-effort on serverless (per
 *    instance). For production-grade limits, back this with Upstash/Redis.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimit(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_PER_WINDOW) return false;
  b.count++;
  return true;
}

/** Strip protocol/path/leading www → bare host for comparison. */
function normalizeHost(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  return s.replace(/^www\./, "");
}

function hostMatches(host: string, allowed: string[]): boolean {
  const h = normalizeHost(host);
  return allowed.some((d) => {
    const a = normalizeHost(d);
    return a !== "" && (h === a || h.endsWith(`.${a}`));
  });
}

/** Host of the request itself (for same-origin allow). */
function selfHost(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return normalizeHost(host);
}

/** The embedding page's host, from Origin (fetch) or Referer (img). */
function callerHost(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (origin) return normalizeHost(origin);
  const referer = req.headers.get("referer");
  if (referer) return normalizeHost(referer);
  return null;
}

export interface GuardOptions {
  businessId?: string | null;
  /** Resolve a business's allowed domains (null/empty → unrestricted). */
  getAllowedDomains?: (businessId: string) => Promise<string[] | null>;
}

/**
 * Returns a NextResponse to short-circuit with (429/403), or null when the
 * request is allowed to proceed.
 */
export async function guard(
  req: Request,
  { businessId, getAllowedDomains }: GuardOptions,
): Promise<NextResponse | null> {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:${businessId ?? "-"}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (!businessId || !getAllowedDomains) return null;

  const caller = callerHost(req);
  if (!caller) return null; // no Origin/Referer → can't enforce; allow
  if (caller === selfHost(req)) return null; // same-origin (hosted page/demo)

  const allowed = await getAllowedDomains(businessId);
  if (!allowed || allowed.length === 0) return null; // unconfigured → allow

  if (!hostMatches(caller, allowed)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  return null;
}
