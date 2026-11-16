import { isBeyondMaxDelivery } from "@/lib/currency";
import {
  destinationQuerySchema,
  isWithinUganda,
  routeCacheKey,
  type Coordinates,
} from "@/lib/routing/coordinates";
import { getRouteCache, type CachedRoute } from "@/lib/routing/cache";
import { resolveFixtureRoute } from "@/lib/storefront/fixture";
import { getPublicSettings } from "@/lib/storefront/public-settings";
import { kmToMetres } from "@/lib/routing/quote";
import { fetchOsrmRoute } from "@/lib/routing/osrm";
import {
  clientIp,
  getRateLimiter,
} from "@/lib/routing/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DistanceErrorCode =
  | "DISTANCE_UNAVAILABLE"
  | "DISTANCE_OUT_OF_BOUNDS"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED";

function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function failure(
  code: DistanceErrorCode,
  message: string,
  status: number,
  headers?: Record<string, string>,
): Response {
  return json({ success: false, error: { code, message } }, status, headers);
}

function isFixtureMode(): boolean {
  return process.env.DISTANCE_FIXTURE === "1";
}

function hasDurableInfrastructure(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

export async function GET(request: Request): Promise<Response> {
  const fixture = isFixtureMode();
  const production = process.env.NODE_ENV === "production";

  // Production must not silently fall back to per-instance memory.
  if (production && !fixture && !hasDurableInfrastructure()) {
    return failure(
      "DISTANCE_UNAVAILABLE",
      "We cannot calculate the route right now. Retry in a moment.",
      503,
    );
  }

  const ip = clientIp(request);
  let limit;
  try {
    limit = await getRateLimiter().consume(`mrfss:rl:distance:${ip}`);
  } catch {
    return failure(
      "DISTANCE_UNAVAILABLE",
      "We cannot calculate the route right now. Retry in a moment.",
      503,
    );
  }

  const rateHeaders = {
    "X-RateLimit-Limit": "30",
    "X-RateLimit-Remaining": String(limit.remaining),
  };

  if (!limit.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((limit.resetAt - Date.now()) / 1_000),
    );
    return failure(
      "RATE_LIMITED",
      "Too many distance requests. Wait a minute and try again.",
      429,
      { ...rateHeaders, "Retry-After": String(retryAfter) },
    );
  }

  const url = new URL(request.url);
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");

  const parsedQuery = destinationQuerySchema.safeParse({
    lat: latParam ?? undefined,
    lng: lngParam ?? undefined,
  });
  if (!parsedQuery.success) {
    return failure(
      "VALIDATION_ERROR",
      "Enter a valid latitude and longitude.",
      400,
    );
  }

  const destination: Coordinates = parsedQuery.data;
  if (!isWithinUganda(destination)) {
    return failure(
      "DISTANCE_OUT_OF_BOUNDS",
      "This address is outside our delivery area.",
      422,
    );
  }

  const settingsResult = await getPublicSettings();
  if (settingsResult.status !== "ok") {
    return failure(
      "DISTANCE_UNAVAILABLE",
      "We cannot calculate the route right now. Retry in a moment.",
      503,
    );
  }
  const { settings } = settingsResult;

  const origin: Coordinates = {
    lat: settings.restaurantLat,
    lng: settings.restaurantLng,
  };
  const cacheKey = routeCacheKey(origin, destination);
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
      if (!osrmBaseUrl) {
        return failure(
          "DISTANCE_UNAVAILABLE",
          "We cannot calculate the route right now. Retry in a moment.",
          503,
        );
      }

      try {
        route = await fetchOsrmRoute({
          baseUrl: osrmBaseUrl,
          origin,
          destination,
        });
      } catch {
        return failure(
          "DISTANCE_UNAVAILABLE",
          "We cannot calculate the route right now. Retry in a moment.",
          503,
        );
      }
    }

    if (!route) {
      return failure(
        "DISTANCE_UNAVAILABLE",
        "We cannot calculate the route right now. Retry in a moment.",
        503,
      );
    }

    try {
      await cache.set(cacheKey, route);
    } catch {
      // Best effort: a cache write failure must not block a valid route.
    }
  }

  const maxRadiusM = kmToMetres(settings.maxDeliveryRadiusKm);
  if (isBeyondMaxDelivery(route.distanceM, maxRadiusM)) {
    return failure(
      "DISTANCE_OUT_OF_BOUNDS",
      `This address is outside our ${settings.maxDeliveryRadiusKm} km delivery area. Choose another pin or dine in.`,
      422,
    );
  }

  return json(
    {
      success: true,
      data: {
        distanceM: route.distanceM,
        distanceKm: route.distanceM / 1_000,
        durationSeconds: route.durationSeconds,
        source: "OSRM",
        cached,
      },
    },
    200,
    rateHeaders,
  );
}
