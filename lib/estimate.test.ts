import { test } from "node:test";
import assert from "node:assert/strict";
import { estimate, coverageRatio, type EstimateInput } from "./estimate.ts";
import { DEFAULT_PRICING_CONFIG as cfg, resolvePricing } from "./config.ts";

const base: EstimateInput = {
  lotSqft: 10890,
  hasStructure: true,
  lastCut: "about_month",
  obstructions: 0.5,
  terrain: 0,
  recurring: false,
};

test("SPEC §7 worked example → $73 – $94", () => {
  const r = estimate(base, cfg);
  assert.equal(r.kind, "range");
  if (r.kind !== "range") return;
  assert.equal(r.low, 73);
  assert.equal(r.high, 94);
  assert.equal(r.display, "$73 – $94");
  assert.equal(Math.round(r.turfSqft), 7079);
});

test("SPEC §7 maintained + recurring → $45 – $57 (low floored to minimum)", () => {
  const r = estimate({ ...base, lastCut: "within_week", recurring: true }, cfg);
  assert.equal(r.kind, "range");
  if (r.kind !== "range") return;
  assert.equal(r.low, 45);
  assert.equal(r.high, 57);
});

test("coverage bands match SPEC §2", () => {
  assert.equal(coverageRatio(2000, true, cfg).ratio, 0.5);
  assert.equal(coverageRatio(3000, true, cfg).ratio, 0.6);
  assert.equal(coverageRatio(5000, true, cfg).ratio, 0.6);
  assert.equal(coverageRatio(7500, true, cfg).ratio, 0.65);
  assert.equal(coverageRatio(10000, true, cfg).ratio, 0.65);
  assert.equal(coverageRatio(15000, true, cfg).ratio, 0.7);
  assert.equal(coverageRatio(43560, true, cfg).ratio, 0.7);
  const overAcre = coverageRatio(50000, true, cfg);
  assert.equal(overAcre.ratio, 0.55);
  assert.equal(overAcre.manualReview, true);
});

test("no structure on parcel → open-lot coverage bump (80%)", () => {
  assert.equal(coverageRatio(10000, false, cfg).ratio, 0.8);
  // unknown structure falls through to the size bands
  assert.equal(coverageRatio(10000, null, cfg).ratio, 0.65);
});

test("obstruction/terrain sliders interpolate 1.0 → max", () => {
  const flatNone = estimate(
    { ...base, lastCut: "within_week", obstructions: 0, terrain: 0 },
    cfg,
  );
  const fullBoth = estimate(
    { ...base, lastCut: "within_week", obstructions: 1, terrain: 1 },
    cfg,
  );
  if (flatNone.kind !== "range" || fullBoth.kind !== "range") {
    assert.fail("expected ranges");
    return;
  }
  assert.equal(flatNone.obstructionMult, 1.0);
  assert.equal(flatNone.terrainMult, 1.0);
  assert.equal(fullBoth.obstructionMult, cfg.obstructionMultiplierMax);
  assert.equal(fullBoth.terrainMult, cfg.terrainMultiplierMax);
});

test("minimum charge floors small lots and the range low", () => {
  const r = estimate(
    {
      lotSqft: 1000,
      hasStructure: true,
      lastCut: "within_week",
      obstructions: 0,
      terrain: 0,
      recurring: false,
    },
    cfg,
  );
  if (r.kind !== "range") {
    assert.fail("expected range");
    return;
  }
  assert.equal(r.price, cfg.minimumCharge);
  assert.ok(r.low >= cfg.minimumCharge, "low never below the minimum charge");
});

test("price above auto_quote_cap routes to custom quote (no figure)", () => {
  const r = estimate(
    {
      lotSqft: 60000,
      hasStructure: true,
      lastCut: "6_plus_months",
      obstructions: 1,
      terrain: 1,
      recurring: false,
    },
    cfg,
  );
  assert.equal(r.kind, "custom_quote");
  if (r.kind !== "custom_quote") return;
  assert.equal(r.reason, "above_cap");
  assert.equal(r.needsManualReview, true); // > 1 acre band
  assert.ok(r.price > cfg.autoQuoteCap);
});

test("open lot over 1 acre still flags manual review", () => {
  const r = estimate(
    {
      lotSqft: 44000, // > 43,560 (1 acre), open lot
      hasStructure: false,
      lastCut: "within_week",
      obstructions: 0,
      terrain: 0,
      recurring: false,
    },
    cfg,
  );
  assert.equal(r.coverageRatio, cfg.openLotCoverage); // 0.80 open-lot bump
  assert.equal(r.needsManualReview, true);
});

test("resolvePricing falls back to defaults on malformed config", () => {
  assert.equal(resolvePricing(null), cfg); // not an object → default reference
  assert.equal(resolvePricing({ baseRatePer1000Sqft: "abc" }), cfg); // non-numeric → fallback
  // A non-object nested field is sanitized back to the defaults (value-equal).
  assert.deepEqual(resolvePricing({ lastCutMultipliers: "nope" }), cfg);
});

test("resolvePricing deep-merges a valid partial over defaults", () => {
  const r = resolvePricing({
    baseRatePer1000Sqft: 9,
    lastCutMultipliers: { within_week: 2 },
  });
  assert.equal(r.baseRatePer1000Sqft, 9);
  assert.equal(r.lastCutMultipliers.within_week, 2); // overridden
  assert.equal(r.lastCutMultipliers.about_month, cfg.lastCutMultipliers.about_month); // kept
  assert.equal(r.minimumCharge, cfg.minimumCharge); // kept
});

test("recurring discount applies the configured percentage", () => {
  const without = estimate({ ...base, recurring: false }, cfg);
  const withRec = estimate({ ...base, recurring: true }, cfg);
  if (without.kind !== "range" || withRec.kind !== "range") {
    assert.fail("expected ranges");
    return;
  }
  const ratio = withRec.price / without.price;
  assert.ok(Math.abs(ratio - (1 - cfg.recurringDiscountPct / 100)) < 1e-9);
});
