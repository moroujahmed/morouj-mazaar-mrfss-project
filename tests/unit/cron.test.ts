import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "198.51.100.21" }),
}));

import {
  GET as closeShifts,
  POST as closeShiftsPost,
} from "@/app/api/cron/close-shifts/route";
import { POST as dispatchNotifications } from "@/app/api/notifications/dispatch/route";
import { resetServerEnvCache } from "@/lib/env";
import {
  listFixtureNotifications,
  resetNotificationStoreForTests,
  seedFixtureNotification,
} from "@/lib/notifications/fixture-store";
import {
  createFixtureRiderStore,
  resetRiderStoreForTests,
} from "@/lib/rider/fixture-store";

const CRON_SECRET = "test-cron-secret";
const RIDER_JUMA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03";

function stubBaseEnv() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STAFF_FIXTURE", "1");
  vi.stubEnv("ORDERS_FIXTURE", "1");
  vi.stubEnv("OTP_FIXTURE", "1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3100");
  vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "+256700000000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key-000000000000000000");
  vi.stubEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "test-service-role-key-000000000000",
  );
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  resetServerEnvCache();
}

function request(path: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { method: "POST", headers });
}

beforeEach(() => {
  stubBaseEnv();
  resetRiderStoreForTests();
  resetNotificationStoreForTests();
});

describe("close-shifts cron", () => {
  it("rejects a request without the cron secret", async () => {
    const response = await closeShifts(request("/api/cron/close-shifts"));
    expect(response.status).toBe(401);
  });

  it("rejects a wrong secret", async () => {
    const response = await closeShifts(
      request("/api/cron/close-shifts", {
        authorization: "Bearer wrong-secret",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("fails closed when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    resetServerEnvCache();

    const response = await closeShiftsPost(request("/api/cron/close-shifts"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "CONFIGURATION",
    });
  });

  it("closes every open fixture shift and snapshots expected cash", async () => {
    const juma = createFixtureRiderStore(RIDER_JUMA);
    await juma.startShift(20_000);
    expect((await juma.getShift()).isOpen).toBe(true);

    const response = await closeShifts(
      request("/api/cron/close-shifts", {
        authorization: `Bearer ${CRON_SECRET}`,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      closed: 1,
    });
    expect((await juma.getShift()).isOpen).toBe(false);
  });

  it("is idempotent when no shift is open", async () => {
    const response = await closeShiftsPost(
      request("/api/cron/close-shifts", { "x-cron-secret": CRON_SECRET }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      closed: 0,
    });
  });
});

describe("notifications dispatch route", () => {
  it("rejects a request without the cron secret", async () => {
    const response = await dispatchNotifications(
      request("/api/notifications/dispatch"),
    );
    expect(response.status).toBe(401);
  });

  it("fails closed when the SMS provider is not configured", async () => {
    vi.stubEnv("ORDERS_FIXTURE", "0");
    vi.stubEnv("OTP_FIXTURE", "0");
    vi.stubEnv("AFRICASTALKING_API_KEY", "");
    vi.stubEnv("AFRICASTALKING_USERNAME", "");
    resetServerEnvCache();

    const response = await dispatchNotifications(
      request("/api/notifications/dispatch", {
        authorization: `Bearer ${CRON_SECRET}`,
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "CONFIGURATION",
    });
  });

  it("returns an empty summary when the outbox has no due rows", async () => {
    const response = await dispatchNotifications(
      request("/api/notifications/dispatch", {
        authorization: `Bearer ${CRON_SECRET}`,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      pending: 0,
      sent: 0,
      retried: 0,
      failed: 0,
    });
  });

  it("dispatches a due notification through the outbox worker", async () => {
    seedFixtureNotification({
      template: "ORDER_READY",
      payload: { orderNumber: 1042 },
    });

    const response = await dispatchNotifications(
      request("/api/notifications/dispatch", {
        authorization: `Bearer ${CRON_SECRET}`,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      pending: 1,
      sent: 1,
      retried: 0,
      failed: 0,
    });

    const [notification] = listFixtureNotifications();
    expect(notification).toMatchObject({
      status: "SENT",
      attempts: 1,
      lastError: null,
    });
    expect(notification?.sentAt).not.toBeNull();
  });

  it("is idempotent after a notification has been sent", async () => {
    seedFixtureNotification({
      template: "ORDER_READY",
      payload: { orderNumber: 1042 },
    });

    await dispatchNotifications(
      request("/api/notifications/dispatch", {
        authorization: `Bearer ${CRON_SECRET}`,
      }),
    );
    const second = await dispatchNotifications(
      request("/api/notifications/dispatch", {
        authorization: `Bearer ${CRON_SECRET}`,
      }),
    );

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({
      ok: true,
      pending: 0,
      sent: 0,
    });
  });

  it("dead-letters an unsupported channel", async () => {
    seedFixtureNotification({
      channel: "WHATSAPP",
      template: "ORDER_READY",
      payload: { orderNumber: 1042 },
    });

    const response = await dispatchNotifications(
      request("/api/notifications/dispatch", {
        authorization: `Bearer ${CRON_SECRET}`,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      pending: 1,
      sent: 0,
      failed: 1,
    });
    expect(listFixtureNotifications()[0]).toMatchObject({
      status: "FAILED",
      lastError: "CHANNEL_UNSUPPORTED",
    });
  });
});
