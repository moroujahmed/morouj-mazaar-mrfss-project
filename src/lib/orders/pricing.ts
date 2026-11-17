import {
  calculateDeliveryFee,
  formatUGX,
  isBeyondMaxDelivery,
} from "@/lib/currency";
import type { OrderItemInput } from "@/lib/schemas/order";
import {
  validateSelections,
  type SelectionMap,
} from "@/lib/storefront/cart";
import { selectionRules } from "@/lib/storefront/selection";
import type {
  ModifierOptionType,
  StorefrontItem,
  StorefrontMenu,
} from "@/lib/storefront/types";

import { OrderFailure } from "./errors";

/**
 * Authoritative server-side pricing. Every catalogue value is read from the
 * fresh menu snapshot; the request only carries item/modifier/option ids and
 * quantities. The database repeats this computation inside `create_order`, so
 * a caller that bypasses this module still cannot inject a price.
 */

export type PricedModifier = {
  modifierId: string | null;
  comboOptionId: string | null;
  name: string;
  priceDelta: number;
  type: ModifierOptionType;
  quantity: number;
};

export type PricedLine = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  modifiers: PricedModifier[];
};

export type PricedOrder = {
  lines: PricedLine[];
  itemsSubtotal: number;
  modifiersTotal: number;
  deliveryFee: number;
  packagingFee: number;
  total: number;
  distanceM: number | null;
  prepMinutes: number;
};

export type PricingMode = "delivery" | "dine-in";

function findItem(
  menu: StorefrontMenu,
  menuItemId: string,
): StorefrontItem | null {
  return menu.items.find((item) => item.id === menuItemId) ?? null;
}

function priceLine(
  menu: StorefrontMenu,
  input: OrderItemInput,
): { line: PricedLine; prepMinutes: number } {
  const item = findItem(menu, input.menuItemId);
  if (!item) {
    throw new OrderFailure(
      "ITEM_OUT_OF_STOCK",
      "An item in your cart is no longer on the menu. Remove it and try again.",
    );
  }

  if (!item.isAvailable) {
    throw new OrderFailure(
      "ITEM_OUT_OF_STOCK",
      `${item.name} just sold out. Remove it and try again.`,
    );
  }

  if (
    input.quantity < 1 ||
    input.quantity > menu.settings.maxItemQuantity ||
    input.quantity > 100
  ) {
    throw new OrderFailure(
      "VALIDATION_ERROR",
      `You can order at most ${menu.settings.maxItemQuantity} of one item.`,
      "items",
    );
  }

  const selected: Record<string, string[]> = {};
  const modifiers: PricedModifier[] = [];

  for (const modifierId of new Set(input.modifierIds)) {
    const group = item.modifierGroups.find((candidate) =>
      candidate.options.some((option) => option.id === modifierId),
    );
    const option = group?.options.find(
      (candidate) => candidate.id === modifierId,
    );

    if (!group || !option) {
      throw new OrderFailure(
        "VALIDATION_ERROR",
        `A selected option for ${item.name} is no longer available. Review your cart.`,
        "items",
      );
    }

    selected[group.id] = [...(selected[group.id] ?? []), option.id];
    modifiers.push({
      modifierId: option.id,
      comboOptionId: null,
      name: option.name,
      priceDelta: option.priceDelta,
      type: option.type,
      quantity: 1,
    });
  }

  const comboKeys = new Set<string>();
  for (const selection of input.comboSelections) {
    const step = item.comboSteps.find(
      (candidate) => candidate.id === selection.stepId,
    );
    const option = step?.options.find(
      (candidate) => candidate.id === selection.optionId,
    );

    if (!step || !option) {
      throw new OrderFailure(
        "VALIDATION_ERROR",
        `A combo choice for ${item.name} is no longer available. Review your cart.`,
        "items",
      );
    }

    const key = `${step.id}:${option.id}`;
    if (comboKeys.has(key)) continue;
    comboKeys.add(key);

    selected[step.id] = [...(selected[step.id] ?? []), option.id];
    modifiers.push({
      modifierId: null,
      comboOptionId: option.id,
      name: `${step.name}: ${option.name}`,
      priceDelta: option.priceDelta,
      type: "PAID_ADDON",
      quantity: 1,
    });
  }

  const issues = validateSelections(
    selectionRules(item),
    selected as SelectionMap,
  );
  if (issues.length > 0) {
    throw new OrderFailure("VALIDATION_ERROR", issues[0]?.message, "items");
  }

  return {
    line: {
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.basePrice,
      quantity: input.quantity,
      modifiers,
    },
    prepMinutes: item.prepTimeMinutes,
  };
}

