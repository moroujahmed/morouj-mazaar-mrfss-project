import "server-only";

import { randomInt, randomUUID } from "node:crypto";

import { normalizeUgPhone } from "@/lib/phone";
import type { OrderItemInput } from "@/lib/schemas/order";
import { createFixtureMenu } from "@/lib/storefront/fixture";

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
  items: PricedLine[];
};

type OtpRecord = {
  code: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  consumed: boolean;
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
  nextOrderNumber: number;
  refunds: number;
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
    nextOrderNumber: 1042,
    refunds: 0,
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

export function getFixtureOrderByToken(token: string): FixtureOrder | null {
  const id = state().tokenIndex.get(token);
  return id ? (state().orders.get(id) ?? null) : null;
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

    const order: FixtureOrder = {
      id: randomUUID(),
      token: randomUUID(),
      number: store.nextOrderNumber,
      type: input.orderType,
      source: input.orderType === "DINE_IN" ? "TABLE_QR" : "WEB",
      status:
        input.paymentMethod === "CASH_ON_DELIVERY"
          ? "CONFIRMED_UNPAID"
          : "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      method: input.paymentMethod,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerPhoneNormalized:
        normalizeUgPhone(input.customerPhone) ?? input.customerPhone,
      notes: input.customerNotes,
      tableId: input.tableId,
      tableNumber: null,
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
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      items: priced.lines,
    };

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
      deliveryArea: null,
      itemsSubtotal: order.itemsSubtotal,
      modifiersTotal: order.modifiersTotal,
      deliveryFee: order.deliveryFee,
      packagingFee: order.packagingFee,
      totalAmount: order.total,
      codChangeRequestedFor: order.codChangeRequestedFor,
      codChangeDue: order.codChangeDue,
      etaAt: order.etaAt,
      acknowledgedAt: order.acknowledgedAt,
      roadDistanceM: order.distanceM,
      estimatedTravelMinutes: order.travelMinutes,
      createdAt: order.createdAt,
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
      return { duplicate: true, eventId: null };
    }
    store.webhookEvents.add(key);
    return { duplicate: false, eventId: key };
  },

  async completeWebhookEvent(): Promise<void> {
    // In-memory events have no processing column.
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
