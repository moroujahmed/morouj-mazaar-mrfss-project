import { NextResponse } from "next/server";
import { z } from "zod";

import {
  setFixtureOrderStatusForTests,
  setFixtureTelemetryForTests,
} from "@/lib/orders/fixture-store";
import { orderStatusSchema } from "@/lib/schemas/order";

/**
 * Test harness for the Playwright fixture pipeline.
 *
 * Phase 8 (kitchen) and Phase 9 (rider) own the real transitions. Until those
 * portals exist, the browser suite needs a deterministic way to move a
 * fixture-only order to READY/OUT_FOR_DELIVERY/DELIVERED. This route is
 * unavailable unless `ORDERS_FIXTURE=1`, which deployment config never sets.
 */

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z
  .object({
    status: orderStatusSchema.optional(),
    reason: z.string().trim().max(200).optional(),
    telemetry: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        updatedAt: z.string().datetime().optional(),
      })
      .nullable()
      .optional(),
  })
  .refine((value) => value.status !== undefined || value.telemetry !== undefined, {
    message: "Provide a status or telemetry update.",
  });

function notFound() {
  return NextResponse.json({ ok: false }, { status: 404 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (process.env.ORDERS_FIXTURE !== "1") return notFound();

  const { token } = await params;
  if (!UUID_PATTERN.test(token)) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  if (parsed.data.status) {
    const updated = setFixtureOrderStatusForTests(token, parsed.data.status, {
      reason: parsed.data.reason,
      telemetry: parsed.data.telemetry,
    });
    if (!updated) return notFound();
  } else if (parsed.data.telemetry) {
    const updated = setFixtureTelemetryForTests(token, parsed.data.telemetry);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "ORDER_STATE_INVALID" },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
