import "server-only";

import {
  acceptFixtureOrder,
  bumpFixtureOrder,
  getFixtureKitchenTicket,
  listFixtureKitchenTickets,
  recordFixtureReprint,
} from "@/lib/orders/fixture-store";
import {
  createFixtureMenu,
  createFixtureSettings,
  setFixtureItemAvailability,
  setFixtureKitchenBusy,
  setFixtureKitchenPaused,
} from "@/lib/storefront/fixture";

import type { KitchenMenuItem, KitchenSettings, KitchenTicket } from "./types";

export type KitchenBumpResult = {
  orderId: string;
  status: "READY_FOR_PICKUP" | "DELIVERED";
};

export interface KitchenStore {
  listTickets(): Promise<KitchenTicket[]>;
  getTicket(orderId: string): Promise<KitchenTicket | null>;
  acceptOrder(orderId: string): Promise<{ orderId: string; status: "PREPARING" }>;
  bumpOrder(orderId: string): Promise<KitchenBumpResult>;
  getSettings(): Promise<KitchenSettings>;
  setBusy(busy: boolean, bufferMinutes: number): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  listMenuItems(): Promise<KitchenMenuItem[]>;
  setItemAvailability(itemId: string, available: boolean): Promise<void>;
  auditReprint(orderId: string): Promise<void>;
}

function menuItems(): KitchenMenuItem[] {
  const result = createFixtureMenu();
  if (result.status !== "ok") return [];

  return result.menu.categories.flatMap((category) =>
    category.items.map((item) => ({
      id: item.id,
      name: item.name,
      categoryName: category.name,
      isAvailable: item.isAvailable,
    })),
  );
}

/**
 * In-memory kitchen store for Playwright (`STAFF_FIXTURE=1`). It reads and
 * writes the same fixture orders as checkout, so accept/bump/86/busy/pause
 * propagate through the storefront without a Supabase stack.
 */
export const fixtureKitchenStore: KitchenStore = {
  async listTickets() {
    return listFixtureKitchenTickets();
  },

  async getTicket(orderId) {
    return getFixtureKitchenTicket(orderId);
  },

  async acceptOrder(orderId) {
    acceptFixtureOrder(orderId);
    return { orderId, status: "PREPARING" };
  },

  async bumpOrder(orderId) {
    return { orderId, status: bumpFixtureOrder(orderId) };
  },

  async getSettings() {
    const settings = createFixtureSettings();
    return {
      isKitchenBusy: settings.isKitchenBusy,
      busyBufferMinutes: settings.busyBufferMinutes,
      isKitchenPaused: settings.isKitchenPaused,
    };
  },

  async setBusy(busy, bufferMinutes) {
    setFixtureKitchenBusy(busy, bufferMinutes);
  },

  async setPaused(paused) {
    setFixtureKitchenPaused(paused);
  },

  async listMenuItems() {
    return menuItems();
  },

  async setItemAvailability(itemId, available) {
    if (!setFixtureItemAvailability(itemId, available)) {
      throw new Error("ITEM_NOT_FOUND");
    }
  },

  async auditReprint(orderId) {
    recordFixtureReprint(orderId);
  },
};
