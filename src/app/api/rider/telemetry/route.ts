import { NextResponse } from "next/server";

import { getAuthorizedProfile } from "@/lib/auth/guards";
import { telemetrySchema } from "@/lib/rider/schemas";
import { getRiderStore } from "@/lib/rider/store";
import { getRateLimiter } from "@/lib/routing/rate-limit";

/**
 * Foreground telemetry writes. The RPC re-checks that the order belongs to the
 * rider and is `OUT_FOR_DELIVERY`, so a replayed or stale point is rejected
 * rather than widening the tracker's visibility.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getAuthorizedProfile(["RIDER"]);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: { code: auth.code, message: "Sign in again." } },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const limit = await getRateLimiter().consumeWithLimit(
    `rider-telemetry:${auth.profile.id}`,
    120,
    60,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "RATE_LIMITED", message: "Too many position updates." },
      },
      {
        status: 429,
        headers: {
          "cache-control": "no-store",
          "retry-after": String(
            Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1_000)),
          ),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid position update." },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const parsed = telemetrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid position update.",
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    await getRiderStore(auth.profile.id).updateTelemetry(parsed.data);
    return NextResponse.json(
      { ok: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

    if (code === "ORDER_STATE_INVALID" || message.includes("ORDER_STATE_INVALID")) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "ORDER_STATE_INVALID",
            message: "This delivery is no longer in progress.",
          },
        },
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "The position could not be saved.",
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
