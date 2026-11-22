import "server-only";

import { randomInt, randomUUID } from "node:crypto";

import type {
  AdminOrderDetail,
  AdminOrderStatus,
  AdminOrderSummary,
  RefundRequest,
} from "@/lib/admin/types";
import type { UpdateOrderContactInput } from "@/lib/admin/schemas";
import { normalizeUgPhone } from "@/lib/phone";
import type { OrderItemInput } from "@/lib/schemas/order";
import { createFixtureMenu, createFixtureTableNumber } from "@/lib/storefront/fixture";
import type { KitchenTicket } from "@/lib/kitchen/types";
import { RiderFailure } from "@/lib/rider/errors";
import type {
  RiderActiveOrder,
  RiderCashSummary,
  RiderPinResult,
  RiderPoolItem,
} from "@/lib/rider/types";

import { OrderFailure } from "./errors";
import { priceOrder } from "./pricing";
import {
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
import type { PricedLine } from "./pricing";

/**
 * Test-only in-memory order store (`ORDERS_FIXTURE=1`). It mirrors the SQL
 * contract closely enough for Playwright to exercise checkout, payment, OTP,
 * expiry, and webhook isolation without a Supabase stack. It is never selected
 * in production: `getOrderStore()` only honours the flag outside the production
 * runtime unless the suite explicitly opts in.
 */

type TxStatus = "INITIATED" | "PENDING" | "SUCCESSFUL" | "FAILED" | "ABANDONED";

type FixtureTx = PaymentAttempt & {
  orderId: string;
  status: TxStatus;
  providerTransactionId?: string;
  rawPayload: Record<string, unknown>;
};

type FixtureOrder = {
  id: string;
  token: string;
  number: number;
  type: "DELIVERY" | "DINE_IN";
  source: "WEB" | "TABLE_QR";
  status: CreatedOrder["orderStatus"];
  paymentStatus: CreatedOrder["paymentStatus"];
  method: CreatedOrder["paymentMethod"];
  customerName: string;
  customerPhone: string;
  customerPhoneNormalized: string;
  notes: string | null;
  tableId: string | null;
  tableNumber: string | null;
  deliveryArea: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  distanceM: number | null;
  travelMinutes: number | null;
  etaAt: string | null;
  itemsSubtotal: number;
  modifiersTotal: number;
  deliveryFee: number;
  packagingFee: number;
  total: number;
  codChangeRequestedFor: number | null;
  codChangeDue: number | null;
  handoverPin: string;
  createdAt: string;
  acknowledgedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  riderId: string | null;
  riderName: string | null;
  claimedAt: string | null;
  dispatchedAt: string | null;
  adminEditedAt: string | null;
  failedPinAttempts: number;
  pinLockedUntil: string | null;
  deliveryFailure: { outcome: string; reason: string; at: string } | null;
  telemetry: { latitude: number; longitude: number; updatedAt: string } | null;
  timeline: Array<{
    status: CreatedOrder["orderStatus"];
    at: string;
    reason?: string | null;
  }>;
  feedback: { rating: "GREAT" | "OKAY" | "BAD"; notes: string | null } | null;
  items: PricedLine[];
};

type OtpRecord = {
  code: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  consumed: boolean;
};

type FixtureRefund = {
  refundId: string;
  orderId: string;
  amount: number;
  status: string;
  reason: string | null;
  notes: string | null;
  requestedAt: string;
};

type FixtureState = {
  orders: Map<string, FixtureOrder>;
  tokenIndex: Map<string, string>;
  idempotency: Map<string, { requestHash: string; orderId: string }>;
  attempts: Map<string, FixtureTx>; // keyed by tx_ref
  attemptsByOrder: Map<string, string[]>;
  otps: Map<string, OtpRecord>;
  deliveredPhones: Set<string>;
  webhookEvents: Set<string>;
  processedWebhookEvents: Set<string>;
  nextOrderNumber: number;
  refunds: number;
  refundRequests: Map<string, FixtureRefund>;
  reprints: Map<string, number>;
};

type FixtureGlobal = typeof globalThis & {
  __mrfssOrders?: FixtureState;
};

function state(): FixtureState {
  const globalStore = globalThis as FixtureGlobal;
  globalStore.__mrfssOrders ??= {
    orders: new Map(),
    tokenIndex: new Map(),
    idempotency: new Map(),
    attempts: new Map(),
    attemptsByOrder: new Map(),
    otps: new Map(),
    deliveredPhones: new Set(),
    webhookEvents: new Set(),
    processedWebhookEvents: new Set(),
    nextOrderNumber: 1042,
    refunds: 0,
    refundRequests: new Map(),
    reprints: new Map(),
  };
  return globalStore.__mrfssOrders;
}

export function resetOrderStoreForTests(): void {
  const globalStore = globalThis as FixtureGlobal;
  delete globalStore.__mrfssOrders;
}

/** Mark a phone as having a delivered order (returning-customer rule). */
export function seedDeliveredCustomerForTests(phone: string): void {
  const normalized = normalizeUgPhone(phone);
  if (normalized) state().deliveredPhones.add(normalized);
}

export function fixtureRefundCount(): number {
  return state().refunds;
}

/** Test-only: backdate an order so the timeout cron can expire it. */
export function ageFixtureOrderForTests(token: string, minutes: number): void {
  const order = getFixtureOrderByToken(token);
  if (!order) return;
  order.createdAt = new Date(
    Date.now() - minutes * 60 * 1_000,
  ).toISOString();
}

function recordStatus(
  order: FixtureOrder,
  status: FixtureOrder["status"],
  reason: string,
  at = new Date().toISOString(),
): void {
  order.timeline.push({ status, at, reason });
}

/**
 * Test-only status driver for Playwright. Phase 8/9 own the real kitchen and
 * rider transitions; until those portals exist the browser suite needs a way
 * to move a fixture order to READY/OUT_FOR_DELIVERY/DELIVERED and set the rider
 * position. This helper is never reachable unless `ORDERS_FIXTURE=1`.
 */
export function setFixtureOrderStatusForTests(
  token: string,
  status: FixtureOrder["status"],
  options: {
    telemetry?: {
      latitude: number;
      longitude: number;
      updatedAt?: string;
    } | null;
    reason?: string;
    at?: string;
  } = {},
): boolean {
  const order = getFixtureOrderByToken(token);
  if (!order) return false;

  const at = options.at ?? new Date().toISOString();
  order.status = status;
  order.timeline.push({
    status,
    at,
    reason: options.reason ?? `FIXTURE_${status}`,
  });

  if (status === "PREPARING") {
    order.acknowledgedAt ??= at;
  }
  if (status === "READY_FOR_PICKUP") {
    order.readyAt ??= at;
  }
  if (status === "CLAIMED" || status === "OUT_FOR_DELIVERY") {
    order.riderName ??= "Juma Okello";
  }
  if (status === "OUT_FOR_DELIVERY") {
    order.telemetry =
      options.telemetry === null
        ? null
        : {
            latitude: options.telemetry?.latitude ?? order.lat ?? 0.3245,
            longitude: options.telemetry?.longitude ?? order.lng ?? 32.5782,
            updatedAt: options.telemetry?.updatedAt ?? at,
          };
  }
  if (status === "DELIVERED") {
    order.deliveredAt = at;
    if (order.method === "CASH_ON_DELIVERY") {
      order.paymentStatus = "PAID";
    }
  }
  if (status === "CANCELLED") {
    order.cancelledAt = at;
    order.cancellationReason = options.reason ?? "CANCELLED_BY_STAFF";
  }

  return true;
}

/** Test-only: move the rider marker without changing the order status. */
export function setFixtureTelemetryForTests(
  token: string,
  point: { latitude: number; longitude: number; updatedAt?: string },
): boolean {
  const order = getFixtureOrderByToken(token);
  if (!order || order.status !== "OUT_FOR_DELIVERY") return false;
  order.telemetry = {
    latitude: point.latitude,
    longitude: point.longitude,
    updatedAt: point.updatedAt ?? new Date().toISOString(),
  };
  return true;
}

export function getFixtureOrderByToken(token: string): FixtureOrder | null {
  const id = state().tokenIndex.get(token);
  return id ? (state().orders.get(id) ?? null) : null;
}

function toKitchenTicket(order: FixtureOrder): KitchenTicket {
  return {
    orderId: order.id,
    orderNumber: order.number,
    status: order.status as KitchenTicket["status"],
    orderType: order.type,
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    customerNotes: order.notes,
    paymentMethod: order.method,
    paymentStatus: order.paymentStatus,
    totalAmount: order.total,
    codChangeRequestedFor: order.codChangeRequestedFor,
    codChangeDue: order.codChangeDue,
    createdAt: order.createdAt,
    acknowledgedAt: order.acknowledgedAt,
    readyAt: order.readyAt,
    kitchenBusyBufferApplied: null,
    items: order.items.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      modifiers: line.modifiers.map((modifier) => ({
        name: modifier.name,
        priceDelta: modifier.priceDelta,
      })),
    })),
  };
}

