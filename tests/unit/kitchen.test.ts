import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.9" }),
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
    getAll: () => [],
  }),
}));

vi.mock("@/lib/storefront/menu", async () => {
  const { createFixtureMenu } = await import("@/lib/storefront/fixture");
  return {
    getStorefrontMenu: vi.fn(async () => createFixtureMenu()),
  };
});

import { createOrderAction } from "@/actions/checkout";
import {
  createKitchenChime,
  shouldChime,
  unacknowledgedTicketIds,
  type AudioContextLike,
} from "@/lib/audio/chimes";
import {
  createFixtureSessionToken,
  verifyFixtureSessionToken,
} from "@/lib/auth/fixture-token";
import { toKitchenFailure } from "@/lib/kitchen/errors";
import { fixtureKitchenStore } from "@/lib/kitchen/fixture-store";
import {
  acceptFixtureOrder,
  bumpFixtureOrder,
  fixtureOrderStore,
  fixtureReprintCount,
  getFixtureKitchenTicket,
  listFixtureKitchenTickets,
  recordFixtureReprint,
  resetOrderStoreForTests,
} from "@/lib/orders/fixture-store";
import type { CreateOrderRpcInput } from "@/lib/orders/store-types";
import { OrderFailure } from "@/lib/orders/errors";
import { resetRouteCacheForTests } from "@/lib/routing/cache";
import { resetRateLimiterForTests } from "@/lib/routing/rate-limit";
import {
  createFixtureMenu,
  resetFixtureKitchenStateForTests,
  setFixtureItemAvailability,
} from "@/lib/storefront/fixture";

const TILAPIA = "22222222-2222-4222-8222-222222222201";
const WATER = "22222222-2222-4222-8222-222222222208";
const GARLIC_DIP = "44444444-4444-4444-8444-444444444401";

function fixtureMenuOrThrow() {
  const result = createFixtureMenu();
  if (result.status !== "ok") throw new Error("fixture menu unavailable");
  return result.menu;
}

function expectOrderCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(OrderFailure);
    expect((error as OrderFailure).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code} but no error was thrown`);
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

function orderInput(
  overrides: Partial<CreateOrderRpcInput> = {},
): CreateOrderRpcInput {
  return {
    idempotencyKey: randomUUID(),
    requestHash: `hash-${randomUUID()}`,
    customerName: "Kitchen Test",
    customerPhone: "+256772123456",
    customerNotes: null,
    orderType: "DINE_IN",
    tableId: null,
    deliveryAddressText: null,
    deliveryLatitude: null,
    deliveryLongitude: null,
    roadDistanceM: null,
    estimatedTravelMinutes: null,
    etaAt: null,
    paymentMethod: "CASH_ON_DELIVERY",
    codChangeRequestedFor: null,
    items: [{ menuItemId: WATER, quantity: 1, modifiers: [] }],
    ...overrides,
  };
}

function deliveryInput(
  overrides: Partial<CreateOrderRpcInput> = {},
): CreateOrderRpcInput {
  return orderInput({
    orderType: "DELIVERY",
    deliveryAddressText: "Nakasero Plot 12",
    deliveryLatitude: 0.3245,
    deliveryLongitude: 32.5782,
    roadDistanceM: 1_562,
    estimatedTravelMinutes: 4,
    etaAt: "2026-11-15T12:40:00.000Z",
    items: [
      {
        menuItemId: TILAPIA,
        quantity: 1,
        modifiers: [
          { modifierId: GARLIC_DIP },
          ...tilapiaCombos().map((selection) => ({
            comboOptionId: selection.optionId,
          })),
        ],
      },
    ],
    ...overrides,
  });
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
  resetRouteCacheForTests();
  resetRateLimiterForTests();
  resetFixtureKitchenStateForTests();
});

afterEach(() => {
  vi.useRealTimers();
  resetFixtureKitchenStateForTests();
});

describe("kitchen ticket contract", () => {
  it("returns only active tickets without phone or handover PIN", async () => {
    const created = await fixtureOrderStore.createOrder(orderInput());
    const tickets = listFixtureKitchenTickets();

    expect(tickets).toHaveLength(1);
    const ticket = tickets[0]!;
    expect(ticket.orderId).toBe(created.orderId);
    expect(ticket.status).toBe("CONFIRMED_UNPAID");
    expect(ticket).not.toHaveProperty("customerPhone");
    expect(ticket).not.toHaveProperty("handoverPin");
    expect(ticket).not.toHaveProperty("paymentReference");
  });

  it("accepts only CONFIRMED_UNPAID and bumps dine-in to DELIVERED", async () => {
    const created = await fixtureOrderStore.createOrder(orderInput());
    const orderId = created.orderId;

    expectOrderCode(() => bumpFixtureOrder(orderId), "ORDER_STATE_INVALID");

    acceptFixtureOrder(orderId);
    const accepted = getFixtureKitchenTicket(orderId);
    expect(accepted).toMatchObject({ status: "PREPARING" });
    expect(accepted?.acknowledgedAt).toBeTruthy();

    expectOrderCode(() => acceptFixtureOrder(orderId), "ORDER_STATE_INVALID");

    expect(bumpFixtureOrder(orderId)).toBe("DELIVERED");
    expect(listFixtureKitchenTickets()).toHaveLength(0);
  });

  it("bumps a delivery ticket to READY_FOR_PICKUP and keeps it on the board", async () => {
    const created = await fixtureOrderStore.createOrder(deliveryInput());
    acceptFixtureOrder(created.orderId);
    expect(bumpFixtureOrder(created.orderId)).toBe("READY_FOR_PICKUP");

    const ticket = getFixtureKitchenTicket(created.orderId);
    expect(ticket).toMatchObject({ status: "READY_FOR_PICKUP" });
    expect(ticket?.readyAt).toBeTruthy();
    expect(listFixtureKitchenTickets()).toHaveLength(1);
  });

  it("maps store errors onto the kitchen envelope", () => {
    expect(toKitchenFailure(new Error("ORDER_STATE_INVALID"))).toMatchObject({
      ok: false,
      error: { code: "ORDER_STATE_INVALID" },
    });
    expect(toKitchenFailure(new Error("ORDER_STATE_INVALID: changed"))).toMatchObject(
      { ok: false, error: { code: "ORDER_STATE_INVALID" } },
    );
    expect(toKitchenFailure(new Error("boom"))).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("audits each reprinted docket", async () => {
    const created = await fixtureOrderStore.createOrder(orderInput());
    recordFixtureReprint(created.orderId);
    recordFixtureReprint(created.orderId);
    await fixtureKitchenStore.auditReprint(created.orderId);

    expect(fixtureReprintCount(created.orderId)).toBe(3);
  });
});

describe("86 propagation and service mode", () => {
  it("hides a sold-out item from the storefront without changing open tickets", async () => {
    const created = await fixtureOrderStore.createOrder(deliveryInput());
    const before = getFixtureKitchenTicket(created.orderId);

    await fixtureKitchenStore.setItemAvailability(TILAPIA, false);

    const menu = fixtureMenuOrThrow();
    expect(menu.items.find((item) => item.id === TILAPIA)?.isAvailable).toBe(
      false,
    );

    const after = getFixtureKitchenTicket(created.orderId);
    expect(after?.items).toEqual(before?.items);
    expect(after?.totalAmount).toBe(before?.totalAmount);

    await fixtureKitchenStore.setItemAvailability(TILAPIA, true);
    expect(
      fixtureMenuOrThrow().items.find((item) => item.id === TILAPIA)
        ?.isAvailable,
    ).toBe(true);
  });

  it("reports ITEM_NOT_FOUND for an unknown menu item", async () => {
    setFixtureItemAvailability(TILAPIA, true);
    await expect(
      fixtureKitchenStore.setItemAvailability(
        "99999999-9999-4999-8999-999999999999",
        true,
      ),
    ).rejects.toThrow(/ITEM_NOT_FOUND/);
  });

  it("applies busy mode to new orders only", async () => {
    const created = await fixtureOrderStore.createOrder(deliveryInput());
    const before = getFixtureKitchenTicket(created.orderId);

    await fixtureKitchenStore.setBusy(true, 30);

    expect(await fixtureKitchenStore.getSettings()).toEqual({
      isKitchenBusy: true,
      busyBufferMinutes: 30,
      isKitchenPaused: false,
    });

    const after = getFixtureKitchenTicket(created.orderId);
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(after?.acknowledgedAt).toBe(before?.acknowledgedAt);
    expect(after?.totalAmount).toBe(before?.totalAmount);

    const later = await fixtureOrderStore.createOrder(deliveryInput());
    expect(later.totalAmount).toBe(created.totalAmount);
  });

  it("pauses new intake while existing tickets stay untouched", async () => {
    const created = await fixtureOrderStore.createOrder(deliveryInput());
    const before = getFixtureKitchenTicket(created.orderId);

    await fixtureKitchenStore.setPaused(true);
    expect((await fixtureKitchenStore.getSettings()).isKitchenPaused).toBe(true);

    const attempt = await createOrderAction({
      idempotencyKey: randomUUID(),
      customerName: "Sarah Paused",
      customerPhone: "0772123499",
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

    expect(attempt).toMatchObject({
      ok: false,
      error: { code: "KITCHEN_PAUSED" },
    });

    const after = getFixtureKitchenTicket(created.orderId);
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(after?.status).toBe("CONFIRMED_UNPAID");
    expect(after?.totalAmount).toBe(before?.totalAmount);
  });
});

describe("kitchen chime", () => {
  function fakeAudio() {
    const oscillators: Array<{ start: ReturnType<typeof vi.fn> }> = [];

    const context: AudioContextLike = {
      currentTime: 0,
      state: "suspended",
      destination: {},
      resume: vi.fn(async () => {
        context.state = "running";
      }),
      close: vi.fn(async () => undefined),
      createOscillator: vi.fn(() => {
        const oscillator = {
          type: "sine",
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscillators.push(oscillator);
        return oscillator;
      }),
      createGain: vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      })),
    };

    return { context, oscillators };
  }

  it("does not play before the shift gesture and repeats only while waiting", async () => {
    vi.useFakeTimers();
    const { context, oscillators } = fakeAudio();
    const chime = createKitchenChime({
      intervalMs: 1_000,
      createContext: () => context,
    });

    chime.start();
    chime.playOnce();
    expect(oscillators).toHaveLength(0);
    expect(chime.isUnlocked()).toBe(false);

    await expect(chime.unlock()).resolves.toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(chime.isUnlocked()).toBe(true);
    // The confirmation tone proves the shift gesture took effect.
    expect(oscillators).toHaveLength(1);

    chime.start();
    // Two notes per chime.
    expect(oscillators).toHaveLength(3);

    // Polling re-evaluates the same waiting tickets; start() must not stack.
    chime.start();
    expect(oscillators).toHaveLength(3);

    vi.advanceTimersByTime(1_000);
    expect(oscillators).toHaveLength(5);

    chime.stop();
    vi.advanceTimersByTime(5_000);
    expect(oscillators).toHaveLength(5);

    chime.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(chime.isUnlocked()).toBe(false);
  });

  it("chimes only for unacknowledged unpaid tickets", async () => {
    const created = await fixtureOrderStore.createOrder(orderInput());

    const waiting = listFixtureKitchenTickets();
    expect(shouldChime(waiting)).toBe(true);
    expect(unacknowledgedTicketIds(waiting)).toEqual([created.orderId]);

    acceptFixtureOrder(created.orderId);
    const accepted = listFixtureKitchenTickets();
    expect(shouldChime(accepted)).toBe(false);
    expect(unacknowledgedTicketIds(accepted)).toEqual([]);
  });
});

describe("fixture staff session token", () => {
  const session = {
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
    fullName: "Chef Musa",
    phone: "+256700111001",
    role: "KITCHEN" as const,
    mustChangePin: false,
  };

  it("signs and verifies a staff session", async () => {
    const token = await createFixtureSessionToken(session);
    const verified = await verifyFixtureSessionToken(token);

    expect(verified).toMatchObject(session);
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1_000));
  });

  it("rejects tampered and expired tokens", async () => {
    const token = await createFixtureSessionToken(session);
    const tampered = `${token.slice(0, -1)}${
      token.endsWith("A") ? "B" : "A"
    }`;

    expect(await verifyFixtureSessionToken(tampered)).toBeNull();
    expect(await verifyFixtureSessionToken(undefined)).toBeNull();
    expect(await verifyFixtureSessionToken("not-a-token")).toBeNull();

    const thirteenHours = Date.now() + 13 * 60 * 60 * 1_000;
    expect(await verifyFixtureSessionToken(token, thirteenHours)).toBeNull();
  });
});
