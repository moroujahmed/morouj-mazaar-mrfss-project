"use server";

import { randomUUID } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import {
  OrderFailure,
  toActionFailure,
  type ActionResult,
} from "@/lib/orders/errors";
import { getOrderStore } from "@/lib/orders/store";
import {
  createHostedPayment,
  PaymentProviderError,
  paymentsFixtureMode,
} from "@/lib/payments/flutterwave";
import { getRateLimiter } from "@/lib/routing/rate-limit";
import {
  initiatePaymentSchema,
  mockPaymentSchema,
  type DigitalPaymentMethod,
} from "@/lib/schemas/order";

/**
 * Payment initiation and the test-only mock completion action.
 *
 * Retries never reuse a `tx_ref`: `start_payment_attempt` abandons the open
 * attempt and allocates the next number under the order row lock.
 */

const PAYMENT_ATTEMPT_LIMIT = { max: 5, windowSeconds: 60 * 60 };

export type InitiatePaymentResult = {
  redirectUrl: string;
  transactionId: string;
  txRef: string;
  attemptNumber: number;
};

export type MockPaymentResult = {
  orderToken: string;
  applied: boolean;
  orderStatus: string;
  paymentStatus: string;
  reason: string | null;
};

function appUrl(): string {
  return getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

export async function initiatePaymentAction(
  payload: unknown,
): Promise<ActionResult<InitiatePaymentResult>> {
  try {
    const parsed = initiatePaymentSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return toActionFailure(
        new OrderFailure(
          "VALIDATION_ERROR",
          issue?.message ?? undefined,
          issue?.path.join("."),
        ),
      );
    }

    const { orderToken, method } = parsed.data;

    let limit;
    try {
      limit = await getRateLimiter().consumeWithLimit(
        `mrfss:rl:payment:${orderToken}`,
        PAYMENT_ATTEMPT_LIMIT.max,
        PAYMENT_ATTEMPT_LIMIT.windowSeconds,
      );
    } catch {
      throw new OrderFailure("PAYMENT_UNAVAILABLE");
    }
    if (!limit.allowed) {
      throw new OrderFailure(
        "RATE_LIMITED",
        "Too many payment attempts. Wait a moment and try again.",
      );
    }

    const store = getOrderStore();
    const context = await store.getPaymentContext(orderToken);
    if (!context) throw new OrderFailure("ORDER_NOT_FOUND");

    if (context.paymentMethod === "CASH_ON_DELIVERY") {
      throw new OrderFailure(
        "PAYMENT_METHOD_UNAVAILABLE",
        "This order is paid in cash on delivery.",
      );
    }
    if (context.paymentMethod !== method) {
      throw new OrderFailure(
        "VALIDATION_ERROR",
        "That payment method does not match this order.",
        "method",
      );
    }
    if (
      context.orderStatus !== "PENDING_PAYMENT" ||
      context.paymentStatus !== "PENDING"
    ) {
      throw new OrderFailure("ORDER_STATE_INVALID");
    }

    const attempt = await store.startPaymentAttempt({
      orderToken,
      method,
      provider: "flutterwave",
    });

    if (paymentsFixtureMode()) {
      return {
        ok: true,
        data: {
          redirectUrl: `/checkout/mock-payment?tx_ref=${encodeURIComponent(attempt.txRef)}`,
          transactionId: attempt.transactionId,
          txRef: attempt.txRef,
          attemptNumber: attempt.attemptNumber,
        },
      };
    }

    let checkoutUrl: string;
    try {
      const hosted = await createHostedPayment({
        txRef: attempt.txRef,
        amount: attempt.amount,
        currency: attempt.currency,
        redirectUrl: `${appUrl()}/orders/${context.orderToken}`,
        customer: {
          name: context.customerName,
          phone: context.customerPhone,
        },
        method: method as DigitalPaymentMethod,
        description: `Order #${context.orderNumber}`,
        meta: {
          orderToken: context.orderToken,
          txRef: attempt.txRef,
        },
      });
      checkoutUrl = hosted.checkoutUrl;
    } catch (error) {
      // The attempt is dead; a retry allocates a fresh reference.
      await store
        .finalizePaymentAttempt({
          txRef: attempt.txRef,
          success: false,
          error: "PAYMENT_INIT_FAILED",
        })
        .catch(() => undefined);

      throw new OrderFailure(
        "PAYMENT_UNAVAILABLE",
        error instanceof PaymentProviderError
          ? "The payment provider is unavailable right now. Try again shortly."
          : undefined,
      );
    }

    await store.attachPaymentProviderReference({
      transactionId: attempt.transactionId,
      providerReference: "",
      rawPayload: { checkoutUrl },
    });

    return {
      ok: true,
      data: {
        redirectUrl: checkoutUrl,
        transactionId: attempt.transactionId,
        txRef: attempt.txRef,
        attemptNumber: attempt.attemptNumber,
      },
    };
  } catch (error) {
    return toActionFailure(error);
  }
}

/**
 * Test-only. Simulates the hosted checkout success/failure branch without any
 * network call. It is unreachable unless `PAYMENTS_FIXTURE=1` (or mock mode
 * outside production).
 */
export async function completeMockPaymentAction(
  payload: unknown,
): Promise<ActionResult<MockPaymentResult>> {
  try {
    if (!paymentsFixtureMode()) {
      throw new OrderFailure(
        "PAYMENT_METHOD_UNAVAILABLE",
        "Mock payments are disabled.",
      );
    }

    const parsed = mockPaymentSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return toActionFailure(
        new OrderFailure(
          "VALIDATION_ERROR",
          issue?.message ?? undefined,
          issue?.path.join("."),
        ),
      );
    }

    const store = getOrderStore();
    const resolved = await store.resolvePaymentTxRef(parsed.data.txRef);
    if (!resolved) throw new OrderFailure("ORDER_NOT_FOUND");

    const success = parsed.data.outcome === "success";
    const finalized = await store.finalizePaymentAttempt({
      txRef: parsed.data.txRef,
      success,
      providerTransactionId: success
        ? `MOCK-${randomUUID()}`
        : `MOCK-FAILED-${randomUUID()}`,
      rawPayload: { mock: true, outcome: parsed.data.outcome },
      error: success ? undefined : "MOCK_DECLINED",
    });

    const current = await store.resolvePaymentTxRef(parsed.data.txRef);

    return {
      ok: true,
      data: {
        orderToken: resolved.orderToken,
        applied: finalized.applied,
        orderStatus: finalized.orderStatus ?? current?.orderStatus ?? resolved.orderStatus,
        paymentStatus:
          finalized.paymentStatus ?? current?.paymentStatus ?? resolved.paymentStatus,
        reason: finalized.reason ?? null,
      },
    };
  } catch (error) {
    return toActionFailure(error);
  }
}
