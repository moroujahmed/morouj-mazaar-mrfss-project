import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  calculateDeliveryFee,
  formatDistanceMetres,
  isBeyondMaxDelivery,
} from "@/lib/currency";
import { normalizeUgPhone } from "@/lib/phone";
import {
  destinationQuerySchema,
  destinationSchema,
  isWithinUganda,
  quantizeCoordinate,
  routeCacheKey,
} from "@/lib/routing/coordinates";
import {
  buildDeliveryQuote,
  buildOrderTotals,
  kmToMetres,
  minimumOrderValue,
  movRemaining,
} from "@/lib/routing/quote";
import {
  buildOsrmUrl,
  fetchOsrmRoute,
  OsrmError,
} from "@/lib/routing/osrm";
import {
  getRateLimiter,
  resetRateLimiterForTests,
} from "@/lib/routing/rate-limit";
import {
  getRouteCache,
  resetRouteCacheForTests,
  ROUTE_CACHE_TTL_SECONDS,
} from "@/lib/routing/cache";
import { createFixtureSettings } from "@/lib/storefront/fixture";

const settings = createFixtureSettings();
const restaurant = {
  lat: settings.restaurantLat,
  lng: settings.restaurantLng,
};

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetRateLimiterForTests();
  resetRouteCacheForTests();
});

describe("canonical delivery quotes", () => {
  it("charges nothing for Nakasero at 1,562 m", () => {
    const quote = buildDeliveryQuote(1_562, 212, settings);
    expect(quote.fee).toBe(0);
    expect(quote.excessKm).toBe(0);
    expect(quote.withinDeliveryArea).toBe(true);
    expect(quote.codAvailable).toBe(true);
    expect(quote.distanceKm).toBe(1.562);
  });

  it("charges 6,000 for Ntinda at 8,093 m", () => {
    const quote = buildDeliveryQuote(8_093, 507, settings);
    expect(quote.fee).toBe(6_000);
    expect(quote.excessKm).toBe(4);
    expect(quote.withinDeliveryArea).toBe(true);
    // 8,093 m is just inside the 8.1 km COD radius.
    expect(quote.codAvailable).toBe(true);
  });

  it("uses the free radius as an inclusive boundary", () => {
    expect(calculateDeliveryFee(5_000, 1_500)).toBe(0);
    expect(calculateDeliveryFee(5_001, 1_500)).toBe(1_500);
    expect(calculateDeliveryFee(6_000, 1_500)).toBe(1_500);
    expect(calculateDeliveryFee(6_001, 1_500)).toBe(3_000);
  });

  it("blocks anything beyond the 15 km delivery radius", () => {
    expect(isBeyondMaxDelivery(15_000)).toBe(false);
    expect(isBeyondMaxDelivery(15_001)).toBe(true);
    expect(buildDeliveryQuote(15_000, 1_800, settings).fee).toBe(15_000);
    expect(buildDeliveryQuote(15_001, 1_800, settings).withinDeliveryArea).toBe(
      false,
    );
  });

  it("enforces the 8.1 km cash-on-delivery radius", () => {
    expect(buildDeliveryQuote(8_100, 500, settings).codAvailable).toBe(true);
    expect(buildDeliveryQuote(8_101, 500, settings).codAvailable).toBe(false);
  });

  it("derives the free radius from settings rather than a constant", () => {
    expect(calculateDeliveryFee(4_000, 2_000, 3_000)).toBe(2_000);
    expect(calculateDeliveryFee(3_000, 2_000, 3_000)).toBe(0);
  });
});

