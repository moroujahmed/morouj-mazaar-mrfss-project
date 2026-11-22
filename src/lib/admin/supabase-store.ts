import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { AdminFailure } from "./errors";
import type { UpdateOrderContactInput } from "./schemas";
import type { AdminStore } from "./store-types";
import {
  adminOrderListSchema,
  adminOrderSummarySchema,
  adminSettingsSchema,
  analyticsSchema,
  auditEventSchema,
  auditFeedSchema,
  diningTableSchema,
  ledgerRowSchema,
  refundRequestSchema,
  staffMemberSchema,
  type AdminOrderDetail,
  type AdminSettings,
  type AdminSnapshot,
} from "./types";

/**
 * Supabase-backed Admin Hub store. Mutations go only through the audited
 * SECURITY DEFINER RPCs (so `auth.uid()` is the audit actor). Reads of the
 * administrator-only tables use the service-role client from a server module;
 * the caller is already gated to ADMIN before this store is reached.
 */

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) {
    const message = error.message || name;
    const code = message.toUpperCase().startsWith("LAST_ADMIN_PROTECTED")
      ? "LAST_ADMIN_PROTECTED"
      : message.toUpperCase().startsWith("VALIDATION_ERROR")
        ? "VALIDATION_ERROR"
        : message.toUpperCase().startsWith("ORDER_NOT_FOUND")
          ? "ORDER_NOT_FOUND"
          : "INTERNAL_ERROR";
    throw new AdminFailure(code as never, message);
  }
  return data;
}

function approval<T>(schema: { parse: (value: unknown) => T }): (value: unknown) => T {
  return (value: unknown) => schema.parse(value ?? {});
}

const parseOrderList = approval(adminOrderListSchema);
const parseSettings = approval(adminSettingsSchema);
const parseAnalytics = approval(analyticsSchema);
const parseAuditFeed = approval(auditFeedSchema);

/**
 * `app_settings` uses snake_case columns while the admin UI and the Zod schema
 * use camelCase. Both the service-role table read and the settings RPC return
 * the raw snake_case row, so map it in one place.
 */
const SETTINGS_KEYS: Record<string, string> = {
  restaurant_name: "restaurantName",
  restaurant_lat: "restaurantLat",
  restaurant_lng: "restaurantLng",
  support_whatsapp: "supportWhatsapp",
  free_delivery_radius_km: "freeDeliveryRadiusKm",
  rate_per_excess_km: "ratePerExcessKm",
  max_delivery_radius_km: "maxDeliveryRadiusKm",
  cod_max_radius_km: "codMaxRadiusKm",
  minimum_order_value: "minimumOrderValue",
  minimum_order_value_dine_in: "minimumOrderValueDineIn",
  packaging_fee_default: "packagingFeeDefault",
  packaging_fee_dine_in: "packagingFeeDineIn",
  max_cart_value: "maxCartValue",
  max_item_quantity: "maxItemQuantity",
  max_cart_lines: "maxCartLines",
  is_store_open: "isStoreOpen",
  opening_time: "openingTime",
  closing_time: "closingTime",
  is_kitchen_busy: "isKitchenBusy",
  busy_buffer_minutes: "busyBufferMinutes",
  is_kitchen_paused: "isKitchenPaused",
  pin_max_attempts: "pinMaxAttempts",
  pin_lock_minutes: "pinLockMinutes",
  pin_geofence_m: "pinGeofenceM",
  staff_session_hours: "staffSessionHours",
};

function mapSettingsRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[SETTINGS_KEYS[key] ?? key] = value;
  }
  return mapped;
}

async function readSettings(): Promise<AdminSettings> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) throw new AdminFailure("INTERNAL_ERROR", "Settings unavailable.");
  return parseSettings(mapSettingsRow(data as unknown as Record<string, unknown>));
}

async function readMenu() {
  const admin = createAdminClient();
  const [categories, items] = await Promise.all([
    admin
      .from("categories")
      .select("id, name, slug, display_order")
      .order("display_order", { ascending: true }),
    admin
      .from("menu_items")
      .select(
        "id, category_id, name, slug, description, base_price, image_url, prep_time_minutes, is_available, is_combo, sort_order",
      )
      .order("sort_order", { ascending: true }),
  ]);
  if (categories.error || items.error) {
    throw new AdminFailure("INTERNAL_ERROR", "Menu unavailable.");
  }
  return (categories.data ?? []).map((category) => ({
    categoryId: category.id,
    name: category.name,
    slug: category.slug,
    displayOrder: category.display_order,
    items: (items.data ?? [])
      .filter((item) => item.category_id === category.id)
      .map((item) => ({
        itemId: item.id,
        categoryId: item.category_id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        basePrice: item.base_price,
        imageUrl: item.image_url,
        prepTimeMinutes: item.prep_time_minutes,
        isAvailable: item.is_available,
        isCombo: item.is_combo,
        sortOrder: item.sort_order,
      })),
  }));
}

