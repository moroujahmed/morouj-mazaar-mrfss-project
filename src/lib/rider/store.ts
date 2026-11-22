import "server-only";

import { staffFixtureEnabled } from "@/lib/auth/fixture-token";

import { createFixtureRiderStore } from "./fixture-store";
import { supabaseRiderStore } from "./supabase-store";
import type { RiderStore } from "./store-types";

/**
 * Rider-store selection. The fixture is reachable only through the Playwright
 * staff flag; every other runtime (including local development without that
 * flag) uses the Supabase RPCs as the signed-in rider.
 */
export function riderFixtureMode(): boolean {
  return staffFixtureEnabled();
}

export function getRiderStore(riderId: string): RiderStore {
  return riderFixtureMode()
    ? createFixtureRiderStore(riderId)
    : supabaseRiderStore;
}

export type { RiderStore };
