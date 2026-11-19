import "server-only";

import { getKitchenStore } from "./store";
import type { KitchenBoard } from "./types";

/** Snapshot used by the server render and the 10-second polling route. */
export async function loadKitchenBoard(): Promise<KitchenBoard> {
  const store = getKitchenStore();
  const [tickets, settings, items] = await Promise.all([
    store.listTickets(),
    store.getSettings(),
    store.listMenuItems(),
  ]);

  return {
    tickets: [...tickets].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    settings,
    items,
    fetchedAt: new Date().toISOString(),
  };
}
