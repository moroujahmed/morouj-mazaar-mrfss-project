"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { getAuthorizedProfile } from "@/lib/auth/guards";
import { toRiderFailure, type RiderActionResult } from "@/lib/rider/errors";
import {
  claimOrderSchema,
  releaseOrderSchema,
  reportDeliveryFailedSchema,
  startDeliverySchema,
  startShiftSchema,
  telemetrySchema,
  verifyPinSchema,
} from "@/lib/rider/schemas";
import { getRiderStore } from "@/lib/rider/store";
import type {
  RiderActiveOrder,
  RiderCashSummary,
  RiderPinResult,
  RiderShift,
} from "@/lib/rider/types";
import { clientIpFromHeaders } from "@/lib/routing/rate-limit";

/**
 * Rider mutations. Every action is authorised before the store is touched, and
 * every store write is an audited database RPC (or the Playwright fixture
 * mirror). The rider identity always comes from the session, never the client.
 */

async function authorise() {
  const auth = await getAuthorizedProfile(["RIDER"]);
  return auth.ok ? auth : null;
}

function invalid<T>(
  parsed: { success: false; error: { issues: Array<{ message: string; path: (string | number)[] }> } },
): RiderActionResult<T> {
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: issue?.message ?? "Check the values and try again.",
      ...(issue?.path.length ? { field: issue.path.join(".") } : {}),
    },
  };
}

export async function claimOrderAction(
  payload: unknown,
): Promise<RiderActionResult<RiderActiveOrder>> {
  const parsed = claimOrderSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const auth = await authorise();
  if (!auth) return toRiderFailure({ code: "AUTH_UNAUTHORIZED" });

  try {
    return {
      ok: true,
      data: await getRiderStore(auth.profile.id).claimOrder(parsed.data.orderId),
    };
  } catch (error) {
    return toRiderFailure(error);
  }
}

export async function startDeliveryAction(
  payload: unknown,
): Promise<RiderActionResult<RiderActiveOrder>> {
  const parsed = startDeliverySchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const auth = await authorise();
  if (!auth) return toRiderFailure({ code: "AUTH_UNAUTHORIZED" });

  try {
    return {
      ok: true,
      data: await getRiderStore(auth.profile.id).startDelivery(
        parsed.data.orderId,
      ),
    };
  } catch (error) {
    return toRiderFailure(error);
  }
}

export async function releaseOrderAction(
  payload: unknown,
): Promise<RiderActionResult<{ orderId: string }>> {
  const parsed = releaseOrderSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const auth = await authorise();
  if (!auth) return toRiderFailure({ code: "AUTH_UNAUTHORIZED" });

  try {
    await getRiderStore(auth.profile.id).releaseOrder(
      parsed.data.orderId,
      parsed.data.reason,
    );
    return { ok: true, data: { orderId: parsed.data.orderId } };
  } catch (error) {
    return toRiderFailure(error);
  }
}

export async function verifyPinAction(
  payload: unknown,
): Promise<RiderActionResult<RiderPinResult>> {
  const parsed = verifyPinSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const auth = await authorise();
  if (!auth) return toRiderFailure({ code: "AUTH_UNAUTHORIZED" });

  try {
    const headerList = await headers();
    const ipHash = createHash("sha256")
      .update(clientIpFromHeaders(headerList))
      .digest("hex");

    const result = await getRiderStore(auth.profile.id).verifyPin({
      orderId: parsed.data.orderId,
      pin: parsed.data.pin,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      ipHash,
      userAgent: headerList.get("user-agent")?.slice(0, 300) ?? undefined,
    });

    return { ok: true, data: result };
  } catch (error) {
    return toRiderFailure(error);
  }
}

export async function reportDeliveryFailedAction(
  payload: unknown,
): Promise<RiderActionResult<{ orderId: string }>> {
  const parsed = reportDeliveryFailedSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const auth = await authorise();
  if (!auth) return toRiderFailure({ code: "AUTH_UNAUTHORIZED" });

  try {
    await getRiderStore(auth.profile.id).reportFailed(
      parsed.data.orderId,
      parsed.data.outcome,
      parsed.data.reason,
      {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      },
    );
    return { ok: true, data: { orderId: parsed.data.orderId } };
  } catch (error) {
    return toRiderFailure(error);
  }
}

export async function updateTelemetryAction(
  payload: unknown,
): Promise<RiderActionResult<{ orderId: string }>> {
  const parsed = telemetrySchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const auth = await authorise();
  if (!auth) return toRiderFailure({ code: "AUTH_UNAUTHORIZED" });

  try {
    await getRiderStore(auth.profile.id).updateTelemetry(parsed.data);
    return { ok: true, data: { orderId: parsed.data.orderId } };
  } catch (error) {
    return toRiderFailure(error);
  }
}

export async function startShiftAction(
  payload: unknown,
): Promise<RiderActionResult<RiderShift>> {
  const parsed = startShiftSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const auth = await authorise();
  if (!auth) return toRiderFailure({ code: "AUTH_UNAUTHORIZED" });

  try {
    return {
      ok: true,
      data: await getRiderStore(auth.profile.id).startShift(
        parsed.data.openingFloat,
      ),
    };
  } catch (error) {
    return toRiderFailure(error);
  }
}

export async function endShiftAction(): Promise<RiderActionResult<RiderShift>> {
  const auth = await authorise();
  if (!auth) return toRiderFailure({ code: "AUTH_UNAUTHORIZED" });

  try {
    return {
      ok: true,
      data: await getRiderStore(auth.profile.id).endShift(),
    };
  } catch (error) {
    return toRiderFailure(error);
  }
}

export async function getCashSummaryAction(): Promise<
  RiderActionResult<RiderCashSummary>
> {
  const auth = await authorise();
  if (!auth) return toRiderFailure({ code: "AUTH_UNAUTHORIZED" });

  try {
    return {
      ok: true,
      data: await getRiderStore(auth.profile.id).getCashSummary(),
    };
  } catch (error) {
    return toRiderFailure(error);
  }
}
