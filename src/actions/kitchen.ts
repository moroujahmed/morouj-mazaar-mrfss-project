"use server";

import { getAuthorizedProfile } from "@/lib/auth/guards";
import {
  kitchenFailure,
  toKitchenFailure,
  type KitchenActionResult,
} from "@/lib/kitchen/errors";
import {
  acceptOrderSchema,
  bumpOrderSchema,
  setBusyModeSchema,
  setItemAvailabilitySchema,
  setKitchenPausedSchema,
} from "@/lib/kitchen/schemas";
import { getKitchenStore } from "@/lib/kitchen/store";

/**
 * Kitchen mutations. Every action is authorised before the store is touched,
 * and every store write is an audited database RPC (or the Playwright fixture
 * mirror). `accept` applies only to `CONFIRMED_UNPAID`; paid orders arrive
 * already `PREPARING` from the verified webhook.
 */

async function authorise(): Promise<boolean> {
  const auth = await getAuthorizedProfile(["KITCHEN", "ADMIN"]);
  return auth.ok;
}

export async function acceptOrderAction(
  payload: unknown,
): Promise<KitchenActionResult<{ orderId: string; status: "PREPARING" }>> {
  const parsed = acceptOrderSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return kitchenFailure(
      "VALIDATION_ERROR",
      issue?.message,
      issue?.path.join("."),
    );
  }
  if (!(await authorise())) return kitchenFailure("AUTH_UNAUTHORIZED");

  try {
    const data = await getKitchenStore().acceptOrder(parsed.data.orderId);
    return { ok: true, data };
  } catch (error) {
    return toKitchenFailure(error);
  }
}

export async function bumpOrderAction(
  payload: unknown,
): Promise<
  KitchenActionResult<{
    orderId: string;
    status: "READY_FOR_PICKUP" | "DELIVERED";
  }>
> {
  const parsed = bumpOrderSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return kitchenFailure(
      "VALIDATION_ERROR",
      issue?.message,
      issue?.path.join("."),
    );
  }
  if (!(await authorise())) return kitchenFailure("AUTH_UNAUTHORIZED");

  try {
    const data = await getKitchenStore().bumpOrder(parsed.data.orderId);
    return { ok: true, data };
  } catch (error) {
    return toKitchenFailure(error);
  }
}

export async function setItemAvailabilityAction(
  payload: unknown,
): Promise<KitchenActionResult<{ itemId: string; available: boolean }>> {
  const parsed = setItemAvailabilitySchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return kitchenFailure(
      "VALIDATION_ERROR",
      issue?.message,
      issue?.path.join("."),
    );
  }
  if (!(await authorise())) return kitchenFailure("AUTH_UNAUTHORIZED");

  try {
    await getKitchenStore().setItemAvailability(
      parsed.data.itemId,
      parsed.data.available,
    );
    return { ok: true, data: parsed.data };
  } catch (error) {
    return toKitchenFailure(error);
  }
}

export async function setBusyModeAction(
  payload: unknown,
): Promise<KitchenActionResult<{ busy: boolean; bufferMinutes: number }>> {
  const parsed = setBusyModeSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return kitchenFailure(
      "VALIDATION_ERROR",
      issue?.message,
      issue?.path.join("."),
    );
  }
  if (!(await authorise())) return kitchenFailure("AUTH_UNAUTHORIZED");

  try {
    await getKitchenStore().setBusy(
      parsed.data.busy,
      parsed.data.bufferMinutes,
    );
    return { ok: true, data: parsed.data };
  } catch (error) {
    return toKitchenFailure(error);
  }
}

export async function setKitchenPausedAction(
  payload: unknown,
): Promise<KitchenActionResult<{ paused: boolean }>> {
  const parsed = setKitchenPausedSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return kitchenFailure(
      "VALIDATION_ERROR",
      issue?.message,
      issue?.path.join("."),
    );
  }
  if (!(await authorise())) return kitchenFailure("AUTH_UNAUTHORIZED");

  try {
    await getKitchenStore().setPaused(parsed.data.paused);
    return { ok: true, data: parsed.data };
  } catch (error) {
    return toKitchenFailure(error);
  }
}
