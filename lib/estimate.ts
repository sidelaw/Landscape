import type { LastCutOption, PricingConfig } from "./config";

/**
 * The estimate engine — SPEC §2–§4.
 *
 * Pure function of (inputs, config): no I/O, no globals, no hardcoded prices.
 * Lives server-side; the widget renders only what this returns. The reactive
 * landscape illustration is a trust device and does NOT feed this calculation.
 */

export interface EstimateInput {
  /** Lot area in square feet (from Regrid, or manual entry). */
  lotSqft: number;
  /** Regrid structure flag; null when unknown. false → open-lot coverage bump. */
  hasStructure: boolean | null;
  lastCut: LastCutOption;
  /** Obstructions slider, normalized 0 (none) → 1 (a lot). */
  obstructions: number;
  /** Ground-level slider, normalized 0 (flat) → 1 (small hills). */
  terrain: number;
  recurring: boolean;
}

export interface EstimateBreakdown {
  coverageRatio: number;
  turfSqft: number;
  raw: number;
  lastCutMult: number;
  obstructionMult: number;
  terrainMult: number;
  recurringApplied: boolean;
  price: number; // pre-range, post-min-charge
  needsManualReview: boolean;
}

export type EstimateResult =
  | ({
      kind: "range";
      low: number;
      high: number;
      display: string; // e.g. "$73 – $94"
    } & EstimateBreakdown)
  | ({
      kind: "custom_quote";
      reason: "above_cap";
    } & EstimateBreakdown);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Interpolate a slider (0..1) into a multiplier from 1.0 → max. */
function interpolateMultiplier(slider: number, max: number): number {
  return 1 + clamp01(slider) * (max - 1);
}

/** Coverage ratio from lot size + structure flag — SPEC §2. */
export function coverageRatio(
  lotSqft: number,
  hasStructure: boolean | null,
  config: PricingConfig,
): { ratio: number; manualReview: boolean } {
  // No building on the parcel → likely an open lot; bump coverage.
  if (hasStructure === false) {
    return { ratio: config.openLotCoverage, manualReview: false };
  }
  for (const band of config.coverageBands) {
    if (lotSqft <= band.maxSqft) {
      return { ratio: band.ratio, manualReview: Boolean(band.manualReview) };
    }
  }
  // Fallback (shouldn't hit if a band has maxSqft = Infinity).
  const last = config.coverageBands[config.coverageBands.length - 1];
  return { ratio: last.ratio, manualReview: Boolean(last.manualReview) };
}

export function estimate(input: EstimateInput, config: PricingConfig): EstimateResult {
  const { ratio, manualReview } = coverageRatio(
    input.lotSqft,
    input.hasStructure,
    config,
  );
  const turfSqft = input.lotSqft * ratio;

  const raw = (turfSqft / 1000) * config.baseRatePer1000Sqft;

  const lastCutMult = config.lastCutMultipliers[input.lastCut];
  const obstructionMult = interpolateMultiplier(
    input.obstructions,
    config.obstructionMultiplierMax,
  );
  const terrainMult = interpolateMultiplier(input.terrain, config.terrainMultiplierMax);

  let adj = raw * lastCutMult * obstructionMult * terrainMult;
  const recurringApplied = input.recurring;
  if (recurringApplied) {
    adj = adj * (1 - config.recurringDiscountPct / 100);
  }

  const price = Math.max(adj, config.minimumCharge);

  const breakdown: EstimateBreakdown = {
    coverageRatio: ratio,
    turfSqft,
    raw,
    lastCutMult,
    obstructionMult,
    terrainMult,
    recurringApplied,
    price,
    needsManualReview: manualReview,
  };

  // High quotes go to a human (SPEC §3): don't show a figure.
  if (price > config.autoQuoteCap) {
    return { kind: "custom_quote", reason: "above_cap", ...breakdown };
  }

  // Range — never advertise below the minimum charge.
  const lowRaw = Math.max(price * (1 - config.rangeLowPct / 100), config.minimumCharge);
  const highRaw = price * (1 + config.rangeHighPct / 100);
  const low = Math.round(lowRaw);
  const high = Math.round(highRaw);

  return {
    kind: "range",
    low,
    high,
    display: `$${low} – $${high}`,
    ...breakdown,
  };
}