const ACTIVE_KITCHEN_STATUSES = new Set<FixtureOrder["status"]>([
  "CONFIRMED_UNPAID",
  "PREPARING",
  "READY_FOR_PICKUP",
]);

/** Kitchen board read path for the fixture store (mirrors get_kitchen_orders). */
export function listFixtureKitchenTickets(): KitchenTicket[] {
  return [...state().orders.values()]
    .filter((order) => ACTIVE_KITCHEN_STATUSES.has(order.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toKitchenTicket);
}

export function getFixtureKitchenTicket(orderId: string): KitchenTicket | null {
  const order = state().orders.get(orderId);
  return order && ACTIVE_KITCHEN_STATUSES.has(order.status)
    ? toKitchenTicket(order)
    : null;
}

export function acceptFixtureOrder(orderId: string): void {
  const order = state().orders.get(orderId);
  if (!order) throw new OrderFailure("ORDER_NOT_FOUND");
  if (order.status !== "CONFIRMED_UNPAID") {
    throw new OrderFailure("ORDER_STATE_INVALID");
  }

  const at = new Date().toISOString();
  order.status = "PREPARING";
  order.acknowledgedAt ??= at;
  recordStatus(order, "PREPARING", "KITCHEN_ACCEPTED", at);
}

export function bumpFixtureOrder(
  orderId: string,
): "READY_FOR_PICKUP" | "DELIVERED" {
  const order = state().orders.get(orderId);
  if (!order) throw new OrderFailure("ORDER_NOT_FOUND");
  if (order.status !== "PREPARING") {
    throw new OrderFailure("ORDER_STATE_INVALID");
  }

  const at = new Date().toISOString();
  const next: "READY_FOR_PICKUP" | "DELIVERED" =
    order.type === "DINE_IN" ? "DELIVERED" : "READY_FOR_PICKUP";

  order.status = next;
  order.acknowledgedAt ??= at;
  if (next === "READY_FOR_PICKUP") order.readyAt ??= at;
  if (next === "DELIVERED") order.deliveredAt ??= at;
  recordStatus(order, next, "KITCHEN_BUMPED", at);
  return next;
}

export function recordFixtureReprint(orderId: string): void {
  const order = state().orders.get(orderId);
  if (!order) throw new OrderFailure("ORDER_NOT_FOUND");
  state().reprints.set(orderId, (state().reprints.get(orderId) ?? 0) + 1);
}

export function fixtureReprintCount(orderId: string): number {
  return state().reprints.get(orderId) ?? 0;
}

// ---------------------------------------------------------------------------
// Rider fixtures (mirror the security-definer RPCs used in production)
// ---------------------------------------------------------------------------

const PIN_MAX_ATTEMPTS = 3;
const PIN_LOCK_MINUTES = 15;
const PIN_GEOFENCE_M = 300;
const ACTIVE_DELIVERY_STATUSES = new Set<FixtureOrder["status"]>([
  "CLAIMED",
  "OUT_FOR_DELIVERY",
]);

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;
  return Math.round(2 * radius * Math.asin(Math.sqrt(a)));
}

