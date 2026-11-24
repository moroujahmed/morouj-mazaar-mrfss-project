import { describe, expect, it } from "vitest";

import {
  dispatchPendingNotifications,
  nextAttemptAt,
  NOTIFICATION_MAX_ATTEMPTS,
  NotificationTemplateError,
  renderNotification,
} from "@/lib/notifications/dispatch";
import type {
  NotificationStore,
  PendingNotification,
} from "@/lib/notifications/store-types";

function pending(
  overrides: Partial<PendingNotification> = {},
): PendingNotification {
  return {
    id: "notification-1",
    channel: "SMS",
    recipient: "+256772123456",
    template: "ORDER_READY",
    payload: { orderNumber: 1042 },
    attempts: 0,
    ...overrides,
  };
}

function createStore(rows: PendingNotification[]) {
  const sent: Array<{ id: string; attempts: number; sentAt: string }> = [];
  const retried: Array<{
    id: string;
    attempts: number;
    nextAttemptAt: string;
    error: string;
  }> = [];
  const failed: Array<{ id: string; attempts: number; error: string }> = [];

  const store: NotificationStore = {
    async listPending(_limit, _dueAt) {
      return rows;
    },
    async markSent(id, attempts, sentAt) {
      sent.push({ id, attempts, sentAt });
    },
    async markRetry(id, attempts, nextAttemptAtValue, error) {
      retried.push({
        id,
        attempts,
        nextAttemptAt: nextAttemptAtValue,
        error,
      });
    },
    async markFailed(id, attempts, error) {
      failed.push({ id, attempts, error });
    },
  };

  return { store, sent, retried, failed };
}

describe("notification template rendering", () => {
  it("prefers approved copy supplied in the payload", () => {
    expect(
      renderNotification({
        template: "ORDER_READY",
        payload: { message: "  Custom approved copy  " },
      }),
    ).toBe("Custom approved copy");
  });

  it("renders a known template with payload variables", () => {
    expect(
      renderNotification({
        template: "ORDER_CONFIRMED",
        payload: {
          orderNumber: 1042,
          trackerUrl: "https://app.example/orders/token",
        },
      }),
    ).toBe(
      "Morouj Mazaar: order #1042 is confirmed. Track it: https://app.example/orders/token",
    );
  });

  it("rejects an unknown template", () => {
    expect(() =>
      renderNotification({ template: "NOT_A_TEMPLATE", payload: {} }),
    ).toThrow(NotificationTemplateError);
  });

  it("rejects a missing template variable", () => {
    expect(() =>
      renderNotification({
        template: "ORDER_CONFIRMED",
        payload: { orderNumber: 1042 },
      }),
    ).toThrow(NotificationTemplateError);
  });
});

describe("notification backoff", () => {
  it("backs off exponentially from one minute", () => {
    const now = new Date("2026-11-24T09:00:00.000Z");
    expect(nextAttemptAt(1, now)).toBe("2026-11-24T09:01:00.000Z");
    expect(nextAttemptAt(2, now)).toBe("2026-11-24T09:02:00.000Z");
    expect(nextAttemptAt(3, now)).toBe("2026-11-24T09:04:00.000Z");
    expect(nextAttemptAt(4, now)).toBe("2026-11-24T09:08:00.000Z");
  });
});

describe("notification dispatch worker", () => {
  it("sends a due notification and marks it sent", async () => {
    const { store, sent, retried, failed } = createStore([pending()]);
    const messages: string[] = [];

    const summary = await dispatchPendingNotifications({
      store,
      send: async ({ message }) => {
        messages.push(message);
        return { ok: true };
      },
      now: new Date("2026-11-24T09:00:00.000Z"),
    });

    expect(summary).toEqual({ pending: 1, sent: 1, retried: 0, failed: 0 });
    expect(messages).toEqual([
      "Morouj Mazaar: order #1042 is ready. A rider will collect it shortly.",
    ]);
    expect(sent).toEqual([
      {
        id: "notification-1",
        attempts: 1,
        sentAt: "2026-11-24T09:00:00.000Z",
      },
    ]);
    expect(retried).toEqual([]);
    expect(failed).toEqual([]);
  });

  it("retries a provider failure with backoff", async () => {
    const { store, sent, retried, failed } = createStore([
      pending({ attempts: 1 }),
    ]);

    const summary = await dispatchPendingNotifications({
      store,
      send: async () => ({ ok: false, reason: "SEND_FAILED" }),
      now: new Date("2026-11-24T09:00:00.000Z"),
    });

    expect(summary).toEqual({ pending: 1, sent: 0, retried: 1, failed: 0 });
    expect(sent).toEqual([]);
    expect(failed).toEqual([]);
    expect(retried).toEqual([
      {
        id: "notification-1",
        attempts: 2,
        nextAttemptAt: "2026-11-24T09:02:00.000Z",
        error: "SEND_FAILED",
      },
    ]);
  });

  it("dead-letters after the maximum number of failures", async () => {
    const { store, retried, failed } = createStore([
      pending({ attempts: NOTIFICATION_MAX_ATTEMPTS - 1 }),
    ]);

    const summary = await dispatchPendingNotifications({
      store,
      send: async () => ({ ok: false, reason: "SEND_FAILED" }),
    });

    expect(summary).toEqual({ pending: 1, sent: 0, retried: 0, failed: 1 });
    expect(retried).toEqual([]);
    expect(failed).toEqual([
      {
        id: "notification-1",
        attempts: NOTIFICATION_MAX_ATTEMPTS,
        error: "SEND_FAILED",
      },
    ]);
  });

  it("does not burn an attempt when the provider is not configured", async () => {
    const { store, retried } = createStore([pending({ attempts: 2 })]);

    const summary = await dispatchPendingNotifications({
      store,
      send: async () => ({ ok: false, reason: "NOT_CONFIGURED" }),
      now: new Date("2026-11-24T09:00:00.000Z"),
    });

    expect(summary).toEqual({ pending: 1, sent: 0, retried: 1, failed: 0 });
    expect(retried[0]).toMatchObject({
      attempts: 2,
      error: "NOT_CONFIGURED",
    });
  });

  it("fails non-SMS channels permanently", async () => {
    const { store, failed } = createStore([
      pending({ channel: "WHATSAPP" }),
    ]);

    const summary = await dispatchPendingNotifications({
      store,
      send: async () => ({ ok: true }),
    });

    expect(summary).toEqual({ pending: 1, sent: 0, retried: 0, failed: 1 });
    expect(failed[0]).toMatchObject({ error: "CHANNEL_UNSUPPORTED" });
  });

  it("fails a notification whose template cannot be rendered", async () => {
    const { store, failed } = createStore([
      pending({ template: "ORDER_CONFIRMED", payload: {} }),
    ]);

    const summary = await dispatchPendingNotifications({
      store,
      send: async () => ({ ok: true }),
    });

    expect(summary).toEqual({ pending: 1, sent: 0, retried: 0, failed: 1 });
    expect(failed[0]).toMatchObject({
      error: "MISSING_TEMPLATE_VARIABLE",
    });
  });

  it("limits each run to the requested batch size", async () => {
    const { store } = createStore([pending()]);
    let requested = 0;

    await dispatchPendingNotifications({
      store: {
        ...store,
        async listPending(limit) {
          requested = limit;
          return [];
        },
      },
      send: async () => ({ ok: true }),
      limit: 7,
    });

    expect(requested).toBe(7);
  });
});
