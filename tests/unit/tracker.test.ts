import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "198.51.100.42" }),
}));

vi.mock("@/lib/storefront/menu", async () => {
  const { createFixtureMenu } = await import("@/lib/storefront/fixture");
  return {
    getStorefrontMenu: vi.fn(async () => createFixtureMenu()),
  };
});

import { createOrderAction } from "@/actions/checkout";
import { submitFeedbackAction } from "@/actions/orders";
import { GET as tracking } from "@/app/api/orders/[token]/tracking/route";
import {
  getFixtureOrderByToken,
  resetOrderStoreForTests,
  setFixtureOrderStatusForTests,
} from "@/lib/orders/fixture-store";
import { getOrderStore } from "@/lib/orders/store";
import { toTrackerSnapshot } from "@/lib/orders/tracker";
import { resetRateLimiterForTests } from "@/lib/routing/rate-limit";
import {
  orderConfirmationSchema,
  type OrderConfirmation,
} from "@/lib/schemas/order";
import { createFixtureMenu } from "@/lib/storefront/fixture";
import { getStorefrontMenu } from "@/lib/storefront/menu";

const TILAPIA = "22222222-2222-4222-8222-222222222201";
const GARLIC_DIP = "44444444-4444-4444-8444-444444444401";

function fixtureMenuOrThrow() {
  const result = createFixtureMenu();
  if (result.status !== "ok") throw new Error("fixture menu unavailable");
  return result.menu;
}

function tilapiaCombos() {
  const menu = fixtureMenuOrThrow();
  const tilapia = menu.items.find((item) => item.id === TILAPIA);
  if (!tilapia) throw new Error("tilapia missing");
  return tilapia.comboSteps.map((step) => ({
    stepId: step.id,
    optionId: step.options[0]?.id ?? "",
  }));
}

async function createOrder(
  overrides: Record<string, unknown> = {},
): Promise<OrderConfirmation> {
  const created = await createOrderAction({
    idempotencyKey: randomUUID(),
    customerName: "Tracker Test",
    customerPhone: "0772900100",
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
    ...overrides,
  });
  if (!created.ok) throw new Error(created.error.message);

  const raw = await getOrderStore().getOrderByToken(created.data.orderToken);
  const parsed = orderConfirmationSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `fixture order payload invalid: ${JSON.stringify(parsed.error.issues)}`,
    );
  }
  return parsed.data;
}

function trackingRequest(token: string): Request {
  return new Request(`http://localhost/api/orders/${token}/tracking`, {
    headers: { "x-forwarded-for": "198.51.100.42" },
  });
}

async function readTracking(token: string) {
  const response = await tracking(trackingRequest(token), {
    params: Promise.resolve({ token }),
  });
  const body = (await response.json()) as {
    ok?: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string };
  };
  return { response, body };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STOREFRONT_FIXTURE", "1");
  vi.stubEnv("DISTANCE_FIXTURE", "1");
  vi.stubEnv("ORDERS_FIXTURE", "1");
  vi.stubEnv("PAYMENTS_FIXTURE", "1");
  vi.stubEnv("OTP_FIXTURE", "1");
  vi.stubEnv("RATE_LIMIT_FIXTURE", "1");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  resetOrderStoreForTests();
  resetRateLimiterForTests();
  vi.mocked(getStorefrontMenu).mockResolvedValue({
    status: "ok",
    menu: fixtureMenuOrThrow(),
  });
});

describe("tracker polling", () => {
  it("returns a narrowed snapshot without the handover PIN or phone", async () => {
    const order = await createOrder();
    const stored = getFixtureOrderByToken(order.orderToken);
    expect(stored?.handoverPin).toMatch(/^[0-9]{4}$/);

    const { response, body } = await readTracking(order.orderToken);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.ok).toBe(true);
    expect(body.data?.status).toBe("PENDING_PAYMENT");
    expect(body.data?.handoverPin).toBeUndefined();
    expect(body.data?.customerPhone).toBeUndefined();
    expect(body.data?.paymentReference).toBeUndefined();
    expect(body.data?.timeline).toEqual([
      expect.objectContaining({ status: "PENDING_PAYMENT" }),
    ]);
  });

  it("includes rider telemetry and destination only while out for delivery", async () => {
    const order = await createOrder();

    let trackingPayload = await readTracking(order.orderToken);
    expect(trackingPayload.body.data?.destinationLatitude).toBeNull();
    expect(trackingPayload.body.data?.rider).toBeNull();

    const updatedAt = new Date().toISOString();
    setFixtureOrderStatusForTests(order.orderToken, "OUT_FOR_DELIVERY", {
      telemetry: { latitude: 0.32, longitude: 32.57, updatedAt },
    });

    trackingPayload = await readTracking(order.orderToken);
    expect(trackingPayload.body.data?.status).toBe("OUT_FOR_DELIVERY");
    expect(trackingPayload.body.data?.destinationLatitude).toBeCloseTo(0.3245);
    expect(trackingPayload.body.data?.destinationLongitude).toBeCloseTo(
      32.5782,
    );
    expect(trackingPayload.body.data?.rider).toMatchObject({
      name: "Juma Okello",
      latitude: 0.32,
      longitude: 32.57,
      updatedAt,
    });
    expect(trackingPayload.body.data?.handoverPin).toBeUndefined();
  });

  it("returns 404 for unknown and malformed tokens", async () => {
    const unknown = await readTracking(
      "00000000-0000-4000-8000-000000000000",
    );
    expect(unknown.response.status).toBe(404);

    const malformed = await readTracking("not-a-token");
    expect(malformed.response.status).toBe(404);
  });

  it("strips the PIN when a snapshot is built for polling", async () => {
    const order = await createOrder();
    const snapshot = toTrackerSnapshot(order);
    expect("handoverPin" in snapshot).toBe(false);
  });
});

describe("feedback", () => {
  it("is rejected before delivery", async () => {
    const order = await createOrder();
    const result = await submitFeedbackAction({
      orderToken: order.orderToken,
      rating: "GREAT",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("ORDER_STATE_INVALID");
  });

  it("is accepted once on a delivered order", async () => {
    const order = await createOrder();
    setFixtureOrderStatusForTests(order.orderToken, "READY_FOR_PICKUP");
    setFixtureOrderStatusForTests(order.orderToken, "OUT_FOR_DELIVERY");
    setFixtureOrderStatusForTests(order.orderToken, "DELIVERED");

    let trackingPayload = await readTracking(order.orderToken);
    expect(trackingPayload.body.data?.canRate).toBe(true);
    expect(trackingPayload.body.data?.handoverPin).toBeUndefined();

    const first = await submitFeedbackAction({
      orderToken: order.orderToken,
      rating: "GREAT",
      notes: "Still warm and sealed.",
    });
    expect(first).toEqual({ ok: true, data: { success: true } });

    trackingPayload = await readTracking(order.orderToken);
    expect(trackingPayload.body.data?.canRate).toBe(false);
    expect(trackingPayload.body.data?.feedback).toEqual({
      rating: "GREAT",
      notes: "Still warm and sealed.",
    });

    const second = await submitFeedbackAction({
      orderToken: order.orderToken,
      rating: "BAD",
    });
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("expected failure");
    expect(second.error.code).toBe("ORDER_STATE_INVALID");
  });

  it("rejects an unknown rating without touching the store", async () => {
    const order = await createOrder();
    setFixtureOrderStatusForTests(order.orderToken, "DELIVERED");

    const result = await submitFeedbackAction({
      orderToken: order.orderToken,
      rating: "AMAZING",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(getFixtureOrderByToken(order.orderToken)?.feedback).toBeNull();
  });
});
