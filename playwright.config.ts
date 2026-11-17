import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Four Chromium workers plus `next start` exhausts memory on Windows.
  // CI runners are larger, so they can use two workers in parallel.
  workers: process.env.CI ? 2 : 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      // Browser tests run without a Supabase stack. The server-only fixture is
      // read by the storefront menu loader and is never set in production.
      STOREFRONT_FIXTURE: "1",
      // Canonical OSRM snapshot for routing tests. Production always calls OSRM.
      DISTANCE_FIXTURE: "1",
      // In-memory order/invoice pipeline for browser tests.
      ORDERS_FIXTURE: "1",
      PAYMENTS_FIXTURE: "1",
      OTP_FIXTURE: "1",
      // Per-instance limiters/cache instead of dummy Upstash calls.
      RATE_LIMIT_FIXTURE: "1",
      // Production-mode validation requires live payments, durable limits,
      // OSRM, and a cron secret. These are dummy values for the test server.
      PAYMENTS_MODE: "live",
      FLW_PUBLIC_KEY: "test-flw-public-key-not-a-secret",
      FLW_SECRET_KEY: "test-flw-secret-key-not-a-secret",
      FLW_WEBHOOK_HASH: "test-webhook-hash",
      FLW_BASE_URL: "https://api.flutterwave.com/v3",
      AFRICASTALKING_API_KEY: "test-africastalking-key",
      AFRICASTALKING_USERNAME: "sandbox",
      AFRICASTALKING_SENDER_ID: "",
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_SUPPORT_WHATSAPP: "+256700000000",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key-000000000000000000",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-000000000000",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-upstash-token",
      OSRM_BASE_URL: "https://osrm.example.com",
      CRON_SECRET: "test-cron-secret",
      SENTRY_DSN: "",
    },
  },
});
