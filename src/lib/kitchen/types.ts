import { z } from "zod";

import {
  paymentMethodSchema,
  paymentStatusSchema,
} from "@/lib/schemas/order";

/**
 * Kitchen board contracts. The shape mirrors `get_kitchen_orders()`, which is
 * the only read path in production, and deliberately omits phone numbers,
 * handover PINs, and payment references.
 */

export const kitchenTicketItemSchema = z.object({
  name: z.string(),
  quantity: z.coerce.number().int().positive(),
  modifiers: z
    .array(
      z.object({
        name: z.string(),
        priceDelta: z.coerce.number().int().default(0),
      }),
    )
    .default([]),
});
export type KitchenTicketItem = z.infer<typeof kitchenTicketItemSchema>;

export const kitchenTicketSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.coerce.number().int(),
  status: z.enum(["CONFIRMED_UNPAID", "PREPARING", "READY_FOR_PICKUP"]),
  orderType: z.enum(["DELIVERY", "DINE_IN"]),
  tableNumber: z.string().nullable(),
  customerName: z.string(),
  customerNotes: z.string().nullable(),
  paymentMethod: paymentMethodSchema,
  paymentStatus: paymentStatusSchema,
  totalAmount: z.coerce.number().int(),
  codChangeRequestedFor: z.coerce.number().int().nullable().optional(),
  codChangeDue: z.coerce.number().int().nullable().optional(),
  createdAt: z.string(),
  acknowledgedAt: z.string().nullable().optional(),
  readyAt: z.string().nullable().optional(),
  kitchenBusyBufferApplied: z.coerce.number().int().nullable().optional(),
  items: z.array(kitchenTicketItemSchema).default([]),
});
export type KitchenTicket = z.infer<typeof kitchenTicketSchema>;

export const kitchenSettingsSchema = z.object({
  isKitchenBusy: z.boolean(),
  busyBufferMinutes: z.number().int().min(0).max(60),
  isKitchenPaused: z.boolean(),
});
export type KitchenSettings = z.infer<typeof kitchenSettingsSchema>;

export const kitchenMenuItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  categoryName: z.string(),
  isAvailable: z.boolean(),
});
export type KitchenMenuItem = z.infer<typeof kitchenMenuItemSchema>;

export const kitchenBoardSchema = z.object({
  tickets: z.array(kitchenTicketSchema),
  settings: kitchenSettingsSchema,
  items: z.array(kitchenMenuItemSchema),
  fetchedAt: z.string(),
});
export type KitchenBoard = z.infer<typeof kitchenBoardSchema>;

export const kitchenTicketArraySchema = z.array(kitchenTicketSchema);
