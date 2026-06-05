import { env, isRegridConfigured } from "./env";
import { cacheGet, cacheKey, cacheSet } from "./cache";
import type { Parcel, TypeaheadSuggestion } from "./schemas";

/**
 * Regrid client — Typeahead (address autocomplete) + Parcel (lot facts).
 *
 * Design notes:
 * - All calls are server-side; the token never reaches the client.
 * - Responses are cached (see cache.ts) before/after the network call.
 * - One retry with backoff on timeout/5xx; on hard failure the caller routes
 *   to the manual-entry fallback (never dead-end a lead).
 * - When REGRID_API_TOKEN is unset, we return deterministic MOCK data so the
 *   whole flow is runnable in local dev.
 *
 * ⚠️ FIELD-MAPPING RISK: the exact Regrid response field names below
 * (ll_gissqft, ll_gisacre, structure indicators) must be validated against a
 * live Regrid account on first integration and adjusted if they differ.
 * Parsing is intentionally defensive so an unexpected shape degrades to
 * "manual entry" rather than throwing.
 */

const TYPEAHEAD_URL = "https://app.regrid.com/api/v2/parcels/typeahead";
const PARCEL_POINT_URL = "https://app.regrid.com/api/v2/parcels/point";
const TIMEOUT_MS = 6000;

async function fetchJson(url: string): Promise<unknown> {
  // One retry with backoff on timeout / 5xx.
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429) throw new RegridError("rate_limited", res.status);
      if (res.status >= 500) throw new RegridError("server_error", res.status);
      if (!res.ok) throw new RegridError("bad_request", res.status);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      const retriable =
        err instanceof RegridError
          ? err.kind === "server_error" || err.kind === "rate_limited"
          : true; // network/abort
      if (attempt === 0 && retriable) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new RegridError("server_error");
}

export class RegridError extends Error {
  constructor(
    public kind: "rate_limited" | "server_error" | "bad_request",
    public status?: number,
  ) {
    super(`Regrid ${kind}${status ? ` (${status})` : ""}`);
  }
}

// ── Typeahead ────────────────────────────────────────────────────────────────

export async function typeahead(query: string): Promise<TypeaheadSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const key = cacheKey("typeahead", trimmed);
  const cached = await cacheGet<TypeaheadSuggestion[]>(key);
  if (cached) return cached;

  if (!isRegridConfigured()) {
    return mockTypeahead(trimmed);
  }

  const url = `${TYPEAHEAD_URL}?query=${encodeURIComponent(trimmed)}&token=${env.regridToken}`;
  const json = (await fetchJson(url)) as any;
  // Regrid v2 typeahead → { parcel_centroids: GeoJSON FeatureCollection }.
  // Stay defensive about the wrapper key + accept a bare array/FeatureCollection.
  const fc = json?.parcel_centroids ?? json?.parcels ?? json;
  const rows: any[] = Array.isArray(fc)
    ? fc
    : (fc?.features ?? json?.results ?? json?.suggestions ?? []);

  const suggestions: TypeaheadSuggestion[] = rows
    .map((r) => parseSuggestion(r))
    .filter((s): s is TypeaheadSuggestion => s !== null);

  if (suggestions.length > 0) await cacheSet(key, suggestions);
  return suggestions;
}

function parseSuggestion(r: any): TypeaheadSuggestion | null {
  // v2 returns GeoJSON Features: coords in geometry.coordinates ([lon, lat]),
  // address + ll_uuid under properties. Fall back to flat fields for safety.
  const props = r?.properties ?? r;
  const coords = r?.geometry?.coordinates;
  const lon = num(coords?.[0] ?? props?.lon ?? props?.lng ?? props?.longitude);
  const lat = num(coords?.[1] ?? props?.lat ?? props?.latitude);
  const address = str(props?.address ?? props?.headline ?? props?.label ?? props?.name);
  const context = str(props?.context);
  const label = address ? (context ? `${address}, ${context}` : address) : context;
  const parcelId = str(props?.ll_uuid ?? props?.parcel_id ?? props?.id ?? props?.path);
  if (lat === null || lon === null || !label) return null;
  return { parcelId: parcelId ?? "", label, lat, lon };
}

