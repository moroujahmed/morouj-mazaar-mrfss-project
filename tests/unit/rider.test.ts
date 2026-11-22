import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  acceptFixtureOrder,
  bumpFixtureOrder,
  fixtureOrderStore,
  getFixtureOrderByToken,
  resetOrderStoreForTests,
} from "@/lib/orders/fixture-store";
import type { CreateOrderRpcInput } from "@/lib/orders/store-types";
import { toRiderFailure } from "@/lib/rider/errors";
import {
  createFixtureRiderStore,
  resetRiderStoreForTests,
} from "@/lib/rider/fixture-store";
import {
  appendTelemetryPoint,
  clearTelemetryQueue,
  deleteTelemetryPoints,
  enqueueTelemetryPoint,
  isDuplicateTelemetryPoint,
  MAX_QUEUE_POINTS,
  pruneTelemetryPoints,
  readTelemetryQueue,
  resetTelemetryQueueForTests,
  type QueuedTelemetryPoint,
} from "@/lib/rider/telemetry-queue";
import {
  pinLockMessage,
  requiresConnectionForHandover,
  riderPinResultSchema,
  riderPoolArraySchema,
  riderSnapshotSchema,
} from "@/lib/rider/types";

const WATER = "22222222-2222-4222-8222-222222222208";
const RIDER_JUMA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03";
const RIDER_DAVID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04";

const DELIVERY_LAT = 0.3245;
const DELIVERY_LNG = 32.5782;

function deliveryInput(
  overrides: Partial<CreateOrderRpcInput> = {},
): CreateOrderRpcInput {
  return {
    idempotencyKey: randomUUID(),
    requestHash: `hash-${randomUUID()}`,
    customerName: "Rider Test",
    customerPhone: "+256772123456",
    customerNotes: null,
    orderType: "DELIVERY",
    tableId: null,
    deliveryAddressText: "Nakasero Plot 12, ground floor",
    deliveryLatitude: DELIVERY_LAT,
    deliveryLongitude: DELIVERY_LNG,
    roadDistanceM: 1_562,
    estimatedTravelMinutes: 4,
    etaAt: "2026-11-20T12:40:00.000Z",
    paymentMethod: "CASH_ON_DELIVERY",
    codChangeRequestedFor: 50_000,
    // Ten waters reach the USh 20,000 delivery minimum without combo steps.
    items: [{ menuItemId: WATER, quantity: 10, modifiers: [] }],
    ...overrides,
  };
}

async function createReadyOrder(overrides: Partial<CreateOrderRpcInput> = {}) {
  const created = await fixtureOrderStore.createOrder(deliveryInput(overrides));
  acceptFixtureOrder(created.orderId);
  expect(bumpFixtureOrder(created.orderId)).toBe("READY_FOR_PICKUP");
  return created;
}

async function startRiderOrder(
  store: ReturnType<typeof createFixtureRiderStore>,
  orderId: string,
) {
  await store.claimOrder(orderId);
  return store.startDelivery(orderId);
}

beforeEach(() => {
  resetOrderStoreForTests();
  resetRiderStoreForTests();
  resetTelemetryQueueForTests();
});