function toRiderPoolItem(order: FixtureOrder): RiderPoolItem {
  return {
    orderId: order.id,
    orderNumber: order.number,
    // The database pool only exposes `delivery_area`, never the street address.
    // Fixture orders do not record a separate area, so the safe value is null.
    area: null,
    distanceKm:
      order.distanceM === null
        ? null
        : Math.round((order.distanceM / 1000) * 100) / 100,
    totalAmount: order.total,
    paymentMethod: order.method,
    itemCount: order.items.reduce((sum, line) => sum + line.quantity, 0),
    readyAt: order.readyAt ?? order.createdAt,
  };
}

function toRiderActiveOrder(order: FixtureOrder): RiderActiveOrder {
  return {
    orderId: order.id,
    orderNumber: order.number,
    status: order.status as RiderActiveOrder["status"],
    paymentMethod: order.method,
    paymentStatus: order.paymentStatus,
    customerName: order.customerName,
    customerPhone: order.customerPhoneNormalized,
    deliveryAddressText: order.address,
    deliveryArea: order.address,
    deliveryLatitude: order.lat,
    deliveryLongitude: order.lng,
    roadDistanceM: order.distanceM,
    estimatedTravelMinutes: order.travelMinutes,
    etaAt: order.etaAt,
    totalAmount: order.total,
    codChangeDue: order.codChangeDue,
    customerNotes: order.notes,
    claimedAt: order.timeline.find((entry) => entry.status === "CLAIMED")?.at,
    dispatchedAt: order.dispatchedAt,
    items: order.items.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.unitPrice * line.quantity,
      modifiers: line.modifiers.map((modifier) => ({
        name: modifier.name,
        priceDelta: modifier.priceDelta,
      })),
    })),
  };
}

/** Rider pool read path: summaries only, never phone/address/notes/PIN. */
export function listFixtureRiderPool(): RiderPoolItem[] {
  return [...state().orders.values()]
    .filter(
      (order) =>
        order.type === "DELIVERY" &&
        order.status === "READY_FOR_PICKUP" &&
        order.riderId === null,
    )
    .sort((left, right) =>
      (left.readyAt ?? left.createdAt).localeCompare(
        right.readyAt ?? right.createdAt,
      ),
    )
    .map(toRiderPoolItem);
}

export function getFixtureRiderActiveOrder(
  riderId: string,
): RiderActiveOrder | null {
  const active = [...state().orders.values()]
    .filter(
      (order) =>
        order.riderId === riderId &&
        ACTIVE_DELIVERY_STATUSES.has(order.status),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  return active ? toRiderActiveOrder(active) : null;
}

export function claimFixtureRiderOrder(
  orderId: string,
  riderId: string,
  riderName: string,
): RiderActiveOrder {
  const store = state();
  const existing = [...store.orders.values()].find(
    (order) =>
      order.riderId === riderId && ACTIVE_DELIVERY_STATUSES.has(order.status),
  );
  if (existing) throw new RiderFailure("RIDER_HAS_ACTIVE_ORDER");

  const order = store.orders.get(orderId);
  if (!order) throw new RiderFailure("ORDER_NOT_FOUND");
  if (
    order.type !== "DELIVERY" ||
    order.status !== "READY_FOR_PICKUP" ||
    order.riderId !== null
  ) {
    throw new RiderFailure("ORDER_ALREADY_CLAIMED");
  }

  const at = new Date().toISOString();
  order.riderId = riderId;
  order.riderName = riderName;
  order.status = "CLAIMED";
  order.claimedAt = at;
  recordStatus(order, "CLAIMED", "RIDER_CLAIMED", at);
  return toRiderActiveOrder(order);
}

export function startFixtureRiderDelivery(
  orderId: string,
  riderId: string,
): RiderActiveOrder {
  const order = state().orders.get(orderId);
  if (!order || order.riderId !== riderId) {
    throw new RiderFailure("ORDER_STATE_INVALID");
  }
  if (order.status !== "CLAIMED") {
    throw new RiderFailure("ORDER_STATE_INVALID");
  }

  const at = new Date().toISOString();
  order.status = "OUT_FOR_DELIVERY";
  order.dispatchedAt = at;
  recordStatus(order, "OUT_FOR_DELIVERY", "RIDER_STARTED_DELIVERY", at);
  return toRiderActiveOrder(order);
}

export function releaseFixtureRiderOrder(
  orderId: string,
  riderId: string,
  reason: string,
): void {
  const order = state().orders.get(orderId);
  if (!order || order.riderId !== riderId) {
    throw new RiderFailure("ORDER_STATE_INVALID");
  }
  if (order.status !== "CLAIMED") {
    throw new RiderFailure("ORDER_STATE_INVALID");
  }

  const at = new Date().toISOString();
  order.status = "READY_FOR_PICKUP";
  order.riderId = null;
  order.riderName = null;
  order.dispatchedAt = null;
  order.failedPinAttempts = 0;
  order.pinLockedUntil = null;
  recordStatus(order, "READY_FOR_PICKUP", reason || "RIDER_RELEASED", at);
}

export function verifyFixtureRiderPin({
  orderId,
  riderId,
  pin,
  latitude,
  longitude,
  now = new Date(),
}: {
  orderId: string;
  riderId: string;
  pin: string;
  latitude?: number;
  longitude?: number;
  now?: Date;
}): RiderPinResult {
  const order = state().orders.get(orderId);
  if (!order || order.riderId !== riderId) {
    throw new RiderFailure("AUTH_UNAUTHORIZED");
  }
  if (order.status !== "OUT_FOR_DELIVERY") {
    throw new RiderFailure("ORDER_STATE_INVALID");
  }

  if (order.pinLockedUntil && new Date(order.pinLockedUntil) > now) {
    return { ok: false, code: "PIN_LOCKED", lockedUntil: order.pinLockedUntil };
  }

  if (
    latitude !== undefined &&
    longitude !== undefined &&
    order.lat !== null &&
    order.lng !== null
  ) {
    const distance = haversineM(latitude, longitude, order.lat, order.lng);
    if (distance > PIN_GEOFENCE_M) {
      return {
        ok: false,
        code: "TOO_FAR_FROM_DESTINATION",
        distanceM: distance,
        allowedM: PIN_GEOFENCE_M,
      };
    }
  }

  if (!/^[0-9]{4}$/.test(pin) || pin !== order.handoverPin) {
    order.failedPinAttempts += 1;
    const locked =
      order.failedPinAttempts >= PIN_MAX_ATTEMPTS
        ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000).toISOString()
        : null;
    order.pinLockedUntil = locked;

    return {
      ok: false,
      code: locked ? "PIN_LOCKED" : "INVALID_HANDOVER_PIN",
      remainingAttempts: Math.max(
        0,
        PIN_MAX_ATTEMPTS - order.failedPinAttempts,
      ),
      lockedUntil: locked,
    };
  }

  const at = now.toISOString();
  order.status = "DELIVERED";
  order.deliveredAt = at;
  order.dispatchedAt ??= at;
  order.failedPinAttempts = 0;
  order.pinLockedUntil = null;
  if (order.method === "CASH_ON_DELIVERY") {
    order.paymentStatus = "PAID";
  }
  recordStatus(order, "DELIVERED", "DELIVERY_PIN_VERIFIED", at);

  return {
    ok: true,
    code: "DELIVERED",
    changeDue: order.codChangeDue,
    deliveredAt: at,
  };
}

