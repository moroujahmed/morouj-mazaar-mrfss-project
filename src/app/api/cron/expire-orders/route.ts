import { checkCronAuth } from "@/lib/cron/auth";
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

async function run(request: Request): Promise<Response> {
  const auth = checkCronAuth(request);
  if (auth === "CONFIGURATION") {
    return json({ ok: false, error: "CONFIGURATION" }, 503);
  }
  if (auth === "UNAUTHORIZED") {
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
