import { z } from "zod";

/**
 * Shape returned by `get_public_settings()` (JSONB). Parse rather than cast so
 * a malformed or missing settings row cannot silently produce wrong fees.
 */
export const storeSettingsSchema = z.object({
  restaurantName: z.string().min(1),
  restaurantLat: z.number(),
  restaurantLng: z.number(),
  supportWhatsapp: z.string().min(1),
  currency: z.string().min(1),
  timezone: z.string().min(1),
  freeDeliveryRadiusKm: z.number().nonnegative(),
  ratePerExcessKm: z.number().int().nonnegative(),
  maxDeliveryRadiusKm: z.number().positive(),
  codMaxRadiusKm: z.number().nonnegative(),
  minimumOrderValue: z.number().int().nonnegative(),
  minimumOrderValueDineIn: z.number().int().nonnegative(),
  packagingFeeDefault: z.number().int().nonnegative(),
  packagingFeeDineIn: z.number().int().nonnegative(),
  maxCartValue: z.number().int().positive(),
  maxItemQuantity: z.number().int().positive(),
  maxCartLines: z.number().int().positive(),
  isStoreOpen: z.boolean(),
  openingTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  closingTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  isKitchenBusy: z.boolean(),
  busyBufferMinutes: z.number().int().nonnegative(),
  isKitchenPaused: z.boolean(),
});

export type ParsedStoreSettings = z.infer<typeof storeSettingsSchema>;
