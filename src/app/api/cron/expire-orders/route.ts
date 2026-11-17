import { timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { getOrderStore } from "@/lib/orders/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Payment-timeout cron. Cancels digital orders still `PENDING_PAYMENT` after
 * ten minutes and fails their open transactions. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; a missing secret fails closed.
 */

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeEqual(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorized(request: Request, secret: string): boolean {
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) {
    return safeEqual(header.slice(7).trim(), secret);
  }

  const direct = request.headers.get("x-cron-secret") ?? "";
  return direct ? safeEqual(direct, secret) : false;
}

async function run(request: Request): Promise<Response> {
  let secret: string;
  try {
    secret = getServerEnv().CRON_SECRET.trim();
  } catch {
    return json({ ok: false, error: "CONFIGURATION" }, 503);
  }

  if (!secret) return json({ ok: false, error: "CONFIGURATION" }, 503);
  if (!authorized(request, secret)) {
    return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  try {
    const expired = await getOrderStore().expirePendingOrders();
    return json({ ok: true, expired }, 200);
  } catch {
    return json({ ok: false, error: "STORAGE_UNAVAILABLE" }, 503);
  }
}

export async function GET(request: Request): Promise<Response> {
  return run(request);
}

export async function POST(request: Request): Promise<Response> {
  return run(request);
}
