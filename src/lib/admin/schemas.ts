import { z } from "zod";

/** Every destructive admin mutation carries a typed, non-trivial reason. */
const reason = z
  .string()
  .trim()
  .min(3, "Give a reason with at least 3 characters.")
  .max(500, "Keep the reason under 500 characters.");

const optionalReason = reason.optional();
const uuid = z.string().uuid();
const integer = z.coerce.number().int();

export const orderIdSchema = z.object({ orderId: uuid });
export const orderActionSchema = z.object({ orderId: uuid, reason });

export const reassignOrderSchema = z.object({
  orderId: uuid,
  riderId: uuid,
  reason,
});

export const redeliverOrderSchema = z.object({
  orderId: uuid,
  riderId: uuid.nullable().optional(),
  reason,
});

export const updateOrderContactSchema = z.object({
  orderId: uuid,
  customerName: z.string().trim().min(1).max(120).optional(),
  customerPhone: z.string().trim().min(7).max(20).optional(),
  customerNotes: z.string().trim().max(500).nullable().optional(),
  deliveryAddressText: z.string().trim().max(240).nullable().optional(),
  deliveryArea: z.string().trim().max(120).nullable().optional(),
  deliveryLatitude: z.coerce.number().min(-90).max(90).optional(),
  deliveryLongitude: z.coerce.number().min(-180).max(180).optional(),
  roadDistanceM: integer.nonnegative().optional(),
  deliveryFee: integer.nonnegative().optional(),
  reason,
});
export type UpdateOrderContactInput = z.infer<typeof updateOrderContactSchema>;

export const approveRefundSchema = z.object({
  refundId: uuid,
  decision: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().trim().max(500).optional(),
});

export const reconcileCashSchema = z.object({
  riderId: uuid,
  countedCash: integer.nonnegative(),
  notes: reason,
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD business date.")
    .optional(),
});

/**
 * Settings are allow-listed here as well as in the SQL RPC so the client can
 * never smuggle an unknown key into `admin_update_settings`.
 */
export const settingsPatchSchema = z
  .object({
    restaurantName: z.string().trim().min(1).max(120).optional(),
    restaurantLat: z.coerce.number().min(-90).max(90).optional(),
    restaurantLng: z.coerce.number().min(-180).max(180).optional(),
    supportWhatsapp: z.string().trim().min(7).max(20).optional(),
    freeDeliveryRadiusKm: z.coerce.number().min(0).max(50).optional(),
    ratePerExcessKm: integer.min(0).max(100_000).optional(),
    maxDeliveryRadiusKm: z.coerce.number().min(1).max(100).optional(),
    codMaxRadiusKm: z.coerce.number().min(0).max(100).optional(),
    minimumOrderValue: integer.min(0).max(1_000_000).optional(),
    minimumOrderValueDineIn: integer.min(0).max(1_000_000).optional(),
    packagingFeeDefault: integer.min(0).max(100_000).optional(),
    packagingFeeDineIn: integer.min(0).max(100_000).optional(),
    maxCartValue: integer.min(1_000).max(10_000_000).optional(),
    maxItemQuantity: integer.min(1).max(100).optional(),
    maxCartLines: integer.min(1).max(100).optional(),
    isStoreOpen: z.boolean().optional(),
    openingTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
    closingTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
    isKitchenBusy: z.boolean().optional(),
    busyBufferMinutes: integer.min(0).max(60).optional(),
    isKitchenPaused: z.boolean().optional(),
    pinMaxAttempts: integer.min(1).max(10).optional(),
    pinLockMinutes: integer.min(1).max(1440).optional(),
    pinGeofenceM: integer.min(10).max(5000).optional(),
    staffSessionHours: integer.min(1).max(168).optional(),
    reason,
  })
  .refine((value) => Object.keys(value).some((key) => key !== "reason"), {
    message: "Change at least one setting.",
  });
export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;

export const upsertMenuItemSchema = z.object({
  itemId: uuid.optional(),
  categoryId: uuid,
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase slug with hyphens."),
  description: z.string().trim().max(500).nullable().optional(),
  basePrice: integer.nonnegative(),
  imagePath: z
    .string()
    .trim()
    .max(240)
    .regex(/^menu-images\/[A-Za-z0-9._/-]+$/, "Image must live in menu-images/.")
    .nullable()
    .optional(),
  prepTimeMinutes: integer.nonnegative().max(240),
  isAvailable: z.boolean().default(true),
  isCombo: z.boolean().default(false),
  sortOrder: integer.min(0).max(999),
  reason,
});
export type UpsertMenuItemInput = z.infer<typeof upsertMenuItemSchema>;

export const archiveMenuItemSchema = z.object({ itemId: uuid, reason });

export const upsertCategorySchema = z.object({
  categoryId: uuid.optional(),
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase slug with hyphens."),
  displayOrder: integer.min(0).max(999),
  reason,
});

export const upsertTableSchema = z.object({
  tableId: uuid.optional(),
  tableNumber: z.string().trim().min(1).max(20),
  label: z.string().trim().min(1).max(120),
  isActive: z.boolean().default(true),
  reason,
});

export const updateStaffSchema = z.object({
  profileId: uuid,
  role: z.enum(["ADMIN", "KITCHEN", "RIDER"]),
  isActive: z.boolean(),
  motorcyclePlate: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .nullable()
    .optional(),
  reason,
});

export const listOrdersSchema = z.object({
  status: z.string().max(40).optional(),
  search: z.string().max(120).optional(),
  limit: integer.min(1).max(200).default(50).optional(),
  offset: integer.nonnegative().default(0).optional(),
});

export const auditFeedSchemaInput = z.object({
  limit: integer.min(1).max(200).default(50).optional(),
  offset: integer.nonnegative().default(0).optional(),
  entityType: z.string().max(40).optional(),
});

export { reason as adminReason, optionalReason };
