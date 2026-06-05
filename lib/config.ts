/**
 * Contractor pricing configuration.
 *
 * TIER 1: no hardcoded prices or coverage % live in the estimate engine. The
 * engine is a pure function of (inputs, config). These DEFAULTS are the seed
 * values from SPEC §5 — every contractor row is created with them and may then
 * tune any field. Per-contractor loading lands in Milestone 4; until then
 * `loadPricingConfig` returns the defaults.
 */

import { pricingConfigSchema } from "./schemas.ts";

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

/** A single coverage band: turf ratio applied up to `maxSqft` (inclusive). */
export interface CoverageBand {
  maxSqft: number; // upper bound, inclusive; use Infinity for the top band
  ratio: number; // 0..1 turf coverage
  manualReview?: boolean;
}

export interface PricingConfig {
  baseRatePer1000Sqft: number;
  minimumCharge: number;
  lastCutMultipliers: Record<LastCutOption, number>;
  obstructionMultiplierMax: number;
  terrainMultiplierMax: number;
  recurringDiscountPct: number;
  rangeLowPct: number;
  rangeHighPct: number;
  autoQuoteCap: number;
  /** Coverage bands (SPEC §2). Advanced/optional override of the system bands. */
  coverageBands: CoverageBand[];
  /** Coverage when Regrid reports no structure on the parcel (likely open lot). */
  openLotCoverage: number;
}

/** System coverage bands — SPEC §2. Starting assumptions; calibrate post-launch. */
// The top band is "unbounded"; we use a large finite sentinel rather than
// Infinity so the value survives JSONB round-trips (JSON has no Infinity).
export const UNBOUNDED_SQFT = 1_000_000_000;

export const DEFAULT_COVERAGE_BANDS: CoverageBand[] = [
  { maxSqft: 2999, ratio: 0.5 },
  { maxSqft: 7499, ratio: 0.6 },
  { maxSqft: 14999, ratio: 0.65 },
  { maxSqft: 43560, ratio: 0.7 }, // ≤ 1 acre
  { maxSqft: UNBOUNDED_SQFT, ratio: 0.55, manualReview: true }, // > 1 acre
];

/** Lot size above which a job is flagged for manual review (1 acre). */
export const MANUAL_REVIEW_SQFT = 43560;

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  baseRatePer1000Sqft: 7.0,
  minimumCharge: 45,
  lastCutMultipliers: {
    within_week: 1.0,
    "2_3_weeks": 1.15,
    about_month: 1.4,
    "2_3_months": 1.8,
    "6_plus_months": 2.75,
  },
  obstructionMultiplierMax: 1.35,
  terrainMultiplierMax: 1.2,
  recurringDiscountPct: 15,
  rangeLowPct: 10,
  rangeHighPct: 15,
  autoQuoteCap: 300,
  coverageBands: DEFAULT_COVERAGE_BANDS,
  openLotCoverage: 0.8,
};

/**
 * Resolve a stored (possibly partial/malformed) pricing JSON into a valid
 * PricingConfig: deep-merge over the SPEC defaults, then validate. On any
 * validation failure (e.g. a non-numeric rate from a corrupted row) fall back
 * to the defaults rather than risk a NaN/throwing estimate.
 */
export function resolvePricing(stored: unknown): PricingConfig {
  if (!stored || typeof stored !== "object") return DEFAULT_PRICING_CONFIG;
  const s = stored as Record<string, unknown>;

  const merged: PricingConfig = {
    ...DEFAULT_PRICING_CONFIG,
    ...(s as Partial<PricingConfig>),
    lastCutMultipliers: {
      ...DEFAULT_PRICING_CONFIG.lastCutMultipliers,
      ...(s.lastCutMultipliers && typeof s.lastCutMultipliers === "object"
        ? (s.lastCutMultipliers as Record<string, number>)
        : {}),
    },
    coverageBands:
      Array.isArray(s.coverageBands) && s.coverageBands.length > 0
        ? (s.coverageBands as CoverageBand[])
        : DEFAULT_PRICING_CONFIG.coverageBands,
  };

  const parsed = pricingConfigSchema.safeParse(merged);
  return parsed.success ? (parsed.data as PricingConfig) : DEFAULT_PRICING_CONFIG;
}

/**
 * Load a contractor's pricing config by business id from Postgres (service
 * role, server-side). Resolves to the defaults when no business id is given,
 * the row isn't found, Supabase isn't configured, or the stored config fails
 * validation.
 */
export async function loadPricingConfig(businessId?: string): Promise<PricingConfig> {
  if (!businessId) return DEFAULT_PRICING_CONFIG;

  const { getServiceClient } = await import("./supabase");
  const supabase = getServiceClient();
  if (!supabase) return DEFAULT_PRICING_CONFIG;

  const { data } = await supabase
    .from("businesses")
    .select("pricing")
    .eq("id", businessId)
    .maybeSingle();
  return resolvePricing(data?.pricing);
}
