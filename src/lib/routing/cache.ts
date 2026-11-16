import "server-only";

import { z } from "zod";

/** Durable route cache. Only integer metres and seconds are stored, never fees. */

export type CachedRoute = {
  distanceM: number;
  durationSeconds: number;
};

export const ROUTE_CACHE_TTL_SECONDS = 24 * 60 * 60;

const cachedRouteSchema = z.object({
  distanceM: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nonnegative(),
});

export interface RouteCache {
  get(key: string): Promise<CachedRoute | null>;
  set(key: string, value: CachedRoute): Promise<void>;
}

class InMemoryRouteCache implements RouteCache {
  private readonly entries = new Map<
    string,
    { value: CachedRoute; expiresAt: number }
  >();

  async get(key: string): Promise<CachedRoute | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: CachedRoute): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ROUTE_CACHE_TTL_SECONDS * 1_000,
    });
  }
}

/**
 * Upstash REST adapter. Commands are sent as JSON arrays so no key or value
 * needs to be embedded in a URL. Failures surface to the caller; the distance
 * route degrades to a direct OSRM call rather than inventing a distance.
 */
class UpstashRouteCache implements RouteCache {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async command<T>(command: unknown[]): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) throw new Error("route cache request failed");

    const payload = (await response.json()) as {
      result?: T;
      error?: string;
    };
    if (payload.error) throw new Error("route cache command failed");
    return payload.result as T;
  }

  async get(key: string): Promise<CachedRoute | null> {
    const raw = await this.command<string | null>(["GET", key]);
    if (!raw) return null;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return null;
    }

    const parsed = cachedRouteSchema.safeParse(parsedJson);
    return parsed.success ? parsed.data : null;
  }

  async set(key: string, value: CachedRoute): Promise<void> {
    await this.command([
      "SET",
      key,
      JSON.stringify(value),
      "EX",
      String(ROUTE_CACHE_TTL_SECONDS),
    ]);
  }
}

type CacheGlobal = typeof globalThis & {
  __mrfssRouteCache?: RouteCache;
};

let cached: RouteCache | null = null;

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

/**
 * Production requires Upstash (validated in `env.ts`). Local development and
 * unit tests use an in-memory adapter. The adapter is shared across hot
 * reloads so a restart does not silently change cache behaviour mid-request.
 */
export function getRouteCache(): RouteCache {
  if (cached) return cached;

  const config = upstashConfig();
  if (config) {
    cached = new UpstashRouteCache(config.url, config.token);
    return cached;
  }

  const globalStore = globalThis as CacheGlobal;
  globalStore.__mrfssRouteCache ??= new InMemoryRouteCache();
  cached = globalStore.__mrfssRouteCache;
  return cached;
}

/** Unit tests call this after changing environment variables. */
export function resetRouteCacheForTests(): void {
  cached = null;
  delete (globalThis as CacheGlobal).__mrfssRouteCache;
}
