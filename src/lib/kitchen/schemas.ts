import { z } from "zod";

export const acceptOrderSchema = z.object({
  orderId: z.string().uuid("That order identifier is not valid."),
});

export const bumpOrderSchema = acceptOrderSchema;

export const setItemAvailabilitySchema = z.object({
  itemId: z.string().uuid("That menu item identifier is not valid."),
  available: z.boolean(),
});

export const setBusyModeSchema = z.object({
  busy: z.boolean(),
  bufferMinutes: z.coerce
    .number()
    .int()
    .min(0, "The buffer must be between 0 and 60 minutes.")
    .max(60, "The buffer must be between 0 and 60 minutes."),
});

export const setKitchenPausedSchema = z.object({
  paused: z.boolean(),
});
