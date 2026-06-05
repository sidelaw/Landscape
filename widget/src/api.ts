/**
 * Widget API client. The widget is self-contained (no server imports) and
 * talks only to our first-party proxied endpoints, so no secret ever reaches
 * the embed. `apiBase` lets an embed on another domain point at our origin
 * (Milestone 5 adds the Origin allowlist + rate limiting on these routes).
 */

export type LastCutOption =
  | "within_week"
  | "2_3_weeks"
  | "about_month"
  | "2_3_months"
  | "6_plus_months";

export const LAST_CUT_OPTIONS: { value: LastCutOption; label: string }[] = [
  { value: "within_week", label: "Within a week" },
  { value: "2_3_weeks", label: "2–3 weeks" },
  { value: "about_month", label: "About a month" },
  { value: "2_3_months", label: "2–3 months" },
  { value: "6_plus_months", label: "6+ months / a jungle" },
];

export interface Suggestion {
  parcelId: string;
  label: string;
  lat: number;
  lon: number;
}

export interface Parcel {
  parcelId: string | null;
  lat: number;
  lon: number;
  address: string | null;
  lotSqft: number | null;
  hasStructure: boolean | null;
  polygon: unknown;
  lotSource: "regrid" | "manual" | "mock";
  verified: boolean;
}

export type QuoteResult =
  | { kind: "range"; low: number; high: number; display: string; needsManualReview: boolean }
  | { kind: "custom_quote"; reason: string; needsManualReview: boolean };

export interface QuoteInput {
  businessId?: string;
  lotSqft: number;
  hasStructure: boolean | null;
  lastCut: LastCutOption;
  obstructions: number;
  terrain: number;
  recurring: boolean;
}

export class Api {
  constructor(private base: string) {}

  private url(path: string): string {
    return `${this.base}${path}`;
  }

  async typeahead(q: string): Promise<{ suggestions: Suggestion[]; mock?: boolean }> {
    if (q.trim().length < 3) return { suggestions: [] };
    const res = await fetch(this.url(`/api/typeahead?q=${encodeURIComponent(q)}`));
    if (!res.ok) return { suggestions: [] };
    return res.json();
  }

  async parcel(s: Suggestion): Promise<Parcel | null> {
    const res = await fetch(
      this.url(
        `/api/parcel?lat=${s.lat}&lon=${s.lon}&address=${encodeURIComponent(s.label)}`,
      ),
    );
    const data = await res.json().catch(() => null);
    return data?.parcel ?? null;
  }

  staticImageUrl(lat: number, lon: number): string {
    return this.url(`/api/static-image?lat=${lat}&lon=${lon}`);
  }

  async quote(input: QuoteInput): Promise<QuoteResult | { error: string }> {
    const res = await fetch(this.url("/api/quote"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { error: "quote_failed" };
    return res.json();
  }
}

// ── Lightweight US contact validation (TCPA gating happens in the UI) ─────────

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** Accepts a US phone with 10 digits (optionally a leading 1). */
export function isValidUsPhone(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

export function looksLikePhone(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 && /[\d().\-\s+]/.test(v) && !v.includes("@");
}