describe("rider pool and claim contract", () => {
  it("exposes only safe summaries and no customer contact or PIN", async () => {
    const created = await createReadyOrder();
    const store = createFixtureRiderStore(RIDER_JUMA);

    const pool = await store.listPool();
    expect(pool).toHaveLength(1);
    const item = pool[0]!;

    expect(Object.keys(item).sort()).toEqual([
      "area",
      "distanceKm",
      "itemCount",
      "orderId",
      "orderNumber",
      "paymentMethod",
      "readyAt",
      "totalAmount",
    ]);
    expect(item.orderId).toBe(created.orderId);
    expect(item.itemCount).toBe(10);
    expect(item.distanceKm).toBe(1.56);
    // The fixture has no coarse delivery area, so it must not fall back to the
    // street address that the customer typed.
    expect(item.area).toBeNull();
    expect(item).not.toHaveProperty("customerPhone");
    expect(item).not.toHaveProperty("customerName");
    expect(item).not.toHaveProperty("deliveryAddressText");
    expect(item).not.toHaveProperty("handoverPin");
    expect(item).not.toHaveProperty("customerNotes");
  });

  it("claims one delivery at a time and starts the trip once", async () => {
    const first = await createReadyOrder();
    const second = await createReadyOrder();
    const store = createFixtureRiderStore(RIDER_JUMA);

    const claimed = await store.claimOrder(first.orderId);
    expect(claimed).toMatchObject({
      orderId: first.orderId,
      status: "CLAIMED",
      customerPhone: "+256772123456",
    });
    expect(claimed).not.toHaveProperty("handoverPin");

    await expect(store.claimOrder(second.orderId)).rejects.toMatchObject({
      code: "RIDER_HAS_ACTIVE_ORDER",
    });

    const started = await store.startDelivery(first.orderId);
    expect(started.status).toBe("OUT_FOR_DELIVERY");
    expect(started.dispatchedAt).toBeTruthy();

    await expect(store.startDelivery(first.orderId)).rejects.toMatchObject({
      code: "ORDER_STATE_INVALID",
    });
  });

  it("never lets another rider act on someone else's delivery", async () => {
    const created = await createReadyOrder();
    const juma = createFixtureRiderStore(RIDER_JUMA);
    const david = createFixtureRiderStore(RIDER_DAVID);

    await juma.claimOrder(created.orderId);
    await juma.startDelivery(created.orderId);

    await expect(david.startDelivery(created.orderId)).rejects.toMatchObject({
      code: "ORDER_STATE_INVALID",
    });
    await expect(
      david.verifyPin({ orderId: created.orderId, pin: "1234" }),
    ).rejects.toMatchObject({ code: "AUTH_UNAUTHORIZED" });
    await expect(
      david.updateTelemetry({
        orderId: created.orderId,
        latitude: DELIVERY_LAT,
        longitude: DELIVERY_LNG,
      }),
    ).rejects.toMatchObject({ code: "ORDER_STATE_INVALID" });
    expect(await david.getActiveOrder()).toBeNull();
  });

  it("releases a claimed delivery back to the pool", async () => {
    const created = await createReadyOrder();
    const store = createFixtureRiderStore(RIDER_JUMA);

    await store.claimOrder(created.orderId);
    await store.releaseOrder(created.orderId, "Bike would not start");

    expect(await store.getActiveOrder()).toBeNull();
    expect((await store.listPool()).map((item) => item.orderId)).toContain(
      created.orderId,
    );
    const order = getFixtureOrderByToken(created.orderToken);
    expect(order?.status).toBe("READY_FOR_PICKUP");
    expect(order?.riderId).toBeNull();
  });
});

describe("handover PIN", () => {
  it("locks after three wrong attempts and stays locked for the rider", async () => {
    const created = await createReadyOrder();
    const store = createFixtureRiderStore(RIDER_JUMA);
    await startRiderOrder(store, created.orderId);

    const first = await store.verifyPin({
      orderId: created.orderId,
      pin: "0000",
    });
    expect(first).toMatchObject({
      ok: false,
      code: "INVALID_HANDOVER_PIN",
      remainingAttempts: 2,
    });

    const second = await store.verifyPin({
      orderId: created.orderId,
      pin: "0000",
    });
    expect(second).toMatchObject({
      ok: false,
      code: "INVALID_HANDOVER_PIN",
      remainingAttempts: 1,
    });

    const third = await store.verifyPin({
      orderId: created.orderId,
      pin: "0000",
    });
    expect(third).toMatchObject({
      ok: false,
      code: "PIN_LOCKED",
      remainingAttempts: 0,
    });
    expect((third as { lockedUntil?: string }).lockedUntil).toBeTruthy();

    const order = getFixtureOrderByToken(created.orderToken);
    const correct = order?.handoverPin ?? "";
    const whileLocked = await store.verifyPin({
      orderId: created.orderId,
      pin: correct,
    });
    expect(whileLocked).toMatchObject({ ok: false, code: "PIN_LOCKED" });
    expect(order?.status).toBe("OUT_FOR_DELIVERY");
  });

  it("rejects a handover outside the geofence without spending an attempt", async () => {
    const created = await createReadyOrder();
    const store = createFixtureRiderStore(RIDER_JUMA);
    await startRiderOrder(store, created.orderId);

    const order = getFixtureOrderByToken(created.orderToken);
    const correct = order?.handoverPin ?? "";

    const tooFar = await store.verifyPin({
      orderId: created.orderId,
      pin: correct,
      latitude: 0.4,
      longitude: 32.7,
    });
    expect(tooFar).toMatchObject({
      ok: false,
      code: "TOO_FAR_FROM_DESTINATION",
      allowedM: 300,
    });
    expect((tooFar as { distanceM?: number }).distanceM).toBeGreaterThan(300);

    const delivered = await store.verifyPin({
      orderId: created.orderId,
      pin: correct,
      latitude: DELIVERY_LAT,
      longitude: DELIVERY_LNG,
    });
    expect(delivered).toMatchObject({ ok: true, code: "DELIVERED" });
    expect((delivered as { changeDue?: number | null }).changeDue).toBe(
      order?.codChangeDue,
    );

    expect(getFixtureOrderByToken(created.orderToken)?.status).toBe("DELIVERED");
    expect(await store.getActiveOrder()).toBeNull();
  });

  it("marks a cash delivery paid and adds it to the cash summary", async () => {
    const created = await createReadyOrder();
    const store = createFixtureRiderStore(RIDER_JUMA);
    await startRiderOrder(store, created.orderId);

    const order = getFixtureOrderByToken(created.orderToken);
    const delivered = await store.verifyPin({
      orderId: created.orderId,
      pin: order?.handoverPin ?? "",
    });
    expect(delivered.ok).toBe(true);

    const updated = getFixtureOrderByToken(created.orderToken);
    expect(updated?.paymentStatus).toBe("PAID");
    expect(updated?.codChangeDue).toBe(50_000 - created.totalAmount);

    const cash = await store.getCashSummary();
    expect(cash.outstandingCash).toBe(created.totalAmount);
    expect(cash.unsettledOrderCash).toBe(created.totalAmount);
    expect(cash.totalSettled).toBe(0);
  });

  it("reports a failed delivery without completing or paying it", async () => {
    const created = await createReadyOrder();
    const store = createFixtureRiderStore(RIDER_DAVID);
    await startRiderOrder(store, created.orderId);

    await store.reportFailed(
      created.orderId,
      "CUSTOMER_UNREACHABLE",
      "Customer did not answer the gate phone",
    );

    const order = getFixtureOrderByToken(created.orderToken);
    expect(order?.status).toBe("DELIVERY_FAILED");
    expect(order?.paymentStatus).not.toBe("PAID");
    expect(await store.getActiveOrder()).toBeNull();
    expect((await store.getCashSummary()).outstandingCash).toBe(0);
    expect((await store.listPool()).map((item) => item.orderId)).not.toContain(
      created.orderId,
    );
  });
});

