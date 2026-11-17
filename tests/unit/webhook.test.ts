import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "198.51.100.21" }),
}));

vi.mock("@/lib/storefront/menu", async () => {
  const { createFixtureMenu } = await import("@/lib/storefront/fixture");
  return {
    getStorefrontMenu: vi.fn(async () => createFixtureMenu()),
  };
});

import { createOrderAction } from "@/actions/checkout";
import { initiatePaymentAction } from "@/actions/payments";
import {
  GET as expireOrders,
  POST as expireOrdersPost,
} from "@/app/api/cron/expire-orders/route";
import { POST as flutterwaveWebhook } from "@/app/api/webhooks/flutterwave/route";
import { resetServerEnvCache } from "@/lib/env";
import {
  ageFixtureOrderForTests,
  fixtureRefundCount,
  getFixtureOrderByToken,
  resetOrderStoreForTests,
} from "@/lib/orders/fixture-store";
import { resetRouteCacheForTests } from "@/lib/routing/cache";
import { resetRateLimiterForTests } from "@/lib/routing/rate-limit";
import { createFixtureMenu } from "@/lib/storefront/fixture";

const TILAPIA = "22222222-2222-4222-8222-222222222201";
const GARLIC_DIP = "44444444-4444-4444-8444-444444444401";
const WEBHOOK_HASH = "test-webhook-hash";
const CRON_SECRET = "test-cron-secret";

function tilapiaCombos() {
  const result = createFixtureMenu();
  if (result.status !== "ok") throw new Error("fixture menu unavailable");
  const tilapia = result.menu.items.find((item) => item.id === TILAPIA);
  if (!tilapia) throw new Error("tilapia missing");
  return tilapia.comboSteps.map((step) => ({
    stepId: step.id,
    optionId: step.options[0]?.id ?? "",
  }));
}

type CreatedOrder = {
  orderToken: string;
  txRef: string;
  total: number;
};

function stubBaseEnv() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STOREFRONT_FIXTURE", "1");
  vi.stubEnv("DISTANCE_FIXTURE", "1");
  vi.stubEnv("ORDERS_FIXTURE", "1");
  vi.stubEnv("PAYMENTS_FIXTURE", "1");
  vi.stubEnv("OTP_FIXTURE", "1");
  vi.stubEnv("RATE_LIMIT_FIXTURE", "1");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3100");
  vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "+256700000000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key-000000000000000000");
  vi.stubEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "test-service-role-key-000000000000",
  );
  vi.stubEnv("FLW_WEBHOOK_HASH", WEBHOOK_HASH);
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  resetServerEnvCache();
}

async function createPendingOrder(): Promise<CreatedOrder> {
  const created = await createOrderAction({
    idempotencyKey: randomUUID(),
    customerName: "Webhook Test",
    customerPhone: "0772123470",
    orderType: "DELIVERY",
    deliveryCoordinates: { lat: 0.3245, lng: 32.5782 },
    deliveryAddressText: "Nakasero Plot 12",
    items: [
      {
        menuItemId: TILAPIA,
        quantity: 1,
        modifierIds: [GARLIC_DIP],
        comboSelections: tilapiaCombos(),
      },
    ],
    paymentMethod: "MTN_MOMO",
  });
  if (!created.ok) throw new Error(created.error.message);

  const attempt = await initiatePaymentAction({
    orderToken: created.data.orderToken,
    method: "MTN_MOMO",
  });
  if (!attempt.ok) throw new Error(attempt.error.message);

  return {
    orderToken: created.data.orderToken,
    txRef: attempt.data.txRef,
    total: created.data.totalAmount,
  };
}

