import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { createFixtureAdminStore, resetAdminFixtureForTests } from "@/lib/admin/fixture-store";
import { toAdminFailure } from "@/lib/admin/errors";
import {
  orderActionSchema,
  settingsPatchSchema,
  updateStaffSchema,
  upsertMenuItemSchema,
  upsertTableSchema,
} from "@/lib/admin/schemas";
import {
  acceptFixtureOrder,
  bumpFixtureOrder,
  fixtureOrderStore,
  getFixtureOrderByToken,
  reportFixtureRiderFailure,
  resetOrderStoreForTests,
} from "@/lib/orders/fixture-store";
import type { CreateOrderRpcInput } from "@/lib/orders/store-types";
import { createFixtureRiderStore, resetRiderStoreForTests } from "@/lib/rider/fixture-store";
import { resetFixtureKitchenStateForTests, createFixtureSettings } from "@/lib/storefront/fixture";

const WATER = "22222222-2222-4222-8222-222222222208";
const RIDER_JUMA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03";
const ADMIN_KASULE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01";

function deliveryInput(overrides: Partial<CreateOrderRpcInput> = {}): CreateOrderRpcInput {
  return {
    idempotencyKey: randomUUID(),
    requestHash: `hash-${randomUUID()}`,
    customerName: "Admin Test",
    customerPhone: "+256772123456",
    customerNotes: null,
    orderType: "DELIVERY",
    tableId: null,
    deliveryAddressText: "Nakasero Plot 12, ground floor",
    deliveryLatitude: 0.3245,
    deliveryLongitude: 32.5782,
    roadDistanceM: 1_562,
    estimatedTravelMinutes: 4,
    etaAt: "2026-11-20T12:40:00.000Z",
    paymentMethod: "CASH_ON_DELIVERY",
    codChangeRequestedFor: null,
    items: [{ menuItemId: WATER, quantity: 10, modifiers: [] }],
    ...overrides,
  };
}

/**
 * Build a prepaid order that is PAID but still cancellable (PREPARING).
 * `admin_cancel_order` rejects terminal DELIVERED/CANCELLED orders, so the
 * refund-on-cancel case must use a non-terminal paid order.
 */
async function paidPendingOrder() {
  const created = await fixtureOrderStore.createOrder(
    deliveryInput({ paymentMethod: "MTN_MOMO" }),
  );
  const attempt = await fixtureOrderStore.startPaymentAttempt({
    orderToken: created.orderToken,
    method: "MTN_MOMO",
    provider: "mock",
  });
  await fixtureOrderStore.finalizePaymentAttempt({
    txRef: attempt.txRef,
    success: true,
    providerTransactionId: `mock-${randomUUID()}`,
  });
  return created;
}

/**
 * Build a delivered COD order assigned to Juma. The total is forced to the
 * canonical fixture amount so the ledger exercise mirrors the documented
 * USh 65,500 example (#1043 38,000 + #1047 27,500).
 */
async function deliveredCodOrder(total?: number) {
  const created = await fixtureOrderStore.createOrder(deliveryInput());
  acceptFixtureOrder(created.orderId);
  expect(bumpFixtureOrder(created.orderId)).toBe("READY_FOR_PICKUP");
  const rider = createFixtureRiderStore(RIDER_JUMA);
  await rider.claimOrder(created.orderId);

  const token = created.orderToken;
  if (total !== undefined) {
    const order = getFixtureOrderByToken(token);
    if (!order) throw new Error("fixture order missing");
    order.total = total;
  }
  const { setFixtureOrderStatusForTests } = await import("@/lib/orders/fixture-store");
  expect(setFixtureOrderStatusForTests(token, "DELIVERED")).toBe(true);
  return created;
}

beforeEach(() => {
  resetOrderStoreForTests();
  resetRiderStoreForTests();
  resetFixtureKitchenStateForTests();
  resetAdminFixtureForTests();
});

