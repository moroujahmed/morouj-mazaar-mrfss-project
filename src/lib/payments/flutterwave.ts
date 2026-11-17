import "server-only";

import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import type { DigitalPaymentMethod } from "@/lib/schemas/order";

/**
 * Flutterwave hosted-checkout adapter.
 *
 * The browser never sees the secret key and card data never enters the app.
 * Every call fails closed: a provider outage raises `PaymentProviderError` and
 * the caller returns `PAYMENT_UNAVAILABLE` rather than inventing a payment
 * result.
 */

export const FLUTTERWAVE_PROVIDER = "flutterwave";

export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

/** Test-only branches. Production never sets either flag. */
export function paymentsFixtureMode(): boolean {
  return (
    process.env.PAYMENTS_FIXTURE === "1" ||
    (process.env.PAYMENTS_MODE === "mock" &&
      process.env.NODE_ENV !== "production")
  );
}

export function flutterwaveConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.FLW_SECRET_KEY && env.FLW_PUBLIC_KEY);
}

const paymentOptions: Record<DigitalPaymentMethod, string> = {
  MTN_MOMO: "mobilemoneyuganda,card",
  AIRTEL_MONEY: "mobilemoneyuganda,card",
  BANK_CARD: "card",
};

export type HostedPaymentRequest = {
  txRef: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  customer: { name: string; phone: string };
  method: DigitalPaymentMethod;
  description: string;
  meta: Record<string, string>;
};

const hostedPaymentSchema = z.object({
  status: z.string(),
  data: z.object({ link: z.string().url() }).passthrough().optional(),
});

/**
 * Flutterwave requires an email. Customers only give a phone, so a stable
 * synthetic address is derived locally; it is never used for delivery.
 */
function customerEmail(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `${digits}@customer.moroujmazaar.com`;
}

export async function createHostedPayment(
  request: HostedPaymentRequest,
): Promise<{ checkoutUrl: string }> {
  const env = getServerEnv();
  if (!env.FLW_SECRET_KEY) {
    throw new PaymentProviderError("Flutterwave is not configured.");
  }

  const base = env.FLW_BASE_URL.replace(/\/+$/, "");

  let response: Response;
  try {
    response = await fetch(`${base}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        tx_ref: request.txRef,
        amount: request.amount,
        currency: request.currency,
        redirect_url: request.redirectUrl,
        payment_options: paymentOptions[request.method],
        customer: {
          email: customerEmail(request.customer.phone),
          phonenumber: request.customer.phone,
          name: request.customer.name,
        },
        customizations: {
          title: "Bazaar Flame & Grill",
          description: request.description,
        },
        meta: request.meta,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new PaymentProviderError("Could not reach the payment provider.");
  }

  if (!response.ok) {
    throw new PaymentProviderError(
      `The payment provider rejected the request (${response.status}).`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PaymentProviderError("The payment provider returned invalid JSON.");
  }

  const parsed = hostedPaymentSchema.safeParse(payload);
  if (!parsed.success || parsed.data.status !== "success") {
    throw new PaymentProviderError(
      "The payment provider did not return a checkout link.",
    );
  }

  const link = parsed.data.data?.link;
  if (!link) {
    throw new PaymentProviderError(
      "The payment provider did not return a checkout link.",
    );
  }

  return { checkoutUrl: link };
}

export type VerifiedTransaction = {
  providerTransactionId: string;
  txRef: string;
  amount: number;
  currency: string;
  status: string;
  raw: Record<string, unknown>;
};

const verifiedTransactionSchema = z.object({
  status: z.string(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]),
      tx_ref: z.string(),
      amount: z.union([z.string(), z.number()]),
      currency: z.string(),
      status: z.string(),
    })
    .passthrough(),
});

/**
 * Server-to-server verification. The webhook body is never trusted on its own:
 * only this response decides whether money actually moved.
 */
export async function verifyTransaction(
  providerTransactionId: string,
): Promise<VerifiedTransaction> {
  const env = getServerEnv();
  if (!env.FLW_SECRET_KEY) {
    throw new PaymentProviderError("Flutterwave is not configured.");
  }

  const base = env.FLW_BASE_URL.replace(/\/+$/, "");
  const url = `${base}/transactions/${encodeURIComponent(providerTransactionId)}/verify`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new PaymentProviderError("Could not reach the payment provider.");
  }

  if (!response.ok) {
    throw new PaymentProviderError(
      `Payment verification failed (${response.status}).`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PaymentProviderError("The payment provider returned invalid JSON.");
  }

  const parsed = verifiedTransactionSchema.safeParse(payload);
  if (!parsed.success || parsed.data.status !== "success") {
    throw new PaymentProviderError("Payment verification was rejected.");
  }

  const amount = Number(parsed.data.data.amount);
  if (!Number.isFinite(amount)) {
    throw new PaymentProviderError("Payment verification returned no amount.");
  }

  return {
    providerTransactionId: String(parsed.data.data.id),
    txRef: parsed.data.data.tx_ref,
    amount: Math.round(amount),
    currency: parsed.data.data.currency,
    status: parsed.data.data.status,
    raw: parsed.data.data,
  };
}
