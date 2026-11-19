import "server-only";

import { staffFixtureEnabled } from "@/lib/auth/fixture-token";

import { fixtureKitchenStore, type KitchenStore } from "./fixture-store";
import { supabaseKitchenStore } from "./supabase-store";

/**
 * Kitchen-store selection. The fixture is reachable only through the
 * Playwright staff flag; every other runtime (including local development
 * without that flag) uses the Supabase RPCs as the signed-in staff member.
 */
export function kitchenFixtureMode(): boolean {
  return staffFixtureEnabled();
}

export function getKitchenStore(): KitchenStore {
  return kitchenFixtureMode() ? fixtureKitchenStore : supabaseKitchenStore;
}

export type { KitchenStore };
