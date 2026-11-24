import { checkCronAuth } from "@/lib/cron/auth";
import { dispatchPendingNotifications } from "@/lib/notifications/dispatch";
import { sendSms, smsConfigured, smsFixtureMode } from "@/lib/notifications/sms";
import { getNotificationStore } from "@/lib/notifications/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SMS outbox worker (every minute). Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; a missing secret fails closed. The
 * provider must be configured, otherwise the run fails closed rather than
 * silently dropping customer notifications.
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
    if (!smsFixtureMode() && !smsConfigured()) {
      return json({ ok: false, error: "CONFIGURATION" }, 503);
    }

    const summary = await dispatchPendingNotifications({
      store: getNotificationStore(),
      send: sendSms,
    });
    return json({ ok: true, ...summary }, 200);
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
