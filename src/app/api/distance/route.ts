import {
  destinationQuerySchema,
  isWithinUganda,
  type Coordinates,
} from "@/lib/routing/coordinates";
import { resolveRoadRoute } from "@/lib/routing/resolve";
import { clientIp, getRateLimiter } from "@/lib/routing/rate-limit";
import { getPublicSettings } from "@/lib/storefront/public-settings";

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

export async function GET(request: Request): Promise<Response> {
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

  const route = await resolveRoadRoute({ destination, settings });

  if (!route.ok && route.code === "DISTANCE_OUT_OF_BOUNDS") {
    return failure(
      "DISTANCE_OUT_OF_BOUNDS",
      `This address is outside our ${settings.maxDeliveryRadiusKm} km delivery area. Choose another pin or dine in.`,
      422,
    );
  }

  if (!route.ok) {
    return failure(
      "DISTANCE_UNAVAILABLE",
      "We cannot calculate the route right now. Retry in a moment.",
      503,
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
        cached: route.cached,
      },
    },
    200,
    rateHeaders,
  );
}
