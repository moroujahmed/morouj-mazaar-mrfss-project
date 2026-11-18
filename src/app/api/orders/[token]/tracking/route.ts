import { NextResponse } from "next/server";

import { getOrderStore } from "@/lib/orders/store";
import {
  isTerminalStatus,
  toTrackerSnapshot,
} from "@/lib/orders/tracker";
import { orderConfirmationSchema } from "@/lib/schemas/order";
import { clientIp, getRateLimiter } from "@/lib/routing/rate-limit";

/**
 * Token-scoped tracker polling.
 *
 * `get_order_by_token` is the only read, and the response is a narrowed
 * snapshot: no handover PIN, customer phone, notes, or payment references.
 * Polling is paused by the client while the tab is hidden.
 */

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TRACKER_LIMIT = { max: 120, windowSeconds: 60 };

function jsonError(
  code: string,
  message: string,
  status: number,
  retryAfter?: number,
) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
        ...(retryAfter ? { "retry-after": String(retryAfter) } : {}),
      },
    },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!UUID_PATTERN.test(token)) {
    return jsonError("ORDER_NOT_FOUND", "Order not found.", 404);
  }

  try {
    const limit = await getRateLimiter().consumeWithLimit(
      `mrfss:rl:tracker:ip:${clientIp(request)}`,
      TRACKER_LIMIT.max,
      TRACKER_LIMIT.windowSeconds,
    );
    if (!limit.allowed) {
      return jsonError(
        "RATE_LIMITED",
        "Too many status checks. Wait a moment.",
        429,
        Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1_000)),
      );
    }
  } catch {
    return jsonError(
      "INTERNAL_ERROR",
      "Status updates are unavailable right now.",
      503,
    );
  }

  let raw: unknown = null;
  try {
    raw = await getOrderStore().getOrderByToken(token);
  } catch {
    return jsonError(
      "INTERNAL_ERROR",
      "Status updates are unavailable right now.",
      503,
    );
  }

  if (!raw) return jsonError("ORDER_NOT_FOUND", "Order not found.", 404);

  const parsed = orderConfirmationSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("ORDER_NOT_FOUND", "Order not found.", 404);
  }

  const snapshot = toTrackerSnapshot(parsed.data);

  return NextResponse.json(
    { ok: true, data: snapshot },
    {
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
        ...(isTerminalStatus(snapshot.status)
          ? { "x-order-terminal": "1" }
          : {}),
      },
    },
  );
}
