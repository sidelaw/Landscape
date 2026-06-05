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
  constructor(
    private base: string,
    private businessId?: string,
  ) {}

  private url(path: string): string {
    const sep = path.includes("?") ? "&" : "?";
    const biz = this.businessId
      ? `${sep}businessId=${encodeURIComponent(this.businessId)}`
      : "";
    return `${this.base}${path}${biz}`;
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

  async getConfig(): Promise<PublicConfig | null> {
    if (!this.businessId) return null;
    const res = await fetch(this.url("/api/config"));
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.config ?? null;
  }

  /** Fire a funnel event (best-effort, fire-and-forget). */
  event(event: "address_entered" | "property_confirmed"): void {
    if (!this.businessId) return;
    void fetch(this.url("/api/event"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId: this.businessId, event }),
      keepalive: true,
    }).catch(() => {});
  }

  async lead(payload: LeadPayload): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(this.url("/api/lead"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, businessId: this.businessId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error ?? "lead_failed" };
    return { ok: true };
  }

  async depositCheckout(email?: string): Promise<{ url?: string; error?: string }> {
    const res = await fetch(this.url("/api/deposit/checkout"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId: this.businessId, email }),
    });
    return res.json().catch(() => ({ error: "deposit_failed" }));
  }
}

export interface PublicConfig {
  name: string;
  recurringDiscountPct: number;
  currency: string;
  depositEnabled: boolean;
  depositAmountCents: number;
}

export interface LeadPayload {
  name?: string;
  email?: string;
  phone?: string;
  smsConsent: boolean;
  quote: QuoteResult;
  inputs: Record<string, unknown>;
  lotSource?: string;
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