describe("canonical totals", () => {
  it("builds the USh 35,000 prepaid order", () => {
    const totals = buildOrderTotals({
      subtotal: 34_000,
      fee: 0,
      settings,
      mode: "delivery",
    });
    expect(totals).toEqual({
      itemsSubtotal: 34_000,
      packagingFee: 1_000,
      deliveryFee: 0,
      total: 35_000,
    });
  });

  it("builds the USh 38,000 cash-on-delivery order", () => {
    const totals = buildOrderTotals({
      subtotal: 31_000,
      fee: 6_000,
      settings,
      mode: "delivery",
    });
    expect(totals.total).toBe(38_000);
  });

  it("removes delivery and packaging for dine-in", () => {
    const totals = buildOrderTotals({
      subtotal: 8_000,
      fee: 0,
      settings,
      mode: "dine-in",
    });
    expect(totals).toEqual({
      itemsSubtotal: 8_000,
      packagingFee: 0,
      deliveryFee: 0,
      total: 8_000,
    });
  });
});

describe("minimum order value", () => {
  it("reports the exact remaining amount below the delivery minimum", () => {
    expect(minimumOrderValue(settings, "delivery")).toBe(20_000);
    expect(movRemaining(19_999, settings, "delivery")).toBe(1);
    expect(movRemaining(2_000, settings, "delivery")).toBe(18_000);
    expect(movRemaining(20_000, settings, "delivery")).toBe(0);
    expect(movRemaining(34_000, settings, "delivery")).toBe(0);
  });

  it("bypasses the minimum for dine-in", () => {
    expect(minimumOrderValue(settings, "dine-in")).toBe(0);
    expect(movRemaining(8_000, settings, "dine-in")).toBe(0);
  });
});

describe("coordinate validation", () => {
  it("parses decimal query coordinates", () => {
    const parsed = destinationQuerySchema.safeParse({
      lat: "0.3245",
      lng: "32.5782",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ lat: 0.3245, lng: 32.5782 });
    }
  });

  it("rejects missing, non-numeric, or out-of-range values", () => {
    expect(
      destinationQuerySchema.safeParse({ lat: undefined, lng: "32.5" }).success,
    ).toBe(false);
    expect(
      destinationQuerySchema.safeParse({ lat: "abc", lng: "32.5" }).success,
    ).toBe(false);
    expect(
      destinationQuerySchema.safeParse({ lat: "91", lng: "32.5" }).success,
    ).toBe(false);
    expect(
      destinationQuerySchema.safeParse({ lat: "0.3", lng: "181" }).success,
    ).toBe(false);
    expect(destinationQuerySchema.safeParse({ lat: "", lng: "" }).success).toBe(
      false,
    );
  });

  it("validates programmatic coordinates with Zod", () => {
    expect(destinationSchema.safeParse({ lat: 0.3245, lng: 32.5782 }).success).toBe(
      true,
    );
    expect(destinationSchema.safeParse({ lat: 0, lng: 200 }).success).toBe(false);
  });

  it("recognizes the Uganda routing envelope", () => {
    expect(isWithinUganda(restaurant)).toBe(true);
    expect(isWithinUganda({ lat: 0, lng: 0 })).toBe(false);
    expect(isWithinUganda({ lat: 51.5, lng: -0.12 })).toBe(false);
  });

  it("quantizes cache keys without losing material precision", () => {
    expect(quantizeCoordinate(0.32450001)).toBe("0.324500");
    expect(quantizeCoordinate(0.32450002)).toBe("0.324500");

    const nakasero = { lat: 0.3245, lng: 32.5782 };
    const ntinda = { lat: 0.3542, lng: 32.612 };
    expect(routeCacheKey(restaurant, nakasero)).toBe(
      routeCacheKey(restaurant, nakasero),
    );
    expect(routeCacheKey(restaurant, nakasero)).not.toBe(
      routeCacheKey(restaurant, ntinda),
    );
  });
});

describe("distance formatting", () => {
  it("formats metres and kilometres canonically", () => {
    expect(formatDistanceMetres(1_562)).toBe("1.562 km");
    expect(formatDistanceMetres(8_093)).toBe("8.093 km");
    expect(formatDistanceMetres(15_000)).toBe("15 km");
    expect(formatDistanceMetres(950)).toBe("950 m");
    expect(kmToMetres(8.1)).toBe(8_100);
  });
});

