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
