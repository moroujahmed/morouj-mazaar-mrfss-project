import { checkCronAuth } from "@/lib/cron/auth";
import { closeOpenRiderShifts } from "@/lib/rider/close-shifts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * End-of-day cron (22:30 EAT). Closes every open rider shift and snapshots the
 * expected cash so the admin can settle. Vercel Cron sends
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
    const closed = await closeOpenRiderShifts();
    return json({ ok: true, closed }, 200);
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