export function reportFixtureRiderFailure(
  orderId: string,
  riderId: string,
  outcome: string,
  reason: string,
): void {
  const order = state().orders.get(orderId);
  if (!order || order.riderId !== riderId) {
    throw new RiderFailure("AUTH_UNAUTHORIZED");
  }
  if (order.status !== "OUT_FOR_DELIVERY") {
    throw new RiderFailure("ORDER_STATE_INVALID");
  }

  const at = new Date().toISOString();
  order.status = "DELIVERY_FAILED";
  order.deliveryFailure = { outcome, reason, at };
  recordStatus(order, "DELIVERY_FAILED", reason || outcome, at);
}

export function recordFixtureRiderTelemetry({
  orderId,
  riderId,
  latitude,
  longitude,
  recordedAt = new Date().toISOString(),
}: {
  orderId: string;
  riderId: string;
  latitude: number;
  longitude: number;
  recordedAt?: string;
}): void {
  const order = state().orders.get(orderId);
  if (
    !order ||
    order.riderId !== riderId ||
    order.status !== "OUT_FOR_DELIVERY"
  ) {
    throw new RiderFailure("ORDER_STATE_INVALID");
  }
  order.telemetry = { latitude, longitude, updatedAt: recordedAt };
}

export function fixtureRiderCashSummary(riderId: string): RiderCashSummary {
  const delivered = [...state().orders.values()].filter(
    (order) =>
      order.riderId === riderId &&
      order.status === "DELIVERED" &&
      order.method === "CASH_ON_DELIVERY" &&
      order.paymentStatus === "PAID",
  );
  const unsettled = delivered.reduce((sum, order) => sum + order.total, 0);

  return {
    riderId,
    outstandingCash: unsettled,
    unsettledOrderCash: unsettled,
    settlementShortfall: 0,
    totalSettled: 0,
  };
}

/** Reassign helper used by the admin fixture path; clears the rider assignment. */
export function clearFixtureRiderAssignment(orderId: string): void {
  const order = state().orders.get(orderId);
  if (!order) return;
  order.riderId = null;
  order.riderName = null;
  order.dispatchedAt = null;
}

// ---------------------------------------------------------------------------
// Admin bridge. The admin fixture store owns settings/menu/staff/audit state;
// orders and refunds remain in this single source of truth so the operations,
// storefront, kitchen, and rider fixtures all observe the same mutations.
// ---------------------------------------------------------------------------

function toAdminSummary(order: FixtureOrder): AdminOrderSummary {
  return {
    orderId: order.id,
    orderNumber: order.number,
    customerName: order.customerName,
    customerPhone: order.customerPhoneNormalized,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.method,
    orderType: order.type,
    deliveryArea: order.deliveryArea,
    tableNumber: order.tableNumber,
    riderId: order.riderId,
    riderName: order.riderName,
    totalAmount: order.total,
    createdAt: order.createdAt,
    acknowledgedAt: order.acknowledgedAt,
    readyAt: order.readyAt,
    etaAt: order.etaAt,
  };
}

function toAdminDetail(order: FixtureOrder): AdminOrderDetail {
  const payments = [...(state().attempts.values() ?? [])]
    .filter((tx) => tx.orderId === order.id)
    .map((tx) => ({
      txRef: tx.txRef,
      method: String(
        (tx.rawPayload as { provider?: unknown } | undefined)?.provider ?? "UNKNOWN",
      ),
      status: tx.status,
      amount: tx.amount,
      createdAt: null,
    }));

  const refund = [...state().refundRequests.values()].find(
    (entry) => entry.orderId === order.id,
  );

  return {
    ...toAdminSummary(order),
    handoverPin: order.handoverPin,
    failedPinAttempts: order.failedPinAttempts,
    pinLockedUntil: order.pinLockedUntil,
    address: order.address,
    notes: order.notes,
    deliveryLatitude: order.lat,
    deliveryLongitude: order.lng,
    roadDistanceM: order.distanceM,
    codChangeDue: order.codChangeDue,
    cancellationReason: order.cancellationReason,
    securityFlag: order.deliveryFailure
      ? `DELIVERY_FAILED:${order.deliveryFailure.outcome}`
      : null,
    adminEditedAt: order.adminEditedAt,
    timeline: order.timeline,
    items: order.items.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal:
        (line.unitPrice +
          line.modifiers.reduce((sum, modifier) => sum + modifier.priceDelta * modifier.quantity, 0)) *
        line.quantity,
    })),
    payments,
    refund: refund
      ? {
          id: refund.refundId,
          status: refund.status,
          amount: refund.amount,
          reason: refund.reason,
          requestedAt: refund.requestedAt,
        }
      : null,
  };
}

