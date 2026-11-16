import "server-only";

/**
 * Fixed-window rate limiting for `/api/distance`.
 *
 * Production uses Upstash so limits survive serverless instances. Failures are
 * thrown and the route fails closed. In-memory state is for local development
 * and automated tests only.
 */

export const RATE_LIMIT_MAX = 30;
export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_SECONDS * 1_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export interface RateLimiter {
  consume(key: string, now?: number): Promise<RateLimitResult>;
}

function windowResult(count: number, resetAt: number): RateLimitResult {
  return {
    allowed: count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - count),
    resetAt,
  };
}

class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();

  async consume(key: string, now = Date.now()): Promise<RateLimitResult> {
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + RATE_LIMIT_WINDOW_MS;
      this.windows.set(key, { count: 1, resetAt });
      return windowResult(1, resetAt);
    }

    existing.count += 1;
    return windowResult(existing.count, existing.resetAt);
  }
}

class UpstashRateLimiter implements RateLimiter {
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

    if (!response.ok) throw new Error("rate limit request failed");

    const payload = (await response.json()) as {
      result?: T;
      error?: string;
    };
    if (payload.error) throw new Error("rate limit command failed");
    return payload.result as T;
  }

  async consume(key: string, now = Date.now()): Promise<RateLimitResult> {
    const count = await this.command<number>(["INCR", key]);
    if (count === 1) {
      await this.command(["EXPIRE", key, String(RATE_LIMIT_WINDOW_SECONDS)]);
    }

    const ttl = await this.command<number>(["TTL", key]);
    const resetAt =
      now + (typeof ttl === "number" && ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS) * 1_000;

    return windowResult(count, resetAt);
  }
}

type LimiterGlobal = typeof globalThis & {
  __mrfssDistanceLimiter?: RateLimiter;
};

let cached: RateLimiter | null = null;

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

export function getRateLimiter(): RateLimiter {
  if (cached) return cached;

  const config = upstashConfig();
  if (config) {
    cached = new UpstashRateLimiter(config.url, config.token);
    return cached;
  }

  const globalStore = globalThis as LimiterGlobal;
  globalStore.__mrfssDistanceLimiter ??= new InMemoryRateLimiter();
  cached = globalStore.__mrfssDistanceLimiter;
  return cached;
}

/** Client IP from the trusted proxy headers; `unknown` is rate-limited too. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Unit tests call this after changing environment variables. */
export function resetRateLimiterForTests(): void {
  cached = null;
  delete (globalThis as LimiterGlobal).__mrfssDistanceLimiter;
}