// ── Parcel ───────────────────────────────────────────────────────────────────

export async function parcelByPoint(
  lat: number,
  lon: number,
  fallbackAddress?: string,
): Promise<Parcel> {
  const key = cacheKey("parcel", `${lat.toFixed(6)},${lon.toFixed(6)}`);
  const cached = await cacheGet<Parcel>(key);
  if (cached) return cached;

  if (!isRegridConfigured()) {
    return mockParcel(lat, lon, fallbackAddress);
  }

  const url = `${PARCEL_POINT_URL}?lat=${lat}&lon=${lon}&token=${env.regridToken}`;
  const json = (await fetchJson(url)) as any;
  const feature =
    json?.parcels?.features?.[0] ?? json?.features?.[0] ?? json?.results?.[0] ?? null;

  const parcel = parseParcel(feature, lat, lon, fallbackAddress);
  if (parcel.verified) await cacheSet(key, parcel);
  return parcel;
}

function parseParcel(
  feature: any,
  lat: number,
  lon: number,
  fallbackAddress?: string,
): Parcel {
  // No parcel matched → manual-entry fallback (still usable for a quote).
  if (!feature) {
    return {
      parcelId: null,
      lat,
      lon,
      address: fallbackAddress ?? null,
      lotSqft: null,
      hasStructure: null,
      polygon: null,
      lotSource: "manual",
      verified: false,
    };
  }

  const f = feature?.properties?.fields ?? feature?.properties ?? feature?.fields ?? {};

  // Lot size: prefer reported sqft, else derive from acres (1 acre = 43,560 sqft).
  let lotSqft = num(f.ll_gissqft ?? f.gissqft ?? f.sqft ?? f.ll_sqft);
  if (lotSqft === null) {
    const acres = num(f.ll_gisacre ?? f.gisacre ?? f.acres ?? f.deeded_acres);
    if (acres !== null) lotSqft = Math.round(acres * 43560);
  }

  // Structure presence (affects coverage band §2). Defensive: null if unknown.
  const structRaw =
    f.struct ?? f.ll_bldg_count ?? f.num_buildings ?? f.building_count ?? f.improvement;
  const hasStructure =
    structRaw === undefined || structRaw === null
      ? null
      : typeof structRaw === "boolean"
        ? structRaw
        : num(structRaw) !== null
          ? num(structRaw)! > 0
          : null;

  const address = str(
    f.address ?? f.saddno_saddstr ?? feature?.properties?.headline ?? fallbackAddress,
  );

  return {
    parcelId: str(f.ll_uuid ?? feature?.properties?.ll_uuid ?? feature?.id),
    lat,
    lon,
    address: address ?? fallbackAddress ?? null,
    lotSqft: lotSqft && lotSqft > 0 ? lotSqft : null,
    hasStructure,
    polygon: feature?.geometry ?? null,
    lotSource: lotSqft && lotSqft > 0 ? "regrid" : "manual",
    verified: Boolean(lotSqft && lotSqft > 0),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// ── Dev mocks (used only when REGRID_API_TOKEN is unset) ──────────────────────

function mockTypeahead(query: string): TypeaheadSuggestion[] {
  // Deterministic suggestions seeded off the query so the dropdown is stable.
  const base = 39.7392 + (hash(query) % 1000) / 100000;
  const baseLon = -104.9903 - (hash(query) % 1000) / 100000;
  return [0, 1, 2].map((i) => ({
    parcelId: `mock-${hash(query)}-${i}`,
    label: `${100 + i * 4} ${titleCase(query)} St, Denver, CO`,
    lat: base + i * 0.0004,
    lon: baseLon - i * 0.0004,
  }));
}

function mockParcel(lat: number, lon: number, fallbackAddress?: string): Parcel {
  // ~quarter-acre lot with a house, matching the SPEC §7 worked example range.
  const seed = hash(`${lat},${lon}`);
  const lotSqft = 8000 + (seed % 8000); // 8,000–16,000 sqft
  return {
    parcelId: `mock-parcel-${seed}`,
    lat,
    lon,
    address: fallbackAddress ?? "123 Mock St, Denver, CO",
    lotSqft,
    hasStructure: true,
    polygon: null,
    lotSource: "mock",
    verified: true,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
