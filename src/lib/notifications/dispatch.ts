import "server-only";

import type { SmsResult } from "./sms";
import type {
  NotificationStore,
  PendingNotification,
} from "./store-types";

/**
 * Notification outbox worker. The dispatcher claims due rows, renders an SMS,
 * sends it through the injected adapter, and records the outcome with bounded
 * exponential backoff. After `NOTIFICATION_MAX_ATTEMPTS` failures the row moves
 * to the dead-letter `FAILED` state described in `docs/INTEGRATIONS_AND_HARDWARE_APIS.md`.
 */

export const NOTIFICATION_BATCH_SIZE = 50;
export const NOTIFICATION_MAX_ATTEMPTS = 5;
export const NOTIFICATION_BASE_BACKOFF_MS = 60_000;

/**
 * Provisional transactional copy. Exact wording and the sender ID remain
 * founder dependencies (F-15/F-44); an outbox row may override the template by
 * supplying `payload.message` once approved copy is available.
 */
const TEMPLATES: Record<string, string> = {
  ORDER_CONFIRMED:
    "Morouj Mazaar: order #{{orderNumber}} is confirmed. Track it: {{trackerUrl}}",
  ORDER_READY:
    "Morouj Mazaar: order #{{orderNumber}} is ready. A rider will collect it shortly.",
  OUT_FOR_DELIVERY:
    "Morouj Mazaar: order #{{orderNumber}} is on the way. Have your handover PIN ready.",
  DELIVERED:
    "Morouj Mazaar: order #{{orderNumber}} was delivered. Thank you for ordering.",
  ORDER_CANCELLED:
    "Morouj Mazaar: order #{{orderNumber}} was cancelled. Contact support: {{supportUrl}}",
};

export class NotificationTemplateError extends Error {
  constructor(
    readonly reason: "UNKNOWN_TEMPLATE" | "MISSING_TEMPLATE_VARIABLE",
  ) {
    super(reason);
    this.name = "NotificationTemplateError";
  }
}

export type NotificationSender = (input: {
  to: string;
  message: string;
}) => Promise<SmsResult>;

export type DispatchSummary = {
  pending: number;
  sent: number;
  retried: number;
  failed: number;
};

function isScalar(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

/**
 * Renders the outbox row to a single SMS body. `payload.message` is the
 * escape hatch for approved copy; otherwise the template and its variables are
 * resolved from the payload. Missing copy fails permanently instead of sending
 * a half-rendered message.
 */
export function renderNotification(
  notification: Pick<PendingNotification, "template" | "payload">,
): string {
  const override = notification.payload.message;
  if (typeof override === "string" && override.trim()) {
    return override.trim();
  }

  const template = TEMPLATES[notification.template];
  if (!template) throw new NotificationTemplateError("UNKNOWN_TEMPLATE");

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = notification.payload[key];
    if (!isScalar(value)) {
      throw new NotificationTemplateError("MISSING_TEMPLATE_VARIABLE");
    }
    return String(value);
  });
}

/** Exponential backoff: 1, 2, 4, 8 minutes after each failed attempt. */
export function nextAttemptAt(attempts: number, now: Date): string {
  const exponent = Math.max(0, attempts - 1);
  const delay = NOTIFICATION_BASE_BACKOFF_MS * 2 ** exponent;
  return new Date(now.getTime() + delay).toISOString();
}

export async function dispatchPendingNotifications({
  store,
  send,
  now = new Date(),
  limit = NOTIFICATION_BATCH_SIZE,
}: {
  store: NotificationStore;
  send: NotificationSender;
  now?: Date;
  limit?: number;
}): Promise<DispatchSummary> {
  const pending = await store.listPending(limit, now.toISOString());
  const summary: DispatchSummary = {
    pending: pending.length,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  for (const notification of pending) {
    if (notification.channel !== "SMS") {
      await store.markFailed(
        notification.id,
        notification.attempts + 1,
        "CHANNEL_UNSUPPORTED",
      );
      summary.failed += 1;
      continue;
    }

    let message: string;
    try {
      message = renderNotification(notification);
    } catch (error) {
      const reason =
        error instanceof NotificationTemplateError
          ? error.reason
          : "TEMPLATE_INVALID";
      await store.markFailed(
        notification.id,
        notification.attempts + 1,
        reason,
      );
      summary.failed += 1;
      continue;
    }

    const result = await send({ to: notification.recipient, message });
    const attempts = notification.attempts + 1;

    if (result.ok) {
      await store.markSent(notification.id, attempts, now.toISOString());
      summary.sent += 1;
      continue;
    }

    if (result.reason === "NOT_CONFIGURED") {
      // Do not burn an attempt on a configuration gap; retry on the next run.
      await store.markRetry(
        notification.id,
        notification.attempts,
        nextAttemptAt(attempts, now),
        "NOT_CONFIGURED",
      );
      summary.retried += 1;
      continue;
    }

    if (attempts >= NOTIFICATION_MAX_ATTEMPTS) {
      await store.markFailed(notification.id, attempts, "SEND_FAILED");
      summary.failed += 1;
    } else {
      await store.markRetry(
        notification.id,
        attempts,
        nextAttemptAt(attempts, now),
        "SEND_FAILED",
      );
      summary.retried += 1;
    }
  }

  return summary;
}
