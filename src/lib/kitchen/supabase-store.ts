import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStorefrontMenu } from "@/lib/storefront/menu";
import { getPublicSettings } from "@/lib/storefront/public-settings";

import { kitchenTicketArraySchema, type KitchenMenuItem } from "./types";

/**
 * Supabase-backed kitchen store. Every write calls the audited
 * security-definer RPC as the signed-in staff member; no table is written
 * directly.
 */

async function listTickets() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_kitchen_orders");
  if (error) throw new Error(error.message);
  return kitchenTicketArraySchema.parse(data ?? []);
}

export const supabaseKitchenStore = {
  listTickets,

  async getTicket(orderId: string) {
    const tickets = await listTickets();
    return tickets.find((ticket) => ticket.orderId === orderId) ?? null;
  },

  async acceptOrder(orderId: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("accept_order", {
      p_order_id: orderId,
    });
    if (error) throw new Error(error.message);
    return { orderId, status: "PREPARING" as const };
  },

  async bumpOrder(
    orderId: string,
  ): Promise<{
    orderId: string;
    status: "READY_FOR_PICKUP" | "DELIVERED";
  }> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("bump_order", {
      p_order_id: orderId,
    });
    if (error) throw new Error(error.message);

    const status = (data as { status?: string } | null)?.status;
    if (status !== "READY_FOR_PICKUP" && status !== "DELIVERED") {
      throw new Error("ORDER_STATE_INVALID");
    }
    return { orderId, status };
  },

  async getSettings() {
    const result = await getPublicSettings();
    if (result.status !== "ok") {
      throw new Error("SETTINGS_UNAVAILABLE");
    }
    return {
      isKitchenBusy: result.settings.isKitchenBusy,
      busyBufferMinutes: result.settings.busyBufferMinutes,
      isKitchenPaused: result.settings.isKitchenPaused,
    };
  },

  async setBusy(busy: boolean, bufferMinutes: number) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("set_kitchen_busy", {
      p_busy: busy,
      p_buffer_minutes: bufferMinutes,
    });
    if (error) throw new Error(error.message);
  },

  async setPaused(paused: boolean) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("set_kitchen_paused", {
      p_paused: paused,
    });
    if (error) throw new Error(error.message);
  },

  async listMenuItems(): Promise<KitchenMenuItem[]> {
    const result = await getStorefrontMenu();
    if (result.status !== "ok") return [];

    return result.menu.categories.flatMap((category) =>
      category.items.map((item) => ({
        id: item.id,
        name: item.name,
        categoryName: category.name,
        isAvailable: item.isAvailable,
      })),
    );
  },

  async setItemAvailability(itemId: string, available: boolean) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("set_menu_item_availability", {
      p_item_id: itemId,
      p_available: available,
    });
    if (error) throw new Error(error.message);
  },

  async auditReprint(orderId: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("audit_kitchen_reprint", {
      p_order_id: orderId,
    });
    if (error) throw new Error(error.message);
  },
};
