import "server-only";

import { randomUUID } from "node:crypto";

import { listFixtureStaff } from "@/lib/auth/fixture-staff";
import {
  adminFixtureCancelOrder,
  adminFixtureCompleteOrder,
  adminFixtureRedeliverOrder,
  adminFixtureReassignOrder,
  adminFixtureResetPin,
  adminFixtureUpdateContact,
  approveFixtureRefundRequest,
  getFixtureAdminOrderDetail,
  listFixtureAdminOrders,
  listFixtureRefundRequests,
} from "@/lib/orders/fixture-store";
import {
  applyFixtureSettingsOverrides,
  createFixtureMenu,
  resetFixtureKitchenStateForTests,
} from "@/lib/storefront/fixture";

import { AdminFailure } from "./errors";
import type { UpdateOrderContactInput } from "./schemas";
import type { AdminStore } from "./store-types";
import type {
  AdminCategory,
  AdminMenuItem,
  AdminSettings,
  AdminSnapshot,
  Analytics,
  AuditEvent,
  DiningTable,
  LedgerRow,
  StaffMember,
} from "./types";

/**
 * Test-only Admin Hub store (`STAFF_FIXTURE=1`). It mirrors the audited RPCs so
 * Playwright can exercise every action without a Supabase stack. State lives on
 * `globalThis` because Next.js evaluates this module in several server bundles.
 * It is never selected in production.
 */

const SEED_SETTINGS: AdminSettings = {
  restaurantName: "Bazaar Flame & Grill",
  restaurantLat: 0.3136,
  restaurantLng: 32.5811,
  supportWhatsapp: "+256700000000",
  freeDeliveryRadiusKm: 5,
  ratePerExcessKm: 1500,
  maxDeliveryRadiusKm: 15,
  codMaxRadiusKm: 8.1,
  minimumOrderValue: 20_000,
  minimumOrderValueDineIn: 0,
  packagingFeeDefault: 1_000,
  packagingFeeDineIn: 0,
  maxCartValue: 200_000,
  maxItemQuantity: 20,
  maxCartLines: 30,
  isStoreOpen: true,
  openingTime: "10:00:00",
  closingTime: "22:00:00",
  isKitchenBusy: false,
  busyBufferMinutes: 20,
  isKitchenPaused: false,
  pinMaxAttempts: 3,
  pinLockMinutes: 15,
  pinGeofenceM: 300,
  staffSessionHours: 12,
};

const SEED_TABLES: DiningTable[] = [
  { tableId: "77777777-7777-4777-8777-777777777701", tableNumber: "T1", label: "Window 1", qrToken: "88888888-8888-4888-8888-888888888801", isActive: true },
  { tableId: "77777777-7777-4777-8777-777777777702", tableNumber: "T2", label: "Window 2", qrToken: "88888888-8888-4888-8888-888888888802", isActive: true },
  { tableId: "77777777-7777-4777-8777-777777777703", tableNumber: "T3", label: "Garden 1", qrToken: "88888888-8888-4888-8888-888888888803", isActive: true },
  { tableId: "77777777-7777-4777-8777-777777777704", tableNumber: "T4", label: "Food Court Table T4", qrToken: "88888888-8888-4888-8888-888888888804", isActive: true },
  { tableId: "77777777-7777-4777-8777-777777777705", tableNumber: "T5", label: "Garden 3", qrToken: "88888888-8888-4888-8888-888888888805", isActive: true },
  { tableId: "77777777-7777-4777-8777-777777777706", tableNumber: "T6", label: "Counter 1", qrToken: "88888888-8888-4888-8888-888888888806", isActive: true },
  { tableId: "77777777-7777-4777-8777-777777777707", tableNumber: "T7", label: "Counter 2", qrToken: "88888888-8888-4888-8888-888888888807", isActive: true },
  { tableId: "77777777-7777-4777-8777-777777777708", tableNumber: "T8", label: "Counter 3", qrToken: "88888888-8888-4888-8888-888888888808", isActive: true },
];

