import "server-only";

import { randomUUID } from "node:crypto";

import type {
  NotificationChannel,
  NotificationStore,
  PendingNotification,
} from "./store-types";

type FixtureNotification = PendingNotification & {
  status: "PENDING" | "SENT" | "FAILED";
  nextAttemptAt: string;
  sentAt: string | null;
  lastError: string | null;
  createdAt: string;
};

type NotificationFixtureState = {
  notifications: FixtureNotification[];
};

type NotificationFixtureGlobal = typeof globalThis & {
  __mrfssNotifications?: NotificationFixtureState;
};

function state(): NotificationFixtureState {
  const globalStore = globalThis as NotificationFixtureGlobal;
  globalStore.__mrfssNotifications ??= { notifications: [] };
  return globalStore.__mrfssNotifications;
}

export function resetNotificationStoreForTests(): void {
  const globalStore = globalThis as NotificationFixtureGlobal;
  delete globalStore.__mrfssNotifications;
}

/** Test-only seed for exercising the outbox worker without a database. */
export function seedFixtureNotification(input: {
  channel?: NotificationChannel;
  recipient?: string;
  template: string;
  payload?: Record<string, unknown>;
  attempts?: number;
  nextAttemptAt?: string;
}): FixtureNotification {
  const notification: FixtureNotification = {
    id: randomUUID(),
    channel: input.channel ?? "SMS",
    recipient: input.recipient ?? "+256772123456",
    template: input.template,
    payload: input.payload ?? {},
    attempts: input.attempts ?? 0,
    status: "PENDING",
    nextAttemptAt: input.nextAttemptAt ?? new Date().toISOString(),
    sentAt: null,
    lastError: null,
    createdAt: new Date().toISOString(),
  };
  state().notifications.push(notification);
  return notification;
}

export function listFixtureNotifications(): FixtureNotification[] {
  return state().notifications.map((notification) => ({ ...notification }));
}

/**
 * Playwright-only outbox. It mirrors the SQL outbox rules so the dispatch cron
 * can be exercised end to end without a Supabase stack.
 */
export const fixtureNotificationStore: NotificationStore = {
  async listPending(limit, dueAt) {
    return state()
      .notifications.filter(
        (notification) =>
          notification.status === "PENDING" &&
          notification.nextAttemptAt <= dueAt,
      )
      .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt))
      .slice(0, limit)
      .map(({ id, channel, recipient, template, payload, attempts }) => ({
        id,
        channel,
        recipient,
        template,
        payload,
        attempts,
      }));
  },

  async markSent(id, attempts, sentAt) {
    const notification = state().notifications.find((row) => row.id === id);
    if (!notification) return;
    notification.status = "SENT";
    notification.attempts = attempts;
    notification.sentAt = sentAt;
    notification.nextAttemptAt = sentAt;
    notification.lastError = null;
  },

  async markRetry(id, attempts, nextAttemptAt, failure) {
    const notification = state().notifications.find((row) => row.id === id);
    if (!notification) return;
    notification.status = "PENDING";
    notification.attempts = attempts;
    notification.nextAttemptAt = nextAttemptAt;
    notification.lastError = failure.slice(0, 500);
  },

  async markFailed(id, attempts, failure) {
    const notification = state().notifications.find((row) => row.id === id);
    if (!notification) return;
    notification.status = "FAILED";
    notification.attempts = attempts;
    notification.lastError = failure.slice(0, 500);
  },
};