describe("Ugandan phone normalization", () => {
  it("normalizes mobile numbers to E.164", () => {
    for (const input of [
      "+256772123456",
      "256772123456",
      "0772123456",
      "772123456",
      "0772 123 456",
      "(0772) 123-456",
    ]) {
      expect(normalizeUgPhone(input)).toBe("+256772123456");
    }
    expect(normalizeUgPhone("0752123456")).toBe("+256752123456");
  });

  it("rejects short, landline, or non-numeric input", () => {
    expect(normalizeUgPhone("")).toBeNull();
    expect(normalizeUgPhone("12345")).toBeNull();
    expect(normalizeUgPhone("0414123456")).toBeNull();
    expect(normalizeUgPhone("not a phone")).toBeNull();
  });
});

describe("OSRM client", () => {
  it("builds the driving route URL with lng,lat ordering", () => {
    expect(
      buildOsrmUrl("https://osrm.example.com/", restaurant, {
        lat: 0.3245,
        lng: 32.5782,
      }),
    ).toBe(
      "https://osrm.example.com/route/v1/driving/32.581100,0.313600;32.578200,0.324500?overview=false&alternatives=false&steps=false",
    );
  });

  it("rounds metres and seconds to integers", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        code: "Ok",
        routes: [{ distance: 1_561.6, duration: 211.6 }],
      }),
    );

    const route = await fetchOsrmRoute({
      baseUrl: "https://osrm.example.com",
      origin: restaurant,
      destination: { lat: 0.3245, lng: 32.5782 },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(route).toEqual({ distanceM: 1_562, durationSeconds: 212 });
  });

  it("rejects a response with no route", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ code: "NoRoute", routes: [] }),
    );

    await expect(
      fetchOsrmRoute({
        baseUrl: "https://osrm.example.com",
        origin: restaurant,
        destination: { lat: 0.3245, lng: 32.5782 },
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(OsrmError);
  });

  it("rejects a failed HTTP response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("down", { status: 503 }),
    );

    await expect(
      fetchOsrmRoute({
        baseUrl: "https://osrm.example.com",
        origin: restaurant,
        destination: { lat: 0.3245, lng: 32.5782 },
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(OsrmError);
  });
});

describe("route cache", () => {
  it("stores integer routes for 24 hours", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-15T10:00:00Z"));
      const cache = getRouteCache();
      const key = routeCacheKey(restaurant, { lat: 0.3245, lng: 32.5782 });

      await cache.set(key, { distanceM: 1_562, durationSeconds: 212 });
      await expect(cache.get(key)).resolves.toEqual({
        distanceM: 1_562,
        durationSeconds: 212,
      });

      vi.advanceTimersByTime((ROUTE_CACHE_TTL_SECONDS + 1) * 1_000);
      await expect(cache.get(key)).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("distance rate limit", () => {
  it("allows 30 requests per minute and rejects the 31st", async () => {
    const limiter = getRateLimiter();
    const now = Date.parse("2026-11-15T10:00:00Z");

    for (let index = 1; index <= 30; index += 1) {
      const result = await limiter.consume("ip:test", now);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(30 - index);
    }

    const blocked = await limiter.consume("ip:test", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    // A different client keeps its own window.
    await expect(limiter.consume("ip:other", now)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("resets the window after a minute", async () => {
    const limiter = getRateLimiter();
    const start = Date.parse("2026-11-15T10:00:00Z");

    for (let index = 0; index < 31; index += 1) {
      await limiter.consume("ip:reset", start);
    }
    await expect(limiter.consume("ip:reset", start)).resolves.toMatchObject({
      allowed: false,
    });

    await expect(
      limiter.consume("ip:reset", start + 61_000),
    ).resolves.toMatchObject({ allowed: true, remaining: 29 });
  });
});
