import { z } from "zod";

import { normalizeUgPhone } from "@/lib/phone";
import { destinationSchema } from "@/lib/routing/coordinates";

/**
 * Order contracts shared by the checkout action, payment actions, and the
 * Flutterwave webhook. Client-supplied prices are not part of any schema: the
 * server recomputes every amount from the catalogue.
 */

export const PAYMENT_METHODS = [
  "MTN_MOMO",
  "AIRTEL_MONEY",
  "BANK_CARD",
  "CASH_ON_DELIVERY",
] as const;

export const DIGITAL_PAYMENT_METHODS = [
  "MTN_MOMO",
  "AIRTEL_MONEY",
  "BANK_CARD",
] as const;

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const digitalPaymentMethodSchema = z.enum(DIGITAL_PAYMENT_METHODS);

export const orderTypeSchema = z.enum(["DELIVERY", "DINE_IN"]);

export const orderStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "CONFIRMED_UNPAID",
  "PREPARING",
  "READY_FOR_PICKUP",
  "CLAIMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "CANCELLED",
]);

export const paymentStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
]);

const phoneSchema = z
  .string()
  .min(9)
  .max(20)
  .refine((value) => normalizeUgPhone(value) !== null, {
    message: "Enter a Ugandan mobile number.",
  });

export const orderItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  modifierIds: z.array(z.string().uuid()).max(30).default([]),
  /**
   * Combo builder selections. Each pair must resolve inside the same combo
   * item; the server reads the option price from `combo_step_options`.
   */
  comboSelections: z
    .array(
      z.object({
        stepId: z.string().uuid(),
        optionId: z.string().uuid(),
      }),
    )
    .max(20)
    .default([]),
});

const createOrderBaseSchema = z.object({
  idempotencyKey: z.string().uuid(),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: phoneSchema,
  customerNotes: z.string().trim().max(500).optional(),
  items: z.array(orderItemInputSchema).min(1).max(30),
  paymentMethod: paymentMethodSchema,
  codChangeRequestedFor: z.number().int().min(0).max(1_000_000).optional(),
  otpCode: z
    .string()
    .regex(/^[0-9]{6}$/, "Enter the 6-digit code.")
    .optional(),
});

export const createOrderSchema = z.discriminatedUnion("orderType", [
  createOrderBaseSchema.extend({
    orderType: z.literal("DELIVERY"),
    deliveryCoordinates: destinationSchema,
    deliveryAddressText: z.string().trim().min(3).max(300),
  }),
  createOrderBaseSchema.extend({
    orderType: z.literal("DINE_IN"),
    tableToken: z.string().uuid(),
  }),
]);

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const initiatePaymentSchema = z.object({
  orderToken: z.string().uuid(),
  method: digitalPaymentMethodSchema,
});

export const sendCodOtpSchema = z.object({
  phone: phoneSchema,
});

export const mockPaymentSchema = z.object({
  txRef: z.string().min(3).max(120),
  outcome: z.enum(["success", "failure"]),
});

export const flutterwaveWebhookSchema = z
  .object({
    event: z.string().min(1).max(120),
    data: z
      .object({
        id: z.union([z.string(), z.number()]).transform(String),
        tx_ref: z.string().min(1).max(200),
        flw_ref: z.string().max(200).optional(),
        amount: z.number().finite().nonnegative(),
        currency: z.string().length(3),
        status: z.string().min(1).max(40),
      })
      .passthrough(),
  })
  .passthrough();

export type FlutterwaveWebhookPayload = z.infer<
  typeof flutterwaveWebhookSchema
>;

/** `get_order_by_token` confirmation subset used by Phase 6. */
export const orderConfirmationSchema = z
  .object({
    orderToken: z.string().uuid(),
    orderNumber: z.union([z.string(), z.number()]).transform(Number),
    orderType: orderTypeSchema,
    source: z.string().optional(),
    status: orderStatusSchema,
    paymentStatus: paymentStatusSchema,
    paymentMethod: paymentMethodSchema,
    customerName: z.string(),
    tableNumber: z.string().nullable().optional(),
    deliveryArea: z.string().nullable().optional(),
    itemsSubtotal: z.coerce.number().int(),
    modifiersTotal: z.coerce.number().int(),
    deliveryFee: z.coerce.number().int(),
    packagingFee: z.coerce.number().int(),
    totalAmount: z.coerce.number().int(),
    codChangeRequestedFor: z.coerce.number().int().nullable().optional(),
    codChangeDue: z.coerce.number().int().nullable().optional(),
    etaAt: z.string().nullable().optional(),
    acknowledgedAt: z.string().nullable().optional(),
    roadDistanceM: z.coerce.number().int().nullable().optional(),
    estimatedTravelMinutes: z.coerce.number().int().nullable().optional(),
    createdAt: z.string().optional(),
    items: z
      .array(
        z.object({
          name: z.string(),
          quantity: z.coerce.number().int(),
          unitPrice: z.coerce.number().int(),
          lineTotal: z.coerce.number().int(),
          modifiers: z
            .array(
              z.object({
                name: z.string(),
                priceDelta: z.coerce.number().int(),
              }),
            )
            .default([]),
        }),
      )
      .default([]),
  })
  .passthrough();

export type OrderConfirmation = z.infer<typeof orderConfirmationSchema>;
