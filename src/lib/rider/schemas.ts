import { z } from "zod";

/**
 * Rider action payloads. Every mutation is authorised server-side and the
 * identifiers are validated before an RPC is attempted.
 */

export const claimOrderSchema = z.object({
  orderId: z.string().uuid("That delivery identifier is not valid."),
});

export const startDeliverySchema = claimOrderSchema;

export const releaseOrderSchema = z.object({
  orderId: z.string().uuid("That delivery identifier is not valid."),
  reason: z
    .string()
    .trim()
    .min(5, "Give a short reason so the kitchen knows why it was released.")
    .max(200, "Keep the reason under 200 characters."),
});

export const startShiftSchema = z.object({
  openingFloat: z.coerce
    .number()
    .int("The opening float must be a whole shilling amount.")
    .min(0, "The opening float cannot be negative.")
    .max(5_000_000, "The opening float looks too high. Check the amount."),
});

export const verifyPinSchema = z.object({
  orderId: z.string().uuid("That delivery identifier is not valid."),
  pin: z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/, "Enter the customer's 4-digit handover PIN."),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const reportDeliveryFailedSchema = z.object({
  orderId: z.string().uuid("That delivery identifier is not valid."),
  outcome: z.enum([
    "CUSTOMER_UNREACHABLE",
    "WRONG_ADDRESS",
    "REFUSED",
    "OTHER",
  ]),
  reason: z
    .string()
    .trim()
    .min(5, "Give a short reason for the failed delivery.")
    .max(200, "Keep the reason under 200 characters."),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const telemetrySchema = z.object({
  orderId: z.string().uuid("That delivery identifier is not valid."),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(10_000).optional(),
  heading: z.coerce.number().min(0).max(360).optional(),
  speed: z.coerce.number().min(0).max(100).optional(),
});

export type TelemetryPayload = z.infer<typeof telemetrySchema>;
