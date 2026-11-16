import "server-only";

import { isBeyondMaxDelivery } from "@/lib/currency";
import { getRouteCache, type CachedRoute } from "@/lib/routing/cache";
import { routeCacheKey, type Coordinates } from "@/lib/routing/coordinates";
import { fetchOsrmRoute } from "@/lib/routing/osrm";
import { kmToMetres } from "@/lib/routing/quote";
import type { StoreSettings } from "@/lib/storefront/types";
import { resolveFixtureRoute } from "@/lib/storefront/fixture";

/**
 * One road-route resolver shared by `/api/distance` and the checkout action.
 *
 * Both paths must measure the same road distance from the restaurant to the
 * destination pin. The cache and `DISTANCE_FIXTURE` handling therefore live
 * here, not in the route handler. There is deliberately no straight-line
 * fallback: a failed route blocks checkout and never invents a fee.
 */

export type RoadRoute =
  | {
      ok: true;
      distanceM: number;
      durationSeconds: number;
      cached: boolean;
    }
  | { ok: false; code: "DISTANCE_UNAVAILABLE" | "DISTANCE_OUT_OF_BOUNDS" };

function isFixtureMode(): boolean {
  return process.env.DISTANCE_FIXTURE === "1";
}

function hasDurableInfrastructure(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

export async function resolveRoadRoute({
  destination,
  settings,
  origin,
}: {
  destination: Coordinates;
  settings: StoreSettings;
  origin?: Coordinates;
}): Promise<RoadRoute> {
  const fixture = isFixtureMode();
  const production = process.env.NODE_ENV === "production";

  // Production must not silently fall back to per-instance memory.
  if (production && !fixture && !hasDurableInfrastructure()) {
    return { ok: false, code: "DISTANCE_UNAVAILABLE" };
  }

  const from: Coordinates = origin ?? {
    lat: settings.restaurantLat,
    lng: settings.restaurantLng,
  };

  const cacheKey = routeCacheKey(from, destination);
  const cache = getRouteCache();

  let route: CachedRoute | null = null;
  let cached = false;

  try {
    route = await cache.get(cacheKey);
    cached = route !== null;
  } catch {
    // A cache outage degrades to a direct OSRM call; it never invents a distance.
    route = null;
  }

  if (!route) {
    if (fixture) {
      route = resolveFixtureRoute(destination.lat, destination.lng);
    } else {
      const osrmBaseUrl = process.env.OSRM_BASE_URL?.trim() ?? "";
      if (!osrmBaseUrl) return { ok: false, code: "DISTANCE_UNAVAILABLE" };

      try {
        route = await fetchOsrmRoute({
          baseUrl: osrmBaseUrl,
          origin: from,
          destination,
        });
      } catch {
        return { ok: false, code: "DISTANCE_UNAVAILABLE" };
      }
    }

    if (!route) return { ok: false, code: "DISTANCE_UNAVAILABLE" };

    try {
      await cache.set(cacheKey, route);
    } catch {
      // Best effort: a cache write failure must not block a valid route.
    }
  }

  const maxRadiusM = kmToMetres(settings.maxDeliveryRadiusKm);
  if (isBeyondMaxDelivery(route.distanceM, maxRadiusM)) {
    return { ok: false, code: "DISTANCE_OUT_OF_BOUNDS" };
  }

  return {
    ok: true,
    distanceM: route.distanceM,
    durationSeconds: route.durationSeconds,
    cached,
  };
}
