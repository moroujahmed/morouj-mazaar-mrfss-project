import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "198.51.100.7" }),
}));

vi.mock("@/lib/storefront/menu", async () => {
  const { createFixtureMenu } = await import("@/lib/storefront/fixture");
  return {
    getStorefrontMenu: vi.fn(async () => createFixtureMenu()),
  };
});

import { createOrderAction } from "@/actions/checkout";
import { sendCodOtpAction } from "@/actions/otp";
import {
  completeMockPaymentAction,
  initiatePaymentAction,
} from "@/actions/payments";
import {
  ageFixtureOrderForTests,
  fixtureRefundCount,
  getFixtureOrderByToken,
  resetOrderStoreForTests,
  seedDeliveredCustomerForTests,
} from "@/lib/orders/fixture-store";
import { resetRouteCacheForTests } from "@/lib/routing/cache";
import { resetRateLimiterForTests } from "@/lib/routing/rate-limit";
import { createFixtureMenu } from "@/lib/storefront/fixture";
import { getStorefrontMenu } from "@/lib/storefront/menu";

const TILAPIA = "22222222-2222-4222-8222-222222222201";
const LUWOMBO = "22222222-2222-4222-8222-222222222203";
const ROLEX = "22222222-2222-4222-8222-222222222205";
const WATER = "22222222-2222-4222-8222-222222222208";
const JUICE = "22222222-2222-4222-8222-222222222210";
const GARLIC_DIP = "44444444-4444-4444-8444-444444444401";
const TABLE_T4_TOKEN = "88888888-8888-4888-8888-888888888804";

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

function deliveryPayload(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    customerName: "Sarah Test",
    customerPhone: "0772123456",
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
  };
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
  resetRouteCacheForTests();
  vi.mocked(getStorefrontMenu).mockResolvedValue({
    status: "ok",
    menu: fixtureMenuOrThrow(),
  });
});

describe("createOrderAction — canonical totals", () => {
  it("prices delivery order A at 35,000 from the catalogue", async () => {
    const result = await createOrderAction(deliveryPayload());
    if (!result.ok) throw new Error(result.error.message);

    expect(result.data).toMatchObject({
      itemsSubtotal: 32_000,
      modifiersTotal: 2_000,
      deliveryFee: 0,
      packagingFee: 1_000,
      totalAmount: 35_000,
      orderStatus: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      paymentMethod: "MTN_MOMO",
      idempotent: false,
    });
  });

  it("prices cash order B at 38,000 with 12,000 change from 50,000", async () => {
    seedDeliveredCustomerForTests("0772123457");

    const result = await createOrderAction(
      deliveryPayload({
        customerPhone: "0772123457",
        deliveryCoordinates: { lat: 0.3542, lng: 32.612 },
        deliveryAddressText: "Ntinda",
        items: [
          { menuItemId: LUWOMBO, quantity: 1, modifierIds: [] },
          { menuItemId: JUICE, quantity: 1, modifierIds: [] },
        ],
        paymentMethod: "CASH_ON_DELIVERY",
        codChangeRequestedFor: 50_000,
      }),
    );
    if (!result.ok) throw new Error(result.error.message);

    expect(result.data).toMatchObject({
      itemsSubtotal: 31_000,
      modifiersTotal: 0,
      deliveryFee: 6_000,
      packagingFee: 1_000,
      totalAmount: 38_000,
      orderStatus: "CONFIRMED_UNPAID",
    });

    const stored = getFixtureOrderByToken(result.data.orderToken);
    expect(stored?.codChangeDue).toBe(12_000);
  });

  it("prices dine-in at 8,000 with no delivery or packaging", async () => {
    const result = await createOrderAction({
      idempotencyKey: randomUUID(),
      customerName: "Alex Dine",
      customerPhone: "0772123458",
      orderType: "DINE_IN",
      tableToken: TABLE_T4_TOKEN,
      items: [{ menuItemId: ROLEX, quantity: 1, modifierIds: [] }],
      paymentMethod: "CASH_ON_DELIVERY",
    });
    if (!result.ok) throw new Error(result.error.message);

    expect(result.data).toMatchObject({
      itemsSubtotal: 8_000,
      modifiersTotal: 0,
      deliveryFee: 0,
      packagingFee: 0,
      totalAmount: 8_000,
      orderStatus: "CONFIRMED_UNPAID",
    });
  });

  it("snapshots combo selections without accepting a client price", async () => {
    const menu = fixtureMenuOrThrow();
    const tilapia = menu.items.find((item) => item.id === TILAPIA);
    if (!tilapia) throw new Error("tilapia missing");
    const step = tilapia.comboSteps[0];
    if (!step) throw new Error("tilapia combo steps missing");
    const option = step.options[0];
    if (!option) throw new Error("tilapia combo options missing");

    const result = await createOrderAction(
      deliveryPayload({
        items: [
          {
            menuItemId: TILAPIA,
            quantity: 1,
            modifierIds: [],
            comboSelections: tilapiaCombos(),
          },
        ],
      }),
    );
    if (!result.ok) throw new Error(result.error.message);

    expect(result.data.totalAmount).toBe(33_000);
    const stored = getFixtureOrderByToken(result.data.orderToken);
    expect(stored?.items[0]?.modifiers[0]?.name).toBe(
      `${step.name}: ${option.name}`,
    );
  });
});

