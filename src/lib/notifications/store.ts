import "server-only";

import { fixtureNotificationStore } from "./fixture-store";
import { supabaseNotificationStore } from "./supabase-store";
import type { NotificationStore } from "./store-types";

/**
 * Notification-store selection. The fixture is reachable only through the
 * Playwright order-pipeline flag; production always uses the service-role
 * outbox.
 */
export function notificationsFixtureMode(): boolean {
  return process.env.ORDERS_FIXTURE === "1";
}

export function getNotificationStore(): NotificationStore {
  return notificationsFixtureMode()
    ? fixtureNotificationStore
    : supabaseNotificationStore;
}
