"use server";

import { getAuthorizedProfile } from "@/lib/auth/guards";
import {
  toAdminFailure,
  type AdminActionResult,
} from "@/lib/admin/errors";
import {
  approveRefundSchema,
  archiveMenuItemSchema,
  listOrdersSchema,
  orderActionSchema,
  reconcileCashSchema,
  reassignOrderSchema,
  redeliverOrderSchema,
  settingsPatchSchema,
  updateOrderContactSchema,
  updateStaffSchema,
  upsertCategorySchema,
  upsertMenuItemSchema,
  upsertTableSchema,
} from "@/lib/admin/schemas";
import { getAdminStore } from "@/lib/admin/store";
import type {
  AdminOrderDetail,
  AdminOrderList,
  AdminSettings,
  AdminSnapshot,
  AuditFeed,
  DiningTable,
  StaffMember,
} from "@/lib/admin/types";

/**
 * Admin mutations. Every action is authorised as ADMIN before the store is
 * touched, and every store write is an audited database RPC (or the fixture
 * mirror). Destructive actions carry a typed reason validated by Zod.
 */

async function authorise() {
  const auth = await getAuthorizedProfile(["ADMIN"]);
  return auth.ok ? auth : null;
}

function invalid<T>(
  parsed: {
    success: false;
    error: { issues: Array<{ message: string; path: PropertyKey[] }> };
  },
): AdminActionResult<T> {
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: issue?.message ?? "Check the values and try again.",
      ...(issue?.path.length
        ? { field: issue.path.map(String).join(".") }
        : {}),
    },
  };
}

async function run<T>(work: () => Promise<T>): Promise<AdminActionResult<T>> {
  const auth = await authorise();
  if (!auth) return toAdminFailure({ code: "AUTH_UNAUTHORIZED" });
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return toAdminFailure(error);
  }
}

export async function getAdminSnapshotAction(): Promise<AdminActionResult<AdminSnapshot>> {
  return run(() => getAdminStore().snapshot());
}

export async function listAdminOrdersAction(
  payload: unknown,
): Promise<AdminActionResult<AdminOrderList>> {
  const parsed = listOrdersSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() => getAdminStore().listOrders(parsed.data));
}

export async function getAdminOrderAction(
  payload: unknown,
): Promise<AdminActionResult<AdminOrderDetail>> {
  const parsed = orderActionSchema
    .pick({ orderId: true })
    .safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() => getAdminStore().getOrder(parsed.data.orderId));
}

export async function updateOrderContactAction(
  payload: unknown,
): Promise<AdminActionResult<AdminOrderDetail>> {
  const parsed = updateOrderContactSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() => getAdminStore().updateContact(parsed.data));
}

export async function cancelOrderAction(
  payload: unknown,
): Promise<AdminActionResult<{ orderId: string }>> {
  const parsed = orderActionSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() => getAdminStore().cancelOrder(parsed.data.orderId, parsed.data.reason));
}

export async function completeOrderAction(
  payload: unknown,
): Promise<AdminActionResult<{ orderId: string }>> {
  const parsed = orderActionSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() => getAdminStore().completeOrder(parsed.data.orderId, parsed.data.reason));
}

export async function reassignOrderAction(
  payload: unknown,
): Promise<AdminActionResult<{ orderId: string; riderId: string }>> {
  const parsed = reassignOrderSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() =>
    getAdminStore().reassignOrder(parsed.data.orderId, parsed.data.riderId, parsed.data.reason),
  );
}

export async function redeliverOrderAction(
  payload: unknown,
): Promise<AdminActionResult<{ orderId: string; status: string; riderId: string | null }>> {
  const parsed = redeliverOrderSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() =>
    getAdminStore().redeliverOrder(parsed.data.orderId, parsed.data.reason, parsed.data.riderId),
  );
}

export async function resetHandoverPinAction(
  payload: unknown,
): Promise<AdminActionResult<{ orderId: string }>> {
  const parsed = orderActionSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() => getAdminStore().resetPin(parsed.data.orderId, parsed.data.reason));
}

export async function approveRefundAction(
  payload: unknown,
): Promise<AdminActionResult<{ refundId: string; status: string }>> {
  const parsed = approveRefundSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() =>
    getAdminStore().approveRefund(parsed.data.refundId, parsed.data.decision, parsed.data.notes),
  );
}

export async function reconcileCashAction(
  payload: unknown,
): Promise<AdminActionResult<Record<string, unknown>>> {
  const parsed = reconcileCashSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() =>
    getAdminStore().reconcileCash(
      parsed.data.riderId,
      parsed.data.countedCash,
      parsed.data.notes,
      parsed.data.businessDate,
    ),
  );
}

export async function updateSettingsAction(
  payload: unknown,
): Promise<AdminActionResult<AdminSettings>> {
  const parsed = settingsPatchSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const { reason, ...patch } = parsed.data;
  return run(() => getAdminStore().updateSettings(patch, reason));
}

export async function upsertCategoryAction(
  payload: unknown,
): Promise<AdminActionResult<unknown>> {
  const parsed = upsertCategorySchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const { reason, ...input } = parsed.data;
  return run(() => getAdminStore().upsertCategory(input, reason));
}

export async function upsertMenuItemAction(
  payload: unknown,
): Promise<AdminActionResult<unknown>> {
  const parsed = upsertMenuItemSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const { reason, ...input } = parsed.data;
  return run(() => getAdminStore().upsertMenuItem(input, reason));
}

export async function archiveMenuItemAction(
  payload: unknown,
): Promise<AdminActionResult<unknown>> {
  const parsed = archiveMenuItemSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() => getAdminStore().archiveMenuItem(parsed.data.itemId, parsed.data.reason));
}

export async function upsertTableAction(
  payload: unknown,
): Promise<AdminActionResult<DiningTable>> {
  const parsed = upsertTableSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const { reason, ...input } = parsed.data;
  return run(() => getAdminStore().upsertTable(input, reason));
}

export async function updateStaffAction(
  payload: unknown,
): Promise<AdminActionResult<StaffMember>> {
  const parsed = updateStaffSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  const { reason, ...input } = parsed.data;
  return run(() => getAdminStore().updateStaff(input, reason));
}

export async function getAdminAuditFeedAction(
  payload: unknown,
): Promise<AdminActionResult<AuditFeed>> {
  const parsed = listOrdersSchema.pick({ limit: true, offset: true }).safeParse(payload);
  if (!parsed.success) return invalid(parsed);
  return run(() => getAdminStore().auditFeed(parsed.data));
}
