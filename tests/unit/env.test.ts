import { describe, expect, it } from "vitest";

import { serverEnvSchema } from "@/lib/env";

const baseEnv = {
  NODE_ENV: "development" as const,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPPORT_WHATSAPP: "+256700000000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
  SUPABASE_SERVICE_ROLE_KEY: "b".repeat(40),
};

describe("serverEnvSchema", () => {
  it("rejects an empty environment instead of inventing secrets", () => {
    const result = serverEnvSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a complete non-production mock configuration", () => {
    const result = serverEnvSchema.safeParse(baseEnv);
    expect(result.success).toBe(true);
  });

  it("rejects live payments without Flutterwave credentials", () => {
    const result = serverEnvSchema.safeParse({
      ...baseEnv,
      PAYMENTS_MODE: "live",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a complete production configuration", () => {
    const result = serverEnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: "production",
      PAYMENTS_MODE: "live",
      FLW_PUBLIC_KEY: "flw_pub",
      FLW_SECRET_KEY: "flw_secret",
      FLW_WEBHOOK_HASH: "hash",
      OSRM_BASE_URL: "https://osrm.example.com",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
      CRON_SECRET: "cron-secret",
    });
    expect(result.success).toBe(true);
  });

  it("rejects production mock payments", () => {
    const result = serverEnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: "production",
      PAYMENTS_MODE: "mock",
      OSRM_BASE_URL: "https://osrm.example.com",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
      CRON_SECRET: "cron-secret",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed support number", () => {
    const result = serverEnvSchema.safeParse({
      ...baseEnv,
      NEXT_PUBLIC_SUPPORT_WHATSAPP: "0700 000 000",
    });
    expect(result.success).toBe(false);
  });
});
