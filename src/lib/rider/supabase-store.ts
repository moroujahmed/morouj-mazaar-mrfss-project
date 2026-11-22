import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import type { RiderStore } from "./store-types";
import {
  riderActiveOrderSchema,
  riderCashSummarySchema,
  riderPinResultSchema,
  riderPoolArraySchema,
  riderShiftSchema,
} from "./types";

/**
 * Supabase-backed rider store. Reads and writes go only through the
 * security-definer RPCs documented in `API_CONTRACTS.md`; the rider derives
 * from `auth.uid()` and no table is touched directly.
 */

async function getShift() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_rider_shift");
  if (error) throw new Error(error.message);
  return riderShiftSchema.parse(data ?? { isOpen: false });
}

async function getCashSummary() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_rider_cash_summary");
  if (error) throw new Error(error.message);
  return riderCashSummarySchema.parse(data ?? {});
}

export const supabaseRiderStore: RiderStore = {
  async listPool() {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_rider_pool");
    if (error) throw new Error(error.message);
    return riderPoolArraySchema.parse(data ?? []);
  },

  async getActiveOrder() {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_rider_active_order");
    if (error) throw new Error(error.message);
    return data ? riderActiveOrderSchema.parse(data) : null;
  },

  getShift,
  getCashSummary,

  async claimOrder(orderId) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("claim_order_atomic", {
      p_order_id: orderId,
    });
    if (error) throw new Error(error.message);
    return riderActiveOrderSchema.parse(data);
  },

  async startDelivery(orderId) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("start_delivery", {
      p_order_id: orderId,
    });
    if (error) throw new Error(error.message);
    return riderActiveOrderSchema.parse(data);
  },

  async releaseOrder(orderId, reason) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("release_order", {
      p_order_id: orderId,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
  },

  async verifyPin({
    orderId,
    pin,
    latitude,
    longitude,
    ipHash,
    userAgent,
  }) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("verify_delivery_pin", {
      p_order_id: orderId,
      p_pin: pin,
      p_lat: latitude ?? undefined,
      p_lng: longitude ?? undefined,
      p_ip_hash: ipHash ?? undefined,
      p_user_agent: userAgent ?? undefined,
    });
    if (error) throw new Error(error.message);
    return riderPinResultSchema.parse(data);
  },

  async reportFailed(orderId, outcome, reason, coordinates) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("report_delivery_failed", {
      p_order_id: orderId,
      p_outcome: outcome,
      p_reason: reason,
      p_lat: coordinates?.latitude ?? undefined,
      p_lng: coordinates?.longitude ?? undefined,
    });
    if (error) throw new Error(error.message);
  },

  async updateTelemetry(payload) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("update_rider_telemetry", {
      p_order_id: payload.orderId,
      p_lat: payload.latitude,
      p_lng: payload.longitude,
      p_accuracy_m: payload.accuracy ?? undefined,
      p_heading: payload.heading ?? undefined,
      p_speed_mps: payload.speed ?? undefined,
    });
    if (error) throw new Error(error.message);
  },

  async startShift(openingFloat) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("start_rider_shift", {
      p_opening_float: openingFloat,
    });
    if (error) throw new Error(error.message);
    return getShift();
  },

  async endShift() {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("end_rider_shift");
    if (error) throw new Error(error.message);

    const expectedCash = (data as { expectedCash?: number } | null)
      ?.expectedCash;
    return {
      isOpen: false,
      shiftId: null,
      startedAt: null,
      openingFloat: 0,
      expectedCash: expectedCash ?? null,
    };
  },
};
