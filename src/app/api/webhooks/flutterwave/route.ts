import { timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { getOrderStore } from "@/lib/orders/store";
import { flutterwaveWebhookSchema } from "@/lib/schemas/order";
import { verifyTransaction } from "@/lib/payments/flutterwave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Flutterwave webhook.
 *
 * The shared-secret `verif-hash` header authenticates the request, but the body
 * is never trusted on its own: the provider's verify API is the authority on
 * whether money moved. Each event is stored once; a retry of an unfinished
 * event is allowed to reprocess. A late success on an abandoned attempt is
 * recorded but never satisfies the current attempt.
 */

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeEqual(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function paymentsFixtureMode(): boolean {
  return process.env.PAYMENTS_FIXTURE === "1";
}

export async function POST(request: Request): Promise<Response> {
  let expectedHash: string;
  try {
    expectedHash = getServerEnv().FLW_WEBHOOK_HASH.trim();
  } catch {
    return json({ error: "PAYMENTS_UNAVAILABLE" }, 503);
  }

  // Fail closed: an unconfigured hash must never accept a webhook.
  if (!expectedHash) return json({ error: "PAYMENTS_UNAVAILABLE" }, 503);

  const receivedHash = request.headers.get("verif-hash") ?? "";
  if (!receivedHash || !safeEqual(receivedHash, expectedHash)) {
    return json({ error: "INVALID_SIGNATURE" }, 401);
  }

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(await request.text());
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const parsed = flutterwaveWebhookSchema.safeParse(payloadJson);
  if (!parsed.success) {
    return json({ error: "INVALID_PAYLOAD" }, 400);
  }

  const { event, data } = parsed.data;
  const providerEventId = `${event}:${data.id}`;
  const store = getOrderStore();

  let recorded;
  try {
    recorded = await store.recordWebhookEvent({
      provider: "flutterwave",
      providerEventId,
      eventType: event,
      payload: payloadJson as Record<string, unknown>,
    });
  } catch {
    // Let the provider retry; nothing was changed.
    return json({ error: "STORAGE_UNAVAILABLE" }, 503);
  }

  if (recorded.duplicate && recorded.processed) {
    return json({ received: true, duplicate: true }, 200);
  }

  // Only completed charges affect an order.
  if (event !== "charge.completed") {
    await store
      .completeWebhookEvent({ providerEventId })
      .catch(() => undefined);
    return json({ received: true, ignored: "event_type" }, 200);
  }

  let resolved;
  try {
    resolved = await store.resolvePaymentTxRef(data.tx_ref);
  } catch {
    return json({ error: "STORAGE_UNAVAILABLE" }, 503);
  }

  if (!resolved) {
    await store
      .completeWebhookEvent({
        providerEventId,
        error: "TX_REF_NOT_FOUND",
      })
      .catch(() => undefined);
    return json({ received: true, ignored: "tx_ref" }, 200);
  }

  let verified;
  try {
    verified = paymentsFixtureMode()
      ? {
          providerTransactionId: data.id,
          txRef: data.tx_ref,
          amount: Math.round(data.amount),
          currency: data.currency,
          status: data.status,
          raw: {
            fixture: true,
            id: data.id,
            tx_ref: data.tx_ref,
            amount: data.amount,
            currency: data.currency,
            status: data.status,
          } as Record<string, unknown>,
        }
      : await verifyTransaction(data.id);
  } catch {
    // Provider outage: do not mark the event processed so it can retry.
    return json({ error: "VERIFY_UNAVAILABLE" }, 503);
  }

  const currency = verified.currency.trim().toUpperCase();
  const expectedCurrency = resolved.currency.trim().toUpperCase();
  const verifiedSuccess = verified.status.toLowerCase() === "successful";

  // A mismatched reference or amount never marks an order paid.
  if (verified.txRef !== resolved.txRef) {
    await store.finalizePaymentAttempt({
      txRef: resolved.txRef,
      success: false,
      providerTransactionId: verified.providerTransactionId,
      rawPayload: verified.raw,
      error: "TX_REF_MISMATCH",
    });
    await store
      .completeWebhookEvent({ providerEventId, error: "TX_REF_MISMATCH" })
      .catch(() => undefined);
    return json({ received: true, applied: false, reason: "TX_REF_MISMATCH" }, 200);
  }

  if (verified.amount !== resolved.amount || currency !== expectedCurrency) {
    await store.finalizePaymentAttempt({
      txRef: resolved.txRef,
      success: false,
      providerTransactionId: verified.providerTransactionId,
      rawPayload: verified.raw,
      error: "PAYMENT_MISMATCH",
    });
    await store
      .completeWebhookEvent({ providerEventId, error: "PAYMENT_MISMATCH" })
      .catch(() => undefined);
    return json({ received: true, applied: false, reason: "PAYMENT_MISMATCH" }, 200);
  }

  let finalized;
  try {
    finalized = await store.finalizePaymentAttempt({
      txRef: resolved.txRef,
      success: verifiedSuccess,
      providerTransactionId: verified.providerTransactionId,
      rawPayload: verified.raw,
      error: verifiedSuccess ? undefined : verified.status.toUpperCase(),
    });
  } catch {
    return json({ error: "STORAGE_UNAVAILABLE" }, 503);
  }

  await store
    .completeWebhookEvent({
      providerEventId,
      error: finalized.applied ? undefined : (finalized.reason ?? undefined),
    })
    .catch(() => undefined);

  return json(
    {
      received: true,
      applied: finalized.applied,
      reason: finalized.reason ?? null,
    },
    200,
  );
}
