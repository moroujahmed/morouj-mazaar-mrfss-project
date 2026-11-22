import "server-only";

import { staffFixtureEnabled } from "@/lib/auth/fixture-token";

import { createFixtureAdminStore } from "./fixture-store";
import { supabaseAdminStore } from "./supabase-store";
import type { AdminStore } from "./store-types";

/**
 * Admin-store selection. The fixture is reachable only through the Playwright
 * staff flag; every other runtime uses the audited Supabase RPCs.
 */
export function adminFixtureMode(): boolean {
  return staffFixtureEnabled();
}

export function getAdminStore(): AdminStore {
  return adminFixtureMode() ? createFixtureAdminStore() : supabaseAdminStore;
}

export type { AdminStore };
