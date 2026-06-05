import { z } from "zod";

/** A single Regrid Typeahead suggestion shown in the address dropdown. */
export const typeaheadSuggestionSchema = z.object({
  /** Regrid parcel identifier (ll_uuid / path), used to fetch parcel detail. */
  parcelId: z.string(),
  /** Human-readable address label for the dropdown. */
  label: z.string(),
  /** Parcel centroid — used directly to query the Parcel API (no separate geocoder). */
  lat: z.number(),
  lon: z.number(),
});
export type TypeaheadSuggestion = z.infer<typeof typeaheadSuggestionSchema>;

export const typeaheadResponseSchema = z.object({
  suggestions: z.array(typeaheadSuggestionSchema),
  /** True when results came from the dev mock (no Regrid token configured). */
  mock: z.boolean().optional(),
});
export type TypeaheadResponse = z.infer<typeof typeaheadResponseSchema>;

/** Where the lot size came from — drives the "unverified" flag downstream. */
export const lotSourceSchema = z.enum(["regrid", "manual", "mock"]);
export type LotSource = z.infer<typeof lotSourceSchema>;

/** Normalized parcel facts the estimate engine needs. */
export const parcelSchema = z.object({
  parcelId: z.string().nullable(),
  lat: z.number(),
  lon: z.number(),
  address: z.string().nullable(),
  /** Lot area in square feet. Null when no parcel matched (→ manual entry). */
  lotSqft: z.number().positive().nullable(),
  /** Whether Regrid reports a structure on the parcel (affects coverage band). */
  hasStructure: z.boolean().nullable(),
  /** GeoJSON polygon for optional thumbnail overlay; null when unavailable. */
  polygon: z.unknown().nullable(),
  lotSource: lotSourceSchema,
  /** False when the homeowner must confirm/enter lot size manually. */
  verified: z.boolean(),
});
export type Parcel = z.infer<typeof parcelSchema>;

/** Request body for the parcel lookup proxy. */
export const parcelQuerySchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lon: z.coerce.number().gte(-180).lte(180),
  parcelId: z.string().optional(),
  address: z.string().optional(),
});
export type ParcelQuery = z.infer<typeof parcelQuerySchema>;

/** Inputs for a quote request (the 3 condition inputs + lot facts). */
export const quoteInputSchema = z.object({
  businessId: z.string().optional(),
  lotSqft: z.number().positive(),
  hasStructure: z.boolean().nullable().default(null),
  lastCut: z.enum([
    "within_week",
    "2_3_weeks",
    "about_month",
    "2_3_months",
    "6_plus_months",
  ]),
  obstructions: z.number().min(0).max(1),
  terrain: z.number().min(0).max(1),
  recurring: z.boolean().default(false),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

// ── Pricing config validation (used when reading stored config + on save) ─────

export const coverageBandSchema = z.object({
  maxSqft: z.number().nonnegative(),
  ratio: z.number().min(0).max(1),
  manualReview: z.boolean().optional(),
});

export const pricingConfigSchema = z.object({
  baseRatePer1000Sqft: z.number().positive(),
  minimumCharge: z.number().nonnegative(),
  lastCutMultipliers: z.object({
    within_week: z.number().positive(),
    "2_3_weeks": z.number().positive(),
    about_month: z.number().positive(),
    "2_3_months": z.number().positive(),
    "6_plus_months": z.number().positive(),
  }),
  obstructionMultiplierMax: z.number().min(1),
  terrainMultiplierMax: z.number().min(1),
  recurringDiscountPct: z.number().min(0).max(100),
  rangeLowPct: z.number().min(0).max(100),
  rangeHighPct: z.number().min(0).max(100),
  autoQuoteCap: z.number().positive(),
  coverageBands: z.array(coverageBandSchema).min(1),
  openLotCoverage: z.number().min(0).max(1),
});

/** Body for the dashboard "save business" server action. */
export const businessUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  notificationEmail: z.string().email().max(254).nullable(),
  pricing: pricingConfigSchema,
  allowedDomains: z.array(z.string().trim().min(1).max(253)).max(50),
});
export type BusinessUpdateInput = z.infer<typeof businessUpdateSchema>;
