import { z } from "zod";

import {
  paymentMethodSchema,
  paymentStatusSchema,
} from "@/lib/schemas/order";

/**
 * Rider contracts.
 *
 * The pool mirrors `get_rider_pool()` and deliberately contains no customer
 * phone, address, notes, or handover PIN. Only the rider's own active order
 * carries contact and destination details, and it never contains the PIN.
 */

const integer = z.coerce.number().int();

export const riderPoolItemSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: integer,
  area: z.string().nullable().optional(),
  distanceKm: z.coerce.number().nullable().optional(),
  totalAmount: integer,
  paymentMethod: paymentMethodSchema,
  itemCount: integer.nonnegative(),
  readyAt: z.string(),
});
export type RiderPoolItem = z.infer<typeof riderPoolItemSchema>;

export const riderActiveItemSchema = z.object({
  name: z.string(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: integer,
  lineTotal: integer,
  modifiers: z
    .array(
      z.object({
        name: z.string(),
        priceDelta: integer.default(0),
      }),
    )
    .default([]),
});
export type RiderActiveItem = z.infer<typeof riderActiveItemSchema>;

export const riderActiveOrderSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: integer,
  status: z.enum(["CLAIMED", "OUT_FOR_DELIVERY"]),
  paymentMethod: paymentMethodSchema,
  paymentStatus: paymentStatusSchema,
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryAddressText: z.string().nullable().optional(),
  deliveryArea: z.string().nullable().optional(),
  deliveryLatitude: z.coerce.number().nullable().optional(),
  deliveryLongitude: z.coerce.number().nullable().optional(),
  roadDistanceM: integer.nullable().optional(),
  estimatedTravelMinutes: integer.nullable().optional(),
  etaAt: z.string().nullable().optional(),
  totalAmount: integer,
  codChangeDue: integer.nullable().optional(),
  customerNotes: z.string().nullable().optional(),
  claimedAt: z.string().nullable().optional(),
  dispatchedAt: z.string().nullable().optional(),
  items: z.array(riderActiveItemSchema).default([]),
});
export type RiderActiveOrder = z.infer<typeof riderActiveOrderSchema>;

export const riderShiftSchema = z.object({
  isOpen: z.boolean(),
  shiftId: z.string().uuid().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  openingFloat: integer.nonnegative().default(0),
  expectedCash: integer.nullable().optional(),
});
export type RiderShift = z.infer<typeof riderShiftSchema>;

export const riderCashSummarySchema = z.object({
  riderId: z.string().uuid().optional(),
  outstandingCash: integer.default(0),
  unsettledOrderCash: integer.default(0),
  settlementShortfall: integer.default(0),
  totalSettled: integer.default(0),
});
export type RiderCashSummary = z.infer<typeof riderCashSummarySchema>;

export const riderSnapshotSchema = z.object({
  pool: z.array(riderPoolItemSchema),
  active: riderActiveOrderSchema.nullable(),
  shift: riderShiftSchema,
  cash: riderCashSummarySchema,
  fetchedAt: z.string(),
});
export type RiderSnapshot = z.infer<typeof riderSnapshotSchema>;

export type RiderPinResult =
  | {
      ok: true;
      code: "DELIVERED";
      changeDue?: number | null;
      deliveredAt: string;
    }
  | {
      ok: false;
      code:
        | "INVALID_HANDOVER_PIN"
        | "PIN_LOCKED"
        | "TOO_FAR_FROM_DESTINATION";
      remainingAttempts?: number;
      lockedUntil?: string | null;
      distanceM?: number;
      allowedM?: number;
    };

export const riderPinResultSchema: z.ZodType<RiderPinResult> = z.union([
  z.object({
    ok: z.literal(true),
    code: z.literal("DELIVERED"),
    changeDue: integer.nullable().optional(),
    deliveredAt: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum([
      "INVALID_HANDOVER_PIN",
      "PIN_LOCKED",
      "TOO_FAR_FROM_DESTINATION",
    ]),
    remainingAttempts: integer.optional(),
    lockedUntil: z.string().nullable().optional(),
    distanceM: z.coerce.number().optional(),
    allowedM: z.coerce.number().optional(),
  }),
]);

export const riderPoolArraySchema = z.array(riderPoolItemSchema);

/** Action-ready note shown when the handover lockout is active. */
export function pinLockMessage(lockedUntil: string | null | undefined): string {
  if (!lockedUntil) return "Handover locked. Ask the manager to reset the PIN.";
  const until = new Date(lockedUntil);
  if (Number.isNaN(until.getTime())) {
    return "Handover locked. Ask the manager to reset the PIN.";
  }
  return `Handover locked until ${until.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
  })}. Ask the manager to reset the PIN.`;
}

/** True while the rider should not offer offline completion. */
export function requiresConnectionForHandover(online: boolean): boolean {
  return !online;
}
