import { z } from "zod";

import { OrderFailure } from "./errors";
import {
  orderStatusSchema,
  paymentMethodSchema,
  paymentStatusSchema,
} from "@/lib/schemas/order";

/**
 * Store boundary for the order pipeline. The Supabase implementation calls the
 * security-definer RPCs; the fixture implementation keeps the same contract in
 * memory for Playwright and unit tests.
 */

export type CreateOrderRpcInput = {
  idempotencyKey: string;
  requestHash: string;
  customerName: string;
  customerPhone: string;
  customerNotes: string | null;
  orderType: "DELIVERY" | "DINE_IN";
  tableId: string | null;
  deliveryAddressText: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  roadDistanceM: number | null;
  estimatedTravelMinutes: number | null;
  etaAt: string | null;
  paymentMethod: z.infer<typeof paymentMethodSchema>;
  codChangeRequestedFor: number | null;
  items: Array<{
    menuItemId: string;
    quantity: number;
    modifiers: Array<{ modifierId: string } | { comboOptionId: string }>;
  }>;
};

const integer = z.coerce.number().int();

export const createdOrderSchema = z.object({
  orderId: z.string().uuid(),
  orderToken: z.string().uuid(),
  orderNumber: integer,
  totalAmount: integer,
  itemsSubtotal: integer,
  modifiersTotal: integer,
  deliveryFee: integer,
  packagingFee: integer,
  orderStatus: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  paymentMethod: paymentMethodSchema,
  idempotent: z.boolean(),
});

export type CreatedOrder = z.infer<typeof createdOrderSchema>;

export const paymentAttemptSchema = z.object({
  transactionId: z.string().uuid(),
  txRef: z.string().min(3),
  attemptNumber: integer,
  amount: integer,
  currency: z.string().length(3),
});

export type PaymentAttempt = z.infer<typeof paymentAttemptSchema>;

export const resolvedPaymentSchema = z.object({
  transactionId: z.string().uuid(),
  orderId: z.string().uuid(),
  orderToken: z.string().uuid(),
  orderNumber: integer,
  attemptNumber: integer,
  txRef: z.string(),
  amount: integer,
  currency: z.string().length(3),
  transactionStatus: z.enum([
    "INITIATED",
    "PENDING",
    "SUCCESSFUL",
    "FAILED",
    "ABANDONED",
  ]),
  paymentMethod: paymentMethodSchema,
  paymentStatus: paymentStatusSchema,
  orderStatus: orderStatusSchema,
});

export type ResolvedPayment = z.infer<typeof resolvedPaymentSchema>;

export const finalizedPaymentSchema = z.object({
  applied: z.boolean(),
  reason: z.string().nullable().optional(),
  orderToken: z.string().uuid().optional(),
  orderNumber: integer.optional(),
  orderStatus: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
});

export type FinalizedPayment = z.infer<typeof finalizedPaymentSchema>;

export const codOtpResultSchema = z.object({
  valid: z.boolean(),
  reason: z
    .enum([
      "OTP_INVALID",
      "OTP_REQUIRED",
      "OTP_EXPIRED",
      "OTP_LOCKED",
    ])
    .nullable()
    .optional(),
  remainingAttempts: integer.default(0),
});

export type CodOtpResult = z.infer<typeof codOtpResultSchema>;

export type PaymentContext = {
  orderToken: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  orderStatus: z.infer<typeof orderStatusSchema>;
  paymentStatus: z.infer<typeof paymentStatusSchema>;
  paymentMethod: z.infer<typeof paymentMethodSchema>;
  totalAmount: number;
};

export type FinalizePaymentInput = {
  txRef: string;
  success: boolean;
  providerTransactionId?: string;
  rawPayload?: Record<string, unknown>;
  error?: string;
};

export type WebhookEventInput = {
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export type WebhookEventRecord = {
  duplicate: boolean;
  /** True only when the stored event already has `processed_at`. */
  processed: boolean;
  eventId: string | null;
};

export type ExpireResult = {
  expired: number;
};

export type StoreCodOtpInput = {
  phone: string;
  code: string;
  expiresAt: string;
  ipHash?: string;
  maxAttempts?: number;
};

export interface OrderStore {
  createOrder(input: CreateOrderRpcInput): Promise<CreatedOrder>;
  getOrderByToken(token: string): Promise<unknown | null>;
  getPaymentContext(token: string): Promise<PaymentContext | null>;
  startPaymentAttempt(input: {
    orderToken: string;
    method: z.infer<typeof paymentMethodSchema>;
    provider: string;
  }): Promise<PaymentAttempt>;
  resolvePaymentTxRef(txRef: string): Promise<ResolvedPayment | null>;
  finalizePaymentAttempt(
    input: FinalizePaymentInput,
  ): Promise<FinalizedPayment>;
  recordWebhookEvent(input: WebhookEventInput): Promise<WebhookEventRecord>;
  completeWebhookEvent(input: {
    providerEventId: string;
    error?: string;
  }): Promise<void>;
  expirePendingOrders(): Promise<number>;
  storeCodOtp(input: StoreCodOtpInput): Promise<void>;
  verifyCodOtp(input: {
    phone: string;
    code: string;
  }): Promise<CodOtpResult>;
  isReturningCustomer(phone: string): Promise<boolean>;
  isPhoneBlacklisted(phone: string): Promise<boolean>;
  attachPaymentProviderReference(input: {
    transactionId: string;
    providerReference: string;
    rawPayload: Record<string, unknown>;
  }): Promise<void>;
}

export function parseStoreResult<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
  label: string,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new OrderFailure(
      "INTERNAL_ERROR",
      `The order service returned an invalid ${label} response.`,
    );
  }
  return parsed.data as z.output<S>;
}