export function priceOrder({
  menu,
  items,
  mode,
  distanceM,
  paymentMethod,
}: {
  menu: StorefrontMenu;
  items: OrderItemInput[];
  mode: PricingMode;
  distanceM: number | null;
  paymentMethod: "MTN_MOMO" | "AIRTEL_MONEY" | "BANK_CARD" | "CASH_ON_DELIVERY";
}): PricedOrder {
  const { settings } = menu;

  if (items.length === 0) {
    throw new OrderFailure("VALIDATION_ERROR", "Your cart is empty.", "items");
  }
  if (items.length > settings.maxCartLines) {
    throw new OrderFailure(
      "VALIDATION_ERROR",
      `Your cart can hold at most ${settings.maxCartLines} different lines.`,
      "items",
    );
  }

  const lines: PricedLine[] = [];
  let itemsSubtotal = 0;
  let modifiersTotal = 0;
  let prepMinutes = 0;

  for (const input of items) {
    const priced = priceLine(menu, input);
    lines.push(priced.line);
    prepMinutes = Math.max(prepMinutes, priced.prepMinutes);

    itemsSubtotal += priced.line.unitPrice * priced.line.quantity;
    const lineModifiers = priced.line.modifiers.reduce(
      (total, modifier) => total + modifier.priceDelta,
      0,
    );
    modifiersTotal += lineModifiers * priced.line.quantity;
  }

  const goodsSubtotal = itemsSubtotal + modifiersTotal;

  if (goodsSubtotal > settings.maxCartValue) {
    throw new OrderFailure(
      "VALIDATION_ERROR",
      `Your cart cannot exceed ${formatUGX(settings.maxCartValue)}.`,
      "items",
    );
  }

  const minimum =
    mode === "dine-in"
      ? settings.minimumOrderValueDineIn
      : settings.minimumOrderValue;

  if (goodsSubtotal < minimum) {
    const shortfall = minimum - goodsSubtotal;
    throw new OrderFailure(
      "MOV_NOT_MET",
      `Add ${formatUGX(shortfall)} more to reach the ${formatUGX(minimum)} minimum order.`,
      "items",
    );
  }

  let deliveryFee = 0;
  let packagingFee = 0;

  if (mode === "delivery") {
    if (distanceM === null || !Number.isInteger(distanceM) || distanceM < 0) {
      throw new OrderFailure(
        "DISTANCE_UNAVAILABLE",
        "Choose your delivery pin before placing the order.",
        "deliveryCoordinates",
      );
    }

    const maxMetres = Math.round(settings.maxDeliveryRadiusKm * 1_000);
    if (isBeyondMaxDelivery(distanceM, maxMetres)) {
      throw new OrderFailure(
        "DISTANCE_OUT_OF_BOUNDS",
        `This address is outside our ${settings.maxDeliveryRadiusKm} km delivery area. Choose another pin or dine in.`,
        "deliveryCoordinates",
      );
    }

    const freeMetres = Math.round(settings.freeDeliveryRadiusKm * 1_000);
    deliveryFee = calculateDeliveryFee(
      distanceM,
      settings.ratePerExcessKm,
      freeMetres,
    );
    packagingFee = settings.packagingFeeDefault;

    if (paymentMethod === "CASH_ON_DELIVERY") {
      const codMetres = Math.round(settings.codMaxRadiusKm * 1_000);
      if (distanceM > codMetres) {
        throw new OrderFailure(
          "COD_NOT_AVAILABLE",
          `Cash on delivery is only available within ${settings.codMaxRadiusKm} km. Choose another payment method.`,
          "paymentMethod",
        );
      }
    }
  } else {
    packagingFee = settings.packagingFeeDineIn;
  }

  return {
    lines,
    itemsSubtotal,
    modifiersTotal,
    deliveryFee,
    packagingFee,
    total: goodsSubtotal + deliveryFee + packagingFee,
    distanceM,
    prepMinutes,
  };
}
