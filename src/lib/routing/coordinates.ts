import { z } from "zod";

/**
 * Coordinate validation shared by the distance API and the checkout client.
 *
 * Coordinates are only accepted as decimal degrees. The route handler parses
 * query strings with `coordinateParamSchema`; UI code reuses `coordinateSchema`
 * so an invalid pin is rejected before it reaches the network.
 */

export type Coordinates = {
  lat: number;
  lng: number;
};

export const coordinateSchema = z
  .number({ invalid_type_error: "Coordinate must be a number" })
  .finite("Coordinate must be finite");

export const latitudeSchema = coordinateSchema
  .min(-90, "Latitude must be at least -90")
  .max(90, "Latitude must be at most 90");

export const longitudeSchema = coordinateSchema
  .min(-180, "Longitude must be at least -180")
  .max(180, "Longitude must be at most 180");

export const destinationSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});

/** Query-string parser: rejects empty, partial, or non-decimal input. */
const decimalParamSchema = z
  .string()
  .trim()
  .min(1, "Coordinate is required")
  .regex(/^-?\d{1,3}(\.\d+)?$/, "Coordinate must be a decimal number")
  .transform((value) => Number(value));

export const latitudeParamSchema = decimalParamSchema.pipe(latitudeSchema);
export const longitudeParamSchema = decimalParamSchema.pipe(longitudeSchema);

export const destinationQuerySchema = z.object({
  lat: latitudeParamSchema,
  lng: longitudeParamSchema,
});

/**
 * Broad Uganda envelope. It rejects obvious junk (0,0, other countries)
 * before an OSRM request is made. Delivery-radius enforcement still happens
 * against `max_delivery_radius_km`; this only guards the routing client.
 */
export const UGANDA_BOUNDS = {
  minLat: -1.6,
  maxLat: 4.3,
  minLng: 29.4,
  maxLng: 35.2,
} as const;

export function isWithinUganda({ lat, lng }: Coordinates): boolean {
  return (
    lat >= UGANDA_BOUNDS.minLat &&
    lat <= UGANDA_BOUNDS.maxLat &&
    lng >= UGANDA_BOUNDS.minLng &&
    lng <= UGANDA_BOUNDS.maxLng
  );
}

/**
 * Quantize coordinates for the cache key. Six decimal places is about 11 cm,
 * which keeps cache cardinality bounded without materially moving a route.
 * The returned distance is always recomputed from OSRM's integer metres; the
 * cache never stores a fee.
 */
export function quantizeCoordinate(value: number): string {
  return value.toFixed(6);
}

export function routeCacheKey(
  origin: Coordinates,
  destination: Coordinates,
): string {
  return [
    "mrfss:route:v1",
    quantizeCoordinate(origin.lat),
    quantizeCoordinate(origin.lng),
    quantizeCoordinate(destination.lat),
    quantizeCoordinate(destination.lng),
  ].join(":");
}
