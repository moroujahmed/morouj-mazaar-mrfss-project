"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { OrderFailure, toActionFailure, type ActionResult } from "@/lib/orders/errors";
import { priceOrder } from "@/lib/orders/pricing";
import { getOrderStore } from "@/lib/orders/store";
import type { CreateOrderRpcInput, CreatedOrder } from "@/lib/orders/store-types";
import { normalizeUgPhone } from "@/lib/phone";
import { clientIpFromHeaders, getRateLimiter } from "@/lib/routing/rate-limit";
import { resolveRoadRoute } from "@/lib/routing/resolve";
import { createOrderSchema, type CreateOrderInput } from "@/lib/schemas/order";
import { getStorefrontMenu } from "@/lib/storefront/menu";
import { getTableByToken } from "@/lib/storefront/public-settings";
import { getStoreStatus, storefrontNow } from "@/lib/storefront/store-status";

/**
 * `createOrderAction` — the only order-creation path.
 *
 * The client sends ids and quantities; every price, fee, and total is rebuilt
 * from the fresh menu and the database repeats the computation inside
 * `create_order`. Client totals are previews only.
 */

const CHECKOUT_IP_LIMIT = { max: 5, windowSeconds: 60 };
const CHECKOUT_PHONE_LIMIT = { max: 10, windowSeconds: 60 * 60 };
const PREP_BUFFER_MINUTES = 5;

export type CreateOrderResult = {
  orderToken: string;
  orderNumber: number;
  totalAmount: number;
  itemsSubtotal: number;
  modifiersTotal: number;
  deliveryFee: number;
  packagingFee: number;
  orderStatus: CreatedOrder["orderStatus"];
  paymentStatus: CreatedOrder["paymentStatus"];
  paymentMethod: CreateOrderInput["paymentMethod"];
  idempotent: boolean;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Stable payload fingerprint; the OTP is deliberately excluded. */
function requestHash(input: CreateOrderInput, phone: string): string {
  const items = input.items
    .map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      modifierIds: [...new Set(item.modifierIds)].sort(),
      comboSelections: [...item.comboSelections]
        .map((selection) => `${selection.stepId}:${selection.optionId}`)
        .sort(),
    }))
    .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId));

  return createHash("sha256")
    .update(
      canonicalJson({
        customerName: input.customerName.trim(),
        customerPhone: phone,
        customerNotes: input.customerNotes?.trim() || null,
        orderType: input.orderType,
        tableToken:
          input.orderType === "DINE_IN" ? input.tableToken.toLowerCase() : null,
        deliveryCoordinates:
          input.orderType === "DELIVERY" ? input.deliveryCoordinates : null,
        deliveryAddressText:
          input.orderType === "DELIVERY"
            ? input.deliveryAddressText.trim()
            : null,
        paymentMethod: input.paymentMethod,
        codChangeRequestedFor: input.codChangeRequestedFor ?? null,
        items,
      }),
    )
    .digest("hex");
}

async function enforceLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<void> {
  const limiter = getRateLimiter();
  let result;
  try {
    result = await limiter.consumeWithLimit(key, max, windowSeconds);
  } catch {
    // Fail closed: an unavailable limiter must not let traffic through.
    throw new OrderFailure(
      "RATE_LIMITED",
      "Too many attempts. Wait a moment and try again.",
    );
  }
  if (!result.allowed) {
    throw new OrderFailure(
      "RATE_LIMITED",
      "Too many attempts. Wait a moment and try again.",
    );
  }
}

