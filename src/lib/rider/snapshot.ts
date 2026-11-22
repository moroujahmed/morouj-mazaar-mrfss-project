import "server-only";

import { getRiderStore } from "./store";
import type { RiderSnapshot } from "./types";

/** Snapshot used by the server render and the 15-second polling route. */
export async function loadRiderSnapshot(riderId: string): Promise<RiderSnapshot> {
  const store = getRiderStore(riderId);
  const [pool, active, shift, cash] = await Promise.all([
    store.listPool(),
    store.getActiveOrder(),
    store.getShift(),
    store.getCashSummary(),
  ]);

  return {
    pool,
    active,
    shift,
    cash,
    fetchedAt: new Date().toISOString(),
  };
}