describe("rider shift", () => {
  it("opens once, closes with expected cash, and rejects a second close", async () => {
    const created = await createReadyOrder();
    const store = createFixtureRiderStore(RIDER_JUMA);

    expect((await store.getShift()).isOpen).toBe(false);

    const shift = await store.startShift(20_000);
    expect(shift).toMatchObject({ isOpen: true, openingFloat: 20_000 });
    expect((await store.getShift()).isOpen).toBe(true);

    await expect(store.startShift(0)).rejects.toMatchObject({
      code: "SHIFT_ALREADY_OPEN",
    });

    await startRiderOrder(store, created.orderId);
    const order = getFixtureOrderByToken(created.orderToken);
    await store.verifyPin({
      orderId: created.orderId,
      pin: order?.handoverPin ?? "",
    });

    const ended = await store.endShift();
    expect(ended).toMatchObject({
      isOpen: false,
      expectedCash: created.totalAmount,
    });
    expect((await store.getShift()).isOpen).toBe(false);
    await expect(store.endShift()).rejects.toMatchObject({
      code: "SHIFT_NOT_OPEN",
    });
  });
});

describe("telemetry queue", () => {
  const base = Date.parse("2026-11-20T10:00:00.000Z");

  function point(
    latitude: number,
    offsetMs: number,
  ): { latitude: number; longitude: number; recordedAt: string } {
    return {
      latitude,
      longitude: 32.58,
      recordedAt: new Date(base + offsetMs).toISOString(),
    };
  }

  function queued(
    latitude: number,
    offsetMs: number,
    sequence: number,
  ): QueuedTelemetryPoint {
    return {
      ...point(latitude, offsetMs),
      orderId: "order-1",
      sequence,
    };
  }

  it("drops stale points and keeps at most fifty", () => {
    const stale = queued(1, -11 * 60 * 1_000, 1);
    const fresh = Array.from({ length: 60 }, (_, index) =>
      queued(index / 1_000, index * 1_000, index + 2),
    );

    const pruned = pruneTelemetryPoints([stale, ...fresh], base + 60_000);
    expect(pruned).toHaveLength(MAX_QUEUE_POINTS);
    expect(pruned[0]?.sequence).toBe(12);
    expect(pruned.at(-1)?.sequence).toBe(61);
    expect(pruned).not.toContainEqual(stale);
  });

  it("drops duplicate fixes inside five seconds but keeps later ones", () => {
    const first = queued(0.3245, 0, 0);

    expect(isDuplicateTelemetryPoint([first], point(0.3245, 4_000))).toBe(true);
    expect(isDuplicateTelemetryPoint([first], point(0.3245, 5_001))).toBe(false);
    expect(isDuplicateTelemetryPoint([first], point(0.3246, 1_000))).toBe(false);
  });

  it("appends with increasing sequence numbers", () => {
    const one = appendTelemetryPoint([], "order-1", point(0.1, 0), base);
    const duplicate = appendTelemetryPoint(
      one,
      "order-1",
      point(0.1, 4_000),
      base + 4_000,
    );
    expect(duplicate).toHaveLength(1);
    expect(duplicate[0]?.sequence).toBe(1);

    const two = appendTelemetryPoint(
      duplicate,
      "order-1",
      point(0.2, 6_000),
      base + 6_000,
    );
    expect(two.map((entry) => entry.sequence)).toEqual([1, 2]);
  });

  it("stores, replays, and clears points per order", async () => {
    await enqueueTelemetryPoint("order-a", point(0.1, 0), base);
    await enqueueTelemetryPoint("order-a", point(0.2, 10_000), base + 10_000);
    await enqueueTelemetryPoint("order-b", point(0.3, 0), base);

    const queue = await readTelemetryQueue("order-a");
    expect(queue).toHaveLength(2);
    expect(queue.map((entry) => entry.sequence)).toEqual([1, 2]);

    await deleteTelemetryPoints([queue[0]!.key]);
    expect(await readTelemetryQueue("order-a")).toHaveLength(1);

    await clearTelemetryQueue("order-a");
    expect(await readTelemetryQueue("order-a")).toHaveLength(0);
    expect(await readTelemetryQueue("order-b")).toHaveLength(1);
  });
});