export async function createOrderAction(
  payload: unknown,
): Promise<ActionResult<CreateOrderResult>> {
  try {
    const parsed = createOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return toActionFailure(
        new OrderFailure(
          "VALIDATION_ERROR",
          issue?.message ?? undefined,
          issue?.path.join("."),
        ),
      );
    }

    const input = parsed.data;
    const phone = normalizeUgPhone(input.customerPhone);
    if (!phone) {
      return toActionFailure(
        new OrderFailure(
          "VALIDATION_ERROR",
          "Enter a Ugandan mobile number.",
          "customerPhone",
        ),
      );
    }

    const requestHeaders = await headers();
    const ip = clientIpFromHeaders(requestHeaders);
    await enforceLimit(
      `mrfss:rl:checkout:ip:${ip}`,
      CHECKOUT_IP_LIMIT.max,
      CHECKOUT_IP_LIMIT.windowSeconds,
    );
    await enforceLimit(
      `mrfss:rl:checkout:phone:${phone}`,
      CHECKOUT_PHONE_LIMIT.max,
      CHECKOUT_PHONE_LIMIT.windowSeconds,
    );

    // Fresh menu: availability and prices are read now, not from the browser.
    const menuResult = await getStorefrontMenu();
    if (menuResult.status !== "ok") {
      throw new OrderFailure(
        "INTERNAL_ERROR",
        "The menu is unavailable right now. Try again shortly.",
      );
    }
    const { menu } = menuResult;

    const storeStatus = getStoreStatus(menu.settings, storefrontNow());
    if (!storeStatus.open) {
      throw new OrderFailure("STORE_CLOSED");
    }
    if (menu.settings.isKitchenPaused) {
      throw new OrderFailure("KITCHEN_PAUSED");
    }

    let tableId: string | null = null;
    if (input.orderType === "DINE_IN") {
      const table = await getTableByToken(input.tableToken);
      if (!table) {
        throw new OrderFailure(
          "VALIDATION_ERROR",
          "This table code is not active. Ask a member of staff for a new QR code.",
          "tableToken",
        );
      }
      tableId = table.tableId;
    }

    let distanceM: number | null = null;
    let travelMinutes: number | null = null;
    let etaAt: string | null = null;

    if (input.orderType === "DELIVERY") {
      const route = await resolveRoadRoute({
        destination: input.deliveryCoordinates,
        settings: menu.settings,
      });

      if (!route.ok) {
        throw route.code === "DISTANCE_OUT_OF_BOUNDS"
          ? new OrderFailure(
              "DISTANCE_OUT_OF_BOUNDS",
              `This address is outside our ${menu.settings.maxDeliveryRadiusKm} km delivery area. Choose another pin or dine in.`,
              "deliveryCoordinates",
            )
          : new OrderFailure(
              "DISTANCE_UNAVAILABLE",
              "We cannot calculate the delivery route right now. Try again shortly.",
              "deliveryCoordinates",
            );
      }

      distanceM = route.distanceM;
      travelMinutes = Math.max(1, Math.ceil(route.durationSeconds / 60));
    }

    const priced = priceOrder({
      menu,
      items: input.items,
      mode: input.orderType === "DINE_IN" ? "dine-in" : "delivery",
      distanceM,
      paymentMethod: input.paymentMethod,
    });

    if (distanceM !== null) {
      etaAt = new Date(
        Date.now() +
          (priced.prepMinutes + PREP_BUFFER_MINUTES + (travelMinutes ?? 0)) *
            60_000,
      ).toISOString();
    }

    const store = getOrderStore();

    // Cash on delivery is a credit decision: radius, blacklist, and a verified
    // phone number. Dine-in cash is settled at the table, so it is exempt.
    if (input.paymentMethod === "CASH_ON_DELIVERY" && input.orderType === "DELIVERY") {
      if (await store.isPhoneBlacklisted(phone)) {
        throw new OrderFailure(
          "COD_NOT_AVAILABLE",
          "Cash on delivery is unavailable for this number. Pay online to continue.",
          "paymentMethod",
        );
      }

      const returning = await store.isReturningCustomer(phone);
      if (!returning) {
        if (!input.otpCode) {
          throw new OrderFailure(
            "OTP_REQUIRED",
            "Enter the 6-digit code we sent to your phone.",
            "otpCode",
          );
        }
        const verification = await store.verifyCodOtp({
          phone,
          code: input.otpCode,
        });
        if (!verification.valid) {
          throw new OrderFailure(
            verification.reason ?? "OTP_INVALID",
            undefined,
            "otpCode",
          );
        }
      }
    }

    const rpcInput: CreateOrderRpcInput = {
      idempotencyKey: input.idempotencyKey,
      requestHash: requestHash(input, phone),
      customerName: input.customerName.trim(),
      customerPhone: phone,
      customerNotes: input.customerNotes?.trim() || null,
      orderType: input.orderType,
      tableId,
      deliveryAddressText:
        input.orderType === "DELIVERY"
          ? input.deliveryAddressText.trim()
          : null,
      deliveryLatitude:
        input.orderType === "DELIVERY" ? input.deliveryCoordinates.lat : null,
      deliveryLongitude:
        input.orderType === "DELIVERY" ? input.deliveryCoordinates.lng : null,
      roadDistanceM: distanceM,
      estimatedTravelMinutes: travelMinutes,
      etaAt,
      paymentMethod: input.paymentMethod,
      codChangeRequestedFor:
        input.paymentMethod === "CASH_ON_DELIVERY"
          ? (input.codChangeRequestedFor ?? null)
          : null,
      items: input.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        modifiers: [
          ...item.modifierIds.map((modifierId) => ({ modifierId })),
          ...item.comboSelections.map((selection) => ({
            comboOptionId: selection.optionId,
          })),
        ],
      })),
    };

    const created = await store.createOrder(rpcInput);

    return {
      ok: true,
      data: {
        orderToken: created.orderToken,
        orderNumber: created.orderNumber,
        totalAmount: created.totalAmount,
        itemsSubtotal: created.itemsSubtotal,
        modifiersTotal: created.modifiersTotal,
        deliveryFee: created.deliveryFee,
        packagingFee: created.packagingFee,
        orderStatus: created.orderStatus,
        paymentStatus: created.paymentStatus,
        paymentMethod: created.paymentMethod,
        idempotent: created.idempotent,
      },
    };
  } catch (error) {
    return toActionFailure(error);
  }
}