async function readStaff() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, phone_number, role, is_active, motorcycle_plate")
    .order("full_name", { ascending: true });
  if (error) throw new AdminFailure("INTERNAL_ERROR", "Staff directory unavailable.");
  return (data ?? []).map((row) =>
    staffMemberSchema.parse({
      profileId: row.id,
      fullName: row.full_name,
      phone: row.phone_number,
      role: row.role,
      isActive: row.is_active,
      motorcyclePlate: row.motorcycle_plate,
    }),
  );
}

async function readTables() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tables")
    .select("id, table_number, label, qr_token, is_active")
    .order("table_number", { ascending: true });
  if (error) throw new AdminFailure("INTERNAL_ERROR", "Tables unavailable.");
  return (data ?? []).map((row) =>
    diningTableSchema.parse({
      tableId: row.id,
      tableNumber: row.table_number,
      label: row.label,
      qrToken: row.qr_token,
      isActive: row.is_active,
    }),
  );
}

async function readRefunds() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("refunds")
    .select(
      "id, order_id, amount, status, reason, approval_notes, created_at, orders(order_number)",
    )
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => {
    const relation = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    return refundRequestSchema.parse({
      refundId: row.id,
      orderId: row.order_id,
      orderNumber: relation?.order_number ?? undefined,
      amount: row.amount,
      status: row.status,
      reason: row.reason,
      notes: row.approval_notes,
      requestedAt: row.created_at,
    });
  });
}