function webhookRequest(
  payload: unknown,
  headers: Record<string, string> = { "verif-hash": WEBHOOK_HASH },
): Request {
  return new Request("http://localhost/api/webhooks/flutterwave", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

function chargePayload({
  txRef,
  amount,
  eventId = randomUUID(),
  currency = "UGX",
  status = "successful",
}: {
  txRef: string;
  amount: number;
  eventId?: string;
  currency?: string;
  status?: string;
}) {
  return {
    event: "charge.completed",
    data: {
      id: eventId,
      tx_ref: txRef,
      flw_ref: "FLW-TEST",
      amount,
      currency,
      status,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stubBaseEnv();
  resetOrderStoreForTests();
  resetRateLimiterForTests();
  resetRouteCacheForTests();
});

describe("flutterwave webhook — authentication", () => {
  it("rejects a missing signature", async () => {
    const response = await flutterwaveWebhook(
      webhookRequest(chargePayload({ txRef: "x", amount: 1 }), {}),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_SIGNATURE",
    });
  });

  it("rejects a wrong signature", async () => {
    const response = await flutterwaveWebhook(
      webhookRequest(chargePayload({ txRef: "x", amount: 1 }), {
        "verif-hash": "not-the-hash",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("fails closed when the webhook hash is not configured", async () => {
    vi.stubEnv("FLW_WEBHOOK_HASH", "");
    resetServerEnvCache();

    const response = await flutterwaveWebhook(
      webhookRequest(chargePayload({ txRef: "x", amount: 1 })),
    );
    expect(response.status).toBe(503);
  });

  it("rejects malformed JSON", async () => {
    const response = await flutterwaveWebhook(
      new Request("http://localhost/api/webhooks/flutterwave", {
        method: "POST",
        headers: { "verif-hash": WEBHOOK_HASH },
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("flutterwave webhook — payment outcome", () => {
  it("marks a matching successful charge as paid", async () => {
    const order = await createPendingOrder();

    const response = await flutterwaveWebhook(
      webhookRequest(chargePayload({ txRef: order.txRef, amount: order.total })),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      applied: true,
    });

    const stored = getFixtureOrderByToken(order.orderToken);
    expect(stored?.status).toBe("PREPARING");
    expect(stored?.paymentStatus).toBe("PAID");
  });

  it("ignores a duplicate event that already finished", async () => {
    const order = await createPendingOrder();
    const eventId = randomUUID();
    const payload = chargePayload({
      txRef: order.txRef,
      amount: order.total,
      eventId,
    });

    const first = await flutterwaveWebhook(webhookRequest(payload));
    expect(first.status).toBe(200);

    const second = await flutterwaveWebhook(webhookRequest(payload));
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({
      received: true,
      duplicate: true,
    });
  });

  it("never marks an order paid when the amount differs", async () => {
    const order = await createPendingOrder();

    const response = await flutterwaveWebhook(
      webhookRequest(
        chargePayload({ txRef: order.txRef, amount: order.total + 500 }),
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      applied: false,
      reason: "PAYMENT_MISMATCH",
    });

    const stored = getFixtureOrderByToken(order.orderToken);
    expect(stored?.status).toBe("PENDING_PAYMENT");
    expect(stored?.paymentStatus).toBe("PENDING");
  });

  it("never marks an order paid when the currency differs", async () => {
    const order = await createPendingOrder();

    const response = await flutterwaveWebhook(
      webhookRequest(
        chargePayload({
          txRef: order.txRef,
          amount: order.total,
          currency: "USD",
        }),
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      applied: false,
      reason: "PAYMENT_MISMATCH",
    });
  });

  it("records a late success on an abandoned attempt without paying the order", async () => {
    const order = await createPendingOrder();

    const retry = await initiatePaymentAction({
      orderToken: order.orderToken,
      method: "MTN_MOMO",
    });
    if (!retry.ok) throw new Error(retry.error.message);

    const response = await flutterwaveWebhook(
      webhookRequest(chargePayload({ txRef: order.txRef, amount: order.total })),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      applied: false,
      reason: "ATTEMPT_ABANDONED",
    });
    expect(fixtureRefundCount()).toBe(1);

    const stored = getFixtureOrderByToken(order.orderToken);
    expect(stored?.status).toBe("PENDING_PAYMENT");
    expect(stored?.paymentStatus).toBe("PENDING");
  });

  it("acknowledges an unknown tx_ref without changing anything", async () => {
    const response = await flutterwaveWebhook(
      webhookRequest(
        chargePayload({ txRef: "00000000-0000-4000-8000-000000000000-9", amount: 1 }),
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      ignored: "tx_ref",
    });
  });

  it("ignores non-charge events", async () => {
    const response = await flutterwaveWebhook(
      webhookRequest({
        event: "transfer.completed",
        data: {
          id: randomUUID(),
          tx_ref: "anything",
          amount: 1,
          currency: "UGX",
          status: "successful",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      ignored: "event_type",
    });
  });
});

describe("expire-orders cron", () => {
  function cronRequest(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/cron/expire-orders", { headers });
  }

  it("rejects a request without the cron secret", async () => {
    const response = await expireOrders(cronRequest({}));
    expect(response.status).toBe(401);
  });

  it("rejects a wrong secret", async () => {
    const response = await expireOrders(
      cronRequest({ authorization: "Bearer wrong-secret" }),
    );
    expect(response.status).toBe(401);
  });

  it("fails closed when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    resetServerEnvCache();

    const response = await expireOrdersPost(cronRequest({}));
    expect(response.status).toBe(503);
  });

  it("expires a pending order older than ten minutes", async () => {
    const order = await createPendingOrder();
    ageFixtureOrderForTests(order.orderToken, 11);

    const response = await expireOrders(
      cronRequest({ authorization: `Bearer ${CRON_SECRET}` }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, expired: 1 });

    const stored = getFixtureOrderByToken(order.orderToken);
    expect(stored?.status).toBe("CANCELLED");
    expect(stored?.paymentStatus).toBe("FAILED");
  });

  it("leaves a fresh pending order alone", async () => {
    const order = await createPendingOrder();

    const response = await expireOrders(
      cronRequest({ "x-cron-secret": CRON_SECRET }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, expired: 0 });

    const stored = getFixtureOrderByToken(order.orderToken);
    expect(stored?.status).toBe("PENDING_PAYMENT");
  });
});
