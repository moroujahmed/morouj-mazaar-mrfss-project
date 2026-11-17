import "server-only";

/**
 * Fixed-window rate limiting.
 *
 * `/api/distance` uses the default 30/minute budget. Phase 6 adds per-action
 * budgets (checkout per IP/phone, payment attempts per order, OTP per phone),
 * so the limiter takes an explicit maximum and window.
 *
 * Production uses Upstash so limits survive serverless instances. Failures are
 * thrown and callers fail closed. In-memory state is for local development and
 * automated tests only.
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
  consumeWithLimit(
    key: string,
    max: number,
    windowSeconds: number,
    now?: number,
  ): Promise<RateLimitResult>;
}

function windowResult(
  count: number,
  max: number,
  resetAt: number,
): RateLimitResult {
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetAt,
  };
}

function assertLimits(max: number, windowSeconds: number): void {
  if (!Number.isInteger(max) || max < 1) {
    throw new Error("rate limit maximum must be a positive integer");
  }
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("rate limit window must be a positive integer");
  }
}

class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();

  async consume(key: string, now = Date.now()): Promise<RateLimitResult> {
    return this.consumeWithLimit(
      key,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      now,
    );
  }

  async consumeWithLimit(
    key: string,
    max: number,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<RateLimitResult> {
    assertLimits(max, windowSeconds);

    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowSeconds * 1_000;
      this.windows.set(key, { count: 1, resetAt });
      return windowResult(1, max, resetAt);
    }

    existing.count += 1;
    return windowResult(existing.count, max, existing.resetAt);
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
    return this.consumeWithLimit(
      key,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      now,
    );
  }

  async consumeWithLimit(
    key: string,
    max: number,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<RateLimitResult> {
    assertLimits(max, windowSeconds);

    const count = await this.command<number>(["INCR", key]);
    if (count === 1) {
      await this.command(["EXPIRE", key, String(windowSeconds)]);
    }

    const ttl = await this.command<number>(["TTL", key]);
    const resetAt =
      now + (typeof ttl === "number" && ttl > 0 ? ttl : windowSeconds) * 1_000;

    return windowResult(count, max, resetAt);
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

  // Test-only: Playwright sets this so the suite never needs a live Upstash.
  if (process.env.RATE_LIMIT_FIXTURE === "1") {
    const globalStore = globalThis as LimiterGlobal;
    globalStore.__mrfssDistanceLimiter ??= new InMemoryRateLimiter();
    cached = globalStore.__mrfssDistanceLimiter;
    return cached;
  }

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
  return clientIpFromHeaders(request.headers);
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Unit tests call this after changing environment variables. */
export function resetRateLimiterForTests(): void {
  cached = null;
  delete (globalThis as LimiterGlobal).__mrfssDistanceLimiter;
}