type AdminFixtureState = {
  settings: AdminSettings;
  menu: AdminMenuItem[];
  categories: Array<Omit<AdminCategory, "items">>;
  staff: StaffMember[];
  tables: DiningTable[];
  audit: AuditEvent[];
  settlements: Map<string, { expectedCash: number; countedCash: number; status: string; notes: string | null }>;
};

type AdminFixtureGlobal = typeof globalThis & {
  __mrfssAdmin?: AdminFixtureState;
};

function seedMenu(): { menu: AdminMenuItem[]; categories: Array<Omit<AdminCategory, "items">> } {
  const built = createFixtureMenu();
  const menu: AdminMenuItem[] = [];
  const categories: Array<Omit<AdminCategory, "items">> = [];
  if (built.status !== "ok") return { menu, categories };

  for (const category of built.menu.categories) {
    categories.push({
      categoryId: category.id,
      name: category.name,
      slug: category.slug,
      displayOrder: category.displayOrder,
    });
    for (const item of category.items) {
      menu.push({
        itemId: item.id,
        categoryId: item.categoryId,
        name: item.name,
        slug: item.slug,
        description: item.description,
        basePrice: item.basePrice,
        imageUrl: item.imageUrl || null,
        prepTimeMinutes: item.prepTimeMinutes,
        isAvailable: item.isAvailable,
        isCombo: item.isCombo,
        sortOrder: item.sortOrder,
      });
    }
  }
  return { menu, categories };
}

function state(): AdminFixtureState {
  const globalStore = globalThis as AdminFixtureGlobal;
  if (!globalStore.__mrfssAdmin) {
    const seeded = seedMenu();
    globalStore.__mrfssAdmin = {
      settings: { ...SEED_SETTINGS },
      menu: seeded.menu,
      categories: seeded.categories,
      staff: listFixtureStaff().map((member) => ({
        profileId: member.userId,
        fullName: member.fullName,
        phone: member.phone,
        role: member.role,
        isActive: true,
        motorcyclePlate: member.motorcyclePlate,
      })),
      tables: SEED_TABLES.map((table) => ({ ...table })),
      audit: [],
      settlements: new Map(),
    };
  }
  return globalStore.__mrfssAdmin;
}

export function resetAdminFixtureForTests(): void {
  const globalStore = globalThis as AdminFixtureGlobal;
  delete globalStore.__mrfssAdmin;
  resetFixtureKitchenStateForTests();
}

function audit(
  action: string,
  entityType: string,
  entityId: string,
  reason: string,
  before: unknown,
  after: unknown,
): void {
  state().audit.push({
    id: randomUUID(),
    actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
    actorName: "Admin Kasule",
    actorRole: "ADMIN",
    action,
    entityType,
    entityId,
    reason,
    before,
    after,
    createdAt: new Date().toISOString(),
  });
}

function businessDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" });
}

function computeLedger(date: string): LedgerRow[] {
  const orders = listFixtureAdminOrders().filter(
    (order) =>
      order.paymentMethod === "CASH_ON_DELIVERY" &&
      order.paymentStatus === "PAID" &&
      order.status === "DELIVERED",
  );
  return state().staff
    .filter((member) => member.role === "RIDER" && member.isActive)
    .map((rider) => {
      const linked = orders.filter((order) => order.riderId === rider.profileId);
      const expectedCash = linked.reduce((sum, order) => sum + order.totalAmount, 0);
      const settlement = state().settlements.get(`${rider.profileId}:${date}`);
      const settledCash = settlement?.countedCash ?? 0;
      return {
        riderId: rider.profileId,
        riderName: rider.fullName,
        motorcyclePlate: rider.motorcyclePlate,
        expectedCash,
        settledCash,
        variance: settledCash - expectedCash,
        status: settlement ? settlement.status : expectedCash > 0 ? "OPEN" : "NONE",
        linkedOrders: linked.map((order) => ({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          amount: order.totalAmount,
        })),
      };
    });
}

