import { z } from "zod";

/** Wire contract for `GET /api/distance`, shared by the route and the client. */

export const distanceErrorCodeSchema = z.enum([
  "DISTANCE_UNAVAILABLE",
  "DISTANCE_OUT_OF_BOUNDS",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
]);

export const distanceSuccessSchema = z.object({
  success: z.literal(true),
  data: z.object({
    distanceM: z.number().int().nonnegative(),
    distanceKm: z.number().nonnegative(),
    durationSeconds: z.number().int().nonnegative(),
    source: z.literal("OSRM"),
    cached: z.boolean(),
  }),
});

export const distanceFailureSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: distanceErrorCodeSchema,
    message: z.string().min(1),
  }),
});

export const distanceResponseSchema = z.discriminatedUnion("success", [
  distanceSuccessSchema,
  distanceFailureSchema,
]);

export type DistanceSuccess = z.infer<typeof distanceSuccessSchema>;
export type DistanceFailure = z.infer<typeof distanceFailureSchema>;
export type DistanceFailureCode = z.infer<typeof distanceErrorCodeSchema>;
