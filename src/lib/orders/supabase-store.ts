import "server-only";

import { normalizeUgPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";

import { OrderFailure } from "./errors";
import {
  codOtpResultSchema,
  createdOrderSchema,
  finalizedPaymentSchema,
  parseStoreResult,
  paymentAttemptSchema,
  resolvedPaymentSchema,
  type CodOtpResult,
  type CreateOrderRpcInput,
  type CreatedOrder,
  type FinalizePaymentInput,
  type FinalizedPayment,
  type OrderStore,
  type PaymentAttempt,
  type PaymentContext,
  type ResolvedPayment,
  type StoreCodOtpInput,
  type WebhookEventInput,
  type WebhookEventRecord,
} from "./store-types";

function raise(error: { message: string } | null, label: string): never {
  throw new Error(error?.message || `${label} failed`);
}

/** Columns typed `Json` are `NOT NULL` in the schema. */
type NonNullJson = Exclude<Json, null>;

function toJson(value: Record<string, unknown>): NonNullJson {
  return value as NonNullJson;
}

export const supabaseOrderStore: OrderStore = {
  async createOrder(input: CreateOrderRpcInput): Promise<CreatedOrder> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("create_order", {
      p_payload: input as unknown as Json,
    });
    if (error) raise(error, "create_order");
    return parseStoreResult(createdOrderSchema, data, "order");
  },

  async getOrderByToken(token: string): Promise<unknown | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_order_by_token", {
      p_token: token,
    });
    if (error) return null;
    return data ?? null;
  },

  async submitFeedback({
    orderToken,
    rating,
    notes,
  }): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("submit_feedback", {
      p_token: orderToken,
      p_rating: rating,
      p_notes: notes ?? undefined,
    });

    if (error) {
      if (error.message.includes("ORDER_NOT_FOUND_OR_ALREADY_RATED")) {
        throw new OrderFailure(
          "ORDER_STATE_INVALID",
          "Feedback was already sent, or this order is not ready for feedback.",
        );
      }
      raise(error, "submit_feedback");
    }
  },

  async getPaymentContext(token: string): Promise<PaymentContext | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_token, order_number, customer_name, customer_phone, order_status, payment_status, payment_method, total_amount",
      )
      .eq("order_token", token)
      .maybeSingle();

    if (error || !data) return null;

    return {
      orderToken: data.order_token,
      orderNumber: Number(data.order_number),
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      orderStatus: data.order_status,
      paymentStatus: data.payment_status,
      paymentMethod: data.payment_method,
      totalAmount: data.total_amount ?? 0,
    };
  },

  async startPaymentAttempt({
    orderToken,
    method,
    provider,
  }): Promise<PaymentAttempt> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("start_payment_attempt", {
      p_order_token: orderToken,
      p_method: method,
      p_provider: provider,
    });
    if (error) raise(error, "start_payment_attempt");
    return parseStoreResult(paymentAttemptSchema, data, "payment attempt");
  },

  async resolvePaymentTxRef(txRef: string): Promise<ResolvedPayment | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("resolve_payment_tx_ref", {
      p_tx_ref: txRef,
    });
    if (error) raise(error, "resolve_payment_tx_ref");
    if (!data) return null;
    return parseStoreResult(resolvedPaymentSchema, data, "payment reference");
  },

  async finalizePaymentAttempt(
    input: FinalizePaymentInput,
  ): Promise<FinalizedPayment> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("finalize_payment_attempt", {
      p_tx_ref: input.txRef,
      p_success: input.success,
      p_provider_transaction_id: input.providerTransactionId,
      p_raw_payload: (input.rawPayload ?? {}) as unknown as Json,
      p_error: input.error,
    });
    if (error) raise(error, "finalize_payment_attempt");
    return parseStoreResult(finalizedPaymentSchema, data, "payment result");
  },

  async recordWebhookEvent(
    input: WebhookEventInput,
  ): Promise<WebhookEventRecord> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("webhook_events")
      .insert({
        provider: input.provider,
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        payload: toJson(input.payload),
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        // A retry of an event we have not finished is allowed to reprocess.
        const existing = await supabase
          .from("webhook_events")
          .select("id, processed_at")
          .eq("provider", input.provider)
          .eq("provider_event_id", input.providerEventId)
          .maybeSingle();

        return {
          duplicate: true,
          processed: Boolean(existing.data?.processed_at),
          eventId: existing.data?.id ?? null,
        };
      }
      raise(error, "webhook_events insert");
    }

    return { duplicate: false, processed: false, eventId: data?.id ?? null };
  },

  async completeWebhookEvent({
    providerEventId,
    error: processingError,
  }): Promise<void> {
    const supabase = createAdminClient();
    await supabase
      .from("webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        error: processingError?.slice(0, 2000) ?? null,
      })
      .eq("provider", "flutterwave")
      .eq("provider_event_id", providerEventId);
  },

  async expirePendingOrders(): Promise<number> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("expire_pending_orders");
    if (error) raise(error, "expire_pending_orders");
    return Number(data ?? 0);
  },

  async storeCodOtp(input: StoreCodOtpInput): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("store_cod_otp", {
      p_phone: input.phone,
      p_code: input.code,
      p_expires_at: input.expiresAt,
      p_ip_hash: input.ipHash,
      p_max_attempts: input.maxAttempts ?? 3,
    });
    if (error) raise(error, "store_cod_otp");
  },

  async verifyCodOtp({
    phone,
    code,
  }: {
    phone: string;
    code: string;
  }): Promise<CodOtpResult> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("verify_cod_otp", {
      p_phone: phone,
      p_code: code,
    });
    if (error) raise(error, "verify_cod_otp");
    return parseStoreResult(codOtpResultSchema, data, "OTP result");
  },

  async isReturningCustomer(phone: string): Promise<boolean> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("has_delivered_order", {
      p_phone: phone,
    });
    if (error) raise(error, "has_delivered_order");
    return data === true;
  },

  async isPhoneBlacklisted(phone: string): Promise<boolean> {
    const normalized = normalizeUgPhone(phone);
    if (!normalized) return false;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("blacklisted_phones")
      .select("phone");

    if (error) {
      throw new OrderFailure(
        "INTERNAL_ERROR",
        "We could not verify this phone number. Try again shortly.",
      );
    }

    return (data ?? []).some(
      (row) => normalizeUgPhone(row.phone) === normalized,
    );
  },

  async attachPaymentProviderReference({
    transactionId,
    providerReference,
    rawPayload,
  }): Promise<void> {
    const supabase = createAdminClient();
    const update: {
      raw_payload: NonNullJson;
      provider_transaction_id?: string;
    } = {
      raw_payload: toJson(rawPayload),
    };
    if (providerReference) {
      update.provider_transaction_id = providerReference;
    }

    const { error } = await supabase
      .from("payment_transactions")
      .update(update)
      .eq("id", transactionId);
    if (error) raise(error, "payment_transactions update");
  },
};