describe("rider contracts and messages", () => {
  it("strips unknown pool fields such as phone and PIN", () => {
    const parsed = riderPoolArraySchema.parse([
      {
        orderId: "00000000-0000-4000-8000-000000000001",
        orderNumber: 1043,
        area: null,
        distanceKm: 1.56,
        totalAmount: 35_000,
        paymentMethod: "CASH_ON_DELIVERY",
        itemCount: 2,
        readyAt: "2026-11-20T10:00:00.000Z",
        customerPhone: "+256772123456",
        handoverPin: "1234",
      },
    ]);

    expect(parsed[0]).not.toHaveProperty("customerPhone");
    expect(parsed[0]).not.toHaveProperty("handoverPin");
  });

  it("accepts the nullable handover change and rejects a missing outcome", () => {
    expect(
      riderPinResultSchema.safeParse({
        ok: true,
        code: "DELIVERED",
        changeDue: null,
        deliveredAt: "2026-11-20T10:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(riderPinResultSchema.safeParse({ ok: true }).success).toBe(false);
  });

  it("builds a complete empty snapshot", () => {
    const snapshot = riderSnapshotSchema.parse({
      pool: [],
      active: null,
      shift: { isOpen: false, shiftId: null, openingFloat: 0 },
      cash: { outstandingCash: 0 },
      fetchedAt: "2026-11-20T10:00:00.000Z",
    });

    expect(snapshot.cash).toMatchObject({
      outstandingCash: 0,
      unsettledOrderCash: 0,
      settlementShortfall: 0,
      totalSettled: 0,
    });
    expect(snapshot.shift.isOpen).toBe(false);
  });

  it("maps failures and explains the offline and lock states", () => {
    expect(toRiderFailure({ code: "RIDER_HAS_ACTIVE_ORDER" })).toMatchObject({
      ok: false,
      error: { code: "RIDER_HAS_ACTIVE_ORDER" },
    });
    expect(toRiderFailure(new Error("ORDER_STATE_INVALID: changed"))).toMatchObject(
      { ok: false, error: { code: "ORDER_STATE_INVALID" } },
    );
    expect(toRiderFailure(new Error("boom"))).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });

    expect(requiresConnectionForHandover(true)).toBe(false);
    expect(requiresConnectionForHandover(false)).toBe(true);
    expect(pinLockMessage(null)).toContain("Ask the manager to reset");
    expect(pinLockMessage("not-a-date")).toContain("Ask the manager to reset");
    expect(pinLockMessage("2026-11-20T10:30:00.000Z")).toContain(
      "Handover locked until",
    );
  });
});