function computeAnalytics(): Analytics {
  const orders = listFixtureAdminOrders();
  const delivered = orders.filter(
    (order) => order.status === "DELIVERED" && order.paymentStatus === "PAID",
  );
  const gross = delivered.reduce((sum, order) => sum + order.totalAmount, 0);
  const cod = delivered
    .filter((order) => order.paymentMethod === "CASH_ON_DELIVERY")
    .reduce((sum, order) => sum + order.totalAmount, 0);
  const counts = new Map<string, number>();
  for (const detail of orders) {
    for (const line of getFixtureAdminOrderDetail(detail.orderId)?.items ?? []) {
      counts.set(line.name, (counts.get(line.name) ?? 0) + line.quantity);
    }
  }
  return {
    from: new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10),
    to: businessDate(),
    orders: orders.length,
    deliveredOrders: orders.filter((order) => order.status === "DELIVERED").length,
    cancelledOrders: orders.filter((order) => order.status === "CANCELLED").length,
    grossRevenue: gross,
    codCollected: cod,
    digitalCollected: gross - cod,
    averageOrderValue: delivered.length ? Math.round(gross / delivered.length) : 0,
    averagePrepMinutes: 0,
    averageDeliveryMinutes: 0,
    topItems: [...counts.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 10),
  };
}