export function listFixtureAdminOrders(): AdminOrderSummary[] {
  return [...state().orders.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(toAdminSummary);
}

export function getFixtureAdminOrderDetail(orderId: string): AdminOrderDetail | null {
  const order = state().orders.get(orderId);
  return order ? toAdminDetail(order) : null;
}

export function adminFixtureUpdateContact(
  input: UpdateOrderContactInput,
): AdminOrderDetail {
  const order = state().orders.get(input.orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (["OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(order.status)) {
    throw new Error("ORDER_STATE_INVALID");
  }

  if (input.customerName !== undefined) order.customerName = input.customerName;
  if (input.customerPhone !== undefined) {
    order.customerPhone = input.customerPhone;
    order.customerPhoneNormalized = normalizeUgPhone(input.customerPhone) ?? input.customerPhone;
  }
  if (input.customerNotes !== undefined) order.notes = input.customerNotes;
  if (input.deliveryAddressText !== undefined) order.address = input.deliveryAddressText;
  if (input.deliveryArea !== undefined) order.deliveryArea = input.deliveryArea;
  if (input.deliveryLatitude !== undefined) order.lat = input.deliveryLatitude;
  if (input.deliveryLongitude !== undefined) order.lng = input.deliveryLongitude;
  if (input.roadDistanceM !== undefined) order.distanceM = input.roadDistanceM;
  if (input.deliveryFee !== undefined) {
    order.deliveryFee = input.deliveryFee;
    order.total =
      order.itemsSubtotal + order.modifiersTotal + order.deliveryFee + order.packagingFee;
  }
  order.adminEditedAt = new Date().toISOString();
  recordStatus(order, order.status, input.reason);
  return toAdminDetail(order);
}

export function adminFixtureCancelOrder(orderId: string, reason: string): void {
  const order = state().orders.get(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (["DELIVERED", "CANCELLED"].includes(order.status)) {
    throw new Error("ORDER_STATE_INVALID");
  }

  const at = new Date().toISOString();
  order.status = "CANCELLED";
  order.cancelledAt = at;
  order.cancellationReason = reason;
  recordStatus(order, "CANCELLED", reason, at);

  if (order.paymentStatus === "PAID") {
    createFixtureRefundRequest(order.id, reason, order.total);
  }
}

export function adminFixtureCompleteOrder(orderId: string, reason: string): void {
  const order = state().orders.get(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!["CLAIMED", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP"].includes(order.status)) {
    throw new Error("ORDER_STATE_INVALID");
  }

  const at = new Date().toISOString();
  order.status = "DELIVERED";
  order.deliveredAt = at;
  if (order.method === "CASH_ON_DELIVERY") order.paymentStatus = "PAID";
  recordStatus(order, "DELIVERED", reason, at);
}

export function adminFixtureReassignOrder(
  orderId: string,
  riderId: string,
  riderName: string,
  reason: string,
): void {
  const order = state().orders.get(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!["CLAIMED", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP"].includes(order.status)) {
    throw new Error("ORDER_STATE_INVALID");
  }
  if (
    [...state().orders.values()].some(
      (candidate) =>
        candidate.id !== orderId &&
        candidate.riderId === riderId &&
        (candidate.status === "CLAIMED" || candidate.status === "OUT_FOR_DELIVERY"),
    )
  ) {
    throw new Error("RIDER_HAS_ACTIVE_ORDER");
  }

  order.riderId = riderId;
  order.riderName = riderName;
  order.status = "CLAIMED";
  order.claimedAt = new Date().toISOString();
  order.dispatchedAt = null;
  order.telemetry = null;
  recordStatus(order, "CLAIMED", reason);
}

export function adminFixtureRedeliverOrder(
  orderId: string,
  reason: string,
  riderId?: string | null,
  riderName?: string | null,
): AdminOrderStatus {
  const order = state().orders.get(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.status !== "DELIVERY_FAILED") throw new Error("ORDER_STATE_INVALID");

  if (riderId) {
    if (
      [...state().orders.values()].some(
        (candidate) =>
          candidate.id !== orderId &&
          candidate.riderId === riderId &&
          (candidate.status === "CLAIMED" || candidate.status === "OUT_FOR_DELIVERY"),
      )
    ) {
      throw new Error("RIDER_HAS_ACTIVE_ORDER");
    }
  }

  const at = new Date().toISOString();
  order.status = "READY_FOR_PICKUP";
  order.riderId = null;
  order.riderName = null;
  order.claimedAt = null;
  order.dispatchedAt = null;
  order.deliveredAt = null;
  order.deliveryFailure = null;
  order.failedPinAttempts = 0;
  order.pinLockedUntil = null;
  order.readyAt = order.readyAt ?? at;
  recordStatus(order, "READY_FOR_PICKUP", reason, at);

  if (riderId) {
    order.status = "CLAIMED";
    order.riderId = riderId;
    order.riderName = riderName ?? "Rider";
    order.claimedAt = at;
    recordStatus(order, "CLAIMED", reason, at);
    return "CLAIMED";
  }
  return "READY_FOR_PICKUP";
}

export function adminFixtureResetPin(orderId: string, reason: string): void {
  const order = state().orders.get(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (["DELIVERED", "CANCELLED"].includes(order.status)) {
    throw new Error("ORDER_STATE_INVALID");
  }
  order.handoverPin = String(randomInt(100_000, 1_000_000));
  order.failedPinAttempts = 0;
  order.pinLockedUntil = null;
  recordStatus(order, order.status, reason);
}

export function createFixtureRefundRequest(
  orderId: string,
  reason: string,
  amount?: number,
): string {
  const order = state().orders.get(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const refundId = randomUUID();
  state().refundRequests.set(refundId, {
    refundId,
    orderId,
    amount: amount ?? order.total,
    status: "REQUESTED",
    reason,
    notes: null,
    requestedAt: new Date().toISOString(),
  });
  state().refunds += 1;
  return refundId;
}

export function listFixtureRefundRequests(): RefundRequest[] {
  return [...state().refundRequests.values()]
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
    .map((refund) => ({
      refundId: refund.refundId,
      orderId: refund.orderId,
      orderNumber: state().orders.get(refund.orderId)?.number,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason,
      notes: refund.notes,
      requestedAt: refund.requestedAt,
    }));
}

export function approveFixtureRefundRequest(
  refundId: string,
  decision: "APPROVE" | "REJECT",
  notes?: string,
): { refundId: string; status: string } {
  const refund = state().refundRequests.get(refundId);
  if (!refund) throw new Error("REFUND_NOT_FOUND");
  if (refund.status !== "REQUESTED") throw new Error("ORDER_STATE_INVALID");
  refund.status = decision === "APPROVE" ? "PROCESSING" : "FAILED";
  refund.notes = notes ?? null;
  return { refundId, status: refund.status };
}

function pricingItems(menu: NonNullable<ReturnType<typeof fixtureMenu>>, input: CreateOrderRpcInput): OrderItemInput[] {
  return input.items.map((line) => {
    const item = menu.items.find((candidate) => candidate.id === line.menuItemId);
    const comboSelections: OrderItemInput["comboSelections"] = [];

    for (const modifier of line.modifiers) {
      if (!("comboOptionId" in modifier)) continue;
      const step = item?.comboSteps.find((candidate) =>
        candidate.options.some((option) => option.id === modifier.comboOptionId),
      );
      if (step) {
        comboSelections.push({
          stepId: step.id,
          optionId: modifier.comboOptionId,
        });
      }
    }

    return {
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      modifierIds: line.modifiers
        .filter(
          (modifier): modifier is { modifierId: string } =>
            "modifierId" in modifier,
        )
        .map((modifier) => modifier.modifierId),
      comboSelections,
    };
  });
}

function fixtureMenu() {
  const result = createFixtureMenu();
  return result.status === "ok" ? result.menu : null;
}

function toCreated(order: FixtureOrder, idempotent: boolean): CreatedOrder {
  return {
    orderId: order.id,
    orderToken: order.token,
    orderNumber: order.number,
    totalAmount: order.total,
    itemsSubtotal: order.itemsSubtotal,
    modifiersTotal: order.modifiersTotal,
    deliveryFee: order.deliveryFee,
    packagingFee: order.packagingFee,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.method,
    idempotent,
  };
}

function findOrderByToken(token: string): FixtureOrder | null {
  return getFixtureOrderByToken(token);
}

function resolveTx(txRef: string): FixtureTx | null {
  return state().attempts.get(txRef) ?? null;
}

function abandonOpenAttempts(orderId: string): void {
  const refs = state().attemptsByOrder.get(orderId) ?? [];
  for (const ref of refs) {
    const tx = state().attempts.get(ref);
    if (tx && (tx.status === "INITIATED" || tx.status === "PENDING")) {
      tx.status = "ABANDONED";
    }
  }
}

export const fixtureOrderStore: OrderStore = {
  async createOrder(input: CreateOrderRpcInput): Promise<CreatedOrder> {
    const store = state();
    const existing = store.idempotency.get(input.idempotencyKey);

    if (existing) {
      if (existing.requestHash !== input.requestHash) {
        throw new OrderFailure("IDEMPOTENCY_CONFLICT");
      }
      const order = store.orders.get(existing.orderId);
      if (!order) throw new OrderFailure("INTERNAL_ERROR");
      return toCreated(order, true);
    }

    const menu = fixtureMenu();
    if (!menu) throw new OrderFailure("INTERNAL_ERROR", "Fixture menu missing.");

    const mode = input.orderType === "DINE_IN" ? "dine-in" : "delivery";
    const priced = priceOrder({
      menu,
      items: pricingItems(menu, input),
      mode,
      distanceM: mode === "delivery" ? input.roadDistanceM : null,
      paymentMethod: input.paymentMethod,
    });

    const changeRequested = input.codChangeRequestedFor ?? null;
    if (changeRequested !== null) {
      if (input.paymentMethod !== "CASH_ON_DELIVERY") {
        throw new OrderFailure("VALIDATION_ERROR", "Change is only for cash orders.");
      }
      if (changeRequested < priced.total) {
        throw new OrderFailure(
          "VALIDATION_ERROR",
          "The amount handed over must cover the order total.",
        );
      }
    }

    const createdAt = new Date().toISOString();
    const initialStatus: FixtureOrder["status"] =
      input.paymentMethod === "CASH_ON_DELIVERY"
        ? "CONFIRMED_UNPAID"
        : "PENDING_PAYMENT";

    const order: FixtureOrder = {
      id: randomUUID(),
      token: randomUUID(),
      number: store.nextOrderNumber,
      type: input.orderType,
      source: input.orderType === "DINE_IN" ? "TABLE_QR" : "WEB",
      status: initialStatus,
      paymentStatus: "PENDING",
      method: input.paymentMethod,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerPhoneNormalized:
        normalizeUgPhone(input.customerPhone) ?? input.customerPhone,
      notes: input.customerNotes,
      tableId: input.tableId,
      tableNumber: createFixtureTableNumber(input.tableId),
      deliveryArea: null,
      address: input.deliveryAddressText,
      lat: input.deliveryLatitude,
      lng: input.deliveryLongitude,
      distanceM: mode === "delivery" ? input.roadDistanceM : null,
      travelMinutes: input.estimatedTravelMinutes,
      etaAt: input.etaAt,
      itemsSubtotal: priced.itemsSubtotal,
      modifiersTotal: priced.modifiersTotal,
      deliveryFee: priced.deliveryFee,
      packagingFee: priced.packagingFee,
      total: priced.total,
      codChangeRequestedFor: changeRequested,
      codChangeDue:
        changeRequested !== null ? changeRequested - priced.total : null,
      handoverPin: String(randomInt(1000, 10_000)),
      createdAt,
      acknowledgedAt: null,
      readyAt: null,
      deliveredAt: null,
      cancelledAt: null,
      cancellationReason: null,
      riderId: null,
      riderName: null,
      claimedAt: null,
      dispatchedAt: null,
      adminEditedAt: null,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      deliveryFailure: null,
      telemetry: null,
      timeline: [],
      feedback: null,
      items: priced.lines,
    };
    recordStatus(order, initialStatus, "ORDER_CREATED", createdAt);

    store.nextOrderNumber += 1;
    store.orders.set(order.id, order);
    store.tokenIndex.set(order.token, order.id);
    store.idempotency.set(input.idempotencyKey, {
      requestHash: input.requestHash,
      orderId: order.id,
    });

    return toCreated(order, false);
  },

  async getOrderByToken(token: string): Promise<unknown | null> {
    const order = findOrderByToken(token);
    if (!order) return null;

    return {
      orderToken: order.token,
      orderNumber: order.number,
      orderType: order.type,
      source: order.source,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.method,
      customerName: order.customerName,
      tableNumber: order.tableNumber,
      deliveryArea: order.address,
      itemsSubtotal: order.itemsSubtotal,
      modifiersTotal: order.modifiersTotal,
      deliveryFee: order.deliveryFee,
      packagingFee: order.packagingFee,
      totalAmount: order.total,
      handoverPin:
        order.type === "DELIVERY" &&
        order.status !== "DELIVERED" &&
        order.status !== "DELIVERY_FAILED" &&
        order.status !== "CANCELLED"
          ? order.handoverPin
          : null,
      codChangeRequestedFor: order.codChangeRequestedFor,
      codChangeDue: order.codChangeDue,
      etaAt: order.etaAt,
      acknowledgedAt: order.acknowledgedAt,
      roadDistanceM: order.distanceM,
      estimatedTravelMinutes: order.travelMinutes,
      createdAt: order.createdAt,
      readyAt: order.readyAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      cancellationReason: order.cancellationReason,
      destinationLatitude:
        order.status === "OUT_FOR_DELIVERY" ? order.lat : null,
      destinationLongitude:
        order.status === "OUT_FOR_DELIVERY" ? order.lng : null,
      canRate: order.status === "DELIVERED" && order.feedback === null,
      feedback: order.feedback,
      timeline: order.timeline,
      refund: null,
      deliveryFailure:
        order.status === "DELIVERY_FAILED"
          ? {
              outcome: order.deliveryFailure?.outcome ?? "OTHER",
              reason: order.deliveryFailure?.reason ?? "DELIVERY_FAILED",
              createdAt: order.deliveryFailure?.at ?? order.cancelledAt,
            }
          : null,
      rider: order.riderName
        ? {
            name: order.riderName,
            latitude:
              order.status === "OUT_FOR_DELIVERY"
                ? (order.telemetry?.latitude ?? null)
                : null,
            longitude:
              order.status === "OUT_FOR_DELIVERY"
                ? (order.telemetry?.longitude ?? null)
                : null,
            updatedAt:
              order.status === "OUT_FOR_DELIVERY"
                ? (order.telemetry?.updatedAt ?? null)
                : null,
          }
        : null,
      items: order.items.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.unitPrice * line.quantity,
        modifiers: line.modifiers.map((modifier) => ({
          name: modifier.name,
          priceDelta: modifier.priceDelta,
        })),
      })),
    };
  },

  async submitFeedback({ orderToken, rating, notes }): Promise<void> {
    const order = findOrderByToken(orderToken);
    if (!order || order.status !== "DELIVERED" || order.feedback !== null) {
      throw new OrderFailure(
        "ORDER_STATE_INVALID",
        "Feedback was already sent, or this order is not ready for feedback.",
      );
    }

    order.feedback = { rating, notes: notes ?? null };
  },

  async getPaymentContext(token: string): Promise<PaymentContext | null> {
    const order = findOrderByToken(token);
    if (!order) return null;
    return {
      orderToken: order.token,
      orderNumber: order.number,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.method,
      totalAmount: order.total,
    };
  },

  async startPaymentAttempt({
    orderToken,
    method,
    provider,
  }): Promise<PaymentAttempt> {
    const store = state();
    const order = findOrderByToken(orderToken);
    if (!order) throw new OrderFailure("ORDER_NOT_FOUND");
    if (order.method === "CASH_ON_DELIVERY") {
      throw new OrderFailure("PAYMENT_METHOD_UNAVAILABLE");
    }
    if (order.method !== method) {
      throw new OrderFailure("VALIDATION_ERROR");
    }
    if (order.status !== "PENDING_PAYMENT" || order.paymentStatus !== "PENDING") {
      throw new OrderFailure("ORDER_STATE_INVALID");
    }

    abandonOpenAttempts(order.id);
    const refs = store.attemptsByOrder.get(order.id) ?? [];
    const attemptNumber = refs.length + 1;
    const txRef = `${order.token}-${attemptNumber}`;
    const attempt: FixtureTx = {
      transactionId: randomUUID(),
      txRef,
      attemptNumber,
      amount: order.total,
      currency: "UGX",
      orderId: order.id,
      status: "INITIATED",
      rawPayload: { attemptNumber, provider },
    };

    store.attempts.set(txRef, attempt);
    store.attemptsByOrder.set(order.id, [...refs, txRef]);
    return attempt;
  },

  async resolvePaymentTxRef(txRef: string): Promise<ResolvedPayment | null> {
    const tx = resolveTx(txRef);
    if (!tx) return null;
    const order = state().orders.get(tx.orderId);
    if (!order) return null;

    return {
      transactionId: tx.transactionId,
      orderId: order.id,
      orderToken: order.token,
      orderNumber: order.number,
      attemptNumber: tx.attemptNumber,
      txRef: tx.txRef,
      amount: tx.amount,
      currency: tx.currency,
      transactionStatus: tx.status,
      paymentMethod: order.method,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
    };
  },

  async finalizePaymentAttempt(
    input: FinalizePaymentInput,
  ): Promise<FinalizedPayment> {
    const store = state();
    const tx = resolveTx(input.txRef);
    if (!tx) return { applied: false, reason: "TX_REF_NOT_FOUND" };

    const order = store.orders.get(tx.orderId);
    if (!order) return { applied: false, reason: "ORDER_NOT_FOUND" };

    if (tx.status === "SUCCESSFUL") {
      return {
        applied: false,
        reason: "ALREADY_PROCESSED",
        orderToken: order.token,
        orderNumber: order.number,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
      };
    }

    if (input.success) {
      if (tx.amount !== order.total || tx.currency !== "UGX") {
        tx.status = "FAILED";
        tx.rawPayload = {
          ...tx.rawPayload,
          ...input.rawPayload,
          finalizeError: "PAYMENT_MISMATCH",
        };
        return {
          applied: false,
          reason: "PAYMENT_MISMATCH",
          orderToken: order.token,
          orderNumber: order.number,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
        };
      }

      if (tx.status === "ABANDONED") {
        tx.status = "SUCCESSFUL";
        tx.rawPayload = { ...tx.rawPayload, ...input.rawPayload };
        store.refunds += 1;
        return {
          applied: false,
          reason: "ATTEMPT_ABANDONED",
          orderToken: order.token,
          orderNumber: order.number,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
        };
      }

      if (
        order.status === "CANCELLED" ||
        order.status === "DELIVERED" ||
        order.status === "DELIVERY_FAILED"
      ) {
        tx.status = "SUCCESSFUL";
        tx.rawPayload = { ...tx.rawPayload, ...input.rawPayload };
        store.refunds += 1;
        return {
          applied: false,
          reason: "ORDER_TERMINAL",
          orderToken: order.token,
          orderNumber: order.number,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
        };
      }

      if (order.paymentStatus === "PAID") {
        return {
          applied: false,
          reason: "ORDER_ALREADY_PAID",
          orderToken: order.token,
          orderNumber: order.number,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
        };
      }

      if (order.status !== "PENDING_PAYMENT") {
        return {
          applied: false,
          reason: "ORDER_STATE_INVALID",
          orderToken: order.token,
          orderNumber: order.number,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
        };
      }

      tx.status = "SUCCESSFUL";
      tx.providerTransactionId = input.providerTransactionId;
      tx.rawPayload = { ...tx.rawPayload, ...input.rawPayload };
      order.paymentStatus = "PAID";
      order.status = "PREPARING";
      order.acknowledgedAt ??= new Date().toISOString();
      recordStatus(order, "PREPARING", "PAYMENT_VERIFIED", order.acknowledgedAt);

      return {
        applied: true,
        reason: null,
        orderToken: order.token,
        orderNumber: order.number,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
      };
    }

    if (tx.status === "ABANDONED") {
      return {
        applied: false,
        reason: "ATTEMPT_ABANDONED",
        orderToken: order.token,
        orderNumber: order.number,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
      };
    }

    if (order.paymentStatus === "PAID") {
      return {
        applied: false,
        reason: "ORDER_ALREADY_PAID",
        orderToken: order.token,
        orderNumber: order.number,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
      };
    }

    tx.status = "FAILED";
    tx.providerTransactionId = input.providerTransactionId;
    tx.rawPayload = {
      ...tx.rawPayload,
      ...input.rawPayload,
      finalizeError: input.error ?? "PAYMENT_FAILED",
    };

    return {
      applied: false,
      reason: input.error ?? "PAYMENT_FAILED",
      orderToken: order.token,
      orderNumber: order.number,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
    };
  },

  async recordWebhookEvent(
    input: WebhookEventInput,
  ): Promise<WebhookEventRecord> {
    const key = `${input.provider}:${input.providerEventId}`;
    const store = state();
    if (store.webhookEvents.has(key)) {
      return {
        duplicate: true,
        processed: store.processedWebhookEvents.has(key),
        eventId: key,
      };
    }
    store.webhookEvents.add(key);
    return { duplicate: false, processed: false, eventId: key };
  },

  async completeWebhookEvent({ providerEventId }): Promise<void> {
    state().processedWebhookEvents.add(`flutterwave:${providerEventId}`);
  },

  async expirePendingOrders(): Promise<number> {
    const cutoff = Date.now() - 10 * 60 * 1_000;
    let expired = 0;

    for (const order of state().orders.values()) {
      if (
        order.status === "PENDING_PAYMENT" &&
        order.paymentStatus === "PENDING" &&
        new Date(order.createdAt).getTime() < cutoff
      ) {
        order.status = "CANCELLED";
        order.paymentStatus = "FAILED";
        order.cancelledAt = new Date().toISOString();
        order.cancellationReason = "PAYMENT_TIMEOUT";
        recordStatus(
          order,
          "CANCELLED",
          "PAYMENT_TIMEOUT",
          order.cancelledAt,
        );
        expired += 1;

        const refs = state().attemptsByOrder.get(order.id) ?? [];
        for (const ref of refs) {
          const tx = state().attempts.get(ref);
          if (tx && (tx.status === "INITIATED" || tx.status === "PENDING")) {
            tx.status = "FAILED";
          }
        }
      }
    }

    return expired;
  },

  async storeCodOtp(input: StoreCodOtpInput): Promise<void> {
    const normalized = normalizeUgPhone(input.phone);
    if (!normalized) throw new OrderFailure("VALIDATION_ERROR");
    if (!/^[0-9]{6}$/.test(input.code)) throw new OrderFailure("VALIDATION_ERROR");

    state().otps.set(normalized, {
      code: input.code,
      expiresAt: new Date(input.expiresAt).getTime(),
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      consumed: false,
    });
  },

  async verifyCodOtp({
    phone,
    code,
  }: {
    phone: string;
    code: string;
  }): Promise<CodOtpResult> {
    const normalized = normalizeUgPhone(phone);
    const otp = normalized ? state().otps.get(normalized) : undefined;

    if (!otp || otp.consumed || otp.expiresAt <= Date.now()) {
      return { valid: false, reason: "OTP_REQUIRED", remainingAttempts: 0 };
    }

    if (otp.attempts >= otp.maxAttempts) {
      otp.consumed = true;
      return { valid: false, reason: "OTP_LOCKED", remainingAttempts: 0 };
    }

    if (otp.code === code) {
      otp.consumed = true;
      return {
        valid: true,
        reason: null,
        remainingAttempts: otp.maxAttempts - otp.attempts,
      };
    }

    otp.attempts += 1;
    if (otp.attempts >= otp.maxAttempts) otp.consumed = true;
    return {
      valid: false,
      reason:
        otp.attempts >= otp.maxAttempts ? "OTP_LOCKED" : "OTP_INVALID",
      remainingAttempts: Math.max(0, otp.maxAttempts - otp.attempts),
    };
  },

  async isReturningCustomer(phone: string): Promise<boolean> {
    const normalized = normalizeUgPhone(phone);
    return normalized ? state().deliveredPhones.has(normalized) : false;
  },

  async isPhoneBlacklisted(): Promise<boolean> {
    return false;
  },

  async attachPaymentProviderReference({
    transactionId,
    providerReference,
    rawPayload,
  }): Promise<void> {
    for (const tx of state().attempts.values()) {
      if (tx.transactionId === transactionId) {
        tx.providerTransactionId = providerReference;
        tx.rawPayload = { ...tx.rawPayload, ...rawPayload };
        return;
      }
    }
  },
};
