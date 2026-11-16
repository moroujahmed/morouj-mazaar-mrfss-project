import "server-only";

import { z } from "zod";

import type { Coordinates } from "./coordinates";

/**
 * Minimal OSRM route client. It returns only the driving distance and
 * duration; the caller converts metres to a fee. There is deliberately no
 * straight-line (Haversine) fallback: a failed route must block checkout.
 */

export type OsrmRoute = {
  distanceM: number;
  durationSeconds: number;
};

const osrmResponseSchema = z.object({
  code: z.string(),
  routes: z
    .array(
      z.object({
        distance: z.number().finite().nonnegative(),
        duration: z.number().finite().nonnegative(),
      }),
    )
    .optional(),
});

export class OsrmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OsrmError";
  }
}

export function buildOsrmUrl(
  baseUrl: string,
  origin: Coordinates,
  destination: Coordinates,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const from = `${origin.lng.toFixed(6)},${origin.lat.toFixed(6)}`;
  const to = `${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}`;
  return `${base}/route/v1/driving/${from};${to}?overview=false&alternatives=false&steps=false`;
}

export async function fetchOsrmRoute({
  baseUrl,
  origin,
  destination,
  timeoutMs = 6_000,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  origin: Coordinates;
  destination: Coordinates;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<OsrmRoute> {
  if (!baseUrl.trim()) throw new OsrmError("OSRM is not configured");

  let response: Response;
  try {
    response = await fetchImpl(buildOsrmUrl(baseUrl, origin, destination), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new OsrmError("OSRM request failed");
  }

  if (!response.ok) throw new OsrmError("OSRM returned an error status");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new OsrmError("OSRM returned invalid JSON");
  }

  const parsed = osrmResponseSchema.safeParse(payload);
  if (!parsed.success) throw new OsrmError("OSRM response shape is invalid");
  if (parsed.data.code !== "Ok" || !parsed.data.routes?.length) {
    throw new OsrmError("OSRM found no driving route");
  }

  const route = parsed.data.routes[0];
  if (!route) throw new OsrmError("OSRM found no driving route");

  return {
    distanceM: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
  };
}