export function createFixtureAdminStore(): AdminStore {
  return {
    async snapshot(): Promise<AdminSnapshot> {
      const store = state();
      return {
        settings: { ...store.settings },
        orders: listFixtureAdminOrders(),
        ledger: computeLedger(businessDate()),
        analytics: computeAnalytics(),
        audit: [...store.audit].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt),
        ),
        menu: store.categories.map((category) => ({
          ...category,
          items: store.menu
            .filter((item) => item.categoryId === category.categoryId)
            .sort((left, right) => left.sortOrder - right.sortOrder),
        })),
        staff: [...store.staff],
        tables: [...store.tables],
        refunds: listFixtureRefundRequests(),
        fetchedAt: new Date().toISOString(),
      };
    },

    async listOrders({ status, search, limit = 50, offset = 0 } = {}) {
      let orders = listFixtureAdminOrders();
      if (status) orders = orders.filter((order) => order.status === status);
      if (search) {
        const needle = search.toLowerCase();
        orders = orders.filter(
          (order) =>
            String(order.orderNumber).includes(needle) ||
            order.customerName.toLowerCase().includes(needle) ||
            order.customerPhone.includes(needle),
        );
      }
      return {
        total: orders.length,
        limit,
        offset,
        orders: orders.slice(offset, offset + limit),
      };
    },

    async getOrder(orderId) {
      const detail = getFixtureAdminOrderDetail(orderId);
      if (!detail) throw new AdminFailure("ORDER_NOT_FOUND");
      return detail;
    },

    async updateContact(input: UpdateOrderContactInput) {
      const before = getFixtureAdminOrderDetail(input.orderId);
      try {
        const detail = adminFixtureUpdateContact(input);
        audit(
          "ADMIN_UPDATE_ORDER_CONTACT",
          "orders",
          input.orderId,
          input.reason,
          before,
          detail,
        );
        return detail;
      } catch (error) {
        throw fromBridge(error);
      }
    },

    async cancelOrder(orderId, reason) {
      try {
        adminFixtureCancelOrder(orderId, reason);
        audit("ADMIN_CANCEL_ORDER", "orders", orderId, reason, null, { status: "CANCELLED" });
        return { orderId };
      } catch (error) {
        throw fromBridge(error);
      }
    },

    async completeOrder(orderId, reason) {
      try {
        adminFixtureCompleteOrder(orderId, reason);
        audit("ADMIN_COMPLETE_ORDER", "orders", orderId, reason, null, { status: "DELIVERED" });
        return { orderId };
      } catch (error) {
        throw fromBridge(error);
      }
    },

    async reassignOrder(orderId, riderId, reason) {
      const rider = state().staff.find((member) => member.profileId === riderId);
      if (!rider || rider.role !== "RIDER" || !rider.isActive) {
        throw new AdminFailure("VALIDATION_ERROR", "Choose an active rider.");
      }
      try {
        adminFixtureReassignOrder(orderId, riderId, rider.fullName, reason);
        audit("ADMIN_REASSIGN_ORDER", "orders", orderId, reason, null, { riderId });
        return { orderId, riderId };
      } catch (error) {
        throw fromBridge(error);
      }
    },

    async redeliverOrder(orderId, reason, riderId) {
      const rider = riderId
        ? state().staff.find((member) => member.profileId === riderId)
        : null;
      if (riderId && (!rider || rider.role !== "RIDER" || !rider.isActive)) {
        throw new AdminFailure("VALIDATION_ERROR", "Choose an active rider.");
      }
      try {
        const status = adminFixtureRedeliverOrder(
          orderId,
          reason,
          riderId,
          rider?.fullName ?? null,
        );
        audit("ADMIN_REDELIVER_ORDER", "orders", orderId, reason, null, { status, riderId });
        return { orderId, status, riderId: riderId ?? null };
      } catch (error) {
        throw fromBridge(error);
      }
    },

    async resetPin(orderId, reason) {
      try {
        adminFixtureResetPin(orderId, reason);
        audit("ADMIN_RESET_HANDOVER_PIN", "orders", orderId, reason, null, { pinReset: true });
        return { orderId };
      } catch (error) {
        throw fromBridge(error);
      }
    },

    async approveRefund(refundId, decision, notes) {
      try {
        const result = approveFixtureRefundRequest(refundId, decision, notes);
        audit("ADMIN_APPROVE_REFUND", "refunds", refundId, notes ?? decision, null, result);
        return result;
      } catch (error) {
        throw fromBridge(error);
      }
    },

    async reconcileCash(riderId, countedCash, notes, businessDateValue) {
      const rider = state().staff.find((member) => member.profileId === riderId);
      if (!rider || rider.role !== "RIDER" || !rider.isActive) {
        throw new AdminFailure("VALIDATION_ERROR", "Choose an active rider.");
      }
      const date = businessDateValue ?? businessDate();
      const expectedCash = computeLedger(date).find(
        (row) => row.riderId === riderId,
      )?.expectedCash ?? 0;
      const shortfall = Math.max(expectedCash - countedCash, 0);
      const result = {
        success: true,
        riderId,
        businessDate: date,
        expectedCash,
        countedCash,
        variance: countedCash - expectedCash,
        shortfall,
        status: shortfall === 0 ? "SETTLED" : "PARTIAL",
      };
      state().settlements.set(`${riderId}:${date}`, {
        expectedCash,
        countedCash,
        status: result.status,
        notes,
      });
      audit("RECONCILE_RIDER_CASH", "cash_settlements", riderId, notes, null, result);
      return result;
    },

    async updateSettings(patch, reason) {
      const store = state();
      const before = { ...store.settings };
      const { reason: _reason, ...changes } = patch;
      Object.assign(store.settings, changes);
      applyFixtureSettingsOverrides(changes);
      audit("ADMIN_UPDATE_SETTINGS", "app_settings", "1", reason, before, store.settings);
      return { ...store.settings };
    },

    async upsertCategory(input, reason) {
      const store = state();
      const before = input.categoryId
        ? store.categories.find((category) => category.categoryId === input.categoryId) ?? null
        : null;
      const categoryId = String(input.categoryId ?? randomUUID());
      const updated = {
        categoryId,
        name: String(input.name),
        slug: String(input.slug),
        displayOrder: Number(input.displayOrder),
      };
      const index = store.categories.findIndex(
        (candidate) => candidate.categoryId === categoryId,
      );
      if (index >= 0) store.categories[index] = updated;
      else store.categories.push(updated);
      audit("ADMIN_UPSERT_CATEGORY", "categories", categoryId, reason, before, updated);
      return updated;
    },

    async upsertMenuItem(input, reason) {
      const store = state();
      const before = input.itemId
        ? store.menu.find((item) => item.itemId === input.itemId) ?? null
        : null;
      const itemId = String(input.itemId ?? randomUUID());
      const updated: AdminMenuItem = {
        itemId,
        categoryId: String(input.categoryId),
        name: String(input.name),
        slug: String(input.slug),
        description: (input.description as string | null | undefined) ?? null,
        basePrice: Number(input.basePrice),
        imageUrl: (input.imagePath as string | null | undefined) ?? null,
        prepTimeMinutes: Number(input.prepTimeMinutes),
        isAvailable: Boolean(input.isAvailable),
        isCombo: Boolean(input.isCombo),
        sortOrder: Number(input.sortOrder),
      };
      const index = store.menu.findIndex((item) => item.itemId === itemId);
      if (index >= 0) store.menu[index] = updated;
      else store.menu.push(updated);
      audit("ADMIN_UPSERT_MENU_ITEM", "menu_items", itemId, reason, before, updated);
      return updated;
    },

    async archiveMenuItem(itemId, reason) {
      const store = state();
      const item = store.menu.find((candidate) => candidate.itemId === itemId);
      if (!item) throw new AdminFailure("ITEM_NOT_FOUND");
      const before = { ...item };
      item.isAvailable = false;
      audit("ADMIN_ARCHIVE_MENU_ITEM", "menu_items", itemId, reason, before, item);
      return item;
    },

    async upsertTable(input, reason) {
      const store = state();
      const before = input.tableId
        ? store.tables.find((table) => table.tableId === input.tableId) ?? null
        : null;
      const tableId = String(input.tableId ?? randomUUID());
      const updated: DiningTable = {
        tableId,
        tableNumber: String(input.tableNumber),
        label: String(input.label),
        qrToken: before?.qrToken ?? randomUUID(),
        isActive: Boolean(input.isActive),
      };
      const index = store.tables.findIndex((table) => table.tableId === tableId);
      if (index >= 0) store.tables[index] = updated;
      else store.tables.push(updated);
      audit("ADMIN_UPSERT_TABLE", "tables", tableId, reason, before, updated);
      return updated;
    },

    async updateStaff(input, reason) {
      const store = state();
      const member = store.staff.find(
        (candidate) => candidate.profileId === input.profileId,
      );
      if (!member) throw new AdminFailure("VALIDATION_ERROR", "Staff member not found.");
      const activeAdmins = store.staff.filter(
        (candidate) => candidate.role === "ADMIN" && candidate.isActive,
      );
      if (
        member.role === "ADMIN" &&
        (input.role !== "ADMIN" || input.isActive === false) &&
        activeAdmins.length === 1
      ) {
        throw new AdminFailure("LAST_ADMIN_PROTECTED");
      }
      const before = { ...member };
      member.role = input.role as StaffMember["role"];
      member.isActive = Boolean(input.isActive);
      member.motorcyclePlate = (input.motorcyclePlate as string | null | undefined) ?? null;
      audit("ADMIN_UPDATE_STAFF", "profiles", member.profileId, reason, before, { ...member });
      return { ...member };
    },

    async listStaff() {
      return [...state().staff];
    },

    async listRefunds() {
      return listFixtureRefundRequests();
    },

    async auditFeed({ limit = 50, offset = 0, entityType } = {}) {
      let events = [...state().audit].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
      if (entityType) events = events.filter((entry) => entry.entityType === entityType);
      return { total: events.length, limit, offset, events: events.slice(offset, offset + limit) };
    },
  };
}

function fromBridge(error: unknown): AdminFailure {
  if (error instanceof AdminFailure) return error;
  if (error instanceof Error) {
    const map: Record<string, AdminFailure> = {
      ORDER_NOT_FOUND: new AdminFailure("ORDER_NOT_FOUND"),
      ORDER_STATE_INVALID: new AdminFailure("ORDER_STATE_INVALID"),
      RIDER_HAS_ACTIVE_ORDER: new AdminFailure("VALIDATION_ERROR", "That rider already has an active order."),
      REFUND_NOT_FOUND: new AdminFailure("REFUND_NOT_FOUND"),
    };
    return map[error.message] ?? new AdminFailure("INTERNAL_ERROR", error.message);
  }
  return new AdminFailure("INTERNAL_ERROR");
}
