import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { closeAllFixtureRiderShifts } from "./fixture-store";
import { riderFixtureMode } from "./store";

/**
 * Closes every open rider shift and snapshots expected cash for settlement.
 * Production calls the service-role-only `close_open_rider_shifts()` RPC; the
 * Playwright fixture mirrors the same behaviour in memory.
 */
export async function closeOpenRiderShifts(): Promise<number> {
  if (riderFixtureMode()) return closeAllFixtureRiderShifts();

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("close_open_rider_shifts");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
