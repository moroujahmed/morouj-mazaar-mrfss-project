import "server-only";

import { fixtureOrderStore } from "./fixture-store";
import type { OrderStore } from "./store-types";
import { supabaseOrderStore } from "./supabase-store";

/**
 * Order-store selection.
 *
 * Production and normal development always use the Supabase service-role store.
 * `ORDERS_FIXTURE=1` is a test-only harness that keeps the pipeline in memory
 * so Playwright can run without a Supabase stack. It is never set by the
 * application itself, and deployment config never defines it.
 */
export function ordersFixtureMode(): boolean {
  return process.env.ORDERS_FIXTURE === "1";
}

export function getOrderStore(): OrderStore {
  return ordersFixtureMode() ? fixtureOrderStore : supabaseOrderStore;
}

export type { OrderStore };