describe("admin snapshot and audit contract", () => {
  it("returns every panel from a single snapshot", async () => {
    const snapshot = await createFixtureAdminStore().snapshot();

    expect(snapshot.settings.restaurantName).toBe("Bazaar Flame & Grill");
    expect(snapshot.menu.length).toBeGreaterThan(0);
    expect(snapshot.staff).toHaveLength(4);
    expect(snapshot.tables).toHaveLength(8);
    expect(snapshot.audit).toEqual([]);
    expect(snapshot.refunds).toEqual([]);
    expect(Date.parse(snapshot.fetchedAt)).toBeGreaterThan(0);
  });

  it("writes an audit row with the reason for every fixture mutation", async () => {
    const store = createFixtureAdminStore();
    const table = snapshotTable(await store.snapshot());

    await store.upsertTable(
      { tableNumber: table.tableNumber, label: "Renamed", isActive: true },
      "Front-of-house rename",
    );
    await store.updateSettings({ maxCartLines: 40 }, "More lines per cart");
    await store.updateStaff(
      { profileId: RIDER_JUMA, role: "RIDER", isActive: true, motorcyclePlate: "UFD 999Z" },
      "Replacement plate issued",
    );

    const feed = await store.auditFeed({ limit: 50 });
    expect(feed.total).toBe(3);
    for (const event of feed.events) {
      expect(event.actorId).toBe(ADMIN_KASULE);
      expect(event.reason?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(event.action).toMatch(/^ADMIN_/);
    }
    expect(feed.events.map((event) => event.action)).toEqual(
      expect.arrayContaining(["ADMIN_UPSERT_TABLE", "ADMIN_UPDATE_SETTINGS", "ADMIN_UPDATE_STAFF"]),
    );
  });

  it("maps RPC and fixture failures to the documented codes", () => {
    expect(toAdminFailure(new Error("LAST_ADMIN_PROTECTED"))).toMatchObject({
      ok: false,
      error: { code: "LAST_ADMIN_PROTECTED" },
    });
    expect(toAdminFailure({ code: "SOMETHING" })).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });
});

function snapshotTable(snapshot: Awaited<ReturnType<ReturnType<typeof createFixtureAdminStore>["snapshot"]>>) {
  const table = snapshot.tables[0];
  if (!table) throw new Error("no fixture tables");
  return table;
}

describe("settings and schemas", () => {
  it("requires a real reason and rejects out-of-bounds settings", () => {
    expect(
      settingsPatchSchema.safeParse({ maxCartLines: 40, reason: "no" }).success,
    ).toBe(false);
    expect(
      settingsPatchSchema.safeParse({ maxCartLines: 40, reason: "Raise the cart limit" }).success,
    ).toBe(true);
    expect(
      settingsPatchSchema.safeParse({ maxCartLines: 500, reason: "Raise the cart limit" }).success,
    ).toBe(false);
    expect(
      settingsPatchSchema.safeParse({ reason: "Raise the cart limit" }).success,
    ).toBe(false);
  });

  it("propagates an admin settings edit to the storefront fixture", async () => {
    const store = createFixtureAdminStore();
    await store.updateSettings({ minimumOrderValue: 25_000 }, "New delivery minimum");
    expect(createFixtureSettings().minimumOrderValue).toBe(25_000);

    const before = await store.snapshot();
    expect(before.settings.minimumOrderValue).toBe(25_000);
    const history = await store.auditFeed({ entityType: "app_settings" });
    expect(history.events).toHaveLength(1);
    expect(history.events[0]?.reason).toBe("New delivery minimum");
  });
});

describe("staff management", () => {
  it("refuses to demote or deactivate the last active admin", async () => {
    const store = createFixtureAdminStore();
    const input = {
      profileId: ADMIN_KASULE,
      role: "KITCHEN" as const,
      isActive: true,
      reason: "Stand-down after handover",
    };
    expect(updateStaffSchema.safeParse(input).success).toBe(true);
    await expect(
      store.updateStaff(input, input.reason),
    ).rejects.toMatchObject({ code: "LAST_ADMIN_PROTECTED" });

    await expect(
      store.updateStaff(
        { profileId: ADMIN_KASULE, role: "ADMIN", isActive: false },
        "Retire the account",
      ),
    ).rejects.toMatchObject({ code: "LAST_ADMIN_PROTECTED" });
  });

  it("updates a rider role, active state, and plate with an audit", async () => {
    const store = createFixtureAdminStore();
    const updated = await store.updateStaff(
      {
        profileId: RIDER_JUMA,
        role: "RIDER",
        isActive: false,
        motorcyclePlate: "UFD 001X",
      },
      "Bike impounded pending documents",
    );
    expect(updated).toMatchObject({
      role: "RIDER",
      isActive: false,
      motorcyclePlate: "UFD 001X",
    });

    const feed = await store.auditFeed({ entityType: "profiles" });
    expect(feed.events).toHaveLength(1);
    expect(feed.events[0]?.reason).toBe("Bike impounded pending documents");
  });
});

describe("order actions", () => {
  it("creates a refund request only when a paid order is cancelled", async () => {
    const store = createFixtureAdminStore();
    const paid = await paidPendingOrder();

    await store.cancelOrder(paid.orderId, "Customer cancelled after payment");
    let snapshot = await store.snapshot();
    expect(snapshot.refunds).toHaveLength(1);
    expect(snapshot.refunds[0]).toMatchObject({
      orderId: paid.orderId,
      amount: paid.totalAmount,
      status: "REQUESTED",
    });
    expect(snapshot.orders.find((order) => order.orderId === paid.orderId)?.status).toBe("CANCELLED");

    const unpaid = await fixtureOrderStore.createOrder(deliveryInput());
    await store.cancelOrder(unpaid.orderId, "Duplicate order removed");
    snapshot = await store.snapshot();
    expect(snapshot.refunds).toHaveLength(1);

    const feed = await store.auditFeed({ entityType: "orders" });
    expect(feed.events.filter((event) => event.action === "ADMIN_CANCEL_ORDER")).toHaveLength(2);
  });

  it("reassigns an active rider and audits the change", async () => {
    const store = createFixtureAdminStore();
    const created = await fixtureOrderStore.createOrder(deliveryInput());
    acceptFixtureOrder(created.orderId);
    expect(bumpFixtureOrder(created.orderId)).toBe("READY_FOR_PICKUP");

    const result = await store.reassignOrder(
      created.orderId,
      RIDER_JUMA,
      "Original rider unavailable",
    );
    expect(result).toEqual({ orderId: created.orderId, riderId: RIDER_JUMA });

    const detail = await store.getOrder(created.orderId);
    expect(detail.status).toBe("CLAIMED");
    expect(detail.riderName).toBe("Rider Juma");
    const feed = await store.auditFeed({ entityType: "orders" });
    expect(feed.events[0]).toMatchObject({
      action: "ADMIN_REASSIGN_ORDER",
      reason: "Original rider unavailable",
    });
  });

  it("redelivers a failed order back to READY and clears the rider and PIN state", async () => {
    const store = createFixtureAdminStore();
    const created = await fixtureOrderStore.createOrder(deliveryInput());
    acceptFixtureOrder(created.orderId);
    expect(bumpFixtureOrder(created.orderId)).toBe("READY_FOR_PICKUP");
    const rider = createFixtureRiderStore(RIDER_JUMA);
    await rider.claimOrder(created.orderId);
    await rider.startDelivery(created.orderId);
    reportFixtureRiderFailure(created.orderId, RIDER_JUMA, "CUSTOMER_UNREACHABLE", "No answer at gate");

    let detail = await store.getOrder(created.orderId);
    expect(detail.status).toBe("DELIVERY_FAILED");

    const beforePin = detail.handoverPin;
    const result = await store.redeliverOrder(created.orderId, "Customer reached by phone");
    expect(result).toMatchObject({ orderId: created.orderId, status: "READY_FOR_PICKUP" });

    detail = await store.getOrder(created.orderId);
    expect(detail.status).toBe("READY_FOR_PICKUP");
    expect(detail.riderId).toBeNull();
    expect(detail.failedPinAttempts).toBe(0);
    expect(detail.pinLockedUntil).toBeNull();
    expect(detail.handoverPin).toBe(beforePin);

    const feed = await store.auditFeed({ entityType: "orders" });
    expect(feed.events[0]).toMatchObject({ action: "ADMIN_REDELIVER_ORDER" });
  });

  it("can redeliver a failed order straight to a replacement rider", async () => {
    const store = createFixtureAdminStore();
    const created = await fixtureOrderStore.createOrder(deliveryInput());
    acceptFixtureOrder(created.orderId);
    expect(bumpFixtureOrder(created.orderId)).toBe("READY_FOR_PICKUP");
    const rider = createFixtureRiderStore(RIDER_JUMA);
    await rider.claimOrder(created.orderId);
    await rider.startDelivery(created.orderId);
    reportFixtureRiderFailure(created.orderId, RIDER_JUMA, "CUSTOMER_UNREACHABLE", "Gate buzzer broken");

    const result = await store.redeliverOrder(
      created.orderId,
      "Second attempt with another rider",
      RIDER_JUMA,
    );
    expect(result.status).toBe("CLAIMED");
    expect((await store.getOrder(created.orderId)).riderId).toBe(RIDER_JUMA);
  });

  it("resets the handover PIN with an audited reason", async () => {
    const store = createFixtureAdminStore();
    const created = await fixtureOrderStore.createOrder(deliveryInput());
    acceptFixtureOrder(created.orderId);
    expect(bumpFixtureOrder(created.orderId)).toBe("READY_FOR_PICKUP");

    const before = (await store.getOrder(created.orderId)).handoverPin;
    await store.resetPin(created.orderId, "Customer could not read the PIN");
    const after = (await store.getOrder(created.orderId)).handoverPin;
    expect(after).toMatch(/^\d{6}$/);
    expect(after).not.toBe(before);

    const feed = await store.auditFeed({ entityType: "orders" });
    expect(feed.events[0]).toMatchObject({
      action: "ADMIN_RESET_HANDOVER_PIN",
      reason: "Customer could not read the PIN",
    });
  });

  it("rejects a reason shorter than three characters at the action boundary", () => {
    expect(orderActionSchema.safeParse({ orderId: randomUUID(), reason: "ok" }).success).toBe(
      false,
    );
    expect(
      orderActionSchema.safeParse({ orderId: randomUUID(), reason: "Customer asked" }).success,
    ).toBe(true);
  });
});

describe("cash ledger", () => {
  it("reconciles the canonical 65,500 example and updates the same row on a second settlement", async () => {
    const store = createFixtureAdminStore();
    await deliveredCodOrder(38_000);
    await deliveredCodOrder(27_500);

    const snapshot = await store.snapshot();
    const juma = snapshot.ledger.find((row) => row.riderId === RIDER_JUMA);
    expect(juma).toMatchObject({ riderName: "Rider Juma", expectedCash: 65_500 });
    expect(juma?.linkedOrders.map((order) => order.amount).sort((a, b) => a - b)).toEqual([
      27_500, 38_000,
    ]);

    const first = await store.reconcileCash(
      RIDER_JUMA,
      65_500,
      "End-of-day cash counted once",
    );
    expect(first).toMatchObject({
      expectedCash: 65_500,
      countedCash: 65_500,
      variance: 0,
      shortfall: 0,
      status: "SETTLED",
    });

    const second = await store.reconcileCash(
      RIDER_JUMA,
      60_000,
      "Recount found a 5,500 shortfall",
    );
    expect(second).toMatchObject({
      expectedCash: 65_500,
      countedCash: 60_000,
      variance: -5_500,
      shortfall: 5_500,
      status: "PARTIAL",
    });

    const after = (await store.snapshot()).ledger.find((row) => row.riderId === RIDER_JUMA);
    expect(after).toMatchObject({ settledCash: 60_000, variance: -5_500, status: "PARTIAL" });

    const feed = await store.auditFeed({ entityType: "cash_settlements" });
    expect(feed.events).toHaveLength(2);
    for (const event of feed.events) {
      expect(event.action).toBe("RECONCILE_RIDER_CASH");
    }
  });
});

describe("menu and tables", () => {
  it("validates image paths and soft-archives a menu item with an audit", async () => {
    const menuItem = upsertMenuItemSchema.safeParse({
      categoryId: "11111111-1111-4111-8111-111111111104",
      name: "Test Rolex",
      slug: "test-rolex",
      basePrice: 9_000,
      prepTimeMinutes: 10,
      sortOrder: 1,
      imagePath: "../../secrets.txt",
      reason: "Add a new item",
    });
    expect(menuItem.success).toBe(false);

    const store = createFixtureAdminStore();
    const first = (await store.snapshot()).menu[0]?.items[0];
    if (!first) throw new Error("no fixture menu items");

    await store.archiveMenuItem(first.itemId, "Sold out for the season");
    const archived = (await store.snapshot()).menu
      .flatMap((category) => category.items)
      .find((item) => item.itemId === first.itemId);
    expect(archived?.isAvailable).toBe(false);

    const feed = await store.auditFeed({ entityType: "menu_items" });
    expect(feed.events[0]).toMatchObject({
      action: "ADMIN_ARCHIVE_MENU_ITEM",
      reason: "Sold out for the season",
    });
  });

  it("creates a table with a QR token and preserves it on update", async () => {
    const store = createFixtureAdminStore();
    const reason = "Add a garden table";
    expect(
      upsertTableSchema.safeParse({ tableNumber: "T9", label: "Garden 4", reason }).success,
    ).toBe(true);

    const created = await store.upsertTable(
      { tableNumber: "T9", label: "Garden 4", isActive: true },
      reason,
    );
    expect(created.qrToken).toMatch(/^[0-9a-f-]{36}$/i);

    const updated = await store.upsertTable(
      { tableId: created.tableId, tableNumber: "T9A", label: "Garden 4 window", isActive: false },
      "Relabel the garden table",
    );
    expect(updated.qrToken).toBe(created.qrToken);
    expect(updated).toMatchObject({ tableNumber: "T9A", isActive: false });

    const feed = await store.auditFeed({ entityType: "tables" });
    expect(feed.events).toHaveLength(2);
  });
});