describe("createOrderAction — idempotency and gates", () => {
  it("returns the original order for a same-payload replay", async () => {
    const payload = deliveryPayload();
    const first = await createOrderAction(payload);
    if (!first.ok) throw new Error(first.error.message);

    const second = await createOrderAction(payload);
    if (!second.ok) throw new Error(second.error.message);

    expect(second.data.orderToken).toBe(first.data.orderToken);
    expect(second.data.idempotent).toBe(true);
  });

  it("rejects a changed payload that reuses an idempotency key", async () => {
    const payload = deliveryPayload();
    const first = await createOrderAction(payload);
    if (!first.ok) throw new Error(first.error.message);

    const second = await createOrderAction({
      ...payload,
      customerName: "Someone Else",
    });
    if (second.ok) throw new Error("expected conflict");
    expect(second.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("returns STORE_CLOSED when the manual switch is off", async () => {
    const menu = fixtureMenuOrThrow();
    vi.mocked(getStorefrontMenu).mockResolvedValue({
      status: "ok",
      menu: {
        ...menu,
        settings: { ...menu.settings, isStoreOpen: false },
      },
    });

    const result = await createOrderAction(deliveryPayload());
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("STORE_CLOSED");
  });

  it("returns KITCHEN_PAUSED when intake is paused", async () => {
    const menu = fixtureMenuOrThrow();
    vi.mocked(getStorefrontMenu).mockResolvedValue({
      status: "ok",
      menu: {
        ...menu,
        settings: { ...menu.settings, isKitchenPaused: true },
      },
    });

    const result = await createOrderAction(deliveryPayload());
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("KITCHEN_PAUSED");
  });

  it("rejects a delivery below the minimum order value", async () => {
    const result = await createOrderAction(
      deliveryPayload({
        items: [{ menuItemId: WATER, quantity: 1, modifierIds: [] }],
      }),
    );
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("MOV_NOT_MET");
  });

  it("blocks a route beyond the 15 km delivery radius", async () => {
    const result = await createOrderAction(
      deliveryPayload({
        deliveryCoordinates: { lat: 0.0512, lng: 32.4637 },
      }),
    );
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("DISTANCE_OUT_OF_BOUNDS");
  });

  it("blocks cash on delivery beyond 8.1 km", async () => {
    const result = await createOrderAction(
      deliveryPayload({
        deliveryCoordinates: { lat: 0.36, lng: 32.62 },
        paymentMethod: "CASH_ON_DELIVERY",
        otpCode: "123456",
      }),
    );
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("COD_NOT_AVAILABLE");
  });

  it("rate limits the sixth checkout from one IP within a minute", async () => {
    for (let index = 0; index < 5; index += 1) {
      const result = await createOrderAction(
        deliveryPayload({
          idempotencyKey: randomUUID(),
          customerPhone: `07721234${50 + index}`,
        }),
      );
      if (!result.ok) throw new Error(result.error.message);
    }

    const sixth = await createOrderAction(deliveryPayload());
    if (sixth.ok) throw new Error("expected rate limit");
    expect(sixth.error.code).toBe("RATE_LIMITED");
  });
});

describe("createOrderAction — cash verification", () => {
  it("requires an OTP for a first-time cash customer", async () => {
    const result = await createOrderAction(
      deliveryPayload({
        customerPhone: "0772123459",
        paymentMethod: "CASH_ON_DELIVERY",
      }),
    );
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("OTP_REQUIRED");
  });

  it("rejects an incorrect OTP and accepts the fixture code", async () => {
    await sendCodOtpAction({ phone: "0772123459" });

    const wrong = await createOrderAction(
      deliveryPayload({
        customerPhone: "0772123459",
        paymentMethod: "CASH_ON_DELIVERY",
        otpCode: "000000",
      }),
    );
    if (wrong.ok) throw new Error("expected failure");
    expect(wrong.error.code).toBe("OTP_INVALID");

    const right = await createOrderAction(
      deliveryPayload({
        customerPhone: "0772123459",
        paymentMethod: "CASH_ON_DELIVERY",
        otpCode: "123456",
      }),
    );
    if (!right.ok) throw new Error(right.error.message);
    expect(right.data.totalAmount).toBe(35_000);
  });

  it("skips the OTP for a returning delivered customer", async () => {
    seedDeliveredCustomerForTests("0772123461");
    const result = await createOrderAction(
      deliveryPayload({
        customerPhone: "0772123461",
        paymentMethod: "CASH_ON_DELIVERY",
      }),
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.orderStatus).toBe("CONFIRMED_UNPAID");
  });
});

describe("payment attempts", () => {
  it("allocates a fresh tx_ref per retry and isolates late success", async () => {
    const created = await createOrderAction(deliveryPayload());
    if (!created.ok) throw new Error(created.error.message);

    const first = await initiatePaymentAction({
      orderToken: created.data.orderToken,
      method: "MTN_MOMO",
    });
    if (!first.ok) throw new Error(first.error.message);
    expect(first.data.txRef).toBe(`${created.data.orderToken}-1`);

    const second = await initiatePaymentAction({
      orderToken: created.data.orderToken,
      method: "MTN_MOMO",
    });
    if (!second.ok) throw new Error(second.error.message);
    expect(second.data.txRef).toBe(`${created.data.orderToken}-2`);

    const late = await completeMockPaymentAction({
      txRef: first.data.txRef,
      outcome: "success",
    });
    if (!late.ok) throw new Error(late.error.message);
    expect(late.data.applied).toBe(false);
    expect(late.data.reason).toBe("ATTEMPT_ABANDONED");
    expect(late.data.orderStatus).toBe("PENDING_PAYMENT");
    expect(fixtureRefundCount()).toBe(1);

    const current = await completeMockPaymentAction({
      txRef: second.data.txRef,
      outcome: "success",
    });
    if (!current.ok) throw new Error(current.error.message);
    expect(current.data.applied).toBe(true);
    expect(current.data.orderStatus).toBe("PREPARING");
    expect(current.data.paymentStatus).toBe("PAID");
  });

  it("rejects initiating payment for a cash order", async () => {
    seedDeliveredCustomerForTests("0772123462");
    const created = await createOrderAction(
      deliveryPayload({
        customerPhone: "0772123462",
        paymentMethod: "CASH_ON_DELIVERY",
      }),
    );
    if (!created.ok) throw new Error(created.error.message);

    const result = await initiatePaymentAction({
      orderToken: created.data.orderToken,
      method: "MTN_MOMO",
    });
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("PAYMENT_METHOD_UNAVAILABLE");
  });

  it("rejects a mismatched payment method", async () => {
    const created = await createOrderAction(deliveryPayload());
    if (!created.ok) throw new Error(created.error.message);

    const result = await initiatePaymentAction({
      orderToken: created.data.orderToken,
      method: "AIRTEL_MONEY",
    });
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("keeps the order pending after a declined mock payment", async () => {
    const created = await createOrderAction(deliveryPayload());
    if (!created.ok) throw new Error(created.error.message);

    const attempt = await initiatePaymentAction({
      orderToken: created.data.orderToken,
      method: "MTN_MOMO",
    });
    if (!attempt.ok) throw new Error(attempt.error.message);

    const declined = await completeMockPaymentAction({
      txRef: attempt.data.txRef,
      outcome: "failure",
    });
    if (!declined.ok) throw new Error(declined.error.message);
    expect(declined.data.applied).toBe(false);
    expect(declined.data.orderStatus).toBe("PENDING_PAYMENT");
    expect(declined.data.paymentStatus).toBe("PENDING");
  });
});

describe("expiry helper", () => {
  it("backdates orders for the timeout cron", async () => {
    const created = await createOrderAction(deliveryPayload());
    if (!created.ok) throw new Error(created.error.message);

    ageFixtureOrderForTests(created.data.orderToken, 11);
    const stored = getFixtureOrderByToken(created.data.orderToken);
    expect(stored).not.toBeNull();
    expect(new Date(stored?.createdAt ?? 0).getTime()).toBeLessThan(
      Date.now() - 10 * 60 * 1_000,
    );
  });
});
