import { timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";

/**
 * Shared cron authentication. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; a missing secret fails closed and the
 * comparison is constant-time. `x-cron-secret` is accepted for manual runs and
 * matches the behaviour of the original expire-orders endpoint.
 */

export type CronAuthStatus = "OK" | "UNAUTHORIZED" | "CONFIGURATION";

function safeEqual(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkCronAuth(request: Request): CronAuthStatus {
  let secret: string;
  try {
    secret = getServerEnv().CRON_SECRET.trim();
  } catch {
    return "CONFIGURATION";
  }

  if (!secret) return "CONFIGURATION";

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) {
    return safeEqual(header.slice(7).trim(), secret) ? "OK" : "UNAUTHORIZED";
  }

  const direct = request.headers.get("x-cron-secret") ?? "";
  return direct && safeEqual(direct, secret) ? "OK" : "UNAUTHORIZED";
}
