import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/distance/route";
import { resetRouteCacheForTests } from "@/lib/routing/cache";
import { resetRateLimiterForTests } from "@/lib/routing/rate-limit";

type SuccessBody = {
  success: true;
  data: {
    distanceM: number;
    distanceKm: number;
    durationSeconds: number;
    source: string;
    cached: boolean;
  };
};

type FailureBody = {
  success: false;
  error: { code: string; message: string };
};

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

function request(query: string, ip = nextIp()): Request {
  return new Request(`http://localhost/api/distance${query}`, {
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  vi.stubEnv("DISTANCE_FIXTURE", "1");
  vi.stubEnv("STOREFRONT_FIXTURE", "1");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  resetRouteCacheForTests();
  resetRateLimiterForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetRouteCacheForTests();
  resetRateLimiterForTests();
});

describe("GET /api/distance", () => {
  it("returns the canonical Nakasero route and then serves it from cache", async () => {
    const first = await GET(request("?lat=0.3245&lng=32.5782"));
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as SuccessBody;
    expect(firstBody.success).toBe(true);
    expect(firstBody.data).toMatchObject({
      distanceM: 1_562,
      distanceKm: 1.562,
      durationSeconds: 212,
      source: "OSRM",
      cached: false,
    });

    const second = await GET(request("?lat=0.3245&lng=32.5782"));
    const secondBody = (await second.json()) as SuccessBody;
    expect(secondBody.data.cached).toBe(true);
  });

  it("returns the canonical Ntinda route", async () => {
    const response = await GET(request("?lat=0.3542&lng=32.6120"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as SuccessBody;
    expect(body.data.distanceM).toBe(8_093);
    expect(body.data.durationSeconds).toBe(507);
  });

  it("rejects a destination beyond the 15 km delivery radius", async () => {
    const response = await GET(request("?lat=0.0512&lng=32.4637"));
    expect(response.status).toBe(422);
    const body = (await response.json()) as FailureBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("DISTANCE_OUT_OF_BOUNDS");
  });

  it("rejects missing or malformed coordinates", async () => {
    for (const query of [
      "",
      "?lat=0.3245",
      "?lat=abc&lng=32.5782",
      "?lat=91&lng=32.5782",
      "?lat=0.3245&lng=181",
    ]) {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
      const body = (await response.json()) as FailureBody;
      expect(body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects coordinates outside the Uganda routing envelope", async () => {
    const response = await GET(request("?lat=0&lng=0"));
    expect(response.status).toBe(422);
    const body = (await response.json()) as FailureBody;
    expect(body.error.code).toBe("DISTANCE_OUT_OF_BOUNDS");
  });

  it("fails closed when no route is available in fixture mode", async () => {
    const response = await GET(request("?lat=0.4000&lng=32.7000"));
    expect(response.status).toBe(503);
    const body = (await response.json()) as FailureBody;
    expect(body.error.code).toBe("DISTANCE_UNAVAILABLE");
  });

  it("rate limits the 31st request from one IP", async () => {
    const ip = "198.51.100.7";
    for (let index = 0; index < 30; index += 1) {
      const response = await GET(request("?lat=0.3245&lng=32.5782", ip));
      expect(response.status).toBe(200);
    }

    const blocked = await GET(request("?lat=0.3245&lng=32.5782", ip));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    const body = (await blocked.json()) as FailureBody;
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("fails closed in production without durable rate limiting", async () => {
    vi.stubEnv("DISTANCE_FIXTURE", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const response = await GET(request("?lat=0.3245&lng=32.5782"));
    expect(response.status).toBe(503);
    const body = (await response.json()) as FailureBody;
    expect(body.error.code).toBe("DISTANCE_UNAVAILABLE");
  });
});
