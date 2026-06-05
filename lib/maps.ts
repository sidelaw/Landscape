import { env, isMapsConfigured } from "./env";

/**
 * Google Maps Static API URL builder for the satellite thumbnail.
 *
 * TIER 1: the API key is appended server-side only. The widget never sees the
 * key — it requests our /api/static-image proxy, which redirects/streams from
 * the URL built here. When the key is unset, callers serve a placeholder.
 */

export interface StaticImageOpts {
  lat: number;
  lon: number;
  zoom?: number;
  width?: number;
  height?: number;
}

export function googleStaticUrl({
  lat,
  lon,
  zoom = 19,
  width = 600,
  height = 400,
}: StaticImageOpts): string | null {
  if (!isMapsConfigured()) return null;
  const params = new URLSearchParams({
    center: `${lat},${lon}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    maptype: "satellite",
    scale: "2",
    markers: `color:0x6cc24a|${lat},${lon}`,
    key: env.googleMapsKey!,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Inline SVG placeholder used when no Maps key is configured (local dev) or
 * when the upstream image fails — so the "Is this your property?" step always
 * renders something rather than a broken image.
 */
export function placeholderSvg(width = 600, height = 400): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#1d2a1f"/>
  <rect x="0" y="${height * 0.62}" width="100%" height="${height * 0.38}" fill="#2f7d32"/>
  <polygon points="${width * 0.5},${height * 0.3} ${width * 0.62},${height * 0.5} ${width * 0.38},${height * 0.5}" fill="#5a4632"/>
  <rect x="${width * 0.42}" y="${height * 0.5}" width="${width * 0.16}" height="${height * 0.12}" fill="#6b5440"/>
  <text x="50%" y="${height * 0.9}" fill="#9bbf9b" font-family="system-ui,sans-serif" font-size="16" text-anchor="middle">Satellite preview unavailable (no Maps key)</text>
</svg>`;
}
