import {
  calculateDeliveryFee,
  isBeyondMaxDelivery,
} from "@/lib/currency";
import type { StoreSettings } from "@/lib/storefront/types";

/**
 * Server and client share one quote builder. The checkout server action in the
 * next phase must recompute this from database settings and a fresh route;
 * client values are previews only.
 */

export type FulfilmentMode = "delivery" | "dine-in";

export type DeliveryQuote = {
  distanceM: number;
  distanceKm: number;
  durationSeconds: number;
  fee: number;
  excessKm: number;
  withinDeliveryArea: boolean;
  codAvailable: boolean;
  freeRadiusM: number;
  maxRadiusM: number;
  codRadiusM: number;
};

export function kmToMetres(km: number): number {
  return Math.round(km * 1_000);
}

/** Build the delivery fee/COD/routing quote from server-returned metres. */
export function buildDeliveryQuote(
  distanceM: number,
  durationSeconds: number,
  settings: StoreSettings,
): DeliveryQuote {
  const freeRadiusM = kmToMetres(settings.freeDeliveryRadiusKm);
  const maxRadiusM = kmToMetres(settings.maxDeliveryRadiusKm);
  const codRadiusM = kmToMetres(settings.codMaxRadiusKm);

  return {
    distanceM,
    distanceKm: distanceM / 1_000,
    durationSeconds,
    fee: calculateDeliveryFee(distanceM, settings.ratePerExcessKm, freeRadiusM),
    excessKm: Math.max(0, Math.ceil((distanceM - freeRadiusM) / 1_000)),
    withinDeliveryArea: !isBeyondMaxDelivery(distanceM, maxRadiusM),
    codAvailable: distanceM <= codRadiusM,
    freeRadiusM,
    maxRadiusM,
    codRadiusM,
  };
}

export function minimumOrderValue(
  settings: StoreSettings,
  mode: FulfilmentMode,
): number {
  return mode === "dine-in"
    ? settings.minimumOrderValueDineIn
    : settings.minimumOrderValue;
}

/** Whole UGX still needed to reach the minimum; `0` when it is already met. */
export function movRemaining(
  subtotal: number,
  settings: StoreSettings,
  mode: FulfilmentMode,
): number {
  return Math.max(0, minimumOrderValue(settings, mode) - subtotal);
}

export function packagingFee(
  settings: StoreSettings,
  mode: FulfilmentMode,
): number {
  return mode === "dine-in"
    ? settings.packagingFeeDineIn
    : settings.packagingFeeDefault;
}

export type OrderTotals = {
  itemsSubtotal: number;
  packagingFee: number;
  deliveryFee: number;
  total: number;
};

export function buildOrderTotals({
  subtotal,
  fee,
  settings,
  mode,
}: {
  subtotal: number;
  fee: number;
  settings: StoreSettings;
  mode: FulfilmentMode;
}): OrderTotals {
  const packaging = packagingFee(settings, mode);
  const delivery = mode === "dine-in" ? 0 : fee;

  return {
    itemsSubtotal: subtotal,
    packagingFee: packaging,
    deliveryFee: delivery,
    total: subtotal + packaging + delivery,
  };
}