export const supabaseAdminStore: AdminStore = {
  async snapshot(): Promise<AdminSnapshot> {
    const [settings, menu, staff, tables, refunds, orders, ledger, analytics, audit] =
      await Promise.all([
        readSettings(),
        readMenu(),
        readStaff(),
        readTables(),
        readRefunds(),
        rpc("admin_list_orders", { p_limit: 200 }),
        rpc("get_admin_ledger", {}),
        rpc("get_admin_analytics", {}),
        rpc("admin_get_audit_feed", { p_limit: 100 }),
      ]);

    const parsedOrders = parseOrderList(orders);
    return {
      settings,
      orders: parsedOrders.orders.map((order) => adminOrderSummarySchema.parse(order)),
      ledger: (ledger as unknown[]).map((row) => ledgerRowSchema.parse(row)),
      analytics: parseAnalytics(analytics),
      audit: (parseAuditFeed(audit).events ?? []).map((event) =>
        auditEventSchema.parse(event),
      ),
      menu,
      staff,
      tables,
      refunds,
      fetchedAt: new Date().toISOString(),
    };
  },

  async listOrders(input) {
    return parseOrderList(
      await rpc("admin_list_orders", {
        p_status: input.status ?? null,
        p_search: input.search ?? null,
        p_limit: input.limit ?? 50,
        p_offset: input.offset ?? 0,
      }),
    );
  },

  async getOrder(orderId) {
    const data = await rpc("admin_get_order", { p_order_id: orderId });
    return data as AdminOrderDetail;
  },

  async updateContact(input: UpdateOrderContactInput) {
    await rpc("admin_update_order_contact", {
      p_order_id: input.orderId,
      p_customer_name: input.customerName ?? null,
      p_customer_phone: input.customerPhone ?? null,
      p_customer_notes: input.customerNotes ?? null,
      p_delivery_address_text: input.deliveryAddressText ?? null,
      p_delivery_area: input.deliveryArea ?? null,
      p_delivery_latitude: input.deliveryLatitude ?? null,
      p_delivery_longitude: input.deliveryLongitude ?? null,
      p_road_distance_m: input.roadDistanceM ?? null,
      p_delivery_fee: input.deliveryFee ?? null,
      p_reason: input.reason,
    });
    return this.getOrder(input.orderId);
  },

  async cancelOrder(orderId, reason) {
    await rpc("admin_cancel_order", { p_order_id: orderId, p_reason: reason });
    return { orderId };
  },

  async completeOrder(orderId, reason) {
    await rpc("admin_complete_order", { p_order_id: orderId, p_reason: reason });
    return { orderId };
  },

  async reassignOrder(orderId, riderId, reason) {
    await rpc("admin_reassign_order", {
      p_order_id: orderId,
      p_rider_id: riderId,
      p_reason: reason,
    });
    return { orderId, riderId };
  },

  async redeliverOrder(orderId, reason, riderId) {
    const data = (await rpc("admin_redeliver_order", {
      p_order_id: orderId,
      p_reason: reason,
      p_rider_id: riderId ?? null,
    })) as { status?: string; riderId?: string | null };
    return {
      orderId,
      status: data.status ?? "READY_FOR_PICKUP",
      riderId: data.riderId ?? riderId ?? null,
    };
  },

  async resetPin(orderId, reason) {
    await rpc("admin_reset_handover_pin", { p_order_id: orderId, p_reason: reason });
    return { orderId };
  },

  async approveRefund(refundId, decision, notes) {
    const data = (await rpc("admin_approve_refund", {
      p_refund_id: refundId,
      p_decision: decision,
      p_notes: notes ?? null,
    })) as { status?: string };
    return { refundId, status: data.status ?? (decision === "APPROVE" ? "PROCESSING" : "FAILED") };
  },

  async reconcileCash(riderId, countedCash, notes, businessDate) {
    return (await rpc("reconcile_rider_cash", {
      p_rider_id: riderId,
      p_counted_cash: countedCash,
      p_notes: notes,
      p_business_date: businessDate ?? null,
    })) as Record<string, unknown>;
  },

  async updateSettings(patch, reason) {
    const { reason: _reason, ...payload } = patch;
    const data = (await rpc("admin_update_settings", {
      p_payload: payload,
      p_reason: reason,
    })) as { settings?: Record<string, unknown> };
    return parseSettings(mapSettingsRow(data.settings ?? data));
  },

  async upsertCategory(input, reason) {
    // The RPC reads the entity id from `id`, while the UI contract uses
    // `categoryId`.
    const payload: Record<string, unknown> = { ...input };
    payload.id = input.categoryId;
    delete payload.categoryId;
    return rpc("admin_upsert_category", { p_payload: payload, p_reason: reason });
  },

  async upsertMenuItem(input, reason) {
    const payload: Record<string, unknown> = { ...input };
    payload.id = input.itemId;
    payload.imageUrl = input.imagePath ?? null;
    delete payload.itemId;
    delete payload.imagePath;
    return rpc("admin_upsert_menu_item", { p_payload: payload, p_reason: reason });
  },

  async archiveMenuItem(itemId, reason) {
    // A soft archive goes through the same audited upsert RPC, so send the full
    // existing row with `isAvailable` flipped (the RPC validates required keys).
    const menu = await readMenu();
    const item = menu.flatMap((category) => category.items).find(
      (candidate) => candidate.itemId === itemId,
    );
    if (!item) throw new AdminFailure("ITEM_NOT_FOUND");
    return rpc("admin_upsert_menu_item", {
      p_payload: {
        ...item,
        id: itemId,
        imageUrl: item.imageUrl ?? null,
        isAvailable: false,
      },
      p_reason: reason,
    });
  },

  async upsertTable(input, reason) {
    const payload: Record<string, unknown> = { ...input };
    payload.id = input.tableId;
    delete payload.tableId;
    const data = (await rpc("admin_upsert_table", {
      p_payload: payload,
      p_reason: reason,
    })) as { tableId?: string; qrToken?: string };
    return diningTableSchema.parse({
      tableId: data.tableId ?? input.tableId,
      tableNumber: input.tableNumber,
      label: input.label,
      qrToken: data.qrToken,
      isActive: input.isActive,
    });
  },

  async updateStaff(input, reason) {
    await rpc("admin_update_staff", {
      p_profile_id: input.profileId,
      p_role: input.role,
      p_is_active: input.isActive,
      p_motorcycle_plate: input.motorcyclePlate ?? null,
      p_reason: reason,
    });
    // The RPC returns only { success, profileId }; read the updated directory
    // row so callers receive the same StaffMember shape as the fixture store.
    const staff = await readStaff();
    const member = staff.find((candidate) => candidate.profileId === input.profileId);
    if (!member) throw new AdminFailure("VALIDATION_ERROR", "Staff member not found.");
    return member;
  },

  async listStaff() {
    return readStaff();
  },

  async listRefunds() {
    return readRefunds();
  },

  async auditFeed(input) {
    return parseAuditFeed(
      await rpc("admin_get_audit_feed", {
        p_limit: input.limit ?? 50,
        p_offset: input.offset ?? 0,
        p_entity_type: input.entityType ?? null,
      }),
    );
  },
};
